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

const path = require('path')

// Primeira execução de um HERMES_HOME (como o Hermes de verdade, que monta o ambiente Python): session/new só responde depois de SB_FAKE_MONTAGEM_MS,
// escrevendo no stderr enquanto trabalha. Depois disso o ambiente "existe" e as partidas seguintes respondem na hora.
const HOME = process.env.HERMES_HOME || ''
const FLAG = path.join(HOME, '_fake_montado')
const MONTAGEM_MS = +process.env.SB_FAKE_MONTAGEM_MS || 0
function iniciarMontagem(id) {
  try {
    fs.appendFileSync(path.join(HOME, '_fake_montagens.txt'), 'x')
  } catch {}
  const t = setInterval(() => process.stderr.write('instalando dependencias...\n'), 500)
  setTimeout(() => {
    clearInterval(t)
    try {
      fs.writeFileSync(FLAG, '1')
    } catch {}
    enviar({ jsonrpc: '2.0', id, result: { sessionId } })
  }, MONTAGEM_MS)
}

const rl = readline.createInterface({ input: process.stdin })
rl.on('line', (linha) => {
  let j
  try {
    j = JSON.parse(linha)
  } catch {
    return
  }
  if (j.method === 'initialize') return enviar({ jsonrpc: '2.0', id: j.id, result: { agentCapabilities: {}, agentInfo: { name: 'fake-hermes' } } })
  if (j.method === 'session/new') {
    if (MONTAGEM_MS && HOME && !fs.existsSync(FLAG)) return iniciarMontagem(j.id)
    return enviar({ jsonrpc: '2.0', id: j.id, result: { sessionId } })
  }
  if (j.method === 'session/prompt') {
    // turno lento, como o ACP real: prompts sao tratados um por vez; session/cancel encerra o turno ('cancelled') e o PROXIMO prompt vem com a correcao
    if (process.env.SB_FAKE_LENTO_MS) {
      if (global.__cancelado) {
        global.__cancelado = false
        enviar({ jsonrpc: '2.0', method: 'session/update', params: { sessionId, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'feito com correcao: ' + j.params.prompt[0].text } } } })
        return enviar({ jsonrpc: '2.0', id: j.id, result: { stopReason: 'end_turn' } })
      }
      global.__turno = { id: j.id, timer: setTimeout(() => {
        global.__turno = null
        enviar({ jsonrpc: '2.0', method: 'session/update', params: { sessionId, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'feito sem correcao' } } } })
        enviar({ jsonrpc: '2.0', id: j.id, result: { stopReason: 'end_turn' } })
      }, +process.env.SB_FAKE_LENTO_MS) }
      return
    }
    if (crashesRestantes() > 0) {
      decrementar()
      process.exit(1) // morre sem responder: exatamente o sintoma real
    }
    // sintoma real do "Gateway disconnected": o processo continua de pé, mas o turno volta com erro (depois de uma ferramenta já concluída)
    if (process.env.SB_FAKE_GATEWAY_ERR_FILE) {
      let n = 0
      try {
        n = parseInt(fs.readFileSync(process.env.SB_FAKE_GATEWAY_ERR_FILE, 'utf8').trim(), 10) || 0
      } catch {}
      if (n > 0) {
        fs.writeFileSync(process.env.SB_FAKE_GATEWAY_ERR_FILE, String(n - 1))
        enviar({ jsonrpc: '2.0', method: 'session/update', params: { sessionId, update: { sessionUpdate: 'tool_call_update', toolCallId: 't1', title: 'midia_gerar_imagem', status: 'completed', kind: 'other', content: [] } } })
        return enviar({ jsonrpc: '2.0', id: j.id, error: { code: -32603, message: 'Internal error', data: { details: 'Gateway disconnected; turn outcome is unknown. Resume the printed session ID to check whether it completed or was interrupted; do not resend the work.' } } })
      }
    }
    const eco = process.env.SB_FAKE_ECO ? ':' + JSON.stringify(j.params.prompt[0].text).slice(0, 4000) : ''
    enviar({ jsonrpc: '2.0', method: 'session/update', params: { sessionId, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'ok' + eco } } } })
    return enviar({ jsonrpc: '2.0', id: j.id, result: { stopReason: 'end_turn', usage: { totalTokens: 1 } } })
  }
  if (j.method === 'session/cancel') {
    if (global.__turno) {
      clearTimeout(global.__turno.timer)
      enviar({ jsonrpc: '2.0', id: global.__turno.id, result: { stopReason: 'cancelled' } })
      global.__turno = null
      global.__cancelado = true
    }
    return
  }
  if (j.id !== undefined) enviar({ jsonrpc: '2.0', id: j.id, error: { code: -32601, message: 'não suportado' } })
})
