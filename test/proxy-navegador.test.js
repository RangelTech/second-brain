// Regra do proxy do navegador (spec 31): só os domínios da lista (e subdomínios) vão pelo proxy
const test = require('node:test')
const assert = require('node:assert')
const vm = require('vm')
const { pacDe } = require('../proxy-navegador')

function rodar(pac, host) {
  const ctx = { dnsDomainIs: (h, d) => h.endsWith(d) }
  vm.runInNewContext(pac, ctx)
  return ctx.FindProxyForURL('https://' + host + '/', host)
}

test('só os domínios da lista e seus subdomínios passam pelo proxy', () => {
  const pac = pacDe('http://u:s@br.exemplo:8000', ['instagram.com', 'fbcdn.net'])
  assert.strictEqual(rodar(pac, 'www.instagram.com'), 'PROXY br.exemplo:8000')
  assert.strictEqual(rodar(pac, 'instagram.com'), 'PROXY br.exemplo:8000')
  assert.strictEqual(rodar(pac, 'scontent.xx.fbcdn.net'), 'PROXY br.exemplo:8000')
  assert.strictEqual(rodar(pac, 'google.com'), 'DIRECT')
  assert.strictEqual(rodar(pac, 'notinstagram.com'), 'DIRECT')
  assert.ok(!pac.includes('u:s'), 'a senha nunca vai para o script de rota')
})

test('socks5 vira SOCKS5', () => {
  assert.strictEqual(rodar(pacDe('socks5://br.exemplo:1080', ['tiktok.com']), 'm.tiktok.com'), 'SOCKS5 br.exemplo:1080')
})
