// O modelo chama ferramentas MCP pelo nome dentro dos argumentos da chamada, e os argumentos chegam partidos em vários eventos do stream.
// O restaurador tem que devolver o nome real mesmo quando o sufixo fixo vem cortado entre eventos.
const test = require('node:test')
const assert = require('node:assert/strict')
const { normalizarEditor } = require('../ponte-llm')
const { criarRestaurador } = require('../ponte-restaurar')

const REAL = 'editor_midia_0f551416'
const { texto: FIXO_TXT, pares } = normalizarEditor(REAL)

const evento = (index, args, extra = {}) =>
  'data: ' + JSON.stringify({ id: 'x1', object: 'chat.completion.chunk', created: 1, model: 'm', choices: [{ index: 0, delta: { tool_calls: [{ index, function: { arguments: args } }] }, finish_reason: extra.fim || null }] })

function rodar(linhas) {
  const r = criarRestaurador(pares)
  const saida = []
  for (const l of linhas) saida.push(...r.linha(l))
  saida.push(...r.fim())
  return saida
}
function argumentos(saida, index = 0) {
  let t = ''
  for (const l of saida) {
    if (!l.startsWith('data:') || l.includes('[DONE]')) continue
    const o = JSON.parse(l.slice(5))
    for (const c of o.choices || []) for (const tc of (c.delta && c.delta.tool_calls) || []) if ((tc.index ?? 0) === index && tc.function && typeof tc.function.arguments === 'string') t += tc.function.arguments
  }
  return t
}

test('nome com sufixo fixo partido em varios eventos volta inteiro com o sufixo real', () => {
  const completo = '{"name":"mcp__' + FIXO_TXT + '__midia_gerar_imagem","arguments":{"prompt":"sedan prata"}}'
  // corta em pedacos de 3 caracteres: o nome fixo fica partido em varios lugares
  const pedacos = []
  for (let i = 0; i < completo.length; i += 3) pedacos.push(completo.slice(i, i + 3))
  const linhas = pedacos.map((p) => evento(0, p))
  linhas.push(evento(0, '', { fim: 'tool_calls' }))
  linhas.push('data: [DONE]')
  const saida = rodar(linhas)
  assert.equal(argumentos(saida), completo.split(FIXO_TXT).join(REAL), 'os argumentos reunidos tem o nome real')
  assert.ok(saida[saida.length - 1].includes('[DONE]'))
})

test('qualquer ponto de corte do nome funciona', () => {
  const completo = 'x"mcp__' + FIXO_TXT + '__midia_gerar_imagem"y'
  for (let corte = 1; corte < completo.length; corte++) {
    const linhas = [evento(0, completo.slice(0, corte)), evento(0, completo.slice(corte)), evento(0, '', { fim: 'tool_calls' })]
    assert.equal(argumentos(rodar(linhas)), completo.split(FIXO_TXT).join(REAL), 'corte em ' + corte)
  }
})

test('o que ficou segurado sai no fim da resposta mesmo sem finish_reason', () => {
  const linhas = [evento(0, '{"a":"edit')] // termina em algo que PODE ser o comeco de um nome fixo
  assert.equal(argumentos(rodar(linhas)), '{"a":"edit')
})

test('duas chamadas de ferramenta em paralelo nao misturam o que ficou segurado', () => {
  const a = 'A' + FIXO_TXT + 'A'
  const b = 'B' + FIXO_TXT + 'B'
  const linhas = [evento(0, a.slice(0, 9)), evento(1, b.slice(0, 11)), evento(0, a.slice(9)), evento(1, b.slice(11)), evento(0, '', { fim: 'tool_calls' })]
  const s = rodar(linhas)
  assert.equal(argumentos(s, 0), a.split(FIXO_TXT).join(REAL))
  assert.equal(argumentos(s, 1), b.split(FIXO_TXT).join(REAL))
})

test('texto normal e linhas que nao sao de ferramenta passam sem mudar', () => {
  const l = 'data: ' + JSON.stringify({ id: 'x', choices: [{ index: 0, delta: { content: 'oi ' + FIXO_TXT + '!' }, finish_reason: null }] })
  const s = rodar([': comentario', l])
  assert.equal(s[0], ': comentario')
  assert.ok(s[1].includes(REAL), 'o conteudo tambem volta ao nome real')
})
