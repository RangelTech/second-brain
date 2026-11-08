// Jobs pesados de midia (video em alta, troca de personagem): a ferramenta devolve na hora e o app conclui em segundo plano.
const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const fs = require('fs')
const os = require('os')
const path = require('path')
const midia = require('../mcp-midia')

const PROMPT = Array.from({ length: 60 }, (_, i) => 'palavra' + i).join(' ') // passa do minimo de detalhe do prompt de video

function servidor(estados) {
  let consultas = 0
  const srv = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/videos/generations') { res.writeHead(202, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ id: 'job1' })) }
    if (req.url === '/media/jobs/job1') {
      const st = estados[Math.min(consultas++, estados.length - 1)]
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({ status: st, progress: st === 'done' ? 100 : 40, seconds: 450 }))
    }
    if (req.url === '/jobs/job1/file') { res.writeHead(200, { 'content-type': 'video/mp4' }); return res.end(Buffer.from('mp4-falso')) }
    res.writeHead(404); res.end('{}')
  })
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)))
}

test('video em alta devolve na hora; o app conclui em segundo plano e entrega o arquivo na pasta Videos', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-midia-'))
  const srv = await servidor(['running', 'done'])
  try {
    midia.configurar({ base: 'http://127.0.0.1:' + srv.address().port, chave: 'k', pasta })
    process.env.SB_MIDIA_CHAT = 'chat-xyz'
    const t0 = Date.now()
    const r = await midia.gerarVideo({ prompt: PROMPT, qualidade: 'alta', nome: 'carro' })
    assert.equal(r.pendente, true, 'a ferramenta nao espera a GPU')
    assert.ok(Date.now() - t0 < 2000)
    assert.ok(fs.existsSync(path.join(pasta, '.midia', 'pendente-job1.json')))
    assert.deepEqual(await midia.concluirPendentes(), [], '1a conferencia: ainda rodando')
    const feitos = await midia.concluirPendentes()
    assert.equal(feitos.length, 1)
    assert.equal(feitos[0].chat, 'chat-xyz')
    assert.match(feitos[0].caminho, /Videos.carro-.*[.]mp4$/)
    assert.equal(fs.readFileSync(feitos[0].caminho, 'utf8'), 'mp4-falso')
    assert.ok(!fs.existsSync(path.join(pasta, '.midia', 'pendente-job1.json')), 'pendencia some depois de concluir')
    assert.deepEqual(await midia.concluirPendentes(), [])
  } finally {
    delete process.env.SB_MIDIA_CHAT
    srv.close()
  }
})

test('job que falha no servidor vira aviso de falha e a pendencia some', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-midia-'))
  const srv = await servidor(['failed'])
  try {
    midia.configurar({ base: 'http://127.0.0.1:' + srv.address().port, chave: 'k', pasta })
    const r = await midia.gerarVideo({ prompt: PROMPT, qualidade: 'alta' })
    assert.equal(r.pendente, true)
    const feitos = await midia.concluirPendentes()
    assert.equal(feitos.length, 1)
    assert.equal(feitos[0].falhou, true)
    assert.ok(!fs.existsSync(path.join(pasta, '.midia', 'pendente-job1.json')))
  } finally {
    srv.close()
  }
})

test('video rapido continua sincrono (espera e devolve o caminho)', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-midia-'))
  const srv = await servidor(['done'])
  try {
    midia.configurar({ base: 'http://127.0.0.1:' + srv.address().port, chave: 'k', pasta })
    const r = await midia.gerarVideo({ prompt: PROMPT, nome: 'rapido' })
    assert.ok(!r.pendente && r.caminho && fs.existsSync(r.caminho))
  } finally {
    srv.close()
  }
})
