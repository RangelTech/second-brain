// A ponte (ponte-llm.js) precisa derrubar um stream que já começou a responder e depois para de vez (sem erro, sem fim),
// em vez de ficar mandando "ainda esperando" pra sempre — isso mascarava o vigia de 5 min do app (item 5 da spec).
process.env.SB_TESTE_STREAM_MORTO_MS = '150' // encurta o limite real (90s) só pra teste rápido: ver abaixo como é lido
const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')

// recarrega o módulo com o limite pequeno via variável de ambiente (ver o ajuste em ponte-llm.js)
const ponte = require('../ponte-llm')

function upstreamQueComecaEMorre() {
  return http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' })
    res.write('data: {"choices":[{"delta":{"content":"oi"}}]}\n\n') // 1 byte real chega
    // e nunca mais escreve nada, nem fecha — exatamente o sintoma real
  })
}

test('stream que começa e trava é derrubado, sem esperar o limite antigo de 15 min', async () => {
  const up = upstreamQueComecaEMorre()
  await new Promise((r) => up.listen(0, '127.0.0.1', r))
  const eventos = []
  const p = ponte.criar({ destino: () => `http://127.0.0.1:${up.address().port}`, aoProgresso: (chat, e) => eventos.push(e), registrar: () => {} })
  const porta = await p.iniciar()

  const req = http.request({ hostname: '127.0.0.1', port: porta, method: 'POST', path: '/v1/chat/completions', headers: { authorization: 'Bearer x::sb::chat1', connection: 'close' } })
  req.end('{}')
  try {
    const r = await new Promise((resolve) => req.once('response', resolve))
    const pedacos = []
    r.on('data', (b) => pedacos.push(b))
    const fechou = new Promise((resolve) => r.on('close', resolve))
    const fechouATempo = await Promise.race([fechou.then(() => true), new Promise((res) => setTimeout(() => res(false), 2000))])
    assert.equal(fechouATempo, true, 'a ponte devia ter derrubado a conexão sozinha, sem precisar de 15 minutos')
    assert.ok(Buffer.concat(pedacos).includes(Buffer.from('"content":"oi"')), 'o pedaço real que chegou antes do travamento tem que ter sido repassado')
  } finally {
    req.destroy()
    p.fechar()
    up.close()
    http.globalAgent.destroy()
  }
})
