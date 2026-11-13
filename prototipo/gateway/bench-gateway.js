// Bench da ponte única (spec 34, fase 0): mede partida da ponte, session.create, 1º texto do modelo e 5 sessões em paralelo.
// Uso: node prototipo/gateway/bench-gateway.js [paralelas=5]
// Usa o Hermes instalado pelo app (HERMES_HOME do Segundo Cérebro) e o modelo que o gateway já tem configurado.
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

const DADOS = process.env.SB_DADOS || path.join(process.env.APPDATA || path.join(os.homedir(), '.config'), 'SegundoCerebro')
const HOME = path.join(DADOS, 'hermes-home')
const ws = fs.readdirSync(path.join(HOME, 'installs')).flatMap((i) => {
  const env = path.join(HOME, 'installs', i, 'environments')
  return fs.existsSync(env) ? fs.readdirSync(env).map((e) => path.join(env, e, 'workspace')) : []
}).find((p) => fs.existsSync(path.join(p, 'hermes_cli', 'gateway_client.py')))
const py = path.join(ws, '..', 'venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python') // o venv do mesmo ambiente do workspace
const N = Number(process.argv[2] || 5)

function ponte() {
  const t0 = Date.now()
  const p = spawn(py, [path.join(__dirname, 'ponte_gateway.py')], { cwd: ws, env: { ...process.env, HERMES_HOME: HOME, PYTHONPATH: ws, PYTHONIOENCODING: 'utf-8' }, windowsHide: true })
  let buf = ''
  let seq = 0
  const pend = new Map()
  const ouvintes = new Set()
  let pronta
  const ok = new Promise((r) => (pronta = r))
  p.stdout.on('data', (d) => {
    buf += d
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const linha = buf.slice(0, i); buf = buf.slice(i + 1)
      let m
      try { m = JSON.parse(linha) } catch { continue }
      if (m.pronta) pronta({ ms: m.ms, total: Date.now() - t0 })
      else if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
      else if (m.evento) for (const f of ouvintes) f(m.evento)
      else if (m.caiu) console.log('caiu:', m.caiu)
    }
  })
  p.stderr.on('data', (d) => process.env.DEBUG && process.stderr.write(d))
  const rpc = (method, params = {}, timeout) => new Promise((res) => { const id = ++seq; pend.set(id, res); p.stdin.write(JSON.stringify({ id, method, params, timeout }) + '\n') })
  return { ok, rpc, ouvir: (f) => ouvintes.add(f), fechar: () => p.kill() }
}

;(async () => {
  console.log('python:', py, '\nworkspace:', ws)
  const b = ponte()
  const pr = await b.ok
  console.log(`ponte pronta: ${pr.total} ms (conectar no gateway ${pr.ms} ms)`)
  const desc = await b.rpc('runtime.describe')
  console.log('runtime.describe:', desc.error ? desc.error.message : `ok, capacidades ${(desc.result.capabilities || []).length}, fontes ${JSON.stringify(desc.result.session_create?.sources)}`)
  const umaSessao = async (n) => {
    const t0 = Date.now()
    const c = await b.rpc('session.create', { request_id: 'bench-' + n + '-' + Date.now(), source: 'acp', cwd: os.tmpdir(), editor: { mcp_servers: [], edit_approval_policy: 'ask' } })
    const tCriar = Date.now() - t0
    if (c.error) return { n, erro: c.error.message }
    const sid = c.result.session_id
    let primeiro = 0
    let fim = 0
    let texto = ''
    const terminou = new Promise((ok) => b.ouvir((e) => {
      if (e.session_id !== sid) return
      if (e.type === 'message.delta') { texto += (e.payload?.text || e.payload?.delta || ''); if (!primeiro) primeiro = Date.now() }
      if (e.type === 'message.complete' || e.type === 'turn.settled' || e.type === 'turn.failed') { fim = Date.now(); ok(e.type) }
    }))
    const t1 = Date.now()
    const s = await b.rpc('prompt.submit', { session_id: sid, input_id: 'in-' + n + '-' + Date.now(), text: 'Responda apenas com a palavra ok' + n })
    if (s.error) return { n, criarMs: tCriar, erro: s.error.message }
    const como = await Promise.race([terminou, new Promise((r) => setTimeout(() => r('timeout'), 180000))])
    return { n, criarMs: tCriar, primeiroTextoMs: primeiro ? primeiro - t1 : null, turnoMs: fim ? fim - t1 : null, como, texto: texto.trim().slice(0, 40), sid }
  }
  console.log('1 sessão:', JSON.stringify(await umaSessao(0)))
  console.log('1 sessão (2ª, quente):', JSON.stringify(await umaSessao(1)))
  const t0 = Date.now()
  const r = await Promise.all(Array.from({ length: N }, (_, i) => umaSessao(10 + i)))
  console.log(`${N} em paralelo (${Date.now() - t0} ms no total):`)
  for (const x of r) console.log('  ', JSON.stringify(x))
  b.fechar()
  process.exit(0)
})().catch((e) => { console.error('ERRO', e); process.exit(1) })
