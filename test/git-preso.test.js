// Causa raiz do "Hermes intermitente": git.exe pendurado segura os pipes do subprocess.run do Python (Windows) e o session/new nunca responde.
// O app encerra git.exe do Hermes que passa de alguns segundos de vida enquanto a sessão sobe. Prova com processo de verdade.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')
const { limparGitPreso } = require('../agent')

const vivo = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

test('git.exe do Hermes pendurado é encerrado; um git recente e um git de fora ficam em paz', { skip: process.platform !== 'win32' }, async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-gitpreso-'))
  const hermes = path.join(base, 'hermes-teste-xyz', 'tools', 'git', 'mingw64', 'bin')
  const fora = path.join(base, 'outro-programa')
  fs.mkdirSync(hermes, { recursive: true })
  fs.mkdirSync(fora, { recursive: true })
  const dentro = path.join(hermes, 'git.exe')
  const alheio = path.join(fora, 'git.exe')
  fs.copyFileSync(process.execPath, dentro)
  fs.copyFileSync(process.execPath, alheio)
  const parado = ['-e', 'setInterval(() => {}, 1000)']
  const preso = spawn(dentro, parado, { stdio: 'ignore', windowsHide: true })
  const outro = spawn(alheio, parado, { stdio: 'ignore', windowsHide: true })
  try {
    await esperar(3500) // "preso" já passou do limite de 2 s
    const recente = spawn(dentro, parado, { stdio: 'ignore', windowsHide: true }) // acabou de nascer
    limparGitPreso({ getPath: () => base }, 2500, 'hermes-teste-xyz')
    for (let i = 0; i < 40 && vivo(preso.pid); i++) await esperar(250)
    assert.equal(vivo(preso.pid), false, 'o git do Hermes preso foi encerrado')
    assert.equal(vivo(outro.pid), true, 'um git de outro programa não é tocado')
    assert.equal(vivo(recente.pid), true, 'um git recente (trabalho normal) não é tocado')
    recente.kill()
  } finally {
    preso.kill()
    outro.kill()
    await esperar(300)
    fs.rmSync(base, { recursive: true, force: true })
  }
})
