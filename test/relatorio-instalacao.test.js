// Relatorio de falha da instalacao: limpa o usuario, manda ao servidor, nunca derruba.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const rel = require('../relatorio-instalacao')

test('limpar tira o nome de usuario dos caminhos', () => {
  const t = rel.limpar('abrindo C:\Users\maria.silva\AppData\Roaming\SegundoCerebro e /home/joao/x e /Users/ana/y', 'maria.silva')
  assert.ok(!/maria|joao|ana/.test(t), t)
  assert.match(t, /Users\<usuario>\AppData/)
})

test('enviar manda versao, etapa, rede e o fim do log; responde true', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rel-'))
  const arq = path.join(dir, 'preparo.log')
  fs.writeFileSync(arq, '2026-11-09T10:00:00Z iniciando o preparo do agente\n2026-11-09T10:01:00Z falhou: Nao consegui baixar o instalador do agente.\n')
  const chamadas = []
  const buscar = async (url, op = {}) => {
    chamadas.push({ url, op })
    if (op.method === 'POST') return { ok: true, status: 200 }
    if (url.includes('raw.githubusercontent.com')) throw Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNRESET' } })
    return { ok: true, status: 200 }
  }
  const ok = await rel.enviar({ versao: '0.6.52', logArq: arq, codigo: 1, buscar, base: 'https://exemplo.test/v1' })
  assert.equal(ok, true)
  const post = chamadas.find((c) => c.op.method === 'POST')
  assert.equal(post.url, 'https://exemplo.test/v1/diag/instalacao')
  const corpo = JSON.parse(post.op.body)
  assert.equal(corpo.versao, '0.6.52')
  assert.match(corpo.etapa, /Nao consegui baixar o instalador/)
  assert.match(corpo.log, /raw\.githubusercontent\.com=erro:ECONNRESET/) // mostra quem bloqueou
})

test('servidor fora do ar nao levanta erro', async () => {
  const buscar = async () => {
    throw new Error('sem rede')
  }
  assert.equal(await rel.enviar({ versao: '0.6.52', logArq: '/nao/existe.log', codigo: 1, buscar }), false)
})
