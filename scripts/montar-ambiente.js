// Monta o ambiente (Python + Node) do Hermes na pasta de dados <home> e a deixa PRONTA. Usado no CI do instalador completo, com <home> = C:\SegundoCerebro\d (o
// mesmo caminho do cliente: o ambiente grava caminhos absolutos, então só funciona onde foi montado).
// Uso: node scripts/montar-ambiente.js <hermes-acp> <home> [minutos]
// Passo igual ao do app (agent.js montarAmbiente): ACP `initialize` + `session/new` num HERMES_HOME novo; o Hermes monta o ambiente ao subir.
const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const [bin, home, minutos] = process.argv.slice(2)
if (!bin || !home) {
  console.error('uso: node scripts/montar-ambiente.js <hermes-acp> <home> [minutos]')
  process.exit(2)
}
const limiteMs = (+minutos || 30) * 60000
fs.mkdirSync(home, { recursive: true })
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-aquece-cwd-'))
// o Hermes só sobe com uma configuração de modelo (o app grava a dele em prepararHome); aqui basta uma de mentira: o 1º turno nunca é feito
const BARRA = String.fromCharCode(92)
const linhasConfig = ['_config_version: 52', 'model:', '  default: "principal"', '  provider: "custom"', '  base_url: "http://127.0.0.1:9/v1"', '  api_key: ${SB_LOCAL_KEY}', '  context_length: 131072', 'terminal:', '  backend: "local"', '  cwd: ' + JSON.stringify(cwd.split(BARRA).join('/')), '']
fs.writeFileSync(path.join(home, 'config.yaml'), linhasConfig.join(String.fromCharCode(10)))
const env = { ...process.env, HERMES_HOME: home, PYTHONUTF8: '1', SB_LOCAL_KEY: 'x' }
delete env.UV_OFFLINE // este passo PRECISA da internet

const t0 = Date.now()
const f = spawn(bin, [], { env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
let buf = ''
let proximoId = 1
const pend = new Map()
f.stderr.on('data', (d) => process.stderr.write(String(d).slice(-300)))
f.stdout.on('data', (d) => {
  buf += d
  let i
  while ((i = buf.indexOf('\n')) >= 0) {
    const l = buf.slice(0, i).trim()
    buf = buf.slice(i + 1)
    if (!l) continue
    try {
      const m = JSON.parse(l)
      if (m.id != null && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
    } catch {}
  }
})
const chamar = (metodo, params) => new Promise((res) => { const id = proximoId++; pend.set(id, res); f.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method: metodo, params }) + '\n') })
const fim = (codigo, msg) => {
  console.log(msg)
  try { f.kill() } catch {}
  try { require('child_process').execFileSync('taskkill', ['/PID', String(f.pid), '/T', '/F'], { stdio: 'ignore' }) } catch {}
  setTimeout(() => process.exit(codigo), 500)
}
const relogio = setTimeout(() => fim(1, `estourou ${minutos || 30} min sem terminar`), limiteMs)
f.on('exit', (c) => { if (pend.size) fim(1, 'o Hermes encerrou antes de terminar (codigo ' + c + ')') })
;(async () => {
  const a = await chamar('initialize', { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } } })
  if (a.error) return fim(1, 'initialize falhou: ' + JSON.stringify(a.error).slice(0, 200))
  const b = await chamar('session/new', { cwd, mcpServers: [] })
  clearTimeout(relogio)
  if (b.error) return fim(1, 'session/new falhou: ' + JSON.stringify(b.error).slice(0, 200))
  fim(0, `ambiente montado em ${Math.round((Date.now() - t0) / 1000)} s em ${home}`)
})()
