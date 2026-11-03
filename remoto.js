// Controle remoto pelo celular (spec 20): mantém a conexão do computador com a ponte, cria o vínculo (QR code)
// e repassa os comandos do celular ao app. A ponte não guarda conversa; só repassa.
const { safeStorage } = require('electron')
const fs = require('fs')
const path = require('path')
const WebSocket = require('ws')

const URL_PADRAO = process.env.SB_REMOTO_URL || 'https://remoto.rangeltech.net'

function criar({ app, janela, executar }) {
  const arq = path.join(app.getPath('userData'), 'remoto.json')
  let cfg = { ativo: false, url: URL_PADRAO, computadorId: '', chave: '' }
  try {
    cfg = { ...cfg, ...JSON.parse(fs.readFileSync(arq, 'utf8')) }
  } catch {}
  const salvar = () => fs.writeFileSync(arq, JSON.stringify(cfg))
  const cifrar = (t) => (safeStorage.isEncryptionAvailable() ? 'e:' + safeStorage.encryptString(t).toString('base64') : 'p:' + t)
  const decifrar = (v) => (String(v).startsWith('e:') ? safeStorage.decryptString(Buffer.from(String(v).slice(2), 'base64')) : String(v).slice(2))

  let ws = null
  let conectado = false
  let celulares = []
  let tentativas = 0
  let religar = null
  let erro = ''
  const origemRemota = new Set() // chats em que a última ordem veio do celular

  const estado = () => ({ ativo: cfg.ativo, conectado, celulares, erro, url: cfg.url })
  const avisar = () => janela()?.webContents.send('remoto:estado', estado())
  const http = (url) => url.replace(/^ws/, 'http')
  const wsUrl = (url) => url.replace(/^http/, 'ws')

  async function api(metodo, caminho) {
    const r = await fetch(cfg.url + caminho, { method: metodo, headers: { Authorization: `Bearer ${cfg.computadorId}.${decifrar(cfg.chave)}` } })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.erro || `Erro ${r.status} na ponte.`)
    return j
  }

  async function registrar() {
    if (cfg.computadorId && cfg.chave) return
    const r = await fetch(cfg.url + '/api/registrar', { method: 'POST' })
    const j = await r.json().catch(() => ({}))
    if (!j.computadorId) throw new Error('A ponte não registrou este computador.')
    cfg.computadorId = j.computadorId
    cfg.chave = cifrar(j.chave)
    salvar()
  }

  function enviar(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }

  async function conectar() {
    clearTimeout(religar)
    if (!cfg.ativo) return
    try {
      await registrar()
      ws = new WebSocket(wsUrl(cfg.url) + '/ws/computador', { headers: { Authorization: `Bearer ${cfg.computadorId}.${decifrar(cfg.chave)}` }, handshakeTimeout: 15000 })
    } catch (e) {
      erro = String(e.message || e)
      avisar()
      return agendar()
    }
    const meu = ws
    meu.on('open', () => {
      conectado = true
      tentativas = 0
      erro = ''
      avisar()
    })
    meu.on('message', (d) => {
      let m
      try {
        m = JSON.parse(String(d))
      } catch {
        return
      }
      if (m.t === 'celulares') {
        celulares = m.lista || []
        return avisar()
      }
      if (m.de) tratar(m)
    })
    meu.on('close', () => {
      if (ws !== meu) return
      conectado = false
      avisar()
      agendar()
    })
    meu.on('error', (e) => {
      erro = 'Sem conexão com a ponte.'
      if (e && /401|Unexpected server response/.test(String(e.message))) erro = 'A ponte não reconheceu este computador.'
    })
  }
  function agendar() {
    if (!cfg.ativo) return
    tentativas++
    religar = setTimeout(conectar, Math.min(30000, 1000 * 2 ** Math.min(tentativas, 5)))
  }
  function desligarSocket() {
    clearTimeout(religar)
    const w = ws
    ws = null
    conectado = false
    celulares = []
    try {
      w?.close()
    } catch {}
  }

  // ordem vinda do celular
  function tratar(m) {
    if (m.t === 'enviar') origemRemota.add(String(m.id))
    executar(m)
  }

  return {
    estado,
    origemRemota: (id) => origemRemota.has(String(id)),
    liberarOrigem: (id) => origemRemota.delete(String(id)),
    async ativar(sim) {
      cfg.ativo = !!sim
      salvar()
      if (sim) {
        erro = ''
        await conectar()
      } else desligarSocket()
      avisar()
      return estado()
    },
    iniciar() {
      if (cfg.ativo) conectar()
    },
    async vincular() {
      if (!cfg.ativo) await this.ativar(true)
      await registrar()
      const j = await api('POST', '/api/vinculo')
      return { url: `${cfg.url}/v/${j.codigo}`, expiraEm: j.expiraEm }
    },
    async revogar(id) {
      await api('DELETE', '/api/celulares/' + encodeURIComponent(id))
      celulares = celulares.filter((c) => c.id !== id)
      avisar()
      return estado()
    },
    // envia ao(s) celular(es): sem `para` vai para todos os vinculados
    emitir: (msg) => enviar(msg),
    parar() {
      desligarSocket()
    },
  }
}

module.exports = { criar }
