// Planejador na ponte (spec 40): plano no começo de cada pedido de agente com a IA Unlimited; reinserido nos passos seguintes do mesmo pedido.
const test = require('node:test')
const assert = require('node:assert')
const http = require('node:http')
const { criar, deveriaPlanejar, comPlano } = require('../ponte-llm')

const TOOLS = [{ type: 'function', function: { name: 'terminal', parameters: {} } }]
const PEDIDO = 'Crie uma planilha com as vendas de outubro a partir dos arquivos da pasta Vendas e me mande o resumo <!--sb:abc123-->'

test('deveriaPlanejar: só pedido de verdade, com ferramentas, com a Unlimited e com a última mensagem do usuário', () => {
  const base = { model: 'un/qwen-abliterated', tools: TOOLS, messages: [{ role: 'system', content: 's' }, { role: 'user', content: PEDIDO }] }
  assert.ok(deveriaPlanejar(base).startsWith('Crie uma planilha'))
  assert.strictEqual(deveriaPlanejar({ ...base, tools: [] }), null)
  assert.strictEqual(deveriaPlanejar({ ...base, model: 'cc/claude-sonnet-5-5' }), null)
  assert.strictEqual(deveriaPlanejar({ ...base, messages: [...base.messages, { role: 'assistant', content: 'x' }] }), null)
  assert.strictEqual(deveriaPlanejar({ ...base, messages: [{ role: 'system', content: 's' }, { role: 'user', content: 'oi, tudo bem com você hoje? quero saber de uma coisa' }] }), null)
})

test('comPlano vai no FIM da última mensagem (o começo do pedido não muda: cache de prefixo vale)', () => {
  const j = comPlano({ messages: [{ role: 'system', content: 'base' }, { role: 'user', content: 'u' }] }, '1. fazer')
  assert.strictEqual(j.messages[0].content, 'base')
  assert.strictEqual(j.messages.filter((m) => m.role === 'system').length, 1)
  assert.ok(j.messages[1].content.startsWith('u') && j.messages[1].content.includes('PLANO DE EXECUÇÃO') && j.messages[1].content.includes('1. fazer'))
  const k = comPlano({ messages: [{ role: 'system', content: 'base' }, { role: 'user', content: 'u' }, { role: 'tool', content: 'ok' }] }, '1. fazer')
  assert.ok(k.messages[2].content.includes('1. fazer') && !k.messages[1].content.includes('1. fazer'))
})

test('ponte pede o plano 1x e reinsere nos passos seguintes do mesmo pedido', async () => {
  const recebidos = []
  const destino = http.createServer((req, res) => {
    const p = []
    req.on('data', (c) => p.push(c))
    req.on('end', () => { recebidos.push(JSON.parse(Buffer.concat(p).toString())); res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}') })
  })
  await new Promise((ok) => destino.listen(0, '127.0.0.1', ok))
  let chamadas = 0
  const ponte = criar({ destino: `http://127.0.0.1:${destino.address().port}`, aoProgresso: () => {}, planejador: async () => { chamadas++; return '1. listar a pasta\n2. montar a planilha' } })
  const porta = await ponte.iniciar()
  const enviar = (corpo) => fetch(`http://127.0.0.1:${porta}/v1/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) })
  const passo1 = { model: 'un/qwen-abliterated', tools: TOOLS, messages: [{ role: 'system', content: 'base' }, { role: 'user', content: PEDIDO }] }
  const t0 = Date.now()
  await enviar(passo1)
  assert.ok(Date.now() - t0 < 2000, 'o 1º passo não espera o plano')
  await new Promise((ok) => setTimeout(ok, 50))
  await enviar({ ...passo1, messages: [...passo1.messages, { role: 'assistant', content: '', tool_calls: [] }, { role: 'tool', content: 'ok' }] })
  assert.strictEqual(chamadas, 1)
  assert.ok(!JSON.stringify(recebidos[0]).includes('1. listar a pasta'), '1º passo sai sem plano (não esperou)')
  assert.strictEqual(recebidos[1].messages[0].content, 'base', 'system intacto')
  assert.ok(recebidos[1].messages.at(-1).content.includes('1. listar a pasta'), 'plano no fim do passo seguinte')
  ponte.fechar(); destino.close()
})
