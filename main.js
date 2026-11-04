// Segundo Cérebro (Rangel Tech): janela de chat, agente e ponte para o motor de provedores.
const { app, BrowserWindow, ipcMain, safeStorage, shell, dialog, session } = require('electron')

// Sem identidade própria o Windows agrupa o app com o Electron e mostra o ícone do .exe (o átomo) na barra de tarefas.
// Com o AppUserModelID próprio e o .ico (vários tamanhos), a barra usa a logo do Segundo Cérebro, instalado ou em desenvolvimento.
if (process.platform === 'win32') app.setAppUserModelId('net.rangeltech.secondbrain')
function iconeDoApp() {
  const fs = require('fs')
  const nomes = process.platform === 'win32' ? ['icon.ico', 'icon.png'] : ['icon.png']
  for (const base of [process.resourcesPath || '', path.join(__dirname, 'build')]) for (const n of nomes) if (base && fs.existsSync(path.join(base, n))) return path.join(base, n)
  return undefined
}
// registro dos handlers: o acesso web chama os mesmos canais da interface instalada
const handlersIpc = new Map()
{
  const handleOriginal = ipcMain.handle.bind(ipcMain)
  ipcMain.handle = (canal, fn) => (handlersIpc.set(canal, fn), handleOriginal(canal, fn))
}
// modo servidor (VM sem tela): janela escondida, acesso web ligado, sem depender de monitor
const MODO_SERVIDOR = process.argv.includes('--servidor') || process.env.SB_SERVIDOR === '1'
const embed = require('./embed-router')
const { Sessao, prepararBase, registrar: registrarAgente } = require('./agent')
const skillsMod = require('./skills')
const remotoMod = require('./remoto')
const skillsRepoMod = require('./skills-repo')
const unlimitedMod = require('./unlimited')
const navegadorMod = require('./navegador')
const path = require('path')
const fs = require('fs')

// janela encoberta não pode congelar a interface (testes e uso em segundo plano)
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
// pasta de dados sem acento (o Python do agente vive dentro dela)
app.setPath('userData', process.env.SB_DATA_DIR || path.join(app.getPath('appData'), 'SegundoCerebro'))
// um erro inesperado em segundo plano vai para o log; não abre a caixa de erro do Electron
process.on('uncaughtException', (e) => {
  try {
    require('fs').appendFileSync(path.join(app.getPath('userData'), 'erros.log'), new Date().toISOString() + ' ' + (e && e.stack || e) + '\n')
  } catch {}
})
const HOME = app.getPath('home')
const PADRAO = {
  ativo: '',
  soConversa: false,
  modoPermissao: 'manual', // manual | editar | auto | ignorar
  raciocinio: 'none',
  pasta: path.join(app.getPath('documents'), 'Segundo Cerebro'),
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
  if (!cfg.raciocinioV2) {
    cfg.raciocinio = 'none'
    cfg.raciocinioV2 = true
  }
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
  const r = await embed.api('POST', '/api/keys', { name: 'Segundo Cérebro (local)' })
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
// Ponte entre o Hermes e o roteador: repassa tudo e conta o que o modelo já gerou, para a tela mostrar progresso de verdade
const ponteLLM = require('./ponte-llm').criar({
  destino: () => embed.estado().origem,
  aoProgresso: (chat, info) => sessoes.get(chat)?.emitir?.({ progresso: info }),
  registrar: (linha) => registrarAgente(app, linha),
})
let navInfo = null // { url, token } do servidor local do navegador integrado
let nav = null
let remoto = null // acesso web remoto (spec 21 §12)
// API de imagens do servidor (Unlimited): usa a mesma chave do chat; sem chave (cadastro pendente) a ferramenta some
function midiaDoApp() {
  try {
    const c = cfg.unlimitedChave
    if (process.env.SB_MIDIA_CHAVE) return { base: (process.env.SB_UNLIMITED_BASE || 'https://qwen.rangeltech.net/v1').replace(/\/+$/, ''), chave: process.env.SB_MIDIA_CHAVE } // so para teste
    if (!c || !cfg.unlimitedLigado) return null
    return { base: (process.env.SB_UNLIMITED_BASE || 'https://qwen.rangeltech.net/v1').replace(/\/+$/, ''), chave: decifrar(c) }
  } catch {
    return null
  }
}
async function sessaoDoChat(id, alvo, contexto, historico) {
  const est = embed.estado()
  const existente = sessoes.get(id)
  if (existente && !existente.morto && existente.modelo === alvo && existente.pasta === cfg.pasta && existente.racio === cfg.raciocinio) return existente
  existente?.encerrar()
  fs.mkdirSync(cfg.pasta, { recursive: true })
  await ponteLLM.iniciar()
  const sessao = new Sessao({ app, id, pasta: cfg.pasta, base: ponteLLM.origem() + '/v1', modelo: alvo, chave: (await chaveLocal()) + require('./ponte-llm').SEP + id, raciocinio: cfg.raciocinio, emitir: contexto.onDelta, pedirPermissao: contexto.pedirPermissao, modo: () => cfg.modoPermissao || 'manual', navegador: navInfo, midia: midiaDoApp(), memoria: { arquivo: path.join(app.getPath('userData'), 'chats.json') } })
  sessao.modelo = alvo
  sessao.racio = cfg.raciocinio
  sessao.historico = historico
  sessoes.set(id, sessao)
  return sessao
}
async function responder(alvo, msgs, ctx) {
  if (!cfg.unlimitedEmail) throw new Error('Entre na sua conta para usar o Segundo Cérebro.') // vale também para as ordens vindas do celular
  const est = embed.estado()
  if (!est.pronto) throw new Error(est.erro || 'O motor de provedores ainda está iniciando. Tente de novo em instantes.')
  if (!alvo) throw new Error('Escolha um modelo ou combo no topo do chat (cadastre um provedor em Configurações > Provedores).')
  if (cfg.soConversa) {
    const chave = await chaveLocal()
    return chamarOpenAI({ nome: 'Segundo Cérebro', base: est.origem + '/v1', modelo: alvo, chave: cifrar(chave) }, msgs, ctx)
  }
  // se o agente precisar recomeçar (raciocínio ou modelo mudou), o novo recebe um resumo das últimas mensagens
  const ultimo = [...msgs].reverse().find((m) => m.role === 'user')?.content ?? ''
  const anteriores = msgs.slice(0, -1).slice(-10)
  const linhaHist = (m) => (m.role === 'user' ? 'Usuário' : 'Assistente') + ': ' + String(m.content).slice(0, 700)
  const historico = anteriores.map(linhaHist).join(String.fromCharCode(10))
  const sessao = await sessaoDoChat(ctx.chat, alvo, ctx, historico)
  sessao.emitir = ctx.onDelta // cada mensagem tem o seu canal de resposta e de permissão
  sessao.pedirPermissao = ctx.pedirPermissao
  ctx.sinal?.addEventListener('abort', () => sessao.cancelar())
  const r = await sessao.perguntar(ultimo, ctx.anexos || [])
  ctx.uso = r?.usage || null
  return ''
}

// ---------- modelos para o seletor do chat ----------
async function listarModelos() {
  const saida = []
  const combos = await embed.api('GET', '/api/combos')
  for (const c of combos.json?.combos ?? []) if (!c.kind || c.kind === 'llm') saida.push({ id: c.name, nome: c.name, grupo: 'Combos', sub: `${(c.models || []).length} modelo${(c.models || []).length === 1 ? '' : 's'}` })
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
      saida.push({ id: 'unl/qwen-abliterated', nome: 'Unlimited', grupo: 'Modelos', provedor: c.provider, logo: 'unlimited', sub: 'IA da casa' })
      continue
    }
    const r = await embed.api('GET', `/api/providers/${c.id}/models`)
    const lista = Array.isArray(r.json?.models) ? r.json.models : []
    for (const m of lista) {
      const id = typeof m === 'string' ? m : m.id || m.name
      if (id) saida.push({ id: `${no.prefix}/${id}`, nome: `${id}`, grupo: 'Modelos', provedor: c.provider, sub: no.name })
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
    center: true,
    height: 800,
    minWidth: 760,
    minHeight: 520,
    backgroundColor: '#1f1d1a',
    title: 'Segundo Cérebro',
    show: !MODO_SERVIDOR,
    icon: iconeDoApp(),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  })
  janela.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  // eventos de estado do app também vão para quem está na versão web
  const enviarOriginal = janela.webContents.send.bind(janela.webContents)
  janela.webContents.send = (canal, ...a) => (remoto?.espelhar(canal, a[0]), enviarOriginal(canal, ...a))
  janela.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

if (MODO_SERVIDOR) app.disableHardwareAcceleration()
app.whenReady().then(() => {
  carregarCfg()
  // VM provisionada pela automação: a conta chega por variável de ambiente (a chave é cifrada e a variável pode ser apagada depois)
  if (MODO_SERVIDOR && process.env.SB_CONTA_EMAIL && process.env.SB_CONTA_CHAVE && !cfg.unlimitedChave) {
    cfg.unlimitedEmail = process.env.SB_CONTA_EMAIL
    cfg.unlimitedChave = cifrar(process.env.SB_CONTA_CHAVE)
    salvarCfg()
  }
  session.defaultSession.setPermissionRequestHandler((_wc, permissao, cb) => cb(['media', 'clipboard-read'].includes(permissao)))
  criarJanela()
  nav = navegadorMod.criar({
    app,
    janela: () => janela,
    avisar: (e) => janela?.webContents.send('navegador:estado', e),
    pedirPainel: () => janela?.webContents.send('navegador:abrir-painel'),
  })
  nav.iniciarServidor().then((i) => (navInfo = i))
  ipcMain.handle('navegador:limites', (_e, l) => nav.definirLimites(l))
  ipcMain.handle('navegador:mostrar', (_e, sim) => nav.mostrar(sim))
  ipcMain.handle('navegador:esconder-temp', (_e, sim) => nav.esconderTemporario(sim))
  ipcMain.handle('navegador:acao', (_e, { acao, url }) => nav.acao(acao, url).then(() => ({ ok: true })).catch((err) => ({ ok: false, erro: String(err.message || err) })))
  ipcMain.handle('navegador:estado', () => nav.estado())
  // Modelo de voz do ditado (Vosk, português, ~32 MB): baixa uma vez e fica em disco; depois funciona sem internet.
  const modeloEmbutido = () => [path.join(process.resourcesPath || '', 'app.asar.unpacked', 'renderer', 'vendor', 'vosk-model-pt.tar.gz'), path.join(__dirname, 'renderer', 'vendor', 'vosk-model-pt.tar.gz')].find((f) => fs.existsSync(f))
  // Whisper (ditado preciso, no próprio computador): thread separada, um trecho por vez
  const pastaWhisper = () => [path.join(process.resourcesPath || '', 'modelos'), path.join(__dirname, 'modelos')].find((d) => fs.existsSync(path.join(d, 'whisper-small', 'onnx')))
  let wk = null
  let wkSeq = 0
  const wkPend = new Map()
  const whisperWorker = () => {
    if (wk) return wk
    const { Worker } = require('worker_threads')
    const arq = [path.join(process.resourcesPath || '', 'app.asar.unpacked', 'transcricao-worker.js'), path.join(__dirname, 'transcricao-worker.js')].find((f) => fs.existsSync(f))
    wk = new Worker(arq, { workerData: { pasta: pastaWhisper(), modelo: 'whisper-small' } })
    wk.on('message', (r) => {
      const p = wkPend.get(r.id)
      if (p) (wkPend.delete(r.id), p(r))
    })
    wk.on('error', (e) => {
      for (const p of wkPend.values()) p({ ok: false, erro: String(e.message || e) })
      wkPend.clear()
      wk = null
    })
    wk.on('exit', () => (wk = null))
    return wk
  }
  const whisperChamar = (m, transfer) => new Promise((res) => {
    const id = ++wkSeq
    wkPend.set(id, res)
    setTimeout(() => wkPend.has(id) && (wkPend.delete(id), res({ ok: false, erro: 'prazo' })), 60000)
    whisperWorker().postMessage({ ...m, id }, transfer || [])
  })
  ipcMain.handle('ditado:whisper-pronto', () => !!pastaWhisper())
  ipcMain.handle('ditado:whisper-aquecer', () => (pastaWhisper() ? whisperChamar({ tipo: 'aquecer' }) : { ok: false }))
  ipcMain.handle('ditado:whisper', async (_e, ab) => {
    if (!pastaWhisper()) return { ok: false, erro: 'modelo ausente' }
    const f = new Float32Array(ab.buffer ? ab.buffer.slice(ab.byteOffset, ab.byteOffset + ab.byteLength) : ab)
    return whisperChamar({ pcm: f.buffer }, [f.buffer])
  })
  ipcMain.handle('ditado:embutido', () => !!modeloEmbutido())
  ipcMain.handle('ditado:modelo', async () => {
    if (modeloEmbutido()) return fs.readFileSync(modeloEmbutido()) // já vem com o app: nada para baixar
    const dir = path.join(app.getPath('userData'), 'modelos')
    const arq = path.join(dir, 'vosk-model-small-pt-0.3.tar.gz')
    if (!fs.existsSync(arq)) {
      fs.mkdirSync(dir, { recursive: true })
      const r = await fetch('https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-pt-0.3.tar.gz', { signal: AbortSignal.timeout(300000) })
      if (!r.ok) throw new Error('Não consegui baixar o modelo de voz (' + r.status + ').')
      const bytes = Buffer.from(await r.arrayBuffer())
      if (bytes.length < 20e6) throw new Error('O download do modelo de voz veio incompleto.')
      fs.writeFileSync(arq + '.parte', bytes)
      fs.renameSync(arq + '.parte', arq)
    }
    return fs.readFileSync(arq)
  })
  ipcMain.handle('navegador:favoritos', () => ler('favoritos.json', []))
  ipcMain.handle('navegador:importar-favoritos', () => {
    const atuais = ler('favoritos.json', [])
    const vistos = new Set(atuais.map((f) => f.url))
    let novos = 0
    for (const f of navegadorMod.lerMarcadoresDoNavegador()) {
      if (vistos.has(f.url)) continue
      vistos.add(f.url)
      atuais.push(f)
      novos++
    }
    gravar('favoritos.json', atuais)
    return { total: atuais.length, novos }
  })
  ipcMain.handle('navegador:favoritar', (_e, f) => {
    const atuais = ler('favoritos.json', [])
    const i = atuais.findIndex((x) => x.url === f.url)
    if (i >= 0) atuais.splice(i, 1)
    else if (/^https?:/i.test(f.url)) atuais.unshift({ titulo: f.titulo || f.url, url: f.url, pasta: '', origem: 'Segundo Cérebro' })
    gravar('favoritos.json', atuais)
    return atuais
  })
  if (app.isPackaged) {
    try {
      const { autoUpdater } = require('electron-updater')
      autoUpdater.autoDownload = true
      autoUpdater.checkForUpdatesAndNotify().catch(() => {})
    } catch {}
  }
  prepararBase(app)
  const unl = unlimitedMod.criar({
    app,
    cfgGet: () => cfg,
    cfgSet: (p) => {
      Object.assign(cfg, p)
      salvarCfg()
    },
    cifrar,
    decifrar,
    embed,
    avisar: (e) => {
      janela?.webContents.send('unlimited:estado', e)
      if (e.fase === 'ativo') remoto?.religar()
    },
  })
  ipcMain.handle('unlimited:estado', () => unl.estado())
  ipcMain.handle('unlimited:recusar', () => unl.recusar())
  ipcMain.handle('unlimited:entrar', (_e, { email, senha }) => unl.entrar(email, senha))
  ipcMain.handle('unlimited:esqueci', (_e, email) => unl.esqueci(email))
  ipcMain.handle('unlimited:sair', () => unl.sair())
  // Uso da assinatura: janelas de 5 horas e da semana, medidas pelo servidor para a chave desta conta
  ipcMain.handle('conta:uso', async () => {
    try {
      if (!cfg.unlimitedEmail || !cfg.unlimitedChave) return { ok: false, erro: 'Entre na sua conta.' }
      const r = await fetch((process.env.SB_UNLIMITED_BASE || 'https://qwen.rangeltech.net/v1').replace(/\/+$/, '') + '/usage', { headers: { Authorization: 'Bearer ' + decifrar(cfg.unlimitedChave) }, signal: AbortSignal.timeout(15000) })
      if (!r.ok) return { ok: false, erro: `O servidor respondeu ${r.status}.` }
      return { ok: true, email: cfg.unlimitedEmail, plano: cfg.unlimitedPlano || '', ...(await r.json()) }
    } catch (e) {
      return { ok: false, erro: 'Sem conexão com o servidor.' }
    }
  })
  const skills = skillsMod.criar({ app, avisar: (d) => janela?.webContents.send('skills:mudou', d) })
  skills.observar()
  const seguro = (fn) => async (_e, ...a) => {
    try {
      return { ok: true, dado: await fn(...a) }
    } catch (err) {
      return { ok: false, erro: String(err.message || err) }
    }
  }
  const skillsRepo = skillsRepoMod.criar({ app, raiz: skills.raiz, abrirNavegador: (u) => shell.openExternal(u) })
  ipcMain.handle('skillsrepo:estado', seguro(() => skillsRepo.estado()))
  ipcMain.handle('skillsrepo:vincular', seguro((url, tok) => skillsRepo.vincular(url, tok)))
  ipcMain.handle('skillsrepo:login-disponivel', () => skillsRepo.loginDisponivel())
  ipcMain.handle('skillsrepo:login-iniciar', seguro(() => skillsRepo.loginIniciar()))
  ipcMain.handle('skillsrepo:login-aguardar', seguro((o) => skillsRepo.loginAguardar(o)))
  ipcMain.handle('skillsrepo:criar', seguro((n) => skillsRepo.criarRepositorio(n)))
  ipcMain.handle('skillsrepo:desvincular', seguro(() => skillsRepo.desvincular()))
  ipcMain.handle('skillsrepo:sincronizar', seguro((o) => skillsRepo.sincronizar(o || {})))
  ipcMain.handle('skills:listar', seguro(() => skills.listar()))
  ipcMain.handle('skills:ler', seguro((r) => skills.ler(r)))
  ipcMain.handle('skills:gravar', seguro((r, c) => skills.gravar(r, c)))
  ipcMain.handle('skills:criar', seguro((n, c) => skills.criar(n, c)))
  ipcMain.handle('skills:apagar', seguro((r) => skills.apagar(r)))
  ipcMain.handle('skills:renomear', seguro((r, n) => skills.renomear(r, n)))
  ipcMain.handle('skills:copiar', seguro((r) => skills.copiarParaMinhas(r)))
  ipcMain.handle('skills:buscar', seguro((t) => skills.buscar(t)))
  ipcMain.handle('skills:historico', seguro((r) => skills.historico(r)))
  ipcMain.handle('skills:versao', seguro((r, h) => skills.versao(r, h)))
  // exportar e importar dados (conversas, configuração sem chaves, skills do usuário, combos)
  ipcMain.handle('dados:exportar', async () => {
    const r = process.env.SB_TESTE_ARQUIVO ? { canceled: false, filePath: process.env.SB_TESTE_ARQUIVO } : await dialog.showSaveDialog(janela, { defaultPath: 'segundo-cerebro-dados.json', filters: [{ name: 'Dados do Segundo Cérebro', extensions: ['json'] }] })
    if (r.canceled) return { ok: false, cancelado: true }
    const pacote = { versao: 1, em: new Date().toISOString(), chats: ler('chats.json', []), config: { ...publica(), unlimitedCodigo: undefined, maquinaId: undefined, unlimitedLigado: undefined }, skills: {}, combos: [], estrategias: {} }
    for (const it of skills.listar()) if (it.tipo === 'arquivo' && !it.somenteLeitura && it.tamanho < 300000) pacote.skills[it.caminho] = skills.ler(it.caminho)
    try {
      pacote.combos = ((await embed.api('GET', '/api/combos')).json?.combos ?? []).map((c) => ({ name: c.name, models: c.models, kind: c.kind }))
      pacote.estrategias = (await embed.api('GET', '/api/settings')).json?.comboStrategies ?? {}
    } catch {}
    fs.writeFileSync(r.filePath, JSON.stringify(pacote, null, 1))
    return { ok: true, caminho: r.filePath, chats: pacote.chats.length, skills: Object.keys(pacote.skills).length, combos: pacote.combos.length }
  })
  ipcMain.handle('dados:importar', async () => {
    const r = process.env.SB_TESTE_ARQUIVO ? { canceled: false, filePaths: [process.env.SB_TESTE_ARQUIVO] } : await dialog.showOpenDialog(janela, { properties: ['openFile'], filters: [{ name: 'Dados do Segundo Cérebro', extensions: ['json'] }] })
    if (r.canceled) return { ok: false, cancelado: true }
    const pacote = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8'))
    if (pacote.versao !== 1) return { ok: false, erro: 'Arquivo de outra versão.' }
    const atuais = new Map(ler('chats.json', []).map((c) => [c.id, c]))
    for (const c of pacote.chats || []) if (!atuais.has(c.id)) atuais.set(c.id, c)
    gravar('chats.json', [...atuais.values()])
    const nSkills = skills.gravarLote(pacote.skills || {})
    const existentes = new Set(((await embed.api('GET', '/api/combos')).json?.combos ?? []).map((c) => c.name))
    for (const c of pacote.combos || []) if (!existentes.has(c.name)) await embed.api('POST', '/api/combos', c)
    if (pacote.estrategias && Object.keys(pacote.estrategias).length) await embed.api('PATCH', '/api/settings', { comboStrategies: pacote.estrategias })
    for (const k of ['soConversa', 'raciocinio', 'pasta']) if (pacote.config?.[k] !== undefined) cfg[k] = pacote.config[k]
    salvarCfg()
    return { ok: true, chats: (pacote.chats || []).length, skills: nSkills }
  })
  embed.iniciar().catch((e) => console.error('router', e)).finally(() => unl.iniciar())
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
  ipcMain.handle('externo:abrir', (_e, url) => (/^https?:\/\//i.test(url) ? shell.openExternal(url) : false))
  const publica = () => {
    const { unlimitedChave, ...resto } = cfg
    return resto
  }
  ipcMain.handle('cfg:get', () => publica())
  ipcMain.handle('cfg:set', (_e, parcial) => {
    for (const k of ['ativo', 'soConversa', 'pasta', 'raciocinio', 'modoPermissao']) if (parcial[k] !== undefined) cfg[k] = parcial[k]
    salvarCfg()
    return publica()
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
  remoto = remotoMod.criar({
    app,
    janela: () => janela,
    tipo: MODO_SERVIDOR ? 'vm' : 'desktop',
    chave: () => (cfg.unlimitedChave ? decifrar(cfg.unlimitedChave) : ''),
    invocar: (canal, args, sender) => {
      const fn = handlersIpc.get(canal)
      if (!fn) throw new Error('Ação não disponível.')
      return fn({ sender }, ...args)
    },
  })
  ipcMain.handle('acessoweb:estado', () => remoto.estado())
  ipcMain.handle('acessoweb:ativar', (_e, sim) => remoto.ativar(sim))
  ipcMain.handle('acessoweb:renomear', (_e, nome) => remoto.renomear(nome))
  if (MODO_SERVIDOR) remoto.ativar(true)
  else remoto.iniciar()
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
      const ctxResp = { chat: id, onDelta: enviar, sinal: ac.signal, anexos, pedirPermissao }
      // se o agente não confirmar o cancelamento em 4 s (modelo preso numa chamada longa), encerra a sessão e libera o chat
      const travou = new Promise((_, rej) =>
        ac.signal.addEventListener('abort', () =>
          setTimeout(() => {
            if (abortos.get(id) !== ac) return
            sessoes.get(id)?.encerrar()
            sessoes.delete(id)
            rej(new Error('Interrompido.'))
          }, 4000)
        )
      )
      const texto = await Promise.race([responder(alvo, mensagens, ctxResp), travou])
      e.sender.send('chat:fim', { id, texto: texto || acumulado, uso: ctxResp.uso || null })
    } catch (err) {
      e.sender.send('chat:erro', { id, erro: ac.signal.aborted ? 'Interrompido.' : String(err.message ?? err) })
    } finally {
      abortos.delete(id)
    }
  })
  ipcMain.handle('anexo:salvar', (_e, { chat, nome, bytes, caminho }) => {
    const dir = path.join(app.getPath('userData'), 'conversas', chat, 'anexos')
    fs.mkdirSync(dir, { recursive: true })
    const limpo = String(nome || 'arquivo').replace(/[\\/:*?"<>|]/g, '_')
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
  nav?.fechar()
  remoto?.parar()
  for (const x of sessoes.values()) x.encerrar()
  if (process.platform !== 'darwin') app.quit()
})
