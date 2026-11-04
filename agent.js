// Agente de verdade: cliente ACP (Agent Client Protocol) falando com o Hermes por stdio.
// Um processo por conversa, com sessão contínua, cancelamento e permissões mostradas na tela.
const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const OCIOSO_MS = 10 * 60 * 1000
const CONTEXTO_REAL = 131072
const COMPRIMIR_EM = 72000
const PODAR_EM = 48000

function localizarBinario(app) {
  const candidatos = [
    process.env.SECOND_BRAIN_HERMES_BIN,
    path.join(app.getPath('userData'), 'hermes', 'bin', process.platform === 'win32' ? 'hermes-acp.exe' : 'hermes-acp'),
    path.join(os.homedir(), 'hermes', 'bin', process.platform === 'win32' ? 'hermes-acp.exe' : 'hermes-acp'),
    path.join(os.homedir(), '.local', 'bin', 'hermes-acp'),
  ].filter(Boolean)
  return candidatos.find((c) => fs.existsSync(c)) || null
}

// HERMES_HOME próprio do app. Na primeira vez traz skills, memória e SOUL.md da instalação do piloto;
// a cada início atualiza as skills globais da Rangel Tech (somente leitura) dentro de skills/rangeltech.
function prepararBase(app) {
  const home = path.join(app.getPath('userData'), 'hermes-home')
  fs.mkdirSync(path.join(home, 'skills'), { recursive: true })
  const piloto = path.join(os.homedir(), 'hermes')
  const marca = path.join(home, '.migrado')
  if (!fs.existsSync(marca) && fs.existsSync(piloto)) {
    for (const item of ['skills', 'memories', 'SOUL.md']) {
      try {
        if (fs.existsSync(path.join(piloto, item))) fs.cpSync(path.join(piloto, item), path.join(home, item), { recursive: true, force: false })
      } catch {}
    }
    fs.writeFileSync(marca, new Date().toISOString())
  }
  const globais = [path.join(process.resourcesPath || '', 'skills-globais', 'rangeltech'), path.join(__dirname, 'skills-globais', 'rangeltech')].find((p) => fs.existsSync(p))
  if (globais) {
    try {
      fs.cpSync(globais, path.join(home, 'skills', 'rangeltech'), { recursive: true, force: true })
    } catch {}
  }
  return home
}

function prepararHome(app, { base, modelo, pasta, raciocinio }) {
  const home = prepararBase(app)
  // a configuração é escrita pelo app, nunca à mão: o modelo é o combo do motor local
  const yaml = [
    '_config_version: 52',
    'model:',
    `  default: ${JSON.stringify(modelo || 'principal')}`,
    '  provider: "custom"',
    `  base_url: ${JSON.stringify(base)}`,
    '  api_key: ${SB_LOCAL_KEY}',
    // o servidor Unlimited só aceita 131072 tokens por pedido; sem isto o Hermes acha que são 262144, estoura e
    // gasta minutos numa compressão de emergência com o usuário olhando para a tela parada
    `  context_length: ${CONTEXTO_REAL}`,
    'compression:',
    '  enabled: true',
    `  threshold_tokens: ${COMPRIMIR_EM}`, // comprime cedo: o resumo fica pequeno e rápido
    `  proactive_prune_tokens: ${PODAR_EM}`, // antes disso, só poda resultados velhos de ferramenta (não chama o modelo)
    '  target_ratio: 0.15',
    'agent:',
    `  reasoning_effort: ${JSON.stringify(raciocinio || 'none')}`,
    'terminal:',
    '  backend: "local"',
    `  cwd: ${JSON.stringify(pasta.replace(/\\/g, '/'))}`,
    '  timeout: 180',
    'attachments:',
    '  storage: "hermes-home"',
    '',
  ].join('\n')
  fs.writeFileSync(path.join(home, 'config.yaml'), yaml)
  return home
}

// Modos de permissão (o usuário escolhe no chat). Devolve 'permitir' (nem pergunta) ou 'perguntar'.
const SO_LEITURA = new Set(['read', 'search', 'fetch', 'think'])
const COMANDO_RISCO = /\b(rm|rmdir|del|erase|rd|mv|move|chmod|chown|sudo|su|kill|taskkill|shutdown|reboot|format|mkfs|dd|curl|wget|scp|rsync|ssh|pip|pip3|npm|npx|yarn|pnpm|apt|apt-get|brew|choco|winget|docker|kubectl|git\s+(push|reset|clean|checkout|rebase)|reg|netsh|powershell\s+.*(remove|delete)|Remove-Item)\b|>\s*[~/\\]|\|\s*(sh|bash)\b/i
function caminhoDe(tc) {
  const r = tc.rawInput?.arguments || tc.rawInput || {}
  return tc.locations?.[0]?.path || tc.content?.find((c) => c.path)?.path || r.path || r.file_path || r.filepath || null
}
function textoDe(tc) {
  const r = tc.rawInput?.arguments || tc.rawInput || {}
  return String(r.command || r.cmd || r.code || tc.title || '')
}
function dentroDe(pasta, alvo) {
  if (!alvo) return false
  const rel = path.relative(path.resolve(pasta), path.resolve(alvo))
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel)
}
function decidirPermissao(modo, tc, pasta) {
  if (modo === 'ignorar') return 'permitir'
  if (modo === 'manual') return 'perguntar'
  const kind = tc.kind || 'other'
  if (SO_LEITURA.has(kind)) return 'permitir'
  if (kind === 'edit') return dentroDe(pasta, caminhoDe(tc)) ? 'permitir' : 'perguntar'
  if (modo === 'editar') return 'perguntar' // comandos, apagar e mover continuam perguntando
  if (modo === 'auto' && kind === 'execute') return COMANDO_RISCO.test(textoDe(tc)) ? 'perguntar' : 'permitir'
  return 'perguntar'
}

function contextoDeSistema({ pasta, ferramentas, navegador, midia, memoria }) {
  const agora = new Date()
  return [
    'Você é o Segundo Cérebro, o agente do aplicativo de desktop da Rangel Tech. Responda em português do Brasil, de forma direta.',
    `Sistema operacional: ${os.type()} ${os.release()} (${process.platform}). Usuário: ${os.userInfo().username}. Pasta pessoal: ${os.homedir()}.`,
    `Pasta de trabalho: ${pasta}. Crie e edite arquivos nela, a menos que o usuário peça outra pasta.`,
    `Data e hora: ${agora.toLocaleString('pt-BR')}.`,
    'Você tem ferramentas reais: leia e escreva arquivos (inclusive extrair texto de PDF, Word e planilha), liste pastas, rode comandos, busque na web e abra arquivos. USE as ferramentas em vez de dizer que não consegue acessar a máquina do usuário.',
    'Antes de apagar arquivos, escrever fora da pasta de trabalho ou rodar comandos perigosos, peça confirmação. Quando criar um arquivo, diga o caminho completo.',
    'Ao criar arquivos grandes, NÃO escreva tudo numa só chamada: divida em partes de no máximo ~150 linhas (crie o esqueleto e depois acrescente ou edite por partes). Chamadas gigantes deixam o usuário minutos sem ver andamento e podem estourar o tempo.',
    'NUNCA diga que algo está pronto sem VERIFICAR. Depois de criar código ou uma página, confira que funciona: para JavaScript extraia o script e rode `node --check`; para HTML abra no Chrome ou Edge sem janela (headless) e leia os erros do console, ou tire uma captura e olhe. Se houver erro, corrija e confira de novo. Só então responda, dizendo o que você verificou.',
    navegador ? 'Você tem um NAVEGADOR INTEGRADO que o usuário vê na tela ao lado do chat. Para abrir sites, clicar, preencher formulários, ler páginas e tirar capturas de tela, use as ferramentas do servidor "navegador" (navegador_abrir, navegador_ler, navegador_clicar, navegador_digitar, navegador_rolar, navegador_print, navegador_voltar, navegador_esperar, navegador_js). Comece com navegador_abrir, depois navegador_ler para ver a página e os elementos clicáveis (cada um tem um id), e use navegador_print para VER a página de verdade (depois olhe a imagem com vision_analyze no caminho devolvido). Prefira essas ferramentas ao navegador próprio do Hermes.' : '',
    midia ? 'Você pode GERAR IMAGENS de verdade com a ferramenta midia_gerar_imagem (roda numa GPU do servidor, leva de 10 a 30 segundos e salva um PNG na pasta Imagens da pasta de trabalho). Quando o usuário pedir uma imagem, ilustração, capa, avatar, propaganda ou caricatura, USE a ferramenta em vez de dizer que não consegue: escreva o prompt em inglês, bem detalhado (assunto, estilo, luz, enquadramento, cores), escolha o formato (quadrado, retrato, paisagem, story ou banner) e depois diga o caminho completo do arquivo. Texto escrito dentro da imagem costuma sair com letras erradas: gere a imagem sem texto e avise que o título pode ser aplicado depois.' : '',
    memoria ? 'Você tem MEMÓRIA das conversas antigas com este usuário: a ferramenta memoria_buscar procura nelas pelos assuntos. Quando ele perguntar "você lembra de...", "aquilo que conversamos", "o que ficou combinado" ou citar algo que não está nesta conversa, USE memoria_buscar (com palavras-chave do assunto) antes de responder; se precisar de mais contexto de um trecho, memoria_ler_conversa. Nunca diga que não lembra sem ter buscado. Diga de qual conversa e data veio a informação.' : '',
    ferramentas ? `Skills e ferramentas: ${ferramentas}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function registrar(app, linha) {
  try {
    const dir = path.join(app.getPath('userData'), 'logs')
    fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(path.join(dir, 'agente.log'), new Date().toISOString() + ' ' + linha + '\n')
  } catch {}
}

class Sessao {
  constructor({ app, id, pasta, base, modelo, chave, raciocinio, emitir, pedirPermissao, modo, navegador, midia, memoria }) {
    this.app = app
    this.id = id
    this.pasta = pasta
    this.modo = modo || (() => 'manual') // 'manual' | 'editar' | 'auto' | 'ignorar'
    this.navegador = navegador || null // { url, token }: servidor local das ferramentas do navegador integrado
    this.memoria = memoria || null // { arquivo }: conversas do app, para a ferramenta de memória
    this.midia = midia || null // { base, chave }: API de imagens do servidor (Unlimited); some se o app ainda não tem chave
    this.emitir = emitir
    this.pedirPermissao = pedirPermissao
    this.permitirSempre = false
    this.pendentes = new Map()
    this.proxId = 1
    this.buf = ''
    this.sid = null
    this.primeira = true
    this.turno = null
    this.ocioso = null
    const bin = localizarBinario(app)
    if (!bin) throw new Error('Não encontrei o Hermes (hermes-acp). Instale o Hermes ou defina SECOND_BRAIN_HERMES_BIN.')
    const home = prepararHome(app, { base, modelo, pasta, raciocinio })
    if (!fs.existsSync(path.join(home, 'installs'))) emitir({ aviso: 'Preparando o agente pela primeira vez. Isso leva alguns minutos e acontece uma vez só…' })
    this.bin = bin
    this.env = { ...process.env, HERMES_HOME: home, SB_LOCAL_KEY: chave, PYTHONUTF8: '1' }
    this.subir()
    this.pronta = this.iniciar()
    this.vigiarCompressao()
  }

  // O Hermes não avisa pelo protocolo quando compacta o contexto (a chamada leva de segundos a minutos),
  // só escreve no agent.log dele. Lemos o que entra nesse arquivo para a tela mostrar o relógio.
  vigiarCompressao() {
    const arq = path.join(this.env.HERMES_HOME, 'logs', 'agent.log')
    let pos = 0
    try {
      pos = fs.statSync(arq).size
    } catch {}
    this.vigia = setInterval(() => {
      try {
        const tam = fs.statSync(arq).size
        if (tam < pos) pos = 0 // arquivo girou
        if (tam === pos) return
        const ini = Math.max(pos, tam - 1048576)
        const fd = fs.openSync(arq, 'r')
        const buf = Buffer.alloc(tam - ini)
        fs.readSync(fd, buf, 0, buf.length, ini)
        fs.closeSync(fd)
        pos = tam
        for (const l of buf.toString('utf8').split('\n')) this.aoLogDoHermes(l)
      } catch {}
    }, 1000)
    this.vigia.unref?.()
  }
  aoLogDoHermes(l) {
    const m = /context compression (started|done): session=(\S+) .*?(?:messages=(\d+)(?:->(\d+))?)?\s.*?(?:rough_)?tokens=~([\d,]+)/.exec(l)
    const falhou = /Context compression failed/.test(l) && l.includes(this.sid || '\u0000')
    if (!m && !falhou) return
    const sessao = m ? m[2] : this.sid
    // o log é compartilhado por todos os agentes: só vale a compactação desta conversa (ou o auto-reset dela)
    if (sessao !== this.sid && !(this.turno && !/^local-/.test(sessao))) return
    if (falhou) return this.emitir({ compactando: { fase: 'fim' } })
    const tokens = Number(m[5].replace(/,/g, ''))
    if (m[1] === 'started') this.emitir({ compactando: { fase: 'inicio', tokens } })
    else {
      this.emitir({ compactando: { fase: 'fim', depois: tokens } })
      this.emitir({ contexto: { usado: tokens, tamanho: CONTEXTO_REAL } })
    }
  }

  // sobe (ou sobe de novo) o processo do Hermes
  subir() {
    this.buf = ''
    const filho = spawn(this.bin, [], { cwd: this.pasta, env: this.env, windowsHide: true })
    this.filho = filho
    filho.stdout.on('data', (d) => this.aoDados(d))
    filho.stderr.on('data', (d) => registrar(this.app, 'stderr ' + d.toString('utf8').trim().slice(0, 300)))
    filho.on('exit', () => {
      if (this.filho !== filho) return // foi substituído de propósito
      for (const p of this.pendentes.values()) p.rej(new Error('O agente encerrou.'))
      this.pendentes.clear()
      this.morto = true
    })
  }

  enviar(o) {
    registrar(this.app, '> ' + JSON.stringify(o).slice(0, 300))
    this.filho.stdin.write(JSON.stringify(o) + '\n')
  }
  chamar(method, params) {
    const id = this.proxId++
    return new Promise((res, rej) => {
      this.pendentes.set(id, { res, rej })
      this.enviar({ jsonrpc: '2.0', id, method, params })
    })
  }
  aoDados(d) {
    this.buf += d.toString('utf8')
    let i
    while ((i = this.buf.indexOf('\n')) >= 0) {
      const l = this.buf.slice(0, i).trim()
      this.buf = this.buf.slice(i + 1)
      if (!l) continue
      let j
      try {
        j = JSON.parse(l)
      } catch {
        continue
      }
      registrar(this.app, '< ' + l.slice(0, j.method === 'session/request_permission' ? 2000 : 300))
      this.tratar(j)
    }
  }
  async tratar(j) {
    if (j.id !== undefined && !j.method) {
      const p = this.pendentes.get(j.id)
      if (!p) return
      this.pendentes.delete(j.id)
      return j.error ? p.rej(new Error(j.error.data?.details || j.error.message)) : p.res(j.result)
    }
    if (j.method === 'session/update') return this.aoAtualizacao(j.params?.update || {})
    if (j.method === 'session/request_permission') {
      const op = j.params.options || []
      const escolha = async () => {
        const permitir = op.find((o) => o.kind === 'allow_always') || op.find((o) => o.kind === 'allow_once') || op[0]
        if (this.permitirSempre) return permitir.optionId
        // o modo de permissão escolhido pelo usuário decide se a pergunta nem chega a aparecer
        if (decidirPermissao(this.modo(), j.params.toolCall || {}, this.pasta) === 'permitir') return (op.find((o) => o.kind === 'allow_once') || permitir).optionId
        const r = await this.pedirPermissao({ chat: this.id, titulo: j.params.toolCall?.title || 'Ação do agente', tipo: j.params.toolCall?.kind, opcoes: op })
        if (r === 'sempre') {
          this.permitirSempre = true
          return permitir.optionId
        }
        if (r === 'permitir') return (op.find((o) => o.kind === 'allow_once') || permitir).optionId
        return (op.find((o) => o.kind === 'reject_once') || op.find((o) => /reject/.test(o.kind)) || op[op.length - 1]).optionId
      }
      const optionId = await escolha()
      return this.enviar({ jsonrpc: '2.0', id: j.id, result: { outcome: { outcome: 'selected', optionId } } })
    }
    // pedidos do agente que o app não implementa: resposta vazia de erro para não travar
    if (j.id !== undefined && j.method) this.enviar({ jsonrpc: '2.0', id: j.id, error: { code: -32601, message: 'não suportado' } })
  }
  aoAtualizacao(u) {
    const tipo = u.sessionUpdate
    if (tipo === 'agent_message_chunk' && u.content?.text) {
      const t = u.content.text
      // O servidor recusou por limite de uso, mas o Hermes só diz "conversa longa demais" ou "provedor indisponível".
      // Mostramos a causa real, com o que o servidor informou (janela e quando renova).
      const lim = /Limite de uso da janela (\w+) \((\d+) tokens\)[^"]*?(?:reabre em|renova em|A janela reabre em)\s*([0-9T:\-Z.]+)?/i.exec(t)
      if (lim || /Limite de uso da janela/i.test(t)) {
        this.limiteUso = true
        const quando = lim && lim[3] ? ` Renova em ${new Date(lim[3]).toLocaleString('pt-BR')}.` : ''
        if (!this.avisouLimite) {
          this.avisouLimite = true
          this.emitir({ texto: `⛔ O limite de uso do Unlimited acabou nesta janela${lim ? ` (${Number(lim[2]).toLocaleString('pt-BR')} tokens)` : ''}.${quando} Peça ao suporte para liberar mais ou aguarde a renovação. Nada foi perdido: assim que voltar, é só pedir de novo.` })
        }
        return
      }
      if (this.limiteUso && /grown too long|auto-?reset|compress/i.test(t)) return // eco enganoso do mesmo problema
      this.emitir({ texto: t })
    }
    else if (tipo === 'agent_thought_chunk' && u.content?.text) this.emitir({ raciocinio: u.content.text })
    else if (tipo === 'usage_update' && u.used >= 0) this.emitir({ contexto: { usado: u.used, tamanho: u.size || CONTEXTO_REAL } })
    else if (tipo === 'tool_call' || tipo === 'tool_call_update') {
      const conteudo = (u.content || [])
        .map((c) => c.content?.text || c.text || (c.type === 'diff' ? `${c.path}\n${c.newText || ''}` : ''))
        .filter(Boolean)
        .join('\n')
      this.emitir({
        ferramenta: {
          id: u.toolCallId,
          titulo: u.title,
          tipo: u.kind,
          status: u.status,
          conteudo: conteudo.slice(0, 4000),
          caminho: u.locations?.[0]?.path || null,
          entrada: u.rawInput ? JSON.stringify(u.rawInput).slice(0, 600) : null,
        },
      })
    }
  }
  // Na primeira vez o Hermes monta o ambiente e às vezes o session/new não responde: se passar do prazo,
  // reinicia o processo (o ambiente já está pronto) e tenta de novo, até 3 vezes.
  comPrazo(promessa, ms) {
    return Promise.race([promessa, new Promise((_, rej) => setTimeout(() => rej(new Error('prazo')), ms))])
  }
  async iniciar() {
    let ultimo
    // ambiente já montado: o normal é responder em segundos, então tentativas curtas (reinicia o processo e tenta de novo)
    // "montado" só vale depois de uma sessão já ter respondido nesta pasta; antes disso a 1ª subida leva minutos (prazo longo)
    const marca = path.join(this.env.HERMES_HOME, 'pronto.ok')
    const montado = fs.existsSync(marca)
    const TENTATIVAS = montado ? 5 : 3
    for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
      try {
        const prazo = process.env.SB_TESTE_PRAZO ? +process.env.SB_TESTE_PRAZO : montado ? 35000 : tentativa === 1 ? 240000 : 90000
        const t0 = Date.now()
        await this.comPrazo(this.chamar('initialize', { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } } }), prazo)
        const r = await this.comPrazo(this.chamar('session/new', { cwd: this.pasta, mcpServers: this.servidoresMcp() }), prazo)
        this.sid = r.sessionId
        registrar(this.app, `agente pronto em ${((Date.now() - t0) / 1000).toFixed(1)} s (tentativa ${tentativa})`)
        try { fs.writeFileSync(marca, new Date().toISOString()) } catch {}
        return
      } catch (e) {
        ultimo = e
        registrar(this.app, `iniciar falhou (tentativa ${tentativa}): ${e.message}`)
        if (e.message !== 'prazo') throw e
        if (tentativa < TENTATIVAS) this.emitir({ aviso: 'Preparando o agente… só um instante.' })
        const antigo = this.filho
        this.pendentes.clear()
        this.subir()
        try {
          antigo.kill()
        } catch {}
      }
    }
    throw new Error('O agente não respondeu ao iniciar: ' + (ultimo?.message || 'sem detalhe'))
  }
  // ferramentas do navegador integrado: um servidor MCP (stdio) que repassa as chamadas ao app
  servidoresMcp() {
    const lista = []
    if (this.memoria) {
      const shimMem = [path.join(process.resourcesPath || '', 'mcp-memoria.js'), path.join(__dirname, 'mcp-memoria.js')].find((p) => fs.existsSync(p)) || path.join(__dirname, 'mcp-memoria.js')
      lista.push({
        name: 'memoria',
        command: process.execPath,
        args: [shimMem],
        env: [
          { name: 'ELECTRON_RUN_AS_NODE', value: '1' },
          { name: 'SB_MEMORIA_ARQ', value: this.memoria.arquivo },
          { name: 'SB_MEMORIA_CHAT', value: this.id },
        ],
      })
    }
    if (this.midia) {
      const shimM = [path.join(process.resourcesPath || '', 'mcp-midia.js'), path.join(__dirname, 'mcp-midia.js')].find((p) => fs.existsSync(p)) || path.join(__dirname, 'mcp-midia.js')
      lista.push({
        name: 'midia',
        command: process.execPath,
        args: [shimM],
        env: [
          { name: 'ELECTRON_RUN_AS_NODE', value: '1' },
          { name: 'SB_MIDIA_BASE', value: this.midia.base },
          { name: 'SB_MIDIA_CHAVE', value: this.midia.chave },
          { name: 'SB_MIDIA_PASTA', value: this.pasta },
        ],
      })
    }
    if (!this.navegador) return lista
    const shim = [path.join(process.resourcesPath || '', 'mcp-navegador.js'), path.join(__dirname, 'mcp-navegador.js')].find((p) => fs.existsSync(p)) || path.join(__dirname, 'mcp-navegador.js')
    return [
      ...lista,
      {
        name: 'navegador',
        command: process.execPath,
        args: [shim],
        env: [
          { name: 'ELECTRON_RUN_AS_NODE', value: '1' },
          { name: 'SB_NAV_URL', value: this.navegador.url },
          { name: 'SB_NAV_TOKEN', value: this.navegador.token },
        ],
      },
    ]
  }
  async perguntar(texto, anexos = []) {
    clearTimeout(this.ocioso)
    this.limiteUso = false
    this.avisouLimite = false
    await this.pronta
    let corpo = texto
    if (anexos.length) corpo += '\n\nArquivos anexados (use as ferramentas para ler):\n' + anexos.map((a) => `- ${a}`).join('\n')
    if (this.primeira) {
      const nl = String.fromCharCode(10)
      const hist = this.historico ? nl + nl + 'Conversa até aqui (continue dela):' + nl + this.historico : ''
      corpo = contextoDeSistema({ pasta: this.pasta, navegador: !!this.navegador, midia: !!this.midia, memoria: !!this.memoria }) + hist + nl + nl + '---' + nl + corpo
      this.primeira = false
    }
    this.turno = this.chamar('session/prompt', { sessionId: this.sid, prompt: [{ type: 'text', text: corpo }] })
    try {
      return await this.turno
    } finally {
      this.turno = null
      this.ocioso = setTimeout(() => this.encerrar(), OCIOSO_MS)
    }
  }
  cancelar() {
    if (this.sid) this.enviar({ jsonrpc: '2.0', method: 'session/cancel', params: { sessionId: this.sid } })
  }
  encerrar() {
    clearTimeout(this.ocioso)
    clearInterval(this.vigia)
    try {
      this.filho.kill()
    } catch {}
  }
}

module.exports = { Sessao, localizarBinario, prepararBase, registrar }
