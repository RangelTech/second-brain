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

function criar({ app, localizar }) {
  let andamento = null
  let etapa = ''
  const ouvintes = new Set()
  const falar = (t) => {
    if (t === etapa) return
    etapa = t
    for (const f of ouvintes) f(t)
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
        andamento ||= instalar().finally(() => (andamento = null))
        await andamento
      } finally {
        clearInterval(batida)
        ouvintes.delete(ouvir)
      }
    },
  }
}

module.exports = { criar }
