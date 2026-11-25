// Service worker do Cérebro Pro no Chrome. Mantém um WebSocket com a ponte (remoto.rangeltech.net/ws/extensao), recebe os comandos
// do Hermes (abrir, ler, clicar, digitar, rolar, voltar, js, print, oauth_capturar) e executa no Chrome do usuário.
// Sem login aqui: o pareamento vem do app (mensageria nativa) ou do site do remoto (content-remoto.js).
import { ehRetorno, lerRetorno, urlPermitida, textoLer, MAX_TEXTO } from './nucleo.js'

const VERSAO = chrome.runtime.getManifest().version
const BASE_PADRAO = 'https://remoto.rangeltech.net'
const HOST_NATIVO = 'net.rangeltech.segundocerebro'
const TEMPO_CARGA_MS = 35000
const SOLTAR_DEPURADOR_MS = 20000
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------- estado e configuração ----------
async function cfg() {
  const c = await chrome.storage.local.get(['token', 'base', 'pausada', 'desligadoPeloUsuario'])
  return { token: c.token || '', base: (c.base || BASE_PADRAO).replace(/\/+$/, ''), pausada: !!c.pausada, desligado: !!c.desligadoPeloUsuario }
}
const wsBase = (b) => b.replace(/^http/, 'ws')
let ws = null
let conectado = false
let agindo = 0 // tarefas em andamento (o ícone muda de cor)
let ultimoErro = ''

async function pintarIcone() {
  const c = await cfg()
  const texto = !c.token ? '!' : c.pausada ? '||' : agindo ? '...' : conectado ? '' : '?'
  const cor = !c.token ? '#b45309' : c.pausada ? '#6b7280' : agindo ? '#2563eb' : conectado ? '#16a34a' : '#b45309'
  try {
    await chrome.action.setBadgeText({ text: texto })
    await chrome.action.setBadgeBackgroundColor({ color: cor })
  } catch {}
}

async function estadoPublico() {
  const c = await cfg()
  return { pareada: !!c.token, conectado, pausada: c.pausada, agindo: agindo > 0, base: c.base, erro: ultimoErro, versao: VERSAO }
}

// ---------- pareamento ----------
async function registrar(tokenPareamento) {
  const { base } = await cfg()
  const r = await fetch(base + '/api/extensao/registrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tokenPareamento, nome: nomeDoNavegador(), versao: VERSAO }) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.token) throw new Error(j.erro || 'Não consegui parear.')
  await chrome.storage.local.set({ token: j.token, desligadoPeloUsuario: false })
  ultimoErro = ''
  conectar()
  return true
}
function nomeDoNavegador() {
  const ua = navigator.userAgent
  const nav = /Edg\//.test(ua) ? 'Edge' : /Brave/.test(ua) ? 'Brave' : 'Chrome'
  const so = /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : ''
  return `${nav}${so ? ' no ' + so : ''}`
}
// 1º caminho: o app instalado no mesmo computador entrega o pareamento (mensageria nativa), sem a pessoa fazer nada
async function parearPeloApp() {
  const c = await cfg()
  if (c.token || c.desligado) return false
  return new Promise((resolve) => {
    let porta
    try {
      porta = chrome.runtime.connectNative(HOST_NATIVO)
    } catch {
      return resolve(false)
    }
    const fim = setTimeout(() => { try { porta.disconnect() } catch {} resolve(false) }, 8000)
    porta.onMessage.addListener(async (m) => {
      clearTimeout(fim)
      try { porta.disconnect() } catch {}
      if (m && m.token) {
        if (m.base) await chrome.storage.local.set({ base: m.base })
        try { resolve(await registrar(m.token)) } catch (e) { ultimoErro = String(e.message || e); resolve(false) }
      } else resolve(false)
    })
    porta.onDisconnect.addListener(() => { clearTimeout(fim); void chrome.runtime.lastError; resolve(false) })
    porta.postMessage({ t: 'parear' })
  })
}

// ---------- conexão com a ponte ----------
let tentativa = 0
let batida = null
async function conectar() {
  const c = await cfg()
  if (!c.token || c.desligado) return pintarIcone()
  if (ws && ws.readyState <= 1) return
  try {
    ws = new WebSocket(wsBase(c.base) + '/ws/extensao')
  } catch (e) {
    ultimoErro = String(e.message || e)
    return agendar()
  }
  const meu = ws
  meu.onopen = () => meu.send(JSON.stringify({ t: 'ola', token: c.token, nome: nomeDoNavegador(), versao: VERSAO, pausada: c.pausada }))
  meu.onmessage = (ev) => {
    let m
    try { m = JSON.parse(ev.data) } catch { return }
    if (m.t === 'ok') {
      conectado = true; tentativa = 0; ultimoErro = ''
      clearInterval(batida)
      batida = setInterval(() => { if (meu.readyState === 1) meu.send(JSON.stringify({ t: 'ping' })) }, 20000) // mantém o service worker acordado (Chrome 116+)
      pintarIcone()
    } else if (m.t === 'cmd') executarComando(meu, m)
  }
  meu.onclose = async (ev) => {
    conectado = false
    clearInterval(batida)
    if (ev.code === 4001 || ev.code === 4005) { // token inválido ou revogado: a extensão volta ao estado "não conectada"
      await chrome.storage.local.remove('token')
      ultimoErro = ev.code === 4005 ? 'Este Chrome foi desconectado pelo site.' : 'Conexão expirada. Entre de novo.'
    }
    pintarIcone()
    agendar()
  }
  meu.onerror = () => {}
}
function agendar() {
  tentativa++
  setTimeout(conectar, Math.min(30000, 1000 * 2 ** Math.min(tentativa, 5)))
}
function enviarPonte(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)) }

// ---------- ferramentas ----------
let abaId = null
let grupoId = null
async function abaAgente(criar = true) {
  if (abaId == null) abaId = (await chrome.storage.session.get('aba')).aba ?? null
  if (abaId != null) {
    try { return await chrome.tabs.get(abaId) } catch { abaId = null }
  }
  if (!criar) return null
  const t = await chrome.tabs.create({ url: 'about:blank', active: true })
  abaId = t.id
  await chrome.storage.session.set({ aba: abaId })
  try {
    const g = await chrome.tabs.group(grupoId != null ? { tabIds: [t.id], groupId: grupoId } : { tabIds: [t.id] })
    grupoId = g
    await chrome.tabGroups.update(g, { title: 'Cérebro Pro', color: 'purple' })
  } catch {}
  return t
}
async function paraFrente(tab) {
  try {
    await chrome.tabs.update(tab.id, { active: true }) // aba coberta tem timers reduzidos (atrapalha o WhatsApp Web)
    await chrome.windows.update(tab.windowId, { focused: true })
  } catch {}
}
function aguardarCarga(tabId) {
  return new Promise((resolve, reject) => {
    const fim = setTimeout(() => { chrome.tabs.onUpdated.removeListener(f); reject(new Error('A página demorou mais de 35 s para carregar.')) }, TEMPO_CARGA_MS)
    const f = (id, info) => { if (id === tabId && info.status === 'complete') { clearTimeout(fim); chrome.tabs.onUpdated.removeListener(f); resolve() } }
    chrome.tabs.onUpdated.addListener(f)
    chrome.tabs.get(tabId).then((t) => { if (t.status === 'complete' && t.url && t.url !== 'about:blank') { /* pode ser a página antiga: o onUpdated confirma */ } }).catch(() => {})
  })
}

// --- depurador (cliques e digitação de verdade, js e print); solto depois de ~20 s sem uso, porque o Chrome mostra uma faixa enquanto está ligado
const anexados = new Map() // tabId -> timer
async function depurador(tabId) {
  if (!anexados.has(tabId)) {
    await chrome.debugger.attach({ tabId }, '1.3')
  }
  clearTimeout(anexados.get(tabId))
  anexados.set(tabId, setTimeout(() => soltar(tabId), SOLTAR_DEPURADOR_MS))
}
async function soltar(tabId) {
  clearTimeout(anexados.get(tabId))
  anexados.delete(tabId)
  try { await chrome.debugger.detach({ tabId }) } catch {}
}
chrome.debugger.onDetach.addListener((src) => { if (src.tabId != null) { clearTimeout(anexados.get(src.tabId)); anexados.delete(src.tabId) } })
const cdp = async (tabId, metodo, params = {}) => { await depurador(tabId); return chrome.debugger.sendCommand({ tabId }, metodo, params) }

// o mesmo algoritmo do navegador integrado (navegador.js): lista os elementos clicáveis e marca cada um com data-sb-id
function paginaLer(maxTexto) {
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight * 3 }
  document.querySelectorAll('[data-sb-id]').forEach((e) => e.removeAttribute('data-sb-id'))
  const sel = 'a[href],button,input,select,textarea,[role=button],[role=link],[onclick],summary,[contenteditable=true]'
  const lista = []
  let n = 0
  for (const e of document.querySelectorAll(sel)) {
    if (!vis(e) || e.disabled) continue
    n++
    e.setAttribute('data-sb-id', String(n))
    const tipo = e.tagName.toLowerCase() + (e.type ? ':' + e.type : '')
    const texto = (e.innerText || e.value || e.placeholder || e.getAttribute('aria-label') || e.title || e.alt || '').replace(/\s+/g, ' ').trim().slice(0, 80)
    lista.push({ id: n, tipo, texto, href: e.href && e.tagName === 'A' ? e.href.slice(0, 120) : undefined })
    if (n >= 90) break
  }
  return { titulo: document.title, url: location.href, texto: (document.body ? document.body.innerText : '').replace(/\n{3,}/g, '\n\n').slice(0, maxTexto), elementos: lista, rolagem: { y: Math.round(scrollY), altura: document.documentElement.scrollHeight, janela: innerHeight } }
}
function paginaAlvo(id) {
  const e = document.querySelector('[data-sb-id="' + Number(id) + '"]')
  if (!e) return { ok: false }
  e.scrollIntoView({ block: 'center' })
  const b = e.getBoundingClientRect()
  return { ok: true, x: b.left + b.width / 2, y: b.top + b.height / 2 }
}
function paginaFocar(id) {
  const e = document.querySelector('[data-sb-id="' + Number(id) + '"]')
  if (!e) return false
  e.scrollIntoView({ block: 'center' })
  e.focus()
  if (e.select) e.select()
  return true
}
function paginaRolar(d, px) {
  if (d === 'topo') scrollTo(0, 0)
  else if (d === 'fim') scrollTo(0, document.documentElement.scrollHeight)
  else scrollBy(0, d === 'cima' ? -px : px)
  return { y: Math.round(scrollY), altura: document.documentElement.scrollHeight }
}
const rodar = async (tabId, func, args = []) => {
  const [r] = await chrome.scripting.executeScript({ target: { tabId }, func, args })
  return r && r.result
}
async function abaDaTarefa() {
  const t = await abaAgente(true)
  if (!/^https?:/i.test(t.url || '') && t.url !== 'about:blank' && !(t.pendingUrl || '').startsWith('http')) { /* página interna do Chrome: só `abrir` funciona */ }
  await paraFrente(t)
  return t
}

const FERRAMENTAS = {
  async abrir({ url }) {
    if (!urlPermitida(url)) throw new Error('Só aceito endereços http e https.')
    const t = await abaAgente(true)
    await paraFrente(t)
    const carga = aguardarCarga(t.id)
    await chrome.tabs.update(t.id, { url, active: true })
    await carga.catch((e) => { throw e })
    await esperar(400)
    const nova = await chrome.tabs.get(t.id)
    return { texto: `Aberto: ${nova.title || '(sem título)'} — ${nova.url}` }
  },
  async ler() {
    const t = await abaDaTarefa()
    const r = await rodar(t.id, paginaLer, [MAX_TEXTO])
    if (!r) throw new Error('Não consegui ler esta página (páginas internas do Chrome não podem ser lidas).')
    return { texto: textoLer(r) }
  },
  async clicar({ id, x, y }) {
    const t = await abaDaTarefa()
    if (id !== undefined && id !== null) {
      const r = await rodar(t.id, paginaAlvo, [id])
      if (!r || !r.ok) throw new Error(`Elemento ${id} não existe mais. Rode navegador_ler de novo para atualizar os ids.`)
      await esperar(150)
      x = r.x; y = r.y
    }
    if (typeof x !== 'number' || typeof y !== 'number') throw new Error('Informe id (de navegador_ler) ou x e y.')
    const px = Math.round(x), py = Math.round(y)
    await cdp(t.id, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x: px, y: py })
    await cdp(t.id, 'Input.dispatchMouseEvent', { type: 'mousePressed', x: px, y: py, button: 'left', clickCount: 1 })
    await cdp(t.id, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x: px, y: py, button: 'left', clickCount: 1 })
    await esperar(900)
    const nova = await chrome.tabs.get(t.id)
    return { texto: `Cliquei em (${px}, ${py}). Agora em: ${nova.url}` }
  },
  async digitar({ id, texto, enter }) {
    const t = await abaDaTarefa()
    if (id !== undefined && id !== null) {
      const ok = await rodar(t.id, paginaFocar, [id])
      if (!ok) throw new Error(`Elemento ${id} não existe mais. Rode navegador_ler de novo.`)
    }
    await cdp(t.id, 'Input.insertText', { text: String(texto ?? '') })
    if (enter) {
      await cdp(t.id, 'Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r' })
      await cdp(t.id, 'Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 })
      await esperar(900)
    }
    return { texto: `Digitei ${String(texto ?? '').length} caracteres${enter ? ' e apertei Enter' : ''}.` }
  },
  async rolar({ direcao, pixels }) {
    const t = await abaDaTarefa()
    const r = await rodar(t.id, paginaRolar, [String(direcao || 'baixo'), Number(pixels) || 600])
    await esperar(300)
    return { texto: `Rolagem em ${r.y} de ${r.altura}.` }
  },
  async voltar() {
    const t = await abaDaTarefa()
    try { await chrome.tabs.goBack(t.id) } catch {}
    await esperar(900)
    const nova = await chrome.tabs.get(t.id)
    return { texto: `Voltei para ${nova.url}` }
  },
  async js({ codigo }) {
    const t = await abaDaTarefa()
    const r = await cdp(t.id, 'Runtime.evaluate', { expression: `(async () => { ${String(codigo)} })()`, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text || 'Erro no código.')
    const v = r.result && r.result.value
    return { texto: typeof v === 'string' ? v.slice(0, 6000) : (JSON.stringify(v) ?? 'undefined').slice(0, 6000) }
  },
  async print() {
    const t = await abaDaTarefa()
    await esperar(300)
    const lm = await cdp(t.id, 'Page.getLayoutMetrics')
    const v = lm.cssVisualViewport || lm.visualViewport
    // scale 1 em pixels CSS: as coordenadas da imagem batem com as do clique
    const r = await cdp(t.id, 'Page.captureScreenshot', { format: 'png', clip: { x: v.pageX, y: v.pageY, width: v.clientWidth, height: v.clientHeight, scale: 1 } })
    return { texto: `Captura da página (${Math.round(v.clientWidth)}x${Math.round(v.clientHeight)}).`, imagem: r.data, largura: Math.round(v.clientWidth), altura: Math.round(v.clientHeight) }
  },
  // login de provedor (Claude Code, Codex, Gemini CLI): abre a página de login numa aba do Chrome do usuário (onde ele costuma já estar logado)
  // e pega o endereço de retorno (localhost:8080/callback?code=...) sozinha, mesmo que a página dê erro. Fecha a aba e devolve o código.
  async oauth_capturar({ authUrl, retorno, state }) {
    if (!urlPermitida(authUrl) || !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(String(retorno || ''))) throw new Error('Endereço inválido.')
    const t = await chrome.tabs.create({ url: authUrl, active: true })
    return new Promise((resolve, reject) => {
      let feito = false
      const terminar = (fn, v) => {
        if (feito) return
        feito = true
        clearTimeout(relogio)
        chrome.webNavigation.onBeforeNavigate.removeListener(olhar)
        chrome.webNavigation.onCommitted.removeListener(olhar)
        chrome.webNavigation.onErrorOccurred.removeListener(olhar)
        chrome.tabs.onUpdated.removeListener(atualizou)
        chrome.tabs.onRemoved.removeListener(fechou)
        try { chrome.tabs.remove(t.id) } catch {}
        fn(v)
      }
      const processar = (url) => {
        if (!ehRetorno(url, retorno)) return false
        const r = lerRetorno(url)
        if (state && r.state && r.state !== state) return false // retorno de outro pedido: ignora
        if (r.code) terminar(resolve, { texto: 'ok', code: r.code, state: r.state, url })
        else terminar(reject, new Error(r.erro || 'O login não devolveu o código.'))
        return true
      }
      const olhar = (d) => { if (d.tabId === t.id && (d.frameId === undefined || d.frameId === 0)) processar(d.url) }
      const atualizou = (id, info, tab) => { if (id === t.id) processar(info.url || tab.url) }
      const fechou = (id) => { if (id === t.id) terminar(reject, new Error('fechada')) }
      const relogio = setTimeout(() => terminar(reject, new Error('O tempo para entrar acabou. Tente de novo.')), 15 * 60 * 1000)
      chrome.webNavigation.onBeforeNavigate.addListener(olhar)
      chrome.webNavigation.onCommitted.addListener(olhar)
      chrome.webNavigation.onErrorOccurred.addListener(olhar)
      chrome.tabs.onUpdated.addListener(atualizou)
      chrome.tabs.onRemoved.addListener(fechou)
    })
  },
  async estado() {
    return { texto: JSON.stringify(await estadoPublico()) }
  },
}

async function executarComando(socket, m) {
  const responder = (o) => { if (socket.readyState === 1) socket.send(JSON.stringify({ t: 'r', rid: m.rid, ...o })) }
  const c = await cfg()
  if (c.pausada) return responder({ ok: false, codigo: 'pausado', erro: 'A extensão está pausada.' })
  const f = FERRAMENTAS[m.acao]
  if (!f) return responder({ ok: false, codigo: 'desconhecida', erro: 'Ação desconhecida: ' + m.acao })
  agindo++; pintarIcone()
  try {
    const dado = await f(m.args || {})
    responder({ ok: true, dado })
  } catch (e) {
    responder({ ok: false, erro: String((e && e.message) || e) })
  } finally {
    agindo = Math.max(0, agindo - 1); pintarIcone()
  }
}

// ---------- mensagens do popup e da página do remoto ----------
chrome.runtime.onMessage.addListener((m, sender, responder) => {
  ;(async () => {
    if (m.t === 'estado') return responder(await estadoPublico())
    if (m.t === 'precisa_parear') { const c = await cfg(); return responder({ precisa: !c.token && !c.desligado, base: c.base }) }
    if (m.t === 'parear') { try { return responder({ ok: await registrar(m.token) }) } catch (e) { return responder({ ok: false, erro: String(e.message || e) }) } }
    if (m.t === 'pausar') { await chrome.storage.local.set({ pausada: !!m.valor }); enviarPonte({ t: 'estado', pausada: !!m.valor }); pintarIcone(); return responder(await estadoPublico()) }
    if (m.t === 'desconectar') { // o cliente desligou: nada de parear sozinho de novo até ele ligar
      await chrome.storage.local.set({ desligadoPeloUsuario: true })
      await chrome.storage.local.remove('token')
      try { ws && ws.close() } catch {}
      conectado = false; pintarIcone(); return responder(await estadoPublico())
    }
    if (m.t === 'religar') { await chrome.storage.local.set({ desligadoPeloUsuario: false }); await parearPeloApp(); return responder(await estadoPublico()) }
    responder(null)
  })()
  return true
})

// ---------- ciclo de vida ----------
chrome.alarms.create('vivo', { periodInMinutes: 0.5 })
chrome.alarms.onAlarm.addListener(() => { if (!conectado) conectar() })
chrome.runtime.onInstalled.addListener(async () => {
  await parearPeloApp()
  const c = await cfg()
  if (!c.token && !c.desligado) { try { await chrome.tabs.create({ url: c.base + '/?extensao=1' }) } catch {} } // sem app instalado: leva ao site para entrar uma vez
})
chrome.runtime.onStartup.addListener(async () => { await parearPeloApp(); conectar() })
conectar()
pintarIcone()
