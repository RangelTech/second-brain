// Segundo plano (spec 37): o agente fica de pé com o computador, como um serviço. O app abre escondido no login (--oculto), mantém o
// gateway do Hermes vivo (é ele que roda os Workflows na hora marcada) e mora na bandeja do sistema. Fechar a janela só esconde; "Sair"
// na bandeja encerra de verdade. Vale para Windows, macOS e Linux. Não é um serviço do sistema operacional de propósito: o serviço rodaria
// como outro usuário, sem os logins do navegador, a pasta e as chaves do cliente.
const fs = require('fs')
const os = require('os')
const path = require('path')

const NOME = 'Segundo Cérebro'

function arquivoAutostartLinux() {
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'autostart', 'segundo-cerebro.desktop')
}

// liga ou desliga o "iniciar com o computador". Só no app instalado (no código-fonte registraria o electron.exe do desenvolvedor).
function aplicarInicio(app, ligado) {
  if (!app.isPackaged) return false
  try {
    if (process.platform === 'linux') {
      const f = arquivoAutostartLinux()
      if (!ligado) {
        try { fs.unlinkSync(f) } catch {}
        return true
      }
      const exe = process.env.APPIMAGE || process.execPath
      fs.mkdirSync(path.dirname(f), { recursive: true })
      fs.writeFileSync(f, `[Desktop Entry]\nType=Application\nName=${NOME}\nExec="${exe}" --oculto\nX-GNOME-Autostart-enabled=true\nHidden=false\nNoDisplay=false\n`)
      return true
    }
    app.setLoginItemSettings({ openAtLogin: !!ligado, openAsHidden: true, args: ['--oculto'] })
    return true
  } catch {
    return false
  }
}

function estadoInicio(app) {
  if (!app.isPackaged) return false
  try {
    if (process.platform === 'linux') return fs.existsSync(arquivoAutostartLinux())
    return !!app.getLoginItemSettings({ args: ['--oculto'] }).openAtLogin
  } catch {
    return false
  }
}

function criar({ app, janela, icone, cfg, salvarCfg, abrirAba }) {
  const { Tray, Menu, nativeImage, Notification } = require('electron')
  let tray = null
  let saindo = false
  app.on('before-quit', () => { saindo = true })

  const mostrar = () => {
    const w = janela()
    if (!w) return
    if (w.isMinimized()) w.restore()
    w.show()
    w.focus()
  }
  const montarMenu = () => Menu.buildFromTemplate([
    { label: `Abrir o ${NOME}`, click: mostrar },
    { label: 'Workflows', click: () => { mostrar(); abrirAba('rotinas') } },
    { label: 'Créditos e limites', click: () => { mostrar(); abrirAba('cota') } },
    { type: 'separator' },
    { label: 'Iniciar com o computador', type: 'checkbox', checked: cfg().iniciarComSistema !== false, enabled: app.isPackaged, click: (i) => definir({ iniciarComSistema: i.checked }) },
    { label: 'Fechar a janela deixa rodando aqui', type: 'checkbox', checked: cfg().fecharParaBandeja !== false, click: (i) => definir({ fecharParaBandeja: i.checked }) },
    { type: 'separator' },
    { label: 'Sair (os workflows param)', click: () => { saindo = true; app.quit() } },
  ])
  function definir(mudanca) {
    Object.assign(cfg(), mudanca)
    salvarCfg()
    if ('iniciarComSistema' in mudanca) aplicarInicio(app, mudanca.iniciarComSistema)
    tray?.setContextMenu(montarMenu())
    return estado()
  }
  function estado() {
    return { inicio: cfg().iniciarComSistema !== false, inicioAtivo: estadoInicio(app), bandeja: cfg().fecharParaBandeja !== false, instalado: app.isPackaged }
  }

  try {
    let img = icone ? nativeImage.createFromPath(icone) : nativeImage.createEmpty()
    if (process.platform === 'darwin' && !img.isEmpty()) img = img.resize({ width: 18, height: 18 })
    tray = new Tray(img)
    tray.setToolTip(`${NOME}: o agente está rodando`)
    tray.setContextMenu(montarMenu())
    tray.on('click', mostrar)
  } catch {
    tray = null // Linux sem área de notificação: segue sem bandeja (fechar então encerra, para não sumir sem volta)
  }

  // fechar a janela: esconde (o agente e os workflows continuam), avisando uma vez
  const prender = (w) => w.on('close', (e) => {
    if (saindo || !tray || cfg().fecharParaBandeja === false) return
    e.preventDefault()
    w.hide()
    if (!cfg().avisouBandeja) {
      cfg().avisouBandeja = true
      salvarCfg()
      try { new Notification({ title: NOME, body: 'Continuo rodando aqui na bandeja, com os seus workflows. Para sair de vez, use o ícone da bandeja.' }).show() } catch {}
    }
  })
  if (janela()) prender(janela())

  // primeira vez no app instalado: liga o "iniciar com o computador" (o cliente desliga na bandeja ou em Configurações > Sobre)
  if (cfg().iniciarComSistema !== false) aplicarInicio(app, true)

  return { mostrar, prender, estado, definir, temBandeja: () => !!tray, saindo: () => saindo }
}

module.exports = { criar, aplicarInicio, estadoInicio, arquivoAutostartLinux }
