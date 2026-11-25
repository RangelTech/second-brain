const test = require('node:test'), assert = require('node:assert')
const A = require('../public/assets/assinar.js')
const C = { mesesAnual: 10, precoVm: 399, planos: { lite: { mensal: 119 }, max: { mensal: 497 }, ultra: { mensal: 1197 } },
  checkout: { light: 'https://pay.cakto.com.br/l', max: 'https://pay.cakto.com.br/m', ultra: 'https://pay.cakto.com.br/u', vm: 'https://pay.cakto.com.br/v' },
  checkoutVm: { max: 'https://pay.cakto.com.br/mv' }, checkoutAnual: { max: 'https://pay.cakto.com.br/ma', vm: 'https://pay.cakto.com.br/va' }, checkoutVmAnual: { max: 'https://pay.cakto.com.br/mva' } }
test('lê a chave do produto', () => {
  assert.deepStrictEqual(A.lerProduto('max_anual_vm'), { plano: 'max', ciclo: 'anual', vm: true, chave: 'max_anual_vm' })
  assert.strictEqual(A.lerProduto('credito_uso'), null)
  assert.strictEqual(A.lerProduto('vm_mensal_vm'), null)
  assert.strictEqual(A.lerProduto(null), null)
})
test('preço normal: plano, anual = 10 meses, máquina somada', () => {
  assert.strictEqual(A.precoNormal(A.lerProduto('max_mensal'), C), 497)
  assert.strictEqual(A.precoNormal(A.lerProduto('max_anual'), C), 4970)
  assert.strictEqual(A.precoNormal(A.lerProduto('max_mensal_vm'), C), 896)
  assert.strictEqual(A.precoNormal(A.lerProduto('vm_anual'), C), 3990)
})
test('link normal por produto', () => {
  assert.strictEqual(A.linkNormal(A.lerProduto('lite_mensal'), C), 'https://pay.cakto.com.br/l')
  assert.strictEqual(A.linkNormal(A.lerProduto('max_mensal_vm'), C), 'https://pay.cakto.com.br/mv')
  assert.strictEqual(A.linkNormal(A.lerProduto('max_anual'), C), 'https://pay.cakto.com.br/ma')
  assert.strictEqual(A.linkNormal(A.lerProduto('max_anual_vm'), C), 'https://pay.cakto.com.br/mva')
  assert.strictEqual(A.linkNormal(A.lerProduto('vm_anual'), C), 'https://pay.cakto.com.br/va')
  assert.ok(!A.linkNormal(A.lerProduto('ultra_anual'), C))
})
test('monta a URL do pagamento com callback, e-mail e nome, mantendo o que já tinha (link de afiliado)', () => {
  const u = new URL(A.montarUrl('https://pay.cakto.com.br/ofmax?affiliate=afil123', 'tok_123-AB', 'a@x.com', 'Ana Silva'))
  assert.strictEqual(u.searchParams.get('affiliate'), 'afil123')
  assert.strictEqual(u.searchParams.get('callback'), 'tok_123-AB')
  assert.strictEqual(u.searchParams.get('email'), 'a@x.com')
  assert.strictEqual(u.searchParams.get('name'), 'Ana Silva')
})
