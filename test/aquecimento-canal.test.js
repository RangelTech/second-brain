// Regressao (10/11/2026): a pergunta real chegando DURANTE o aquecimento perdia a resposta inteira (o aquecimento devolvia um canal mudo no fim).
// Processo de verdade (Hermes falso), mesma ordem do app: aquecer(); trocar o canal (responder); perguntar().
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execSync } = require('child_process')
const { Sessao } = require('../agent')

const BIN = path.join(__dirname, 'fixtures', 'fake-hermes.cmd')
let s = null
test.after(() => {
  try { if (s?.filho?.pid) execSync(`taskkill /pid ${s.filho.pid} /T /F`, { stdio: 'ignore' }) } catch {}
  try { s?.encerrar() } catch {}
  setTimeout(() => process.exit(0), 200).unref?.()
})

test('pergunta durante o aquecimento recebe a resposta; o turno de aquecimento nao vaza para a tela', { skip: process.platform !== 'win32' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-aquec-'))
  const crashes = path.join(dir, 'crashes.txt')
  fs.writeFileSync(crashes, '0')
  process.env.SB_FAKE_CRASHES_FILE = crashes
  process.env.SECOND_BRAIN_HERMES_BIN = BIN
  const doAquecimento = []
  s = new Sessao({ app: { getPath: () => dir }, id: 'chat-x', pasta: fs.mkdtempSync(path.join(os.tmpdir(), 'sb-p-')), base: 'http://127.0.0.1:1/v1', modelo: 'principal', chave: 'x', raciocinio: 'none',
    emitir: (e) => doAquecimento.push(e), pedirPermissao: async () => 'negar', modo: () => 'manual', nivel: 1 })
  const aq = s.aquecer() // em segundo plano, como no app
  for (let i = 0; i < 400 && !s.turno; i++) await new Promise((r) => setTimeout(r, 25)) // espera o turno de aquecimento COMECAR (o caso que perdia a resposta)
  assert.ok(s.turno, 'aquecimento em andamento')
  const tela = []
  s.emitir = (e) => tela.push(e) // responder() troca o canal enquanto o aquecimento ainda roda
  await s.perguntar('oi de verdade')
  await aq
  const texto = tela.filter((e) => e.texto).map((e) => e.texto).join('')
  assert.ok(texto.length > 0, 'a resposta real chegou na tela')
  assert.equal(doAquecimento.filter((e) => e.texto).length, 0, 'nada do aquecimento foi para o canal antigo')
  // e o canal continua o da tela para o proximo turno
  tela.length = 0
  await s.perguntar('segunda')
  assert.ok(tela.some((e) => e.texto), 'o segundo turno tambem chega')
})
