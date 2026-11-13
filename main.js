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
const { Sessao, ambienteMontado, prepararBase, definirPacote, localizarBinario, registrar: registrarAgente } = require('./agent')
const skillsMod = require('./skills')
const remotoMod = require('./remoto')
const hermesInstalarMod = require('./hermes-instalar')
const relatorioInstalacao = require('./relatorio-instalacao')
const caminhosHermes = require('./caminhos-hermes')
const atualizadorMod = require('./atualizador')
const { conversaDeTeste } = require('./autoteste')
const skillsRepoMod = require('./skills-repo')
const unlimitedMod = require('./unlimited')
const navegadorMod = require('./navegador')
const path = require('path')
const os = require('os')
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
// Pasta de trabalho padrão. macOS: na pasta pessoal, FORA de Documentos/Mesa/Downloads, que o macOS protege. O Hermes sobe o gateway pelo
// osascript, então cada acesso a pasta protegida vira um pedido "osascript deseja ter acesso…" que o cliente não entende (QA 11/11/2026).
// Quem já tem a pasta em Documentos continua nela (só muda o padrão).
function pastaTrabalhoPadrao() {
  return process.platform === 'darwin' ? path.join(app.getPath('home'), 'Segundo Cerebro') : path.join(app.getPath('documents'), 'Segundo Cerebro')
}
const PADRAO = {
  ativo: '',
  soConversa: false,
  modoPermissao: 'manual', // manual | editar | auto | ignorar
  raciocinio: 'none',
  pasta: pastaTrabalhoPadrao(),
  hermesHome: path.join(HOME, 'hermes'),
  atualizarAuto: false,
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
const roteador = require('./roteador')
const sessoes = new Map()
const motorGateway = () => !!(cfg.motorGateway || process.env.SB_MOTOR_GATEWAY === '1') // spec 34: uma ponte para todas as conversas (padrao desligado)
// Ponte entre o Hermes e o roteador: repassa tudo e conta o que o modelo já gerou, para a tela mostrar progresso de verdade
const ponteLLM = require('./ponte-llm').criar({
  destino: () => embed.estado().origem,
  aoProgresso: (chat, info) => (sessoes.get(chat) || sessoes.get(vagaChat.get(chat)))?.emitir?.({ progresso: info }),
  registrar: (linha) => registrarAgente(app, linha),
  portaArq: path.join(app.getPath('userData'), 'ponte-porta.txt'),
  chaveRoteador: () => chaveLocal(),
  modeloPorChat: (chat) => (motorGateway() ? sessoes.get(chat)?.modelo : null), // motor gateway: o Hermes pede 'principal' e a ponte troca pelo modelo da conversa
})
let navInfo = null // { url, token } do servidor local do navegador integrado
let nav = null
let remoto = null // acesso web remoto (spec 21 §12)
const hermesInstalar = hermesInstalarMod.criar({ app, localizar: () => localizarBinario(app) })
// Teste de instalação: uma conversa de verdade com o agente (modelo local de mentira). Passou uma vez, não repete.
const marcaTeste = () => path.join(app.getPath('userData'), 'teste-instalacao.ok')
function limparAgenteQuebrado(anotar = () => {}) {
  const dados = app.getPath('userData')
  const raiz = caminhosHermes.raizAgente(app)
  const home = caminhosHermes.homeAgente(app)
  const alvos = [raiz, path.join(home, 'installs'), path.join(home, 'environments'), path.join(home, 'pronto.ok')]
  for (const a of alvos) {
    try {
      fs.rmSync(a, { recursive: true, force: true })
    } catch (e) {
      anotar('nao consegui apagar ' + path.basename(a) + ': ' + e.message)
    }
  }
}
async function verificarAgente(anotar = () => {}) {
  if (fs.existsSync(marcaTeste())) return { ok: true, jaFeito: true }
  const pasta = pastaTrabalhoPadrao()
  fs.mkdirSync(pasta, { recursive: true })
  let r
  for (let i = 1; i <= 2; i++) {
    // a 1ª execução monta o ambiente do Hermes (minutos, ~700 MB): o teste espera essa montagem em vez de desistir aos 2 min
    const montado = ambienteMontado(caminhosHermes.homeAgente(app), localizarBinario(app))
    r = await conversaDeTeste({
      anotar,
      prazoMs: montado ? 120000 : 45 * 60000,
      criarSessao: (base, emitir) => new Sessao({ app, id: 'teste-instalacao', pasta, base, modelo: 'principal', chave: 'teste', raciocinio: 'none', emitir: (e) => {
        if (e && e.aviso) { try { janela?.webContents.send('hermes:preparando', e.aviso) } catch {} } // a tela mostra o progresso da montagem
        emitir(e)
      }, pedirPermissao: async () => 'negar', modo: () => 'manual', nivel: 1 }),
    })
    anotar(r.ok ? 'teste de conversa passou' : `teste de conversa falhou (tentativa ${i}): ${r.motivo}`)
    if (r.ok) break
    if (i === 1) {
      // instalacao anterior quebrada (ex.: abortada no meio): o instalador troca os arquivos do programa mas nao toca na pasta de dados, entao o Hermes
      // meio instalado continuaria la. Apaga SO o agente e o ambiente dele (conversas, memoria e skills ficam) e instala de novo do zero.
      anotar('refazendo o agente do zero (apagando a instalacao quebrada)')
      limparAgenteQuebrado(anotar)
      try {
        await hermesInstalar.garantir((t) => anotar(t))
      } catch (e) {
        anotar('reinstalar o agente falhou: ' + e.message)
      }
    }
  }
  if (r.ok) {
    try {
      fs.writeFileSync(marcaTeste(), new Date().toISOString())
    } catch {}
  }
  return r
}
// o chat só começa depois do agente instalado e testado; falha do teste fica no log e o chat tenta mesmo assim
let agentePronto = null
let testeFalhou = false
function garantirAgente(aviso) {
  agentePronto ||= (async () => {
    await hermesInstalar.garantir(aviso)
    if (testeFalhou) return
    const r = await verificarAgente((t) => registrarAgente(app, 'teste: ' + t)).catch((e) => ({ ok: false, motivo: e.message }))
    if (!r.ok) testeFalhou = true
    if (!r.ok) throw Object.assign(new Error(r.motivo || 'falhou'), { teste: true })
  })().catch((e) => {
    agentePronto = null
    if (!e.teste) throw e
  })
  return agentePronto
}
// API de imagens do servidor (Unlimited): usa a mesma chave do chat; sem chave (cadastro pendente) a ferramenta some
function midiaDoApp() {
  try {
    const c = cfg.unlimitedChave
    if (process.env.SB_MIDIA_CHAVE) return { base: (process.env.SB_UNLIMITED_BASE || 'https://qwen.rangeltech.net/v1').replace(/\/+$/, ''), chave: process.env.SB_MIDIA_CHAVE } // so para teste
    if (!c || !cfg.unlimitedLigado) return null
    return { base: (process.env.SB_UNLIMITED_BASE || 'https://qwen.rangeltech.net/v1').replace(/\/+$/, ''), chave: decifrar(c), prefs: cfg.midia || {} }
  } catch {
    return null
  }
}
// Nível de segurança da conta, definido no painel (1 sem trava, 2 classificador 1, 3 classificadores 1 e 2). Consulta o servidor
// (cache de 60 s); se falhar, usa o último nível conhecido, e sem nenhum, 2 (conservador). Sem conta do Unlimited, vale 1.
let nivelSeg = { valor: null, em: 0 }
async function nivelDeSeguranca() {
  if (!cfg.unlimitedChave) return 1
  if (nivelSeg.valor && Date.now() - nivelSeg.em < 60000) return nivelSeg.valor
  try {
    const base = (process.env.SB_UNLIMITED_BASE || 'https://qwen.rangeltech.net/v1').replace(/\/+$/, '')
    const r = await fetch(base + '/auth/whoami', { headers: { Authorization: 'Bearer ' + decifrar(cfg.unlimitedChave) }, signal: AbortSignal.timeout(5000) })
    const j = await r.json()
    if (r.ok && [1, 2, 3].includes(j.safety_level)) nivelSeg = { valor: j.safety_level, em: Date.now() }
  } catch {}
  return nivelSeg.valor || 2
}
// UM COMBO POR PROVEDOR (pedido do Lucas, 10/11/2026): "claude", "chatgpt", "gemini", "unlimited"... criados e atualizados sozinhos a partir das
// conexões ativas. O Hermes pede a IA pelo NOME do provedor e o roteador escolhe o modelo dentro do combo (com queda para o próximo se um falhar);
// quem tem duas contas do mesmo provedor fica no mesmo combo e o roteador reveza. Combos criados pelo usuário nunca são alterados.
const NOME_IA = { cc: 'claude', claude: 'claude', cx: 'chatgpt', codex: 'chatgpt', openai: 'chatgpt', gc: 'gemini', 'gemini-cli': 'gemini', gemini: 'gemini', gh: 'copilot', github: 'copilot', gcli: 'grok', xai: 'grok', unl: 'unlimited' }
const TITULO_IA = { claude: 'Claude', chatgpt: 'ChatGPT', gemini: 'Gemini', copilot: 'Copilot', grok: 'Grok', unlimited: 'Unlimited (a IA da casa)' }
const nomeIa = (prefixo) => NOME_IA[prefixo] || String(prefixo).toLowerCase().replace(/[^a-z0-9_.-]/g, '-')
// apelido de cada provedor (claude -> cc): vem do catálogo do app, gerado do roteador
let APELIDOS = null
function apelidos() {
  if (APELIDOS) return APELIDOS
  try {
    const w = {}
    new Function('window', fs.readFileSync(path.join(__dirname, 'renderer', 'provider-catalog.js'), 'utf8'))(w)
    APELIDOS = Object.fromEntries((w.SB_CATALOGO?.provedores || []).filter((p) => p.alias).map((p) => [p.id, p.alias]))
  } catch {
    APELIDOS = {}
  }
  return APELIDOS
}
async function combosPorProvedor() {
  // só provedores que o usuário CONECTOU (o roteador também lista provedores gratuitos sem conexão, que não viram "IA" do usuário)
  const conex = ((await embed.api('GET', '/api/providers')).json?.connections ?? []).filter((c) => c.isActive !== false)
  const nos = new Map(((await embed.api('GET', '/api/provider-nodes')).json?.nodes ?? []).map((n) => [n.id, n]))
  const permitidos = new Set(['unl'])
  for (const c of conex) {
    permitidos.add(c.provider)
    if (apelidos()[c.provider]) permitidos.add(apelidos()[c.provider])
    if (nos.get(c.provider)?.prefix) permitidos.add(nos.get(c.provider).prefix)
  }
  const modelos = (await listarModelos()).filter((m) => m.grupo === 'Modelos' && permitidos.has(m.id.slice(0, m.id.indexOf('/'))))
  const grupos = new Map() // nome da IA -> [ids dos modelos]
  for (const m of modelos) {
    const k = m.id.indexOf('/')
    if (k <= 0) continue
    const ia = nomeIa(m.id.slice(0, k))
    if (!grupos.has(ia)) grupos.set(ia, [])
    grupos.get(ia).push(m.id)
  }
  const existentes = (await embed.api('GET', '/api/combos')).json?.combos ?? []
  const auto = new Set(cfg.combosAuto || [])
  const saida = []
  for (const [ia, ids] of grupos) {
    const ja = existentes.find((c) => c.name === ia)
    if (!ja) {
      const r = await embed.api('POST', '/api/combos', { name: ia, models: ids })
      if (r.status < 300) auto.add(ia)
    } else if (auto.has(ia) && JSON.stringify(ja.models || []) !== JSON.stringify(ids)) {
      await embed.api('PUT', '/api/combos/' + ja.id, { models: ids })
    }
    saida.push({ ia, titulo: TITULO_IA[ia] || ia, modelos: ids })
  }
  // conexão removida: o combo automático dela sai junto (os do usuário ficam)
  for (const c of existentes) if (auto.has(c.name) && !grupos.has(c.name)) (await embed.api('DELETE', '/api/combos/' + c.id), auto.delete(c.name))
  cfg.combosAuto = [...auto]
  salvarCfg()
  return saida
}
// outras IAs conectadas para o Hermes escolher qual usar em cada pedaço da tarefa (Spec 25 §16)
async function iasDoApp() {
  try {
    const est = embed.estado()
    if (!est.pronto) return null
    const ias = await combosPorProvedor()
    return { base: est.origem + '/v1', chave: await chaveLocal(), lista: ias.map((x) => ({ id: x.ia, nome: x.titulo, provedor: x.ia, modelos: x.modelos.slice(0, 6) })) }
  } catch (e) {
    registrarAgente(app, 'combos por provedor: ' + (e.message || e))
    return null
  }
}
// ÂNCORA do gateway (Spec 25 §14.2): o gateway do Hermes é compartilhado entre os chats, mas o app o derrubava toda vez que a última sessão fechava por ociosidade
// (matarGatewayOrfao) e cada chat seguinte pagava 11 a 13 s para subir tudo de novo. Uma sessão fixa, sem conversa, fica de pé enquanto o app estiver aberto:
// com ela o gateway nunca fica órfão, e `session/new` de um chat novo cai para ~2 s. Custo: um processo parado (medir). Desliga com cfg.ancoraAgente=false,
// e não sobe se a máquina tem pouca memória livre (VM pequena).
const ANCORA_ID = 'ancora-gateway' // nome antigo, mantido só para o filtro do roteador (nenhuma sessão nasce mais com ele)
const MEMORIA_MIN_ANCORA = process.env.SB_RESERVA_MEM_MIN ? +process.env.SB_RESERVA_MEM_MIN : 1.2 * 1024 * 1024 * 1024
// Memória que o sistema entrega na hora. No macOS o os.freemem() conta só as páginas totalmente vazias (o macOS deixa quase toda a RAM
// como cache) e dava ~100 MB num Mac de 6 GB ocioso: as reservas nunca subiam (QA 11/11/2026). Lá soma livre + inativa + especulativa +
// reaproveitável do vm_stat. Medida guardada por 20 s.
let memCache = { t: 0, v: 0 }
function memoriaDisponivel() {
  if (process.platform !== 'darwin') return os.freemem()
  if (Date.now() - memCache.t < 20000) return memCache.v
  let v = os.freemem()
  try {
    const s = require('child_process').execFileSync('vm_stat', { encoding: 'utf8', timeout: 3000 })
    const pag = +(s.match(/page size of (\d+)/) || [])[1] || 4096
    const n = (rotulo) => +((s.match(new RegExp('Pages ' + rotulo + ':\\s+(\\d+)')) || [])[1] || 0)
    v = (n('free') + n('inactive') + n('speculative') + n('purgeable')) * pag
  } catch {}
  memCache = { t: Date.now(), v }
  return v
}
// SESSÃO RESERVA (Spec 26): a partida do Hermes (Python + importações + agente + 1º turno) leva 10 a 20 s. O app mantém UMA sessão já de pé e
// aquecida, sem conversa. A conversa que precisar do agente a ADOTA na hora (a pergunta sai em segundos) e o app sobe outra reserva em segundo plano.
// Ela também faz o papel da antiga âncora: com ela de pé o gateway do Hermes nunca fica órfão. A identidade da conversa não fica presa ao processo:
// a reserva nasce como "reserva-N" e, na adoção, o app grava no arquivo da vaga de qual conversa ela passou a ser (memória e mídia leem dali) e a
// ponte do modelo traduz a vaga pela tabela vagaChat. Desliga com cfg.ancoraAgente=false; não sobe com pouca memória livre (VM pequena).
const vagaChat = new Map() // 'reserva-N' -> id da conversa que adotou
// Pedido do Lucas (11/11/2026): SEMPRE TRÊS sessões prontas. Uma conversa usa uma, a outra continua pronta e o app já sobe a próxima.
// Sobem uma de cada vez (a seguinte só depois da anterior aquecida), para não disputarem a máquina na abertura do app.
const RESERVAS_ALVO = () => Math.max(0, Math.min(4, Number.isFinite(+cfg.reservasAgente) ? +cfg.reservasAgente : 3))
const reservas = [] // sessões prontas (ou subindo), sem conversa
let reservaSubindo = null // promessa da reserva que está sendo criada agora (uma por vez)
let nReserva = 0
const nonceAbertura = require('crypto').randomBytes(3).toString('hex')
const pastaVagas = () => path.join(app.getPath('userData'), 'vagas')
try {
  fs.rmSync(pastaVagas(), { recursive: true, force: true })
} catch {}
let falhasReserva = 0
let reservaPausadaAte = 0 // depois de 2 reservas seguidas que não sobem (máquina sem memória), para de tentar por 10 min
function reservaServe(r, alvo, nivel) {
  return r && !r.morto && !r.falhouIniciar && r.modelo === alvo && r.pasta === cfg.pasta && r.racio === cfg.raciocinio && r.nivel === nivel
}
function manterAncora(alvo, nivel) {
  try {
    if (cfg.ancoraAgente === false || cfg.soConversa || !cfg.unlimitedEmail || !alvo) return
    // configuração mudou (modelo, raciocínio, segurança ou pasta) ou o processo caiu: essas reservas não servem mais
    for (let i = reservas.length - 1; i >= 0; i--) {
      if (!reservaServe(reservas[i], alvo, nivel)) {
        const velha = reservas.splice(i, 1)[0]
        try {
          velha.encerrar()
        } catch {}
      }
    }
    if (reservaSubindo || reservas.length >= RESERVAS_ALVO()) return
    if (Date.now() < reservaPausadaAte) return
    if (memoriaDisponivel() < MEMORIA_MIN_ANCORA) return
    // id único POR ABERTURA do app: com 'reserva-1' fixo o Hermes reabria a sessão antiga (guardada com a porta/credencial da abertura anterior) e toda
    // mensagem falhava com launch_credentials_unavailable (12/11/2026)
    const id = 'reserva-' + nonceAbertura + '-' + ++nReserva
    reservaSubindo = Promise.resolve(chaveLocal())
      .then(async (chave) => {
        await ponteLLM.iniciar()
        fs.mkdirSync(pastaVagas(), { recursive: true })
        const vagaArq = path.join(pastaVagas(), id + '.txt')
        fs.writeFileSync(vagaArq, '')
        const s = new Sessao({ app, id, pasta: cfg.pasta, base: ponteLLM.origem() + '/v1', modelo: alvo, chave: 'sb-local', raciocinio: cfg.raciocinio, nivel, emitir: () => {}, pedirPermissao: async () => 'negar', modo: () => cfg.modoPermissao || 'manual', navegador: navInfo, midia: midiaDoApp(), memoria: { arquivo: path.join(app.getPath('userData'), 'chats.json') }, ias: await iasDoApp(), vagaArq })
        s.fixa = true
        s.reserva = true
        s.modelo = alvo; s.racio = cfg.raciocinio; s.nivel = nivel; s.historico = ''
        reservas.push(s)
        // a próxima reserva só começa depois desta pronta e aquecida
        s.pronta
          .then(() => s.aquecer?.())
          .then(() => {
            // so descarta se o processo morreu ou nao subiu. Falha do TURNO de aquecimento (o modelo responde curto e o Hermes conta como 'nao respondeu',
            // visto em todas as VMs: 0 aquecimentos ok desde 04/11) nao invalida a sessao: o agente e as ferramentas ja foram montados.
            if (s.morto || s.falhouIniciar) throw new Error('a sessao nao subiu')
            s.aquecida = true
            falhasReserva = 0
            avisarCarregamento()
            registrarAgente(app, `sessão reserva ${id} pronta e aquecida (${reservas.length} na espera)`)
          })
          .catch((e) => {
            // reserva que não subiu ou não aqueceu não vai para conversa nenhuma: sai da fila e é encerrada (a próxima sobe no finally)
            const i = reservas.indexOf(s)
            if (i >= 0) {
              reservas.splice(i, 1)
              try {
                s.encerrar()
              } catch {}
            }
            registrarAgente(app, `sessão reserva ${id} descartada: ${e.message || e}`)
            if (++falhasReserva >= 2) {
              reservaPausadaAte = Date.now() + 10 * 60000
              falhasReserva = 0
              registrarAgente(app, 'sessões reserva pausadas por 10 min (2 falhas seguidas)')
            }
          })
          .finally(() => {
            if (reservaSubindo === subindo) reservaSubindo = null
            setTimeout(() => manterAncora(alvo, nivel), 500)
          })
        return s
      })
      .catch((e) => {
        registrarAgente(app, 'sessão reserva: ' + (e.message || e))
        if (reservaSubindo === subindo) reservaSubindo = null
        return null
      })
    const subindo = reservaSubindo
  } catch {}
}
// TELA DE CARREGAMENTO NA ABERTURA (spec 27 §5, pedido do Lucas 11/11/2026): é melhor o cliente ver um carregamento curto ao abrir do que mandar a
// 1ª mensagem e esperar. Toda abertura a frio do app (desktop) cobre a tela até TRÊS sessões do agente estarem aquecidas (contando a que o chat
// aberto já adotou). Nunca prende: libera em 40 s no máximo; com 1 pronta libera aos 30 s; libera na hora se não há o que esperar (sem conta,
// só conversa, reservas desligadas/pausadas, pouca memória, agente que não preparou). O relógio só começa depois do preparo do agente (1ª instalação).
const carregamento = { ativo: !MODO_SERVIDOR && process.env.SB_CARREGAMENTO !== '0', t0: 0, fim: false, motivo: '' }
const CARREGAMENTO_ALVO = 3
const CARREGAMENTO_MAX_MS = 40000
const CARREGAMENTO_UM_MS = 30000
function sessoesAquecidas() {
  let n = 0
  for (const s of reservas) if (s.aquecida && !s.morto) n++
  for (const s of sessoes.values()) if (s.aquecida && !s.morto) n++
  return n
}
function estadoCarregamento() {
  if (!carregamento.ativo) return { ativo: false }
  if (!cfg.unlimitedEmail) return { ativo: false, aguardandoConta: true }
  const prontas = sessoesAquecidas()
  const alvo = Math.min(CARREGAMENTO_ALVO, Math.max(1, RESERVAS_ALVO()))
  const decorrido = carregamento.t0 ? Date.now() - carregamento.t0 : 0
  return { ativo: !carregamento.fim, comecou: !!carregamento.t0, prontas, alvo, decorrido, max: CARREGAMENTO_MAX_MS }
}
function liberarCarregamento(motivo) {
  if (!carregamento.ativo || carregamento.fim) return
  carregamento.fim = true
  carregamento.motivo = motivo
  clearInterval(carregamento.relogio)
  try {
    registrarAgente(app, `tela de carregamento liberada em ${((Date.now() - (carregamento.t0 || Date.now())) / 1000).toFixed(1)} s: ${motivo} (${sessoesAquecidas()} sessões prontas)`)
  } catch {}
  try {
    janela?.webContents.send('app:carregando', { ativo: false })
  } catch {}
}
function avisarCarregamento() {
  if (!carregamento.ativo || carregamento.fim || !carregamento.t0) return
  // ainda sem conta: a tela de login fica visível (a de carregamento some) e o relógio recomeça; ao entrar, o carregamento cobre a 1ª vez do cliente
  if (!cfg.unlimitedEmail) {
    carregamento.t0 = Date.now()
    try {
      janela?.webContents.send('app:carregando', { ativo: false, aguardandoConta: true })
    } catch {}
    return
  }
  const e = estadoCarregamento()
  if (e.prontas >= e.alvo) return liberarCarregamento('sessões prontas')
  if (e.decorrido >= CARREGAMENTO_MAX_MS) return liberarCarregamento('limite de tempo')
  if (e.prontas >= 1 && e.decorrido >= CARREGAMENTO_UM_MS) return liberarCarregamento('uma sessão pronta aos 30 s')
  // nada vai subir: reservas desligadas ou pausadas, pouca memória, sem conta (a tela de login aparece)
  const nadaSubindo = !reservaSubindo && !reservas.length && e.prontas === 0
  if (cfg.ancoraAgente === false || cfg.soConversa || RESERVAS_ALVO() === 0) return liberarCarregamento('sem sessões para esperar')
  if (nadaSubindo && e.decorrido > 8000 && (Date.now() < reservaPausadaAte || memoriaDisponivel() < MEMORIA_MIN_ANCORA)) return liberarCarregamento('máquina sem memória livre para as sessões')
  try {
    janela?.webContents.send('app:carregando', e)
  } catch {}
}
function comecarCarregamento() {
  if (!carregamento.ativo || carregamento.fim || carregamento.t0) return
  carregamento.t0 = Date.now()
  carregamento.relogio = setInterval(avisarCarregamento, 500)
  avisarCarregamento()
}
ipcMain.handle('app:carregando', () => estadoCarregamento())
// A conversa `chat` leva uma reserva que sirva para a configuração atual (a mais adiantada). Devolve a sessão ou null.
async function adotarReserva(chat, alvo, nivel) {
  if (!reservas.some((r) => reservaServe(r, alvo, nivel)) && reservaSubindo) await reservaSubindo.catch(() => null) // a 1ª está nascendo: espera em vez de subir outra
  const servem = reservas.filter((r) => reservaServe(r, alvo, nivel))
  const r = servem.find((x) => !x.primeira) || servem.find((x) => !x.iniciandoAgora) || servem[0]
  if (!r) return null
  reservas.splice(reservas.indexOf(r), 1)
  try {
    fs.writeFileSync(r.vagaArq, chat)
  } catch {}
  vagaChat.set(r.id, chat)
  r.vaga = r.id
  r.id = chat
  r.fixa = false
  r.reserva = false
  r.agendarOcioso()
  registrarAgente(app, `conversa ${String(chat).slice(0, 8)} adotou a sessão reserva ${r.vaga} (${reservas.length} ainda na espera)`)
  return r
}
// ---- editor de vídeo (spec 25 §21): instalação silenciosa sob pedido, janela do editor e corte de silêncio; o motor fala com o Hermes pelo próprio MCP
const editorVideo = require('./editor-video')
async function ferramentaEditor(nome, args) {
  if (nome === 'estado') {
    const pronto = editorVideo.instalado(app)
    return { texto: JSON.stringify({ instalado: pronto, suportado: editorVideo.suportado(), pasta_projetos: path.join(cfg.pasta, 'Videos'), nome: editorVideo.NOME_EXIBIDO, dica: pronto ? 'Use as ferramentas do servidor "editor" (project_create, media_import, ...). Projetos dentro da pasta_projetos.' : 'Chame editor_instalar.' }) }
  }
  if (nome === 'instalar') {
    const r = await editorVideo.instalar(app, (p) => janela?.webContents.send('editor:progresso', p))
    return { texto: r.ja ? 'O editor de vídeo já estava instalado.' : 'Editor de vídeo instalado. Peça ao usuário para abrir uma conversa nova para as ferramentas de edição aparecerem; nesta conversa só consigo cortar silêncio e abrir a janela.' }
  }
  if (nome === 'abrir_janela') {
    editorVideo.abrirJanela(app, args.projeto ? path.resolve(String(args.projeto)) : '')
    return { texto: 'Abri a janela do editor de vídeo para o usuário.' }
  }
  if (nome === 'cortar_silencio') {
    const r = await editorVideo.cortarSilencio(String(args.arquivo || ''), { limiar: args.limiar_db, minimo: args.silencio_minimo_s })
    return { texto: `Arquivo novo: ${r.arquivo}\nDuração: ${r.duracaoAntes.toFixed(1)} s -> ${r.duracaoDepois.toFixed(1)} s (cortei ${r.cortado} s de silêncio, ${r.trechos} trechos mantidos). Importe esse arquivo no projeto com media_import.` }
  }
  throw new Error('Ferramenta desconhecida: ' + nome)
}
ipcMain.handle('editor:estado', () => ({ habilitado: editorVideo.habilitado(app), instalado: editorVideo.instalado(app), suportado: editorVideo.suportado(), nome: editorVideo.NOME_EXIBIDO }))
ipcMain.handle('editor:instalar', async () => { try { await editorVideo.instalar(app, (p) => janela?.webContents.send('editor:progresso', p)); return { ok: true } } catch (e) { return { ok: false, erro: String(e.message || e) } } })
ipcMain.handle('editor:abrir', (_e, projeto) => { try { return editorVideo.abrirJanela(app, projeto || path.join(cfg.pasta, 'Videos')) } catch (e) { return { ok: false, erro: String(e.message || e) } } })

async function sessaoDoChat(id, alvo, contexto, historico) {
  // logo depois de entrar na conta, o app leva alguns segundos para ligá-la ao motor interno: a primeira mensagem espera
  // (em vez de sair com a chave ainda não aplicada e voltar "chave inválida")
  if (cfg.unlimitedChave && !cfg.unlimitedLigado) {
    contexto.onDelta?.({ aviso: 'Conectando à sua conta…' })
    for (let i = 0; i < 80 && !cfg.unlimitedLigado; i++) await new Promise((r) => setTimeout(r, 500))
  }
  const est = embed.estado()
  const existente = sessoes.get(id)
  const nivel = await nivelDeSeguranca()
  if (existente && !existente.morto && !existente.falhouIniciar && existente.modelo === alvo && existente.pasta === cfg.pasta && existente.racio === cfg.raciocinio && existente.nivel === nivel) return existente
  existente?.encerrar()
  fs.mkdirSync(cfg.pasta, { recursive: true })
  if (motorGateway()) {
    // motor gateway (spec 34): uma ponte para todas as conversas; sem reserva nem aquecimento
    await ponteLLM.iniciar()
    const { SessaoGateway } = require('./sessao-gateway')
    const sg = new SessaoGateway({ app, id, pasta: cfg.pasta, base: ponteLLM.origem() + '/v1', modelo: alvo, raciocinio: cfg.raciocinio, nivel, emitir: contexto.onDelta, pedirPermissao: contexto.pedirPermissao, modo: () => cfg.modoPermissao || 'manual', navegador: navInfo, midia: midiaDoApp(), memoria: { arquivo: path.join(app.getPath('userData'), 'chats.json') }, ias: await iasDoApp() })
    sg.modelo = alvo
    sg.racio = cfg.raciocinio
    sg.nivel = nivel
    sg.historico = historico
    sg.chatMarca = id
    sessoes.set(id, sg)
    return sg
  }
  if (!reservas.length) manterAncora(alvo, nivel) // sem reserva ainda (app acabou de abrir): cria e adota a mesma, em vez de subir duas sessões ao mesmo tempo
  const adotada = await adotarReserva(id, alvo, nivel)
  if (adotada) {
    if (adotada.primeira) adotada.historico = historico // ainda não aqueceu: o resumo vai no 1º turno, como numa sessão nova
    else if (historico) adotada.historicoPendente = historico
    adotada.emitir = contexto.onDelta
    adotada.pedirPermissao = contexto.pedirPermissao
    adotada.chatMarca = id
    sessoes.set(id, adotada)
    manterAncora(alvo, nivel) // já sobe a próxima reserva
    return adotada
  }
  await ponteLLM.iniciar()
  const sessao = new Sessao({ app, id, pasta: cfg.pasta, base: ponteLLM.origem() + '/v1', modelo: alvo, chave: 'sb-local', raciocinio: cfg.raciocinio, nivel, emitir: contexto.onDelta, pedirPermissao: contexto.pedirPermissao, modo: () => cfg.modoPermissao || 'manual', navegador: navInfo, midia: midiaDoApp(), memoria: { arquivo: path.join(app.getPath('userData'), 'chats.json') }, ias: await iasDoApp() })
  sessao.modelo = alvo
  sessao.racio = cfg.raciocinio
  sessao.nivel = nivel
  sessao.historico = historico
  sessao.chatMarca = id
  sessoes.set(id, sessao)
  manterAncora(alvo, nivel) // o primeiro chat também sobe a reserva (que mantém o gateway vivo)
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
  // roteador: pedido que não precisa de ferramenta sai numa chamada direta (rápido); se o modelo pedir o agente, segue para o Hermes
  const ultimoPedido = [...msgs].reverse().find((m) => m.role === 'user')?.content ?? ''
  if (cfg.roteador !== false && roteador.classificar(ultimoPedido, ctx.anexos || [], { emAgente: !!(sessoes.get(ctx.chat) && !sessoes.get(ctx.chat).morto && !sessoes.get(ctx.chat).primeira) }) === 'rapido') {
    try {
      const rapido = (raciocinio) => roteador.responderRapido({
        base: est.origem + '/v1', chave: await_chave, modelo: alvo, msgs, onDelta: ctx.onDelta, sinal: ctx.sinal, raciocinio,
        memoriaArquivo: path.join(app.getPath('userData'), 'chats.json'), chat: ctx.chat, skillsDir: path.join(caminhosHermes.homeAgente(app), 'skills'), usuario: os.userInfo().username,
      })
      const await_chave = await chaveLocal()
      const r = await rapido(cfg.raciocinio)
      if (!r.escalar && String(r.texto || '').trim() && !roteador.afirmaArquivo(r.texto)) return r.texto
      // a resposta rapida afirmou ter criado um arquivo (invenção): desmente e faz de verdade pelo agente
      if (!r.escalar && roteador.afirmaArquivo(r.texto)) ctx.onDelta?.({ texto: '\n\n⚠ Correção: eu não criei nenhum arquivo ainda. Vou fazer de verdade agora.\n\n' })
      // escalou, ou o modelo devolveu uma resposta vazia: o agente assume (nunca mostrar mensagem em branco)
      ctx.onDelta?.({ aviso: 'Isso precisa do agente, preparando…' })
    } catch (e) {
      if (ctx.sinal?.aborted) throw e
      registrarAgente(app, 'roteador: falhou, seguindo pelo agente: ' + (e.message || e))
    }
  }
  // o Hermes não vem no instalador: na primeira conversa o app o instala (uma vez) e mostra o andamento
  await garantirAgente((aviso) => ctx.onDelta?.({ aviso }))
  // se o agente precisar recomeçar (raciocínio ou modelo mudou), o novo recebe um resumo das últimas mensagens
  const ultimo = [...msgs].reverse().find((m) => m.role === 'user')?.content ?? ''
  const anteriores = msgs.slice(0, -1).slice(-10)
  const linhaHist = (m) => (m.role === 'user' ? 'Usuário' : 'Assistente') + ': ' + String(m.content).slice(0, 700)
  const historico = anteriores.map(linhaHist).join(String.fromCharCode(10))
  const sessao = await sessaoDoChat(ctx.chat, alvo, ctx, historico)
  if (sessao.primeira) sessao.historico = historico // sessão aquecida antes da 1ª pergunta do agente: entra o resumo do que já foi dito
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
  // Modelos de provedores do catálogo (Claude, Codex, Gemini, Copilot...): a lista vem do PRÓPRIO roteador (/v1/models), que já filtra pelas
  // conexões ativas e resolve os catálogos ao vivo. Antes o app cruzava /api/models (que marca cada modelo pelo APELIDO do provedor, ex. `cc`)
  // com o id da conexão (`claude`): não batia e o Claude conectado não aparecia na tela de combos (achado em 10/11/2026).
  const vistos = new Set(saida.map((x) => x.id))
  const comCatalogo = ativos.some((c) => !nos.has(c.provider))
  if (comCatalogo) {
    const v = await embed.api('GET', '/v1/models').catch(() => null)
    for (const m of v?.json?.data ?? []) {
      const id = String(m.id || '')
      const k = id.indexOf('/')
      if (k <= 0 || m.owned_by === 'combo' || id.startsWith('unl/') || vistos.has(id)) continue
      const prefixo = id.slice(0, k)
      if ([...nos.values()].some((n) => n.prefix === prefixo)) continue // provedor compatível: listado abaixo, com o nome dele
      vistos.add(id)
      saida.push({ id, nome: m.name || id.slice(k + 1), grupo: 'Modelos', provedor: m.owned_by || prefixo })
    }
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
  // a vista do navegador é uma camada nativa: quando a janela muda de tamanho ou de estado (maximizar, restaurar, encaixar), pede à tela para reenviar
  // a posição do painel (a tela também confere a cada quadro; isto cobre a janela voltando de minimizada ou trocando de monitor)
  let reposicionar = null
  for (const ev of ['resize', 'maximize', 'unmaximize', 'restore', 'enter-full-screen', 'leave-full-screen', 'move', 'show']) {
    janela.on(ev, () => {
      clearTimeout(reposicionar)
      reposicionar = setTimeout(() => { try { janela?.webContents.send('navegador:reposicionar') } catch {} }, 60)
    })
  }
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
app.on('will-quit', () => {
  try {
    require('./agent').limparHermesPreso(app, caminhosHermes.homeAgente(app))
  } catch {}
})
app.whenReady().then(() => {
  try {
    require('./agent').limparHermesPreso(app, caminhosHermes.homeAgente(app))
  } catch (e) {
    console.error('limpeza do Hermes falhou:', e && e.message)
  }
  // modo do instalador: baixa e prepara o agente (Hermes) sem abrir janela e sai. O instalador do Windows chama isto no fim da
  // instalação, então depois de instalar o cliente só conversa. O progresso vai para um arquivo de log na pasta de dados.
  if (process.argv.includes('--preparar-agente')) {
    const logArq = path.join(app.getPath('userData'), 'preparo.log')
    const anotar = (t) => {
      try {
        fs.mkdirSync(app.getPath('userData'), { recursive: true })
        fs.appendFileSync(logArq, new Date().toISOString() + ' ' + t + '\n')
      } catch {}
    }
    anotar('iniciando o preparo do agente')
    hermesInstalar
      .garantir((t) => anotar(t))
      .then(async () => {
        // teste de instalação: monta o ambiente do agente e manda uma conversa de verdade; só sai com sucesso se ele respondeu
        anotar('testando o agente com uma conversa')
        const r = await verificarAgente(anotar)
        if (!r.ok) {
          anotar('falhou: ' + r.motivo)
          await relatorioInstalacao.enviar({ versao: app.getVersion(), logArq, codigo: 3 })
          return app.exit(3)
        }
        anotar('agente pronto e testado')
        app.exit(0)
      })
      .catch(async (e) => {
        anotar('falhou: ' + e.message)
        await relatorioInstalacao.enviar({ versao: app.getVersion(), logArq, codigo: 1 })
        app.exit(1)
      })
    return
  }
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
    preload: path.join(__dirname, 'preload.js'),
    avisarDestacada: (sim) => janela?.webContents.send('navegador:destacado', !!sim),
    editor: (nome, args) => ferramentaEditor(nome, args),
    extensao: () => (remoto && remoto.extensao) || null, // o acesso remoto é criado depois; a extensão fala por ele
    modoServidor: MODO_SERVIDOR,
  })
  nav.iniciarServidor().then((i) => (navInfo = i))
  ipcMain.handle('navegador:limites', (_e, l) => nav.definirLimites(l))
  ipcMain.handle('navegador:destacar', () => nav.destacar())
  ipcMain.handle('navegador:reencaixar', () => nav.reencaixar())
  ipcMain.handle('navegador:mostrar', (_e, sim) => nav.mostrar(sim))
  ipcMain.handle('navegador:esconder-temp', (_e, sim) => nav.esconderTemporario(sim))
  ipcMain.handle('navegador:acao', (_e, { acao, url }) => nav.acao(acao, url).then(() => ({ ok: true })).catch((err) => ({ ok: false, erro: String(err.message || err) })))
  ipcMain.handle('navegador:estado', () => nav.estado())
  ipcMain.handle('navegador:captura', () => nav.captura().catch(() => null))
  ipcMain.handle('navegador:clique', (_e, x, y) => (nav.clicarPonto(x, y), true))
  ipcMain.handle('navegador:digitar-texto', (_e, t) => nav.digitarTexto(t).then(() => true))
  ipcMain.handle('navegador:tecla', (_e, k) => (nav.teclaEspecial(String(k)), true))
  ipcMain.handle('navegador:rolar-ponto', (_e, dy, x, y) => (nav.rolarPonto(dy, x, y), true))
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
  // Ditado por voz: o áudio da gravação inteira vai ao servidor de transcrição (Whisper na GPU) com a chave da conta e o texto volta.
  // Vale para o app e para a web (a web chama este mesmo canal pela ponte, e quem fala com o servidor é a máquina do cliente).
  ipcMain.handle('ditado:servidor', async (_e, dados, mime) => {
    const m = midiaDoApp()
    if (!m) return { ok: false, erro: 'Entre na sua conta para usar o ditado por voz.' }
    try {
      const buf = Buffer.from(dados)
      if (!buf.length) return { ok: false, erro: 'Não ouvi nada. Tente de novo.' }
      const ext = /mp4|aac/.test(mime || '') ? 'm4a' : /ogg/.test(mime || '') ? 'ogg' : 'webm'
      const fd = new FormData()
      fd.append('file', new Blob([buf], { type: mime || 'audio/webm' }), 'fala.' + ext)
      fd.append('language', 'pt')
      const r = await fetch(m.base + '/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + m.chave }, body: fd, signal: AbortSignal.timeout(240000) })
      if (!r.ok) {
        registrarAgente(app, 'ditado: servidor respondeu ' + r.status)
        return { ok: false, erro: r.status === 503 || r.status === 502 ? 'O ditado está indisponível agora.' : r.status === 413 ? 'A gravação ficou grande demais. Grave um trecho menor.' : 'Não consegui transcrever agora.' }
      }
      const j = await r.json()
      return { ok: true, texto: String(j.text || '').trim() }
    } catch (e) {
      registrarAgente(app, 'ditado: ' + String(e && e.message || e).slice(0, 160))
      return { ok: false, erro: 'Não consegui transcrever agora. Confira a internet e tente de novo.' }
    }
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
  const atualizador = atualizadorMod.criar({ app, cfgGet: () => cfg, enviar: (c, d) => janela?.webContents.send(c, d) })
  ipcMain.handle('atualizacao:estado', () => atualizador.estado())
  ipcMain.handle('atualizacao:conferir', () => atualizador.conferir())
  ipcMain.handle('atualizacao:baixar', () => atualizador.baixar(true))
  ipcMain.handle('atualizacao:instalar', () => atualizador.instalar())
  if (!MODO_SERVIDOR) atualizador.iniciar()
  definirPacote(cfg.unlimitedPacote)
  prepararBase(app)
  const unl = unlimitedMod.criar({
    app,
    cfgGet: () => cfg,
    cfgSet: (p) => {
      Object.assign(cfg, p)
      if ('unlimitedPacote' in p) definirPacote(cfg.unlimitedPacote)
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
  ipcMain.handle('creditos:opcoes', () => unl.creditos())
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
  // login por conta numa janela do app: devolve { ok, code, state, url } sem a pessoa copiar o endereço de retorno
  ipcMain.handle('oauth:janela', async (_e, { url, retorno } = {}) => {
    if (!/^https:\/\//i.test(url || '') || !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(retorno || '')) return { ok: false, erro: 'Endereço inválido' }
    try {
      const r = await require('./oauth-janela').capturar({ BrowserWindow, url, retorno, pai: janela && !janela.isDestroyed() ? janela : null, userAgent: navegadorMod.userAgentChrome() })
      return { ok: true, ...r }
    } catch (e) {
      return { ok: false, fechada: e.message === 'fechada', erro: e.message }
    }
  })
  const publica = () => {
    const { unlimitedChave, ...resto } = cfg
    return resto
  }
  ipcMain.handle('cfg:get', () => publica())
  ipcMain.handle('cfg:set', (_e, parcial) => {
    for (const k of ['ativo', 'soConversa', 'pasta', 'raciocinio', 'modoPermissao', 'atualizarAuto', 'acessoWebPerguntado']) if (parcial[k] !== undefined) cfg[k] = parcial[k]
    salvarCfg()
    return publica()
  })
  ipcMain.handle('chats:get', () => ler('chats.json', []))
  // Várias pessoas (ou o app e a web) usam as mesmas conversas: junta por conversa (vence a alteração mais recente)
  // e guarda as apagadas para não ressuscitarem; as outras telas recebem só o que mudou (chats:mudou).
  ipcMain.handle('chats:set', (_e, recebidas, apagados) => {
    const lista = Array.isArray(recebidas) ? recebidas : []
    const novosMortos = (Array.isArray(apagados) ? apagados : []).map(String).slice(0, 200)
    const mapa = new Map(ler('chats.json', []).map((c) => [c.id, c]))
    const mortos = new Set([...ler('chats-apagados.json', []), ...novosMortos])
    const quando = (c) => c?.mod || c?.em || 0
    const mudadas = []
    for (const c of lista) {
      if (!c || !c.id || mortos.has(c.id)) continue
      const a = mapa.get(c.id)
      if (!a || quando(c) >= quando(a)) {
        mapa.set(c.id, c)
        if (!a || quando(c) !== quando(a)) mudadas.push(c)
      }
    }
    for (const id of mortos) mapa.delete(id)
    gravar('chats.json', [...mapa.values()])
    if (novosMortos.length) gravar('chats-apagados.json', [...mortos].slice(-1000))
    if (mudadas.length || novosMortos.length) janela?.webContents.send('chats:mudou', { chats: mudadas, apagados: novosMortos })
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
  // ---- extensão do Chrome (spec 25 §7): pareamento pelo app (mensageria nativa), estado e login de provedor pelo Chrome do usuário
  const extApp = require('./extensao-app')
  extApp.iniciarServidor({ pasta: app.getPath('userData'), pareamento: () => remoto.extensao.pareamento() }).catch(() => {})
  try {
    extApp.registrar({ pasta: app.getPath('userData'), execPath: process.execPath, scriptHost: path.join(app.isPackaged ? process.resourcesPath : __dirname, 'native-host.js') })
  } catch {}
  ipcMain.handle('extensao:estado', () => ({ ...remoto.extensao.estado(), link: extApp.LINK_EXTENSAO }))
  // "Conectar o Chrome": liga o acesso web (a extensão fala pela ponte) e abre o site já com o pareamento no endereço (#sbp=..., que nunca vai ao servidor)
  ipcMain.handle('extensao:conectar', async () => {
    try {
      if (!remoto.estado().ativo) await remoto.ativar(true)
      const p = await remoto.extensao.pareamento()
      await shell.openExternal(`${p.base}/#sbp=${encodeURIComponent(p.token)}`)
      return { ok: true }
    } catch (e) {
      return { ok: false, erro: String(e.message || e) }
    }
  })
  // login de provedor pelo Chrome do usuário: a extensão abre a página de login, pega o retorno em localhost e devolve o código
  ipcMain.handle('oauth:extensao', async (_e, { url, retorno, state } = {}) => {
    if (!/^https:\/\//i.test(url || '') || !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(retorno || '')) return { ok: false, erro: 'Endereço inválido' }
    const r = await remoto.extensao.executar('oauth_capturar', { authUrl: url, retorno, state }, 15 * 60 * 1000)
    if (r.ok) return { ok: true, code: r.dado.code, state: r.dado.state, url: r.dado.url }
    return { ok: false, fechada: r.erro === 'fechada', semExtensao: ['sem_extensao', 'pausado', 'desconectada'].includes(r.codigo), erro: r.erro }
  })
  ipcMain.handle('acessoweb:estado', () => remoto.estado())
  ipcMain.handle('acessoweb:ativar', (_e, sim) => remoto.ativar(sim))
  ipcMain.handle('acessoweb:renomear', (_e, nome) => remoto.renomear(nome))
  if (MODO_SERVIDOR) remoto.ativar(true)
  else remoto.iniciar()
  // o agente é preparado assim que o app abre pela primeira vez (VM e desktop), sem esperar a primeira conversa:
  // depois de instalar, o cliente só conversa. A tela mostra um aviso discreto enquanto prepara.
  const avisarPreparo = (t) => {
    try {
      janela?.webContents.send('hermes:preparando', t)
    } catch {}
  }
  // ensaio visual da tela de preparo (nao depende de preparar de verdade): SB_TESTE_PREPARO=<segundos>
  if (process.env.SB_TESTE_PREPARO) {
    const etapas = ['baixando o instalador', 'ffmpeg', 'node', 'python', 'ripgrep', 'montando o ambiente']
    let n = 0
    const iv = setInterval(() => {
      if (n >= +process.env.SB_TESTE_PREPARO) {
        clearInterval(iv)
        return avisarPreparo('')
      }
      avisarPreparo(`Preparando o agente pela primeira vez (${etapas[Math.floor(n++ / 3) % etapas.length]}). Leva alguns minutos e acontece uma vez só…`)
    }, 1000)
  }
  garantirAgente(MODO_SERVIDOR ? undefined : avisarPreparo)
    .then(() => {
      avisarPreparo('')
      comecarCarregamento() // agente pronto: agora espera as sessões aquecerem (tela de carregamento)
      // EXTRAS em segundo plano (pedido do Lucas, 11/11/2026): o essencial (agente) fica pronto com a tela bonita; o resto baixa em paralelo, sem tela.
      // Hoje: o editor de vídeo, quando liberado nesta máquina e ainda não instalado.
      setTimeout(() => {
        try {
          if (editorVideo.habilitado(app) && editorVideo.suportado() && !editorVideo.instalado(app)) {
            editorVideo.instalar(app, (p) => janela?.webContents.send('editor:progresso', p)).catch((e) => registrarAgente(app, 'editor em segundo plano: ' + (e.message || e)))
          }
        } catch {}
      }, 15000)
    })
    .catch((e) => {
      console.error('[hermes]', e.message)
      avisarPreparo('')
      liberarCarregamento('agente não preparou')
      // falha ao preparar o agente com o app aberto: grava no preparo.log e avisa a equipe (o log so existia no PC do cliente)
      try {
        const logArq = path.join(app.getPath('userData'), 'preparo.log')
        fs.appendFileSync(logArq, new Date().toISOString() + ' falhou (app aberto): ' + String(e.message).slice(0, 400) + '\n')
        relatorioInstalacao.enviar({ versao: app.getVersion(), logArq, codigo: 'app' })
      } catch {}
    })
  ipcMain.handle('chat:permissao-resp', (_e, { req, resposta }) => permissoes.get(req)?.(resposta))
  // Aquecimento: a partida do Hermes leva 10 a 15 s; quem começa a digitar num chat novo já deixa a sessão subindo, e a 1ª pergunta não espera.
  // Só chat sem histórico, só com o agente já instalado/verificado no arranque, e sem canal de resposta (a mensagem real religa o canal).
  const aquecidos = new Map()
  ipcMain.handle('agente:aquecer', async (_e, { id, alvo } = {}) => {
    try {
      if (!id || !alvo || cfg.soConversa || !cfg.unlimitedEmail || cfg.aquecerAgente === false) return { ok: false }
      const ex = sessoes.get(id)
      if (ex && !ex.morto) {
        ex.tocar?.() // chat na tela: não deixa a sessão quente morrer por ociosidade
        return { ok: true, ja: true }
      }
      if (Date.now() - (aquecidos.get(id) || 0) < 60000) return { ok: true }
      if (!embed.estado().pronto) return { ok: false }
      aquecidos.set(id, Date.now())
      await garantirAgente()
      const sessao = await sessaoDoChat(id, alvo, { onDelta: () => {}, pedirPermissao: async () => 'negar' }, '')
      sessao.aquecer?.() // 1o turno em segundo plano: agente construido, MCPs abertos, cache do servidor quente
      return { ok: true }
    } catch (e) {
      registrarAgente(app, 'aquecer: ' + (e.message || e))
      return { ok: false }
    }
  })
  // Jobs pesados de mídia (vídeo em alta, troca de personagem) são enviados à GPU e a ferramenta volta na hora: aqui o app acompanha, baixa o arquivo
  // quando termina e avisa no chat (evento midia:pronta), sem gastar chamadas do modelo e sem prender o turno do agente. Sobrevive a fechar o app.
  const midiaPendentes = require('./mcp-midia')
  setInterval(async () => {
    try {
      const m = midiaDoApp()
      if (!m || !m.chave || !cfg.pasta) return
      midiaPendentes.configurar({ base: m.base, chave: m.chave, pasta: cfg.pasta })
      for (const f of await midiaPendentes.concluirPendentes()) janela?.webContents.send('midia:pronta', f)
    } catch (e) {
      registrarAgente(app, 'midia pendente: ' + (e.message || e))
    }
  }, 8000).unref?.()
  // Falar no meio do trabalho do agente: a mensagem entra no turno em andamento (o Hermes cancela só a chamada ao modelo em voo e refaz o fim com a
  // correção), em vez de esperar na fila até o turno acabar. Sem turno de agente ativo neste chat, devolve ok:false e a tela enfileira como antes.
  ipcMain.handle('agente:direcionar', async (_e, { id, texto } = {}) => {
    try {
      const s = sessoes.get(id)
      if (!s || s.morto || !s.turno || !String(texto || '').trim()) return { ok: false }
      // se o turno estiver parado numa aprovação de permissão, o Hermes pode não responder ao 2º prompt: depois de 4 s a tela enfileira como antes
      return { ok: await Promise.race([s.direcionar(String(texto)), new Promise((r) => setTimeout(() => r(false), 4000))]) }
    } catch (e) {
      registrarAgente(app, 'direcionar: ' + (e.message || e))
      return { ok: false }
    }
  })
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
        e.sender.send('chat:permissao', { id, req, titulo: p.titulo, tipo: p.tipo, pergunta: p.pergunta || null })
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
  // Anexo em PEDAÇOS (versão web): o arquivo inteiro numa mensagem só passava do teto da ponte (40 MB, e em base64 vira 33% maior) e um vídeo
  // derrubava a conexão. A tela manda pedaços de 4 MB e o app vai gravando no disco do computador/VM do cliente.
  const uploads = new Map() // id -> { destino, t }
  const dirAnexos = (chat) => {
    const dir = path.join(app.getPath('userData'), 'conversas', String(chat || 'sem-chat').replace(/[^\w.-]/g, '_'), 'anexos')
    fs.mkdirSync(dir, { recursive: true })
    return dir
  }
  ipcMain.handle('anexo:inicio', (_e, { chat, nome }) => {
    for (const [k, u] of uploads) if (Date.now() - u.t > 60 * 60 * 1000) uploads.delete(k) // upload abandonado há 1 h
    const limpo = String(nome || 'arquivo').replace(/[\/:*?"<>|]/g, '_')
    const destino = path.join(dirAnexos(chat), Date.now().toString(36) + '-' + limpo)
    fs.writeFileSync(destino, '')
    const id = require('crypto').randomBytes(9).toString('hex')
    uploads.set(id, { destino, t: Date.now() })
    return { id }
  })
  ipcMain.handle('anexo:pedaco', (_e, { id, bytes }) => {
    const u = uploads.get(id)
    if (!u) throw new Error('envio do anexo não encontrado')
    fs.appendFileSync(u.destino, Buffer.from(bytes))
    u.t = Date.now()
    return true
  })
  ipcMain.handle('anexo:fim', (_e, { id }) => {
    const u = uploads.get(id)
    if (!u) throw new Error('envio do anexo não encontrado')
    uploads.delete(id)
    return u.destino
  })
  // leitura em pedaços (web): baixar um vídeo grande e mostrar a prévia sem uma mensagem gigante pela ponte
  ipcMain.handle('arquivo:lerPedaco', (_e, { p, ini = 0, tam = 4 * 1024 * 1024 }) => {
    try {
      const total = fs.statSync(p).size
      const n = Math.max(0, Math.min(tam, 8 * 1024 * 1024, total - ini))
      const buf = Buffer.alloc(n)
      const fd = fs.openSync(p, 'r')
      try {
        fs.readSync(fd, buf, 0, n, ini)
      } finally {
        fs.closeSync(fd)
      }
      return { ok: true, base64: buf.toString('base64'), total, ini, n }
    } catch {
      return { ok: false }
    }
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
  for (const r of reservas.splice(0)) r.encerrar()
  if (process.platform !== 'darwin') app.quit()
})
