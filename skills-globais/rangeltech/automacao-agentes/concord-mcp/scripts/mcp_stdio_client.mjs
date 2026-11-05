// mcp_stdio_client.mjs — cliente MCP stdio mínimo (JSON-RPC linha a linha).
// Uso:
//   import { McpClient } from "./mcp_stdio_client.mjs";
//   const c = new McpClient("node", ["/rodo/do/pacote/dist/index.js"], { ALGUMA_VAR: "x" });
//   const child = c.start();
//   const init = await c.request("initialize", {...});
//   c.notify("notifications/initialized");
//   const r = await c.request("tools/call", { name: "start_work", arguments: {...} });
//
// Windows: `spawn` de um shim `.cmd` exige `shell: true`; para evitar a
// armadilha, chame direto `node <rodo>/dist/index.js` (este cliente aceita
// ambos — `shell` é ativado só quando o cmd termina em .cmd/.bat).

import { spawn } from "node:child_process";

export class McpClient {
  /**
   * @param {string} cmd   binário a spawnar ("node", caminho de .exe, etc.).
   * @param {string[]} args  argumentos.
   * @param {Record<string,string>} [env] variáveis extras (acima do ambiente herdado).
   */
  constructor(cmd, args = [], env = {}) {
    this.cmd = cmd;
    this.args = args;
    this.env = env;
    this.child = null;
    this._buf = "";
    this._pending = new Map(); // id -> { resolve, reject }
    this._seq = 0;
  }

  /** Sobe o processo; devolve o ChildProcess (para `end`/`kill` quando terminar). */
  start() {
    const isCmdShim = /\.(cmd|bat)$/i.test(this.cmd);
    this.child = spawn(this.cmd, this.args, {
      env: { ...process.env, ...this.env },
      stdio: ["pipe", "pipe", "inherit"],
      // .cmd/.bat precisam de shell no Windows; não forçar em outros casos.
      shell: process.platform === "win32" && isCmdShim,
    });
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => this._onData(chunk));
    this.child.on("error", (e) => {
      for (const p of this._pending.values()) p.reject(e);
    });
    this.child.on("close", () => {
      this._buf = "";
      for (const p of this._pending.values()) p.reject(new Error("stdio fechado antes da resposta"));
    });
    return this.child;
  }

  _onData(chunk) {
    this._buf += chunk;
    let nl;
    while ((nl = this._buf.indexOf("\n")) !== -1) {
      const line = this._buf.slice(0, nl);
      this._buf = this._buf.slice(nl + 1);
      const m = line.trim().match(/^\{.*\}$/s);
      if (!m) continue;
      let msg;
      try { msg = JSON.parse(m[0]); } catch { continue; }
      if (msg.id !== undefined && this._pending.has(msg.id)) {
        const { resolve, reject } = this._pending.get(msg.id);
        this._pending.delete(msg.id);
        if (msg.error) reject(new Error(`JSON-RPC ${msg.error.code}: ${msg.error.message}`));
        else resolve(msg.result);
      }
      // notificações/server→client (ping etc.) podem responder se id existir:
      if (msg.method === "ping" && msg.id !== undefined) {
        this._raw({ jsonrpc: "2.0", id: msg.id, result: {} });
      }
    }
  }

  _raw(obj) {
    this.child.stdin.write(JSON.stringify(obj) + "\n");
  }

  /** Pede e espera a resposta. */
  request(method, params = {}) {
    const id = ++this._seq;
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      this._raw({ jsonrpc: "2.0", id, method, params });
    });
  }

  /** Envia e não espera (ex.: notifications/initialized). */
  notify(method, params = {}) {
    this._raw({ jsonrpc: "2.0", method, params });
  }
}
