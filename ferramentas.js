// Ferramentas que o instalador oficial do Hermes exige e que um computador NOVO de cliente não tem (achado no QA de 11/11/2026; o CI não
// pegava porque as máquinas do GitHub já vêm com tudo):
// - macOS: o /usr/bin/git é só um atalho que pede as ferramentas de desenvolvedor da Apple ("git needs Apple's Command Line Tools").
// - Linux (Ubuntu de desktop recém-instalado): não vem com git nem curl ("git is required" / "curl is required").
// Solução sem administrador e sem diálogo: git e curl portáteis do conda-forge, instalados pelo micromamba (binário único, baixado pelo
// próprio Node: não depende de curl/tar). Medido no macOS da VM: 101 s, ~230 MB, clona o Hermes.
// Exceção: Mac INTEL. O `cryptography` 50 não publica mais pacote para Mac Intel e é compilado na instalação (precisa de `cc`): só as
// ferramentas da Apple resolvem. O app abre o diálogo oficial, explica ao cliente e espera (até 40 min).
// SB_SEM_FERRAMENTAS_SISTEMA=1 ignora o git/curl do sistema (teste de "computador zerado" no CI).
const { execFile, execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const pasta = (app) => path.join(app.getPath('userData'), 'ferramentas')
const binPortatil = (app) => path.join(pasta(app), 'git', 'bin')
const ignorarSistema = () => process.env.SB_SEM_FERRAMENTAS_SISTEMA === '1'
const suportado = () => process.platform === 'darwin' || process.platform === 'linux'
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

// macOS: pasta das ferramentas da Apple quando estão instaladas DE VERDADE (git e cc), ou ''. Nunca chama /usr/bin/git (o atalho abre o diálogo).
function ferramentasApple() {
  if (process.platform !== 'darwin' || ignorarSistema()) return ''
  try {
    const dev = execFileSync('xcode-select', ['-p'], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    const cc = [path.join(dev, 'usr', 'bin', 'cc'), path.join(dev, 'Toolchains', 'XcodeDefault.xctoolchain', 'usr', 'bin', 'cc')]
    if (dev && executavel(path.join(dev, 'usr', 'bin', 'git')) && cc.some(executavel)) return dev
  } catch {}
  return ''
}

// o sistema já tem git e curl de verdade?
function sistemaCompleto() {
  if (ignorarSistema()) return false
  if (process.platform === 'darwin') {
    const git = ferramentasApple() || ['/opt/homebrew/bin/git', '/usr/local/bin/git'].some(executavel)
    return !!git // curl vem com todo macOS
  }
  const noPath = (n) => (process.env.PATH || '').split(path.delimiter).some((d) => d && executavel(path.join(d, n)))
  return noPath('git') && noPath('curl')
}

// Pasta para pôr na frente do PATH (do instalador e do agente) ou '' quando não precisa.
function caminhoExtra(app) {
  if (!suportado()) return ''
  return executavel(path.join(binPortatil(app), 'git')) ? binPortatil(app) : ''
}

function plataformaMamba() {
  const arm = process.arch === 'arm64'
  if (process.platform === 'darwin') return arm ? 'osx-arm64' : 'osx-64'
  return arm ? 'linux-aarch64' : 'linux-64'
}

async function portateis(app, falar) {
  falar('baixando as ferramentas do agente (git)')
  const raiz = pasta(app)
  const mm = path.join(raiz, 'bin', 'micromamba')
  fs.mkdirSync(path.dirname(mm), { recursive: true })
  if (!executavel(mm)) {
    const url = `https://github.com/mamba-org/micromamba-releases/releases/latest/download/micromamba-${plataformaMamba()}`
    const r = await fetch(url, { signal: AbortSignal.timeout(180000) }).catch((e) => ({ ok: false, statusText: e.message }))
    if (!r.ok) throw new Error('Não consegui baixar as ferramentas do agente (' + r.statusText + '). Confira a internet e tente de novo.')
    fs.writeFileSync(mm, Buffer.from(await r.arrayBuffer()))
    fs.chmodSync(mm, 0o755)
  }
  const r = await roda(mm, ['create', '-y', '-q', '-r', path.join(raiz, 'mamba'), '-p', path.join(raiz, 'git'), '-c', 'conda-forge', 'git', 'curl'], { timeout: 15 * 60000 })
  const g = path.join(binPortatil(app), 'git')
  if (!r.ok || !executavel(g)) throw new Error('Não consegui preparar as ferramentas do agente. ' + (r.err || r.out).slice(-300))
  const v = await roda(g, ['--version'])
  if (!v.ok) throw new Error('O git do agente não roda: ' + v.err.slice(-200))
  try {
    fs.rmSync(path.join(raiz, 'mamba', 'pkgs'), { recursive: true, force: true }) // cache do micromamba
  } catch {}
  return binPortatil(app)
}

// Mac Intel: abre o diálogo oficial da Apple e espera as ferramentas ficarem prontas
async function ferramentasAppleComDialogo(falar, { esperarMs = 40 * 60000, intervaloMs = 5000 } = {}) {
  await roda('xcode-select', ['--install'])
  falar('o Mac abriu uma janela da Apple: clique em Instalar e aceite. Leva uns 15 minutos e acontece uma vez só')
  const t0 = Date.now()
  while (Date.now() - t0 < esperarMs) {
    await new Promise((r) => setTimeout(r, intervaloMs))
    if (ferramentasApple()) return true
  }
  throw new Error('As ferramentas da Apple não foram instaladas. Clique em Instalar na janela da Apple (ou rode "xcode-select --install" no Terminal) e abra o Segundo Cérebro de novo.')
}

// Garante o que o instalador do Hermes precisa. Devolve a pasta extra do PATH (ferramentas portáteis) ou ''.
async function garantir(app, falar = () => {}) {
  if (!suportado()) return ''
  if (process.platform === 'darwin' && process.arch !== 'arm64') {
    if (!ferramentasApple()) await ferramentasAppleComDialogo(falar)
    return ''
  }
  if (caminhoExtra(app)) return caminhoExtra(app)
  if (sistemaCompleto()) return ''
  return portateis(app, falar)
}

module.exports = { garantir, caminhoExtra, ferramentasApple, sistemaCompleto }
