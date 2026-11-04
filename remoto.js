// Acesso web (spec 21 §12): mantém uma conexão de SAÍDA com a ponte (identificada pela chave da conta), responde às chamadas
// que a interface web faz (as mesmas do IPC do app) e entrega os arquivos da própria interface pelo túnel, para a tela web
// ser sempre da mesma versão do app. Sem porta aberta no computador e sem QR code.
const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const WebSocket = require('ws')

const URL_PADRAO = process.env.SB_REMOTO_URL || 'https://remoto.rangeltech.net'
const RENDERER = path.join(__dirname, 'renderer')
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json', '.gz': 'application/gzip' }
// o que a tela web NÃO pode pedir ao app (abre janela, pasta ou programa no computador, ou mexe no próprio acesso web)
const BLOQUEADOS = new Set(['pasta:escolher', 'arquivo:abrir', 'arquivo:mostrar', 'logs:abrir', 'dados:exportar', 'dados:importar', 'externo:abrir', 'acessoweb:ativar', 'acessoweb:renomear', 'acessoweb:estado'])
// eventos do app que a tela web também recebe (o resto vai só para quem fez a chamada)
const EVENTOS_ESPELHADOS = new Set(['skills:mudou', 'unlimited:estado', 'navegador:estado', 'navegador:abrir-painel'])

// bytes viajam como { $b64 } dentro do JSON
const reviver = (v) => {
  if (Array.isArray(v)) return v.map(reviver)
  if (v && typeof v === 'object') {
    if (typeof v.$b64 === 'string' && Object.keys(v).length === 1) return Buffer.from(v.$b64, 'base64')
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, reviver(x)]))
  }
  return v
}
const serializar = (v) => (v instanceof Uint8Array ? { $b64: Buffer.from(v).toString('base64') } : v)

function criar({ app, janela, chave, invocar, tipo = 'desktop' }) {
  const arq = path.join(app.getPath('userData'), 'acessoweb.json')
  let cfg = { ativo: false, url: URL_PADRAO, maquinaId: '', nome: '' }
  try {
    cfg = { ...cfg, ...JSON.parse(fs.readFileSync(arq, 'utf8')) }
  } catch {}
  cfg.url = URL_PADRAO
  if (!cfg.maquinaId) cfg.maquinaId = 'm-' + crypto.randomBytes(8).toString('hex')
  if (!cfg.nome) cfg.nome = os.hostname().slice(0, 60) || 'Computador'
  const salvar = () => fs.writeFileSync(arq, JSON.stringify(cfg))
  salvar()

  let ws = null
  let conectado = false
  let erro = ''
  let tentativas = 0
  let religar = null

  const estado = () => ({ ativo: cfg.ativo, conectado, erro, url: cfg.url, nome: cfg.nome, maquinaId: cfg.maquinaId })
  const avisar = () => janela()?.webContents.send('acessoweb:estado', estado())
  const wsUrl = () => cfg.url.replace(/^http/, 'ws') + '/ws/maquina'
  const enviar = (m) => ws && ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m))

  // página inicial da versão web: a mesma interface do app, com a camada de rede no lugar do IPC
  function paginaWeb() {
    let h = fs.readFileSync(path.join(RENDERER, 'index.html'), 'utf8')
    h = h.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '')
    h = h.replace('<script src="sb-api.js"></script>', '<script src="sb-web.js"></script>\n<script src="sb-api.js"></script>')
    return Buffer.from(h)
  }
  function responderHttp(m) {
    const falha = (status) => enviar({ t: 'http-r', rid: m.rid, status, tipo: 'text/plain', b64: '' })
    try {
      if (m.caminho === 'web.html') return enviar({ t: 'http-r', rid: m.rid, status: 200, tipo: TIPOS['.html'], b64: paginaWeb().toString('base64') })
      const rel = path.normalize(String(m.caminho || '')).replace(/^([\\/])+/, '')
      const arquivo = path.join(RENDERER, rel)
      if (!arquivo.startsWith(RENDERER + path.sep) || !fs.existsSync(arquivo) || !fs.statSync(arquivo).isFile()) return falha(404)
      enviar({ t: 'http-r', rid: m.rid, status: 200, tipo: TIPOS[path.extname(arquivo).toLowerCase()] || 'application/octet-stream', b64: fs.readFileSync(arquivo).toString('base64') })
    } catch {
      falha(500)
    }
  }

  async function chamar(m) {
    const ret = (o) => enviar({ t: 'ret', para: m.de, id: m.id, ...o })
    if (BLOQUEADOS.has(m.canal)) return ret({ ok: false, erro: 'Esta ação só pode ser feita no próprio computador.' })
    try {
      const sender = { send: (canal, dados) => enviar({ t: 'ev', canal, dados, para: m.de }) }
      const valor = await invocar(m.canal, reviver(m.args || []), sender)
      ret({ ok: true, valor: serializar(valor) })
    } catch (e) {
      ret({ ok: false, erro: String(e?.message || e) })
    }
  }

  async function conectar() {
    clearTimeout(religar)
    if (!cfg.ativo) return
    const k = await Promise.resolve(chave()).catch(() => '')
    if (!k) {
      erro = 'Entre na sua conta no Segundo Cérebro para ligar o acesso web.'
      avisar()
      return agendar(15000)
    }
    ws = new WebSocket(wsUrl(), { headers: { Authorization: 'Bearer ' + k }, handshakeTimeout: 15000, maxPayload: 40 * 1024 * 1024 })
    const meu = ws
    meu.on('open', () => enviar({ t: 'hello', maquinaId: cfg.maquinaId, nome: cfg.nome, tipo, versao: app.getVersion() }))
    meu.on('message', (d) => {
      let m
      try {
        m = JSON.parse(String(d))
      } catch {
        return
      }
      if (m.t === 'ok') {
        conectado = true
        tentativas = 0
        erro = ''
        return avisar()
      }
      if (m.t === 'http') return responderHttp(m)
      if (m.t === 'inv') return chamar(m)
    })
    meu.on('close', (codigo) => {
      if (ws !== meu) return
      conectado = false
      if (codigo === 4004) erro = 'Sua assinatura não está ativa.'
      else if (codigo === 4002) erro = 'Este computador foi conectado em outro lugar.'
      avisar()
      agendar()
    })
    // a ponte recusou a chave (conta sem assinatura ativa ou chave revogada)
    meu.on('unexpected-response', (req, res) => {
      erro = res.statusCode === 401 || res.statusCode === 403 ? 'A ponte não aceitou esta conta. Entre de novo no Segundo Cérebro.' : `A ponte respondeu ${res.statusCode}.`
      req.destroy()
      if (ws === meu) {
        conectado = false
        avisar()
        agendar()
      }
    })
    meu.on('error', () => {
      if (!erro) erro = 'Sem conexão com a ponte.'
    })
  }
  function agendar(ms) {
    clearTimeout(religar)
    if (!cfg.ativo) return
    tentativas++
    religar = setTimeout(conectar, ms || Math.min(60000, 1000 * 2 ** Math.min(tentativas, 6)))
  }
  function desligarSocket() {
    clearTimeout(religar)
    const w = ws
    ws = null
    conectado = false
    try {
      w?.close()
    } catch {}
  }

  return {
    estado,
    async ativar(sim) {
      cfg.ativo = !!sim
      salvar()
      erro = ''
      if (sim) await conectar()
      else desligarSocket()
      avisar()
      return estado()
    },
    renomear(nome) {
      const n = String(nome || '').trim().slice(0, 60)
      if (!n) return { erro: 'Escolha um nome.' }
      cfg.nome = n
      salvar()
      if (conectado) {
        desligarSocket()
        conectar()
      }
      avisar()
      return estado()
    },
    iniciar() {
      if (cfg.ativo) conectar()
    },
    // reconecta (ex.: depois de entrar na conta e a chave passar a existir)
    religar() {
      if (cfg.ativo && !conectado) conectar()
    },
    espelhar(canal, dados) {
      if (conectado && EVENTOS_ESPELHADOS.has(canal)) enviar({ t: 'ev', canal, dados })
    },
    parar: desligarSocket,
  }
}

module.exports = { criar }
