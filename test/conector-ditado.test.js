// Conector da voz ao vivo (spec 52): protocolo exato contra um servidor local e rotação de conexão
const test = require('node:test')
const assert = require('node:assert/strict')
const { WebSocketServer } = require('ws')
const { abrirStream, urlDoServidor } = require('../conector-ditado')

function servidor(aoConectar) {
  const srv = new WebSocketServer({ port: 0 })
  const conexoes = []
  srv.on('connection', (ws, req) => {
    const c = { ws, url: req.url, auth: req.headers.authorization, app: req.headers['x-app'], audio: 0, textos: [] }
    conexoes.push(c)
    ws.on('message', (m, bin) => {
      if (bin) c.audio += m.length
      else c.textos.push(JSON.parse(String(m)).type)
      aoConectar && aoConectar(c, m, bin)
    })
  })
  return new Promise((ok) => srv.on('listening', () => ok({ srv, conexoes, url: `ws://127.0.0.1:${srv.address().port}/api/ws/speech_to_text/voice_stream` })))
}

test('urlDoServidor: base do llm-access vira wss .../audio/stream', () => {
  assert.equal(urlDoServidor('https://api.segundocerebro.pro/v1'), 'wss://api.segundocerebro.pro/v1/audio/stream')
  assert.equal(urlDoServidor('http://127.0.0.1:9/v1/'), 'ws://127.0.0.1:9/v1/audio/stream')
})

test('conector: cabeçalhos, parâmetros, fila antes de abrir, texto acumulado, fim de fala e CloseStream', async () => {
  const S = await servidor((c, m, bin) => {
    if (bin && c.audio >= 6400 && !c.mandou) {
      c.mandou = true
      c.ws.send(JSON.stringify({ type: 'TranscriptText', data: 'Oi,' }))
      c.ws.send(JSON.stringify({ type: 'TranscriptText', data: 'Oi, tudo bem?' }))
    }
    if (!bin && JSON.parse(String(m)).type === 'CloseStream') {
      c.ws.send(JSON.stringify({ type: 'TranscriptText', data: 'Oi, tudo bem? Sim.' }))
      c.ws.send(JSON.stringify({ type: 'TranscriptEndpoint' }))
      c.ws.close()
    }
  })
  const ev = []
  await new Promise((ok) => {
    const c = abrirStream({ url: S.url, auth: 'Bearer k', idioma: 'pt' }, {
      aoTexto: (t) => ev.push('t:' + t),
      aoFimDeFala: () => ev.push('fim'),
      aoErro: (m) => ev.push('erro:' + m),
      aoFechar: ok,
    })
    c.enviar(Buffer.alloc(3200)) // antes de abrir: fica na fila
    c.enviar(new Uint8Array(3200))
    setTimeout(() => c.fechar(), 300)
  })
  S.srv.close()
  const c = S.conexoes[0]
  assert.equal(S.conexoes.length, 1)
  for (const p of ['encoding=linear16', 'sample_rate=16000', 'channels=1', 'endpointing_ms=300', 'utterance_end_ms=1000', 'language=pt', 'use_conversation_engine=true']) assert.ok(c.url.includes(p), p)
  assert.equal(c.auth, 'Bearer k')
  assert.equal(c.app, 'segundo-cerebro')
  assert.equal(c.audio, 6400)
  assert.deepEqual(c.textos, ['KeepAlive', 'CloseStream'])
  assert.deepEqual(ev, ['t:Oi,', 't:Oi, tudo bem?', 't:Oi, tudo bem? Sim.', 'fim'])
})

test('conector: troca de conexão no limite (fala sem pausa) junta o texto das duas na mesma fala', async () => {
  // servidor: 1ª conexão devolve "um dois" e, ao receber CloseStream, entrega o final dela atrasado; a 2ª conexão devolve "três"
  const S = await servidor((c, m, bin) => {
    const idx = S.conexoes.indexOf(c)
    if (bin && idx === 0 && !c.mandou) (c.mandou = true), c.ws.send(JSON.stringify({ type: 'TranscriptText', data: 'um dois' }))
    if (bin && idx === 1 && !c.mandou) {
      c.mandou = true
      c.ws.send(JSON.stringify({ type: 'TranscriptText', data: 'três' }))
      setTimeout(() => c.ws.readyState === 1 && c.ws.send(JSON.stringify({ type: 'TranscriptEndpoint' })), 400)
    }
    if (!bin && JSON.parse(String(m)).type === 'CloseStream') {
      setTimeout(() => {
        if (c.ws.readyState !== 1) return
        c.ws.send(JSON.stringify({ type: 'TranscriptText', data: idx === 0 ? 'um dois' : 'três' }))
        c.ws.send(JSON.stringify({ type: 'TranscriptEndpoint' }))
        c.ws.close()
      }, 200)
    }
  })
  const ev = []
  let c
  await new Promise((ok) => {
    c = abrirStream({ url: S.url, auth: 'Bearer k', rotacaoMs: 400, folgaMs: 100 }, { aoTexto: (t) => ev.push('t:' + t), aoFimDeFala: () => ev.push('fim'), aoErro: (m) => ev.push('erro:' + m), aoFechar: ok })
    const tic = setInterval(() => c.enviar(Buffer.alloc(3200)), 50)
    setTimeout(() => (clearInterval(tic), c.fechar()), 1100)
  })
  S.srv.close()
  assert.ok(S.conexoes.length >= 2, 'abriu conexão nova')
  assert.ok(S.conexoes[0].textos.includes('CloseStream'), 'velha recebeu CloseStream')
  assert.ok(S.conexoes[1].audio > 0, 'áudio passou para a nova')
  assert.ok(!ev.some((e) => e.startsWith('erro')), ev.join('|'))
  // a fala que atravessou a troca chega inteira antes do fim
  const iFim = ev.indexOf('fim')
  assert.ok(iFim > 0)
  assert.equal(ev[iFim - 1], 't:um dois três')
})

test('conector: troca cedo na pausa (perto do limite, logo depois do fim de fala)', async () => {
  const S = await servidor((c, m, bin) => {
    if (bin && S.conexoes.indexOf(c) === 0 && !c.mandou) {
      c.mandou = true
      c.ws.send(JSON.stringify({ type: 'TranscriptText', data: 'oi' }))
      setTimeout(() => c.ws.readyState === 1 && c.ws.send(JSON.stringify({ type: 'TranscriptEndpoint' })), 350)
    }
    if (!bin && JSON.parse(String(m)).type === 'CloseStream') c.ws.close()
  })
  let trocouEm = 0
  const t0 = Date.now()
  await new Promise((ok) => {
    const c = abrirStream({ url: S.url, auth: 'k', rotacaoMs: 2000, folgaMs: 1800 }, { aoFechar: ok })
    const tic = setInterval(() => {
      c.enviar(Buffer.alloc(3200))
      if (!trocouEm && S.conexoes.length > 1) trocouEm = Date.now() - t0
    }, 30)
    setTimeout(() => (clearInterval(tic), c.fechar()), 1000)
  })
  S.srv.close()
  assert.ok(trocouEm > 0 && trocouEm < 900, 'trocou na pausa, bem antes do limite: ' + trocouEm)
})

test('conector: servidor fora do ar avisa erro e fecha', async () => {
  const ev = []
  await new Promise((ok) => abrirStream({ url: 'ws://127.0.0.1:1/x', auth: 'x' }, { aoErro: () => ev.push('erro'), aoFechar: ok }))
  assert.ok(ev.includes('erro'))
})
