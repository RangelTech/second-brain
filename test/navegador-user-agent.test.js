// O navegador integrado se apresenta como um Chrome comum: sem "Electron" nem o nome do app no user-agent
// (o Instagram devolvia "4xx Client Error" para o user-agent padrão do Electron).
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { userAgentChrome } = require('../navegador.js')

test('user-agent parece o do Chrome, sem Electron nem nome do app', () => {
  for (const so of ['win32', 'darwin', 'linux']) {
    const ua = userAgentChrome(so, '140.0.7339.133')
    assert.match(ua, /^Mozilla\/5\.0 \(.+\) AppleWebKit\/537\.36 \(KHTML, like Gecko\) Chrome\/140\.0\.0\.0 Safari\/537\.36$/)
    assert.doesNotMatch(ua, /Electron|segundo|cerebro/i)
  }
})

test('cada sistema usa o seu token de plataforma', () => {
  assert.match(userAgentChrome('win32', '141.0.0.0'), /Windows NT 10\.0; Win64; x64/)
  assert.match(userAgentChrome('darwin', '141.0.0.0'), /Macintosh; Intel Mac OS X 10_15_7/)
  assert.match(userAgentChrome('linux', '141.0.0.0'), /X11; Linux x86_64/)
})

test('o navegador aplica o user-agent e o idioma antes da primeira carga', () => {
  const fonte = fs.readFileSync(path.join(__dirname, '..', 'navegador.js'), 'utf8')
  const garantir = fonte.slice(fonte.indexOf('function garantir()'), fonte.indexOf('function aplicar()'))
  const iUa = garantir.indexOf('setUserAgent')
  const iCarga = garantir.indexOf('loadURL(PAGINA_INICIAL)')
  assert.ok(iUa > 0 && iCarga > 0 && iUa < iCarga, 'setUserAgent tem de vir antes do primeiro loadURL')
  assert.match(garantir, /wc\.session\.setUserAgent\(ua, IDIOMAS\)/)
})
