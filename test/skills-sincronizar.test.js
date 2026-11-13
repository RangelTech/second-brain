// Sincronização das skills essenciais (spec 37): a versão nova do app vence mesmo se o Hermes editou, e a edição vira notas-aprendidas.md
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { sincronizarSkillsGlobais } = require('../agent')

function cenario() {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-'))
  const o = path.join(t, 'o')
  const d = path.join(t, 'd')
  fs.mkdirSync(path.join(o, 'm'), { recursive: true })
  return { t, o, d, skill: (txt) => fs.writeFileSync(path.join(o, 'm', 'SKILL.md'), txt), dst: path.join(d, 'm', 'SKILL.md') }
}

test('essenciais: versão nova vence a edição do Hermes e a edição fica guardada', () => {
  const c = cenario()
  c.skill('v1\n')
  sincronizarSkillsGlobais(c.o, c.d, { novaVence: true })
  assert.strictEqual(fs.readFileSync(c.dst, 'utf8'), 'v1\n')
  fs.writeFileSync(c.dst, 'v1\naprendi algo\n') // o Hermes editou
  c.skill('v2\n')
  sincronizarSkillsGlobais(c.o, c.d + path.sep, { novaVence: true }) // outra chave (nova execução do app)
  const novo = fs.readFileSync(c.dst, 'utf8')
  assert.match(novo, /^v2\n/)
  assert.match(novo, /notas-aprendidas\.md/)
  assert.match(fs.readFileSync(path.join(c.d, 'm', 'notas-aprendidas.md'), 'utf8'), /aprendi algo/)
})

test('sem novaVence: edição do usuário continua valendo', () => {
  const c = cenario()
  c.skill('v1\n')
  sincronizarSkillsGlobais(c.o, c.d)
  fs.writeFileSync(c.dst, 'meu texto\n')
  c.skill('v2\n')
  sincronizarSkillsGlobais(c.o, c.d + path.sep)
  assert.strictEqual(fs.readFileSync(c.dst, 'utf8'), 'meu texto\n')
})

test('CRLF x LF não conta como edição', () => {
  const c = cenario()
  c.skill('a\nb\n')
  sincronizarSkillsGlobais(c.o, c.d, { novaVence: true })
  fs.writeFileSync(c.dst, 'a\r\nb\r\n')
  c.skill('a\nb\nc\n')
  sincronizarSkillsGlobais(c.o, c.d + path.sep, { novaVence: true })
  assert.strictEqual(fs.readFileSync(c.dst, 'utf8'), 'a\nb\nc\n')
  assert.ok(!fs.existsSync(path.join(c.d, 'm', 'notas-aprendidas.md')))
})
