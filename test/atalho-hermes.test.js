// Atalho ~/.local/bin/hermes-acp apontando para instalacao apagada nao conta como "agente instalado" (QA Linux 11/11/2026)
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { atalhoValido } = require('../agent')

test('atalho de texto apontando para hermes-acp inexistente e invalido', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-atalho-'))
  const a = path.join(d, 'hermes-acp')
  fs.writeFileSync(a, '#!/bin/sh\nexec /nao/existe/hermes-agent/.hermes/bin/hermes-acp "$@"\n')
  assert.strictEqual(atalhoValido(a), false)
})

test('binario grande ou script sem caminho absoluto continua valido', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-atalho-'))
  const b = path.join(d, 'bin')
  fs.writeFileSync(b, Buffer.alloc(20000))
  assert.strictEqual(atalhoValido(b), true)
  const s = path.join(d, 'script')
  fs.writeFileSync(s, '#!/bin/sh\nexec python -m acp_adapter\n')
  assert.strictEqual(atalhoValido(s), true)
})
