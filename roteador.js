// Roteador do modo Agente: o pedido que não precisa de ferramenta (conversa, explicação, código em texto, tradução, "você lembra de...")
// é respondido numa chamada direta ao modelo, sem subir o laço do Hermes. Nada é cortado: a memória das conversas antigas entra no
// contexto sozinha, a lista de skills vai no prompt e o próprio modelo tem uma porta de escape (`usar_agente`) que passa o pedido ao
// Hermes quando ele precisa de arquivo, comando, web, mídia ou skill. Assim a resposta simples sai em segundos e a tarefa real continua igual.
const fs = require('fs')
const path = require('path')

// casos que obviamente são trabalho de agente: nem vale gastar a ida e volta do modelo
const CAMINHO = /(\b[a-z]:[\\/]|\\\\|(^|\s)~[\\/]|(^|\s)\/(users|home|etc|var|tmp|mnt)\/|\.(pdf|docx?|xlsx?|pptx?|csv|json|zip|png|jpe?g|mp4|py|js|ts|html|sql|md|txt)\b)/i
const URL_RE = /https?:\/\/|www\./i
const ACAO_FORTE = /\b(pesquis[ae]\w* (na|pela|no) (web|internet|google)|busqu?e\w* (na|pela|no) (web|internet|google)|navegu?e|abr[ae] o (site|navegador)|gere? (uma |um )?(imagem|foto|v[ií]deo)|cri[ae]r? (uma |um )?(imagem|foto|v[ií]deo|arquivo|pasta|site|planilha|apresenta[cç][aã]o)|salv[ae]\w* (em|num|no|na) |execut[ae]\w* (o |a |este |esse )?(comando|script|programa)|rod[ae]\w* (o |a |este |esse )?(comando|script|teste)|instal[ae]\w* |baix[ae]\w* |apag[ae]\w* (o |a |os |as )?(arquivo|pasta)|liste? (os )?arquivos|na minha (m[aá]quina|pasta|tela)|meu computador|git (commit|push|pull|clone))\b/i
const VERBO_ACAO = /\b(ger[ae]\w*|cri[ae]\w*|fa[cç]\w*|fez|mont[ae]\w*|constru\w*|anim[ae]\w*|edit[ae]\w*|salv[ae]\w*|convert\w*|baix[ae]\w*|sub[ae]\w*|instal\w*|rod[ae]\w*|execut\w*|abr[ae]\w*|apag\w*|mov[ae]\w*|renome\w*|desenh\w*|produz\w*|program\w*|deploy\w*|publiq\w*|envie\w*|envia\w*|exporte\w*|transforme\w*|coloque\w*|ponha\w*|troque\w*|substitu\w*|refa[cç]\w*)\b/i
const SUBSTANTIVO_PRODUCAO = /\b(v[ií]deo\w*|imagem|imagens|foto\w*|figura|ilustra[cç]\w*|logo\w*|banner\w*|capa|avatar|arquivo\w*|pasta\w*|site\w*|p[aá]gina\w*|planilha\w*|pdf|docx?|word|excel|powerpoint|pptx?|apresenta[cç]\w*|slide\w*|script\w*|programa\w*|aplicativo\w*|app|api|docker|container\w*|servidor\w*|banco de dados|metabase|git|commit|reposit[oó]rio|terminal|comando\w*|pip|npm|processo\w*|porta)\b/i
const ANIMA = /\banim[ae]\w*\b/i
const CUE_MEMORIA = /\b(lembra|lembrar|lembro|conversamos|falamos|combinamos|combinado|j[aá] te (disse|falei|contei|pedi)|outro dia|aquilo que|ontem|semana passada|da outra vez|antes eu)\b/i

const USAR_AGENTE = {
  type: 'function',
  function: {
    name: 'usar_agente',
    description: 'Passa o pedido ao agente com ferramentas reais (arquivos, comandos, navegador, web, geração de imagem e vídeo, skills). Chame SEM escrever nenhum texto antes quando o pedido exigir qualquer uma dessas coisas.',
    parameters: { type: 'object', properties: { motivo: { type: 'string', description: 'Em poucas palavras, o que precisa ser feito.' } }, required: ['motivo'] },
  },
}

// O modelo do caminho rápido não cria nada. Se a resposta AFIRMA que criou/salvou/gerou um arquivo (nome com extensão, "Arquivo:", "salvo em"), é invenção.
const AFIRMA_ARQUIVO = /(\barquivo\s*[:=]|\bsalv[oa]s?\s+(em|na|no)\b|\bcaminho\s*[:=]|\bgerei\b|\bcriei\b|\banimei\b|\bsalvei\b|\bpronto!?|\bv[ií]deo pronto)/i
const NOME_ARQUIVO = /\b[\w\-]{3,}\.(mp4|mov|webm|png|jpe?g|webp|gif|pdf|docx?|xlsx?|pptx?|zip|html?|py|js|ts|csv|txt)\b/i
const afirmaArquivo = (texto) => AFIRMA_ARQUIVO.test(String(texto || '')) && NOME_ARQUIVO.test(String(texto || ''))

// o modelo pode chamar usar_agente depois de já ter respondido (resposta completa + chamada à toa): nesse caso a resposta vale e o Hermes não roda de novo.
// Só escala quando ainda não há resposta de verdade (nada escrito, ou só uma frase de preâmbulo como "Vou criar o arquivo").
const PREAMBULO_MAX = 160
const deveEscalar = (textoJaEscrito) => String(textoJaEscrito || '').trim().length < PREAMBULO_MAX

// Loop degenerado: o modelo repete a mesma palavra ou o mesmo trecho sem parar. Devolve onde o loop começa (mantendo uma ocorrência) ou -1.
function inicioDoLoop(texto) {
  const cauda = String(texto || '').slice(-1200)
  const m = /(\S[\s\S]{2,60}?)\1{5,}$/.exec(cauda)
  if (!m) return -1
  const inicio = texto.length - cauda.length + m.index
  return inicio + m[1].length
}

// Continuação automática do app e respostas curtas ("sim", "pode fazer") só fazem sentido com o contexto do agente: nunca vão para o caminho rápido.
const CONTINUACAO = /^\s*(continue exatamente|continue|continua|prossiga|pode (seguir|continuar|fazer|ir)|segue|vai l[aá]|manda ver|faz isso|fa[cç]a isso|isso mesmo|sim|ok|beleza|certo|pode sim)\b/i
const MAX_PALAVRAS_CURTA = 10

// `emAgente`: este chat já tem um agente vivo (a sessão guarda o histórico de ferramentas). Mensagem curta nesse chat continua com ele.
function classificar(texto, anexos = [], { emAgente = false } = {}) {
  if (anexos.length) return 'agente'
  const t = String(texto || '')
  if (CONTINUACAO.test(t)) return 'agente'
  if (emAgente && t.trim().split(/\s+/).filter(Boolean).length <= MAX_PALAVRAS_CURTA && !/\?\s*$/.test(t.trim())) return 'agente'
  if (CAMINHO.test(t) || URL_RE.test(t) || ACAO_FORTE.test(t) || ANIMA.test(t) || (VERBO_ACAO.test(t) && SUBSTANTIVO_PRODUCAO.test(t))) return 'agente'
  return 'rapido'
}

// nomes e uma linha de descrição das skills instaladas (cache de 60 s); só para o modelo saber quando escalar
let cacheSkills = { em: 0, texto: '' }
function resumoDeSkills(raiz) {
  if (Date.now() - cacheSkills.em < 60000) return cacheSkills.texto
  const itens = []
  const andar = (dir, nivel) => {
    let ls = []
    try {
      ls = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    const sk = ls.find((e) => e.isFile() && e.name === 'SKILL.md')
    if (sk) {
      try {
        const cab = fs.readFileSync(path.join(dir, sk.name), 'utf8').slice(0, 1200)
        const nome = (cab.match(/^name:\s*(.+)$/m) || [])[1] || path.basename(dir)
        const desc = ((cab.match(/^description:\s*(.+)$/m) || [])[1] || '').replace(/^["'>|\s-]+/, '').slice(0, 90)
        itens.push(`${nome.trim()}${desc ? ' (' + desc + ')' : ''}`)
      } catch {}
      return
    }
    if (nivel < 3) for (const e of ls) if (e.isDirectory() && !e.name.startsWith('.')) andar(path.join(dir, e.name), nivel + 1)
  }
  andar(raiz, 0)
  cacheSkills = { em: Date.now(), texto: itens.slice(0, 80).join('; ') }
  return cacheSkills.texto
}

function memoriaRelevante({ arquivo, texto, chat }) {
  try {
    process.env.SB_MEMORIA_ARQ = arquivo
    const mem = require('./mcp-memoria')
    const cue = CUE_MEMORIA.test(texto)
    const achados = mem.buscar(texto, { limite: cue ? 8 : 5, incluirAtual: true }).filter((d) => d.chat !== chat && (cue || d.pontuacao >= 7))
    if (!achados.length) return ''
    return achados.slice(0, cue ? 5 : 3).map((d) => `- (${new Date(d.quando || 0).toLocaleDateString('pt-BR')}, conversa "${d.titulo}", ${d.papel === 'user' ? 'usuário' : 'assistente'}) ${d.texto.slice(0, 500).replace(/\s+/g, ' ')}`).join('\n')
  } catch {
    return ''
  }
}

function sistema({ usuario, skills, memoria }) {
  return [
    'Você é o Segundo Cérebro, o assistente pessoal da Rangel Tech. Responda em português do Brasil, direto e útil, sem enrolação; na dúvida entre curto e longo, prefira o que o usuário realmente precisa.',
    `Usuário: ${usuario}. Data e hora: ${new Date().toLocaleString('pt-BR')}.`,
    'Você responde sozinho conhecimento geral, conversa, explicações, tradução, resumo de texto colado, matemática e código escrito no próprio chat.',
    'VOCÊ NÃO CRIA, SALVA NEM GERA ARQUIVOS, IMAGENS OU VÍDEOS: nunca diga que fez, salvou, gerou ou animou algo, nem invente nome de arquivo ou caminho. Se o pedido pede qualquer produção ou ação no computador, chame `usar_agente` sem escrever texto.',
    'A única ferramenta que você tem é `usar_agente`. Chame-a, sem escrever texto antes, quando o pedido exigir: ler ou criar arquivos, rodar comandos, navegar ou pesquisar na web, informação de hoje/atual que você não tem, gerar imagem ou vídeo, ou usar uma skill especializada.',
    skills ? `Skills instaladas (se o pedido combinar com alguma, chame usar_agente): ${skills}` : '',
    memoria ? `Trechos de conversas antigas deste usuário que podem ser relevantes (use só se ajudarem; não diga que "buscou"):\n${memoria}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

// Retorna { escalar: boolean, texto: string }. Emite o texto ao vivo por onDelta, no mesmo formato do modo Conversa.
async function responderRapido({ base, chave, modelo, msgs, onDelta, sinal, raciocinio, memoriaArquivo, chat, skillsDir, usuario }) {
  const ultimo = [...msgs].reverse().find((m) => m.role === 'user')?.content || ''
  const mem = memoriaRelevante({ arquivo: memoriaArquivo, texto: String(ultimo), chat })
  const corpo = {
    model: modelo,
    stream: true,
    tools: [USAR_AGENTE],
    tool_choice: 'auto',
    messages: [{ role: 'system', content: sistema({ usuario, skills: resumoDeSkills(skillsDir), memoria: mem }) }, ...msgs.filter((m) => m.role !== 'system').slice(-24)],
  }
  // amostragem pensada para evitar loop de repetição (medida em 07/11/2026: 0 loops e 0 estouros em 12 respostas) e teto de tokens: resposta longa de verdade vai para o agente
  const pensando = !!raciocinio && raciocinio !== 'none'
  Object.assign(corpo, pensando ? { temperature: 1.0, top_p: 0.95, top_k: 20, presence_penalty: 0.5 } : { temperature: 0.7, top_p: 0.8, top_k: 20, presence_penalty: 0.8, repetition_penalty: 1.05 }, { max_tokens: 6000 })
  if (!pensando) corpo.chat_template_kwargs = { enable_thinking: false }
  const ctl = new AbortController()
  sinal?.addEventListener('abort', () => ctl.abort())
  const res = await fetch(`${base.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(chave ? { Authorization: `Bearer ${chave}` } : {}) },
    body: JSON.stringify(corpo),
    signal: ctl.signal,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
  const leitor = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let total = ''
  let escalar = false
  let loop = false
  for (;;) {
    let lido
    try {
      lido = await leitor.read()
    } catch (e) {
      if (loop) break // abortado de propósito por causa do loop
      throw e
    }
    const { done, value } = lido
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const linha = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (loop) break
      if (!linha.startsWith('data:')) continue
      const dado = linha.slice(5).trim()
      if (dado === '[DONE]') continue
      try {
        const d = JSON.parse(dado).choices?.[0]?.delta ?? {}
        if (d.tool_calls?.length && deveEscalar(total)) escalar = true
        const raz = d.reasoning_content ?? d.reasoning
        if (raz) onDelta?.({ raciocinio: raz })
        if (d.content && !escalar) {
          total += d.content
          onDelta?.({ texto: d.content })
          const ini = inicioDoLoop(total)
          if (ini >= 0) { // o modelo entrou em loop: corta aqui e para de gastar tokens
            total = total.slice(0, ini).trimEnd()
            ctl.abort()
            loop = true
          }
        }
      } catch {}
    }
  }
  return { escalar, texto: total, loop }
}

module.exports = { classificar, deveEscalar, inicioDoLoop, afirmaArquivo, responderRapido, resumoDeSkills, memoriaRelevante }
