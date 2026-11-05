#!/usr/bin/env node
// run_scenario.mjs — driver de cenário para servidores MCP stdio.
//
// Uso:
//   node run_scenario.mjs <caminho-da-scen.json> [--verbose]
//
// Formato da cena:
// {
//   "cmd": "node",
//   "args": ["/rodo/do/pacote/dist/index.js"],
//   "env": { "VAR": "valor" },                // opcional
//   "repoRoot": "<caminho-absoluto>",               // opcional → vira CONCORD_REPO_ROOT
//   "steps": [
//     { "method": "tools/list", "params": {} },
//     { "method": "tools/call", "params": { "name": "start_work", "arguments": {...} } }
//   ]
// }
//
// Saída: para cada passo, imprime ARGS e resultado (texto de content[],
// structuredContent, ou RESULT bruto).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpClient } from "./mcp_stdio_client.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- parse argv -----------------------------------------------------------
const sceneArg = process.argv.slice(2).find(a => !a.startsWith("--"));
if (!sceneArg) {
  console.error("Uso: node run_scenario.mjs <caminho-da-scen.json>");
  process.exit(1);
}

let scene;
try {
  scene = JSON.parse(readFileSync(sceneArg, "utf8"));
} catch (e) {
  console.error("Falha lendo cenário:", e.message);
  process.exit(1);
}

const { cmd, args = [], steps = [] } = scene;
if (!steps.length) { console.error("Sem steps"); process.exit(1); }

// env + CONCORD_REPO_ROOT (convenient shorthand)
const env = { ...(scene.env || {}) };
if (scene.repoRoot) env.CONCORD_REPO_ROOT = path.resolve(scene.repoRoot);

// ---- run ----------------------------------------------------------------------
async function main() {
  const client = new McpClient(cmd, args, env);
  const child = client.start();

  console.log("# cmd:", [cmd, ...args].join(" "));
  if (Object.keys(env).length) console.log("# env:", JSON.stringify(env));

  // 1) initialize handshake
  const t0 = Date.now();
  const init = await client.request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "run-scenario", version: "1.0.0" }
  });
  console.log(`\n[${Date.now()-t0}ms] initialize → serverInfo=${JSON.stringify(init.serverInfo)} (protocolVersion ${init.protocolVersion})`);
  client.notify("notifications/initialized");
  // short grace period lets the server settle (adapter checks etc.)
  await sleep(1200);

  // 2) run each step
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const label = step.label || step.method.replace(/^tools\//, "");
    console.log(`\n── STEP ${i+1}/${steps.length}: ${label} ──`);
    console.log("ARGS:", JSON.stringify(step.params));
    try {
      const t1 = Date.now();
      const res = await client.request(step.method, step.params || {});
      const dt = Date.now() - t1;
      printStepResult(step, res, dt);
    } catch (e) {
      console.log(`ERR: ${e.message}`);
    }
  }

  // 3) graceful shutdown
  try { child.stdin.end(); } catch {}
  child.on("close", (code) => { console.log(`\n[server closed ${code ?? "?"}]`); process.exit(code ?? 0); });
  // safety: hard-kill if server hangs
  setTimeout(() => { console.log("\n[timeout 30s] forçando saída"); process.exit(1); }, 30000);
}

function printStepResult(step, res, dt) {
  console.log(`(${dt}ms)`);
  if (res.isError) console.log("⚠ tool devolveu isError");
  // MCP `tools/call` result shape: { content: [{type:"text", text}], structuredContent? }
  if (Array.isArray(res.content)) {
    for (const block of res.content) {
      if (block.type === "text") {
        // pretty-print: keep line breaks
        console.log(block.text);
      } else {
        console.log(JSON.stringify(block));
      }
    }
  }
  if (res.structuredContent) {
    console.log("STRUCTURED:");
    console.log(JSON.stringify(res.structuredContent, null, 2));
  }
  // fallback: dump raw if nothing rendered
  if ((!Array.isArray(res.content) || !res.content.length) && !res.structuredContent) && Object.keys(res).length) {
    console.log(JSON.stringify(res, null, 2));
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

main().catch(e => { console.error("Falha:", e); process.exit(1); });
