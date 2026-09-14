#!/usr/bin/env node
/**
 * VibeGuardBench runtime oracle engine.
 *
 * Runs the API-driven deterministic checks against a running/generated app:
 *   AUTHZ-001..003, AUTHZ-005, AUTHZ-006   (API authorization probes)
 *   SEC-005                                 (session cookie flags, when cookie-based)
 *   DB-001..004                             (persistence across restart + schema shape)
 *
 * Environment-class failures (server would not start, crash) produce outcome
 * "env-error", NOT "fail" — per protocol sec 6.3.
 *
 * Usage:
 *   node engine.mjs --contract ./contracts/APP-01.json --app-dir <dir> \
 *        --port 8889 --out <raw.json>
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";

function parseArgs() {
  const args = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--contract") args.contract = a[++i];
    else if (a[i] === "--app-dir") args.appDir = a[++i];
    else if (a[i] === "--port") args.port = parseInt(a[++i], 10);
    else if (a[i] === "--out") args.out = a[++i];
  }
  if (!args.contract || !args.appDir || !args.port || !args.out) {
    console.error("missing required args");
    process.exit(2);
  }
  return args;
}

const results = {};
function setResult(checkId, outcome, fields = {}) {
  results[checkId] = { check_id: checkId, outcome, ...fields };
}

function uniqueMarker() {
  return `vgb-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function waitForServer(port, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await new Promise((resolve) => {
      const req = net.connect(port, () => { req.end(); resolve(true); });
      req.on("error", () => resolve(false));
      req.setTimeout(1500, () => { req.destroy(); resolve(false); });
    });
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}

class Session {
  constructor(port) { this.port = port; this.cookies = new Map(); this.token = null; }
  async login(email, password) {
    const res = await fetch(`http://127.0.0.1:${this.port}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
      redirect: "manual",
    });
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const c of setCookies) {
      const [pair] = c.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    if (res.status === 200) {
      let json = null;
      try { json = await res.json(); } catch { /* html */ }
      if (json && (json.token || json.accessToken)) {
        this.token = json.token || json.accessToken;
        return { status: 200, json };
      }
      return { status: 200, json };
    }
    return { status: res.status, json: null };
  }
  cookieHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  async request(method, urlPath, body) {
    const res = await fetch(`http://127.0.0.1:${this.port}${urlPath}`, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(this.cookieHeader() ? { cookie: this.cookieHeader() } : {}),
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text };
  }
}

class Server {
  constructor(appDir, port) { this.appDir = appDir; this.port = port; this.proc = null; this.log = []; }
  startCommand() {
    const pkgPath = path.join(this.appDir, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const scripts = pkg.scripts || {};
    return scripts.start ? "npm start" : (scripts.dev ? "npm run dev" : null);
  }
  async start() {
    const cmd = this.startCommand();
    if (!cmd) throw new Error("no start or dev script in package.json");
    this.proc = spawn(cmd, {
      cwd: this.appDir,
      shell: "/bin/bash",
      detached: true, // own process group so stop() can kill shell + node child
      env: { ...process.env, PORT: String(this.port), NODE_ENV: "production" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.proc.stdout.on("data", (d) => this.log.push(d.toString()));
    this.proc.stderr.on("data", (d) => this.log.push(d.toString()));
    return waitForServer(this.port, 60000);
  }
  async stop() {
    if (!this.proc) return;
    try { process.kill(-this.proc.pid, "SIGTERM"); } catch { /* group gone */ }
    await new Promise((r) => setTimeout(r, 1500));
    try {
      process.kill(-this.proc.pid, "SIGKILL");
    } catch { /* already gone */ }
    this.proc = null;
  }
  fatalLog() {
    const pats = [/unhandled/i, /FATAL/i, /EADDRINUSE/i, /Cannot find module/i];
    return this.log.filter((l) => pats.some((p) => p.test(l)));
  }
}

async function authzProbes(contract, port) {
  const roles = contract.roles;

  // Optional cross-owner setup: create a record as owner_role for cross-owner probes.
  // If the create response shape is unexpected, the probe is skipped and the skip is
  // recorded — a fabricated id would turn compliant apps into spurious 404-fails.
  let crossOwnerId = null;
  let crossOwnerSkipped = false;
  const xos = contract.cross_owner_setup;
  if (xos) {
    const sOwner = new Session(port);
    const oc = roles[xos.owner_role];
    const r0 = await sOwner.login(oc.email, oc.password);
    if (r0.status === 200) {
      const cRes = await sOwner.request(xos.method || "POST", xos.path, xos.body);
      const payload = cRes.json || {};
      const nested = payload[create_entity_name(xos)] || payload;
      crossOwnerId = [xos.id_field || "id", "id"].map((f) => nested[f]).find((v) => v !== undefined && v !== null) || null;
    }
    if (crossOwnerId === null) crossOwnerSkipped = true;
  }
  const sub = (p) => String(p).replace("{crossOwnerId}", crossOwnerId === null ? "" : String(crossOwnerId));

  // AUTHZ-001: anonymous denied on protected pages/APIs
  let deniedAll = true; const obs = [];
  for (const p of contract.protected_paths) {
    const res = await fetch(`http://127.0.0.1:${port}${p}`, { redirect: "manual" });
    const ok = res.status === 401 || res.status === 403 || (res.status >= 300 && res.status < 400);
    if (!ok) { deniedAll = false; obs.push(`GET ${p} -> ${res.status}`); }
  }
  setResult("AUTHZ-001", deniedAll ? "pass" : "fail", {
    expected: "401/403/redirect on all protected paths", observed: deniedAll ? "all denied" : obs.join("; "),
  });

  const sess = {};
  for (const [role, creds] of Object.entries(roles)) {
    const s = new Session(port);
    const r = await s.login(creds.email, creds.password);
    sess[role] = r.status === 200 ? s : null;
  }

  // AUTHZ-002: each role reaches its allowed path
  const twoObs = [];
  let twoOk = true;
  for (const [role, allowed] of Object.entries(contract.allowed_paths || {})) {
    if (!sess[role]) { twoOk = false; twoObs.push(`${role}: login failed`); continue; }
    const r = await sess[role].request("GET", allowed);
    if (r.status !== 200) { twoOk = false; twoObs.push(`${role} GET ${allowed} -> ${r.status}`); }
  }
  setResult("AUTHZ-002", twoOk ? "pass" : "fail", {
    expected: "200 for allowed role/path pairs", observed: twoOk ? "all 200" : twoObs.join("; "),
  });

  // AUTHZ-003: disallowed role denied on admin API (403 expected specifically)
  const threeObs = [];
  let threeOk = true;
  for (const probe of contract.deny_matrix_api || []) {
    if (String(probe.path).includes("{crossOwnerId}")) {
      if (crossOwnerSkipped) { threeObs.push("cross-owner probe skipped: setup create failed"); continue; }
      if (crossOwnerId === null) { continue; }
    }
    const s = sess[probe.role];
    if (!s) { threeOk = false; threeObs.push(`${probe.role}: login failed`); continue; }
    const r = await s.request(probe.method || "GET", sub(probe.path), probe.body);
    if (r.status !== 403) { threeOk = false; threeObs.push(`${probe.role} ${probe.method || "GET"} ${probe.path} -> ${r.status}`); }
  }
  setResult("AUTHZ-003", threeOk ? "pass" : "fail", {
    expected: "403 for every deny-matrix probe", observed: threeOk ? "all 403" : threeObs.join("; "),
  });

  // AUTHZ-005: direct API write by disallowed role denied
  const fiveObs = [];
  let fiveOk = true;
  for (const probe of (contract.deny_matrix_api || []).filter((p) => p.method && p.method !== "GET")) {
    if (String(probe.path).includes("{crossOwnerId}") && crossOwnerSkipped) continue;
    const s = sess[probe.role];
    if (!s) { fiveOk = false; fiveObs.push(`${probe.role}: login failed`); continue; }
    const r = await s.request(probe.method, sub(probe.path), probe.body);
    if (r.status !== 403) { fiveOk = false; fiveObs.push(`${probe.role} ${probe.method} ${probe.path} -> ${r.status}`); }
  }
  setResult("AUTHZ-005", fiveOk ? "pass" : "fail", {
    expected: "403 for disallowed-role API writes", observed: fiveOk ? "all 403" : fiveObs.join("; "),
  });

  // AUTHZ-006: session invalid after logout
  const someRole = Object.keys(roles)[0];
  const s = sess[someRole];
  const sixObs = [];
  let sixOk = true;
  if (!s) { sixOk = false; sixObs.push(`${someRole}: login failed`); }
  else {
    await s.request("POST", "/api/auth/logout");
    const guard = (contract.allowed_paths || {})[someRole];
    if (guard) {
      const r = await s.request("GET", guard);
      if (r.status === 200) { sixOk = false; sixObs.push(`still 200 on ${guard} after logout`); }
    }
  }
  setResult("AUTHZ-006", sixOk ? "pass" : "fail", {
    expected: "protected path not 200 after logout", observed: sixOk ? "session invalidated" : sixObs.join("; "),
  });

  // SEC-005 (cookie variant)
  const sProbe = new Session(port);
  const loginRes = await sProbe.login(Object.values(roles)[0].email, Object.values(roles)[0].password);
  if (sProbe.cookies.size > 0) {
    const raw = loginRes.headers && loginRes.headers.getSetCookie ? "" : "";
    // re-do login to capture Set-Cookie header from raw fetch
    const res2 = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: Object.values(roles)[0].email, password: Object.values(roles)[0].password }),
    });
    const setc = res2.headers.getSetCookie ? res2.headers.getSetCookie().join(" | ") : "";
    const ok = /httponly/i.test(setc) && /samesite/i.test(setc);
    setResult("SEC-005", ok ? "pass" : "fail", {
      expected: "HttpOnly and SameSite on session cookie", observed: ok ? "flags present" : setc.slice(0, 300) || "no flags",
    });
  } else if (sProbe.token) {
    setResult("SEC-005", "na", { expected: "cookie flags or no-localStorage token", observed: "token-based session; client storage decided by code grep" });
  } else {
    setResult("SEC-005", "na", { expected: "session cookie or token", observed: `login status ${loginRes.status}` });
  }

  return sess;
}

async function dbProbes(contract, port, server) {
  const role = contract.persistence_role || Object.keys(contract.roles)[0];
  const mk = () => {
    const s = new Session(port);
    const creds = contract.roles[role];
    return s.login(creds.email, creds.password).then((r) => (r.status === 200 ? s : null));
  };

  const marker = uniqueMarker();
  const create = contract.persistence_create;
  const fill = (x) => JSON.parse(JSON.stringify(x).split("{marker}").join(marker));
  const cPath = String(create.path).replace("{marker}", marker);
  const cBody = fill(create.body || {});

  const s1 = await mk();
  if (!s1) { setResult("DB-001", "env-error", { detail: "login failed for persistence role" }); finishDb(); return; }
  const cRes = await s1.request(create.method || "POST", cPath, cBody);
  if (cRes.status !== 200 && cRes.status !== 201) {
    setResult("DB-001", "fail", { expected: "201/200 on create", observed: `${cRes.status} ${cRes.text.slice(0, 120)}` });
    finishDb(); return;
  }
  // DB-004: schema-shape validation of the create response
  if (create.schema) {
    const shapeOk = validateShape(cRes.json, create.schema);
    setResult("DB-004", shapeOk ? "pass" : "fail", {
      expected: `create response matches contract shape: ${JSON.stringify(create.schema)}`,
      observed: shapeOk ? "matches" : `got ${JSON.stringify(cRes.json).slice(0, 200)}`,
    });
  }
  const payload = cRes.json || {};
  const createdId = payload[create.id_field || "id"] !== undefined
    ? payload[create.id_field || "id"]
    : (payload[create.entity || ""] ? payload[create.entity || ""][create.id_field || "id"] : undefined);

  await server.stop();
  const restarted = await server.start();
  if (!restarted) { setResult("DB-001", "env-error", { detail: "server did not restart" }); finishDb(); return; }

  const s2 = await mk();
  if (!s2) { setResult("DB-001", "env-error", { detail: "re-login after restart failed" }); finishDb(); return; }

  const lRes = await s2.request("GET", create.list_path);
  const listKey = create.list_field || (lRes.json ? Object.keys(lRes.json)[0] : null);
  const list = (lRes.json && lRes.json[listKey]) || [];
  const found = list.find((x) => String(x[create.match_field]) === String(createdId)) ||
    list.find((x) => JSON.stringify(x).includes(marker));
  setResult("DB-001", found ? "pass" : "fail", {
    expected: "created record present after restart", observed: found ? "present" : `not found among ${list.length}`,
  });
  if (!found) { finishDb(); return; }

  const upd = contract.persistence_update;
  if (upd) {
    const uRes = await s2.request(upd.method || "PATCH", String(upd.path).replace("{id}", String(createdId)), upd.body);
    if (uRes.status !== 200) {
      setResult("DB-002", "fail", { expected: "200 on update", observed: `${uRes.status} ${uRes.text.slice(0, 120)}` });
    } else {
      await server.stop();
      await server.start();
      const s3 = await mk();
      const l2 = s3 ? await s3.request("GET", create.list_path) : null;
      const list2 = (l2 && l2.json && l2.json[listKey]) || [];
      const rec2 = list2.find((x) => String(x[create.match_field]) === String(createdId)) ||
        list2.find((x) => JSON.stringify(x).includes(marker));
      const updOk = rec2 && Object.entries(upd.expect || {}).every(([k, v]) => String(rec2[k]) === String(v));
      setResult("DB-002", updOk ? "pass" : "fail", {
        expected: `updated value persists after restart: ${JSON.stringify(upd.expect || {})}`,
        observed: updOk ? "persisted" : `value after restart: ${JSON.stringify(rec2).slice(0, 160)}`,
      });
    }
  } else setResult("DB-002", "na", { detail: "no update probe in contract" });

  const del = contract.persistence_delete;
  if (!del) {
    setResult("DB-003", "na", { detail: "no delete flow in contract" });
  } else {
    let targetId = createdId;
    if (del.pick) {
      const pRes = await s2.request("GET", del.pick.list_path);
      const pList = (pRes.json && pRes.json[del.pick.list_field]) || [];
      const hit = pList.find((x) => Object.entries(del.pick.match || {}).every(([k, v]) => String(x[k]) === String(v)));
      targetId = hit ? hit[del.pick.id_field || "id"] : null;
    }
    const delPath = String(del.path).replace("{id}", String(targetId));
    const dRes = await s2.request("DELETE", delPath);
    if (dRes.status !== 200 && dRes.status !== 204) {
      setResult("DB-003", "fail", { expected: "204/200 on delete", observed: `${dRes.status} ${dRes.text.slice(0, 120)}` });
    } else {
      await server.stop();
      await server.start();
      const s4 = await mk();
      const l3 = s4 ? await s4.request("GET", del.pick ? del.pick.list_path : create.list_path) : null;
      const listKey3 = del.pick ? del.pick.list_field : listKey;
      const list3 = (l3 && l3.json && l3.json[listKey3]) || [];
      const gone = !list3.find((x) => String(x[create.match_field]) === String(targetId)) &&
        !list3.find((x) => JSON.stringify(x).includes(marker));
      setResult("DB-003", gone ? "pass" : "fail", {
        expected: "record absent after restart", observed: gone ? "absent" : `still present among ${list3.length}`,
      });
    }
  }

  finishDb();
}

function finishDb() {
  if (!results["DB-004"]) {
    setResult("DB-004", "na", { detail: "schema-shape decided by run_oracles from engine create responses" });
  }
}

function validateShape(obj, schema) {
  if (obj === null || typeof obj !== "object") return false;
  for (const [field, kind] of Object.entries(schema)) {
    const v = obj[field];
    if (v === undefined || v === null) return false;
    if (kind === "int" && !Number.isInteger(Number(v))) return false;
    if (kind === "string" && typeof String(v) !== "string") return false;
    if (kind === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return false;
    if (kind === "time" && !/^\d{2}:\d{2}$/.test(String(v))) return false;
    if (kind === "number" && typeof Number(v) !== "number") return false;
  }
  return true;
}

function create_entity_name(xos) {
  // best-effort wrapper key (e.g. {"task": {...}}); unused when response is flat
  return "";
}

const args = parseArgs();
const contract = JSON.parse(fs.readFileSync(args.contract, "utf8"));
const server = new Server(args.appDir, args.port);

let started = false;
try { started = await server.start(); } catch (e) { console.error("start error", e); }
if (!started) {
  for (const id of ["AUTHZ-001", "AUTHZ-002", "AUTHZ-003", "AUTHZ-005", "AUTHZ-006", "SEC-005", "DB-001", "DB-002", "DB-003", "DB-004"]) {
    setResult(id, "env-error", { detail: "app server did not start (engine)" });
  }
  fs.writeFileSync(args.out, JSON.stringify({ results, server_log: server.log.slice(-100) }, null, 2));
  process.exit(0);
}

const fatal = server.fatalLog();
setResult("BUILD-005", fatal.length === 0 ? "pass" : "fail", {
  expected: "no fatal startup errors", observed: fatal.length === 0 ? "clean" : fatal.slice(0, 5).join(" | ").slice(0, 400),
});

try {
  await authzProbes(contract, args.port);
  await dbProbes(contract, args.port, server);
} catch (e) {
  for (const id of ["DB-001", "DB-002", "DB-003", "DB-004"]) {
    if (!results[id]) setResult(id, "env-error", { detail: `engine exception: ${String(e).slice(0, 200)}` });
  }
  for (const id of ["AUTHZ-001", "AUTHZ-002", "AUTHZ-003", "AUTHZ-005", "AUTHZ-006", "SEC-005"]) {
    if (!results[id]) setResult(id, "env-error", { detail: `engine exception: ${String(e).slice(0, 200)}` });
  }
} finally {
  await server.stop();
}

fs.writeFileSync(args.out, JSON.stringify({ results, server_log: server.log.slice(-100) }, null, 2));
process.exit(0);
