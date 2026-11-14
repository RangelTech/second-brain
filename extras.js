// Extras que as skills precisam, preparados em SEGUNDO PLANO depois que o agente está pronto (pedido do Lucas, 13/11/2026:
// "tudo que precisa pra skill funcionar vem instalado junto"). Cada um baixa do snapshot nosso, uma vez só, sem tela e sem admin.
// Hoje: voz local (skill voz-local: OpenVoice + XTTS, ~4 GB com o modelo do XTTS) e a suíte de escritório (escritorio.js).
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')

const VOZ_MARCA = path.join(os.homedir(), '.segundo-cerebro', 'voz-local', '.pronto-v2')
const LIVRE_MIN_GB = 15 // não enche o disco do usuário: sem esse espaço livre, prepara só quando a skill pedir

function livreGb(dir) {
  try {
    const s = fs.statfsSync(dir)
    return (s.bavail * s.bsize) / 1024 ** 3
  } catch {
    return Infinity
  }
}

function scriptVoz() {
  return [path.join(process.resourcesPath || '', 'skills-globais', 'essenciais', 'voz-local', 'scripts', 'voz_local.py'), path.join(__dirname, 'skills-globais', 'essenciais', 'voz-local', 'scripts', 'voz_local.py')].find((p) => fs.existsSync(p))
}

let vozRodando = null
function prepararVoz(app, log = () => {}) {
  if (fs.existsSync(VOZ_MARCA)) return Promise.resolve({ ok: true, ja: true })
  if (vozRodando) return vozRodando
  const script = scriptVoz()
  if (!script) return Promise.resolve({ ok: false, erro: 'script da voz não encontrado' })
  if (livreGb(os.homedir()) < LIVRE_MIN_GB) return Promise.resolve({ ok: false, erro: 'pouco espaço em disco; a voz local fica para quando for pedida' })
  const env = require('./agent').ferramentasPython(path.join(app.getPath('userData'), 'hermes-home'), { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' })
  const py = env.SB_PYTHON || (process.platform === 'win32' ? 'python' : 'python3')
  vozRodando = new Promise((ok) => {
    let saida = ''
    const p = spawn(py, [script, 'instalar', '--motor', 'ambos'], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    p.stdout.on('data', (d) => (saida += d))
    p.stderr.on('data', (d) => (saida = (saida + d).slice(-4000)))
    p.on('error', (e) => ok({ ok: false, erro: e.message }))
    p.on('close', (cod) => {
      if (cod === 0) {
        try {
          fs.writeFileSync(VOZ_MARCA, new Date().toISOString())
        } catch {}
        log('voz local pronta')
        ok({ ok: true })
      } else {
        log('voz local falhou: ' + saida.slice(-600))
        ok({ ok: false, erro: saida.slice(-600) })
      }
    })
  }).finally(() => (vozRodando = null))
  return vozRodando
}

// chamado pelo main.js uns segundos depois que o agente fica pronto; um de cada vez para não disputar a internet
async function preparar(app, { log = () => {}, progressoEscritorio } = {}) {
  if (process.env.SB_SEM_EXTRAS) return
  const escritorio = require('./escritorio')
  try {
    if (!escritorio.executavel(app) && livreGb(app.getPath('userData')) > LIVRE_MIN_GB) {
      await escritorio.instalar(app, progressoEscritorio)
      log('editor de documentos pronto')
    }
  } catch (e) {
    log('editor de documentos em segundo plano: ' + (e.message || e))
  }
  await prepararVoz(app, log)
}

module.exports = { preparar, prepararVoz, VOZ_MARCA }
