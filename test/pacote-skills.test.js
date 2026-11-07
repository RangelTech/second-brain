// O pacote de skills profissionais só é entregue a quem o plano inclui (Light não tem). O instalador é o mesmo para todos.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const agent = require('../agent')

function appFalso() {
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-pacote-'))
  return { dados, app: { getPath: () => dados } }
}

test('plano sem o pacote (Light): a pasta rangeltech não é criada', () => {
  const { dados, app } = appFalso()
  agent.definirPacote(false)
  const home = agent.prepararBase(app)
  assert.equal(fs.existsSync(path.join(home, 'skills', 'rangeltech')), false)
  fs.rmSync(dados, { recursive: true, force: true })
})

test('plano com o pacote: as skills são entregues', () => {
  const { dados, app } = appFalso()
  agent.definirPacote(true)
  const home = agent.prepararBase(app)
  assert.equal(fs.existsSync(path.join(home, 'skills', 'rangeltech', 'README.md')), true)
  fs.rmSync(dados, { recursive: true, force: true })
})

test('antes do login (plano desconhecido) nada é entregue: o Light não ganha o pacote no primeiro início', () => {
  const { dados, app } = appFalso()
  agent.definirPacote(undefined)
  const home = agent.prepararBase(app)
  assert.equal(fs.existsSync(path.join(home, 'skills', 'rangeltech')), false)
  fs.rmSync(dados, { recursive: true, force: true })
})

test('depois do upgrade o pacote chega na próxima sessão', () => {
  const { dados, app } = appFalso()
  agent.definirPacote(false)
  const home = agent.prepararBase(app)
  agent.definirPacote(true)
  agent.prepararBase(app)
  assert.equal(fs.existsSync(path.join(home, 'skills', 'rangeltech', 'README.md')), true)
  fs.rmSync(dados, { recursive: true, force: true })
})
