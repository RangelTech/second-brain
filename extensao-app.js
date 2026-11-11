// Lado do app da extensão do Chrome: (1) servidor local de pareamento para o host de mensageria nativa; (2) registro do host no sistema
// (Windows: registro do usuário; Mac e Linux: arquivos nas pastas dos navegadores). Nada de administrador: tudo no perfil do usuário.
const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const { execFile } = require('child_process')

const HOST = 'net.rangeltech.segundocerebro'
const ID_EXTENSAO = 'cdhhngjakiihefobehjmpdhlpedlkanp' // fixado pela chave pública do manifesto da extensão
const LINK_EXTENSAO = 'https://brain.rangeltech.net/extensao/'

// servidor só local: só o host nativo (que lê o token do arquivo na pasta do usuário) consegue pedir o pareamento
function iniciarServidor({ pasta, pareamento }) {
  const token = crypto.randomBytes(24).toString('hex')
  const servidor = http.createServer(async (req, res) => {
    const json = (st, o) => (res.writeHead(st, { 'Content-Type': 'application/json' }), res.end(JSON.stringify(o)))
    if (req.method !== 'POST' || req.url !== '/extensao/parear' || req.headers.authorization !== 'Bearer ' + token) return json(401, { erro: 'Não autorizado.' })
    if (req.headers.origin) return json(403, { erro: 'Só o host nativo pode pedir.' }) // navegador comum mandaria Origin
    try {
      json(200, await pareamento())
    } catch (e) {
      json(409, { erro: String(e.message || e), codigo: 'sem_conta' })
    }
  })
  return new Promise((resolve) => {
    servidor.listen(0, '127.0.0.1', () => {
      const porta = servidor.address().port
      const arq = path.join(pasta, 'extensao-host.json')
      try {
        fs.mkdirSync(pasta, { recursive: true })
        fs.writeFileSync(arq, JSON.stringify({ porta, token, pid: process.pid }), { mode: 0o600 })
      } catch {}
      resolve({ porta, token, arquivo: arq, fechar: () => { try { servidor.close() } catch {}; try { fs.unlinkSync(arq) } catch {} } })
    })
  })
}

// manifesto do host + lançador (o Chrome executa o lançador; ele roda o script com o Node do próprio Electron)
function escreverHost({ pasta, execPath, scriptHost, plataforma = process.platform }) {  // `pasta` = a pasta de dados do app (o host lê dela a porta e o token do app aberto)
  const dir = path.join(pasta, 'native')
  fs.mkdirSync(dir, { recursive: true })
  const lancador = path.join(dir, plataforma === 'win32' ? 'host.cmd' : 'host.sh')
  if (plataforma === 'win32') fs.writeFileSync(lancador, `@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\nset "SB_DADOS=${pasta}"\r\n"${execPath}" "${scriptHost}" %*\r\n`)
  else fs.writeFileSync(lancador, `#!/bin/sh\nexport ELECTRON_RUN_AS_NODE=1\nexport SB_DADOS="${pasta}"\nexec "${execPath}" "${scriptHost}" "$@"\n`, { mode: 0o755 })
  const manifesto = path.join(dir, HOST + '.json')
  fs.writeFileSync(manifesto, JSON.stringify({ name: HOST, description: 'Segundo Cérebro: pareia a extensão do Chrome com a sua conta', path: lancador, type: 'stdio', allowed_origins: [`chrome-extension://${ID_EXTENSAO}/`] }, null, 2))
  return { lancador, manifesto }
}

// onde cada navegador procura os hosts
function destinos(plataforma = process.platform, home = os.homedir()) {
  if (plataforma === 'win32') return { reg: ['HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\' + HOST, 'HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\' + HOST, 'HKCU\\Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts\\' + HOST, 'HKCU\\Software\\Chromium\\NativeMessagingHosts\\' + HOST], pastas: [] }
  if (plataforma === 'darwin') {
    const base = path.join(home, 'Library', 'Application Support')
    return { reg: [], pastas: ['Google/Chrome', 'Microsoft Edge', 'BraveSoftware/Brave-Browser', 'Chromium'].map((p) => path.join(base, p, 'NativeMessagingHosts')) }
  }
  const base = path.join(home, '.config')
  return { reg: [], pastas: ['google-chrome', 'microsoft-edge', 'BraveSoftware/Brave-Browser', 'chromium'].map((p) => path.join(base, p, 'NativeMessagingHosts')) }
}

function registrar({ pasta, execPath, scriptHost, plataforma = process.platform, home = os.homedir(), executar = execFile }) {
  const { manifesto } = escreverHost({ pasta, execPath, scriptHost, plataforma })
  const d = destinos(plataforma, home)
  for (const dir of d.pastas) {
    try {
      fs.mkdirSync(dir, { recursive: true })
      fs.copyFileSync(manifesto, path.join(dir, HOST + '.json'))
    } catch {}
  }
  for (const chave of d.reg) executar('reg', ['add', chave, '/ve', '/t', 'REG_SZ', '/d', manifesto, '/f'], () => {})
  return { manifesto, ...d }
}

module.exports = { iniciarServidor, escreverHost, registrar, destinos, HOST, ID_EXTENSAO, LINK_EXTENSAO }
