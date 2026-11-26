// Atualização do app (OTA): confere o GitHub Releases, avisa a tela e baixa/instala quando o usuário pede (ou sozinho, se marcou).
// Onde a troca automática não é possível (macOS sem assinatura, .deb, versão portátil), o botão abre a página de download.
const PAGINA = 'https://github.com/RangelTech/second-brain/releases/latest'
const INTERVALO = 6 * 3600 * 1000

// "a" é mais nova que "b"? (semver simples: 0.6.81 > 0.6.81-teste.3 > 0.6.80). Só versão MAIOR conta: quem está numa versão de teste mais
// nova que a publicada nunca é "atualizado" para trás.
function maisNova(a, b) {
  const p = (v) => {
    const [nucleo, pre] = String(v || '').replace(/^v/, '').split('-')
    return { n: nucleo.split('.').map((x) => parseInt(x, 10) || 0), pre: pre || '' }
  }
  const x = p(a)
  const y = p(b)
  for (let i = 0; i < 3; i++) if ((x.n[i] || 0) !== (y.n[i] || 0)) return (x.n[i] || 0) > (y.n[i] || 0)
  if (x.pre === y.pre) return false
  if (!x.pre) return true // 0.6.81 > 0.6.81-teste.3
  if (!y.pre) return false
  return x.pre.localeCompare(y.pre, undefined, { numeric: true }) > 0
}

// A troca no próprio lugar só funciona no instalador NSIS, no AppImage e no macOS assinado.
function trocaAutomatica(processo = process) {
  if (processo.platform === 'win32') return !processo.env.PORTABLE_EXECUTABLE_FILE
  if (processo.platform === 'linux') return !!processo.env.APPIMAGE
  return false
}

// O instalador do Windows é assinado com o certificado PRÓPRIO da Rangel Tech (autoassinado, raiz não confiável para o Windows). O
// electron-updater exige assinatura "confiável" e recusava toda atualização ("Não consegui baixar agora"). A conferência passa a ser:
// o arquivo veio do GitHub por HTTPS com o sha512 do latest.yml (o electron-updater já confere) E foi assinado exatamente pelo nosso
// certificado (impressão digital abaixo, válido até 2036).
const DIGITAL_RANGEL = 'E50B573BBB40D703A55B1F9A3810F8334C0CDA3E'
function conferirAssinatura(arquivo, executar = require('child_process').execFileSync) {
  try {
    const cmd = `(Get-AuthenticodeSignature -LiteralPath '${String(arquivo).replace(/'/g, "''")}').SignerCertificate.Thumbprint`
    const r = String(executar('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], { encoding: 'utf8', timeout: 60000, windowsHide: true })).trim().toUpperCase()
    return r === DIGITAL_RANGEL ? null : `O instalador baixado não é assinado pela Rangel Tech (${r || 'sem assinatura'}).`
  } catch (e) {
    return 'Não consegui conferir a assinatura do instalador: ' + String(e.message || e).slice(0, 120)
  }
}

function criar({ app, cfgGet, enviar, updater }) {
  let au = updater
  if (!au) {
    try {
      au = require('electron-updater').autoUpdater
    } catch {}
  }
  const est = { fase: 'nenhuma', versao: '', erro: '', automatica: trocaAutomatica() }
  const emitir = (p) => {
    Object.assign(est, p)
    try {
      enviar('atualizacao:estado', { ...est })
    } catch {}
  }

  // forcar=true na abertura do app (pedido do Lucas, 19/11/2026): havendo versão nova e troca automática possível, baixa e instala NA HORA,
  // sem esperar o clique. Com o app aberto (a cada 6 h) só baixa sozinho e instala ao fechar ou na próxima abertura: nunca no meio de uma tarefa.
  async function conferir(forcar = false) {
    if (!au || ['baixando', 'pronta'].includes(est.fase)) return est
    try {
      const r = await au.checkForUpdates()
      const nova = r?.updateInfo?.version
      if (nova && maisNova(nova, app.getVersion()) && r.isUpdateAvailable !== false) {
        const forcada = forcar && est.automatica && cfgGet().forcarAtualizacao !== false && !process.env.SB_SEM_FORCAR
        emitir({ fase: 'disponivel', versao: nova, erro: '', forcada })
        if (forcada) baixar(true, true)
        else if (est.automatica && (cfgGet().atualizarAuto || cfgGet().forcarAtualizacao !== false)) baixar(false)
      } else emitir({ fase: 'nenhuma', erro: '' })
    } catch (e) {
      emitir({ fase: est.fase === 'disponivel' ? 'disponivel' : 'nenhuma', erro: String(e.message || e).slice(0, 160) })
    }
    return est
  }

  async function baixar(instalarJa = true, silencioso = false) {
    if (!est.automatica) {
      require('electron').shell.openExternal(PAGINA)
      return est
    }
    if (est.fase === 'pronta') { // já baixou sozinha (download automático): o clique em Atualizar instala na hora
      if (instalarJa) instalar(silencioso)
      return est
    }
    if (est.fase === 'baixando') return est
    emitir({ fase: 'baixando', erro: '' })
    try {
      await au.downloadUpdate()
      emitir({ fase: 'pronta' })
      if (instalarJa) instalar(silencioso)
    } catch (e) {
      try { console.error('atualização: falha ao baixar/conferir:', String(e && e.message || e).slice(0, 400)) } catch {}
      emitir({ fase: 'disponivel', erro: 'Não consegui baixar agora. Tente de novo em instantes.' })
    }
    return est
  }

  function instalar(silencioso = false) {
    if (est.fase !== 'pronta') return false
    // (silencioso, reabrir): na atualização forçada da abertura o instalador roda sem janelas e o app reabre sozinho
    setImmediate(() => au.quitAndInstall(!!silencioso, true))
    return true
  }

  function iniciar() {
    if (process.env.SB_TESTE_ATUALIZACAO) setTimeout(() => emitir({ fase: 'disponivel', versao: process.env.SB_TESTE_ATUALIZACAO }), 4000) // só para ensaiar a tela
    if (!au || !app.isPackaged) return
    au.autoDownload = false
    if (process.platform === 'win32') au.verifyUpdateCodeSignature = async (_publicadores, arquivo) => conferirAssinatura(arquivo)
    au.autoInstallOnAppQuit = true // se baixou e o usuário só fechou o app, a troca acontece ao sair
    au.allowPrerelease = false
    setTimeout(() => conferir(true), 3000).unref?.() // abertura: confere logo e força a atualização (ver conferir)
    setInterval(() => conferir(), INTERVALO).unref?.()
  }

  return { iniciar, conferir, baixar, instalar, estado: () => ({ ...est }), trocaAutomatica }
}

module.exports = { conferirAssinatura, DIGITAL_RANGEL, criar, trocaAutomatica, maisNova, PAGINA }
