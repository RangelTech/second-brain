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

test('git.exe pendurado que e FILHO do python do Hermes (git do sistema, fora da pasta do Hermes) tambem e encerrado', { skip: process.platform !== 'win32' }, async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-gitpai-'))
  const pastaPai = path.join(base, 'hermes-pai-xyz', 'tools')
  const fora = path.join(base, 'programas')
  fs.mkdirSync(pastaPai, { recursive: true })
  fs.mkdirSync(fora, { recursive: true })
  const pai = path.join(pastaPai, 'python.exe')
  const gitSistema = path.join(fora, 'git.exe')
  fs.copyFileSync(process.execPath, pai)
  fs.copyFileSync(process.execPath, gitSistema)
  const gitSolto = path.join(fora, 'git2', 'git.exe')
  fs.mkdirSync(path.dirname(gitSolto), { recursive: true })
  fs.copyFileSync(process.execPath, gitSolto)
  const parado = ['-e', 'setInterval(() => {}, 1000)']
  const solto = spawn(gitSolto, parado, { stdio: 'ignore', windowsHide: true }) // filho do teste, nao do Hermes
  // o "python do Hermes" cria o git filho e escreve o pid dele
  const pidArq = path.join(base, 'pid.txt')
  const script = "const {spawn}=require('child_process');const c=spawn(process.argv[1],['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});require('fs').writeFileSync(process.argv[2],String(c.pid));setInterval(()=>{},1000)"
  const paiProc = spawn(pai, ['-e', script, gitSistema, pidArq], { stdio: 'ignore', windowsHide: true })
  try {
    for (let i = 0; i < 40 && !fs.existsSync(pidArq); i++) await esperar(100)
    const filho = +fs.readFileSync(pidArq, 'utf8')
    await esperar(3500)
    assert.equal(vivo(filho), true)
    limparGitPreso({ getPath: () => base }, 2500, 'hermes-pai-xyz')
    for (let i = 0; i < 40 && vivo(filho); i++) await esperar(250)
    assert.equal(vivo(filho), false, 'o git filho do python do Hermes foi encerrado')
    assert.equal(vivo(solto.pid), true, 'um git que nao e filho do Hermes nao e tocado')
  } finally {
    for (const p of [paiProc, solto]) try { process.kill(p.pid, 'SIGKILL') } catch {}
  }
})
