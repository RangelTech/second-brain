// Efeitos visuais dos sites do Cérebro Pro: progresso de leitura, parallax, título palavra por palavra, inclinação 3D,
// holofote no cursor e vídeos que só tocam quando aparecem. Inclua depois do kit.js: <script src="kit/efeitos.js"></script>
(() => {
  const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches

  const barra = document.querySelector('.progresso')
  const par = [...document.querySelectorAll('[data-parallax]')]
  let pedido = false
  const quadro = () => {
    pedido = false
    const h = document.documentElement.scrollHeight - innerHeight
    if (barra) barra.style.setProperty('--p', h > 0 ? scrollY / h : 0)
    if (reduzir) return
    for (const el of par) {
      const r = el.getBoundingClientRect()
      const k = parseFloat(el.dataset.parallax) || 0.15
      el.style.transform = 'translate3d(0,' + ((r.top + r.height / 2 - innerHeight / 2) * -k).toFixed(1) + 'px,0)'
    }
  }
  addEventListener('scroll', () => { if (!pedido) { pedido = true; requestAnimationFrame(quadro) } }, { passive: true })
  quadro()

  // título palavra por palavra (mantém <span class="t-grad"> e outros elementos dentro)
  document.querySelectorAll('.palavras').forEach((el) => {
    if (!el.dataset.feito) {
      const percorrer = (n) => [...n.childNodes].forEach((c) => {
        if (c.nodeType === 3) {
          const frag = document.createDocumentFragment()
          c.textContent.split(/(\s+)/).forEach((p) => {
            if (!p || /^\s+$/.test(p)) frag.append(p)
            else { const s = document.createElement('span'); s.className = 'pal'; s.textContent = p; frag.append(s) }
          })
          c.replaceWith(frag)
        } else if (c.nodeType === 1) percorrer(c)
      })
      percorrer(el)
      el.querySelectorAll('.pal').forEach((s, i) => s.style.setProperty('--i', i))
      el.dataset.feito = '1'
    }
    if (reduzir) { el.classList.add('visivel'); return }
    new IntersectionObserver((es, o) => es.forEach((e) => { if (e.isIntersecting) { el.classList.add('visivel'); o.disconnect() } }), { threshold: 0.3 }).observe(el)
  })

  if (!reduzir && matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.inclinar').forEach((c) => {
      c.addEventListener('pointermove', (e) => {
        const r = c.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5
        c.style.transform = 'perspective(900px) rotateX(' + (-y * 8).toFixed(2) + 'deg) rotateY(' + (x * 10).toFixed(2) + 'deg)'
      })
      c.addEventListener('pointerleave', () => { c.style.transform = '' })
    })
  }

  document.querySelectorAll('.holofote').forEach((s) => s.addEventListener('pointermove', (e) => {
    const r = s.getBoundingClientRect()
    s.style.setProperty('--cx', e.clientX - r.left + 'px')
    s.style.setProperty('--cy', e.clientY - r.top + 'px')
  }))

  // vídeos: só tocam quando aparecem (economiza bateria e dados)
  const vids = [...document.querySelectorAll('video[data-ao-aparecer], .video-card video, .hero-midia video')]
  vids.forEach((v) => { v.muted = true; v.playsInline = true; v.loop = true; v.setAttribute('playsinline', '') })
  const vigiaV = new IntersectionObserver((es) => es.forEach((e) => { const v = e.target; if (e.isIntersecting) v.play().catch(() => {}); else v.pause() }), { threshold: 0.2 })
  vids.forEach((v) => vigiaV.observe(v))
})()
