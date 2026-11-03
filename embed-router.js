// Motor de provedores (9Router, pasta router/): roda escondido, só em 127.0.0.1, com dados na pasta do app.
// O app não mostra o painel dele: as telas do Segundo Cérebro chamam as rotas /api/* por aqui (mesma ideia do LUAR).
const { app, safeStorage, session } = require('electron')
const path = require('path')
const fs = require('fs')
const net = require('net')
const crypto = require('crypto')
const { spawn } = require('child_process')

let filho = null
let estado = { porta: 0, origem: '', pronto: false, erro: '' }

function portaLivre() {
  return new Promise((resolve, reject) => {
    const s = net.createServer()
    s.once('error', reject)
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => resolve(port))
    })
  })
}

function pastaServidor() {
  const empacotado = path.join(process.resourcesPath || '', 'router')
  if (app.isPackaged && fs.existsSync(path.join(empacotado, 'custom-server.js'))) return empacotado
  return path.join(__dirname, 'router', '.next', 'standalone')
}

function senhaLocal() {
  const arq = path.join(app.getPath('userData'), 'router-senha.bin')
  try {
    const b = fs.readFileSync(arq)
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(b) : b.toString('utf8')
  } catch {}
  const nova = crypto.randomBytes(18).toString('base64url')
  fs.mkdirSync(path.dirname(arq), { recursive: true })
  fs.writeFileSync(arq, safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(nova) : Buffer.from(nova))
  return nova
}

async function esperar(origem, ms = 90000) {
  const fim = Date.now() + ms
  while (Date.now() < fim) {
    try {
      const r = await fetch(origem + '/api/health')
      if (r.status < 500) return true
    } catch {}
    await new Promise((r) => setTimeout(r, 400))
  }
  return false
}

async function iniciar() {
  const dir = pastaServidor()
  const servidor = path.join(dir, 'custom-server.js')
  if (!fs.existsSync(servidor)) {
    estado = { ...estado, erro: `Servidor do 9Router não encontrado em ${dir}. Rode "npm run router:build".` }
    return estado
  }
  const porta = await portaLivre()
  const senha = senhaLocal()
  const dados = path.join(app.getPath('userData'), 'router-data')
  fs.mkdirSync(dados, { recursive: true })
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: String(porta), HOSTNAME: '127.0.0.1', DATA_DIR: dados, INITIAL_PASSWORD: senha, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' }
  filho = spawn(process.execPath, [servidor, '--port', String(porta)], { cwd: dir, env, windowsHide: true })
  const log = fs.createWriteStream(path.join(app.getPath('userData'), 'router.log'), { flags: 'a' })
  filho.stdout.pipe(log)
  filho.stderr.pipe(log)
  filho.on('exit', (c) => {
    estado.pronto = false
    if (c) estado.erro = `9Router saiu com código ${c}`
  })
  estado = { porta, origem: `http://127.0.0.1:${porta}`, pronto: false, erro: '' }
  estado.pronto = await esperar(estado.origem)
  if (!estado.pronto) estado.erro = estado.erro || 'O 9Router não respondeu a tempo.'
  else await entrar(senha)
  return estado
}

// Faz o login local e deixa o cookie na sessão do Electron (a janela embutida já abre autenticada).
async function entrar(senha) {
  const r = await fetch(estado.origem + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: senha }) })
  const cookies = r.headers.getSetCookie?.() ?? []
  for (const c of cookies) {
    const [par] = c.split(';')
    const i = par.indexOf('=')
    await session.defaultSession.cookies.set({ url: estado.origem, name: par.slice(0, i), value: par.slice(i + 1), path: '/', httpOnly: true })
  }
  estado.cookie = cookies.map((c) => c.split(';')[0]).join('; ')
  return r.ok
}

// Chamada às rotas de gerenciamento, já autenticada. Refaz o login uma vez se a sessão expirar.
async function api(metodo, rota, corpo) {
  if (!estado.pronto) throw new Error(estado.erro || 'O motor de provedores ainda está iniciando.')
  const rodar = () =>
    fetch(estado.origem + rota, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', Cookie: estado.cookie || '' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
  let r = await rodar()
  if (r.status === 401) {
    await entrar(senhaLocal())
    r = await rodar()
  }
  let json = null
  try {
    json = await r.json()
  } catch {}
  return { status: r.status, json }
}

function parar() {
  try {
    filho?.kill()
  } catch {}
  filho = null
}

module.exports = { iniciar, parar, api, estado: () => ({ porta: estado.porta, origem: estado.origem, pronto: estado.pronto, erro: estado.erro }) }
