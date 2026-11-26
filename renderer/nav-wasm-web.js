// Navegador WebAssembly no painel da versão web (spec 60 §8). O motor (Gecko em WebAssembly) roda num quadro de nav.rangeltech.net
// DENTRO desta aba: a pessoa vê e mexe na página de verdade, e a IA controla pelas mesmas ferramentas navegador_* (a VM manda o
// pedido pela ponte, este arquivo repassa ao quadro e devolve o resultado). Só existe na versão web; o app instalado usa a vista nativa.
;(function () {
  if (!window.__sbWeb) return
  var NAV_ORIGEM = 'https://nav.rangeltech.net'
  var sb = window.__sbRaw
  // precisa de isolamento entre origens (SharedArrayBuffer). Celular fica no modo antigo: o motor é pesado demais para ele.
  var suportado = !!window.crossOriginIsolated && typeof SharedArrayBuffer === 'function' && !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
  var aba = 'a' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
  var quadro = null
  var pronto = false
  var falhou = ''
  var pend = {}
  var seq = 0
  var ouvintes = { url: [], ligar: [], estado: [] }
  var olaTimer = 0

  function avisar(tipo, dados) { (ouvintes[tipo] || []).forEach(function (fn) { try { fn(dados) } catch (_) {} }) }
  function registrar() {
    if (!suportado || !sb) return
    sb.invoke('navwasm:registrar', { aba: aba, capaz: true, pronto: pronto }).catch(function () {})
  }
  if (suportado) {
    registrar()
    setInterval(registrar, 15000)
    addEventListener('pagehide', function () { try { sb.invoke('navwasm:registrar', { aba: aba, capaz: false, pronto: false }) } catch (_) {} })
  }

  function passe() {
    return fetch('/api/nav-passe', { method: 'POST', credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : {} })
      .then(function (j) { return (j && j.t) || '' })
      .catch(function () { return '' })
  }
  function postar(m) {
    try { if (quadro && quadro.contentWindow) quadro.contentWindow.postMessage(Object.assign({ sbNav: 1 }, m), NAV_ORIGEM) } catch (_) {}
  }
  // o quadro só fala com quem se apresentou: insiste até ele responder que está pronto
  function insistirOla() {
    clearInterval(olaTimer)
    olaTimer = setInterval(function () { if (pronto || falhou) return clearInterval(olaTimer); postar({ ola: 1 }) }, 700)
    postar({ ola: 1 })
  }

  function montar(host, inicio) {
    if (quadro) {
      if (quadro.parentNode !== host) host.appendChild(quadro)
      return Promise.resolve(quadro)
    }
    falhou = ''
    quadro = document.createElement('iframe')
    quadro.title = 'Navegador'
    quadro.allow = 'cross-origin-isolated; clipboard-read; clipboard-write; autoplay; fullscreen'
    quadro.style.cssText = 'border:0;width:100%;height:100%;display:block;background:#fff'
    host.appendChild(quadro)
    return passe().then(function (t) {
      quadro.src = NAV_ORIGEM + '/?embutido=1&t=' + encodeURIComponent(t) + '&inicio=' + encodeURIComponent(inicio || 'https://www.google.com/')
      quadro.addEventListener('load', insistirOla)
      return quadro
    })
  }

  addEventListener('message', function (e) {
    if (e.origin !== NAV_ORIGEM || !e.data || e.data.sbNav !== 1) return
    var m = e.data
    if (m.ev === 'pronto' || (m.ev === 'estado' && m.pronto)) {
      if (!pronto) { pronto = true; registrar(); avisar('estado', { pronto: true, segundos: m.segundos }) }
      if (m.url) avisar('url', { url: m.url })
      return
    }
    if (m.ev === 'url') return avisar('url', { url: m.url, titulo: m.titulo })
    if (m.ev === 'falhou') { falhou = m.erro || 'falhou'; avisar('estado', { pronto: false, erro: falhou }); return }
    if (m.id && pend[m.id]) {
      var p = pend[m.id]
      delete pend[m.id]
      clearTimeout(p.timer)
      return m.ok ? p.ok(m.valor) : p.erro(new Error(m.erro || 'Falhou.'))
    }
  })

  // YouTube barra o IP de servidor do relay ("confirme que não é um robô"). Vídeo do YouTube abre no player oficial, rodando no
  // próprio Chrome da pessoa (IP dela), por cima do motor. Qualquer outra página fecha o player.
  var video = null // { url, id, el }
  function idYoutube(u) {
    try {
      var x = new URL(String(u || ''))
      var h = x.hostname.replace(/^(www|m|music)\./, '')
      if (h === 'youtu.be') return x.pathname.slice(1).split('/')[0] || ''
      if (h !== 'youtube.com') return ''
      if (x.pathname === '/watch') return x.searchParams.get('v') || ''
      var m = /^\/(shorts|embed|live)\/([\w-]{6,})/.exec(x.pathname)
      return m ? m[2] : ''
    } catch (_) { return '' }
  }
  function mostrarVideo(id, url) {
    fecharVideo()
    var host = quadro && quadro.parentNode
    if (!host) return
    var el = document.createElement('div')
    el.style.cssText = 'position:absolute;inset:0;background:#000;z-index:3;display:flex;flex-direction:column'
    var f = document.createElement('iframe')
    f.src = 'https://www.youtube.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0&modestbranding=1&playsinline=1'
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'
    f.allowFullscreen = true
    f.referrerPolicy = 'strict-origin-when-cross-origin'
    f.setAttribute('credentialless', '')
    f.style.cssText = 'border:0;flex:1;width:100%'
    var b = document.createElement('button')
    b.type = 'button'
    b.textContent = 'Fechar vídeo'
    b.style.cssText = 'position:absolute;top:10px;right:10px;z-index:4;border:0;border-radius:999px;padding:6px 14px;background:rgba(20,16,12,.85);color:#f3ece4;font:13px system-ui,sans-serif;cursor:pointer'
    b.onclick = fecharVideo
    el.appendChild(f)
    el.appendChild(b)
    host.appendChild(el)
    video = { id: id, url: url, el: el }
    avisar('url', { url: url, titulo: 'YouTube' })
  }
  function fecharVideo() {
    if (video && video.el.parentNode) video.el.parentNode.removeChild(video.el)
    video = null
  }
  function comandoComVideo(metodo, args, ms) {
    if (metodo === 'abrir') {
      var id = idYoutube(args && args[0])
      if (id) { mostrarVideo(id, String(args[0])); return Promise.resolve('ok') }
      fecharVideo()
    }
    if (video) {
      if (metodo === 'info') return Promise.resolve({ url: video.url, titulo: 'Vídeo do YouTube tocando no painel' })
      if (metodo === 'avaliar' && /data-sb-id/.test(String(args && args[0])) && /elementos/.test(String(args && args[0]))) {
        return Promise.resolve({ titulo: 'Vídeo do YouTube tocando no painel', url: video.url, texto: 'O vídeo está tocando no player do YouTube, no painel do navegador ao lado do chat. A pessoa controla o play, a pausa e a tela cheia no próprio player.', elementos: [], rolagem: { y: 0, altura: 0, janela: 0 } })
      }
      if (metodo === 'voltar') { fecharVideo(); return Promise.resolve('ok') }
      if (metodo === 'avaliar' || metodo === 'clicarPonto' || metodo === 'inserir' || metodo === 'tecla' || metodo === 'printPng') {
        return Promise.reject(new Error('O painel está mostrando um vídeo do YouTube (player oficial). Para mexer em outra página, abra o endereço dela.'))
      }
    }
    return comando(metodo, args, ms)
  }

  function comando(metodo, args, ms) {
    return new Promise(function (ok, erro) {
      if (!quadro || !pronto) return erro(new Error('O navegador da página ainda está abrindo.'))
      var id = 'c' + (++seq)
      pend[id] = { ok: ok, erro: erro, timer: setTimeout(function () { delete pend[id]; erro(new Error('O navegador da página não respondeu a tempo.')) }, ms || 60000) }
      postar({ id: id, metodo: metodo, args: args || [] })
    })
  }

  if (sb) {
    sb.on('navwasm:ligar', function (d) { if (d && d.aba && d.aba !== aba) return; avisar('ligar', {}) })
    sb.on('navwasm:pedido', function (d) {
      if (!d || d.aba !== aba) return
      comandoComVideo(d.op, d.args).then(function (v) {
        sb.invoke('navwasm:resposta', { id: d.id, ok: true, valor: v === undefined ? null : v }).catch(function () {})
      }, function (err) {
        sb.invoke('navwasm:resposta', { id: d.id, ok: false, erro: String((err && err.message) || err) }).catch(function () {})
      })
    })
  }

  window.SBNavWasm = {
    suportado: suportado,
    montar: montar,
    aquecer: function (host) { if (!quadro && host) montar(host) },
    comando: comandoComVideo,
    pronto: function () { return pronto },
    erro: function () { return falhou },
    on: function (tipo, fn) { (ouvintes[tipo] = ouvintes[tipo] || []).push(fn) },
  }
})()
