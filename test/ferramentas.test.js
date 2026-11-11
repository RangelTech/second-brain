// ferramentas.js: git/curl portateis para computador novo (Mac com chip da Apple e Linux) e dialogo da Apple no Mac Intel
const test = require('node:test')
const assert = require('node:assert')
const os = require('os')
const path = require('path')
const fs = require('fs')
const f = require('../ferramentas')

const appFalso = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-ferr-'))
  return { getPath: () => d }
}

test('sem ferramentas portateis instaladas, nao mexe no PATH', () => {
  assert.strictEqual(f.caminhoExtra(appFalso()), '')
})

test('Windows: garantir nao faz nada (o instalador do Windows traz o agente pronto)', { skip: process.platform !== 'win32' }, async () => {
  assert.strictEqual(await f.garantir(appFalso()), '')
})

test('Linux com git e curl no sistema: nao baixa nada', { skip: process.platform !== 'linux' || process.env.SB_SEM_FERRAMENTAS_SISTEMA === '1' }, async () => {
  assert.strictEqual(f.sistemaCompleto(), true)
  assert.strictEqual(await f.garantir(appFalso()), '')
})
