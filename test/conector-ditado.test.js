// Conector do ditado ao vivo (spec 49): protocolo exato contra um servidor local
const test = require('node:test')
const assert = require('node:assert/strict')
const { WebSocketServer } = require('ws')
const { abrirStream } = require('../conector-ditado')

test('conector: cabeçalhos, parâmetros, áudio antes de abrir, parcial/final/fim e CloseStream', async () => {
  const visto = { audio: 0, textos: [] }
  const srv = new WebSocketServer({ port: 0 })
  srv.on('connection', (ws, req) => {
    visto.url = req.url
    visto.auth = req.headers.authorization
    visto.app = req.headers['x-app']
    ws.on('message', (m, bin) => {
      if (bin) {
        visto.audio += m.length
        if (visto.audio >= 6400 && !visto.mandou) {
          visto.mandou = true
          ws.send(JSON.stringify({ type: 'TranscriptInterim', data: 'ola' }))
        }
        return
      }
      const j = JSON.parse(String(m))
      visto.textos.push(j.type)
      if (j.type === 'CloseStream') {
        ws.send(JSON.stringify({ type: 'TranscriptText', data: 'ola mundo' }))
        ws.send(JSON.stringify({ type: 'TranscriptEndpoint' }))
        ws.close()
      }
    })
  })
  await new Promise((r) => srv.on('listening', r))
  const base = `http://127.0.0.1:${srv.address().port}/v1`
  const ev = []
  const fechou = new Promise((ok) => {
    const c = abrirStream({ base, chave: 'sk-cliente', idioma: 'pt' }, {
      aoParcial: (t) => ev.push('parcial:' + t),
      aoFinal: (t) => ev.push('final:' + t),
      aoFimDeFala: () => ev.push('fim'),
      aoErro: (m) => ev.push('erro:' + m),
      aoFechar: ok,
    })
    c.enviar(Buffer.alloc(3200)) // antes de abrir: fica na fila
    c.enviar(new Uint8Array(3200))
    setTimeout(() => c.fechar(), 300)
  })
  await fechou
  srv.close()
  assert.match(visto.url, /^\/v1\/audio\/stream\?/)
  for (const p of ['encoding=linear16', 'sample_rate=16000', 'channels=1', 'endpointing_ms=300', 'utterance_end_ms=1000', 'language=pt', 'use_conversation_engine=true']) assert.ok(visto.url.includes(p), p)
  assert.equal(visto.auth, 'sk-cliente')
  assert.equal(visto.app, 'segundo-cerebro')
  assert.equal(visto.audio, 6400)
  assert.deepEqual(visto.textos, ['KeepAlive', 'CloseStream'])
  assert.deepEqual(ev, ['parcial:ola', 'final:ola mundo', 'fim'])
})

test('conector: servidor fora do ar avisa erro e fecha', async () => {
  const ev = []
  await new Promise((ok) => abrirStream({ base: 'http://127.0.0.1:1/v1', chave: 'x' }, { aoErro: (m) => ev.push('erro'), aoFechar: ok }))
  assert.ok(ev.includes('erro'))
})
