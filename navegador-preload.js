// Preload do navegador integrado (roda antes dos scripts da página).
// Só nas páginas de conta do Google: completa o disfarce de Firefox (navegador.js loginGoogleComoFirefox). O Google recusa login
// em navegador embutido e confere se o que o JavaScript vê bate com o user-agent: Firefox não tem navigator.userAgentData nem
// window.chrome. Em qualquer outro site nada muda.
const { webFrame } = require('electron')

if (/(^|\.)accounts\.google\.[a-z.]+$|(^|\.)accounts\.youtube\.com$/i.test(location.hostname)) {
  webFrame.executeJavaScript(`(() => {
    try { Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => undefined, configurable: true }) } catch (e) {}
    try { delete window.chrome } catch (e) {}
    try { Object.defineProperty(window, 'chrome', { get: () => undefined, configurable: true }) } catch (e) {}
    try { Object.defineProperty(Navigator.prototype, 'vendor', { get: () => '', configurable: true }) } catch (e) {}
    try { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }) } catch (e) {}
  })()`)
}
