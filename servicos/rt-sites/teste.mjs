// node --test servicos/rt-sites/teste.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'http'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtsites-'))
process.env.SITES_DIR = path.join(tmp, 'sites')
process.env.DADOS_DIR = path.join(tmp, 'dados')
process.env.ADMIN_TOKEN = 'admin-de-teste'
process.env.COTA_MB = '1'
const contas = { 'chave-juca-0000000000000000': { account_id: 1, email: 'juca@x.com', name: 'Juca Automóveis' },
  'chave-juca2-000000000000000': { account_id: 2, email: 'outro@x.com', name: 'Juca Automoveis' },
  'chave-banco-000000000000000': { account_id: 3, email: 'x@x.com', name: 'Banco Itaú Oficial' },
  'chave-admin-000000000000000': { account_id: 4, email: 'admin@x.com', name: 'Admin' } }
const acesso = http.createServer((req, res) => {
  const c = contas[String(req.headers.authorization || '').replace('Bearer ', '')]
  res.writeHead(c ? 200 : 401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(c || {}))
})
await new Promise((r) => acesso.listen(0, '127.0.0.1', r))
process.env.ACCESS_URL = 'http://127.0.0.1:' + acesso.address().port
const { servidor, slug, nomeLivre } = await import('./servidor.mjs')
await new Promise((r) => servidor.listen(0, '127.0.0.1', r))
const base = 'http://127.0.0.1:' + servidor.address().port
test.after(() => { servidor.close(); acesso.close() })

const b64 = (s) => Buffer.from(s).toString('base64')
const req = (rota, chave, opts = {}) => fetch(base + rota, { ...opts, headers: { Authorization: 'Bearer ' + chave, 'Content-Type': 'application/json', ...(opts.headers || {}) } })
const publicar = (chave, corpo) => req('/api/publicar', chave, { method: 'POST', body: JSON.stringify(corpo) })

test('nome legível, sem acento, único e sem colidir com reservados/golpe', () => {
  assert.equal(slug('Juca Automóveis'), 'juca-automoveis')
  assert.equal(slug('  Pão & Café!! '), 'pao-e-cafe')
  assert.equal(nomeLivre('Juca Automóveis', (n) => n === 'juca-automoveis'), 'juca-automoveis-2')
  assert.equal(nomeLivre('qwen', () => false), 'qwen-site')
  assert.equal(nomeLivre('Admin', () => false), 'admin-site')
  assert.match(nomeLivre('Banco Itaú Oficial', () => false), /-site$/)
  assert.equal(nomeLivre('a', () => false), 'a-site')
})

test('sem chave válida não publica', async () => {
  assert.equal((await publicar('chave-errada-xxxxxxxxxxxx', { arquivos: [] })).status, 401)
})

test('cada conta ganha o próprio nome; duas contas com o mesmo nome não colidem', async () => {
  const a = await (await req('/api/endereco', 'chave-juca-0000000000000000')).json()
  const b = await (await req('/api/endereco', 'chave-juca2-000000000000000')).json()
  assert.equal(a.nome, 'juca-automoveis')
  assert.equal(b.nome, 'juca-automoveis-2')
  assert.equal(a.url, 'https://juca-automoveis.rangeltech.net/')
  const c = await (await req('/api/endereco', 'chave-banco-000000000000000')).json()
  assert.match(c.nome, /-site$/)
  // repetir não cria outro
  assert.equal((await (await req('/api/endereco', 'chave-juca-0000000000000000')).json()).nome, 'juca-automoveis')
})

test('publica na raiz e em /nome/, só na pasta da própria conta', async () => {
  let r = await publicar('chave-juca-0000000000000000', { arquivos: [{ caminho: 'index.html', b64: b64('<h1>Juca</h1>') }, { caminho: 'css/a.css', b64: b64('h1{}') }, { caminho: 'virus.exe', b64: b64('MZ') }] })
  assert.equal(r.status, 200)
  assert.equal((await r.json()).url, 'https://juca-automoveis.rangeltech.net/')
  const raiz = path.join(process.env.SITES_DIR, 'juca-automoveis')
  assert.equal(fs.readFileSync(path.join(raiz, 'index.html'), 'utf8'), '<h1>Juca</h1>')
  assert.ok(!fs.existsSync(path.join(raiz, 'virus.exe')))
  r = await publicar('chave-juca-0000000000000000', { site: 'Promoção de Natal', arquivos: [{ caminho: 'index.html', b64: b64('natal') }] })
  assert.equal((await r.json()).url, 'https://juca-automoveis.rangeltech.net/promocao-de-natal/')
  // republicar a raiz não apaga o outro site e tira o arquivo velho
  r = await publicar('chave-juca-0000000000000000', { arquivos: [{ caminho: 'index.html', b64: b64('v2') }] })
  assert.equal(r.status, 200)
  assert.ok(fs.existsSync(path.join(raiz, 'promocao-de-natal', 'index.html')))
  assert.ok(!fs.existsSync(path.join(raiz, 'css', 'a.css')))
  const e = await (await req('/api/endereco', 'chave-juca-0000000000000000')).json()
  assert.deepEqual(e.sites.map((s) => s.site).sort(), ['(principal)', 'promocao-de-natal'])
  // a outra conta não enxerga nem escreve aqui
  assert.ok(!fs.existsSync(path.join(process.env.SITES_DIR, 'juca-automoveis-2', 'index.html')))
})

test('recusa caminho para fora, falta de index e passar da cota', async () => {
  let r = await publicar('chave-juca-0000000000000000', { site: 'x', arquivos: [{ caminho: '../../dados/contas.json', b64: b64('{}') }, { caminho: 'index.html', b64: b64('a') }] })
  assert.equal(r.status, 400)
  r = await publicar('chave-juca-0000000000000000', { site: 'y', arquivos: [{ caminho: '.htaccess', b64: b64('a') }, { caminho: 'index.html', b64: b64('a') }] })
  assert.equal(r.status, 400)
  r = await publicar('chave-juca-0000000000000000', { site: 'z', arquivos: [{ caminho: 'pagina.html', b64: b64('a') }] })
  assert.equal(r.status, 400)
  r = await publicar('chave-juca-0000000000000000', { site: 'grande', arquivos: [{ caminho: 'index.html', b64: b64('a') }, { caminho: 'v.mp4', b64: Buffer.alloc(1100 * 1024).toString('base64') }] })
  assert.equal(r.status, 413)
  assert.ok(!fs.existsSync(path.join(process.env.SITES_DIR, 'juca-automoveis', 'grande')))
})

test('ask do certificado: só nome registrado e não bloqueado; admin bloqueia', async () => {
  assert.equal((await fetch(base + '/ask?domain=juca-automoveis.rangeltech.net')).status, 200)
  assert.equal((await fetch(base + '/ask?domain=inventado.rangeltech.net')).status, 404)
  assert.equal((await fetch(base + '/ask?domain=a.b.rangeltech.net')).status, 404)
  assert.equal((await fetch(base + '/api/admin/bloquear/juca-automoveis', { method: 'POST' })).status, 401)
  assert.equal((await fetch(base + '/api/admin/bloquear/juca-automoveis', { method: 'POST', headers: { Authorization: 'Bearer admin-de-teste' } })).status, 200)
  assert.equal((await fetch(base + '/ask?domain=juca-automoveis.rangeltech.net')).status, 404)
  assert.equal((await publicar('chave-juca-0000000000000000', { arquivos: [{ caminho: 'index.html', b64: b64('x') }] })).status, 403)
})
