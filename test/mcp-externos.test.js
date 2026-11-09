// Servidores MCP do próprio usuário (mcp-externos.json) e skills essenciais entregues a todos os planos.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const agent = require('../agent')

function appFalso() {
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-mcpx-'))
  return { dados, app: { getPath: () => dados } }
}

test('sem arquivo ou com arquivo quebrado: nenhum MCP externo', () => {
  const { dados, app } = appFalso()
  assert.deepEqual(agent.mcpsExternos(app), [])
  fs.writeFileSync(path.join(dados, 'mcp-externos.json'), '{ quebrado')
  assert.deepEqual(agent.mcpsExternos(app), [])
  fs.rmSync(dados, { recursive: true, force: true })
})

test('converte stdio e http, ignora nomes reservados, nomes ruins e http sem https', () => {
  const { dados, app } = appFalso()
  fs.writeFileSync(path.join(dados, 'mcp-externos.json'), JSON.stringify({
    higgsfield: { command: 'npx', args: ['-y', 'mcp-remote', 'https://mcp.higgsfield.ai/mcp'] },
    fal: { url: 'https://mcp.fal.ai/mcp', headers: { Authorization: 'Key x' } },
    eleven: { command: 'uvx', args: ['elevenlabs-mcp'], env: { ELEVENLABS_API_KEY: 'k' } },
    midia: { command: 'x' },
    'nome ruim!': { command: 'x' },
    inseguro: { url: 'http://exemplo.com/mcp' },
    vazio: {},
  }))
  const r = agent.mcpsExternos(app)
  assert.deepEqual(r.map((x) => x.name), ['higgsfield', 'fal', 'eleven'])
  assert.deepEqual(r[0], { name: 'higgsfield', command: 'npx', args: ['-y', 'mcp-remote', 'https://mcp.higgsfield.ai/mcp'], env: [] })
  assert.deepEqual(r[1], { type: 'http', name: 'fal', url: 'https://mcp.fal.ai/mcp', headers: [{ name: 'Authorization', value: 'Key x' }] })
  assert.deepEqual(r[2].env, [{ name: 'ELEVENLABS_API_KEY', value: 'k' }])
  fs.rmSync(dados, { recursive: true, force: true })
})

test('a skill de cotas e plataformas vai para TODOS os planos, inclusive o Lite (pacote desligado)', () => {
  const { dados, app } = appFalso()
  agent.definirPacote(false)
  const home = agent.prepararBase(app)
  assert.equal(fs.existsSync(path.join(home, 'skills', 'rangeltech')), false)
  assert.equal(fs.existsSync(path.join(home, 'skills', 'essenciais', 'midia-cotas-e-plataformas', 'SKILL.md')), true)
  fs.rmSync(dados, { recursive: true, force: true })
})
