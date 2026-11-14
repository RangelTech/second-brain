// Extensão do Chrome no lado do app: servidor local de pareamento, host de mensageria nativa e registro nos navegadores.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const http = require('http')
const { spawn } = require('child_process')
const A = require('../extensao-app.js')

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ext-app-'))
const post = (porta, caminho, h = {}) => new Promise((res, rej) => {
  const r = http.request({ host: '127.0.0.1', port: porta, path: caminho, method: 'POST', headers: h }, (x) => { let t = ''; x.on('data', (d) => (t += d)); x.on('end', () => res({ s: x.statusCode, j: JSON.parse(t || '{}') })) })
  r.on('error', rej); r.end()
})
// protocolo de mensageria nativa: 4 bytes (little endian) + JSON
const quadro = (o) => { const b = Buffer.from(JSON.stringify(o)); const c = Buffer.alloc(4); c.writeUInt32LE(b.length); return Buffer.concat([c, b]) }
function conversarComHost(pasta, msg) {
  return new Promise((res) => {
    const p = spawn(process.execPath, [path.join(__dirname, '..', 'native-host.js')], { env: { ...process.env, SB_DADOS: pasta, ELECTRON_RUN_AS_NODE: '' }, stdio: ['pipe', 'pipe', 'ignore'] })
    let buf = Buffer.alloc(0)
    p.stdout.on('data', (d) => (buf = Buffer.concat([buf, d])))
    p.on('close', () => res(buf.length >= 4 ? JSON.parse(buf.slice(4, 4 + buf.readUInt32LE(0)).toString()) : null))
    p.stdin.write(quadro(msg))
  })
}

test('o servidor local só atende o host (token certo, sem Origin) e entrega o pareamento da conta', async () => {
  const pasta = tmp()
  const h = await A.iniciarServidor({ pasta, pareamento: async () => ({ token: 'sbp.abc.def', base: 'https://remoto.rangeltech.net' }) })
  const c = JSON.parse(fs.readFileSync(path.join(pasta, 'extensao-host.json'), 'utf8'))
  assert.strictEqual(c.porta, h.porta)
  assert.strictEqual((await post(h.porta, '/extensao/parear')).s, 401) // sem token
  assert.strictEqual((await post(h.porta, '/extensao/parear', { Authorization: 'Bearer errado' })).s, 401)
  assert.strictEqual((await post(h.porta, '/extensao/parear', { Authorization: 'Bearer ' + c.token, Origin: 'https://site-malicioso.com' })).s, 403) // página web não pode pedir
  const r = await post(h.porta, '/extensao/parear', { Authorization: 'Bearer ' + c.token })
  assert.deepStrictEqual([r.s, r.j.token, r.j.base], [200, 'sbp.abc.def', 'https://remoto.rangeltech.net'])
  h.fechar()
  assert.ok(!fs.existsSync(path.join(pasta, 'extensao-host.json')))
})

test('conta sem login: o app responde erro e o host repassa à extensão', async () => {
  const pasta = tmp()
  const h = await A.iniciarServidor({ pasta, pareamento: async () => { throw new Error('Entre na sua conta no Cérebro Pro.') } })
  const m = await conversarComHost(pasta, { t: 'parear' })
  assert.strictEqual(m.t, 'erro')
  assert.match(m.erro, /Entre na sua conta/)
  h.fechar()
})

test('host nativo de ponta a ponta: a extensão pede e recebe o token', async () => {
  const pasta = tmp()
  const h = await A.iniciarServidor({ pasta, pareamento: async () => ({ token: 'sbp.xyz.123', base: 'http://127.0.0.1:1' }) })
  const m = await conversarComHost(pasta, { t: 'parear' })
  assert.deepStrictEqual([m.t, m.token, m.base], ['parear', 'sbp.xyz.123', 'http://127.0.0.1:1'])
  h.fechar()
})

test('app fechado: o host avisa "app_fechado" (a extensão cai no caminho do site)', async () => {
  const m = await conversarComHost(tmp(), { t: 'parear' })
  assert.deepStrictEqual([m.t, m.codigo], ['erro', 'app_fechado'])
})

test('host ignora mensagem que não é pedido de pareamento', async () => {
  const m = await conversarComHost(tmp(), { t: 'outra' })
  assert.strictEqual(m.t, 'erro')
})

test('registro no Linux e no Mac: manifesto copiado para as pastas dos navegadores, só a nossa extensão autorizada', () => {
  for (const plataforma of ['linux', 'darwin']) {
    const home = tmp(), pasta = tmp()
    const r = A.registrar({ pasta, execPath: '/opt/segundo/app', scriptHost: '/opt/segundo/native-host.js', plataforma, home, executar: () => assert.fail('não usa o registro do Windows') })
    assert.ok(r.pastas.length >= 3)
    for (const d of r.pastas) {
      const j = JSON.parse(fs.readFileSync(path.join(d, A.HOST + '.json'), 'utf8'))
      assert.deepStrictEqual([j.name, j.type, j.allowed_origins], [A.HOST, 'stdio', [`chrome-extension://${A.ID_EXTENSAO}/`]])
      assert.ok(fs.existsSync(j.path))
    }
    const sh = fs.readFileSync(path.join(pasta, 'native', 'host.sh'), 'utf8')
    assert.match(sh, /ELECTRON_RUN_AS_NODE=1/)
    assert.match(sh, /SB_DADOS=/)
  }
})

test('registro no Windows: chaves do registro do usuário para Chrome, Edge e Brave, e lançador .cmd com a pasta de dados', () => {
  const pasta = tmp(), chamadas = []
  A.registrar({ pasta, execPath: 'C:\\App\\Cérebro Pro.exe', scriptHost: 'C:\\App\\resources\\native-host.js', plataforma: 'win32', executar: (cmd, args) => chamadas.push([cmd, ...args]) })
  const chaves = chamadas.map((c) => c[2])
  assert.ok(chaves.some((k) => /HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\net\.rangeltech\.segundocerebro/.test(k)))
  assert.ok(chaves.some((k) => /Microsoft\\Edge/.test(k)) && chaves.some((k) => /Brave/.test(k)))
  assert.ok(chamadas.every((c) => c[0] === 'reg' && c[1] === 'add' && c.includes('/f') && /\.json$/.test(c[c.indexOf('/d') + 1])))
  const cmd = fs.readFileSync(path.join(pasta, 'native', 'host.cmd'), 'utf8')
  assert.match(cmd, /ELECTRON_RUN_AS_NODE=1/)
  assert.ok(cmd.includes('Cérebro Pro.exe') && cmd.includes('native-host.js') && cmd.includes('SB_DADOS'))
})
