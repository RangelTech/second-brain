// Prova real (processo de verdade, não mock): se o Hermes morre com um turno em voo, a Sessao relança sozinha e
// reenvia o mesmo pedido, sem o chamador precisar fazer nada, até o processo falso parar de "cair de propósito".
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execSync } = require('child_process')
const { Sessao } = require('../agent')

const BIN = path.join(__dirname, 'fixtures', 'fake-hermes.cmd')
const vivos = new Set() // só neste teste: o fixture roda via .cmd (cmd.exe + node), e matar só o cmd.exe não mata o neto

function appFalso(dir) {
  return { getPath: () => dir }
}
function desligar(s) {
  vivos.delete(s)
  if (s.filho?.pid) {
    try {
      execSync(`taskkill /pid ${s.filho.pid} /T /F`, { stdio: 'ignore' })
    } catch {}
  }
  try {
    s.encerrar()
  } catch {}
}
test.after(() => {
  for (const s of vivos) desligar(s)
  // no Windows, o fixture roda via cmd.exe (shell:true só nesse .cmd de teste); mesmo com o taskkill /T, a árvore de
  // pipes às vezes deixa o runner esperando um pouco mais pra encerrar sozinho — força a saída, já com tudo limpo acima
  setTimeout(() => process.exit(0), 200).unref?.()
})

function montar(crashesIniciais, eventos = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-resil-'))
  const crashesFile = path.join(dir, 'crashes.txt')
  fs.writeFileSync(crashesFile, String(crashesIniciais))
  process.env.SB_FAKE_CRASHES_FILE = crashesFile
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-pasta-'))
  process.env.SECOND_BRAIN_HERMES_BIN = BIN
  const s = new Sessao({
    app: appFalso(dir),
    id: 'teste',
    pasta,
    base: 'http://127.0.0.1:1/v1',
    modelo: 'principal',
    chave: 'x',
    raciocinio: 'none',
    emitir: (e) => eventos.push(e),
    pedirPermissao: async () => 'negar',
    modo: () => 'manual',
    nivel: 1,
  })
  vivos.add(s)
  return s
}

test('o agente morre uma vez no meio do turno e a Sessao termina sozinha, sem o chamador reenviar nada', async () => {
  const eventos = []
  const s = montar(1, eventos) // cai 1 vez, depois responde
  try {
    const r = await s.perguntar('oi')
    assert.equal(r.stopReason, 'end_turn')
    assert.ok(eventos.some((e) => e.novoCard), 'a tela precisa saber que um card novo começou (o pedaço antigo fecha e um novo abre)')
  } finally {
    desligar(s)
  }
})

test('cai várias vezes seguidas: continua tentando, sem limite, até conseguir', async () => {
  const s = montar(4) // cai 4 vezes antes de deixar responder
  try {
    const r = await s.perguntar('oi')
    assert.equal(r.stopReason, 'end_turn')
  } finally {
    desligar(s)
  }
})

test('cancelar() interrompe o laço de relançamento (o cliente pediu pra parar)', async () => {
  const eventos = []
  const s = montar(999, eventos) // nunca vai deixar de cair sozinho: só o cancelar() deve parar
  const p = s.perguntar('oi')
  await new Promise((r) => setTimeout(r, 400)) // dá tempo da 1ª morte+relançamento acontecer pelo menos uma vez
  s.cancelar()
  await assert.rejects(p, /Interrompido/)
  desligar(s)
})

test('"Gateway disconnected" com o processo ainda de pe: retoma sozinho, sem erro, e o agente novo recebe o que ja foi feito', async () => {
  const eventos = []
  const arq = path.join(os.tmpdir(), 'sb-gw-' + Math.random().toString(36).slice(2))
  fs.writeFileSync(arq, '1')
  process.env.SB_FAKE_GATEWAY_ERR_FILE = arq
  process.env.SB_FAKE_ECO = '1'
  const s = montar(0, eventos)
  try {
    const r = await s.perguntar('gere a imagem do sedan')
    assert.equal(r.stopReason, 'end_turn')
    assert.ok(eventos.some((e) => e.novoCard), 'a tela fecha o pedaco antigo e abre um card novo')
    const texto = eventos.filter((e) => e.texto).map((e) => e.texto).join('')
    assert.match(texto, /Retomada automática/, 'o agente novo precisa saber que e uma retomada')
    assert.match(texto, /midia_gerar_imagem/, 'e o que ja foi feito neste pedido')
    assert.match(texto, /gere a imagem do sedan/, 'e o pedido original')
  } finally {
    delete process.env.SB_FAKE_GATEWAY_ERR_FILE
    delete process.env.SB_FAKE_ECO
    desligar(s)
  }
})

test('mensagem no meio do turno cancela so a etapa e o MESMO perguntar() termina incorporando a correcao (sem fila)', async () => {
  const eventos = []
  process.env.SB_FAKE_LENTO_MS = '4000'
  const s = montar(0, eventos)
  try {
    await s.pronta
    const t0 = Date.now()
    const turno = s.perguntar('faca a tarefa grande')
    await new Promise((r) => setTimeout(r, 400)) // o turno esta em andamento
    assert.equal(await s.direcionar('troque o titulo para Azul'), true)
    const r = await turno
    assert.equal(r.stopReason, 'end_turn', 'o resultado final e o do turno retomado, nao o cancelado')
    assert.ok(Date.now() - t0 < 3000, 'nao esperou o turno lento de 4 s terminar: foi cancelado')
    const texto = eventos.filter((e) => e.texto).map((e) => e.texto).join('')
    assert.match(texto, /feito com correcao: troque o titulo para Azul/)
    assert.doesNotMatch(texto, /feito sem correcao/)
  } finally {
    delete process.env.SB_FAKE_LENTO_MS
    desligar(s)
  }
})
test('direcionar sem turno ativo devolve false (a tela enfileira como antes)', async () => {
  const s = montar(0)
  try {
    await s.pronta
    assert.equal(await s.direcionar('oi'), false)
  } finally {
    desligar(s)
  }
})
