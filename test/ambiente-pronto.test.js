// Instalador completo: ambiente PRONTO (agente + dados do ambiente) em pastas fixas; descompacta e marca como montado, sem baixar nada.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs'), os = require('os'), path = require('path')

test('o instalador e o CI tratam o ambiente pronto como opcional (falha nao derruba)', () => {
  const root = path.join(__dirname, '..')
  const inst = fs.readFileSync(path.join(root, 'hermes-instalar.js'), 'utf8')
  assert.match(inst, /async function extrairHomePronto/)
  assert.match(inst, /sera montado pela internet/)
  assert.match(inst, /pronto\.ok/)
  const ps = fs.readFileSync(path.join(root, 'scripts', 'montar-hermes-embutido.ps1'), 'utf8')
  assert.match(ps, /C:\\SegundoCerebro\\d/)
  assert.match(ps, /NAO derruba o instalador/)
  assert.ok(fs.existsSync(path.join(root, 'scripts', 'montar-ambiente.js')))
})
test('o home fixo e de um usuario so; outro usuario do PC fica no caminho por usuario', () => {
  if (process.platform !== 'win32') return
  const C = require('../caminhos-hermes.js')
  assert.strictEqual(typeof C.idDoUsuario('x'), 'string')
  assert.strictEqual(C.idDoUsuario('C:/A').length, 6)
  assert.match(C.HOME_FIXO(), /SegundoCerebro[\\/]d$/)
})
