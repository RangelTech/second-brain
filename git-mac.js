// macOS: o instalador do Hermes exige um `git` que funcione e, no Mac Intel, um compilador. Num Mac novo o /usr/bin/git é só um atalho que
// pede as ferramentas de desenvolvedor da Apple (Command Line Tools) e o instalador falha com "git needs Apple's Command Line Tools".
// Achado no QA em macOS Sequoia zerado (11/11/2026); o CI não pegava porque as máquinas do GitHub já têm as ferramentas.
// - Chip da Apple (arm64): todas as dependências do Hermes têm pacote pronto; basta um git. O app instala um git portátil do conda-forge
//   pelo micromamba (binário único), sem administrador e sem diálogo. Medido na VM: 101 s, 226 MB.
// - Intel (x64): o `cryptography` 50 não publica mais pacote para Mac Intel e é compilado na hora (precisa de `cc`). Só as ferramentas da Apple
//   resolvem: o app abre o diálogo oficial da Apple, explica ao cliente e espera terminar (até 40 min).
// SB_SEM_FERRAMENTAS_SISTEMA=1 ignora git/ferramentas do sistema (teste de "Mac zerado" no CI).
const { execFile, execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const pasta = (app) => path.join(app.getPath('userData'), 'ferramentas')
const binGit = (app) => path.join(pasta(app), 'git', 'bin')
const ignorarSistema = () => process.env.SB_SEM_FERRAMENTAS_SISTEMA === '1'
const executavel = (c) => {
  try {
    fs.accessSync(c, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}
const roda = (cmd, args, opts = {}) =>
  new Promise((res) => execFile(cmd, args, { timeout: opts.timeout || 15000, env: opts.env || process.env, maxBuffer: 8 * 1024 * 1024 }, (e, out, err) => res({ ok: !e, out: String(out || ''), err: String(err || '') })))

// pasta das ferramentas da Apple quando estão instaladas DE VERDADE (com git e cc), ou ''. Não chama /usr/bin/git: o atalho abre o diálogo.
function ferramentasApple() {
  if (ignorarSistema()) return ''
  try {
    const dev = execFileSync('xcode-select', ['-p'], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    if (dev && executavel(path.join(dev, 'usr', 'bin', 'git')) && (executavel(path.join(dev, 'usr', 'bin', 'cc')) || executavel(path.join(dev, 'Toolchains', 'XcodeDefault.xctoolchain', 'usr', 'bin', 'cc')))) return dev
  } catch {}
  return ''
}

// git de verdade disponível (ferramentas da Apple, Homebrew ou o portátil do app)
function gitDisponivel(app) {
  const c = []
  if (!ignorarSistema()) {
    const dev = ferramentasApple()
    if (dev) c.push(path.join(dev, 'usr', 'bin', 'git'))
    c.push('/opt/homebrew/bin/git', '/usr/local/bin/git')
  }
  c.push(path.join(binGit(app), 'git'))
  return c.find(executavel)
}

// Pasta para pôr na frente do PATH (do instalador e do agente) ou '' quando não precisa. Fora do macOS não faz nada.
function caminhoExtra(app) {
  if (process.platform !== 'darwin') return ''
  return executavel(path.join(binGit(app), 'git')) ? binGit(app) : ''
}

async function gitPortatil(app, falar) {
  falar('baixando as ferramentas do agente (git)')
  const raiz = pasta(app)
  fs.mkdirSync(raiz, { recursive: true })
  const plat = process.arch === 'arm64' ? 'osx-arm64' : 'osx-64'
  const mm = path.join(raiz, 'bin', 'micromamba')
  if (!fs.existsSync(mm)) {
    const r = await roda('/bin/sh', ['-c', `curl -fsSL "https://micro.mamba.pm/api/micromamba/${plat}/latest" | tar -xj -C "${raiz}" bin/micromamba`], { timeout: 180000 })
    if (!r.ok || !fs.existsSync(mm)) throw new Error('Não consegui baixar as ferramentas do agente. Confira a internet e tente de novo. ' + r.err.slice(-200))
  }
  const r = await roda(mm, ['create', '-y', '-q', '-r', path.join(raiz, 'mamba'), '-p', path.join(raiz, 'git'), '-c', 'conda-forge', 'git'], { timeout: 15 * 60000 })
  const g = path.join(binGit(app), 'git')
  if (!r.ok || !fs.existsSync(g)) throw new Error('Não consegui preparar o git do agente. ' + (r.err || r.out).slice(-300))
  const v = await roda(g, ['--version'])
  if (!v.ok) throw new Error('O git do agente não roda: ' + v.err.slice(-200))
  try {
    fs.rmSync(path.join(raiz, 'mamba', 'pkgs'), { recursive: true, force: true }) // cache do micromamba
  } catch {}
  return binGit(app)
}

// Mac Intel: abre o diálogo oficial da Apple e espera as ferramentas ficarem prontas
async function ferramentasAppleComDialogo(falar, { esperarMs = 40 * 60000, intervaloMs = 5000 } = {}) {
  await roda('xcode-select', ['--install'])
  falar('o Mac abriu uma janela da Apple: clique em Instalar e aceite. Leva uns 10 minutos e acontece uma vez só')
  const t0 = Date.now()
  while (Date.now() - t0 < esperarMs) {
    await new Promise((r) => setTimeout(r, intervaloMs))
    if (ferramentasApple()) return true
  }
  throw new Error('As ferramentas da Apple não foram instaladas. Clique em Instalar na janela da Apple (ou rode "xcode-select --install" no Terminal) e abra o Segundo Cérebro de novo.')
}

// Garante o que o instalador do Hermes precisa no Mac. Devolve a pasta extra do PATH (git portátil) ou ''.
async function garantir(app, falar = () => {}) {
  if (process.platform !== 'darwin') return ''
  if (process.arch !== 'arm64') {
    // Intel: precisa de compilador; com as ferramentas da Apple vem o git também
    if (!ferramentasApple()) await ferramentasAppleComDialogo(falar)
    return ''
  }
  const achado = gitDisponivel(app)
  if (achado) return achado.startsWith(pasta(app)) ? binGit(app) : ''
  return gitPortatil(app, falar)
}

module.exports = { garantir, caminhoExtra, gitDisponivel, ferramentasApple }
