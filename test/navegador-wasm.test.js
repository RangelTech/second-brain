// Navegador WebAssembly da versão web (spec 60 §8): registro das abas, pedido/resposta pela ponte e sites da pasta de trabalho.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const NW = require('../navegador-wasm.js')

const senderFalso = () => { const enviados = []; return { enviados, send: (canal, dados) => enviados.push({ canal, dados }) } }

test('sem nenhuma tela web capaz, não fica disponível nem espera', async () => {
  const w = NW.criar()
  assert.equal(w.disponivel(), false)
  const t0 = Date.now()
  assert.equal(await w.garantir(5000), false)
  assert.ok(Date.now() - t0 < 200)
})

test('tela capaz recebe "ligar" e o pedido só vai para a aba com o motor pronto', async () => {
  const w = NW.criar()
  const s = senderFalso()
  w.registrar(s, { aba: 'a1', capaz: true, pronto: false })
  assert.equal(w.disponivel(), true)
  assert.equal(w.online(), false)
  const espera = w.garantir(3000)
  await new Promise((r) => setTimeout(r, 50))
  assert.equal(s.enviados[0].canal, 'navwasm:ligar')
  w.registrar(s, { aba: 'a1', capaz: true, pronto: true })
  assert.equal(await espera, true)
  const p = w.pedir('info', [])
  const ped = s.enviados.find((e) => e.canal === 'navwasm:pedido')
  assert.equal(ped.dados.aba, 'a1')
  assert.equal(ped.dados.op, 'info')
  w.responder({ id: ped.dados.id, ok: true, valor: { url: 'https://exemplo.com/' } })
  assert.deepEqual(await p, { url: 'https://exemplo.com/' })
})

test('erro da página volta como erro e resposta desconhecida é ignorada', async () => {
  const w = NW.criar()
  const s = senderFalso()
  w.registrar(s, { aba: 'a2', capaz: true, pronto: true })
  const p = w.pedir('avaliar', ['x'])
  const ped = s.enviados.find((e) => e.canal === 'navwasm:pedido')
  assert.equal(w.responder({ id: 'nao-existe', ok: true }), false)
  w.responder({ id: ped.dados.id, ok: false, erro: 'falhou de propósito' })
  await assert.rejects(p, /falhou de propósito/)
})

test('aba que fecha deixa de receber pedidos', async () => {
  const w = NW.criar()
  const s = senderFalso()
  w.registrar(s, { aba: 'a3', capaz: true, pronto: true })
  w.registrar(s, { aba: 'a3', capaz: false, pronto: false })
  assert.equal(w.online(), false)
  assert.equal(w.disponivel(), false)
  await assert.rejects(w.pedir('info'), /não está aberto/)
})

test('site da pasta de trabalho: serve arquivos da pasta e recusa caminho para fora dela', () => {
  const w = NW.criar()
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'))
  fs.mkdirSync(path.join(pasta, 'css'))
  fs.writeFileSync(path.join(pasta, 'index.html'), '<h1>oi</h1>')
  fs.writeFileSync(path.join(pasta, 'css', 'a b.css'), 'h1{}')
  fs.writeFileSync(path.join(os.tmpdir(), 'segredo-fora.txt'), 'nao')
  const cam = w.caminhoDoSite(path.join(pasta, 'index.html'))
  assert.match(cam, /^site\/[\w-]{8,40}\/index\.html$/)
  const base = cam.slice(0, cam.lastIndexOf('/') + 1)
  const r = w.lerDoSite(cam)
  assert.equal(r.status, 200)
  assert.match(r.tipo, /text\/html/)
  assert.equal(String(r.corpo), '<h1>oi</h1>')
  assert.equal(w.lerDoSite(base + 'css/a%20b.css').status, 200)
  assert.equal(w.lerDoSite(base).status, 200) // pasta -> index.html
  assert.equal(w.lerDoSite(base + '..%2Fsegredo-fora.txt').status, 403)
  assert.equal(w.lerDoSite(base + '../segredo-fora.txt').status, 403)
  assert.equal(w.lerDoSite('site/chave-que-nao-existe/index.html').status, 404)
  assert.equal(w.caminhoDoSite(path.join(pasta, 'outra.html')).split('/')[1], cam.split('/')[1]) // mesma pasta, mesma chave
})
