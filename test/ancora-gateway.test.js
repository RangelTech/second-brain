// Sessão-âncora: fica de pé (sem cronômetro de ociosa) para o gateway do Hermes nunca ficar órfão entre chats.
const test = require('node:test')
const assert = require('node:assert')
const { Sessao } = require('../agent.js')

test('sessão fixa não agenda encerramento por ociosidade', () => {
  const fake = { fixa: true, ocioso: null, app: {}, ativo: false, turno: null, encerrar: () => assert.fail('não pode encerrar') }
  Sessao.prototype.agendarOcioso.call(fake)
  assert.strictEqual(fake.ocioso, null)
})

test('sessão comum continua com o cronômetro de ociosa', () => {
  const fake = { ocioso: null, app: { getPath: () => require('os').tmpdir() }, ativo: false, turno: null, encerrar() {} }
  Sessao.prototype.agendarOcioso.call(fake)
  assert.ok(fake.ocioso)
  clearTimeout(fake.ocioso)
})

test('a âncora é registrada em main.js só com conta, memória livre e sem opt-out', () => {
  const fs = require('fs'), path = require('path')
  const src = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8')
  assert.match(src, /cfg\.ancoraAgente === false/)
  assert.match(src, /memoriaDisponivel\(\) < MEMORIA_MIN_ANCORA/)
  assert.match(src, /s\.fixa = true/)
})
