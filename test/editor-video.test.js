// Editor de vídeo: instalação silenciosa (flags do Inno Setup), caminho próprio, MCP do motor e corte de silêncio.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs'), os = require('os'), path = require('path')
const E = require('../editor-video.js')
const fake = { getPath: () => os.tmpdir() }

test('instala só na nossa pasta, sem assistente: flags silenciosas do Inno Setup, nunca o /S do NSIS', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'editor-video.js'), 'utf8')
  for (const f of ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/DIR=']) assert.ok(src.includes(f), f)
  assert.ok(!/\['\/S'/.test(src))
  assert.match(src, /SHA-256/)
})
test('o editor fica na pasta própria do Segundo Cérebro e o MCP só existe depois de instalado', () => {
  process.env.SB_EDITOR_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ed-'))
  try {
    assert.strictEqual(E.mcp(fake, 'C:/trab'), null)
    fs.writeFileSync(E.caminhoExe(fake), 'x')
    const m = E.mcp(fake, 'C:/trab')
    assert.deepStrictEqual([m.name, m.args], ['editor', ['--mcp', 'headless']])
    assert.match(m.env[0].value, /trab/)
  } finally { delete process.env.SB_EDITOR_DIR }
})
test('trechos com som: junta os silêncios e deixa uma folga', () => {
  const log = 'silence_start: 3.0\nsilence_end: 6.0 | silence_duration: 3\nsilence_start: 8.0'
  const t = E.trechosComSom(log, 10, 0.1)
  assert.strictEqual(t.length, 2)
  assert.ok(Math.abs(t[0][0]) < 1e-9 && Math.abs(t[0][1] - 3.1) < 1e-9)
  assert.ok(Math.abs(t[1][0] - 5.9) < 1e-9 && Math.abs(t[1][1] - 8.1) < 1e-9)
})
test('corte de silêncio de verdade (ffmpeg): 10 s com som em 0-3 e 6-8 viram ~5 s', async (t) => {
  const { execFileSync } = require('child_process')
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }) } catch { return t.skip('sem ffmpeg') }
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sil-')), a = path.join(d, 'a.mp4')
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=10:size=320x180:rate=30', '-f', 'lavfi', '-i', "aevalsrc='if(between(t,0,3)+between(t,6,8),0.5*sin(2*PI*440*t),0)':d=10", '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', a])
  const r = await E.cortarSilencio(a)
  assert.ok(r.duracaoDepois > 4.5 && r.duracaoDepois < 6, 'duração ' + r.duracaoDepois)
  assert.strictEqual(r.trechos, 2)
})
