// Redublagem: divisão do texto em blocos e remontagem do vídeo com a voz nova (o teste de FFmpeg só roda onde o programa existe).
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')
const dub = require('../dublagem')

test('dividir corta em fim de frase e respeita o limite', () => {
  const t = Array.from({ length: 400 }, (_, i) => `Frase número ${i}.`).join(' ')
  const blocos = dub.dividir(t, 3500)
  assert.ok(blocos.length >= 2)
  for (const b of blocos) assert.ok(b.length <= 3500, 'bloco ' + b.length)
  assert.equal(blocos.join(' ').replace(/\s+/g, ' ').trim(), t.replace(/\s+/g, ' ').trim())
  assert.deepEqual(dub.dividir('Curto.'), ['Curto.'])
  const longa = dub.dividir('x'.repeat(8000), 3500)
  assert.ok(longa.every((b) => b.length <= 3500), 'frase sem pontuação também respeita o limite')
})

test('temVideo reconhece só vídeo', () => {
  assert.equal(dub.temVideo('a.mp4'), true)
  assert.equal(dub.temVideo('a.MOV'), true)
  assert.equal(dub.temVideo('a.mp3'), false)
})

let ff = null
try { ff = dub.binario('ffmpeg') } catch {}
test('montar troca o áudio do vídeo e mantém a duração', { skip: !ff }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-dub-'))
  const sh = (args) => { const r = spawnSync(ff, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr) }
  const video = path.join(dir, 'v.mp4')
  const voz = path.join(dir, 'voz.wav')
  sh(['-f', 'lavfi', '-i', 'color=c=blue:s=320x180:r=25:d=6', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=6', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', video])
  sh(['-f', 'lavfi', '-i', 'sine=frequency=700:duration=4', voz]) // voz mais curta que o vídeo: completa com silêncio
  const r = dub.montar({ video, faixas: [voz], saida: path.join(dir, 'out', 'dub.mp4') })
  assert.ok(fs.existsSync(r.saida))
  assert.ok(Math.abs(dub.duracao(r.saida) - 6) < 0.2, 'mesma duração do vídeo')
  assert.equal(r.fator, 0.8, 'fala curta é desacelerada até o limite')
})
