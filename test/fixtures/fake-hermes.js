// Hermes de mentira pra testar a resiliência de verdade (processo real, spawn de verdade, não mock em memória).
// Lê CRASHES_FILE (um arquivo com um número): se > 0, derruba o processo (sem responder) logo no 1º session/prompt
// recebido e decrementa o contador; quando chegar a 0, responde normal. initialize e session/new sempre respondem bem.
const fs = require('fs')
const readline = require('readline')

const CRASHES_FILE = process.env.SB_FAKE_CRASHES_FILE
const sessionId = 'fake-' + Math.random().toString(36).slice(2)

function crashesRestantes() {
  try {
    return parseInt(fs.readFileSync(CRASHES_FILE, 'utf8').trim(), 10) || 0
  } catch {
    return 0
  }
}
function decrementar() {
  try {
    fs.writeFileSync(CRASHES_FILE, String(Math.max(0, crashesRestantes() - 1)))
  } catch {}
}

const enviar = (o) => process.stdout.write(JSON.stringify(o) + '\n')

const rl = readline.createInterface({ input: process.stdin })
rl.on('line', (linha) => {
  let j
  try {
    j = JSON.parse(linha)
  } catch {
    return
  }
  if (j.method === 'initialize') return enviar({ jsonrpc: '2.0', id: j.id, result: { agentCapabilities: {}, agentInfo: { name: 'fake-hermes' } } })
  if (j.method === 'session/new') return enviar({ jsonrpc: '2.0', id: j.id, result: { sessionId } })
  if (j.method === 'session/prompt') {
    if (crashesRestantes() > 0) {
      decrementar()
      process.exit(1) // morre sem responder: exatamente o sintoma real
    }
    enviar({ jsonrpc: '2.0', method: 'session/update', params: { sessionId, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'ok' } } } })
    return enviar({ jsonrpc: '2.0', id: j.id, result: { stopReason: 'end_turn', usage: { totalTokens: 1 } } })
  }
  if (j.method === 'session/cancel') return
  if (j.id !== undefined) enviar({ jsonrpc: '2.0', id: j.id, error: { code: -32601, message: 'não suportado' } })
})
