// Atualização do app (OTA): confere o GitHub Releases, avisa a tela e baixa/instala quando o usuário pede (ou sozinho, se marcou).
// Onde a troca automática não é possível (macOS sem assinatura, .deb, versão portátil), o botão abre a página de download.
const PAGINA = 'https://github.com/RangelTech/second-brain/releases/latest'
const INTERVALO = 6 * 3600 * 1000

// A troca no próprio lugar só funciona no instalador NSIS, no AppImage e no macOS assinado.
function trocaAutomatica(processo = process) {
  if (processo.platform === 'win32') return !processo.env.PORTABLE_EXECUTABLE_FILE
  if (processo.platform === 'linux') return !!processo.env.APPIMAGE
  return false
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

  async function conferir() {
    if (!au || ['baixando', 'pronta'].includes(est.fase)) return est
    try {
      const r = await au.checkForUpdates()
      const nova = r?.updateInfo?.version
      if (nova && nova !== app.getVersion() && r.isUpdateAvailable !== false) {
        emitir({ fase: 'disponivel', versao: nova, erro: '' })
        if (cfgGet().atualizarAuto && est.automatica) baixar(false)
      } else emitir({ fase: 'nenhuma', erro: '' })
    } catch (e) {
      emitir({ fase: est.fase === 'disponivel' ? 'disponivel' : 'nenhuma', erro: String(e.message || e).slice(0, 160) })
    }
    return est
  }

  async function baixar(instalarJa = true) {
    if (!est.automatica) {
      require('electron').shell.openExternal(PAGINA)
      return est
    }
    if (est.fase === 'baixando' || est.fase === 'pronta') return est
    emitir({ fase: 'baixando', erro: '' })
    try {
      await au.downloadUpdate()
      emitir({ fase: 'pronta' })
      if (instalarJa) instalar()
    } catch (e) {
      emitir({ fase: 'disponivel', erro: 'Não consegui baixar agora. Tente de novo em instantes.' })
    }
    return est
  }

  function instalar() {
    if (est.fase !== 'pronta') return false
    // false, true: instalador normal (mostra o progresso) e reabre o app depois
    setImmediate(() => au.quitAndInstall(false, true))
    return true
  }

  function iniciar() {
    if (process.env.SB_TESTE_ATUALIZACAO) setTimeout(() => emitir({ fase: 'disponivel', versao: process.env.SB_TESTE_ATUALIZACAO }), 4000) // só para ensaiar a tela
    if (!au || !app.isPackaged) return
    au.autoDownload = false
    au.autoInstallOnAppQuit = true // se baixou e o usuário só fechou o app, a troca acontece ao sair
    au.allowPrerelease = false
    setTimeout(() => conferir(), 15000).unref?.()
    setInterval(() => conferir(), INTERVALO).unref?.()
  }

  return { iniciar, conferir, baixar, instalar, estado: () => ({ ...est }), trocaAutomatica }
}

module.exports = { criar, trocaAutomatica, PAGINA }
