// Second Brain (Rangel Tech): janela de chat + roteador local de provedores e combos (estilo 9Router).
const { app, BrowserWindow, ipcMain, safeStorage, shell, dialog, session } = require('electron')
const embed = require('./embed-router')
const { Sessao } = require('./agent')
const path = require('path')
const fs = require('fs')

// janela encoberta não pode congelar a interface (testes e uso em segundo plano)
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
const HOME = app.getPath('home')
const PADRAO = {
  ativo: '',
  soConversa: false,
  raciocinio: 'low',
  pasta: path.join(app.getPath('documents'), 'Second Brain'),
  hermesHome: path.join(HOME, 'hermes'),
}

const arq = (nome) => path.join(app.getPath('userData'), nome)
function ler(nome, padrao) {
  try {
    return JSON.parse(fs.readFileSync(arq(nome), 'utf8'))
  } catch {
    return padrao
  }
}
function gravar(nome, dado) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  fs.writeFileSync(arq(nome), JSON.stringify(dado, null, 2))
}

// ---------- configuracao (chaves cifradas pelo sistema) ----------
function cifrar(txt) {
  if (!txt) return ''
  return safeStorage.isEncryptionAvailable() ? 'enc:' + safeStorage.encryptString(txt).toString('base64') : 'raw:' + txt
}
function decifrar(txt) {
  if (!txt) return ''
  if (txt.startsWith('enc:')) return safeStorage.decryptString(Buffer.from(txt.slice(4), 'base64'))
  return txt.replace(/^raw:/, '')
}
let cfg
function carregarCfg() {
  cfg = { ...PADRAO, ...ler('config.json', {}) }
  delete cfg.providers
  delete cfg.combos
  delete cfg.agenteHermes
  if (!cfg.pasta || cfg.pasta === HOME) cfg.pasta = PADRAO.pasta
  fs.mkdirSync(cfg.pasta, { recursive: true })
}
function salvarCfg() {
  gravar('config.json', cfg)
}

// Chave local do motor de provedores (o chat e o agente usam esta chave em 127.0.0.1).
async function chaveLocal() {
  const arqChave = arq('router-chave.bin')
  try {
    return decifrar(fs.readFileSync(arqChave, 'utf8'))
  } catch {}
  const r = await embed.api('POST', '/api/keys', { name: 'Second Brain (local)' })
  const chave = r.json?.key
  if (!chave) throw new Error('Não consegui criar a chave local do motor de provedores.')
  fs.writeFileSync(arqChave, cifrar(chave))
  return chave
}

// ---------- provedores ----------
async function chamarOpenAI(p, msgs, { onDelta, sinal }) {
  const chave = decifrar(p.chave)
  const res = await fetch(`${p.base.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(chave ? { Authorization: `Bearer ${chave}` } : {}) },
    body: JSON.stringify({ model: p.modelo, messages: msgs, stream: true }),
    signal: sinal,
  })
  if (!res.ok) throw new Error(`${p.nome}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
  const leitor = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let total = ''
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const linha = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (!linha.startsWith('data:')) continue
      const dado = linha.slice(5).trim()
      if (dado === '[DONE]') continue
      try {
        const d = JSON.parse(dado).choices?.[0]?.delta ?? {}
        const raz = d.reasoning_content ?? d.reasoning
        if (raz) onDelta?.({ raciocinio: raz })
        if (d.content) {
          total += d.content
          onDelta?.({ texto: d.content })
        }
      } catch {}
    }
  }
  return total
}

// ---------- resposta do chat ----------
const sessoes = new Map()
async function sessaoDoChat(id, alvo, contexto) {
  const est = embed.estado()
  const existente = sessoes.get(id)
  if (existente && !existente.morto && existente.modelo === alvo && existente.pasta === cfg.pasta && existente.racio === cfg.raciocinio) return existente
  existente?.encerrar()
  fs.mkdirSync(cfg.pasta, { recursive: true })
  const sessao = new Sessao({ app, id, pasta: cfg.pasta, base: est.origem + '/v1', modelo: alvo, chave: await chaveLocal(), raciocinio: cfg.raciocinio, emitir: contexto.onDelta, pedirPermissao: contexto.pedirPermissao })
  sessao.modelo = alvo
  sessao.racio = cfg.raciocinio
  sessoes.set(id, sessao)
  return sessao
}
async function responder(alvo, msgs, ctx) {
  const est = embed.estado()
  if (!est.pronto) throw new Error(est.erro || 'O motor de provedores ainda está iniciando. Tente de novo em instantes.')
  if (!alvo) throw new Error('Escolha um modelo ou combo no topo do chat (cadastre um provedor em Configurações > Provedores).')
  if (cfg.soConversa) {
    const chave = await chaveLocal()
    return chamarOpenAI({ nome: 'Second Brain', base: est.origem + '/v1', modelo: alvo, chave: cifrar(chave) }, msgs, ctx)
  }
  const sessao = await sessaoDoChat(ctx.chat, alvo, ctx)
  ctx.sinal?.addEventListener('abort', () => sessao.cancelar())
  const ultimo = [...msgs].reverse().find((m) => m.role === 'user')?.content ?? ''
  await sessao.perguntar(ultimo, ctx.anexos || [])
  return ''
}

// ---------- modelos para o seletor do chat ----------
async function listarModelos() {
  const saida = []
  const combos = await embed.api('GET', '/api/combos')
  for (const c of combos.json?.combos ?? []) if (!c.kind || c.kind === 'llm') saida.push({ id: c.name, nome: c.name, grupo: 'Combos' })
  const conex = (await embed.api('GET', '/api/providers')).json?.connections ?? []
  const ativos = conex.filter((c) => c.isActive !== false)
  const nos = new Map(((await embed.api('GET', '/api/provider-nodes')).json?.nodes ?? []).map((n) => [n.id, n]))
  const catalogo = new Set(ativos.filter((c) => !nos.has(c.provider)).map((c) => c.provider))
  if (catalogo.size) {
    const mods = await embed.api('GET', '/api/models')
    for (const m of mods.json?.models ?? []) if (catalogo.has(m.provider)) saida.push({ id: m.fullModel, nome: m.name || m.model, grupo: 'Modelos', provedor: m.provider })
  }
  // provedores compatíveis com OpenAI (inclui o Unlimited): modelos vêm do próprio servidor
  for (const c of ativos) {
    const no = nos.get(c.provider)
    if (!no) continue
    if (no.prefix === 'unl') {
      saida.push({ id: 'unl/qwen-abliterated', nome: 'Unlimited', grupo: 'Modelos', provedor: c.provider })
      continue
    }
    const r = await embed.api('GET', `/api/providers/${c.id}/models`)
    const lista = Array.isArray(r.json?.models) ? r.json.models : []
    for (const m of lista) {
      const id = typeof m === 'string' ? m : m.id || m.name
      if (id) saida.push({ id: `${no.prefix}/${id}`, nome: `${id}`, grupo: 'Modelos', provedor: c.provider })
    }
  }
  return saida
}

// Rotas do motor que as telas podem chamar (nada fora desta lista chega a ele).
const ROTAS_PERMITIDAS = [/^\/api\/providers(\/|\?|$)/, /^\/api\/provider-nodes(\/|\?|$)/, /^\/api\/combos(\/|\?|$)/, /^\/api\/models(\/|\?|$)/, /^\/api\/usage\//, /^\/api\/oauth\//, /^\/api\/settings$/]

// ---------- janela e IPC ----------
let janela
const abortos = new Map()
function criarJanela() {
  janela = new BrowserWindow({
    width: 1240,
    height: 800,
    minWidth: 760,
    minHeight: 520,
    backgroundColor: '#1f1d1a',
    title: 'Second Brain',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  })
  janela.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  janela.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  carregarCfg()
  session.defaultSession.setPermissionRequestHandler((_wc, permissao, cb) => cb(['media', 'clipboard-read'].includes(permissao)))
  criarJanela()
  if (app.isPackaged) {
    try {
      const { autoUpdater } = require('electron-updater')
      autoUpdater.autoDownload = true
      autoUpdater.checkForUpdatesAndNotify().catch(() => {})
    } catch {}
  }
  embed.iniciar().catch((e) => console.error('router', e))
  ipcMain.handle('router:estado', () => embed.estado())
  ipcMain.handle('router:api', async (_e, { metodo, rota, corpo }) => {
    if (!ROTAS_PERMITIDAS.some((r) => r.test(rota))) return { status: 403, json: { error: 'Rota não permitida' } }
    try {
      return await embed.api(metodo || 'GET', rota, corpo)
    } catch (e) {
      return { status: 503, json: { error: String(e.message) } }
    }
  })
  ipcMain.handle('modelos:listar', () => listarModelos().catch(() => []))
  ipcMain.handle('externo:abrir', (_e, url) => (/^https:\/\//.test(url) ? shell.openExternal(url) : false))
  ipcMain.handle('cfg:get', () => cfg)
  ipcMain.handle('cfg:set', (_e, parcial) => {
    for (const k of ['ativo', 'soConversa', 'pasta', 'raciocinio']) if (parcial[k] !== undefined) cfg[k] = parcial[k]
    salvarCfg()
    return cfg
  })
  ipcMain.handle('chats:get', () => ler('chats.json', []))
  ipcMain.handle('chats:set', (_e, chats) => {
    gravar('chats.json', chats)
    return true
  })
  ipcMain.handle('pasta:escolher', async () => {
    const r = await dialog.showOpenDialog(janela, { properties: ['openDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })
  const permissoes = new Map()
  ipcMain.handle('chat:permissao-resp', (_e, { req, resposta }) => permissoes.get(req)?.(resposta))
  ipcMain.handle('chat:enviar', async (e, { id, mensagens, alvo, anexos }) => {
    const ac = new AbortController()
    abortos.set(id, ac)
    let acumulado = ''
    const enviar = (d) => {
      if (d.texto) acumulado += d.texto
      e.sender.send('chat:delta', { id, ...d })
    }
    const pedirPermissao = (p) =>
      new Promise((resolve) => {
        const req = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
        permissoes.set(req, (r) => (permissoes.delete(req), resolve(r)))
        e.sender.send('chat:permissao', { id, req, titulo: p.titulo, tipo: p.tipo })
        ac.signal.addEventListener('abort', () => permissoes.get(req)?.('negar'))
      })
    try {
      const texto = await responder(alvo, mensagens, { chat: id, onDelta: enviar, sinal: ac.signal, anexos, pedirPermissao })
      e.sender.send('chat:fim', { id, texto: texto || acumulado })
    } catch (err) {
      e.sender.send('chat:erro', { id, erro: ac.signal.aborted ? 'Interrompido.' : String(err.message ?? err) })
    } finally {
      abortos.delete(id)
    }
  })
  ipcMain.handle('anexo:salvar', (_e, { chat, nome, bytes, caminho }) => {
    const dir = path.join(app.getPath('userData'), 'conversas', chat, 'anexos')
    fs.mkdirSync(dir, { recursive: true })
    const limpo = String(nome || 'arquivo').replace(/[\/:*?"<>|]/g, '_')
    const destino = path.join(dir, Date.now().toString(36) + '-' + limpo)
    if (caminho) fs.copyFileSync(caminho, destino)
    else fs.writeFileSync(destino, Buffer.from(bytes))
    return destino
  })
  ipcMain.handle('arquivo:abrir', (_e, p) => (fs.existsSync(p) ? shell.openPath(p) : 'Arquivo não encontrado'))
  ipcMain.handle('arquivo:mostrar', (_e, p) => (shell.showItemInFolder(p), true))
  ipcMain.handle('arquivo:ler', (_e, p) => {
    try {
      const b = fs.readFileSync(p)
      return { ok: true, base64: b.toString('base64'), tamanho: b.length }
    } catch (err) {
      return { ok: false }
    }
  })
  ipcMain.handle('logs:abrir', () => shell.openPath(app.getPath('userData')))
  ipcMain.handle('app:info', () => ({ versao: app.getVersion(), dados: app.getPath('userData'), electron: process.versions.electron, so: process.platform }))
  ipcMain.handle('chat:parar', (_e, id) => {
    abortos.get(id)?.abort()
    sessoes.get(id)?.cancelar()
    return true
  })
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && criarJanela())
})
app.on('window-all-closed', () => {
  embed.parar()
  for (const x of sessoes.values()) x.encerrar()
  if (process.platform !== 'darwin') app.quit()
})
