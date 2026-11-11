// macOS: o instalador do Hermes exige um `git` que funcione. Num Mac novo o /usr/bin/git é só um atalho que pede as ferramentas de
// desenvolvedor da Apple (Command Line Tools: diálogo, ~700 MB, ~10 min) e o instalador falha com "git needs Apple's Command Line Tools".
// Achado no QA em macOS Sequoia zerado (11/11/2026); o CI não pega porque as máquinas do GitHub já têm as ferramentas.
// Solução sem administrador e sem diálogo: git portátil do conda-forge, instalado pelo micromamba (binário único) na pasta de dados do app.
// Medido na VM: 101 s, 226 MB, clona o repositório do Hermes.
const { execFile } = require('child_process')
const fs = require('fs')
const path = require('path')

const pasta = (app) => path.join(app.getPath('userData'), 'ferramentas')
const binGit = (app) => path.join(pasta(app), 'git', 'bin')

const roda = (cmd, args, opts = {}) =>
  new Promise((res) => execFile(cmd, args, { timeout: opts.timeout || 15000, env: opts.env || process.env, maxBuffer: 8 * 1024 * 1024 }, (e, out, err) => res({ ok: !e, out: String(out || ''), err: String(err || '') })))

// git de verdade já disponível? NÃO chama o /usr/bin/git (o atalho abre o diálogo da Apple): confere as ferramentas, o Homebrew e o portátil.
function gitDisponivel(app) {
  const candidatos = ['/opt/homebrew/bin/git', '/usr/local/bin/git', path.join(binGit(app), 'git')]
  try {
    const dev = require('child_process').execFileSync('xcode-select', ['-p'], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    if (dev) candidatos.unshift(path.join(dev, 'usr', 'bin', 'git'))
  } catch {}
  return candidatos.find((c) => {
    try {
      fs.accessSync(c, fs.constants.X_OK)
      return true
    } catch {
      return false
    }
  })
}

// Pasta para pôr na frente do PATH (do instalador e do agente) ou '' quando não precisa. Fora do macOS não faz nada.
function caminhoExtra(app) {
  if (process.platform !== 'darwin') return ''
  const g = path.join(binGit(app), 'git')
  return fs.existsSync(g) ? binGit(app) : ''
}

// Garante um git no Mac. Devolve a pasta do git portátil (para o PATH) ou '' se o sistema já tem um git de verdade.
async function garantir(app, falar = () => {}) {
  if (process.platform !== 'darwin') return ''
  const achado = gitDisponivel(app)
  if (achado) return achado.startsWith(pasta(app)) ? binGit(app) : ''
  falar('baixando as ferramentas do agente (git)')
  const raiz = pasta(app)
  fs.mkdirSync(raiz, { recursive: true })
  const plat = process.arch === 'arm64' ? 'osx-arm64' : 'osx-64'
  const mm = path.join(raiz, 'bin', 'micromamba')
  if (!fs.existsSync(mm)) {
    const r = await roda('/bin/sh', ['-c', `curl -fsSL "https://micro.mamba.pm/api/micromamba/${plat}/latest" | tar -xj -C "${raiz}" bin/micromamba`], { timeout: 180000 })
    if (!r.ok || !fs.existsSync(mm)) throw new Error('Não consegui baixar as ferramentas do agente (micromamba). Confira a internet e tente de novo. ' + r.err.slice(-200))
  }
  const r = await roda(mm, ['create', '-y', '-q', '-r', path.join(raiz, 'mamba'), '-p', path.join(raiz, 'git'), '-c', 'conda-forge', 'git'], { timeout: 15 * 60000 })
  const g = path.join(binGit(app), 'git')
  if (!r.ok || !fs.existsSync(g)) throw new Error('Não consegui preparar o git do agente. ' + (r.err || r.out).slice(-300))
  const v = await roda(g, ['--version'])
  if (!v.ok) throw new Error('O git do agente não roda: ' + v.err.slice(-200))
  // o cache de pacotes do micromamba não é mais necessário
  try {
    fs.rmSync(path.join(raiz, 'mamba', 'pkgs'), { recursive: true, force: true })
  } catch {}
  return binGit(app)
}

module.exports = { garantir, caminhoExtra, gitDisponivel }
