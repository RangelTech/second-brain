// Primeira execução de um HERMES_HOME: o Hermes real monta um ambiente Python (minutos). O app antigo desistia aos 90 s, matava o processo e recomeçava,
// em laço, deixando o agente fora do ar por meia hora numa instalação nova. Prova com processo de verdade: montagem LENTA sobrevive ao prazo curto,
// e vários chats ao mesmo tempo disparam UMA montagem só.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execSync } = require('child_process')
const { Sessao, ambienteMontado } = require('../agent')

const BIN = path.join(__dirname, 'fixtures', 'fake-hermes.cmd')
const vivos = new Set()
function desligar(s) {
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
  setTimeout(() => process.exit(0), 200).unref?.()
})

function novaSessao(dir, id, eventos = []) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-pasta-'))
  process.env.SECOND_BRAIN_HERMES_BIN = BIN
  const s = new Sessao({
    app: { getPath: () => dir },
    id,
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
const montagens = (dir) => {
  try {
    return fs.readFileSync(path.join(dir, 'hermes-home', '_fake_montagens.txt'), 'utf8').length
  } catch {
    return 0
  }
}

test('montagem do ambiente mais lenta que o prazo curto: o Hermes NÃO é morto e o chat sobe', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-mont-'))
  process.env.SB_FAKE_MONTAGEM_MS = '7000'
  process.env.SB_TESTE_PRAZO = '2500' // o app antigo desistia assim e recomeçava a montagem do zero, sem nunca terminar
  const eventos = []
  const s = novaSessao(dir, 'a', eventos)
  await s.pronta
  assert.ok(s.sid, 'a sessão foi criada')
  assert.equal(montagens(dir), 1, 'a montagem rodou uma vez só (não foi morta e refeita)')
  assert.equal(ambienteMontado(path.join(dir, 'hermes-home'), BIN), true)
  assert.ok(eventos.some((e) => /Preparando o agente pela primeira vez/.test(e.aviso || '')), 'a tela recebeu o aviso de preparo')
})

test('três chats ao mesmo tempo numa instalação nova: uma montagem só, todos sobem depois', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-mont3-'))
  process.env.SB_FAKE_MONTAGEM_MS = '5000'
  process.env.SB_TESTE_PRAZO = '2500'
  const ss = [novaSessao(dir, 'x'), novaSessao(dir, 'y'), novaSessao(dir, 'z')]
  await Promise.all(ss.map((s) => s.pronta))
  assert.ok(ss.every((s) => s.sid), 'todas as sessões foram criadas')
  assert.equal(montagens(dir), 1, 'só um processo montou o ambiente')
})

test('ambiente já montado: a partida é rápida e não monta de novo', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-mont-pronto-'))
  process.env.SB_FAKE_MONTAGEM_MS = '4000'
  process.env.SB_TESTE_PRAZO = '2500'
  await novaSessao(dir, 'p1').pronta
  const t0 = Date.now()
  const s2 = novaSessao(dir, 'p2')
  await s2.pronta
  assert.ok(Date.now() - t0 < 3000, 'segunda partida levou ' + (Date.now() - t0) + ' ms')
  assert.equal(montagens(dir), 1)
})
