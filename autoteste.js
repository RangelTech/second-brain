// Teste de instalação: manda uma conversa de verdade ao Hermes e confere a resposta.
// O modelo é um servidor local de mentira (127.0.0.1, porta livre) que só responde uma senha; assim o teste prova que o agente abre,
// lê a configuração, fala com o provedor e devolve texto, sem depender de internet, de conta ou de GPU.
const http = require('http')
const crypto = require('crypto')

function servidorDeMentira(senha) {
  const estado = { pedidos: 0 }
  const servidor = http.createServer((req, res) => {
    let corpo = ''
    req.on('data', (d) => (corpo += d))
    req.on('end', () => {
      const json = (o) => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(o))
      }
      if (/\/models/.test(req.url)) return json({ object: 'list', data: [{ id: 'principal', object: 'model' }] })
      if (!/chat\/completions/.test(req.url)) {
        res.writeHead(404)
        return res.end('{}')
      }
      estado.pedidos++
      let q = {}
      try {
        q = JSON.parse(corpo)
      } catch {}
      const id = 'chatcmpl-teste'
      const base = { id, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: q.model || 'principal' }
      if (q.stream) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
        const envia = (o) => res.write('data: ' + JSON.stringify(o) + '\n\n')
        envia({ ...base, choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] })
        envia({ ...base, choices: [{ index: 0, delta: { content: senha }, finish_reason: null }] })
        envia({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 } })
        res.write('data: [DONE]\n\n')
        return res.end()
      }
      json({ id, object: 'chat.completion', created: base.created, model: base.model, choices: [{ index: 0, message: { role: 'assistant', content: senha }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 } })
    })
  })
  return new Promise((resolve) => servidor.listen(0, '127.0.0.1', () => resolve({ servidor, estado, porta: servidor.address().port })))
}

// `criarSessao(base)` devolve uma Sessao do agente apontada para o modelo de mentira (quem chama escolhe pasta, app, etc.).
// Devolve { ok, motivo, resposta }.
async function conversaDeTeste({ criarSessao, prazoMs = 120000, anotar = () => {} }) {
  const senha = 'TESTE-OK-' + crypto.randomBytes(3).toString('hex')
  const { servidor, estado, porta } = await servidorDeMentira(senha)
  let sessao
  try {
    let texto = ''
    sessao = criarSessao('http://127.0.0.1:' + porta + '/v1', (e) => {
      if (e.texto) texto += e.texto
    })
    await sessao.iniciar()
    anotar('conversando com o agente')
    await Promise.race([sessao.perguntar('Responda apenas com a senha que o servidor devolver.'), new Promise((_, rej) => setTimeout(() => rej(new Error('o agente não respondeu a tempo')), prazoMs))])
    if (!texto.includes(senha)) return { ok: false, motivo: estado.pedidos ? 'o agente respondeu, mas a resposta veio errada' : 'o agente não chegou a falar com o modelo', resposta: texto.slice(0, 200) }
    return { ok: true, resposta: texto.slice(0, 200) }
  } catch (e) {
    return { ok: false, motivo: String(e.message || e).slice(0, 300), resposta: '' }
  } finally {
    try {
      sessao?.encerrar()
    } catch {}
    servidor.close()
  }
}

module.exports = { conversaDeTeste, servidorDeMentira }
