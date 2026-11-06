const test = require('node:test')
const assert = require('node:assert/strict')
const { criar, trocaAutomatica } = require('../atualizador')

function falso({ versao = '9.9.9', falha = false } = {}) {
  const au = { chamadas: [], autoDownload: true }
  au.checkForUpdates = async () => (falha ? Promise.reject(new Error('sem rede')) : { updateInfo: { version: versao }, isUpdateAvailable: true })
  au.downloadUpdate = async () => au.chamadas.push('baixar')
  au.quitAndInstall = (...a) => au.chamadas.push(['instalar', ...a])
  return au
}
const montar = (au, cfg = {}, eventos = []) => criar({ app: { getVersion: () => '0.6.15', isPackaged: true }, cfgGet: () => cfg, enviar: (c, d) => eventos.push([c, d.fase]), updater: au })

test('nova versão avisa a tela; sem auto não baixa sozinho', async () => {
  const au = falso(), ev = []
  const a = montar(au, {}, ev)
  a.trocaAutomatica = () => true
  await a.conferir()
  assert.equal(a.estado().fase, 'disponivel')
  assert.equal(a.estado().versao, '9.9.9')
  assert.deepEqual(au.chamadas, [])
})

test('mesma versão ou falha de rede: nada a mostrar', async () => {
  const a = montar(falso({ versao: '0.6.15' }))
  await a.conferir()
  assert.equal(a.estado().fase, 'nenhuma')
  const b = montar(falso({ falha: true }))
  await b.conferir()
  assert.equal(b.estado().fase, 'nenhuma')
})

test('só se instala depois de baixar; botão Atualizar baixa e reinicia', async () => {
  const au = falso()
  const a = montar(au)
  assert.equal(a.instalar(), false)
  await a.conferir()
  if (!a.estado().automatica) return // fora de Windows instalado/AppImage o botão abre a página
  await a.baixar(true)
  await new Promise((r) => setImmediate(r))
  assert.deepEqual(au.chamadas, ['baixar', ['instalar', false, true]])
})

test('automático baixa sozinho e deixa pronta (instala ao fechar)', async () => {
  const au = falso()
  const a = montar(au, { atualizarAuto: true })
  if (!a.estado().automatica) return
  await a.conferir()
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(a.estado().fase, 'pronta')
  assert.deepEqual(au.chamadas, ['baixar'])
})

test('onde não dá para trocar no lugar', () => {
  assert.equal(trocaAutomatica({ platform: 'darwin', env: {} }), false)
  assert.equal(trocaAutomatica({ platform: 'win32', env: { PORTABLE_EXECUTABLE_FILE: 'x' } }), false)
  assert.equal(trocaAutomatica({ platform: 'win32', env: {} }), true)
  assert.equal(trocaAutomatica({ platform: 'linux', env: { APPIMAGE: '/x' } }), true)
  assert.equal(trocaAutomatica({ platform: 'linux', env: {} }), false)
})
