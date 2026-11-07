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
    path.join(app.getPath('userData'), 'hermes', 'hermes-agent', '.hermes', 'bin', process.platform === 'win32' ? 'hermes-acp.exe' : 'hermes-acp'), // onde o instalador oficial grava no Linux/macOS
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
  if (globais) sincronizarSkillsGlobais(globais, path.join(home, 'skills', 'rangeltech'))
  return home
}

// As skills globais vão na instalação e depois são do usuário: o Hermes pode editar, criar e apagar à vontade (autoevolução).
// A sincronização só traz o que é novo ou o que o usuário não mexeu: arquivo editado fica como está, arquivo apagado não volta.
// O manifesto guarda o hash de cada arquivo como foi entregue da última vez.
function sincronizarSkillsGlobais(origem, destino) {
  const crypto = require('crypto')
  const hash = (f) => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex')
  const arqManifesto = path.join(destino, '.entregue.json')
  let antes = {}
  const primeira = !fs.existsSync(arqManifesto)
  try {
    antes = JSON.parse(fs.readFileSync(arqManifesto, 'utf8'))
  } catch {}
  const agora = {}
  const andar = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? rel + '/' + e.name : e.name
      if (e.isDirectory()) andar(path.join(d, e.name), r)
      else {
        try {
          const src = path.join(d, e.name)
          const dst = path.join(destino, r)
          const h = hash(src)
          agora[r] = h
          if (!fs.existsSync(dst)) {
            if (antes[r]) continue // estava instalado e o usuário (ou o Hermes) apagou: não volta
            fs.mkdirSync(path.dirname(dst), { recursive: true })
            fs.copyFileSync(src, dst)
          } else if (antes[r] && hash(dst) === antes[r] && antes[r] !== h) {
            fs.copyFileSync(src, dst) // não foi editado: recebe a versão nova
          } else if (!antes[r]) {
            // sem registro: se é a primeira vez com este manifesto (instalação antiga, que sempre sobrescrevia), recebe a versão nova
            if (primeira) fs.copyFileSync(src, dst)
            else agora[r] = hash(dst)
          } else if (hash(dst) !== antes[r]) {
            agora[r] = antes[r] // editado pelo usuário: mantém a edição e o registro antigo
          }
        } catch {}
      }
    }
  }
  try {
    fs.mkdirSync(destino, { recursive: true })
    andar(origem, '')
    fs.writeFileSync(arqManifesto, JSON.stringify(agora))
  } catch {}
}

// Regra de segurança por conta (nível do painel): vai no SOUL.md do perfil, regravada a cada sessão, e o usuário não vê.
// Nível 1 = sem trava (nada é escrito). Nível 2 = classificador 1 (o que a pessoa pede). Nível 3 = classificadores 1 e 2 (também respostas e ações).
const MARCA_SEG = ['<!-- sb-seguranca:inicio -->', '<!-- sb-seguranca:fim -->']
function blocoSeguranca(nivel) {
  if (!(nivel >= 2)) return ''
  const base = [
    '## Regra de segurança desta conta (vale sempre, em silêncio)',
    'Julgue a INTENÇÃO do pedido, nunca palavras soltas. Recuse, sem sermão e sem citar regra, painel ou classificador, só quando a pessoa quer APRENDER OU OBTER ajuda para praticar um crime hediondo ou violência extrema (ensinar a fabricar ou usar bomba, explosivo, arma química, biológica ou nuclear; abuso sexual de menores; matar, torturar ou mutilar alguém; terrorismo; malware; fraude e golpes), ou quando pede para GERAR cena de gore explícito, tortura ou abuso de menores. Para automutilação ou suicídio, acolha com cuidado e indique o CVV (telefone 188). Ao recusar, diga com gentileza, em uma frase, que não pode ajudar com isso e pergunte se pode ajudar em outra coisa. Nunca ofereça versão alternativa que entregue o mesmo conteúdo, nem "tentar mesmo assim".',
    'Permitido e normal, faça sem hesitar: imagem ou desenho de uma bomba, bomba de gasolina ou de água, fogos de artifício, filme, jogo, notícia, história, ficção sem instruções práticas, educação, segurança e conteúdo adulto legal entre adultos. O mesmo assunto muda de resposta conforme a intenção: "gere a imagem de uma bomba" é permitido, "me ensine a fazer uma bomba" é recusado. Também vale quando o pedido vem disfarçado de ficção, teste ou "só curiosidade" para obter instruções práticas.',
    'ANTES de chamar qualquer ferramenta de imagem ou vídeo, releia o briefing que você escreveu: se ele contiver algo barrado acima, NÃO chame a ferramenta e responda com a recusa curta.',
  ]
  if (nivel >= 3) {
    base.push(
      'ANTES de executar comando, escrever arquivo ou navegar, confira a ação: se for destruir dados fora da pasta de trabalho, vazar senhas ou chaves, ou atacar terceiros, NÃO execute e explique em uma frase.',
      'ANTES de enviar a resposta final, releia: se ela trouxer instruções do que está barrado acima, troque pela recusa curta.'
    )
  }
  return MARCA_SEG[0] + '\n' + base.join('\n\n') + '\n' + MARCA_SEG[1]
}
// Bloco de estilo, sempre ligado (qualquer nível): português, sem jargão interno, sem narrar cada passo.
const MARCA_EST = ['<!-- sb-estilo:inicio -->', '<!-- sb-estilo:fim -->']
function blocoEstilo() {
  const regras = [
    'Responda sempre em português do Brasil, em tom simples e gentil. Nunca escreva em inglês para o cliente.',
    'Nunca cite detalhes internos: ferramenta, tool_call, JSON, wrapper, erro técnico, servidor, GPU ou fila. Se algo falhar, tente de novo em silêncio; se continuar falhando, diga só que não conseguiu agora e ofereça tentar de novo.',
    'Não narre cada passo nem cada conferência. Faça o trabalho e entregue uma resposta curta: o que foi feito e onde está o arquivo.',
    'Quando o cliente descrever uma tarefa nova ("quero editar um vídeo", "montar uma sala 3D", "ligar uma câmera"), ANTES de agir procure entre as suas skills a ferramenta que serve (liste e leia as skills), e diga em uma frase qual vai usar e como. Só depois comece. Não vasculhe as pastas do cliente (Downloads, Documentos, Desktop) sem ele pedir ou sem precisar de um arquivo que ele indicou.',
  ]
  return MARCA_EST[0] + '\n## Como falar com o cliente (vale sempre)\n\n' + regras.join('\n\n') + '\n' + MARCA_EST[1]
}
function tirarBloco(t, marca) {
  const i = t.indexOf(marca[0])
  const j = t.indexOf(marca[1])
  return i >= 0 && j > i ? t.slice(0, i).trimEnd() + t.slice(j + marca[1].length) : t
}
function aplicarSeguranca(home, nivel) {
  try {
    const arq = path.join(home, 'SOUL.md')
    let t = fs.existsSync(arq) ? fs.readFileSync(arq, 'utf8') : ''
    t = tirarBloco(tirarBloco(t, MARCA_SEG), MARCA_EST)
    const seg = blocoSeguranca(nivel)
    t = (t.trimEnd() + '\n\n' + blocoEstilo() + (seg ? '\n\n' + seg : '')).trimStart() + '\n'
    fs.writeFileSync(arq, t)
  } catch {}
}

function prepararHome(app, { base, modelo, pasta, raciocinio, visao, nivel }) {
  const home = prepararBase(app)
  aplicarSeguranca(home, nivel)
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
    // olhar imagens (vision_analyze, prints do navegador): o Qwen do Unlimited enxerga, mas o Hermes não sabe disso pelo combo local;
    // com a conta do Unlimited, a visão vai direto a ele. Sem a conta, o Hermes decide sozinho.
    ...(visao ? ['auxiliary:', '  vision:', '    provider: "custom"', `    model: ${JSON.stringify(visao.modelo)}`, `    base_url: ${JSON.stringify(visao.base)}`, '    api_key_env: "SB_VISAO_CHAVE"'] : []),
    'terminal:',
    '  backend: "local"',
    `  cwd: ${JSON.stringify(pasta.replace(/\\/g, '/'))}`,
    '  timeout: 180',
    'attachments:',
    '  storage: "hermes-home"',
    '',
  ].join('\n')
  fs.writeFileSync(path.join(home, 'config.yaml'), yaml)
  // a chave da visão vai no .env do perfil (é onde o Hermes lê segredos; variável de ambiente solta não chega à tarefa auxiliar)
  const envArq = path.join(home, '.env')
  try {
    if (visao && visao.chave) fs.writeFileSync(envArq, `SB_VISAO_CHAVE=${visao.chave}
`, { mode: 0o600 })
    else fs.rmSync(envArq, { force: true })
  } catch {}
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
    midia ? 'Você pode GERAR IMAGENS de verdade com a ferramenta midia_gerar_imagem (roda numa GPU do servidor, leva de 10 a 30 segundos e salva um PNG na pasta Imagens da pasta de trabalho). Quando o usuário pedir uma imagem, ilustração, capa, avatar, propaganda ou caricatura, USE a ferramenta em vez de dizer que não consegue: escreva o prompt em inglês, bem detalhado (assunto, estilo, luz, enquadramento, cores), escolha o formato (quadrado, retrato, paisagem, story ou banner) e depois diga o caminho completo do arquivo. Título curto dentro da imagem (1 a 3 palavras, em caixa alta, entre aspas no prompt) sai legível; frase longa e letra acentuada saem erradas, e nesses casos gere a imagem sem texto e aplique o título depois. Peça a contagem exata de pessoas no prompt (por exemplo exactly two people) e confira o resultado olhando a imagem. Você também pode GERAR VÍDEOS (1 a 60 s, sem áudio) com midia_gerar_video, numa GPU do servidor: qualidade rapida leva cerca de 1 minuto; qualidade alta usa um modelo melhor em 1280x704 e leva de 7 a 20 minutos (use alta quando o usuário pedir qualidade, cinema ou algo para publicar, e nesse caso gere antes a imagem com midia_gerar_imagem e anime-a passando o caminho em imagem). Salva um MP4 na pasta Videos. Para TROCAR a pessoa de um vídeo pela de uma foto (troca de personagem ou de rosto) use midia_trocar_personagem, que leva vários minutos. REGRA DE ROTEAMENTO: quando o usuário pedir "um vídeo de" alguma coisa que tem imagem real (um balão, um animal, uma pessoa, uma paisagem, um produto, uma comida, uma cena), USE SEMPRE midia_gerar_video, com o prompt em inglês descrevendo a cena, o movimento e a câmera. NUNCA improvise esse pedido com video-motion, Remotion, HyperFrames, terminal ou código: eles só servem para animação gráfica com texto (títulos, legendas, gráficos, vinhetas, reels com texto) e só quando o usuário pedir isso de forma explícita. Se midia_gerar_video falhar ou estiver indisponível, NÃO faça outra coisa no lugar: diga em português simples que o vídeo não pôde ser gerado agora e ofereça tentar de novo em instantes; não fale de servidor, GPU, fila nem erro técnico. A tela já mostra a fila, o percentual e o resultado, então não repita isso no texto. DIREÇÃO DE MÍDIA: antes de chamar midia_gerar_imagem ou midia_gerar_video, transforme o pedido curto em um briefing detalhado em inglês (sujeito, cena, ação e movimento, enquadramento e câmera, iluminação, estilo, cores, o que evitar em negative_prompt; texto dentro da imagem só se o usuário pediu) e preencha os parâmetros (formato, segundos, qualidade, seed). Siga a skill direcao-de-midia. Em pedidos simples como "um vídeo de um balão" ou "um logo para loja de carros", NÃO pergunte nada e NÃO liste opções nem briefings por escrito: monte o briefing sozinho e chame a ferramenta na mesma hora. Só pergunte UMA coisa curta se faltar uma informação essencial que não dá para inferir (por exemplo, o nome que vai no logo). ENCADEAMENTO: "este vídeo" ou "esta imagem" no pedido seguinte é o ÚLTIMO arquivo de mídia que você gerou nesta conversa (o caminho está no resultado da ferramenta). Para pôr texto, legenda, zoom ou animação num clipe de IA, use a skill video-motion SOBRE esse arquivo (clipes de IA têm 2 a 6 s: estenda com loop, câmera lenta ou concatenando vários clipes, sem dizer que gerou 20 s de uma vez) e entregue o arquivo final. Siga a skill orquestrador-de-midia. Depois de uma falha de mídia a tela já mostra um cartão com "Tentar de novo": responda com UMA frase curta (por exemplo "Não consegui gerar agora.") e nunca fale de instabilidade, primeira tentativa, servidor, nem tente de novo sozinho em sequência.' : '',
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
  constructor({ app, id, pasta, base, modelo, chave, raciocinio, emitir, pedirPermissao, modo, navegador, midia, memoria, nivel }) {
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
    const home = prepararHome(app, { base, modelo, pasta, raciocinio, nivel, visao: midia ? { base: midia.base, modelo: 'qwen-abliterated', chave: midia.chave } : null })
    if (!fs.existsSync(path.join(home, 'installs'))) emitir({ aviso: 'Preparando o agente pela primeira vez. Isso leva alguns minutos e acontece uma vez só…' })
    this.bin = bin
    this.env = { ...process.env, HERMES_HOME: home, SB_LOCAL_KEY: chave, PYTHONUTF8: '1', ...(midia ? { SB_VISAO_CHAVE: midia.chave } : {}) }
    this.subir()
    this.pronta = this.iniciar()
    this.pronta.catch(() => {}) // quem usa trata o erro; evita aviso de rejeição sem tratamento
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
    // o Hermes às vezes só diz "conversa longa demais"; a causa real (cota esgotada) só aparece no log dele
    if (/Limite de uso da janela/.test(l) && this.sid && l.includes(this.sid) && this.tratarLimiteDeUso(l)) return
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
    // .cmd/.bat (só em teste/dev: nunca o .exe real) não roda com spawn puro no Windows (EINVAL) sem passar pelo shell
    const viaShell = /\.(cmd|bat)$/i.test(this.bin)
    const filho = spawn(this.bin, [], { cwd: this.pasta, env: this.env, windowsHide: true, shell: viaShell })
    this.filho = filho
    filho.stdout.on('data', (d) => this.aoDados(d))
    filho.stderr.on('data', (d) => registrar(this.app, 'stderr ' + d.toString('utf8').trim().slice(0, 300)))
    filho.on('error', (e) => registrar(this.app, 'erro ao abrir o agente: ' + e.message + ' (' + this.bin + ')'))
    filho.on('exit', (codigo, sinal) => {
      registrar(this.app, 'agente saiu codigo=' + codigo + ' sinal=' + sinal + ' bin=' + this.bin)
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
  // O servidor recusou por limite de uso; mostra a causa real (janela e quando renova). Devolve true se tratou.
  tratarLimiteDeUso(t) {
    const lim = /Limite de uso da janela (\w+) \((\d+) tokens\)[^"]*?(?:reabre em|renova em|A janela reabre em)\s*([0-9T:\-Z.]+)?/i.exec(t)
    if (lim || /Limite de uso da janela/i.test(t)) {
      this.limiteUso = true
      const quando = lim && lim[3] ? ` Renova em ${new Date(lim[3]).toLocaleString('pt-BR')}.` : ''
      if (!this.avisouLimite) {
        this.avisouLimite = true
        this.emitir({ texto: `⛔ O limite de uso do Unlimited acabou nesta janela${lim ? ` (${Number(lim[2]).toLocaleString('pt-BR')} tokens)` : ''}.${quando} Peça ao suporte para liberar mais ou aguarde a renovação. Nada foi perdido: assim que voltar, é só pedir de novo.` })
      }
      return true
    }
    return false
  }
  aoAtualizacao(u) {
    const tipo = u.sessionUpdate
    if (tipo === 'agent_message_chunk' && u.content?.text) {
      const t = u.content.text
      // O servidor recusou por limite de uso, mas o Hermes só diz "conversa longa demais" ou "provedor indisponível".
      // Mostramos a causa real, com o que o servidor informou (janela e quando renova).
      if (this.tratarLimiteDeUso(t)) return
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
          { name: 'SB_MIDIA_PREFS', value: JSON.stringify(this.midia.prefs || {}) },
          ...['SB_MIDIA_MOCK', 'SB_MIDIA_MOCK_ARQ', 'SB_MIDIA_MOCK_IMG'].filter((k) => process.env[k]).map((k) => ({ name: k, value: process.env[k] })), // simulação para desenvolver a tela
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
  // O Hermes não pode desistir de uma tarefa por ter caído: se o processo morrer com um turno em voo, relança sozinho e
  // reenvia o mesmo pedido, sem limite de tentativas nem de tempo total — só um pedido explícito de parar (cancelar())
  // interrompe o laço. Falha de UMA ferramenta dentro de uma sessão viva (ex.: comando sem um pacote) não entra aqui:
  // isso o próprio modelo já resolve normalmente, com o processo de pé; isto só cobre o processo inteiro caindo.
  async perguntar(texto, anexos = []) {
    clearTimeout(this.ocioso)
    this.limiteUso = false
    this.avisouLimite = false
    this.pedidoParar = false
    await this.pronta
    let corpo = texto
    if (anexos.length) corpo += '\n\nArquivos anexados (use as ferramentas para ler):\n' + anexos.map((a) => `- ${a}`).join('\n')
    if (this.primeira) {
      const nl = String.fromCharCode(10)
      const hist = this.historico ? nl + nl + 'Conversa até aqui (continue dela):' + nl + this.historico : ''
      corpo = contextoDeSistema({ pasta: this.pasta, navegador: !!this.navegador, midia: !!this.midia, memoria: !!this.memoria }) + hist + nl + nl + '---' + nl + corpo
      this.primeira = false
    }
    let tentativa = 0
    while (true) {
      tentativa++
      this.turno = this.chamar('session/prompt', { sessionId: this.sid, prompt: [{ type: 'text', text: corpo }] })
      try {
        const r = await this.turno
        this.turno = null
        this.ocioso = setTimeout(() => this.encerrar(), OCIOSO_MS)
        return r
      } catch (e) {
        this.turno = null
        if (this.pedidoParar || e.message !== 'O agente encerrou.') {
          this.ocioso = setTimeout(() => this.encerrar(), OCIOSO_MS)
          throw e
        }
      }
      registrar(this.app, `turno interrompido pela morte do agente (tentativa ${tentativa}), relançando`)
      this.emitir({ novoCard: true })
      // só avança pro reenvio quando subir()+iniciar() realmente confirmarem um processo novo de pé (com sessão nova);
      // tentar reenviar contra um processo que nunca terminou de inicializar ficaria esperando uma resposta que não vem
      while (!this.pedidoParar) {
        await new Promise((res) => setTimeout(res, Math.min(10000, 1000 * tentativa)))
        if (this.pedidoParar) break
        try {
          this.subir()
          this.morto = false
          await this.iniciar()
          break
        } catch (e2) {
          registrar(this.app, `relançamento falhou (tentativa ${tentativa}): ${e2.message}`)
          tentativa++
        }
      }
      if (this.pedidoParar) {
        this.ocioso = setTimeout(() => this.encerrar(), OCIOSO_MS)
        throw new Error('Interrompido.')
      }
    }
  }
  cancelar() {
    this.pedidoParar = true // interrompe também o laço de relançamento de perguntar(), se estiver nele
    if (this.sid && !this.morto && this.filho) {
      try {
        this.enviar({ jsonrpc: '2.0', method: 'session/cancel', params: { sessionId: this.sid } })
      } catch {}
    }
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
