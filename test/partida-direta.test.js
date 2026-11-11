const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const pd = require('../partida-direta')

function montar() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-pd-'))
  const bin = path.join(home, 'bin', process.platform === 'win32' ? 'hermes-acp.exe' : 'hermes-acp')
  fs.mkdirSync(path.dirname(bin), { recursive: true })
  fs.writeFileSync(bin, 'x')
  const venv = path.join(home, 'installs', 'abc', 'environments', 'e1', 'venv')
  const py = process.platform === 'win32' ? path.join(venv, 'Scripts', 'python.exe') : path.join(venv, 'bin', 'python')
  fs.mkdirSync(path.dirname(py), { recursive: true })
  fs.writeFileSync(py, 'x')
  fs.writeFileSync(path.join(home, 'installs', 'abc', 'facts.json'), JSON.stringify({ packages: { venv: { environment: venv } } }))
  return { home, bin, py }
}

test('sem cache: usa o lançador (null)', () => {
  const { home, bin } = montar()
  assert.strictEqual(pd.resolver(home, bin, { PATH: 'X' }), null)
})

test('com cache válido: sobe o python do ambiente com o PATH das ferramentas na frente', () => {
  const { home, bin, py } = montar()
  assert.strictEqual(pd.pythonDoAmbiente(home).py, py)
  fs.writeFileSync(path.join(home, pd.ARQ), JSON.stringify({ assinatura: pd.assinatura(home, bin), python: py, path: ['T1', 'T2'], env: { PLAYWRIGHT_BROWSERS_PATH: 'P' } }))
  const r = pd.resolver(home, bin, { PATH: 'ORIG', HERMES_HOME: home })
  assert.ok(r)
  assert.strictEqual(r.cmd, py)
  assert.deepStrictEqual(r.args, ['-m', 'acp_adapter'])
  const sep = process.platform === 'win32' ? ';' : ':'
  assert.ok(r.env.PATH.startsWith('T1' + sep + 'T2' + sep))
  assert.ok(r.env.PATH.endsWith('ORIG'))
  assert.strictEqual(r.env.PLAYWRIGHT_BROWSERS_PATH, 'P')
  assert.strictEqual(r.env.HERMES_HOME, home)
})

test('ambiente mudou (facts.json): o cache deixa de valer', () => {
  const { home, bin, py } = montar()
  fs.writeFileSync(path.join(home, pd.ARQ), JSON.stringify({ assinatura: pd.assinatura(home, bin), python: py, path: [], env: {} }))
  fs.writeFileSync(path.join(home, 'installs', 'abc', 'facts.json'), JSON.stringify({ packages: { venv: { environment: 'outro' } } }))
  assert.strictEqual(pd.resolver(home, bin, { PATH: 'X' }), null)
})

test('desligável por SB_PARTIDA_DIRETA=0 e invalidar apaga o cache', () => {
  const { home, bin, py } = montar()
  fs.writeFileSync(path.join(home, pd.ARQ), JSON.stringify({ assinatura: pd.assinatura(home, bin), python: py, path: [], env: {} }))
  process.env.SB_PARTIDA_DIRETA = '0'
  try {
    assert.strictEqual(pd.resolver(home, bin, { PATH: 'X' }), null)
  } finally {
    delete process.env.SB_PARTIDA_DIRETA
  }
  assert.ok(pd.resolver(home, bin, { PATH: 'X' }))
  pd.invalidar(home)
  assert.strictEqual(pd.resolver(home, bin, { PATH: 'X' }), null)
})
