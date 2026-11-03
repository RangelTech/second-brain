// Navegador integrado: uma vista nativa (WebContentsView) ao lado do chat, que o usuário vê e usa, e que o agente
// controla por ferramentas (servidor MCP em mcp-navegador.js -> este servidor HTTP local -> a vista).
// Sessão própria (partition "persist:navegador"): não compartilha cookies nem dados com o resto do app.
const { WebContentsView } = require('electron')
const http = require('http')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const MAX_TEXTO = 14000
const TEMPO_CARGA_MS = 35000

function criar({ app, janela, avisar, pedirPainel }) {
  const token = crypto.randomBytes(24).toString('hex')
  const pastaCaps = path.join(app.getPath('userData'), 'navegador-capturas')
  let vista = null
  let aberto = false // painel visível para o usuário
  let escondidoPorModal = false
  let limites = null
  let servidor = null
  let porta = 0
  let controlando = false
  let timerControle = null

  const estado = () => {
    const wc = vista?.webContents
    return {
      url: wc && !wc.isDestroyed() ? wc.getURL() : '',
      titulo: wc && !wc.isDestroyed() ? wc.getTitle() : '',
      carregando: !!wc && !wc.isDestroyed() && wc.isLoading(),
      podeVoltar: !!wc && !wc.isDestroyed() && wc.navigationHistory.canGoBack(),
      podeAvancar: !!wc && !wc.isDestroyed() && wc.navigationHistory.canGoForward(),
      controlando,
    }
  }
  const publicar = () => avisar(estado())

  function garantir() {
    if (vista) return vista
    vista = new WebContentsView({ webPreferences: { partition: 'persist:navegador', sandbox: true, contextIsolation: true, nodeIntegration: false } })
    const wc = vista.webContents
    wc.setWindowOpenHandler(({ url }) => {
      wc.loadURL(url).catch(() => {})
      return { action: 'deny' }
    })
    for (const ev of ['did-navigate', 'did-navigate-in-page', 'page-title-updated', 'did-start-loading', 'did-stop-loading']) wc.on(ev, publicar)
    wc.on('did-fail-load', (_e, codigo, desc, url, principal) => {
      if (principal && codigo !== -3) publicar()
    })
    return vista
  }

  function aplicar() {
    if (!vista || !janela()) return
    const visivel = aberto && !escondidoPorModal && limites
    const contem = janela().contentView.children.includes(vista)
    if (visivel) {
      if (!contem) janela().contentView.addChildView(vista)
      vista.setBounds({ x: Math.round(limites.x), y: Math.round(limites.y), width: Math.max(1, Math.round(limites.width)), height: Math.max(1, Math.round(limites.height)) })
    } else if (contem) janela().contentView.removeChildView(vista)
  }

  // o painel do app diz onde a vista deve ficar
  function definirLimites(l) {
    limites = l
    aplicar()
  }
  function mostrar(sim) {
    aberto = !!sim
    if (aberto) garantir()
    aplicar()
    publicar()
  }
  function esconderTemporario(sim) {
    escondidoPorModal = !!sim
    aplicar()
  }

  // garante painel aberto e com tamanho antes de o agente agir (precisa estar na tela para capturar)
  async function garantirVisivel() {
    garantir()
    if (!aberto) pedirPainel()
    const fim = Date.now() + 4000
    while (!(aberto && limites) && Date.now() < fim) await new Promise((r) => setTimeout(r, 100))
    if (!(aberto && limites)) {
      aberto = true
      limites = limites || { x: 700, y: 60, width: 540, height: 700 }
      aplicar()
    }
  }

  const marcarControle = () => {
    controlando = true
    publicar()
    clearTimeout(timerControle)
    timerControle = setTimeout(() => {
      controlando = false
      publicar()
    }, 4000)
  }

  const js = (codigo) => vista.webContents.executeJavaScript(codigo, true)
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

  async function carregar(url) {
    const wc = vista.webContents
    let u = String(url || '').trim()
    if (!u) throw new Error('Informe a URL.')
    if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u
    if (!/^https?:/i.test(u)) throw new Error('Só aceito endereços http e https.')
    await Promise.race([wc.loadURL(u).catch((e) => {
      if (!/ERR_ABORTED/.test(String(e))) throw e
    }), esperar(TEMPO_CARGA_MS).then(() => { throw new Error('A página demorou mais de 35 s para carregar.') })])
    await esperar(400)
  }

  // lista os elementos clicáveis e marca cada um com um id para o agente usar em navegador_clicar
  const SCRIPT_LER = `(() => {
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
      const texto = (e.innerText || e.value || e.placeholder || e.getAttribute('aria-label') || e.title || e.alt || '').replace(/\\s+/g, ' ').trim().slice(0, 80)
      lista.push({ id: n, tipo, texto, href: e.href && e.tagName === 'A' ? e.href.slice(0, 120) : undefined })
      if (n >= 90) break
    }
    return { titulo: document.title, url: location.href, texto: (document.body ? document.body.innerText : '').replace(/\\n{3,}/g, '\\n\\n').slice(0, ${MAX_TEXTO}), elementos: lista, rolagem: { y: Math.round(scrollY), altura: document.documentElement.scrollHeight, janela: innerHeight } }
  })()`

  const ferramentas = {
    async abrir({ url }) {
      await garantirVisivel()
      await carregar(url)
      return { texto: `Aberto: ${vista.webContents.getTitle() || '(sem título)'} — ${vista.webContents.getURL()}` }
    },
    async ler() {
      await garantirVisivel()
      const r = await js(SCRIPT_LER)
      const els = r.elementos.map((e) => `[${e.id}] ${e.tipo}${e.texto ? ' "' + e.texto + '"' : ''}${e.href ? ' → ' + e.href : ''}`).join('\n')
      return { texto: `Título: ${r.titulo}\nURL: ${r.url}\nRolagem: ${r.rolagem.y}/${r.rolagem.altura} (janela ${r.rolagem.janela})\n\n--- TEXTO DA PÁGINA ---\n${r.texto}\n\n--- ELEMENTOS CLICÁVEIS (use o número em navegador_clicar e navegador_digitar) ---\n${els || '(nenhum)'}` }
    },
    async clicar({ id, x, y }) {
      await garantirVisivel()
      const wc = vista.webContents
      if (id !== undefined && id !== null) {
        const r = await js(`(() => { const e = document.querySelector('[data-sb-id="${Number(id)}"]'); if (!e) return { ok: false }; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { ok: true, x: b.left + b.width / 2, y: b.top + b.height / 2, tag: e.tagName } })()`)
        if (!r.ok) throw new Error(`Elemento ${id} não existe mais. Rode navegador_ler de novo para atualizar os ids.`)
        await esperar(150)
        x = r.x
        y = r.y
      }
      if (typeof x !== 'number' || typeof y !== 'number') throw new Error('Informe id (de navegador_ler) ou x e y.')
      wc.sendInputEvent({ type: 'mouseMove', x: Math.round(x), y: Math.round(y) })
      wc.sendInputEvent({ type: 'mouseDown', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 })
      wc.sendInputEvent({ type: 'mouseUp', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 })
      await esperar(900)
      return { texto: `Cliquei em (${Math.round(x)}, ${Math.round(y)}). Agora em: ${wc.getURL()}` }
    },
    async digitar({ id, texto, enter }) {
      await garantirVisivel()
      const wc = vista.webContents
      if (id !== undefined && id !== null) {
        const ok = await js(`(() => { const e = document.querySelector('[data-sb-id="${Number(id)}"]'); if (!e) return false; e.scrollIntoView({ block: 'center' }); e.focus(); if (e.select) e.select(); return true })()`)
        if (!ok) throw new Error(`Elemento ${id} não existe mais. Rode navegador_ler de novo.`)
      }
      await wc.insertText(String(texto ?? ''))
      if (enter) {
        for (const tipo of ['keyDown', 'char', 'keyUp']) wc.sendInputEvent({ type: tipo, keyCode: 'Return' })
        await esperar(900)
      }
      return { texto: `Digitei ${String(texto ?? '').length} caracteres${enter ? ' e apertei Enter' : ''}.` }
    },
    async rolar({ direcao, pixels }) {
      await garantirVisivel()
      const d = String(direcao || 'baixo')
      const px = Number(pixels) || 600
      const r = await js(`(() => { const d = ${JSON.stringify(d)}; const px = ${px}; if (d === 'topo') scrollTo(0, 0); else if (d === 'fim') scrollTo(0, document.documentElement.scrollHeight); else scrollBy(0, d === 'cima' ? -px : px); return { y: Math.round(scrollY), altura: document.documentElement.scrollHeight } })()`)
      await esperar(300)
      return { texto: `Rolagem em ${r.y} de ${r.altura}.` }
    },
    async voltar() {
      await garantirVisivel()
      const wc = vista.webContents
      if (wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
      await esperar(900)
      return { texto: `Voltei para ${wc.getURL()}` }
    },
    async esperar({ ms }) {
      await esperar(Math.min(Number(ms) || 1000, 15000))
      return { texto: 'Esperei.' }
    },
    async js({ codigo }) {
      await garantirVisivel()
      const r = await js(`(async () => { ${String(codigo)} })()`)
      return { texto: typeof r === 'string' ? r.slice(0, 6000) : JSON.stringify(r)?.slice(0, 6000) ?? 'undefined' }
    },
    async print() {
      await garantirVisivel()
      await esperar(300)
      let img = await vista.webContents.capturePage()
      if (img.isEmpty()) throw new Error('A captura veio vazia (o painel precisa estar visível).')
      const tam = img.getSize()
      if (tam.width > 1280) img = img.resize({ width: 1280 })
      fs.mkdirSync(pastaCaps, { recursive: true })
      const arq = path.join(pastaCaps, `captura-${Date.now()}.png`)
      const png = img.toPNG()
      fs.writeFileSync(arq, png)
      return { texto: `Captura salva em ${arq} (${img.getSize().width}x${img.getSize().height}). Use vision_analyze nesse caminho para olhar a imagem.`, imagem: png.toString('base64'), arquivo: arq }
    },
  }

  async function atender(nome, args) {
    const f = ferramentas[nome]
    if (!f) throw new Error('Ferramenta desconhecida: ' + nome)
    marcarControle()
    try {
      return await f(args || {})
    } finally {
      marcarControle()
    }
  }

  function iniciarServidor() {
    return new Promise((resolve) => {
      servidor = http.createServer((req, res) => {
        if (req.method !== 'POST' || req.headers.authorization !== 'Bearer ' + token) return res.writeHead(401).end()
        let corpo = ''
        req.on('data', (d) => (corpo += d))
        req.on('end', async () => {
          try {
            const { nome, args } = JSON.parse(corpo)
            const r = await atender(nome, args)
            res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, ...r }))
          } catch (e) {
            res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, erro: String(e.message || e) }))
          }
        })
      })
      servidor.listen(0, '127.0.0.1', () => {
        porta = servidor.address().port
        resolve({ url: `http://127.0.0.1:${porta}`, token })
      })
    })
  }

  return {
    iniciarServidor,
    estado,
    definirLimites,
    mostrar,
    esconderTemporario,
    atender,
    acao: async (acao, url) => {
      garantir()
      const wc = vista.webContents
      if (acao === 'ir') await carregar(url)
      else if (acao === 'voltar' && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
      else if (acao === 'avancar' && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward()
      else if (acao === 'recarregar') wc.reload()
      publicar()
    },
    fechar() {
      try {
        servidor?.close()
        if (vista && !vista.webContents.isDestroyed()) vista.webContents.close()
      } catch {}
    },
  }
}

module.exports = { criar }
