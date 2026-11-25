// Página /assinar: resumo do pedido (com cupom), aceite dos termos e o pagamento da Cakto dentro do nosso site (iframe).
// O servidor guarda a sessão e o aceite; a aprovação chega pelo webhook da Cakto e esta página descobre consultando a sessão.
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica()
  else fabrica(raiz)
})(typeof self !== 'undefined' ? self : this, function (raiz) {
  var NOMES = { lite: 'Lite', max: 'Max', ultra: 'Ultra' }
  var ID_CONFIG = { lite: 'light', max: 'max', ultra: 'ultra' }

  // 'max_anual_vm' -> { plano: 'max', ciclo: 'anual', vm: true }; 'vm_mensal' -> { plano: 'vm', ... }; inválido -> null
  function lerProduto(k) {
    var m = /^(lite|max|ultra|vm)_(mensal|anual)(_vm)?$/.exec(String(k || ''))
    if (!m || (m[1] === 'vm' && m[3])) return null
    return { plano: m[1], ciclo: m[2], vm: !!m[3], chave: k }
  }
  function precoNormal(p, C) {
    var meses = p.ciclo === 'anual' ? (C.mesesAnual || 10) : 1
    var base = p.plano === 'vm' ? 0 : ((C.planos || {})[p.plano] || {}).mensal
    if (p.plano !== 'vm' && !base) return null
    return ((base || 0) + (p.plano === 'vm' || p.vm ? (C.precoVm || 399) : 0)) * meses
  }
  function linkNormal(p, C) {
    var anual = p.ciclo === 'anual'
    if (p.plano === 'vm') return (anual ? (C.checkoutAnual || {}).vm : (C.checkout || {}).vm)
    var id = ID_CONFIG[p.plano]
    var mapa = p.vm ? (anual ? C.checkoutVmAnual : C.checkoutVm) : (anual ? C.checkoutAnual : C.checkout)
    return (mapa || {})[id]
  }
  // monta o endereço do pagamento: callback (o servidor reconhece a compra pelo webhook) + e-mail e nome já preenchidos
  function montarUrl(base, token, email, nome) {
    var u = new URL(base)
    u.searchParams.set('callback', token)
    if (email) u.searchParams.set('email', email)
    if (nome) u.searchParams.set('name', nome)
    return u.toString()
  }
  function brl(n) { return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) }

  var api = { lerProduto: lerProduto, precoNormal: precoNormal, linkNormal: linkNormal, montarUrl: montarUrl }
  if (!raiz || !raiz.document) return api

  var C = raiz.BRAIN || {}, API = (C.api || '').replace(/\/+$/, '')
  var $ = function (i) { return raiz.document.getElementById(i) }
  var q = new URLSearchParams(raiz.location.search)
  var p = lerProduto(q.get('produto'))
  var cupomCodigo = q.get('cupom') || ''
  var cupom = null, sessao = null, tempoVerificar = null

  function erro(t) { var e = $('r-erro'); e.textContent = t; e.hidden = !t }
  function msg(t) { var m = $('m'); m.hidden = !t; m.textContent = t || '' }

  if (!p || !linkNormal(p, C)) {
    erro('Não encontramos esse plano. Escolha o plano de novo na página inicial.')
    $('r-corpo').hidden = true
    return api
  }
  $('r-corpo').hidden = false

  function pintar() {
    var nome = p.plano === 'vm' ? 'Máquina virtual' : 'Plano ' + NOMES[p.plano]
    $('r-plano').innerHTML = '<b>' + nome + '</b>' + (p.vm ? ' + máquina virtual' : '') + ' · ' + (p.ciclo === 'anual' ? 'anual' : 'mensal')
    var normal = precoNormal(p, C)
    var cp = cupom && cupom.produtos && cupom.produtos[p.chave]
    var h = ''
    if (cp) {
      h = (normal ? '<s>' + brl(normal) + '</s> ' : '') + brl(cp.preco) + (cp.percentual ? '<span class="selo">-' + cp.percentual + '%</span>' : '')
      $('r-cupom').hidden = false
      $('r-cupom').textContent = 'Cupom de ' + cupom.afiliado + ' aplicado.'
    } else {
      h = normal ? brl(normal) : ''
      $('r-cupom').hidden = !cupomCodigo || !cupom
      if (cupom && !cp) { $('r-cupom').hidden = false; $('r-cupom').textContent = 'O cupom de ' + cupom.afiliado + ' não vale para este plano; o preço é o normal.' }
    }
    $('r-preco').innerHTML = h
    $('r-ciclo').textContent = p.ciclo === 'anual' ? 'Cobrado uma vez por ano, em até 12x no cartão. Renova sozinho até você cancelar.' : 'Cobrado todo mês no cartão de crédito. Cancele quando quiser.'
  }
  pintar()
  if (cupomCodigo && API) {
    fetch(API + '/v1/cupom/' + encodeURIComponent(cupomCodigo)).then(function (r) { return r.json() }).then(function (j) { if (j && j.ok) { cupom = j; pintar() } }).catch(function () {})
  }
  if (q.get('email')) $('email').value = q.get('email')
  var versao = null
  raiz.BrainTermos.carregar(API, $('caixa')).then(function (t) { versao = t.versao }).catch(function () { $('caixa').innerHTML = 'Não consegui carregar os termos aqui. <a href="/termos-de-uso/" target="_blank" rel="noopener">Leia no site</a>.'; versao = C.termosVersao })

  function aprovado(ja) {
    clearTimeout(tempoVerificar)
    $('pag-vazio').hidden = true; $('pag-quadro').hidden = true; $('pag-ok').hidden = false
    if (ja) $('ok-txt').textContent = 'Sua conta já tem senha. Abra o aplicativo e entre com o seu e-mail.'
    raiz.scrollTo(0, 0)
  }
  function verificar(inicio) {
    fetch(API + '/v1/checkout/' + encodeURIComponent(sessao.token)).then(function (r) { return r.ok ? r.json() : null }).then(function (j) {
      if (j && j.estado === 'pago') return aprovado(j.ja_tem_senha)
      if (Date.now() - inicio < 60 * 60 * 1000) tempoVerificar = setTimeout(function () { verificar(inicio) }, 3000)
    }).catch(function () { tempoVerificar = setTimeout(function () { verificar(inicio) }, 5000) })
  }

  $('f').addEventListener('submit', function (e) {
    e.preventDefault(); msg('')
    var email = $('email').value.trim(), nome = $('nome').value.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return msg('Informe um e-mail válido.')
    if (!$('aceite').checked) return msg('Para continuar, marque que leu e aceita os Termos de uso.')
    var b = $('b'); b.disabled = true; b.textContent = 'Preparando o pagamento…'
    fetch(API + '/v1/checkout/sessao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, nome: nome, produto: p.chave, cupom: cupomCodigo, aceite_termos: true, termos_versao: versao }) })
      .then(function (r) { return r.json().catch(function () { return {} }).then(function (j) { return { ok: r.ok, j: j } }) })
      .then(function (r) {
        if (!r.ok) {
          var c = r.j && r.j.error && r.j.error.code
          msg(c === 'terms_outdated' ? 'Os termos foram atualizados. Recarregue a página e leia de novo.' : c === 'invalid_email' ? 'Informe um e-mail válido.' : c === 'too_many_attempts' ? 'Muitas tentativas. Aguarde alguns minutos.' : 'Não consegui preparar o pagamento agora. Tente de novo em instantes.')
          b.disabled = false; b.textContent = 'Continuar para o pagamento'
          return
        }
        sessao = r.j
        var url = montarUrl(r.j.url_afiliado || linkNormal(p, C), r.j.token, email, nome)
        $('quadro').src = url
        $('abrir-aba').href = url
        $('pag-vazio').hidden = true; $('pag-quadro').hidden = false
        $('f').querySelectorAll('input,button').forEach(function (x) { x.disabled = true })
        b.textContent = 'Pagamento aberto ao lado'
        if (raiz.matchMedia && raiz.matchMedia('(max-width:900px)').matches) $('pag').scrollIntoView({ behavior: 'smooth' })
        verificar(Date.now())
      })
      .catch(function () { msg('Sem conexão com o servidor. Confira a internet e tente de novo.'); b.disabled = false; b.textContent = 'Continuar para o pagamento' })
  })
  return api
})
