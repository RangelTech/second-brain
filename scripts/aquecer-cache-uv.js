// Monta o ambiente Python do Hermes numa pasta de dados descartável e deixa os PACOTES baixados no cache do uv (UV_CACHE_DIR).
// Usado no CI do instalador completo: o cache vai compactado dentro do instalador, e no PC do cliente o ambiente é montado a partir dele, sem internet.
// (Copiar o ambiente pronto não funciona: ele grava o caminho absoluto da pasta do usuário. Copiar os pacotes funciona.)
// Uso: node scripts/aquecer-cache-uv.js <hermes-acp> <pasta-do-cache-uv> [minutos]
// Passo igual ao do app (agent.js montarAmbiente): ACP `initialize` + `session/new` num HERMES_HOME novo; o Hermes monta o ambiente ao subir.
const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const [bin, cache, minutos] = process.argv.slice(2)
if (!bin || !cache) {
  console.error('uso: node scripts/aquecer-cache-uv.js <hermes-acp> <pasta-do-cache-uv> [minutos]')
  process.exit(2)
}
const limiteMs = (+minutos || 30) * 60000
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-aquece-'))
fs.mkdirSync(cache, { recursive: true })
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-aquece-cwd-'))
const env = { ...process.env, HERMES_HOME: home, UV_CACHE_DIR: cache, PYTHONUTF8: '1' }
delete env.UV_OFFLINE // este passo PRECISA da internet: é ele que enche o cache

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
  let tam = 0
  const soma = (d) => { try { for (const e of fs.readdirSync(d, { withFileTypes: true })) tam += e.isDirectory() ? soma(path.join(d, e.name)) || 0 : fs.statSync(path.join(d, e.name)).size } catch {} }
  soma(cache)
  fim(0, `ambiente montado em ${Math.round((Date.now() - t0) / 1000)} s; cache do uv com ${Math.round(tam / 1048576)} MB em ${cache}`)
})()
