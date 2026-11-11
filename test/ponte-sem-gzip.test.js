// A ponte reescreve o corpo da resposta; resposta compactada corrompia tudo ("Error -3 while decompressing data: incorrect header check")
// e todo turno do Hermes novo falhava (QA Linux 11/11/2026). A ponte tem de pedir ao roteador a resposta SEM compactação.
const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const ponte = require('../ponte-llm')

test('a ponte pede identity ao roteador mesmo quando o Hermes pede gzip', async () => {
  let recebido = null
  const up = http.createServer((req, res) => {
    recebido = req.headers['accept-encoding']
    res.writeHead(200, { 'Content-Type': 'text/event-stream' })
    res.end('data: {"choices":[{"delta":{"content":"oi"}}]}\n\ndata: [DONE]\n\n')
  })
  await new Promise((r) => up.listen(0, '127.0.0.1', r))
  const p = ponte.criar({ destino: () => `http://127.0.0.1:${up.address().port}`, aoProgresso: () => {}, registrar: () => {} })
  const porta = await p.iniciar()
  try {
    const corpo = await new Promise((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port: porta, method: 'POST', path: '/v1/chat/completions', headers: { authorization: 'Bearer x::sb::chat1', 'accept-encoding': 'gzip, deflate, br', connection: 'close' } }, (r) => {
        const ps = []
        r.on('data', (b) => ps.push(b))
        r.on('end', () => resolve(Buffer.concat(ps).toString('utf8')))
      })
      req.on('error', reject)
      req.end('{}')
    })
    assert.equal(recebido, 'identity')
    assert.ok(corpo.includes('"content":"oi"'))
  } finally {
    p.fechar()
    up.close()
    http.globalAgent.destroy()
  }
})
