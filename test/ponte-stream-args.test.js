// Integracao: a ponte inteira com um servidor que manda os argumentos de uma chamada de ferramenta partidos em varios eventos SSE,
// com o nome MCP (sufixo fixo) cortado no meio. O Hermes tem que receber os argumentos reunidos com o nome REAL.
const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const ponte = require('../ponte-llm')

const NL = String.fromCharCode(10)
const REAL = 'editor_midia_0f551416'

test('ponte: nome MCP partido entre eventos de argumentos chega inteiro e real ao Hermes', async () => {
  const fixo = ponte.normalizarEditor(REAL).texto
  const argumentosCompletos = '{"name":"mcp__' + fixo + '__midia_gerar_imagem","arguments":{"prompt":"sedan prata"}}'
  const pedacos = []
  for (let i = 0; i < argumentosCompletos.length; i += 4) pedacos.push(argumentosCompletos.slice(i, i + 4))
  let recebidoPeloServidor = ''
  const up = http.createServer((req, res) => {
    const partes = []
    req.on('data', (c) => partes.push(c))
    req.on('end', () => {
      recebidoPeloServidor = Buffer.concat(partes).toString('utf8')
      res.writeHead(200, { 'Content-Type': 'text/event-stream' })
      const ev = (args, fim) => 'data: ' + JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', created: 1, model: 'm', choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { name: undefined, arguments: args } }] }, finish_reason: fim || null }] }) + NL + NL
      let i = 0
      const t = setInterval(() => {
        if (i < pedacos.length) res.write(ev(pedacos[i++]))
        else {
          clearInterval(t)
          res.write(ev('', 'tool_calls'))
          res.end('data: [DONE]' + NL + NL)
        }
      }, 3)
    })
  })
  await new Promise((r) => up.listen(0, '127.0.0.1', r))
  const p = ponte.criar({ destino: () => 'http://127.0.0.1:' + up.address().port, aoProgresso: () => {}, registrar: () => {} })
  const porta = await p.iniciar()
  const corpo = JSON.stringify({ stream: true, tools: [{ function: { name: 'tool_search', description: 'mcp__' + REAL + '__midia_gerar_imagem' } }] })
  try {
    const texto = await new Promise((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port: porta, method: 'POST', path: '/v1/chat/completions', headers: { authorization: 'Bearer x::sb::chat1', 'content-type': 'application/json', connection: 'close' } }, (r) => {
        const ps = []
        r.on('data', (b) => ps.push(b))
        r.on('end', () => resolve(Buffer.concat(ps).toString('utf8')))
      })
      req.on('error', reject)
      req.end(corpo)
    })
    assert.ok(!recebidoPeloServidor.includes('0f551416'), 'o servidor so ve o sufixo fixo')
    let args = ''
    let eventos = 0
    for (const linha of texto.split(NL)) {
      if (!linha.startsWith('data:') || linha.includes('[DONE]')) continue
      eventos++
      const o = JSON.parse(linha.slice(5))
      for (const c of o.choices || []) for (const tc of (c.delta && c.delta.tool_calls) || []) if (tc.function && typeof tc.function.arguments === 'string') args += tc.function.arguments
    }
    assert.equal(args, argumentosCompletos.split(fixo).join(REAL), 'o Hermes recebe os argumentos com o nome real')
    assert.ok(eventos > 3, 'continua em stream (varios eventos), nao um bloco so')
    assert.ok(texto.includes('[DONE]'))
    // cada evento termina com linha em branco: nenhum "data:" colado em outro
    assert.ok(!/data:[^\n]*\ndata:/.test(texto), 'eventos SSE separados por linha em branco')
  } finally {
    p.fechar()
    up.close()
    http.globalAgent.destroy()
  }
})
