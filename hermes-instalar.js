// Instala o Hermes Agent (Nous Research, MIT) na primeira conversa, com o instalador oficial do projeto.
// Os instaladores do app não trazem o Hermes (são ~900 MB com Python e dependências); ele vai para a pasta de dados do app,
// uma vez, e depois só atualiza quando o usuário pedir. Uma instalação por vez (várias conversas esperam a mesma).
const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const RAIZ = 'https://raw.githubusercontent.com/NousResearch/hermes-agent'
const REF = process.env.SB_HERMES_REF || 'main' // versão do instalador; o instalador baixa a última release estável do Hermes
const SEM_COR = /\x1b\[[0-9;?]*[A-Za-z]/g

// Pasta FIXA do agente embutido no instalador do Windows. O Hermes grava o caminho absoluto do ambiente dele, entao o pacote so funciona
// quando descompactado no MESMO caminho em que foi montado (testado: copiar para outra pasta da `dependency environment is missing`).
const RAIZ_EMBUTIDA = () => process.env.SB_HERMES_RAIZ || (process.platform === 'win32' ? 'C:\\SegundoCerebro\\hermes' : '')

function criar({ app, localizar, recursos = () => process.resourcesPath, executar = executarProcesso }) {
  let andamento = null
  let etapa = ''
  const ouvintes = new Set()
  const falar = (t) => {
    if (t === etapa) return
    etapa = t
    for (const f of ouvintes) f(t)
  }

  // Windows: o instalador traz o agente pronto (hermes-runtime/hermes-win32-x64.7z + 7za.exe). Descompacta na pasta fixa e confere que o Hermes
  // sobe (--version valida o ambiente). Qualquer falha apaga a pasta e devolve false: o fluxo cai no download de sempre.
  async function extrairEmbutido() {
    const raiz = RAIZ_EMBUTIDA()
    const pasta = path.join(recursos() || '', 'hermes-runtime')
    const arq = path.join(pasta, 'hermes-win32-x64.7z')
    const sete = path.join(pasta, '7za.exe')
    if (!raiz || !fs.existsSync(arq) || !fs.existsSync(sete)) return false
    const bin = path.join(raiz, 'bin', 'hermes.exe')
    try {
      falar('copiando o agente que vem no instalador')
      fs.mkdirSync(raiz, { recursive: true })
      const x = await executar(sete, ['x', arq, '-o' + raiz, '-y', '-bso0', '-bsp0'], { timeoutMs: 20 * 60000 })
      if (x.codigo !== 0) throw new Error('descompactar falhou (codigo ' + x.codigo + ') ' + (x.saida || '').slice(-200))
      if (!fs.existsSync(bin)) throw new Error('hermes.exe nao apareceu depois de descompactar')
      falar('conferindo o agente')
      const v = await executar(bin, ['--version'], { timeoutMs: 120000, env: { ...process.env, HERMES_HOME: path.join(app.getPath('userData'), 'hermes-home') } })
      if (v.codigo !== 0) throw new Error('hermes --version falhou (codigo ' + v.codigo + ') ' + (v.saida || '').slice(-300))
      try {
        fs.rmSync(arq, { force: true }) // ja descompactado e conferido: o pacote nao precisa ocupar disco duas vezes
      } catch {}
      await extrairHomePronto(pasta, sete, raiz)
      return true
    } catch (e) {
      try {
        fs.rmSync(raiz, { recursive: true, force: true })
      } catch {}
      falar('o agente embutido falhou (' + String(e.message).slice(0, 80) + '); baixando')
      return false
    }
  }

  // Ambiente PRONTO (home-win32-x64.7z: installs, environments, bin): montado no CI no mesmo caminho fixo. Extrai e marca como montado, então a primeira
  // conversa não monta nada (nem baixa nada). Qualquer falha devolve false e o app monta o ambiente pela internet, como antes.
  async function extrairHomePronto(pasta, sete, raiz) {
    const arq = path.join(pasta, 'home-win32-x64.7z')
    if (!fs.existsSync(arq)) return false
    const cam = require('./caminhos-hermes')
    const dec = cam.decidir(app)
    if (dec.modo !== 'embutido') return false // outro usuário do PC: o home fixo é de quem instalou primeiro
    const home = dec.home
    try {
      falar('copiando o ambiente do agente')
      fs.mkdirSync(home, { recursive: true })
      const x = await executar(sete, ['x', arq, '-o' + home, '-y', '-bso0', '-bsp0'], { timeoutMs: 20 * 60000 })
      if (x.codigo !== 0) throw new Error('codigo ' + x.codigo)
      fs.writeFileSync(path.join(home, '.dono'), dec.id || cam.idDoUsuario(app.getPath('userData')))
      const bin = path.join(raiz, 'bin', 'hermes-acp.exe')
      const st = fs.statSync(bin) // mesma assinatura que o app confere em ambienteMontado (agent.js)
      fs.writeFileSync(path.join(home, 'pronto.ok'), new Date().toISOString() + ' ' + st.size + '-' + Math.round(st.mtimeMs))
      try { fs.rmSync(arq, { force: true }) } catch {}
      return true
    } catch (e) {
      try { fs.rmSync(home, { recursive: true, force: true }) } catch {}
      falar('o ambiente pronto falhou (' + String(e.message).slice(0, 60) + '); sera montado pela internet')
      return false
    }
  }

  async function instalar() {
    const home = require('./caminhos-hermes').raizAgente(app)
    fs.mkdirSync(home, { recursive: true })
    const win = process.platform === 'win32'
    falar('baixando o instalador')
    const r = await fetch(`${RAIZ}/${REF}/scripts/install.${win ? 'ps1' : 'sh'}`, { signal: AbortSignal.timeout(60000) }).catch(() => null)
    if (!r || !r.ok) throw new Error('Não consegui baixar o instalador do agente. Confira a conexão com a internet e tente de novo.')
    const script = path.join(os.tmpdir(), 'sb-hermes-install.' + (win ? 'ps1' : 'sh'))
    fs.writeFileSync(script, await r.text())
    const [exe, args] = win
      ? ['powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-NonInteractive', '-SkipBrowser', '-SkipComputerUse', '-HermesHome', home]]
      : ['bash', [script, '--non-interactive', '--skip-browser', '--skip-computer-use', '--hermes-home', home]]
    await new Promise((resolve, reject) => {
      const filho = spawn(exe, args, { env: { ...process.env, HERMES_HOME: home }, windowsHide: true })
      const fim = []
      const todas = []
      const linhas = (d) => {
        for (const l of String(d).replace(SEM_COR, '').split(/\r?\n/)) {
          const t = l.trim()
          if (!t) continue
          fim.push(t)
          if (fim.length > 40) fim.shift()
          todas.push(t)
          if (todas.length > 600) todas.shift()
          if (/^[→✓]/.test(t)) falar(t.replace(/^[→✓]\s*/, '').slice(0, 90))
        }
      }
      filho.stdout.on('data', linhas)
      filho.stderr.on('data', linhas)
      filho.on('error', (e) => reject(new Error('Não consegui iniciar o instalador do agente: ' + e.message)))
      // o instalador oficial pode terminar com erro numa etapa opcional (ex.: Node das ferramentas web) e deixar o agente pronto
      filho.on('close', (codigo) => {
        // a saida inteira do instalador fica em hermes-instalacao.log (antes era descartada quando o app "achava" um executavel e dava a instalacao por boa)
        try {
          fs.appendFileSync(path.join(app.getPath('userData'), 'hermes-instalacao.log'), `${new Date().toISOString()} codigo=${codigo}\n${todas.join('\n')}\n`)
        } catch {}
        // so vale o comando PUBLICADO (<raiz>\bin\hermes-acp): o executavel solto do checkout existe mesmo quando a instalacao morre antes dos pacotes Python
        const publicado = fs.existsSync(path.join(home, 'bin', win ? 'hermes-acp.exe' : 'hermes-acp'))
        if (codigo === 0 || publicado) return resolve()
        reject(new Error('A instalação do agente falhou (código ' + codigo + ').\n' + fim.slice(-25).join('\n')))
      })
    })
    if (!localizar()) throw new Error('O agente foi instalado, mas não achei o programa dele. Fale com o suporte.')
  }

  return {
    pronto: () => !!localizar(),
    // devolve quando o agente existe; `aviso(texto)` recebe a etapa para mostrar na conversa
    async garantir(aviso) {
      if (localizar()) return
      const msg = (t) => (t ? `Preparando o agente pela primeira vez (${t}). Leva alguns minutos e acontece uma vez só…` : 'Preparando o agente pela primeira vez. Leva alguns minutos e acontece uma vez só…')
      const ouvir = (t) => aviso?.(msg(t))
      ouvintes.add(ouvir)
      aviso?.(msg(etapa))
      // batimento: etapa longa (baixar dependências) não pode parecer travada nem ser cortada pelo vigia de "sem sinal"
      const batida = setInterval(() => aviso?.(msg(etapa)), 15000)
      try {
        andamento ||= (async () => {
          if ((await extrairEmbutido()) && localizar()) return
          await instalar()
        })().finally(() => (andamento = null))
        await andamento
      } finally {
        clearInterval(batida)
        ouvintes.delete(ouvir)
      }
    },
  }
}

// roda um programa, junta a saida e devolve { codigo, saida }; estouro de tempo mata o processo
function executarProcesso(exe, args, { timeoutMs = 60000, env = process.env } = {}) {
  return new Promise((resolve) => {
    let saida = ''
    let fim = false
    const f = spawn(exe, args, { env, windowsHide: true })
    const termina = (codigo) => {
      if (fim) return
      fim = true
      clearTimeout(t)
      resolve({ codigo, saida })
    }
    const t = setTimeout(() => {
      try {
        f.kill()
      } catch {}
      termina(-1)
    }, timeoutMs)
    f.stdout.on('data', (d) => (saida += d))
    f.stderr.on('data', (d) => (saida += d))
    f.on('error', (e) => {
      saida += String(e.message)
      termina(-2)
    })
    f.on('close', (c) => termina(c === null ? -1 : c))
  })
}

module.exports = { criar, RAIZ_EMBUTIDA }
