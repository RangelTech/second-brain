// Plano Free do Cérebro Pro: cadastro, código por e-mail, chat e, quando o uso de demonstração acaba, a tela de planos.
// Fala só com a API pública /v1/free/* (sem chave de API). O servidor conta e recusa com 402; a tela NÃO mostra contador nem número de perguntas.
(function () {
  var API = ((window.BRAIN && window.BRAIN.api) || 'https://qwen.rangeltech.net').replace(/\/+$/, '')
  var $ = function (id) { return document.getElementById(id) }
  var CH = 'sbfree'
  var sessao = null // { token, email, nome }
  var historico = [] // { role, content }
  var ocupado = false
  var modo = 'criar'

  function guardar() { try { if (sessao) localStorage.setItem(CH, JSON.stringify(sessao)); else localStorage.removeItem(CH) } catch (e) {} }
  function ler() { try { return JSON.parse(localStorage.getItem(CH) || 'null') } catch (e) { return null } }
  function tela(qual) { ['t-auth', 't-cod', 't-chat'].forEach(function (id) { $(id).hidden = id !== qual }) }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }

  function api(rota, corpo, token) {
    var h = { 'Content-Type': 'application/json' }
    if (token) h.Authorization = 'Bearer ' + token
    return fetch(API + rota, { method: corpo === undefined ? 'GET' : 'POST', headers: h, body: corpo === undefined ? undefined : JSON.stringify(corpo) })
  }
  function msgErro(j, padrao) { return (j && j.error && j.error.message) || padrao || 'Algo deu errado. Tente de novo.' }
  function codErro(j) { return j && j.error && j.error.code }

  // ---------- cadastro / entrar ----------
  function aba(m) {
    modo = m
    $('aba-criar').setAttribute('aria-selected', m === 'criar')
    $('aba-entrar').setAttribute('aria-selected', m === 'entrar')
    $('c-nome').hidden = m !== 'criar'
    $('c-aceite').hidden = m !== 'criar'
    $('dica-senha').hidden = m !== 'criar'
    $('senha').autocomplete = m === 'criar' ? 'new-password' : 'current-password'
    $('b-auth').textContent = m === 'criar' ? 'Criar conta e começar' : 'Entrar'
    $('e-auth').textContent = ''
  }
  $('aba-criar').onclick = function () { aba('criar') }
  $('aba-entrar').onclick = function () { aba('entrar') }

  $('f-auth').addEventListener('submit', function (e) {
    e.preventDefault()
    var email = $('email').value.trim(), senha = $('senha').value, nome = $('nome').value.trim()
    var erro = $('e-auth'); erro.textContent = ''
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return (erro.textContent = 'Informe um e-mail válido.')
    if (senha.length < 8) return (erro.textContent = 'A senha precisa de pelo menos 8 caracteres.')
    if (modo === 'criar' && !$('aceite').checked) return (erro.textContent = 'Para continuar, marque que leu e aceita os Termos de uso.')
    var b = $('b-auth'); b.disabled = true
    var req = modo === 'criar'
      ? api('/v1/free/signup', { email: email, password: senha, name: nome, website: $('website').value, aceite_termos: true, termos_versao: (window.BRAIN || {}).termosVersao })
      : api('/v1/free/login', { email: email, password: senha })
    req.then(function (r) { return r.json().catch(function () { return {} }).then(function (j) { return { s: r.status, j: j } }) })
      .then(function (r) {
        b.disabled = false
        if (modo === 'criar' && r.s === 200) { sessao = { email: email, nome: nome }; return pedirCodigo(email) }
        if (modo === 'criar' && r.s === 409 && codErro(r.j) === 'terms_outdated') return ($('e-auth').textContent = 'Os termos foram atualizados. Recarregue a página e leia de novo.')
        if (modo === 'criar' && r.s === 409) { aba('entrar'); return ($('e-auth').textContent = 'Este e-mail já tem cadastro. Entre com a sua senha.') }
        if (modo === 'entrar' && r.s === 403 && codErro(r.j) === 'need_code') return pedirCodigo(email)
        if (r.s === 200 && r.j.paid) return ($('e-auth').textContent = r.j.message)
        if (r.s === 200 && r.j.token) return entrou({ token: r.j.token, email: email, nome: nome }, r.j)
        $('e-auth').textContent = msgErro(r.j)
      })
      .catch(function () { b.disabled = false; $('e-auth').textContent = 'Sem conexão com o servidor. Tente de novo.' })
  })

  // ---------- código ----------
  function pedirCodigo(email) { $('cod-email').textContent = email; $('codigo').value = ''; $('e-cod').textContent = ''; tela('t-cod'); $('codigo').focus() }
  $('f-cod').addEventListener('submit', function (e) {
    e.preventDefault()
    var email = $('cod-email').textContent, code = $('codigo').value.replace(/\D/g, '')
    if (code.length !== 6) return ($('e-cod').textContent = 'Digite os 6 números do código.')
    api('/v1/free/verify', { email: email, code: code }).then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j } }) })
      .then(function (r) { if (r.s === 200) entrou({ token: r.j.token, email: email, nome: (sessao && sessao.nome) || '' }, r.j); else $('e-cod').textContent = msgErro(r.j) })
      .catch(function () { $('e-cod').textContent = 'Sem conexão com o servidor. Tente de novo.' })
  })
  $('b-reenviar').onclick = function () { api('/v1/free/resend', { email: $('cod-email').textContent }); $('e-cod').textContent = 'Enviamos um novo código.' }
  $('b-voltar').onclick = function () { tela('t-auth') }

  // ---------- chat ----------
  function entrou(s, estado) {
    sessao = s; guardar()
    historico = []
    Array.prototype.forEach.call($('msgs').querySelectorAll('.t-msg'), function (n) { n.remove() })
    $('vazio').hidden = false
    tela('t-chat')
    if (estado && estado.remaining <= 0) acabou()
    else $('pergunta').focus()
  }
  function add(tipo, texto) {
    $('vazio').hidden = true
    var d = document.createElement('div'); d.className = 't-msg ' + tipo
    if (tipo === 'ia') d.innerHTML = fmt(texto); else d.textContent = texto
    $('msgs').appendChild(d); d.scrollIntoView({ block: 'end', behavior: 'smooth' })
    return d
  }
  function fmt(t) { // markdown mínimo: blocos de código, negrito e código em linha (tudo escapado antes)
    var s = esc(t)
    s = s.replace(/```[a-z]*\n?([\s\S]*?)```/g, function (_m, c) { return '<pre><code>' + c + '</code></pre>' })
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    return s
  }

  // Cakto pré-preenche e-mail, nome e telefone pela URL (testado): o botão de compra já leva o e-mail do cadastro
  function comDados(url) {
    if (!sessao || !sessao.email) return url
    var q = 'email=' + encodeURIComponent(sessao.email) + (sessao.nome ? '&name=' + encodeURIComponent(sessao.nome) : '')
    return url + (url.indexOf('?') < 0 ? '?' : '&') + q
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="pay.cakto.com.br"]')
    if (a && $('paywall').contains(a) && a.href.indexOf('email=') < 0) a.href = comDados(a.href)
  }, true)

  function acabou() {
    $('pergunta').disabled = true; $('b-env').disabled = true
    $('f-chat').hidden = true
    $('pw-email').textContent = sessao ? sessao.email : ''
    // o Lite fica visivelmente pior que o Max: o filtro de conteúdo em destaque e o Max marcado como "a IA que você acabou de usar"
    var cards = document.querySelectorAll('#paywall .plano')
    Array.prototype.forEach.call(cards, function (c) {
      var nome = (c.querySelector('h3') || {}).textContent || ''
      if (/^(Lite|Light)$/i.test(nome.trim())) {
        c.classList.add('alerta')
        Array.prototype.forEach.call(c.querySelectorAll('li'), function (li) { if (/filtro/i.test(li.textContent)) li.classList.add('censura') })
      }
      if (/^Max$/i.test(nome.trim())) { var f = c.querySelector('.flag'); if (f) f.textContent = 'A IA que você acabou de usar' }
    })
    $('paywall').hidden = false
    setTimeout(function () { $('paywall').scrollIntoView({ behavior: 'smooth', block: 'start' }) }, 350)
  }

  function enviar(texto) {
    if (ocupado || !texto.trim()) return
    ocupado = true; $('e-chat').textContent = ''
    $('b-env').disabled = true
    historico.push({ role: 'user', content: texto })
    add('eu', texto)
    var bolha = add('ia', ''); bolha.innerHTML = '<span class="t-dig"></span><span class="t-dig"></span><span class="t-dig"></span>'
    var resp = '', fim = null
    fetch(API + '/v1/free/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sessao.token }, body: JSON.stringify({ messages: historico }) })
      .then(function (r) {
        if (r.status === 402) { bolha.remove(); historico.pop(); acabou(); return null }
        if (r.status === 401) { bolha.remove(); historico.pop(); sair(); $('e-auth').textContent = 'Sua sessão expirou. Entre de novo.'; return null }
        if (!r.ok) return r.json().catch(function () { return {} }).then(function (j) { throw new Error(msgErro(j, 'A IA está ocupada. Tente de novo.')) })
        var leitor = r.body.getReader(), dec = new TextDecoder(), buf = ''
        function ler() {
          return leitor.read().then(function (x) {
            if (x.done) return
            buf += dec.decode(x.value, { stream: true })
            var i
            while ((i = buf.indexOf('\n')) >= 0) {
              var l = buf.slice(0, i).trim(); buf = buf.slice(i + 1)
              if (l.indexOf('data:') !== 0 || l.indexOf('[DONE]') >= 0) continue
              var j
              try { j = JSON.parse(l.slice(5)) } catch (er) { continue }
              var c = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content
              if (c) { resp += c; bolha.innerHTML = fmt(resp); bolha.scrollIntoView({ block: 'end' }) }
              if (j.free) fim = j.free
              if (j.error) throw new Error(j.error.message)
            }
            return ler()
          })
        }
        return ler()
      })
      .then(function () {
        if (resp) historico.push({ role: 'assistant', content: resp })
        else if (bolha.isConnected) { bolha.remove(); historico.pop() }
        if (fim && fim.limit_reached) setTimeout(acabou, 900) // deixa ler a última resposta antes da tela de planos
      })
      .catch(function (er) {
        if (bolha.isConnected && !resp) bolha.remove()
        historico.pop()
        $('e-chat').textContent = (er && er.message) || 'Sem conexão. Tente de novo.'
      })
      .then(function () { ocupado = false; if (!$('pergunta').disabled) { $('b-env').disabled = false; $('pergunta').focus() } })
  }

  $('f-chat').addEventListener('submit', function (e) { e.preventDefault(); var t = $('pergunta').value; $('pergunta').value = ''; $('pergunta').style.height = 'auto'; enviar(t) })
  $('pergunta').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('f-chat').requestSubmit() } })
  $('pergunta').addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(180, this.scrollHeight) + 'px' })
  Array.prototype.forEach.call($('sug').querySelectorAll('button'), function (b) { b.onclick = function () { enviar(b.textContent) } })

  function sair() { sessao = null; guardar(); historico = []; $('paywall').hidden = true; $('f-chat').hidden = false; $('pergunta').disabled = false; $('b-env').disabled = false; tela('t-auth') }
  $('b-sair').onclick = sair

  // ---------- partida: já tem sessão? ----------
  aba('criar')
  sessao = ler()
  if (!sessao || !sessao.token) { sessao = null; return tela('t-auth') }
  api('/v1/free/me', undefined, sessao.token).then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j } }) })
    .then(function (r) {
      if (r.s !== 200) return sair()
      if (r.j.paid) { sair(); return ($('e-auth').textContent = 'Você já é assinante: entre pelo aplicativo ou em remoto.rangeltech.net.') }
      entrou(sessao, r.j)
    })
    .catch(function () { tela('t-auth') })
})()
