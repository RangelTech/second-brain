'use strict'
const test = require('node:test')
const assert = require('node:assert')
const { EventEmitter } = require('node:events')
const { capturar, ehRetorno } = require('../oauth-janela')

function falsaJanela() {
  const criadas = []
  class W extends EventEmitter {
    constructor(op) {
      super()
      this.op = op
      this.destruida = false
      this.webContents = Object.assign(new EventEmitter(), { setUserAgent: (ua) => (this.ua = ua), setWindowOpenHandler: (fn) => (this.abrir = fn), loadURL: (u) => (this.carregou = u) })
      criadas.push(this)
    }
    loadURL(u) {
      this.url = u
      return Promise.resolve()
    }
    isDestroyed() {
      return this.destruida
    }
    close() {
      this.destruida = true
      this.emit('closed')
    }
  }
  return { W, criadas }
}

const RET = 'http://localhost:8080/callback'

test('reconhece o endereço de retorno (localhost e 127.0.0.1, com ou sem barra)', () => {
  assert.ok(ehRetorno('http://localhost:8080/callback?code=x', RET))
  assert.ok(ehRetorno('http://127.0.0.1:8080/callback/?code=x', RET))
  assert.ok(!ehRetorno('http://localhost:8081/callback?code=x', RET))
  assert.ok(!ehRetorno('https://claude.ai/callback?code=x', RET))
  assert.ok(!ehRetorno('lixo', RET))
})

test('pega o código no redirecionamento e fecha a janela', async () => {
  const { W, criadas } = falsaJanela()
  const p = capturar({ BrowserWindow: W, url: 'https://auth.exemplo/authorize', retorno: RET, userAgent: 'UA' })
  const w = criadas[0]
  assert.strictEqual(w.url, 'https://auth.exemplo/authorize')
  assert.strictEqual(w.ua, 'UA')
  let cancelou = false
  w.webContents.emit('will-redirect', { preventDefault: () => (cancelou = true) }, 'http://localhost:8080/callback?code=ABC&state=S1')
  const r = await p
  assert.deepStrictEqual([r.code, r.state], ['ABC', 'S1'])
  assert.ok(cancelou && w.destruida)
})

test('mesmo com a página de erro (did-fail-load) o código é capturado', async () => {
  const { W, criadas } = falsaJanela()
  const p = capturar({ BrowserWindow: W, url: 'https://auth.exemplo/a', retorno: RET })
  criadas[0].webContents.emit('did-fail-load', {}, -102, 'ERR_CONNECTION_REFUSED', 'http://localhost:8080/callback?code=XYZ')
  assert.strictEqual((await p).code, 'XYZ')
})

test('fechar a janela antes de terminar rejeita com "fechada"', async () => {
  const { W, criadas } = falsaJanela()
  const p = capturar({ BrowserWindow: W, url: 'https://auth.exemplo/a', retorno: RET })
  criadas[0].close()
  await assert.rejects(p, /fechada/)
})

test('retorno com erro do provedor rejeita com a mensagem dele', async () => {
  const { W, criadas } = falsaJanela()
  const p = capturar({ BrowserWindow: W, url: 'https://auth.exemplo/a', retorno: RET })
  criadas[0].webContents.emit('will-navigate', {}, 'http://localhost:8080/callback?error=access_denied')
  await assert.rejects(p, /access_denied/)
})

test('pop-up (window.open) fica na mesma janela', async () => {
  const { W, criadas } = falsaJanela()
  const p = capturar({ BrowserWindow: W, url: 'https://auth.exemplo/a', retorno: RET })
  const w = criadas[0]
  assert.deepStrictEqual(w.abrir({ url: 'https://accounts.google.com/x' }), { action: 'deny' })
  assert.strictEqual(w.carregou, 'https://accounts.google.com/x')
  w.abrir({ url: 'http://localhost:8080/callback?code=P' })
  assert.strictEqual((await p).code, 'P')
})
