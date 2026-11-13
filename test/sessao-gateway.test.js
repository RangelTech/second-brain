// Motor gateway (spec 34): tradução de eventos, fim de turno, permissão por conversa e a SessaoGateway com um gateway falso (sem Hermes).
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { traducao, fimDeTurno, pedidoDePermissao, textoDoResultado } = require('../gateway-cliente')
const { SessaoGateway } = require('../sessao-gateway')

test('eventos do gateway viram o que a tela já desenha', () => {
  const est = {}
  assert.deepEqual(traducao({ type: 'message.delta', payload: { text: 'oi' } }), [{ texto: 'oi' }])
  assert.deepEqual(traducao({ type: 'message.delta', payload: { text: null } }), [])
  assert.deepEqual(traducao({ type: 'reasoning.delta', payload: { text: 'pensando' } }), [{ raciocinio: 'pensando' }])
  const ini = traducao({ type: 'tool.start', payload: { tool_call_id: 't1', tool_name: 'write_file', args: { path: 'a.txt' } } }, est)[0].ferramenta
  assert.equal(ini.status, 'in_progress')
  assert.equal(ini.titulo, 'write_file')
  assert.equal(ini.tipo, 'edit')
  assert.equal(ini.caminho, 'a.txt')
  const fim = traducao({ type: 'tool.complete', payload: { tool_call_id: 't1', result: 'ok' } }, est)[0].ferramenta
  assert.equal(fim.status, 'completed')
  assert.equal(fim.titulo, 'write_file', 'o título vem do início da ferramenta')
  assert.equal(traducao({ type: 'tool.complete', payload: { tool_call_id: 't2', tool_name: 'terminal', result: 'x', is_error: true } }, est)[0].ferramenta.status, 'failed')
  assert.deepEqual(traducao({ type: 'session.info', payload: {} }), [])
})

test('resultado de ferramenta MCP chega como texto, não como JSON', () => {
  assert.equal(textoDoResultado(JSON.stringify({ result: 'Preço: R$ 13,75' })), 'Preço: R$ 13,75')
  assert.equal(textoDoResultado('texto puro'), 'texto puro')
  assert.equal(textoDoResultado(JSON.stringify([{ text: 'a' }, { text: 'b' }])), 'a\nb')
  assert.equal(textoDoResultado(null), '')
})

test('fim de turno e pedido de permissão', () => {
  assert.deepEqual(fimDeTurno({ type: 'message.complete', payload: { outcome: 'completed' } }), { fim: true, outcome: 'completed' })
  assert.equal(fimDeTurno({ type: 'message.delta', payload: {} }).fim, false)
  const p = pedidoDePermissao({ type: 'approval.request', payload: { prompt_id: 'p1', execution_generation: 3, command: 'rm -rf x', choices: ['once', 'session', 'deny'] } })
  assert.equal(p.prompt_id, 'p1')
  assert.equal(p.execution_generation, 3)
  assert.equal(p.clarify, false)
  assert.deepEqual(p.escolhas, ['once', 'session', 'deny'])
  assert.equal(pedidoDePermissao({ type: 'message.delta' }), null)
})

function gwFalso() {
  const ouvintes = new Set()
  const g = {
    chamadas: [],
    ouvir: (f) => { ouvintes.add(f); return () => ouvintes.delete(f) },
    emitir: (ev) => ouvintes.forEach((f) => f(ev)),
    async rpc(method, params) {
      g.chamadas.push({ method, params })
      if (method === 'session.create') return { session_id: 'S' + g.chamadas.filter((c) => c.method === 'session.create').length }
      if (method === 'prompt.submit') {
        setTimeout(() => {
          g.emitir({ type: 'message.delta', session_id: params.session_id, payload: { text: 'olá ' } })
          g.emitir({ type: 'message.delta', session_id: params.session_id, payload: { text: 'mundo' } })
          g.emitir({ type: 'message.complete', session_id: params.session_id, payload: { outcome: 'completed' } })
        }, 5)
        return { admission_id: 'a1' }
      }
      return {}
    },
  }
  return g
}
function montar(gw, extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-gw-'))
  const emitidos = []
  const s = new SessaoGateway({ app: { getPath: () => dir }, id: 'chat1', pasta: fs.mkdtempSync(path.join(os.tmpdir(), 'sb-pasta-')), base: 'http://127.0.0.1:1/v1', modelo: 'principal', raciocinio: 'none', nivel: 1, emitir: (e) => emitidos.push(e), pedirPermissao: async () => 'permitir', modo: () => 'manual', gateway: gw, ...extra })
  s.chatMarca = 'chat1'
  return { s, emitidos }
}

test('SessaoGateway: cria a conversa, envia com a marca da conversa e devolve o texto ao vivo', async () => {
  const gw = gwFalso()
  const { s, emitidos } = montar(gw)
  await s.perguntar('diga oi')
  assert.deepEqual(emitidos.filter((e) => e.texto).map((e) => e.texto), ['olá ', 'mundo'])
  const cria = gw.chamadas.find((c) => c.method === 'session.create')
  assert.equal(cria.params.source, 'acp')
  assert.equal(cria.params.editor.edit_approval_policy, 'ask')
  const envio = gw.chamadas.find((c) => c.method === 'prompt.submit')
  assert.match(envio.params.text, /diga oi/)
  assert.match(envio.params.text, /<!--sb:chat1-->/)
  assert.match(envio.params.text, /Segundo Cérebro/, 'o 1º turno leva o contexto do app')
  s.encerrar()
})

test('SessaoGateway: 2ª pergunta reaproveita a conversa e não repete o contexto', async () => {
  const gw = gwFalso()
  const { s } = montar(gw)
  await s.perguntar('um')
  await s.perguntar('dois')
  assert.equal(gw.chamadas.filter((c) => c.method === 'session.create').length, 1)
  const envios = gw.chamadas.filter((c) => c.method === 'prompt.submit')
  assert.equal(envios.length, 2)
  assert.doesNotMatch(envios[1].params.text, /Você é o Segundo Cérebro/)
  s.encerrar()
})

test('SessaoGateway: eventos de outra conversa não aparecem nesta', async () => {
  const gw = gwFalso()
  const { s, emitidos } = montar(gw)
  await s.perguntar('um')
  const antes = emitidos.length
  gw.emitir({ type: 'message.delta', session_id: 'OUTRA', payload: { text: 'vazou' } })
  assert.equal(emitidos.length, antes)
  s.encerrar()
})

test('SessaoGateway: pedido de aprovação vai ao usuário e a resposta volta para a conversa certa', async () => {
  const gw = gwFalso()
  let perguntado = null
  const { s } = montar(gw, { pedirPermissao: async (p) => { perguntado = p; return 'permitir' } })
  await s.perguntar('um')
  gw.emitir({ type: 'approval.request', session_id: 'S1', payload: { prompt_id: 'p9', execution_generation: 2, command: 'npm install', choices: ['once', 'deny'] } })
  await new Promise((r) => setTimeout(r, 30))
  assert.equal(perguntado.chat, 'chat1')
  const resp = gw.chamadas.find((c) => c.method === 'approval.respond')
  assert.deepEqual({ ...resp.params }, { session_id: 'S1', prompt_id: 'p9', execution_generation: 2, choice: 'once' })
  s.encerrar()
})

test('SessaoGateway: recusar a aprovação responde deny; modo ignorar nem pergunta', async () => {
  const gw = gwFalso()
  let perguntou = 0
  const { s } = montar(gw, { pedirPermissao: async () => { perguntou++; return 'negar' } })
  await s.perguntar('um')
  gw.emitir({ type: 'approval.request', session_id: 'S1', payload: { prompt_id: 'a', execution_generation: 1, command: 'rm x', choices: ['once', 'deny'] } })
  await new Promise((r) => setTimeout(r, 30))
  assert.equal(gw.chamadas.filter((c) => c.method === 'approval.respond').pop().params.choice, 'deny')
  s.encerrar()
  const gw2 = gwFalso()
  const m2 = montar(gw2, { modo: () => 'ignorar', pedirPermissao: async () => { perguntou++; return 'negar' } })
  await m2.s.perguntar('um')
  gw2.emitir({ type: 'approval.request', session_id: 'S1', payload: { prompt_id: 'b', execution_generation: 1, command: 'rm y', choices: ['once', 'deny'] } })
  await new Promise((r) => setTimeout(r, 30))
  assert.equal(gw2.chamadas.filter((c) => c.method === 'approval.respond').pop().params.choice, 'once')
  assert.equal(perguntou, 1, 'só a primeira perguntou')
  m2.s.encerrar()
})

test('SessaoGateway: conexão caída no meio do turno recria a conversa e retoma com o que já foi feito', async () => {
  const gw = gwFalso()
  let envios = 0
  const original = gw.rpc.bind(gw)
  gw.rpc = async (method, params) => {
    if (method === 'prompt.submit' && ++envios === 1) { gw.chamadas.push({ method, params }); throw Object.assign(new Error('Gateway disconnected; turn outcome is unknown.'), { codigo: 'ponte_caiu' }) }
    return original(method, params)
  }
  const { s } = montar(gw)
  await s.perguntar('faça algo')
  assert.equal(gw.chamadas.filter((c) => c.method === 'session.create').length, 2, 'criou a conversa de novo')
  const ultimo = gw.chamadas.filter((c) => c.method === 'prompt.submit').pop().params.text
  assert.match(ultimo, /Retomada automática/)
  assert.match(ultimo, /faça algo/)
  s.encerrar()
})

test('SessaoGateway: parar interrompe a conversa no gateway e libera a pergunta', async () => {
  const gw = gwFalso()
  const original = gw.rpc.bind(gw)
  gw.rpc = async (method, params) => (method === 'prompt.submit' ? (gw.chamadas.push({ method, params }), { admission_id: 'a' }) : original(method, params))
  const { s } = montar(gw)
  const p = s.perguntar('demorado')
  await new Promise((r) => setTimeout(r, 40))
  s.cancelar()
  await p
  assert.ok(gw.chamadas.some((c) => c.method === 'session.interrupt' && c.params.session_id === 'S1'))
  s.encerrar()
})

test('plano da tarefa (todo.updated) vira lista com estados', () => {
  const r = traducao({ type: 'todo.updated', payload: { revision: 3, todos: [{ id: 'a', content: 'Criar a pasta', status: 'completed' }, { id: 'b', content: 'Mover os arquivos', status: 'in_progress' }, { id: 'c', content: 'Conferir', status: 'pending' }] } })
  assert.equal(r.length, 1)
  assert.equal(r[0].plano.revisao, 3)
  assert.deepEqual(r[0].plano.itens.map((i) => i.estado), ['feito', 'fazendo', 'pendente'])
  assert.deepEqual(traducao({ type: 'todo.updated', payload: { revision: 1, todos: [] } }), [])
})

test('pergunta do agente (clarify) chega com as escolhas e a resposta volta pelo clarify.respond', async () => {
  const p = pedidoDePermissao({ type: 'clarify.request', payload: { prompt_id: 'q1', execution_generation: 4, question: 'Qual cor?', choices: ['azul', 'verde'], multi_select: false } })
  assert.equal(p.clarify, true)
  assert.deepEqual(p.pergunta, { texto: 'Qual cor?', escolhas: ['azul', 'verde'], multi: false })
  const gw = gwFalso()
  let visto = null
  const { s } = montar(gw, { pedirPermissao: async (x) => { visto = x; return 'resp:verde' } })
  await s.perguntar('um')
  gw.emitir({ type: 'clarify.request', session_id: 'S1', payload: { prompt_id: 'q1', execution_generation: 4, question: 'Qual cor?', choices: ['azul', 'verde'] } })
  await new Promise((r) => setTimeout(r, 30))
  assert.equal(visto.tipo, 'clarify')
  assert.deepEqual(visto.pergunta.escolhas, ['azul', 'verde'])
  const resp = gw.chamadas.find((c) => c.method === 'clarify.respond')
  assert.deepEqual({ ...resp.params }, { session_id: 'S1', prompt_id: 'q1', execution_generation: 4, answer: 'verde' })
  s.encerrar()
})


test('aprovação de arquivo mostra o caminho em português e o modo "editar" libera dentro da pasta', async () => {
  const gw = gwFalso()
  let perguntou = 0
  const { s } = montar(gw, { modo: () => 'editar', pedirPermissao: async () => { perguntou++; return 'negar' } })
  await s.perguntar('um')
  const dentro = path.join(s.pasta, 'a.txt')
  gw.emitir({ type: 'approval.request', session_id: 'S1', payload: { prompt_id: 'e1', execution_generation: 1, command: 'Edit ' + dentro, description: 'Approve proposed file change', choices: ['once', 'deny'], edit: { tool_name: 'write_file', path: dentro, new_text: 'oi' } } })
  await new Promise((r) => setTimeout(r, 30))
  assert.equal(perguntou, 0, 'dentro da pasta de trabalho no modo editar: nem pergunta')
  assert.equal(gw.chamadas.filter((c) => c.method === 'approval.respond').pop().params.choice, 'once')
  const p = pedidoDePermissao({ type: 'approval.request', payload: { prompt_id: 'e2', execution_generation: 1, command: 'Edit /x/b.txt', edit: { path: '/x/b.txt' }, choices: ['once', 'deny'] } })
  assert.match(p.titulo, /^Gravar o arquivo /)
  s.encerrar()
})
