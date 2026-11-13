// Ajudante de animação do Motion (Segundo Cérebro). Tudo em função do tempo t (segundos), sem relógio próprio:
// o renderizador chama window.sbFrame(t) a cada quadro, então o resultado é idêntico toda vez.
;(function (g) {
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
  const ease = {
    linear: (x) => x,
    inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    out: (x) => 1 - Math.pow(1 - x, 3),
    in: (x) => x * x * x,
    outExpo: (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    inOutExpo: (x) => (x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
    outBack: (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2) },
    outElastic: (x) => (x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  }
  // progresso de 0 a 1 entre o início e o fim (em segundos), com easing
  const prog = (t, ini, dur, e = 'out') => (ease[e] || ease.out)(clamp((t - ini) / dur))
  // interpola um número, uma cor hex ou um array
  const lerp = (a, b, p) => a + (b - a) * p
  const mix = (a, b, p) => {
    if (Array.isArray(a)) return a.map((x, i) => lerp(x, b[i], p))
    if (typeof a === 'string' && a[0] === '#') {
      const h = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16))
      const [r, gg, bb] = h(a).map((x, i) => Math.round(lerp(x, h(b)[i], p)))
      return `rgb(${r},${gg},${bb})`
    }
    return lerp(a, b, p)
  }
  // mola amortecida (para "pular" e assentar)
  const spring = (t, ini = 0, { freq = 2.2, damp = 6 } = {}) => {
    const x = Math.max(0, t - ini)
    return 1 - Math.exp(-damp * x) * Math.cos(2 * Math.PI * freq * x)
  }
  // atraso em cascata: i-ésimo item começa ini + i*passo
  const stagger = (i, ini, passo) => ini + i * passo
  // quebra um elemento em spans por letra ou palavra (uma vez) e devolve os spans
  const split = (el, modo = 'letras') => {
    if (el.__sbSplit) return el.__sbSplit
    const txt = el.textContent
    el.textContent = ''
    const partes = modo === 'palavras' ? txt.split(/(\s+)/) : [...txt]
    el.__sbSplit = partes.map((p) => {
      const s = document.createElement('span')
      s.textContent = p
      s.style.display = 'inline-block'
      s.style.whiteSpace = 'pre'
      el.appendChild(s)
      return s
    }).filter((s) => s.textContent.trim())
    return el.__sbSplit
  }
  // ruído suave determinístico (para tremido de câmera, partículas)
  const noise = (x) => { const i = Math.floor(x), f = x - i, h = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s) }; const u = f * f * (3 - 2 * f); return lerp(h(i), h(i + 1), u) * 2 - 1 }
  g.SB = { clamp, ease, prog, lerp, mix, spring, stagger, split, noise }
})(window)
