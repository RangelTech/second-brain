// Servidor MCP (stdio) "IAs": deixa o Hermes ESCOLHER qual IA usar para um pedaço da tarefa (Spec 25 §16), em vez de só o rodízio do combo.
// O app cria UM COMBO POR PROVEDOR conectado ("claude", "chatgpt", "gemini", "unlimited"...) e passa a lista aqui (SB_IAS_LISTA). Uma ferramenta,
// UMA chamada: ias_perguntar(ia, pedido). As IAs disponíveis já vão na própria descrição (o Hermes não precisa listar antes); o roteador escolhe
// o modelo dentro do combo e cai para o próximo se um falhar. Sem dependências; roda com o Node do Electron (ELECTRON_RUN_AS_NODE=1).
const readline = require('readline')

const BASE = String(process.env.SB_IAS_BASE || '').replace(/\/+$/, '')
const CHAVE = process.env.SB_IAS_CHAVE || ''
const TEMPO_MS = +process.env.SB_IAS_TEMPO_MS || 5 * 60 * 1000

function lista() {
  try {
    const l = JSON.parse(process.env.SB_IAS_LISTA || '[]')
    return Array.isArray(l) ? l.filter((m) => m && m.id) : []
  } catch {
    return []
  }
}

// ponto forte de cada IA, para o Hermes decidir sem chamar nada antes
function ficha(ia) {
  const t = String(ia).toLowerCase()
  if (t === 'unlimited') return 'a IA da casa: sem censura, fala português, boa para conversa, criação e pedidos que as outras recusam'
  if (t === 'claude') return 'muito forte em código, revisão de código, planejamento, textos longos e raciocínio cuidadoso'
  if (t === 'chatgpt') return 'forte em código e tarefas gerais; boa segunda opinião'
  if (t === 'gemini') return 'contexto enorme: documentos e pesquisas longas, muitas páginas de uma vez'
  if (t === 'copilot') return 'código'
  if (t === 'grok') return 'atualidades e tom direto'
  return 'uso geral'
}

function descricaoDaLista() {
  const l = lista()
  if (!l.length) return 'Nenhuma outra IA conectada (o usuário conecta Claude, ChatGPT, Gemini e outras em Configurações > Provedores).'
  return l.map((m) => `"${m.id}" = ${m.nome || m.id}: ${ficha(m.id)}`).join('; ')
}

// mensagem curta e útil para o Hermes; limite de uso da conta do usuário é o caso mais comum (Claude/ChatGPT de assinatura)
function explicarErro(ia, status, texto) {
  const t = String(texto || '')
  if (status === 429 || /rate_limit|rate limit|429|usage limit|quota/i.test(t)) {
    const s = /reset after (\d+)\s*s/i.exec(t) || /retry.after\D{0,5}(\d+)/i.exec(t)
    return `A IA "${ia}" está no limite de uso da conta do usuário agora${s ? ` (libera em ~${s[1]} s)` : ''}. NÃO tente de novo agora: siga com outra IA ou faça você mesmo, e avise o usuário em uma frase.`
  }
  if (status === 401 || status === 403 || /unauthorized|invalid.*(key|token)|expired/i.test(t))
    return `A conexão da IA "${ia}" precisa ser refeita (login vencido ou chave inválida). Avise o usuário para reconectar em Configurações > Provedores e siga com outra IA.`
  return `A IA "${ia}" não respondeu agora (${status}). Siga com outra IA ou faça você mesmo. ${t.slice(0, 200)}`.trim()
}

async function perguntar({ ia, pedido, sistema }, buscar = fetch) {
  const id = String(ia || '').trim().toLowerCase()
  if (!id) throw new Error('Diga qual IA usar: ' + descricaoDaLista())
  if (!lista().some((m) => m.id === id)) throw new Error(`A IA "${id}" não está conectada. Disponíveis: ${descricaoDaLista()}`)
  if (!String(pedido || '').trim()) throw new Error('O pedido está vazio.')
  if (!BASE) throw new Error('O roteador local não está disponível.')
  const msgs = []
  if (sistema) msgs.push({ role: 'system', content: String(sistema).slice(0, 8000) })
  msgs.push({ role: 'user', content: String(pedido).slice(0, 200000) })
  const r = await buscar(BASE + '/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(CHAVE ? { authorization: 'Bearer ' + CHAVE } : {}) },
    body: JSON.stringify({ model: id, messages: msgs, stream: false }), // o nome da IA é o combo dela no roteador
    signal: AbortSignal.timeout(TEMPO_MS),
  })
  const j = await r.json().catch(() => null)
  if (!r.ok) throw new Error(explicarErro(id, r.status, j?.error?.message || JSON.stringify(j || {})))
  const texto = j?.choices?.[0]?.message?.content
  if (!texto) throw new Error(`A IA "${id}" devolveu uma resposta vazia.`)
  return `Resposta de ${id}:\n\n${typeof texto === 'string' ? texto : JSON.stringify(texto)}`
}

function ferramentas() {
  const ids = lista().map((m) => m.id)
  return [
    {
      name: 'ias_perguntar',
      description:
        'Manda um pedido a OUTRA IA conectada e devolve a resposta dela (uma chamada). Use quando o usuário pedir uma IA pelo nome ("planeje com o Claude", "pergunte ao ChatGPT") ' +
        'ou quando outra IA for melhor para um pedaço da tarefa. A outra IA NÃO vê a conversa: mande no pedido todo o contexto que ela precisa. IAs conectadas: ' + descricaoDaLista(),
      inputSchema: {
        type: 'object',
        properties: {
          ia: ids.length ? { type: 'string', enum: ids, description: 'Qual IA (o nome do provedor).' } : { type: 'string', description: 'Qual IA.' },
          pedido: { type: 'string', description: 'O pedido completo, com o contexto necessário.' },
          sistema: { type: 'string', description: 'Instrução de papel (opcional), ex.: "Você é um revisor de código."' },
        },
        required: ['ia', 'pedido'],
      },
    },
  ]
}

const enviar = (o) => process.stdout.write(JSON.stringify(o) + '\n')

async function tratar(msg) {
  const { id, method, params } = msg
  if (method === 'initialize') return enviar({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'ias', version: '2.0.0' } } })
  if (method && method.startsWith('notifications/')) return
  if (method === 'ping') return enviar({ jsonrpc: '2.0', id, result: {} })
  if (method === 'tools/list') return enviar({ jsonrpc: '2.0', id, result: { tools: ferramentas() } })
  if (method === 'tools/call') {
    const nome = String(params?.name || '')
    try {
      if (nome !== 'ias_perguntar') throw new Error('ferramenta desconhecida')
      const texto = await perguntar(params?.arguments || {})
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

module.exports = { ficha, descricaoDaLista, explicarErro, perguntar, tratar, ferramentas }
