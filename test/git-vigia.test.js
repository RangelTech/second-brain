// Vigia do git preso durante a partida: um só PowerShell em laço encerra o git do Hermes que passou do limite, e para quando a partida termina.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')
const { vigiarGitPreso } = require('../agent')
const vivo = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

test('vigia encerra o git do Hermes preso em poucos segundos e desliga ao fim da partida', { skip: process.platform !== 'win32' }, async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-vigia-'))
  const dir = path.join(base, 'hermes-vigia-xyz', 'cmd')
  fs.mkdirSync(dir, { recursive: true })
  const git = path.join(dir, 'git.exe')
  fs.copyFileSync(process.execPath, git)
  const preso = spawn(git, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', windowsHide: true })
  const registros = []
  const desligar = vigiarGitPreso({ getPath: () => base }, 2000, 'hermes-vigia-xyz')
  try {
    const t0 = Date.now()
    for (let i = 0; i < 60 && vivo(preso.pid); i++) await esperar(250)
    assert.equal(vivo(preso.pid), false, 'git preso foi encerrado')
    assert.ok(Date.now() - t0 < 12000, 'encerrou em menos de 12 s: ' + (Date.now() - t0))
  } finally {
    desligar()
    preso.kill()
  }
})
