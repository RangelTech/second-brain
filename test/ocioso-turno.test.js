// Causa raiz do "Hermes saiu com codigo 1" mid-tarefa: o cronometro de sessao ociosa (10 min) disparava DURANTE o trabalho (taskkill /F = codigo 1).
// Aqui o limite e encurtado para 0,8 s e o turno dura 2,5 s: a sessao tem que continuar de pe e terminar o trabalho.
process.env.SB_TESTE_OCIOSO_MS = '800'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execSync } = require('child_process')
const { Sessao } = require('../agent')

const BIN = path.join(__dirname, 'fixtures', 'fake-hermes.cmd')
const vivos = new Set()
function desligar(s) {
  vivos.delete(s)
  if (s.filho?.pid) { try { execSync(`taskkill /pid ${s.filho.pid} /T /F`, { stdio: 'ignore' }) } catch {} }
  try { s.encerrar() } catch {}
}
test.after(() => { for (const s of [...vivos]) desligar(s); setTimeout(() => process.exit(0), 200).unref?.() })

function montar(crashes, eventos = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-ocioso-'))
  const crashesFile = path.join(dir, 'crashes.txt')
  fs.writeFileSync(crashesFile, String(crashes))
  process.env.SB_FAKE_CRASHES_FILE = crashesFile
  process.env.SECOND_BRAIN_HERMES_BIN = BIN
  const s = new Sessao({ app: { getPath: () => dir }, id: 'teste', pasta: fs.mkdtempSync(path.join(os.tmpdir(), 'sb-pasta-')), base: 'http://127.0.0.1:1/v1', modelo: 'principal', chave: 'x', raciocinio: 'none', emitir: (e) => eventos.push(e), pedirPermissao: async () => 'negar', modo: () => 'manual', nivel: 1 })
  vivos.add(s)
  return s
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
const vivo = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }

test('sessao aquecida e SEM uso e encerrada depois do limite (comportamento preservado)', async () => {
  const s = montar(0)
  try {
    await s.pronta
    const pid = s.filho.pid
    assert.equal(vivo(pid), true)
    await esperar(2500)
    assert.equal(vivo(pid), false, 'a sessao ociosa foi encerrada')
  } finally { desligar(s) }
})

test('turno MAIS LONGO que o limite de ociosidade nao e derrubado no meio (mesmo processo, sem retomada)', async () => {
  process.env.SB_FAKE_LENTO_MS = '2500'
  const eventos = []
  const s = montar(0, eventos)
  try {
    await s.pronta
    const pid = s.filho.pid
    const r = await s.perguntar('tarefa longa')
    assert.equal(r.stopReason, 'end_turn')
    assert.equal(s.filho.pid, pid, 'o mesmo processo do Hermes terminou o trabalho')
    assert.ok(!eventos.some((e) => e.novoCard), 'nenhuma retomada: nada foi morto no meio')
  } finally { delete process.env.SB_FAKE_LENTO_MS; desligar(s) }
})

test('cai no meio, o app relanca e o turno retomado (mais longo que o limite) tambem nao e derrubado de novo', async () => {
  process.env.SB_FAKE_LENTO_MS = '2500'
  const eventos = []
  const s = montar(1, eventos) // 1 queda de proposito
  try {
    await s.pronta
    const r = await s.perguntar('tarefa longa com queda')
    assert.equal(r.stopReason, 'end_turn')
    assert.equal(eventos.filter((e) => e.novoCard).length, 1, 'so a queda de proposito causou retomada; o cronometro nao matou de novo')
  } finally { delete process.env.SB_FAKE_LENTO_MS; desligar(s) }
})
