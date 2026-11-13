// Navegador integrado: uma vista nativa (WebContentsView) ao lado do chat, que o usuário vê e usa, e que o agente
// controla por ferramentas (servidor MCP em mcp-navegador.js -> este servidor HTTP local -> a vista).
// Sessão própria (partition "persist:navegador"): não compartilha cookies nem dados com o resto do app.
const { WebContentsView, BrowserWindow } = require('electron')
const http = require('http')

const PAGINA_INICIAL = 'https://www.google.com/?hl=pt-BR'
// o que o usuário digita na barra: endereço vira endereço; qualquer outra coisa vira busca no Google
function resolverEntrada(entrada) {
  const u = String(entrada || '').trim()
  if (/^https?:\/\//i.test(u)) return u
  if (/^[a-z][a-z0-9+.-]*:/i.test(u) && !/^[^\s:]+:\d+(\/|$)/.test(u)) return u // outro esquema (file:, javascript:...) é recusado adiante
  const pareceEndereco = !/\s/.test(u) && (/^localhost(:\d+)?(\/|$)/i.test(u) || /^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/|$)/.test(u) || /^[^\s/]+\.[a-z]{2,}(:\d+)?([/?#].*)?$/i.test(u))
  if (pareceEndereco) return (/^localhost|^\d/.test(u) ? 'http://' : 'https://') + u
  return 'https://www.google.com/search?q=' + encodeURIComponent(u)
}
// O user-agent padrão do Electron traz "Electron/x.y.z" e o nome do app: Instagram e outros sites barram isso com "4xx Client Error".
// Para os sites o navegador integrado tem de se apresentar como o Chrome comum da mesma versão do Chromium embutido
// (mesmo formato reduzido que o Chrome usa: versão principal com ".0.0.0").
function userAgentChrome(plataforma = process.platform, versaoChromium = (process.versions && process.versions.chrome) || '140.0.0.0') {
  const so = plataforma === 'darwin' ? 'Macintosh; Intel Mac OS X 10_15_7' : plataforma === 'linux' ? 'X11; Linux x86_64' : 'Windows NT 10.0; Win64; x64'
  const principal = String(versaoChromium).split('.')[0] || '140'
  return `Mozilla/5.0 (${so}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${principal}.0.0.0 Safari/537.36`
}
const IDIOMAS = 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const MAX_TEXTO = 14000
const TEMPO_CARGA_MS = 35000

const LINK_EXTENSAO = 'https://brain.rangeltech.net/extensao/'
// falhas de TRANSPORTE da extensão (nada chegou a rodar no Chrome); erro da própria ferramenta (elemento sumiu) não entra aqui
const FALHAS_TRANSPORTE = new Set(['sem_extensao', 'pausado', 'desconectada', 'timeout'])

function criar({ app, janela, avisar, pedirPainel, extensao = () => null, modoServidor = false, editor = null, motion = null, preload = '', avisarDestacada = () => {} }) {
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

  // janela destacada (Spec 25): o navegador sai do painel e ganha uma janela própria, grande, com a barra de endereço no topo. A vista nativa é a MESMA
  // (mesma sessão, mesmas abas, o agente continua controlando); só muda em qual janela ela está encaixada.
  const BARRA_DESTACADA = 48
  let destacada = null
  const alvo = () => (destacada && !destacada.isDestroyed() ? destacada : janela())
  function limitesDestacada() {
    const b = destacada.getContentBounds()
    return { x: 0, y: BARRA_DESTACADA, width: Math.max(1, b.width), height: Math.max(1, b.height - BARRA_DESTACADA) }
  }
  function destacar() {
    if (destacada && !destacada.isDestroyed()) { destacada.focus(); return { ok: true } }
    garantir()
    const principal = janela()
    // sai do painel da janela principal
    if (principal && principal.contentView.children.includes(vista)) principal.contentView.removeChildView(vista)
    aberto = true
    destacada = new BrowserWindow({
      width: 1180, height: 820, minWidth: 520, minHeight: 360, backgroundColor: '#16120f', autoHideMenuBar: true, title: 'Navegador do Segundo Cérebro',
      webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: false },
    })
    const w = destacada
    w.loadFile(path.join(__dirname, 'renderer', 'nav-destacado.html'))
    const ajustar = () => { if (!w.isDestroyed()) aplicar() }
    for (const ev of ['resize', 'maximize', 'unmaximize', 'restore', 'enter-full-screen', 'leave-full-screen']) w.on(ev, ajustar)
    w.on('closed', () => {
      if (destacada !== w) return
      destacada = null
      aberto = false // fechou a janela: o navegador fica guardado (a mesma vista, sem perder a página); o painel reabre quando alguém pedir
      try { if (vista && !vista.webContents.isDestroyed() && janela()?.contentView.children.includes(vista)) janela().contentView.removeChildView(vista) } catch {}
      publicar()
      avisarDestacada(false)
    })
    w.webContents.once('did-finish-load', () => { ajustar(); publicar() })
    avisarDestacada(true)
    setTimeout(ajustar, 50)
    return { ok: true }
  }
  function reencaixar() {
    const w = destacada
    destacada = null
    try { if (w && !w.isDestroyed()) { if (vista && w.contentView.children.includes(vista)) w.contentView.removeChildView(vista); w.close() } } catch {}
    avisarDestacada(false)
    pedirPainel() // a tela principal abre o painel de novo, com a mesma vista
    return { ok: true }
  }
  const estaDestacado = () => !!(destacada && !destacada.isDestroyed())

  const estado = () => {
    const wc = vista?.webContents
    return {
      url: wc && !wc.isDestroyed() ? wc.getURL() : '',
      titulo: wc && !wc.isDestroyed() ? wc.getTitle() : '',
      carregando: !!wc && !wc.isDestroyed() && wc.isLoading(),
      podeVoltar: !!wc && !wc.isDestroyed() && wc.navigationHistory.canGoBack(),
      podeAvancar: !!wc && !wc.isDestroyed() && wc.navigationHistory.canGoForward(),
      controlando,
      destacado: estaDestacado(),
    }
  }
  const publicar = () => { avisar(estado()); try { if (estaDestacado()) destacada.webContents.send('navegador:estado', estado()) } catch {} }

  function garantir() {
    if (vista) return vista
    vista = new WebContentsView({ webPreferences: { partition: 'persist:navegador', sandbox: true, contextIsolation: true, nodeIntegration: false } })
    const wc = vista.webContents
    // antes de qualquer carga: o primeiro pedido já sai com o user-agent e o idioma de um Chrome comum
    const ua = userAgentChrome()
    wc.setUserAgent(ua)
    wc.session.setUserAgent(ua, IDIOMAS)
    wc.loadURL(PAGINA_INICIAL).catch(() => {})
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
    const j = alvo()
    if (!vista || !j) return
    if (estaDestacado()) { // na janela própria a vista ocupa tudo abaixo da barra, sem depender do painel da janela principal
      const l = limitesDestacada()
      if (!j.contentView.children.includes(vista)) j.contentView.addChildView(vista)
      vista.setBounds({ x: l.x, y: l.y, width: l.width, height: l.height })
      return
    }
    const visivel = aberto && !escondidoPorModal && limites
    const contem = j.contentView.children.includes(vista)
    if (visivel) {
      if (!contem) j.contentView.addChildView(vista)
      vista.setBounds({ x: Math.round(limites.x), y: Math.round(limites.y), width: Math.max(1, Math.round(limites.width)), height: Math.max(1, Math.round(limites.height)) })
    } else if (contem) j.contentView.removeChildView(vista)
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
    if (estaDestacado()) { aplicar(); return }
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
    u = resolverEntrada(u)
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

  // ---- Chrome do usuário (extensão): mesma lista de ferramentas, executada no Chrome dele, com as sessões que ele já tem
  function salvarCaptura(png64) {
    fs.mkdirSync(pastaCaps, { recursive: true })
    const arq = path.join(pastaCaps, `captura-${Date.now()}.png`)
    fs.writeFileSync(arq, Buffer.from(png64, 'base64'))
    return arq
  }
  async function viaExtensao(nome, args) {
    const ext = extensao()
    if (!ext) return { falhou: 'sem_extensao', erro: 'Extensão indisponível.' }
    const a = { ...args }
    delete a.onde
    if (nome === 'abrir') a.url = resolverEntrada(a.url)
    const r = await ext.executar(nome, a, nome === 'abrir' ? 45000 : 30000)
    if (r.ok) {
      const d = r.dado || {}
      if (d.imagem) {
        const arq = salvarCaptura(d.imagem)
        return { texto: `Captura salva em ${arq} (${d.largura || '?'}x${d.altura || '?'}). Use vision_analyze nesse caminho para olhar a imagem.`, imagem: d.imagem, arquivo: arq }
      }
      return d
    }
    if (FALHAS_TRANSPORTE.has(r.codigo)) return { falhou: r.codigo, erro: r.erro }
    throw new Error(r.erro || 'A extensão do Chrome falhou.')
  }
  function textoSemChrome(falhou) {
    const motivo = falhou === 'pausado' ? 'A extensão do Chrome está pausada pelo usuário.' : falhou === 'timeout' ? 'O Chrome do usuário não respondeu a tempo.' : 'Não há Chrome conectado ao Segundo Cérebro.'
    return `${motivo} Para usar o Chrome do usuário (com as contas dele já abertas), ele precisa instalar a extensão e conectar: ${LINK_EXTENSAO} (baixar, abrir chrome://extensions, ligar o Modo do desenvolvedor, Carregar sem compactação e clicar em Entrar no ícone). Mande esse link ao usuário. Se ele preferir, use o navegador integrado repetindo a ferramenta com onde="integrado".`
  }
  const estadoChrome = () => {
    const ext = extensao()
    const e = ext ? ext.estado() : { conectado: false }
    return { texto: JSON.stringify({ chrome_conectado: !!e.conectado, pausado: !!e.pausada, nome: e.nome || '', acesso_web_ligado: !!e.acessoWeb, onde_padrao: modoServidor ? 'chrome' : 'integrado', link_extensao: LINK_EXTENSAO }) }
  }

  // onde roda cada ferramenta (spec 25 §7.12): no APP instalado o padrão é o navegador integrado (o usuário só vai para o Chrome dele se pedir,
  // com onde="chrome"); na WEB/VM o padrão é sempre a extensão. Só falha de transporte da extensão pode cair no integrado, e só no modo "auto" do app.
  async function atender(nome, args) {
    args = args || {}
    if (nome.startsWith('editor_') && editor) return editor(nome.slice(7), args) // ferramentas do app para o editor de vídeo (mcp-editor.js)
    if (nome.startsWith('motion_') && motion) return motion(nome.slice(7), args) // Motion desenhado: HTML vira MP4 (mcp-motion.js)
    if (nome === 'chrome_estado') return estadoChrome()
    const onde = ['integrado', 'chrome'].includes(args.onde) ? args.onde : 'auto'
    const querChrome = nome !== 'esperar' && (onde === 'chrome' || (onde === 'auto' && modoServidor))
    if (querChrome) {
      marcarControle()
      try {
        const r = await viaExtensao(nome, args)
        if (!r.falhou) return r
        throw new Error(textoSemChrome(r.falhou))
      } finally {
        marcarControle()
      }
    }
    const f = ferramentas[nome]
    if (!f) throw new Error('Ferramenta desconhecida: ' + nome)
    marcarControle()
    try {
      return await f(args)
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
    destacar,
    reencaixar,
    estaDestacado,
    viaExtensao,
    // painel da versão web: captura leve (JPEG) da página e entradas diretas do usuário (não marca "controle do agente")
    async captura() {
      garantir()
      const wc = vista.webContents
      let img = await wc.capturePage()
      if (img.isEmpty()) return null
      const real = img.getSize()
      if (real.width > 1280) img = img.resize({ width: 1280 })
      const t = img.getSize()
      return { base64: img.toJPEG(72).toString('base64'), largura: real.width, altura: real.height, w: t.width, h: t.height, url: wc.getURL() }
    },
    clicarPonto(x, y) {
      garantir()
      const wc = vista.webContents
      const px = Math.round(Number(x) || 0)
      const py = Math.round(Number(y) || 0)
      wc.sendInputEvent({ type: 'mouseMove', x: px, y: py })
      wc.sendInputEvent({ type: 'mouseDown', x: px, y: py, button: 'left', clickCount: 1 })
      wc.sendInputEvent({ type: 'mouseUp', x: px, y: py, button: 'left', clickCount: 1 })
    },
    async digitarTexto(texto) {
      garantir()
      await vista.webContents.insertText(String(texto ?? '').slice(0, 2000))
    },
    teclaEspecial(codigo) {
      garantir()
      if (!/^(Enter|Backspace|Tab|Escape|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Delete|Home|End|PageUp|PageDown)$/.test(codigo)) return
      const kc = codigo === 'Enter' ? 'Return' : codigo.startsWith('Arrow') ? codigo.slice(5) : codigo
      for (const tipo of codigo === 'Enter' ? ['keyDown', 'char', 'keyUp'] : ['keyDown', 'keyUp']) vista.webContents.sendInputEvent({ type: tipo, keyCode: kc })
    },
    rolarPonto(dy, x, y) {
      garantir()
      vista.webContents.sendInputEvent({ type: 'mouseWheel', x: Math.round(Number(x) || 200), y: Math.round(Number(y) || 200), deltaX: 0, deltaY: -Math.round(Number(dy) || 0) })
    },
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

// ---------- favoritos (importados do navegador principal; só marcadores, nunca senhas nem cookies) ----------
function achatar(no, pasta, saida) {
  if (!no) return
  if (no.type === 'url' && /^https?:/i.test(no.url || '')) saida.push({ titulo: no.name || no.url, url: no.url, pasta })
  for (const f of no.children || []) achatar(f, no.type === 'folder' && no.name ? (pasta ? pasta + ' / ' : '') + no.name : pasta, saida)
}
function lerMarcadoresDoNavegador() {
  const local = process.env.LOCALAPPDATA || ''
  const origens = [
    ['Chrome', path.join(local, 'Google', 'Chrome', 'User Data')],
    ['Edge', path.join(local, 'Microsoft', 'Edge', 'User Data')],
    ['Brave', path.join(local, 'BraveSoftware', 'Brave-Browser', 'User Data')],
  ]
  const saida = []
  for (const [nome, raiz] of origens) {
    let perfis = []
    try {
      perfis = fs.readdirSync(raiz).filter((d) => d === 'Default' || /^Profile \d+$/.test(d))
    } catch {}
    for (const perfil of perfis) {
      try {
        const j = JSON.parse(fs.readFileSync(path.join(raiz, perfil, 'Bookmarks'), 'utf8'))
        const lista = []
        for (const r of Object.values(j.roots || {})) achatar(r, '', lista)
        for (const f of lista) saida.push({ ...f, origem: nome })
      } catch {}
    }
  }
  return saida
}

module.exports = { criar, lerMarcadoresDoNavegador, resolverEntrada, userAgentChrome, PAGINA_INICIAL }
