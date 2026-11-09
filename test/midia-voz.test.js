// Ferramentas de voz (clonar_voz, trocar_voz, redublar_video): pedido certo ao servidor, previsão vinda dele e arquivo salvo na pasta certa (Audios ou Videos).
const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const fs = require('fs')
const os = require('os')
const path = require('path')
const midia = require('../mcp-midia')

function servidor(mime, estados = ['queued', 'done']) {
  let consultas = 0
  const reqs = []
  const srv = http.createServer((req, res) => {
    if (req.method === 'POST') {
      let b = ''
      req.on('data', (c) => (b += c))
      return req.on('end', () => { try { reqs.push({ url: req.url, corpo: JSON.parse(b) }) } catch {} res.writeHead(202, { 'content-type': 'application/json' }); res.end(JSON.stringify({ id: 'job1' })) })
    }
    if (req.url === '/media/jobs/job1') {
      const st = estados[Math.min(consultas++, estados.length - 1)]
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({ status: st, progress: st === 'done' ? 100 : 20, eta_s: st === 'done' ? 0 : 420, seconds: 90, mime }))
    }
    if (req.url === '/jobs/job1/file') { res.writeHead(200, { 'content-type': mime }); return res.end(Buffer.from('dados-falsos')) }
    res.writeHead(404); res.end('{}')
  })
  srv.reqs = reqs
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)))
}
const pastaTmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sb-voz-'))
const arq = (pasta, nome, bytes = 'x'.repeat(2000)) => { const p = path.join(pasta, nome); fs.writeFileSync(p, bytes); return p }

test('clonar_voz envia texto e amostra, mostra a previsão do servidor e salva o WAV em Audios', async () => {
  const pasta = pastaTmp()
  const srv = await servidor('audio/wav')
  try {
    midia.configurar({ base: 'http://127.0.0.1:' + srv.address().port, chave: 'k', pasta })
    const r = await midia.clonarVoz({ texto: 'Olá, tudo bem?', amostra: arq(pasta, 'amostra.wav'), idioma: 'pt', nome: 'locucao' })
    assert.equal(r.pendente, true)
    assert.equal(r.min, 7)
    assert.equal(srv.reqs[0].url, '/audio/voice-clone')
    assert.equal(srv.reqs[0].corpo.text, 'Olá, tudo bem?')
    assert.equal(srv.reqs[0].corpo.language, 'pt')
    assert.ok(srv.reqs[0].corpo.reference_audio.length > 10)
    assert.ok(!('consent' in srv.reqs[0].corpo), 'o servidor nao exige consentimento')
    const feitos = await midia.concluirPendentes()
    assert.equal(feitos.length, 1)
    assert.match(feitos[0].caminho, /Audios.locucao-.*[.]wav$/)
  } finally { srv.close() }
})

test('trocar_voz: vídeo de entrada sai em Videos; áudio de entrada sai em Audios', async () => {
  const pasta = pastaTmp()
  let srv = await servidor('video/mp4')
  try {
    midia.configurar({ base: 'http://127.0.0.1:' + srv.address().port, chave: 'k', pasta })
    const r = await midia.trocarVoz({ arquivo: arq(pasta, 'cena.mp4'), voz_alvo: arq(pasta, 'alvo.wav'), manter_fundo: false })
    assert.equal(r.pendente, true)
    assert.equal(srv.reqs[0].url, '/audio/voice-convert')
    assert.equal(srv.reqs[0].corpo.keep_background, false)
    const f = await midia.concluirPendentes()
    assert.match(f[0].caminho, /Videos.*[.]mp4$/)
  } finally { srv.close() }
  srv = await servidor('audio/wav')
  try {
    midia.configurar({ base: 'http://127.0.0.1:' + srv.address().port, chave: 'k', pasta })
    await midia.trocarVoz({ arquivo: arq(pasta, 'fala.wav'), voz_alvo: arq(pasta, 'alvo2.wav') })
    const f = await midia.concluirPendentes()
    assert.match(f[0].caminho, /Audios.*[.]wav$/)
  } finally { srv.close() }
})

test('redublar_video envia idioma, voz opcional e salva o MP4 dublado', async () => {
  const pasta = pastaTmp()
  const srv = await servidor('video/mp4')
  try {
    midia.configurar({ base: 'http://127.0.0.1:' + srv.address().port, chave: 'k', pasta })
    const r = await midia.redublarVideo({ video: arq(pasta, 'aula.mp4'), idioma: 'es', idioma_origem: 'en', voz: arq(pasta, 'outra.wav') })
    assert.equal(r.pendente, true)
    const c = srv.reqs[0].corpo
    assert.equal(srv.reqs[0].url, '/videos/dub')
    assert.equal(c.target_language, 'es')
    assert.equal(c.source_language, 'en')
    assert.ok(c.voice && c.video)
    const f = await midia.concluirPendentes()
    assert.match(f[0].caminho, /Videos.video-dublado-.*[.]mp4$/)
  } finally { srv.close() }
})

test('arquivo inexistente ou grande demais vira erro claro antes de enviar', async () => {
  const pasta = pastaTmp()
  const srv = await servidor('audio/wav')
  try {
    midia.configurar({ base: 'http://127.0.0.1:' + srv.address().port, chave: 'k', pasta })
    await assert.rejects(() => midia.clonarVoz({ texto: 'oi', amostra: path.join(pasta, 'nao-existe.wav') }), /não foi encontrado/)
    await assert.rejects(() => midia.redublarVideo({ video: arq(pasta, 'enorme.mp4', Buffer.alloc(41 * 1024 * 1024)), idioma: 'pt' }), /grande demais/)
    assert.equal(srv.reqs.length, 0)
  } finally { srv.close() }
})
