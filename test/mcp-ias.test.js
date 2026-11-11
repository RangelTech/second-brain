// Servidor MCP "IAs" (Spec 25 §16): uma ferramenta, uma chamada; a IA é o combo do provedor; erro de limite de uso é claro e manda não repetir.
const test = require('node:test')
const assert = require('node:assert/strict')

process.env.SB_IAS_BASE = 'http://127.0.0.1:9/v1'
process.env.SB_IAS_CHAVE = 'chave-local'
process.env.SB_IAS_LISTA = JSON.stringify([{ id: 'claude', nome: 'Claude' }, { id: 'unlimited', nome: 'Unlimited (a IA da casa)' }])
const M = require('../mcp-ias.js')

test('uma ferramenta so, com as IAs conectadas na propria descricao (o Hermes nao precisa listar antes)', () => {
  const f = M.ferramentas()
  assert.equal(f.length, 1)
  assert.equal(f[0].name, 'ias_perguntar')
  assert.deepEqual(f[0].inputSchema.properties.ia.enum, ['claude', 'unlimited'])
  assert.match(f[0].description, /"claude" = Claude: muito forte em código/)
})

test('pergunta ao combo do provedor pelo roteador local, com a chave', async () => {
  let pedido = null
  const buscar = async (url, op) => {
    pedido = { url, op, corpo: JSON.parse(op.body) }
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'plano pronto' } }] }) }
  }
  const r = await M.perguntar({ ia: 'Claude', pedido: 'planeje isto' }, buscar)
  assert.match(r, /plano pronto/)
  assert.equal(pedido.url, 'http://127.0.0.1:9/v1/chat/completions')
  assert.equal(pedido.corpo.model, 'claude', 'o modelo pedido e o combo do provedor')
  assert.equal(pedido.op.headers.authorization, 'Bearer chave-local')
})

test('limite de uso da conta do usuario: mensagem clara, com o tempo, mandando NAO repetir', async () => {
  const buscar = async () => ({ ok: false, status: 503, json: async () => ({ error: { message: '[claude/claude-opus-5-5] [429]: rate_limit_error (reset after 32s)' } }) })
  await assert.rejects(() => M.perguntar({ ia: 'claude', pedido: 'oi' }, buscar), (e) => /limite de uso/.test(e.message) && /32 s/.test(e.message) && /NÃO tente de novo/.test(e.message))
})

test('IA nao conectada e pedido vazio dao erro claro', async () => {
  await assert.rejects(() => M.perguntar({ ia: 'gemini', pedido: 'oi' }, async () => ({})), /não está conectada/)
  await assert.rejects(() => M.perguntar({ ia: 'claude', pedido: '  ' }, async () => ({})), /vazio/)
})
