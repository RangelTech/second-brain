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
const CUE_MEMORIA = /\b(lembra|lembrar|lembro|conversamos|falamos|combinamos|combinado|j[aá] te (disse|falei|contei|pedi)|outro dia|aquilo que|ontem|semana passada|da outra vez|antes eu)\b/i

const USAR_AGENTE = {
  type: 'function',
  function: {
    name: 'usar_agente',
    description: 'Passa o pedido ao agente com ferramentas reais (arquivos, comandos, navegador, web, geração de imagem e vídeo, skills). Chame SEM escrever nenhum texto antes quando o pedido exigir qualquer uma dessas coisas.',
    parameters: { type: 'object', properties: { motivo: { type: 'string', description: 'Em poucas palavras, o que precisa ser feito.' } }, required: ['motivo'] },
  },
}

function classificar(texto, anexos = []) {
  if (anexos.length) return 'agente'
  const t = String(texto || '')
  if (CAMINHO.test(t) || URL_RE.test(t) || ACAO_FORTE.test(t)) return 'agente'
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
  if (!raciocinio || raciocinio === 'none') corpo.chat_template_kwargs = { enable_thinking: false }
  const res = await fetch(`${base.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(chave ? { Authorization: `Bearer ${chave}` } : {}) },
    body: JSON.stringify(corpo),
    signal: sinal,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
  const leitor = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let total = ''
  let escalar = false
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
        if (d.tool_calls?.length) escalar = true
        const raz = d.reasoning_content ?? d.reasoning
        if (raz) onDelta?.({ raciocinio: raz })
        if (d.content && !escalar) {
          total += d.content
          onDelta?.({ texto: d.content })
        }
      } catch {}
    }
  }
  return { escalar, texto: total }
}

module.exports = { classificar, responderRapido, resumoDeSkills, memoriaRelevante }
