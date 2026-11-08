// O servidor so desliga o raciocinio com chat_template_kwargs.enable_thinking=false (reasoning_effort:"none" nao basta: 5x mais lento, medido).
const test = require('node:test')
const assert = require('node:assert/strict')
const { semPensar } = require('../ponte-llm')

test('reasoning_effort none (ou ausente): liga enable_thinking=false e preserva o resto', () => {
  for (const base of [{ reasoning_effort: 'none' }, {}, { reasoning_effort: '' }]) {
    const j = JSON.parse(semPensar(JSON.stringify({ model: 'principal', messages: [{ role: 'user', content: 'oi' }], ...base })))
    assert.equal(j.chat_template_kwargs.enable_thinking, false)
    assert.equal(j.messages[0].content, 'oi')
  }
})
test('raciocinio escolhido pelo usuario (low/medium/high) nao e desligado', () => {
  for (const e of ['low', 'medium', 'high']) {
    const j = JSON.parse(semPensar(JSON.stringify({ reasoning_effort: e, messages: [] })))
    assert.equal(j.chat_template_kwargs, undefined)
  }
})
test('mantem outras chaves de chat_template_kwargs e nao quebra com corpo que nao e JSON', () => {
  const j = JSON.parse(semPensar(JSON.stringify({ reasoning_effort: 'none', chat_template_kwargs: { x: 1 } })))
  assert.deepEqual(j.chat_template_kwargs, { x: 1, enable_thinking: false })
  assert.equal(semPensar('nao e json'), 'nao e json')
})
test('ordem das chaves estavel: o prefixo do pedido continua igual entre chamadas (cache do servidor)', () => {
  const corpo = (u) => JSON.stringify({ model: 'm', reasoning_effort: 'none', messages: [{ role: 'system', content: 'S'.repeat(500) }, { role: 'user', content: u }], tools: [{ a: 1 }] })
  const a = semPensar(corpo('um')), b = semPensar(corpo('dois'))
  const k = a.indexOf('"user"')
  assert.equal(a.slice(0, k), b.slice(0, k))
})
