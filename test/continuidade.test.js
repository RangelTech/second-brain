// Metas e continuidade do Hermes (spec 50)
const test = require('node:test')
const assert = require('node:assert/strict')
const { historicoParaAgente, itensAbertosDoPlano, textoContinuarPlano, textoMetaPendente } = require('../agent')

test('sessão nova enxerga o chat todo: todas as mensagens do usuário, respostas recentes mais longas', () => {
  const msgs = []
  for (let i = 0; i < 30; i++) {
    msgs.push({ role: 'user', content: `pedido ${i} ` + 'x'.repeat(1500) })
    msgs.push({ role: 'assistant', content: `resposta ${i} ` + 'y'.repeat(3000) })
  }
  const h = historicoParaAgente(msgs)
  for (let i = 0; i < 30; i++) assert.match(h, new RegExp(`pedido ${i} `), `pedido ${i} precisa estar`)
  // antes: só as últimas 10 mensagens com 700 caracteres; agora o pedido inteiro (1.500) entra
  assert.ok(h.includes('pedido 0 ' + 'x'.repeat(1500)))
  assert.ok(h.length <= 60000)
  // estourou o orçamento: as respostas antigas do agente saem antes de qualquer pedido do usuário
  assert.ok(!h.includes('Assistente: resposta 0 '))
  assert.ok(h.includes('Assistente: resposta 29 '))
})

test('dentro do orçamento: resposta recente mais longa que a antiga', () => {
  const msgs = []
  for (let i = 0; i < 10; i++) msgs.push({ role: 'user', content: `p${i}` }, { role: 'assistant', content: `r${i} ` + 'y'.repeat(3000) })
  const l = historicoParaAgente(msgs).split('\n')
  assert.ok(l.find((x) => x.startsWith('Assistente: r9 ')).length > 1900)
  assert.ok(l.find((x) => x.startsWith('Assistente: r0 ')).length < 330)
})

test('acima do orçamento saem as mais antigas primeiro', () => {
  const msgs = Array.from({ length: 50 }, (_, i) => ({ role: 'user', content: `p${i} ` + 'z'.repeat(3000) }))
  const h = historicoParaAgente(msgs, 20000)
  assert.ok(h.length <= 20100)
  assert.match(h, /^\[mensagens mais antigas omitidas\]/)
  assert.match(h, /p49 /)
  assert.doesNotMatch(h, /Usuário: p0 /)
})

test('plano com passo aberto continua; pergunta ao usuário ou plano completo não', () => {
  const plano = { itens: [{ texto: 'banco', estado: 'feito' }, { texto: 'chat', estado: 'pendente' }, { texto: 'testes', estado: 'fazendo' }] }
  assert.equal(itensAbertosDoPlano(plano, 'Fiz o banco.').length, 2)
  assert.equal(itensAbertosDoPlano(plano, 'Qual cor você prefere?').length, 0)
  assert.equal(itensAbertosDoPlano({ itens: [{ texto: 'a', estado: 'feito' }, { texto: 'b', estado: 'cancelado' }] }, 'ok').length, 0)
  assert.equal(itensAbertosDoPlano(null, 'ok').length, 0)
  assert.match(textoContinuarPlano(itensAbertosDoPlano(plano, '')), /"chat"; "testes"/)
})

test('meta que morreu vai junto da mensagem nova', () => {
  const t = textoMetaPendente({ pedido: 'crie o site de namoro', feitos: ['write_file app.py'] }, 'e aí?')
  assert.match(t, /Tarefa anterior não terminou/)
  assert.match(t, /crie o site de namoro/)
  assert.match(t, /write_file app\.py/)
  assert.match(t, /\n\ne aí\?$/)
})
