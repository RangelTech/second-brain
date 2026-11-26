// Kit de movimento dos sites do Cérebro Pro: entrada ao rolar, topo com vidro, brilho que segue o mouse, contadores e faixa
// correndo sem emenda. Inclua no fim do <body>: <script src="kit/kit.js"></script>. Sem dependências.
(() => {
  const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches

  // topo ganha vidro ao rolar
  const topo = document.querySelector('.topo')
  const aoRolar = () => topo && topo.classList.toggle('rolou', scrollY > 20)
  addEventListener('scroll', aoRolar, { passive: true }); aoRolar()

  // elementos .revelar entram ao aparecer; filhos de .escada entram um depois do outro
  document.querySelectorAll('.escada').forEach((g) => [...g.children].forEach((f, i) => { f.classList.add('revelar'); f.style.setProperty('--atraso', i * 0.08 + 's') }))
  const vigia = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visivel'); vigia.unobserve(e.target) } }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
  document.querySelectorAll('.revelar').forEach((el) => (reduzir ? el.classList.add('visivel') : vigia.observe(el)))

  // brilho dos cartões segue o mouse
  document.querySelectorAll('.cartao.brilho').forEach((c) => c.addEventListener('pointermove', (e) => {
    const r = c.getBoundingClientRect(); c.style.setProperty('--mx', e.clientX - r.left + 'px'); c.style.setProperty('--my', e.clientY - r.top + 'px')
  }))

  // contadores: <span class="contar" data-ate="1200" data-sufixo="+">0</span>
  const contar = (el) => {
    const ate = parseFloat(el.dataset.ate || '0'), suf = el.dataset.sufixo || '', pre = el.dataset.prefixo || '', dec = (el.dataset.ate || '').split('.')[1]?.length || 0
    if (reduzir) { el.textContent = pre + ate.toLocaleString('pt-BR', { minimumFractionDigits: dec }) + suf; return }
    const t0 = performance.now(), dur = 1600
    const passo = (t) => { const k = Math.min(1, (t - t0) / dur), v = ate * (1 - Math.pow(1 - k, 3)); el.textContent = pre + v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf; if (k < 1) requestAnimationFrame(passo) }
    requestAnimationFrame(passo)
  }
  const vigiaN = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { contar(e.target); vigiaN.unobserve(e.target) } }), { threshold: 0.5 })
  document.querySelectorAll('.contar').forEach((el) => vigiaN.observe(el))

  // faixa correndo: duplica o conteúdo para o laço não ter emenda
  document.querySelectorAll('.faixa-trilho').forEach((t) => { if (!t.dataset.duplicada) { t.innerHTML += t.innerHTML; t.dataset.duplicada = '1' } })
})()
