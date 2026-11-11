'use strict'
// Login por conta (Claude Code, ChatGPT, Gemini) numa janela do próprio app: o provedor devolve para
// http://localhost:8080/callback?code=…, e a janela pega esse endereço sozinha (mesmo que a página dê erro),
// fecha e entrega o código. Sem copiar e colar URL.

function ehRetorno(url, prefixo) {
  if (!url || typeof url !== 'string') return false
  try {
    const u = new URL(url)
    const p = new URL(prefixo)
    const hostIgual = u.hostname === p.hostname || (['localhost', '127.0.0.1'].includes(u.hostname) && ['localhost', '127.0.0.1'].includes(p.hostname))
    return u.protocol === p.protocol && hostIgual && (u.port || '80') === (p.port || '80') && u.pathname.replace(/\/$/, '') === p.pathname.replace(/\/$/, '')
  } catch {
    return false
  }
}

function lerRetorno(url) {
  const u = new URL(url)
  return { url, code: u.searchParams.get('code'), state: u.searchParams.get('state'), erro: u.searchParams.get('error_description') || u.searchParams.get('error') }
}

// abre `url` numa janela própria e resolve com { url, code, state } quando o navegador tentar ir para `retorno`.
// Rejeita com Error('fechada') se a pessoa fechar a janela antes de terminar.
function capturar({ BrowserWindow, url, retorno, pai, userAgent, particao = 'persist:sb-oauth', limiteMs = 15 * 60 * 1000 }) {
  return new Promise((resolve, reject) => {
    const w = new BrowserWindow({
      width: 520,
      height: 720,
      parent: pai || undefined,
      modal: false,
      autoHideMenuBar: true,
      title: 'Entrar com a conta',
      webPreferences: { partition: particao, contextIsolation: true, nodeIntegration: false, sandbox: true },
    })
    let feito = false
    const terminar = (fn, valor) => {
      if (feito) return
      feito = true
      clearTimeout(relogio)
      try {
        if (!w.isDestroyed()) w.close()
      } catch {}
      fn(valor)
    }
    const olhar = (ev, alvo) => {
      if (!ehRetorno(alvo, retorno)) return false
      try {
        ev && ev.preventDefault && ev.preventDefault() // não precisa carregar a página de localhost
      } catch {}
      const r = lerRetorno(alvo)
      if (r.code) terminar(resolve, r)
      else terminar(reject, new Error(r.erro || 'O login não devolveu o código.'))
      return true
    }
    const wc = w.webContents
    if (userAgent) wc.setUserAgent(userAgent)
    wc.on('will-redirect', (ev, alvo) => olhar(ev, alvo))
    wc.on('will-navigate', (ev, alvo) => olhar(ev, alvo))
    wc.on('did-navigate', (_ev, alvo) => olhar(null, alvo))
    wc.on('did-fail-load', (_ev, _cod, _desc, alvo) => olhar(null, alvo)) // página de erro de localhost: o endereço ainda vem aqui
    wc.on('did-redirect-navigation', (_ev, alvo) => olhar(null, alvo))
    // links que abrem nova aba (ex.: "entrar com Google") ficam nesta mesma janela
    wc.setWindowOpenHandler(({ url: novo }) => {
      if (olhar(null, novo)) return { action: 'deny' }
      if (/^https?:\/\//i.test(novo)) wc.loadURL(novo)
      return { action: 'deny' }
    })
    w.on('closed', () => terminar(reject, new Error('fechada')))
    const relogio = setTimeout(() => terminar(reject, new Error('O tempo para entrar acabou. Tente de novo.')), limiteMs)
    w.loadURL(url).catch(() => {}) // erros de carga aparecem em did-fail-load
  })
}

module.exports = { capturar, ehRetorno, lerRetorno }
