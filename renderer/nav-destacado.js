// Barra da janela destacada do navegador (Spec 25): mesmos controles do painel, numa janela própria. A página em si é a vista nativa que o app encaixa abaixo da barra.
;(() => {
  const sb = window.criarSb(window.__sbRaw.invoke, window.__sbRaw.on, {})
  const N = sb.navegador
  const $ = (i) => document.getElementById(i)
  $('voltar').onclick = () => N.acao('voltar')
  $('avancar').onclick = () => N.acao('avancar')
  $('recarregar').onclick = () => N.acao('recarregar')
  $('reencaixar').onclick = () => N.reencaixar()
  $('form').onsubmit = (e) => {
    e.preventDefault()
    const v = $('url').value.trim()
    if (v) N.acao('ir', v)
  }
  const pintar = (e) => {
    if (!e) return
    $('voltar').disabled = !e.podeVoltar
    $('avancar').disabled = !e.podeAvancar
    if (document.activeElement !== $('url')) $('url').value = e.url || ''
    $('agente').classList.toggle('on', !!e.controlando)
    if (e.titulo) document.title = e.titulo + ' · Navegador do Segundo Cérebro'
  }
  N.aoEstado(pintar)
  N.estado().then(pintar).catch(() => {})
})()
