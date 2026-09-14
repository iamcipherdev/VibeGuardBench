#!/usr/bin/env node
/**
 * PILOT: generate an APP-01 booking app with an LLM (harness validation ONLY).
 * This is NOT one of the study's commercial builders and NOT research data
 * (see pilot/PILOT_README.md).
 *
 * Uses the frozen APP-01 specification prompt + a pilot platform note that pins
 * the stack to a locally-runnable single-package Node.js app.
 */
import ZAI from "z-ai-web-dev-sdk";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = process.argv[2] || "./app-r1-i000";
const FEEDBACK_FILE = process.argv[3] || null; // when set: repair mode
const APP_DIR_SRC = process.argv[4] || null;   // current app dir for repair mode

const frozenPrompt = fs.readFileSync("../benchmark/prompts/initial-APP-01.md", "utf8");
// Everything after the first standalone --- line is the prompt body
const body = frozenPrompt.split(/^---$/m).slice(1).join("---").trim();

const platformNote = `
PLATFORM CONSTRAINTS (pilot harness validation only): the target runtime is a plain
Node.js single-package project. Produce:
- package.json with a "start" script that runs the server honoring the PORT env var
- Node.js built-ins or express; SQLite via better-sqlite3 (file db) or node:sqlite
- a public/ directory of static files for the UI served by the same server
- every required page must be served by this one process on PORT (API + UI same origin)
- create the two seeded accounts on first start, with hashed passwords
- KEEP THE IMPLEMENTATION COMPACT: aim for server.js + public/index.html + package.json
  (+ at most two more small files). No build step. No TypeScript. Total under 700 lines.

OUTPUT PROTOCOL: respond with file blocks and NOTHING else:
===FILE: package.json===
<raw complete file text>
===END===
===FILE: server.js===
<raw complete file text>
===END===
No markdown fences, no commentary. Raw file text inside blocks.
`;

function extractFiles(text) {
  const files = [];
  const re = /===FILE:\s*(.+?)\s*===\n([\s\S]*?)\n===END===/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    files.push({ path: m[1].trim(), content: m[2] });
  }
  return { files };
}

async function main() {
  const zai = await ZAI.create();
  let messages;
  if (FEEDBACK_FILE && APP_DIR_SRC) {
    const feedback = fs.readFileSync(FEEDBACK_FILE, "utf8");
    // include current sources (skip node_modules and lockfiles)
    const files = [];
    for (const p of walk(APP_DIR_SRC)) {
      if (/(node_modules|\.git)/.test(p) || p.endsWith(".db") || p.includes("package-lock")) continue;
      if (fs.statSync(p).size > 120_000) continue;
      files.push({ path: path.relative(APP_DIR_SRC, p), content: fs.readFileSync(p, "utf8") });
    }
    messages = [
      { role: "system", content: "You are an expert full-stack engineer repairing an existing application. Output ONLY the JSON files payload." },
      { role: "user", content: `Here is the current full source of the application (file blocks):
${files.map((f) => `===FILE: ${f.path}===\n${f.content}\n===END===`).join("\n")}

Automated quality checks reported the following failures. Rewrite/repair the application so ALL listed checks pass, without changing unrelated behavior or removing working functionality. Keep the same routes, data-testid attributes, and API shapes.

${feedback}

${platformNote}` },
    ];
  } else {
    messages = [
      { role: "system", content: "You are an expert full-stack engineer. Output ONLY the JSON files payload." },
      { role: "user", content: `${body}\n${platformNote}` },
    ];
  }

  const completion = await zai.chat.completions.create({
    messages,
    thinking: { type: "disabled" },
    max_tokens: 16384,
  });
  const text = completion.choices[0]?.message?.content || "";
  fs.writeFileSync("last-response-debug.txt", JSON.stringify({
    finish_reason: completion.choices[0]?.finish_reason,
    usage: completion.usage,
    content_len: text.length,
    head: text.slice(0, 600),
    tail: text.slice(-300),
  }, null, 2));
  const parsed = extractFiles(text);
  if (!parsed.files || !Array.isArray(parsed.files)) throw new Error("response missing files array");

  const outDir = path.resolve(OUT_DIR);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = [];
  for (const f of parsed.files) {
    const rel = String(f.path).replace(/^\.?\//, "");
    if (rel.includes("..")) continue;
    const dest = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, String(f.content));
    manifest.push(rel);
  }
  fs.writeFileSync(path.join(outDir, ".vgb-manifest.json"), JSON.stringify({ manifest, mode: FEEDBACK_FILE ? "repair" : "generate", at: new Date().toISOString() }, null, 2));
  console.log(JSON.stringify({ outDir, n_files: manifest.length, files: manifest }, null, 2));
}

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

main().catch((e) => { console.error("PILOT-GEN-ERROR", e); process.exit(1); });
