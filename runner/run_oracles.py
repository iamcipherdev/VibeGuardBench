#!/usr/bin/env python3
"""VibeGuardBench oracle orchestrator.

Executes the full frozen check suite against one application iteration and writes
a validated run record + check results. Implements the whole-suite rule: every
category runs every time.

Usage:
  python runner/run_oracles.py --run-id APP-01-LOV-r1-i000 --task APP-01 \
      --builder LOV --rep 1 --iteration 0 --app-dir generated-apps/APP-01-LOV-r1-i000
"""
import argparse
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ORACLES = REPO / "oracles"
RAW_RUNS = REPO / "data" / "raw" / "runs"

PORT = int(os.environ.get("VGB_PORT", "8899"))
NOW = lambda: dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")  # noqa: E731

SEED_PASSWORDS = {
    "APP-01": ["patient-pass-1", "admin-pass-9"],
    "APP-02": ["viewer-pass-1", "member-pass-2", "admin-pass-9"],
    "APP-03": ["staff-pass-1", "manager-pass-8"],
}

# Per-app applicability (frozen). Checks not listed as applicable are "na".
FUNC_APPLICABLE = {
    "APP-01": ["FUNC-001", "FUNC-002", "FUNC-003", "FUNC-004", "FUNC-006", "FUNC-007",
               "FUNC-008", "FUNC-009", "FUNC-010", "FUNC-011"],
    "APP-02": ["FUNC-001", "FUNC-002", "FUNC-003", "FUNC-004", "FUNC-005", "FUNC-007",
               "FUNC-008", "FUNC-009", "FUNC-010", "FUNC-011"],
    "APP-03": ["FUNC-001", "FUNC-002", "FUNC-003", "FUNC-004", "FUNC-005", "FUNC-007",
               "FUNC-008", "FUNC-009", "FUNC-010", "FUNC-011"],
}

SECRET_PATTERNS = [
    ("aws-access-key", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("github-token", re.compile(r"gh[pousr]_[A-Za-z0-9]{36}")),
    ("openai-style-key", re.compile(r"sk-[A-Za-z0-9]{32,}")),
    ("private-key-block", re.compile(r"-----BEGIN (RSA |EC )?PRIVATE KEY-----")),
    ("generic-secret-literal", re.compile(r"(?i)(password|secret|api[_-]?key|apikey)\s*[:=]\s*[\"'][^\"']{8,}[\"']")),
]

DEBUG_PATHS = ["/debug", "/_debug", "/api/debug", "/__debug", "/test", "/api/test",
               "/admin/debug", "/debug/vars", "/env"]

RUNTIME_CHECKS = ([f"FUNC-{i:03d}" for i in range(1, 12)] +
                  [f"AUTHZ-{i:03d}" for i in range(1, 7)] +
                  [f"A11Y-{i:03d}" for i in range(1, 5)] +
                  ["DB-001", "DB-002", "DB-003", "DB-004"])


def sh(cmd, cwd, timeout, env=None, shell=False):
    try:
        p = subprocess.run(cmd, cwd=cwd, timeout=timeout, env=env, shell=shell,
                           capture_output=True, text=True)
        return p.returncode, p.stdout, p.stderr
    except subprocess.TimeoutExpired:
        return 124, "", "TIMEOUT"
    except FileNotFoundError as e:
        return 127, "", str(e)


def pkg_scripts(app_dir):
    pj = Path(app_dir) / "package.json"
    if not pj.exists():
        return {}
    try:
        return (json.loads(pj.read_text()) or {}).get("scripts", {}) or {}
    except Exception:
        return {}


class Checks:
    def __init__(self, run_id, iteration):
        self.run_id = run_id
        self.iteration = iteration
        self.items = []
        self.raws = {}

    def add(self, check_id, outcome, category, observed="", expected="", detail="", tool="", raw_key=None):
        self.items.append({
            "check_id": check_id, "category": category, "outcome": outcome,
            "run_id": self.run_id, "iteration": self.iteration,
            "observed": str(observed)[:400], "expected": str(expected)[:400],
            "detail": str(detail)[:1000], "tool": tool,
        })

    def add_na_cascade(self, reason="cascade: BUILD-003 failed"):
        for cid in RUNTIME_CHECKS:
            if not any(x["check_id"] == cid for x in self.items):
                cat = cid.split("-")[0]
                self.add(cid, "na", cat, detail=reason)


def reset_db_files(app_dir, checks):
    """State reset between suite executions: remove file-backed databases so the app
    re-seeds. This is an environment operation (protocol sec 5); it is logged."""
    removed = []
    for pat in ("*.sqlite", "*.sqlite3", "*.db"):
        for p in Path(app_dir).rglob(pat):
            if "node_modules" in p.parts:
                continue
            try:
                p.unlink()
                removed.append(str(p.relative_to(app_dir)))
            except Exception:
                pass
    if removed:
        checks.raws.setdefault("env_interventions", []).append(
            f"state reset: removed {', '.join(removed)}")
    return removed


def start_server(app_dir, port):
    scripts = pkg_scripts(app_dir)
    cmd = "npm start" if scripts.get("start") else ("npm run dev" if scripts.get("dev") else None)
    if not cmd:
        return None, "no start/dev script"
    env = dict(os.environ, PORT=str(port), NODE_ENV="production")
    # start_new_session: so we can kill the whole process group (shell + node child)
    proc = subprocess.Popen(cmd, cwd=app_dir, shell=True, env=env,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                            start_new_session=True)
    deadline = time.time() + 60
    ok = False
    last_code = ""
    while time.time() < deadline:
        if proc.poll() is not None:
            return proc, "server process exited early"
        rc, out, _ = sh(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "3",
                         f"http://127.0.0.1:{port}/"], cwd=".", timeout=10)
        if rc == 0 and out.strip().isdigit():
            last_code = out.strip()
            ok = True
            break
        time.sleep(1.0)
    return proc, ("ok" if ok else f"server not reachable in 60s (last status {last_code or 'none'})")


def stop_server(proc):
    if not proc:
        return
    try:
        os.killpg(proc.pid, 15)
    except Exception:
        try:
            proc.terminate()
        except Exception:
            pass
    time.sleep(1.5)
    try:
        os.killpg(proc.pid, 9)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass


def main():
    t0 = dt.datetime.now(dt.timezone.utc)
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-id", required=True)
    ap.add_argument("--task", required=True)
    ap.add_argument("--builder", required=True)
    ap.add_argument("--rep", type=int, required=True)
    ap.add_argument("--iteration", type=int, required=True)
    ap.add_argument("--app-dir", required=True)
    args = ap.parse_args()

    run_dir = RAW_RUNS / args.run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    app_dir = str(Path(args.app_dir).resolve())
    checks = Checks(args.run_id, args.iteration)

    env_report()
    reset_db_files(app_dir, checks)

    # ---------- BUILD-001 install ----------
    lockfile = (Path(app_dir) / "package-lock.json").exists()
    install_cmd = ["npm", "ci"] if lockfile else ["npm", "install"]
    rc, out, err = sh(install_cmd, app_dir, 900)
    checks.add("BUILD-001", "pass" if rc == 0 else "fail", "BUILD",
               observed=f"exit {rc}", expected="exit 0",
               detail=(err or out)[-500:], tool="npm", raw_key="install")

    # ---------- BUILD-002 build ----------
    scripts = pkg_scripts(app_dir)
    if scripts.get("build"):
        rc, out, err = sh(["npm", "run", "build"], app_dir, 600)
        checks.add("BUILD-002", "pass" if rc == 0 else "fail", "BUILD",
                   observed=f"exit {rc}", expected="exit 0",
                   detail=(err or out)[-500:], tool="npm run build", raw_key="build")
    else:
        checks.add("BUILD-002", "na", "BUILD", detail="no build script declared")

    # ---------- TYPE-001 ----------
    if (Path(app_dir) / "tsconfig.json").exists():
        rc, out, err = sh(["npx", "tsc", "--noEmit"], app_dir, 300)
        nerr = len(re.findall(r"error TS\d+", out + err))
        checks.raws["tsc"] = (out + err)[-4000:]
        checks.add("TYPE-001", "pass" if rc == 0 else "fail", "TYPE",
                   observed=f"{nerr} type errors", expected="0 type errors",
                   detail=(out + err)[-600:] if rc else "", tool="tsc --noEmit", raw_key="tsc")
    else:
        checks.add("TYPE-001", "na", "TYPE", detail="not a TypeScript project")

    # ---------- LINT ----------
    rc, out, err = sh(["npx", "eslint", ".", "--config",
                       str(ORACLES / "build" / "eslint.config.mjs"), "--format", "json"],
                      app_dir, 300, env=dict(os.environ, NODE_ENV="production"))
    checks.raws["eslint"] = (out or err)[-8000:]
    if rc in (0, 1):  # eslint exits 1 when problems found
        try:
            report = json.loads(out or "[]")
            errors = sum(r.get("errorCount", 0) for r in report)
            warnings = sum(r.get("warningCount", 0) for r in report)
        except Exception:
            errors, warnings = -1, -1
        checks.add("LINT-001", "pass" if errors == 0 else "fail", "LINT",
                   observed=f"{errors} errors", expected="0 errors",
                   tool="eslint", raw_key="eslint")
        checks.add("LINT-002", "pass" if warnings == 0 else "fail", "LINT",
                   observed=f"{warnings} warnings", expected="0 warnings", tool="eslint")
    else:
        checks.add("LINT-001", "env-error", "LINT", detail=f"eslint exit {rc}: {(out+err)[-300:]}", tool="eslint")
        checks.add("LINT-002", "env-error", "LINT", tool="eslint")

    # ---------- SEC static ----------
    semgrep_available = shutil.which("semgrep") is not None
    if semgrep_available:
        rc, out, err = sh(["semgrep", "--config", str(ORACLES / "security"),
                           "--json", "--metrics=off", app_dir], app_dir, 600)
        checks.raws["semgrep"] = (out or err)[-20000:]
        try:
            sem_out = json.loads(out)
            findings = sem_out.get("results", [])
            sem_errors = sem_out.get("errors", [])
        except Exception:
            findings, sem_errors = [], ["output parse failed"]
        if sem_errors and not findings:
            outcome = "env-error"
        elif findings:
            outcome = "fail"
        else:
            outcome = "pass"
        checks.add("SEC-001", outcome, "SEC",
                   observed=f"{len(findings)} findings", expected="0 findings",
                   detail="; ".join(f"{f.get('check_id')}@{f.get('path')}:{f.get('start',{}).get('line')}" for f in findings[:10]) or (str(sem_errors)[:300] if sem_errors else ""),
                   tool="semgrep", raw_key="semgrep")
    else:
        checks.add("SEC-001", "env-error", "SEC", detail="semgrep not available", tool="semgrep")

    # SEC-002 secrets
    hits = []
    seed_pws = SEED_PASSWORDS.get(args.task, [])
    skip_dirs = {"node_modules", ".git", "dist", "build", ".next", "coverage"}
    for root, dirs, files in os.walk(app_dir):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for fn in files:
            if fn.endswith(".lock") or "lock" in fn:
                continue
            fp = Path(root) / fn
            try:
                if fp.stat().st_size > 400_000:
                    continue
                text = fp.read_text(errors="ignore")
            except Exception:
                continue
            for name, pat in SECRET_PATTERNS:
                for m in pat.finditer(text):
                    lit = m.group(0)
                    # mandated seed credentials are part of the frozen spec, not a finding
                    if name == "generic-secret-literal" and any(pw in lit for pw in seed_pws):
                        continue
                    hits.append(f"{name}@{fp.relative_to(app_dir)}:{text[:m.start()].count(chr(10)) + 1}")
                    break
    checks.add("SEC-002", "pass" if not hits else "fail", "SEC",
               observed=f"{len(hits)} secret-pattern hits", expected="0",
               detail="; ".join(hits[:10]), tool="secret-scan", raw_key="secrets")

    # SEC-003 audit (network-dependent; results are dated per run)
    rc, out, err = sh(["npm", "audit", "--omit=dev", "--json"], app_dir, 300)
    checks.raws["audit"] = (out or err)[-8000:]
    try:
        audit = json.loads(out)
        vulns = audit.get("metadata", {}).get("vulnerabilities", {})
        hi = vulns.get("high", 0) + vulns.get("critical", 0)
        detail = json.dumps(vulns)
        outcome = "pass" if hi == 0 else "fail"
    except Exception:
        hi = 0
        detail = f"audit unavailable or unparseable: {(out or err)[:200]}"
        outcome = "env-error"  # silent pass on audit failure would corrupt SEC outcomes
    checks.add("SEC-003", outcome, "SEC",
               observed=f"{hi} high/critical" if outcome != "env-error" else "audit unavailable",
               expected="0 high/critical",
               detail=detail[:400], tool="npm audit", raw_key="audit")

    # ---------- runtime: server + Playwright, then engine ----------
    proc, status = start_server(app_dir, PORT)
    server_ok = status == "ok"
    checks.add("BUILD-003", "pass" if server_ok else "fail", "BUILD",
               observed=status, expected="reachable on $PORT", tool="http", raw_key="start")
    if server_ok:
        rc, out, _ = sh(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "5",
                         f"http://127.0.0.1:{PORT}/"], cwd=".", timeout=10)
        root_code = out.strip() if out.strip().isdigit() else "none"
        checks.add("BUILD-004", "pass" if root_code in ("200", "302", "303", "307", "308") else "fail",
                   "BUILD", observed=f"GET / -> {root_code}", expected="200 (or redirect to app UI)", tool="http")

        # SEC-004 debug endpoints (SPA-aware: a 200 whose body equals the root
        # catch-all HTML is not a debug endpoint)
        rc0, root_body, _ = sh(["curl", "-s", "--max-time", "4", f"http://127.0.0.1:{PORT}/"],
                               cwd=".", timeout=8)
        open_paths = []
        for p in DEBUG_PATHS:
            rc, out, _ = sh(["curl", "-s", "-w", "\\n%{http_code}", "--max-time", "4",
                             f"http://127.0.0.1:{PORT}{p}"], cwd=".", timeout=8)
            if rc != 0:
                continue
            lines = out.rsplit("\n", 1)
            body_text, code = (lines[0], lines[1].strip()) if len(lines) == 2 else (out, "")
            if code == "200" and body_text.strip() != root_body.strip():
                open_paths.append(p)
        checks.add("SEC-004", "pass" if not open_paths else "fail", "SEC",
                   observed=", ".join(open_paths) or "none open", expected="none", tool="http-probe", raw_key="debugprobe")

        # Playwright phase (FUNC + A11Y + AUTHZ-004)
        pw_out = run_dir / "pw-report.json"
        envp = dict(os.environ, VGB_PORT=str(PORT), VGB_PW_OUT=str(pw_out))
        sh(["npx", "playwright", "test", "--config",
            str(ORACLES / "runtime" / "playwright.config.js"),
            "--pass-with-no-tests",
            f"functional/app{args.task.split('-')[1]}.spec.js"],
           ORACLES / "runtime", 1500, env=envp)
        parse_playwright(checks, pw_out, args.task)
    else:
        checks.add("BUILD-004", "na", "BUILD", detail="cascade: app not reachable")
        checks.add("SEC-004", "na", "SEC", detail="cascade")
        checks.add_na_cascade()
    stop_server(proc)

    if server_ok:
        sh(["node", "engine.mjs", "--contract", f"contracts/{args.task}.json",
            "--app-dir", app_dir, "--port", str(PORT),
            "--out", str(run_dir / "engine-report.json")],
           ORACLES / "runtime", 1500)
        parse_engine(checks, run_dir / "engine-report.json")
        sec006_localstorage(checks, app_dir, args.task, run_dir)
    else:
        for cid in ["BUILD-005", "SEC-006"]:
            checks.add(cid, "na", cid.split("-")[0], detail="cascade: app not startable")

    finalize(checks, args, run_dir, app_dir, t0)


def parse_playwright(checks, pw_out, task):
    if not Path(pw_out).exists():
        for cid in RUNTIME_CHECKS:
            if cid.startswith(("FUNC", "A11Y")) or cid == "AUTHZ-004":
                checks.add(cid, "env-error", cid.split("-")[0], detail="playwright report missing")
        return
    rep = json.loads(Path(pw_out).read_text())
    by_title = {}
    for suite in rep.get("suites", []):
        walk_suites(suite, by_title)
    for cid in RUNTIME_CHECKS:
        cat = cid.split("-")[0]
        if cid.startswith("FUNC") and cid not in FUNC_APPLICABLE[task]:
            checks.add(cid, "na", cat, detail="not applicable to this task contract")
            continue
        if cid in by_title:
            outcome = by_title[cid]
            msg = by_title.get(cid + ":msg", "")
            checks.add(cid, outcome, cat,
                       observed=msg if outcome == "fail" else "",
                       tool="playwright", raw_key="pw-report.json")
        elif cid.startswith(("FUNC", "A11Y")) or cid == "AUTHZ-004":
            checks.add(cid, "env-error", cat, detail="check missing from playwright report")
        # AUTHZ/DB non-UI checks are set by the engine later


def walk_suites(suite, by_title):
    for spec in suite.get("specs", []) or []:
        title = (spec.get("title") or "").split(" ")[0]
        if not re.match(r"^(FUNC|A11Y|AUTHZ|SEC|DB|BUILD)-\d{3}$", title):
            continue
        for t in spec.get("tests", []):
            status = t.get("status")  # expected/unexpected/flaky/skipped
            res = "pass" if status == "expected" else ("na" if status == "skipped" else "fail")
            by_title[title] = res
            if res == "fail":
                msg = ""
                for r in t.get("results", []) or []:
                    err = (r.get("error") or {}).get("message") or ""
                    msg = err.split("\n")[0][:200] if err else msg
                by_title[title + ":msg"] = msg
    for child in suite.get("suites", []) or []:
        walk_suites(child, by_title)


def parse_engine(checks, engine_path):
    if not Path(engine_path).exists():
        for cid in ["AUTHZ-001", "AUTHZ-002", "AUTHZ-003", "AUTHZ-005", "AUTHZ-006",
                    "SEC-005", "DB-001", "DB-002", "DB-003", "DB-004", "BUILD-005"]:
            if not any(x["check_id"] == cid for x in checks.items):
                checks.add(cid, "env-error", cid.split("-")[0], detail="engine report missing")
        return
    rep = json.loads(Path(engine_path).read_text())
    for cid, r in rep.get("results", {}).items():
        if any(x["check_id"] == cid for x in checks.items):
            continue
        checks.add(cid, r.get("outcome", "env-error"), cid.split("-")[0],
                   observed=r.get("observed", ""), expected=r.get("expected", ""),
                   detail=r.get("detail", ""), tool="engine.mjs")


def sec006_localstorage(checks, app_dir, task, run_dir):
    """SEC-005 token-variant + SEC-006 credential storage checks (code + DB inspection).
    SEC-005: replaces the engine's provisional na with a code-grep verdict."""
    engine_rep = {}
    p = run_dir / "engine-report.json"
    if Path(p).exists():
        engine_rep = json.loads(Path(p).read_text()).get("results", {})
    sec5 = engine_rep.get("SEC-005", {})
    if sec5.get("outcome") == "na" and "token-based" in str(sec5.get("observed", "")):
        bad = []
        skip_dirs = {"node_modules", ".git", "dist", "build", ".next"}
        for root, dirs, files in os.walk(app_dir):
            dirs[:] = [d for d in dirs if d not in skip_dirs]
            for fn in files:
                if not fn.endswith((".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte")):
                    continue
                fp = Path(root) / fn
                try:
                    text = fp.read_text(errors="ignore")
                except Exception:
                    continue
                if re.search(r"localStorage\.setItem\(\s*[\"'][^\"']*(token|session|auth|jwt)", text, re.I):
                    bad.append(str(fp.relative_to(app_dir)))
        new_item = {
            "check_id": "SEC-005", "category": "SEC",
            "outcome": "fail" if bad else "pass",
            "observed": "localStorage token storage: " + (", ".join(bad[:5]) if bad else "none"),
            "expected": "no token in localStorage", "tool": "code-grep",
            "run_id": checks.run_id, "iteration": checks.iteration,
        }
        checks.items = [new_item if x["check_id"] == "SEC-005" else x for x in checks.items]

    pwds = SEED_PASSWORDS.get(task, [])
    plaintext_hit = None
    hashing = False
    skip_dirs = {"node_modules", ".git", "dist", "build", ".next"}
    for root, dirs, files in os.walk(app_dir):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for fn in files:
            fp = Path(root) / fn
            if fn.endswith((".sqlite", ".sqlite3", ".db")):
                try:
                    data = fp.read_bytes()
                except Exception:
                    continue
                for pwd in pwds:
                    if pwd.encode() in data:
                        plaintext_hit = str(fp.relative_to(app_dir))
            elif fn.endswith((".js", ".ts", ".jsx", ".tsx", ".json")):
                try:
                    text = fp.read_text(errors="ignore")
                except Exception:
                    continue
                if re.search(r"(bcrypt|argon2|scrypt|pbkdf2)", text, re.I):
                    hashing = True
    if plaintext_hit:
        checks.add("SEC-006", "fail", "SEC", observed=f"plaintext seed password in {plaintext_hit}",
                   expected="no plaintext credentials at rest", tool="db-scan")
    elif hashing:
        checks.add("SEC-006", "pass", "SEC", observed="password hashing library detected, no plaintext found",
                   expected="hashing present", tool="code+db-scan")
    else:
        checks.add("SEC-006", "na", "SEC", detail="cannot determine: no db file and no hashing library detected")


def env_report():
    out = {}
    for name, cmd in [("node", ["node", "--version"]), ("npm", ["npm", "--version"]),
                      ("python", [sys.executable, "--version"]),
                      ("semgrep", ["semgrep", "--version"])]:
        rc, o, e = sh(cmd, ".", 20)
        out[name] = (o or e).strip().splitlines()[-1] if (o or e) else "unknown"
    rc, o, e = sh(["npx", "playwright", "--version"], ORACLES / "runtime", 30)
    out["playwright"] = (o or e).strip()
    (REPO / "data" / "raw").mkdir(parents=True, exist_ok=True)
    (REPO / "data" / "raw" / "env-report.json").write_text(json.dumps(out, indent=2))


def finalize(checks, args, run_dir, app_dir, t0):
    t1 = dt.datetime.now(dt.timezone.utc)
    seen = set()
    final = []
    for c in checks.items:
        if c["check_id"] in seen:
            continue
        seen.add(c["check_id"])
        final.append(c)

    (run_dir / "checks.jsonl").write_text("\n".join(json.dumps(c, ensure_ascii=False) for c in final))
    # persist raw tool outputs (protocol sec 7: every check traceable to raw evidence)
    raw_dir = run_dir / "raw"
    raw_dir.mkdir(exist_ok=True)
    for key, content in checks.raws.items():
        if not isinstance(content, str):
            content = json.dumps(content, indent=2)
        (raw_dir / f"{key}.txt").write_text(content or "")
    counts = {}
    for c in final:
        counts[c["outcome"]] = counts.get(c["outcome"], 0) + 1

    dep_manifest = None
    pj = Path(app_dir) / "package.json"
    if pj.exists():
        try:
            p = json.loads(pj.read_text())
            dep_manifest = {"dependencies": p.get("dependencies", {}),
                            "devDependencies": p.get("devDependencies", {})}
        except Exception:
            pass
    dep_diff = None
    base_dir = run_dir.parent / re.sub(r"-i\d{3}$", "-i000", args.run_id) / "dep-manifest.json"
    if dep_manifest and base_dir.exists() and args.iteration != 0:
        base = json.loads(base_dir.read_text())
        dep_diff = [f"{k}: {base.get(k)} -> {v}" for k, v in dep_manifest["dependencies"].items()
                    if base.get("dependencies", {}).get(k) != v]
    if dep_manifest:
        (run_dir / "dep-manifest.json").write_text(json.dumps(dep_manifest, indent=2))

    record = {
        "run_id": args.run_id, "task": args.task, "builder": args.builder,
        "repetition": args.rep, "iteration": args.iteration,
        "started_utc": t0.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "finished_utc": t1.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "builder_platform": {"platform": args.builder, "tier": os.environ.get("VGB_TIER", "unknown"),
                             "model_disclosed": None, "platform_version": None,
                             "generation_mode": None, "settings": None},
        "env": json.loads((REPO / "data" / "raw" / "env-report.json").read_text()),
        "dep_manifest_diff": dep_diff,
        "app_dir": str(Path(app_dir)),
        "checks": final,
        "env_interventions": checks.raws.get("env_interventions", []),
        "excluded": False, "exclusion_reason": None, "retries": [], "operator_notes": "",
    }
    (run_dir / "run-record.json").write_text(json.dumps(record, indent=2, ensure_ascii=False))
    try:
        import jsonschema
        schema = json.loads((REPO / "benchmark" / "schemas" / "run-record.schema.json").read_text())
        resolver_root = REPO / "benchmark" / "schemas"
        # inline $ref resolution for check-result schema
        schema["properties"]["checks"]["items"] = json.loads(
            (resolver_root / "check-result.schema.json").read_text())
        jsonschema.validate(record, schema)
    except Exception as e:
        print(json.dumps({"schema_validation": "FAILED or unavailable", "detail": str(e)[:300]}))
    print(json.dumps({"run_id": args.run_id, "counts": counts, "n_checks": len(final)}, indent=2))


def pick_port():
    import socket
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


if __name__ == "__main__":
    PORT = pick_port()  # dynamic port avoids stale-process squatters
    main()
