// Preload do navegador integrado (roda antes dos scripts da página).
// 1) Em TODOS os sites: o navegador se apresenta como um Chrome comum (as mesmas correções da biblioteca "stealth" do Puppeteer):
//    window.chrome completo, plugins de PDF, marcas do Google Chrome no userAgentData, permissões coerentes, sem navigator.webdriver
//    e, na VM (sem placa de vídeo), uma placa de vídeo comum no WebGL no lugar do "SwiftShader" que denuncia servidor.
// 2) Só nas páginas de conta do Google: completa o disfarce de Firefox (navegador.js loginGoogleComoFirefox). O Google recusa login
//    em navegador embutido e confere se o que o JavaScript vê bate com o user-agent: Firefox não tem userAgentData nem window.chrome.
const { webFrame } = require('electron')

const contaGoogle = /(^|\.)accounts\.google\.[a-z.]+$|(^|\.)accounts\.youtube\.com$/i.test(location.hostname)

if (contaGoogle) {
  webFrame.executeJavaScript(`(() => {
    try { Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => undefined, configurable: true }) } catch (e) {}
    try { delete window.chrome } catch (e) {}
    try { Object.defineProperty(window, 'chrome', { get: () => undefined, configurable: true }) } catch (e) {}
    try { Object.defineProperty(Navigator.prototype, 'vendor', { get: () => '', configurable: true }) } catch (e) {}
    try { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }) } catch (e) {}
  })()`)
} else {
  const plataforma = process.platform
  webFrame.executeJavaScript(`(() => {
    const def = (o, k, get) => { try { Object.defineProperty(o, k, { get, configurable: true }) } catch (e) {} }
    // funções trocadas continuam com cara de nativas no toString
    const nativo = (fn, nome) => { try { const t = 'function ' + nome + '() { [native code] }'; Object.defineProperty(fn, 'toString', { value: () => t, configurable: true }) } catch (e) {} return fn }
    def(Navigator.prototype, 'webdriver', () => false)
    // window.chrome como no Chrome de verdade
    if (!window.chrome || !window.chrome.runtime) {
      const c = window.chrome || {}
      c.app = c.app || { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }, getDetails: nativo(function getDetails() { return null }, 'getDetails'), getIsInstalled: nativo(function getIsInstalled() { return false }, 'getIsInstalled') }
      c.runtime = c.runtime || { OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' }, PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' }, connect: nativo(function connect() { throw new TypeError('Error in invocation of runtime.connect') }, 'connect'), sendMessage: nativo(function sendMessage() {}, 'sendMessage'), id: undefined }
      const t0 = performance.timeOrigin || Date.now()
      c.csi = c.csi || nativo(function csi() { return { onloadT: t0 + 300, pageT: performance.now(), startE: t0, tran: 15 } }, 'csi')
      c.loadTimes = c.loadTimes || nativo(function loadTimes() { const s = t0 / 1000; return { commitLoadTime: s + 0.2, connectionInfo: 'h2', finishDocumentLoadTime: s + 0.5, finishLoadTime: s + 0.6, firstPaintAfterLoadTime: 0, firstPaintTime: s + 0.3, navigationType: 'Other', npnNegotiatedProtocol: 'h2', requestTime: s, startLoadTime: s, wasAlternateProtocolAvailable: false, wasFetchedViaSpdy: true, wasNpnNegotiated: true } }, 'loadTimes')
      try { window.chrome = c } catch (e) {}
    }
    // plugins de PDF (o Chrome sempre lista 5; o embutido lista 0)
    try {
      if (!navigator.plugins || navigator.plugins.length === 0) {
        const mime = [{ type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }, { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' }]
        const nomes = ['PDF Viewer', 'Chrome PDF Viewer', 'Chromium PDF Viewer', 'Microsoft Edge PDF Viewer', 'WebKit built-in PDF']
        const plugins = nomes.map((name) => { const p = { name, filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: mime.length }; mime.forEach((m, i) => { p[i] = m }); p.item = (i) => p[i]; p.namedItem = (n) => mime.find((m) => m.type === n) || null; return p })
        const lista = Object.assign(Object.create(PluginArray.prototype), plugins, { length: plugins.length, item: (i) => plugins[i] || null, namedItem: (n) => plugins.find((p) => p.name === n) || null, refresh: () => {} })
        const tipos = Object.assign(Object.create(MimeTypeArray.prototype), mime, { length: mime.length, item: (i) => mime[i] || null, namedItem: (n) => mime.find((m) => m.type === n) || null })
        def(Navigator.prototype, 'plugins', () => lista)
        def(Navigator.prototype, 'mimeTypes', () => tipos)
        def(Navigator.prototype, 'pdfViewerEnabled', () => true)
      }
    } catch (e) {}
    // marcas do Google Chrome nas "client hints" (o embutido mostra só Chromium)
    try {
      const uad = navigator.userAgentData
      if (uad && !uad.brands.some((b) => /Google Chrome/.test(b.brand))) {
        const v = (uad.brands.find((b) => /Chromium/.test(b.brand)) || {}).version || (navigator.userAgent.match(/Chrome\\/(\\d+)/) || [])[1] || '140'
        const brands = [{ brand: 'Google Chrome', version: v }, { brand: 'Chromium', version: v }, { brand: 'Not=A?Brand', version: '24' }]
        const orig = uad.getHighEntropyValues ? uad.getHighEntropyValues.bind(uad) : null
        const novo = { brands, mobile: false, platform: uad.platform, toJSON() { return { brands, mobile: false, platform: uad.platform } },
          getHighEntropyValues: nativo(async function getHighEntropyValues(h) { const r = orig ? await orig(h) : {}; r.brands = brands; if (r.fullVersionList) r.fullVersionList = brands.map((b) => ({ brand: b.brand, version: b.brand === 'Not=A?Brand' ? '24.0.0.0' : v + '.0.0.0' })); return r }, 'getHighEntropyValues') }
        Object.setPrototypeOf(novo, Object.getPrototypeOf(uad))
        def(Navigator.prototype, 'userAgentData', () => novo)
      }
    } catch (e) {}
    // permissões coerentes (robô costuma responder "prompt" com Notification "denied")
    try {
      const q = navigator.permissions && navigator.permissions.query && navigator.permissions.query.bind(navigator.permissions)
      if (q) navigator.permissions.query = nativo(function query(p) { return p && p.name === 'notifications' ? Promise.resolve({ state: Notification.permission === 'default' ? 'prompt' : Notification.permission, onchange: null }) : q(p) }, 'query')
    } catch (e) {}
    // idioma do Brasil também no JavaScript
    def(Navigator.prototype, 'languages', () => Object.freeze(['pt-BR', 'pt', 'en-US', 'en']))
    def(Navigator.prototype, 'language', () => 'pt-BR')
    // placa de vídeo: sem GPU (VM) o WebGL diz "SwiftShader", marca de servidor. Troca por uma placa comum da plataforma.
    try {
      const PLACA = ${JSON.stringify(plataforma === 'darwin' ? ['Google Inc. (Apple)', 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)'] : plataforma === 'linux' ? ['Google Inc. (Intel)', 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6)'] : ['Google Inc. (Intel)', 'ANGLE (Intel, Intel(R) UHD Graphics 630 (0x00003E9B) Direct3D11 vs_5_0 ps_5_0, D3D11)'])}
      for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
        if (!C) continue
        const orig = C.prototype.getParameter
        C.prototype.getParameter = nativo(function getParameter(p) {
          const r = orig.call(this, p)
          if (p === 37445 && /swiftshader|llvmpipe|mesa offscreen/i.test(String(orig.call(this, 37446) || ''))) return PLACA[0]
          if (p === 37446 && /swiftshader|llvmpipe|mesa offscreen/i.test(String(r || ''))) return PLACA[1]
          return r
        }, 'getParameter')
      }
    } catch (e) {}
  })()`)
}
