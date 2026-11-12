// O Hermes recebe uma chave fixa e sem valor; a ponte poe a chave real do roteador e acha a conversa pela marca no corpo (12/11/2026).
const test = require('node:test')
const assert = require('node:assert')
const http = require('node:http')
const { criar } = require('../ponte-llm')

test('chave do Hermes qualquer: a ponte troca pela real e atribui a conversa pela marca', async () => {
  let recebida = null
  const destino = http.createServer((req, res) => {
    recebida = req.headers.authorization
    req.resume()
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      res.write('data: {"choices":[{"delta":{"content":"ola mundo ola mundo ola mundo"}}]}\n\n')
      res.end('data: [DONE]\n\n')
    })
  })
  await new Promise((r) => destino.listen(0, '127.0.0.1', r))
  const eventos = []
  const ponte = criar({
    destino: () => 'http://127.0.0.1:' + destino.address().port,
    aoProgresso: (chat, info) => eventos.push(chat),
    chaveRoteador: async () => 'chave-real-do-roteador',
  })
  const porta = await ponte.iniciar()
  const corpo = JSON.stringify({ model: 'x', stream: true, messages: [{ role: 'user', content: 'oi\n<!--sb:chat-abc123-->' }] })
  for (const chaveDoHermes of ['sb-local', 'qualquer-coisa-diferente']) {
    recebida = null
    const r = await fetch(`http://127.0.0.1:${porta}/v1/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + chaveDoHermes }, body: corpo })
    await r.text()
    assert.equal(recebida, 'Bearer chave-real-do-roteador', 'a chave real sai para o roteador, nao a do Hermes')
  }
  assert.ok(eventos.includes('chat-abc123'), 'progresso atribuido a conversa da marca: ' + JSON.stringify(eventos))
  ponte.fechar()
  destino.close()
  destino.closeAllConnections?.()
})
