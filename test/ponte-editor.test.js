// O Hermes põe um sufixo por sessão (editor_<nome>_<8 hex>) no nome dos servidores MCP; ele aparece no prompt e invalida o cache de
// prefixo do servidor a cada sessão nova. A ponte troca o sufixo por um fixo na ida e devolve o real na volta.
const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const ponte = require('../ponte-llm')

const NL = String.fromCharCode(10)

test('normalizarEditor: sufixos diferentes da mesma sessão-tipo viram o mesmo texto; restaurar devolve o original', () => {
  const a = 'tool_search: editor_memoria_8ff68f77 tools (2): mcp__editor_memoria_8ff68f77__memoria_buscar e editor_midia_0a1b2c3d'
  const b = a.split('8ff68f77').join('99353ec5').split('0a1b2c3d').join('deadbeef')
  const na = ponte.normalizarEditor(a)
  const nb = ponte.normalizarEditor(b)
  assert.equal(na.texto, nb.texto, 'o texto enviado ao servidor tem que ser igual entre sessões')
  assert.equal(na.texto.length, a.length, 'troca de mesmo tamanho')
  assert.ok(!na.texto.includes('8ff68f77') && !na.texto.includes('0a1b2c3d'))
  assert.equal(ponte.restaurarEditor(na.texto, na.pares), a)
  assert.equal(ponte.restaurarEditor(nb.texto, nb.pares), b)
})

test('normalizarEditor: texto sem editor_ não muda', () => {
  const s = '{"messages":[{"role":"user","content":"editor de texto, 12345678"}]}'
  const n = ponte.normalizarEditor(s)
  assert.equal(n.texto, s)
  assert.equal(n.pares.size, 0)
})

test('ponte: servidor recebe o sufixo fixo e o Hermes recebe o nome real de volta (streaming, nome cortado em dois pedaços)', async () => {
  let recebido = ''
  const real = 'editor_memoria_8ff68f77'
  const up = http.createServer((req, res) => {
    const partes = []
    req.on('data', (c) => partes.push(c))
    req.on('end', () => {
      recebido = Buffer.concat(partes).toString('utf8')
      const fixo = ponte.normalizarEditor(real).texto
      const linha = 'data: ' + JSON.stringify({ choices: [{ delta: { tool_calls: [{ function: { name: 'mcp__' + fixo + '__memoria_buscar', arguments: '{}' } }] } }] }) + NL + NL
      res.writeHead(200, { 'Content-Type': 'text/event-stream' })
      const meio = Math.floor(linha.length / 2)
      res.write(linha.slice(0, meio)) // o nome da ferramenta chega cortado
      setTimeout(() => {
        res.write(linha.slice(meio))
        res.end('data: [DONE]' + NL + NL)
      }, 30)
    })
  })
  await new Promise((r) => up.listen(0, '127.0.0.1', r))
  const p = ponte.criar({ destino: () => 'http://127.0.0.1:' + up.address().port, aoProgresso: () => {}, registrar: () => {} })
  const porta = await p.iniciar()
  const corpo = JSON.stringify({ stream: true, tools: [{ function: { name: 'tool_search', description: 'mcp__' + real + '__memoria_buscar' } }] })
  try {
    const resposta = await new Promise((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port: porta, method: 'POST', path: '/v1/chat/completions', headers: { authorization: 'Bearer x::sb::chat1', 'content-type': 'application/json', connection: 'close' } }, (r) => {
        const pedacos = []
        r.on('data', (b) => pedacos.push(b))
        r.on('end', () => resolve(Buffer.concat(pedacos).toString('utf8')))
      })
      req.on('error', reject)
      req.end(corpo)
    })
    assert.ok(!recebido.includes('8ff68f77'), 'o servidor não pode receber o sufixo real da sessão')
    assert.ok(recebido.includes(ponte.normalizarEditor(real).texto), 'o servidor recebe o sufixo fixo')
    assert.ok(resposta.includes('mcp__' + real + '__memoria_buscar'), 'o Hermes recebe o nome real de volta')
    assert.ok(resposta.includes('[DONE]'))
  } finally {
    p.fechar()
    up.close()
    http.globalAgent.destroy()
  }
})
