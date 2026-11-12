// O Hermes congela o endereço do modelo na sessão; a ponte tem de reabrir na MESMA porta entre aberturas do app (12/11/2026).
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const ponte = require('../ponte-llm')

test('a ponte reabre na mesma porta e sorteia outra se ela estiver ocupada', async () => {
  const arq = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sb-porta-')), 'porta.txt')
  const mk = () => ponte.criar({ destino: () => 'http://127.0.0.1:1', aoProgresso: () => {}, registrar: () => {}, portaArq: arq })
  const a = mk()
  const p1 = await a.iniciar()
  a.fechar()
  await new Promise((r) => setTimeout(r, 100))
  const b = mk()
  const p2 = await b.iniciar()
  assert.equal(p2, p1, 'mesma porta depois de fechar e abrir')
  const c = mk()
  const p3 = await c.iniciar() // p1 ocupada por b: sorteia outra
  assert.notEqual(p3, p1)
  b.fechar()
  c.fechar()
})
