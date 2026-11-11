// Servidor MCP (stdio) de memória: o agente consulta as conversas antigas do usuário quando ele pergunta "você lembra do que
// conversamos sobre ...?". Busca por relevância (BM25) só nos trechos que combinam, nunca carrega tudo no contexto.
// Roda local, sem rede e sem dependências; lê o arquivo de conversas do app (SB_MEMORIA_ARQ) e guarda o índice em memória
// enquanto o arquivo não muda. Roda com o Node do Electron (ELECTRON_RUN_AS_NODE=1).
const readline = require('readline')
const fs = require('fs')

const ARQ = process.env.SB_MEMORIA_ARQ || ''
const ATUAL = process.env.SB_MEMORIA_CHAT || ''
// sessão reserva (Spec 26): o processo nasce sem conversa e o app grava aqui de qual conversa ele passou a ser
const chatAtual = () => {
  try {
    if (process.env.SB_VAGA_ARQ) return fs.readFileSync(process.env.SB_VAGA_ARQ, 'utf8').trim() || ATUAL
  } catch {}
  return ATUAL
}
const TRECHO_MAX = 700
const PARADAS = new Set('a o as os um uma uns umas de do da dos das em no na nos nas por para com sem que e ou mas se eu tu ele ela nos voce voces me te lhe meu minha seu sua isso isto aquilo esse essa este esta aquele aquela ja foi ser era tem ter vai vou como mais muito pra pro the and for you'.split(' '))

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const tokens = (s) => semAcento(s).split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !PARADAS.has(t))

let cache = { mtime: 0, docs: [], df: new Map(), avg: 1 }

function ler() {
  if (!ARQ || !fs.existsSync(ARQ)) return []
  try {
    return JSON.parse(fs.readFileSync(ARQ, 'utf8'))
  } catch {
    return []
  }
}

function indice() {
  const st = fs.existsSync(ARQ) ? fs.statSync(ARQ).mtimeMs : 0
  if (st && st === cache.mtime) return cache
  const docs = []
  for (const c of ler()) {
    const msgs = c.msgs || []
    msgs.forEach((m, i) => {
      const texto = String(m.content || '').trim()
      if (!texto) return
      // trechos de até ~TRECHO_MAX caracteres, quebrando em parágrafo
      let atual = ''
      const empurra = () => {
        if (atual.trim()) docs.push({ chat: c.id, titulo: c.titulo || 'Conversa', quando: m.em || c.em || 0, papel: m.role, i, texto: atual.trim(), tk: tokens(atual) })
        atual = ''
      }
      for (const p of texto.split(/\n{2,}/)) {
        if (atual && atual.length + p.length > TRECHO_MAX) empurra()
        atual += (atual ? '\n\n' : '') + p
        while (atual.length > TRECHO_MAX * 1.6) {
          docs.push({ chat: c.id, titulo: c.titulo || 'Conversa', quando: m.em || c.em || 0, papel: m.role, i, texto: atual.slice(0, TRECHO_MAX), tk: tokens(atual.slice(0, TRECHO_MAX)) })
          atual = atual.slice(TRECHO_MAX)
        }
      }
      empurra()
    })
  }
  const df = new Map()
  let soma = 0
  for (const d of docs) {
    soma += d.tk.length
    for (const t of new Set(d.tk)) df.set(t, (df.get(t) || 0) + 1)
  }
  cache = { mtime: st, docs, df, avg: docs.length ? soma / docs.length : 1 }
  return cache
}

function buscar(consulta, { limite = 6, incluirAtual = false } = {}) {
  const { docs, df, avg } = indice()
  const q = [...new Set(tokens(consulta))]
  if (!q.length) return []
  const N = docs.length
  const k1 = 1.4
  const b = 0.75
  const agora = Date.now()
  const pontos = []
  for (const d of docs) {
    if (!incluirAtual && d.chat === chatAtual()) continue
    const freq = new Map()
    for (const t of d.tk) freq.set(t, (freq.get(t) || 0) + 1)
    let s = 0
    let achou = 0
    for (const t of q) {
      const f = freq.get(t)
      if (!f) continue
      achou++
      const idf = Math.log(1 + (N - (df.get(t) || 0) + 0.5) / ((df.get(t) || 0) + 0.5))
      s += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.tk.length) / avg)))
    }
    if (!s) continue
    s *= 1 + 0.4 * (achou / q.length) // premia o trecho que tem vários termos da pergunta
    if (d.papel === 'user') s *= 1.1 // o que o próprio usuário disse pesa um pouco mais
    s *= 1 + 0.15 / (1 + (agora - d.quando) / (30 * 86400000)) // desempate leve a favor do recente
    pontos.push([s, d])
  }
  pontos.sort((x, y) => y[0] - x[0])
  return pontos.slice(0, limite).map(([s, d]) => ({ ...d, pontuacao: s }))
}

const data = (t) => (t ? new Date(t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'data desconhecida')

function formatar(r) {
  if (!r.length) return 'Não achei nada nas conversas antigas sobre isso. Tente outras palavras ou pergunte ao usuário.'
  return r.map((d, n) => `[${n + 1}] ${data(d.quando)} · conversa "${d.titulo}" (id ${d.chat}) · ${d.papel === 'user' ? 'usuário' : 'assistente'}:\n${d.texto.slice(0, TRECHO_MAX)}`).join('\n\n---\n\n')
}

function lerConversa(id, ao_redor, qtd = 6) {
  const c = ler().find((x) => x.id === id)
  if (!c) return 'Conversa não encontrada.'
  const msgs = c.msgs || []
  const centro = Number.isInteger(ao_redor) ? ao_redor : 0
  const ini = Math.max(0, centro - Math.floor(qtd / 2))
  return `Conversa "${c.titulo}" (${msgs.length} mensagens):\n\n` + msgs.slice(ini, ini + qtd).map((m, k) => `#${ini + k} ${data(m.em)} ${m.role === 'user' ? 'usuário' : 'assistente'}: ${String(m.content || '').slice(0, 1200)}`).join('\n\n')
}

const obj = (props, req = []) => ({ type: 'object', properties: props, required: req })
const FERRAMENTAS = [
  {
    nome: 'buscar',
    desc: 'Procura nas conversas antigas com o usuário (memória de longo prazo). Use quando ele perguntar "você lembra de...", "aquilo que conversamos", "o que ficou combinado" ou citar algo que não está nesta conversa. Devolve os trechos mais relevantes com data e conversa. Faça a consulta com as palavras-chave do assunto, sem frase inteira.',
    schema: obj({ consulta: { type: 'string', description: 'Palavras-chave do que procurar (ex.: "contrato capital certo prazo").' }, limite: { type: 'number', description: 'Quantos trechos devolver (padrão 6, máximo 12).' } }, ['consulta']),
  },
  {
    nome: 'ler_conversa',
    desc: 'Lê mais mensagens de uma conversa antiga encontrada por memoria_buscar, em volta de uma mensagem (use o id da conversa e o número depois de # se tiver).',
    schema: obj({ id: { type: 'string' }, mensagem: { type: 'number', description: 'Índice da mensagem central (opcional).' }, quantas: { type: 'number', description: 'Quantas mensagens (padrão 6, máximo 20).' } }, ['id']),
  },
]

const enviar = (o) => process.stdout.write(JSON.stringify(o) + '\n')

async function tratar(msg) {
  const { id, method, params } = msg
  if (method === 'initialize') return enviar({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'memoria', version: '1.0.0' } } })
  if (method && method.startsWith('notifications/')) return
  if (method === 'ping') return enviar({ jsonrpc: '2.0', id, result: {} })
  if (method === 'tools/list') return enviar({ jsonrpc: '2.0', id, result: { tools: FERRAMENTAS.map((f) => ({ name: 'memoria_' + f.nome, description: f.desc, inputSchema: f.schema })) } })
  if (method === 'tools/call') {
    const nome = String(params?.name || '').replace(/^memoria_/, '')
    const a = params?.arguments || {}
    try {
      let texto
      if (nome === 'buscar') texto = formatar(buscar(a.consulta, { limite: Math.max(1, Math.min(12, +a.limite || 6)) }))
      else if (nome === 'ler_conversa') texto = lerConversa(String(a.id || ''), Number.isInteger(a.mensagem) ? a.mensagem : undefined, Math.max(1, Math.min(20, +a.quantas || 6)))
      else throw new Error('ferramenta desconhecida')
      return enviar({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: texto }] } })
    } catch (e) {
      return enviar({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: String(e.message || e) }] } })
    }
  }
  if (id !== undefined) enviar({ jsonrpc: '2.0', id, error: { code: -32601, message: 'método não suportado' } })
}

if (require.main === module) {
  readline.createInterface({ input: process.stdin }).on('line', (l) => {
    let m
    try {
      m = JSON.parse(l)
    } catch {
      return
    }
    tratar(m).catch((e) => m.id !== undefined && enviar({ jsonrpc: '2.0', id: m.id, error: { code: -32603, message: String(e.message || e) } }))
  })
}

module.exports = { buscar, formatar, tokens }
