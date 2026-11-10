// Caminho curto do agente no Windows (limite de 260 caracteres): so no app instalado e so para instalacao nova; quem ja funciona nao muda.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const mod = require('../caminhos-hermes')

function cena({ empacotado = true, funcionando = false } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'caminhos-'))
  const dados = path.join(tmp, 'dados')
  fs.mkdirSync(dados, { recursive: true })
  if (funcionando) fs.writeFileSync(path.join(dados, 'teste-instalacao.ok'), 'x')
  process.env.SB_RAIZ_CURTA = path.join(tmp, 'curta')
  process.env.SB_MAX_BASE = '400'
  mod.esquecer()
  return { app: { getPath: () => dados, isPackaged: empacotado }, dados, tmp }
}
const so = (plat, fn) => {
  const orig = Object.getOwnPropertyDescriptor(process, 'platform')
  Object.defineProperty(process, 'platform', { value: plat })
  try {
    return fn()
  } finally {
    Object.defineProperty(process, 'platform', orig)
  }
}

test('Windows instalado com instalacao nova: usa a pasta curta e grava a decisao', () => {
  const { app, dados, tmp } = cena()
  so('win32', () => {
    const r = mod.decidir(app)
    assert.equal(r.modo, 'curto')
    assert.ok(r.raiz.startsWith(path.join(tmp, 'curta')) && r.raiz.endsWith(path.join('', 'h')))
    assert.ok(r.home.endsWith(path.join('', 'd')))
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dados, 'caminhos.json'), 'utf8')).raiz, r.raiz)
  })
})

test('quem ja tem o agente testado e funcionando continua na pasta antiga', () => {
  const { app, dados } = cena({ funcionando: true })
  so('win32', () => {
    const r = mod.decidir(app)
    assert.equal(r.modo, 'legado')
    assert.equal(r.raiz, path.join(dados, 'hermes'))
    assert.equal(r.home, path.join(dados, 'hermes-home'))
  })
})

test('a decisao gravada nao muda depois (mesmo que o teste passe a existir)', () => {
  const { app, dados } = cena()
  so('win32', () => {
    const a = mod.decidir(app)
    fs.writeFileSync(path.join(dados, 'teste-instalacao.ok'), 'x')
    mod.esquecer()
    assert.deepEqual(mod.decidir(app).raiz, a.raiz)
  })
})

test('fora do Windows e fora do app instalado: sempre a pasta antiga', () => {
  const c1 = cena()
  so('linux', () => assert.equal(mod.decidir(c1.app).modo, 'legado'))
  const c2 = cena({ empacotado: false })
  so('win32', () => assert.equal(mod.decidir(c2.app).modo, 'legado'))
})

test('a pasta curta cabe no limite do Windows com o trecho mais longo do Hermes', () => {
  const trecho = '\installs\7de22b09fcf16f60\environments\c343f0a7a6404d90a81ec00150d6e1f7\workspace\plugins\config_backends\remote\vendor\conformance\config-resolution\multi-group-higher-ancestor-lock-covers-lower-child-lock.json'
  const raizReal = 'C:\SegundoCerebro\a1b2c3\h'
  assert.ok(raizReal.length <= mod.MAX_BASE)
  assert.ok((raizReal + trecho).length <= 259, 'caminho final: ' + (raizReal + trecho).length)
})
