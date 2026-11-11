// Com o agente embutido no instalador, a raiz do Hermes é a pasta FIXA (o pacote só funciona onde foi montado) e os dados seguem por usuário.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs'), os = require('os'), path = require('path')
const C = require('../caminhos-hermes.js')

test('sem pacote embutido, nada muda (raiz curta por usuário)', () => {
  if (process.platform !== 'win32') return
  assert.strictEqual(C.embutido(), false)
})
test('com o pacote em resources, a raiz é C:\SegundoCerebro\hermes e o home é por usuário', () => {
  if (process.platform !== 'win32') return
  const res = fs.mkdtempSync(path.join(os.tmpdir(), 'res-'))
  fs.mkdirSync(path.join(res, 'hermes-runtime'))
  fs.writeFileSync(path.join(res, 'hermes-runtime', 'hermes-win32-x64.7z'), 'x')
  const antes = process.resourcesPath
  Object.defineProperty(process, 'resourcesPath', { value: res, configurable: true })
  try {
    assert.strictEqual(C.embutido(), true)
  } finally {
    Object.defineProperty(process, 'resourcesPath', { value: antes, configurable: true })
  }
})
