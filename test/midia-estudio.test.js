// Estúdio no app: preço antes (midia_orcar), recusa sem confirmação, pedido com arquivos em data URI e resultado baixado pelo mesmo acompanhamento.
const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const fs = require('fs')
const os = require('os')
const path = require('path')
const midia = require('../mcp-midia')

function servidor({ disponivel = true } = {}) {
  const reqs = []
  const srv = http.createServer((req, res) => {
    if (req.method === 'POST') {
      let b = ''
      req.on('data', (c) => (b += c))
      return req.on('end', () => {
        const corpo = JSON.parse(b)
        reqs.push({ url: req.url, corpo })
        res.writeHead(200, { 'content-type': 'application/json' })
        if (req.url === '/estudio/orcar') return res.end(JSON.stringify({ rotulo: 'Me coloca nesse vídeo', quantidade: corpo.segundos, unidade: 'segundo', qualidade: '480p', preco_usd: 2.5, preco_brl: 13.75, creditos: 125, saldo: corpo.segundos === 99 ? 40 : 300, tempo_estimado_s: 100, partes: 1, disponivel, acima_do_teto: false }))
        res.end(JSON.stringify({ id: 'est1', status: 'running' }))
      })
    }
    if (req.url === '/media/jobs/est1') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ status: 'done', progress: 100, eta_s: 0, mime: 'video/mp4' })) }
    if (req.url === '/jobs/est1/file') { res.writeHead(200, { 'content-type': 'video/mp4' }); return res.end(Buffer.from('video')) }
    res.writeHead(404); res.end('{}')
  })
  srv.reqs = reqs
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)))
}
const pastaTmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sb-est-'))

test('orcar devolve o preço em reais e pede confirmação ao usuário', async () => {
  const srv = await servidor()
  try {
    midia.configurar({ base: 'http://127.0.0.1:' + srv.address().port, chave: 'k', pasta: pastaTmp() })
    const t = await midia.orcar({ efeito: 'trocar-personagem', segundos: 10 })
    assert.match(t, /125 créditos \(≈ R\$ 13,75\)/)
    assert.match(t, /Você tem 300 créditos/)
    assert.match(t, /pergunte se pode criar/)
    assert.deepEqual(srv.reqs[0], { url: '/estudio/orcar', corpo: { efeito: 'trocar-personagem', segundos: 10 } })
  } finally { srv.close() }
})

test('orcar com o Estúdio desligado diz em breve', async () => {
  const srv = await servidor({ disponivel: false })
  try {
    midia.configurar({ base: 'http://127.0.0.1:' + srv.address().port, chave: 'k', pasta: pastaTmp() })
    assert.match(await midia.orcar({ efeito: 'video-ponta', segundos: 5 }), /em breve/)
  } finally { srv.close() }
})

test('estudio recusa sem confirmado e envia arquivos como data URI', async () => {
  const pasta = pastaTmp()
  const srv = await servidor()
  try {
    midia.configurar({ base: 'http://127.0.0.1:' + srv.address().port, chave: 'k', pasta })
    await assert.rejects(midia.estudio({ efeito: 'editar-video' }), /midia_orcar/)
    const v = path.join(pasta, 'gol.mp4'); fs.writeFileSync(v, 'mp4')
    const f = path.join(pasta, 'mustang.jpg'); fs.writeFileSync(f, 'jpg')
    const r = await midia.estudio({ efeito: 'editar-video', confirmado: true, prompt: 'replace the car with a black Mustang', video: v, fotos: [f], segundos: 10, nome: 'mustang' })
    assert.equal(r.pendente, true)
    const pedido = srv.reqs.find((x) => x.url === '/estudio/gerar').corpo
    assert.match(pedido.inputs.video, /^data:video\/mp4;base64,/)
    assert.match(pedido.inputs.referenceImages[0], /^data:image\/jpeg;base64,/)
    const feitos = await midia.concluirPendentes()
    assert.equal(feitos.length, 1)
    assert.match(feitos[0].caminho, /Videos.mustang-.*[.]mp4$/)
  } finally { srv.close() }
})

test('agente nao ve mais as ferramentas sem modelo (trocar_voz, redublar_video) e ve orcar e estudio', () => {
  const nomes = midia.FERRAMENTAS.map((f) => f.nome)
  assert.ok(nomes.includes('orcar') && nomes.includes('estudio'))
  assert.ok(!nomes.includes('trocar_voz') && !nomes.includes('redublar_video'))
  for (const f of midia.FERRAMENTAS) assert.doesNotMatch(f.desc, /GPU/, f.nome + ' ainda fala em GPU')
})


test('orcar avisa quando faltam créditos', async () => {
  const srv = await servidor()
  try {
    midia.configurar({ base: 'http://127.0.0.1:' + srv.address().port, chave: 'k', pasta: pastaTmp() })
    const t = await midia.orcar({ efeito: 'trocar-personagem', segundos: 99 })
    assert.match(t, /Faltam 85/)
  } finally { srv.close() }
})

test('gerar_imagem com fotos do usuário manda as referências em data URI', async () => {
  const pasta = pastaTmp()
  const reqs = []
  const http2 = require('http')
  const srv = http2.createServer((req, res) => {
    let b = ''
    req.on('data', (c) => (b += c))
    req.on('end', () => { if (req.method === 'POST') reqs.push({ url: req.url, corpo: JSON.parse(b) }); res.writeHead(202, { 'content-type': 'application/json' }); res.end(JSON.stringify({ id: 'img1' })) })
  })
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok))
  try {
    midia.configurar({ base: 'http://127.0.0.1:' + srv.address().port, chave: 'k', pasta })
    const foto = path.join(pasta, 'eu.jpg'); fs.writeFileSync(foto, 'jpg')
    const r = midia.gerarImagem({ prompt: 'dress him in a navy blue suit keeping his face and pose', referencias: [foto] })
    r.catch(() => {})
    await new Promise((ok) => setTimeout(ok, 400))
    const pedido = reqs.find((x) => x.url === '/images/generations')
    assert.ok(pedido, 'pediu a imagem')
    assert.match(pedido.corpo.images[0], /^data:image\/jpeg;base64,/)
  } finally { srv.close() }
})
