// Tuning do Hermes (spec 48 rodada 3): memória da tarefa reinjetada pela ponte, skills de fábrica fora do índice, regra de economia de skills
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { comMemoria, MEMORIA_MARCA } = require('../ponte-llm')
const { prepararHome } = require('../agent')

test('memória da tarefa vai no FIM da última mensagem (começo intacto para o cache) e não duplica', () => {
  const j = { messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'pedido' }, { role: 'assistant', content: '', tool_calls: [{ id: '1' }] }, { role: 'tool', content: 'resultado' }], tools: [{}] }
  const antes = JSON.stringify(j.messages.slice(0, 3))
  comMemoria(j, '- feito: banco\n- falta: chat')
  assert.equal(JSON.stringify(j.messages.slice(0, 3)), antes)
  assert.ok(j.messages[3].content.startsWith('resultado'))
  assert.ok(j.messages[3].content.includes(MEMORIA_MARCA) && j.messages[3].content.includes('falta: chat'))
  comMemoria(j, 'outra')
  assert.equal(j.messages[3].content.split(MEMORIA_MARCA).length, 2)
  const k = { messages: [{ role: 'user', content: [{ type: 'text', text: 'oi' }] }] }
  comMemoria(k, 'x')
  assert.equal(k.messages[0].content.length, 2)
  const a = { messages: [{ role: 'assistant', content: 'r' }] }
  assert.equal(comMemoria(a, 'x').messages[0].content, 'r') // última do assistente: não mexe
})

test('config e SOUL: skills de fábrica fora do índice e regra de economia de skills', () => {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'sbh-'))
  const app = { getPath: () => t, getAppPath: () => process.cwd(), isPackaged: false, getVersion: () => '0' }
  const h = prepararHome(app, { base: 'http://x/v1', pasta: t, gateway: true })
  const y = fs.readFileSync(path.join(h, 'config.yaml'), 'utf8')
  for (const n of ['baoyu-infographic', 'claude-code', 'computer-use', 'himalaya', 'songwriting-and-ai-music']) assert.match(y, new RegExp(`"${n}"`))
  for (const n of ['"pdf"', '"dogfood"', '"humanizer"', '"github"']) assert.ok(!y.includes(n), n + ' tem que continuar ligada')
  const soul = fs.readFileSync(path.join(h, 'SOUL.md'), 'utf8')
  assert.match(soul, /SKILLS COM ECONOMIA/)
  assert.match(soul, /no máximo 2 por pedido/)
})

test('componentes: só a instalação ativa (mais recente) do ambiente conta; prompt manda ler documento pelo read_file', () => {
  const { ambientesDoAgente, contextoDeSistema } = require('../agent')
  const h = fs.mkdtempSync(path.join(os.tmpdir(), 'sbc-'))
  const py = process.platform === 'win32' ? ['Scripts', 'python.exe'] : ['bin', 'python']
  for (const [inst, idade] of [['velha', 5000], ['nova', 0]]) {
    const base = path.join(h, 'installs', inst, 'environments', 'e1')
    fs.mkdirSync(path.join(base, 'venv', py[0]), { recursive: true })
    fs.mkdirSync(path.join(base, 'workspace', 'pm'), { recursive: true })
    fs.writeFileSync(path.join(base, 'venv', ...py), '')
    const t = new Date(Date.now() - idade * 1000)
    fs.utimesSync(base, t, t)
  }
  const a = ambientesDoAgente(h)
  assert.equal(a.length, 1)
  assert.match(a[0].py, /nova/)
  assert.equal(ambientesDoAgente(path.join(h, 'nada')).length, 0)
  assert.match(contextoDeSistema({ pasta: 'C:/x' }), /LER PDF, WORD/)
})
