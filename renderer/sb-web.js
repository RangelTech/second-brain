// Versão web da interface: no lugar do IPC do Electron, as chamadas vão por WebSocket até a ponte, que as repassa ao app
// (computador ou VM). Este arquivo só existe na versão servida pelo túnel; o app instalado usa o preload.
;(function () {
  window.__sbWeb = true
  var partes = location.pathname.split('/') // /m/<id>/
  var maquina = partes[1] === 'm' ? decodeURIComponent(partes[2] || '') : ''
  var ouvintes = {}
  var pendentes = {}
  var seq = 0
  var ws = null
  var tentativas = 0
  var aguarde = []

  // aviso de conexão (nunca mostra erro técnico de API ao cliente)
  var aviso = document.createElement('div')
  aviso.setAttribute('role', 'status')
  aviso.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:99999;background:#2a1f14;color:#f3ece4;border:1px solid #5a4630;border-radius:999px;padding:8px 16px;font:14px system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.5);display:none;max-width:90vw;text-align:center'
  document.addEventListener('DOMContentLoaded', function () {
    document.body.appendChild(aviso)
    // só na versão web: voltar à lista de computadores e sair da conta
    var rodape = document.querySelector('.lateral .rodape')
    if (!rodape) return
    function item(id, rotulo, ir) {
      var b = document.createElement('button')
      b.className = 'item'; b.id = id; b.type = 'button'
      var sp = document.createElement('span'); sp.textContent = rotulo
      b.appendChild(sp); b.onclick = ir; rodape.appendChild(b)
    }
    item('web-trocar', 'Trocar de computador', function () { location.href = '/?lista=1' })
    item('web-sair', 'Sair', function () { fetch('/api/sair', { method: 'POST' }).then(function () { location.href = '/' }) })
  })
  function mostrar(texto) {
    aviso.textContent = texto || ''
    aviso.style.display = texto ? 'block' : 'none'
  }

  function bytes(v) {
    if (v instanceof ArrayBuffer) v = new Uint8Array(v)
    if (ArrayBuffer.isView(v)) {
      var u = new Uint8Array(v.buffer, v.byteOffset, v.byteLength), s = ''
      for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000))
      return { $b64: btoa(s) }
    }
    return v
  }
  function serializar(v) {
    if (Array.isArray(v)) return v.map(serializar)
    var b = bytes(v)
    if (b !== v) return b
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      var o = {}
      Object.keys(v).forEach(function (k) { o[k] = serializar(v[k]) })
      return o
    }
    return v
  }
  function reviver(v) {
    if (Array.isArray(v)) return v.map(reviver)
    if (v && typeof v === 'object') {
      if (typeof v.$b64 === 'string' && Object.keys(v).length === 1) {
        var s = atob(v.$b64), u = new Uint8Array(s.length)
        for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i)
        return u
      }
      var o = {}
      Object.keys(v).forEach(function (k) { o[k] = reviver(v[k]) })
      return o
    }
    return v
  }

  function abrirSocket() {
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    ws = new WebSocket(proto + '//' + location.host + '/ws/web?m=' + encodeURIComponent(maquina))
    ws.onopen = function () {
      tentativas = 0
      mostrar('')
      aguarde.splice(0).forEach(function (m) { ws.send(m) })
    }
    ws.onmessage = function (e) {
      var m
      try { m = JSON.parse(e.data) } catch (_) { return }
      if (m.t === 'estado') return mostrar(m.online === false ? 'Seu computador está desconectado. Reconectando…' : '')
      if (m.t === 'ret') {
        var p = pendentes[m.id]
        if (!p) return
        delete pendentes[m.id]
        return m.ok ? p.ok(reviver(m.valor)) : p.erro(new Error(m.erro || 'Falhou.'))
      }
      if (m.t === 'ev') (ouvintes[m.canal] || []).forEach(function (fn) { try { fn(reviver(m.dados)) } catch (_) {} })
    }
    ws.onclose = function (e) {
      mostrar('Reconectando…')
      Object.keys(pendentes).forEach(function (id) { pendentes[id].erro(new Error('Conexão interrompida.')); delete pendentes[id] })
      tentativas++
      // sessão vencida ou computador fora do ar: volta para a escolha da máquina depois de algumas tentativas
      if (tentativas > 8) return (location.href = '/')
      setTimeout(abrirSocket, Math.min(8000, 700 * tentativas))
    }
  }

  window.__sbRaw = {
    invoke: function (canal) {
      var args = Array.prototype.slice.call(arguments, 1)
      return new Promise(function (ok, erro) {
        var id = ++seq
        pendentes[id] = { ok: ok, erro: erro }
        var msg = JSON.stringify({ t: 'inv', id: id, canal: canal, args: serializar(args) })
        if (ws && ws.readyState === 1) ws.send(msg)
        else aguarde.push(msg)
      })
    },
    on: function (canal, fn) { (ouvintes[canal] = ouvintes[canal] || []).push(fn) },
    caminhoDe: function () { return '' },
    abrirExterno: function (url) { return /^https?:\/\//i.test(url) ? !!window.open(url, '_blank', 'noopener') : false },
  }
  abrirSocket()
})()
