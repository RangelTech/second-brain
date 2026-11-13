// Suíte de escritório + ferramentas Python do app para as skills (spec 37, 13/11/2026)
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const escritorio = require('../escritorio')
const { ferramentasPython } = require('../agent')

test('reconhece os arquivos que abrem no editor de documentos', () => {
  for (const a of ['C:\\x\\orcamento.xlsx', '/home/u/a.docx', 'b.pptx', 'c.csv', 'd.odt', 'e.XLSM']) assert.ok(escritorio.ehDoEscritorio(a), a)
  for (const a of ['f.pdf', 'g.mp4', 'h.png', 'i.txt', '']) assert.ok(!escritorio.ehDoEscritorio(a), a)
})

test('pacotes do editor têm sha256 e vêm do snapshot nosso', () => {
  for (const p of Object.values(escritorio.PACOTES)) assert.match(p.sha, /^[0-9a-f]{64}$/)
  const src = fs.readFileSync(path.join(__dirname, '..', 'escritorio.js'), 'utf8')
  assert.match(src, /segundo-cerebro-artefatos\/releases\/download\/escritorio-v1\//)
})

test('estado sem editor instalado: não quebra', () => {
  const app = { getPath: () => fs.mkdtempSync(path.join(os.tmpdir(), 'esc-')) }
  const e = escritorio.estado(app)
  assert.strictEqual(typeof e.instalado, 'boolean')
  assert.strictEqual(e.versao, 'v10.0.0')
})

test('ferramentasPython: uv e python do app vão para o FIM do PATH, mantendo a chave existente', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hh-'))
  const win = process.platform === 'win32'
  const uvDir = path.join(home, 'tools', 'uv-0.13.5-x')
  const pyDir = path.join(home, 'tools', 'python-3.14.9-x')
  const pyBin = win ? pyDir : path.join(pyDir, 'bin')
  fs.mkdirSync(uvDir, { recursive: true })
  fs.mkdirSync(pyBin, { recursive: true })
  fs.writeFileSync(path.join(uvDir, win ? 'uv.exe' : 'uv'), '')
  fs.writeFileSync(path.join(pyBin, win ? 'python.exe' : 'python3'), '')
  const env = ferramentasPython(home, { Path: 'A' })
  assert.ok(!('PATH' in env), 'não duplica a chave do PATH')
  assert.ok(env.Path.startsWith('A' + path.delimiter), 'o PATH do usuário continua na frente')
  assert.ok(env.Path.includes(uvDir) && env.Path.includes(pyBin))
  assert.ok(env.SB_UV.endsWith(win ? 'uv.exe' : 'uv'))
  assert.ok(env.SB_PYTHON)
})

test('ferramentasPython sem pasta tools: não mexe em nada', () => {
  const env = ferramentasPython(path.join(os.tmpdir(), 'nao-existe-' + Date.now()), { PATH: 'X' })
  assert.deepStrictEqual(env, { PATH: 'X' })
})
