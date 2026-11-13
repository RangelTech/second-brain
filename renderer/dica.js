// Tooltip do app (spec 37): troca a dica nativa do sistema (o retângulo amarelado do Windows) por um cartão no estilo do app,
// para TODO elemento com title ou data-dica. O title é movido para data-dica na hora do hover, então quem atualiza o title continua funcionando.
;(() => {
  const el = document.createElement('div')
  el.className = 'sb-dica'
  el.setAttribute('role', 'tooltip')
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(el))
  let alvo = null
  let timer = null
  const esconder = () => {
    clearTimeout(timer)
    alvo = null
    el.classList.remove('on')
  }
  const posicionar = (a) => {
    const r = a.getBoundingClientRect()
    const d = el.getBoundingClientRect()
    let top = r.top - d.height - 8
    let embaixo = false
    if (top < 6) { top = r.bottom + 8; embaixo = true }
    let left = r.left + r.width / 2 - d.width / 2
    left = Math.max(8, Math.min(left, innerWidth - d.width - 8))
    el.style.top = Math.round(top) + 'px'
    el.style.left = Math.round(left) + 'px'
    el.classList.toggle('embaixo', embaixo)
  }
  document.addEventListener('mouseover', (e) => {
    const a = e.target.closest && e.target.closest('[title],[data-dica]')
    if (!a || a === alvo) return
    if (a.hasAttribute('title')) {
      const t = a.getAttribute('title')
      if (t) a.dataset.dica = t
      a.removeAttribute('title')
    }
    const texto = a.dataset.dica
    if (!texto) return
    esconder()
    alvo = a
    timer = setTimeout(() => {
      if (alvo !== a || !a.isConnected) return
      el.textContent = a.dataset.dica
      el.classList.add('on')
      posicionar(a)
    }, 350)
  })
  document.addEventListener('mouseout', (e) => {
    if (alvo && (!e.relatedTarget || !alvo.contains(e.relatedTarget))) esconder()
  })
  for (const ev of ['mousedown', 'scroll', 'keydown', 'blur']) window.addEventListener(ev, esconder, true)
  // quem muda o title enquanto o mouse está em cima (medidores que atualizam sozinhos): o texto acompanha
  new MutationObserver((ms) => {
    for (const m of ms) {
      const a = m.target
      if (m.attributeName !== 'title' || !a.getAttribute('title')) continue
      a.dataset.dica = a.getAttribute('title')
      a.removeAttribute('title')
      if (a === alvo && el.classList.contains('on')) { el.textContent = a.dataset.dica; posicionar(a) }
    }
  }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['title'] })
})()
