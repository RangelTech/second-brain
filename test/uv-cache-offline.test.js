// Instalador completo: cache de pacotes do uv. A primeira montagem do ambiente usa o cache (UV_OFFLINE) e, se faltar o marcador de completo, nada muda.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs'), os = require('os'), path = require('path')
const C = require('../caminhos-hermes.js')

test('cache do uv só vale depois de descompactado por inteiro (.completo)', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'uvc-'))
  process.env.SB_UV_CACHE = d
  try {
    assert.strictEqual(C.cacheUv(), '')
    fs.writeFileSync(path.join(d, '.completo'), 'x')
    assert.strictEqual(C.cacheUv(), d)
  } finally {
    delete process.env.SB_UV_CACHE
  }
})
test('o instalador e o app tratam o cache como opcional (falha nao derruba)', () => {
  const root = path.join(__dirname, '..')
  const inst = fs.readFileSync(path.join(root, 'hermes-instalar.js'), 'utf8')
  assert.match(inst, /async function extrairCacheUv/)
  assert.match(inst, /os pacotes serao baixados/)
  const ps = fs.readFileSync(path.join(root, 'scripts', 'montar-hermes-embutido.ps1'), 'utf8')
  assert.match(ps, /NAO derruba o instalador/)
  const ag = fs.readFileSync(path.join(root, 'agent.js'), 'utf8')
  assert.match(ag, /UV_OFFLINE: '1'/)
  assert.match(ag, /delete this\.env\.UV_OFFLINE/)
})
