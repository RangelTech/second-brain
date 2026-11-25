// Comportamento do site: tema, menu no celular, plano -> checkout da Cakto, download por sistema (links reais da última release).
(function () {
  var C = window.BRAIN || {}
  var $ = function (s, r) { return (r || document).querySelector(s) }
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)) }

  // tema: claro, escuro ou o do sistema; lembra a escolha (sem quebrar se o navegador bloquear o armazenamento)
  var tema = $('#tema')
  if (tema) tema.addEventListener('click', function () {
    var atual = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    var prox = atual === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = prox
    try { localStorage.setItem('tema', prox) } catch (e) {}
  })

  var burger = $('#burger'), menu = $('#menu')
  if (burger && menu) {
    burger.addEventListener('click', function () {
      var aberto = menu.classList.toggle('aberto')
      burger.setAttribute('aria-expanded', aberto ? 'true' : 'false')
    })
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { menu.classList.remove('aberto'); burger.setAttribute('aria-expanded', 'false') }) })
  }

  // planos: mensal ou anual (anual = 10 meses pagos, 2 de graça, em até 12x no cartão). Sem link do checkout o botão fica "Em breve";
  // com link, o botão abre o modal que oferece a máquina virtual
  var modal = $('#modal-plano')
  var ultimoFoco = null
  var ciclo = 'anual'  // o anual já abre selecionado
  var MESES = C.mesesAnual || 10
  function num(n) {
    var cent = Math.abs(n - Math.round(n)) > 0.004
    return n.toLocaleString('pt-BR', { minimumFractionDigits: cent ? 2 : 0, maximumFractionDigits: cent ? 2 : 0 })
  }
  function brl(n) { return 'R$ ' + num(n) }
  function checkoutDe(id) { return ((ciclo === 'anual' ? C.checkoutAnual : C.checkout) || {})[id] }
  function checkoutVmDe(id) { return ((ciclo === 'anual' ? C.checkoutVmAnual : C.checkoutVm) || {})[id] }
  // ---- cupom de afiliado: o servidor devolve, por produto, o preço e o link do afiliado; só vale nos produtos que têm link
  var cupomAtual = null
  var API = (C.api || '').replace(/\/+$/, '')
  function chaveProduto(id, vm) { return (id === 'vm' ? 'vm' : id === 'light' ? 'lite' : id) + '_' + ciclo + (vm && id !== 'vm' ? '_vm' : '') }
  function cupomDe(id, vm) { return cupomAtual && cupomAtual.produtos && cupomAtual.produtos[chaveProduto(id, vm)] || null }
  function destino(id, vm) {  // o botão de compra: /assinar (com a chave do produto e o cupom) ou, sem checkout próprio, o link da Cakto
    var normal = vm ? (checkoutVmDe(id) || checkoutDe(id)) : checkoutDe(id)
    if (!normal) return ''
    if (!C.checkoutProprio) { var cp = cupomDe(id, vm); return (cp && cp.url) || normal }
    return '/assinar/?produto=' + chaveProduto(id, vm) + (cupomAtual ? '&cupom=' + encodeURIComponent(cupomAtual.cupom) : '')
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
  function cupomHtml(id, mensal) {
    if (!cupomAtual) return ''
    var cp = cupomDe(id, false)
    if (!cp) return '<span class="cupom-nao">O cupom de ' + esc(cupomAtual.afiliado) + ' não vale para este plano.</span>'
    var normal = cp.preco_normal || mensal * (ciclo === 'anual' ? MESES : 1)
    return 'Cupom de <b>' + esc(cupomAtual.afiliado) + '</b>: <s>' + brl(normal) + '</s> <b>' + brl(cp.preco) + '</b>' + (cp.percentual ? ' <span class="selo">-' + cp.percentual + '%</span>' : '') + '<br><span class="legal">' + (ciclo === 'anual' ? 'por ano' : 'por mês') + '</span>'
  }
  function precos(mensal) {  // mensal: preço do mês cheio; no anual o cliente paga MESES vezes e o equivalente mensal é anual / 12
    var anual = mensal * MESES
    return { mensal: mensal, anual: anual, equiv: anual / 12, economia: mensal * 12 - anual }
  }
  // preço grande com os centavos pequenos em cima: R$ 205,83 -> "R$ 205" + ",83"
  function precoGrande(n) {
    var inteiro = Math.floor(n + 1e-9)
    var cent = Math.round((n - inteiro) * 100)
    return 'R$ ' + inteiro.toLocaleString('pt-BR') + (cent ? '<sup>,' + String(cent).padStart(2, '0') + '</sup>' : '')
  }
  function descontoPct(mensal) { var q = precos(mensal); return Math.round(100 * q.economia / (q.mensal * 12)) }
  function precoHtml(mensal) {
    var q = precos(mensal)
    if (ciclo === 'anual') {
      return '<span class="rev"><s>' + brl(q.mensal) + '</s><span class="selo">-' + descontoPct(mensal) + '%</span></span>' +
        '<span class="gr">' + precoGrande(q.equiv) + '<small class="eq">/mês</small></span><span class="noanual">no plano anual</span>'
    }
    return '<span class="gr">' + precoGrande(q.mensal) + '<small class="eq">/mês</small></span>'
  }
  function infoHtml(mensal) {
    var q = precos(mensal)
    if (ciclo === 'anual') {
      return '<span class="eco">Economize ' + brl(q.economia) + '</span><br><span class="legal">Cobrado anualmente: ' + brl(q.anual) + ' por ano, em até 12x no cartão.</span>'
    }
    return '<button type="button" class="link-anual" data-ir-anual>Assine o anual e pague menos</button><br><span class="legal">Cobrado todo mês no cartão de crédito.</span>'
  }
  function pintarCard(card) {
    var p = card.querySelector('.p')
    if (!p) return
    if (!card.dataset.mensal) card.dataset.mensal = String(parseInt((p.textContent || '').replace(/\D/g, ''), 10) || 0)
    var mensal = +card.dataset.mensal
    var info = card.querySelector('.anual-info')
    if (!info) { info = document.createElement('p'); info.className = 'anual-info'; p.insertAdjacentElement('afterend', info) }
    p.classList.add('mkt')
    p.innerHTML = precoHtml(mensal)
    info.innerHTML = infoHtml(mensal)
    info.hidden = false
    var linha = card.querySelector('.cupom-linha')
    if (!linha) { linha = document.createElement('p'); linha.className = 'cupom-linha'; info.insertAdjacentElement('afterend', linha) }
    var a = card.querySelector('[data-plano]')
    var h = a ? cupomHtml(a.dataset.plano, mensal) : ''
    linha.innerHTML = h; linha.hidden = !h
  }
  function aplicarCiclo() {
    $$('[data-plano]').forEach(function (a) {
      var url = destino(a.dataset.plano, false)
      if (!url) return
      a.href = url
      pintarCard(a.closest('.plano'))
    })
    $$('.alterna button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.ciclo === ciclo ? 'true' : 'false') })
    var np = $('#nota-planos')
    if (np) np.textContent = ciclo === 'anual'
      ? 'No anual você paga 10 meses e usa 12: são 2 meses de graça, cobrados anualmente, em até 12x no cartão de crédito. Cancele pela Cakto quando quiser; o acesso vale até o fim do período pago.'
      : 'Sem fidelidade: cancele pela Cakto quando quiser, e o acesso vale até o fim do mês pago. Pagamento por cartão de crédito. Assine o anual e leve 2 meses de graça.'
    var nv = $('#nota-vm')
    if (nv) nv.textContent = ciclo === 'anual'
      ? 'Para concessionárias, clínicas, agências e escritórios que não querem instalar nada. No anual são 2 meses de graça, cobrados anualmente, em até 12x no cartão de crédito.'
      : 'Para concessionárias, clínicas, agências e escritórios que não querem instalar nada. Pagamento por cartão de crédito. No anual você ganha 2 meses de graça.'
  }
  function fecharModal() {
    if (!modal || modal.hidden) return
    modal.hidden = true
    document.body.classList.remove('modal-aberto')
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus()
  }
  function pintarModal(botao) {
    var id = botao.dataset.plano
    var card = botao.closest('.plano')
    var mensal = +card.dataset.mensal
    var vm = C.precoVm || 399
    var cheio = mensal + vm
    var q = precos(mensal)
    $('#mp-titulo').textContent = card.querySelector('h3').textContent + (ciclo === 'anual' ? ' anual' : '')
    $('#mp-preco').className = 'p mkt'
    $('#mp-preco').innerHTML = precoHtml(mensal)
    var info = $('#mp-anual')
    if (info) { info.hidden = false; info.innerHTML = infoHtml(mensal) }
    var soma = $('#mp-soma')
    if (ciclo === 'anual') {
      var qc = precos(cheio)
      soma.innerHTML = '<b>+ ' + brl(vm * MESES / 12) + '</b> por mês no anual (de <s>' + brl(vm) + '</s>). Total: <b>' + brl(qc.equiv) + '</b> por mês. <span class="legal">Cobrado anualmente: ' + brl(qc.anual) + ' por ano, em até 12x no cartão. Você economiza ' + brl(qc.economia) + '.</span>'
    } else {
      soma.innerHTML = '<b>+ ' + brl(vm) + '</b> por mês, somados ao plano. Total: <b>' + brl(cheio) + '</b> por mês. <span class="legal">Cobrado todo mês no cartão de crédito.</span>'
    }
    var sim = $('#mp-sim'), nao = $('#mp-nao')
    sim.href = destino(id, true)
    nao.href = destino(id, false)
    var mc = $('#mp-cupom')
    if (mc) {
      var so = cupomDe(id, false), com = cupomDe(id, true)
      var html = ''
      var porCiclo = ciclo === 'anual' ? ' por ano' : ' por mês'
      if (cupomAtual) {
        html = so || com ? 'Cupom de <b>' + esc(cupomAtual.afiliado) + '</b>:' : '<span class="cupom-nao">O cupom de ' + esc(cupomAtual.afiliado) + ' não vale para este plano.</span>'
        if (so) html += '<br>Só o plano: <s>' + brl(so.preco_normal || mensal * (ciclo === 'anual' ? MESES : 1)) + '</s> <b>' + brl(so.preco) + '</b>' + (so.percentual ? ' (-' + so.percentual + '%)' : '') + porCiclo
        if (com) html += '<br>Com a máquina virtual: <s>' + brl(com.preco_normal || cheio * (ciclo === 'anual' ? MESES : 1)) + '</s> <b>' + brl(com.preco) + '</b>' + (com.percentual ? ' (-' + com.percentual + '%)' : '') + porCiclo
      }
      mc.innerHTML = html; mc.hidden = !html
    }
    $$('.alterna button', modal).forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.ciclo === ciclo ? 'true' : 'false') })
  }
  function abrirModal(botao) {
    var card = botao.closest('.plano')
    var lista = $('#mp-lista')
    $('#mp-lista').innerHTML = ''
    $$('li', card).forEach(function (li) { var n = document.createElement('li'); n.textContent = li.textContent; lista.appendChild(n) })
    ultimoFoco = botao
    modal._botao = botao
    pintarModal(botao)
    modal.hidden = false
    document.body.classList.add('modal-aberto')
    $('#mp-nao').focus({ preventScroll: true })
    var caixa = $('.modal-caixa'); if (caixa) caixa.scrollTop = 0
  }
  $$('[data-plano]').forEach(function (a) {
    var id = a.dataset.plano
    if (!(C.checkout || {})[id]) { a.setAttribute('aria-disabled', 'true'); a.removeAttribute('href'); a.textContent = 'Em breve'; return }
    a.href = destino(id, false); a.rel = 'noopener'  // sem o modal o botão ainda leva ao checkout do plano
    if (modal && id !== 'vm' && (C.checkoutVm || {})[id]) a.addEventListener('click', function (e) { e.preventDefault(); abrirModal(a) })
  })
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-ir-anual]')
    if (!t) return
    ciclo = 'anual'
    aplicarCiclo()
    if (modal && !modal.hidden && modal._botao) pintarModal(modal._botao)
  })
  $$('.alterna button').forEach(function (b) {
    b.addEventListener('click', function () {
      ciclo = b.dataset.ciclo
      aplicarCiclo()
      if (modal && !modal.hidden && modal._botao) pintarModal(modal._botao)
    })
  })
  if (modal) {
    modal.addEventListener('click', function (e) { if (e.target === modal || e.target.hasAttribute('data-fechar')) fecharModal() })
    document.addEventListener('keydown', function (e) {
      if (modal.hidden) return
      if (e.key === 'Escape') fecharModal()
      if (e.key === 'Tab') {  // mantém o foco dentro do modal
        var f = $$('a[href], button', modal).filter(function (x) { return x.offsetParent !== null })
        if (!f.length) return
        var ini = f[0], fim = f[f.length - 1]
        if (e.shiftKey && document.activeElement === ini) { e.preventDefault(); fim.focus() }
        else if (!e.shiftKey && document.activeElement === fim) { e.preventDefault(); ini.focus() }
      }
    })
  }
  // ---- cupom: campo, ?cupom= na URL e o último cupom lembrado no navegador
  var cBloco = $('#cupom-bloco'), cForm = $('#cupom-form'), cMsg = $('#cupom-msg'), cCampo = $('#cupom-campo')
  function mostrarMsg(t, ok) { if (!cMsg) return; cMsg.textContent = t || ''; cMsg.hidden = !t; cMsg.classList.toggle('ok', !!ok) }
  function repintarTudo() { aplicarCiclo(); if (modal && !modal.hidden && modal._botao) pintarModal(modal._botao) }
  function usarCupom(codigo, manual) {
    codigo = String(codigo || '').trim()
    if (!codigo || !API || !window.fetch) return
    fetch(API + '/v1/cupom/' + encodeURIComponent(codigo)).then(function (r) { return r.json() }).then(function (j) {
      if (j && j.ok) {
        cupomAtual = j
        try { localStorage.setItem('cupom', j.cupom) } catch (e) {}
        mostrarMsg('Você ganhou ' + (j.percentual ? j.percentual + '% de desconto' : 'desconto') + ' usando o cupom de ' + j.afiliado + '. O preço já aparece nos planos que o cupom cobre.', true)
        if (cForm) cForm.hidden = true
      } else {
        cupomAtual = null
        try { localStorage.removeItem('cupom') } catch (e) {}
        if (manual) mostrarMsg((j && j.mensagem) || 'Cupom não encontrado.', false)
      }
      repintarTudo()
    }).catch(function () { if (manual) mostrarMsg('Não consegui conferir o cupom agora. Tente de novo.', false) })
  }
  var abrirCupom = $('#cupom-abrir')
  if (abrirCupom && cForm) {
    abrirCupom.addEventListener('click', function () { cForm.hidden = !cForm.hidden; if (!cForm.hidden && cCampo) cCampo.focus() })
    cForm.addEventListener('submit', function (e) { e.preventDefault(); usarCupom(cCampo.value, true) })
  }
  var doLink = new URLSearchParams(location.search).get('cupom')
  var salvo = ''
  try { salvo = localStorage.getItem('cupom') || '' } catch (e) {}
  if (doLink || salvo) {
    if (doLink && cCampo) cCampo.value = doLink
    usarCupom(doLink || salvo, !!doLink)
    if (doLink && cBloco) setTimeout(function () { var p = $('#planos'); if (p && p.scrollIntoView) p.scrollIntoView({ behavior: 'smooth' }) }, 500)
  }
  aplicarCiclo()
  var web = $('[data-web]')
  if (web && C.web) web.href = C.web

  // sistema do visitante
  var ua = (navigator.userAgentData && navigator.userAgentData.platform || navigator.platform || '') + ' ' + navigator.userAgent
  var os = /Win/i.test(ua) ? 'win' : /Mac/i.test(ua) && !/iPhone|iPad/i.test(ua) ? 'mac' : /Linux|X11/i.test(ua) && !/Android/i.test(ua) ? 'linux' : ''
  var nomes = { win: 'Windows', mac: 'macOS', linux: 'Linux' }
  if (os) {
    var card = $('.down[data-os="' + os + '"]')
    if (card) card.classList.add('sug')
    var g = $('[data-baixar-grande]')
    if (g) g.textContent = 'Baixar para ' + nomes[os]
  }

  // links diretos da última release (a API do GitHub aceita chamada do navegador); se falhar, ficam na página de releases
  // Versão e links vêm do nosso servidor (que não depende da API do GitHub e guarda a última versão boa). Se falhar, ficam os links fixos do HTML.
  if (C.api && window.fetch) {
    fetch(C.api.replace(/\/+$/, '') + '/v1/app/latest')
      .then(function (r) { return r.ok ? r.json() : Promise.reject() })
      .then(function (rel) {
        $$('[data-asset]').forEach(function (a) { var u = rel.assets && rel.assets[a.dataset.asset]; if (u) a.href = u })
        var v = $('#versao')
        if (v && rel.version) v.innerHTML = 'Versão atual: <b>' + rel.version + '</b>. Todas as versões em <a href="https://github.com/' + C.repo + '/releases">GitHub</a>.'
      })
      .catch(function () {})
  }
})()
