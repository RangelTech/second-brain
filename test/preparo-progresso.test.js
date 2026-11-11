// Progresso da tela de preparo: 0 a 100%, nunca diminui, nunca passa de 96% antes de terminar, e o tempo restante cai.
const test = require('node:test')
const assert = require('node:assert')
const P = require('../renderer/preparo-progresso.js')

test('começa perto de 0 e sobe com o tempo, sem passar de 96%', () => {
  let e = null
  const a = P.estimar(e, { texto: 'baixando o instalador', decorridoMs: 2000 }); e = a
  assert.ok(a.pct >= 3 && a.pct < 10, 'início ' + a.pct)
  const b = P.estimar(e, { texto: 'baixando o instalador', decorridoMs: 30 * 60000 })
  assert.ok(b.pct <= 96 && b.pct > 90, 'fim ' + b.pct)
})
test('o percentual nunca diminui, mesmo se o passo voltar', () => {
  let e = null, ult = 0
  for (const [t, ms] of [['python', 90000], ['baixando o instalador', 95000], ['git', 100000], ['', 105000]]) {
    e = P.estimar(e, { texto: t, decorridoMs: ms }); assert.ok(e.pct >= ult); ult = e.pct
  }
})
test('cada passo conhecido dá um piso', () => {
  const e = P.estimar(null, { texto: 'conferindo o agente', decorridoMs: 1000 })
  assert.ok(e.pct >= 70)
})
test('o tempo restante diminui conforme avança e o instalador completo é mais rápido', () => {
  const a = P.estimar(null, { texto: 'baixando o instalador', decorridoMs: 5000 })
  const b = P.estimar(null, { texto: 'baixando o instalador', decorridoMs: 200000 })
  assert.ok(b.restanteMs < a.restanteMs)
  assert.ok(P.esperadoMs('copiando o agente que vem no instalador') < P.esperadoMs('baixando o instalador'))
})
test('aprende com a duração da última preparação', () => {
  assert.ok(P.esperadoMs('baixando o instalador', 120000) < P.esperadoMs('baixando o instalador'))
})
test('texto do tempo restante', () => {
  assert.strictEqual(P.textoRestante(20000), 'menos de 1 minuto')
  assert.strictEqual(P.textoRestante(60000), 'cerca de 1 minuto')
  assert.strictEqual(P.textoRestante(5 * 60000), 'cerca de 5 minutos')
})

test('traduz os passos do instalador e tira pontos repetidos', () => {
  assert.strictEqual(P.traduzir('Preparing Node dependencies......'), 'preparando as dependências do Node')
  assert.strictEqual(P.traduzir('Installing packages…'), 'instalando os pacotes')
  assert.strictEqual(P.traduzir('baixando o instalador'), 'baixando o instalador')
})
test('o tempo esperado com download reflete a medição real (mais de 10 min)', () => {
  assert.ok(P.esperadoMs('baixando o instalador') >= 600000)
})
