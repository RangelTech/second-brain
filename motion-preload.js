// Preload da janela invisível do Motion: roda ANTES dos scripts da página, no mesmo mundo (contextIsolation desligado),
// e troca o relógio da página por um relógio controlado. O renderizador avança o tempo quadro a quadro com window.__sbSeek(ms):
// animações CSS e Web Animations são posicionadas no tempo exato, requestAnimationFrame recebe o tempo do quadro,
// window.sbFrame(t) (se a página definir) é chamada com t em segundos e vídeos <video> são posicionados e esperados.
// Também deixa React, ReactDOM, htm (JSX sem compilar: html`<div/>`) e o ajudante SB (easing, spring, stagger, split) prontos.
const fs = require('fs')
const path = require('path')

let T = 0
const INICIO = Date.UTC(2026, 0, 1)
let fila = []
window.requestAnimationFrame = (cb) => { fila.push(cb); return fila.length }
window.cancelAnimationFrame = (id) => { if (fila[id - 1]) fila[id - 1] = null }
performance.now = () => T
Date.now = () => INICIO + T

for (const f of ['react.production.min.js', 'react-dom.production.min.js', 'htm.umd.js', 'sb-anima.js']) {
  try {
    window.eval(fs.readFileSync(path.join(__dirname, 'motion-vendor', f), 'utf8'))
  } catch (e) {
    console.error('motion-vendor ' + f + ': ' + e.message)
  }
}
try {
  if (window.htm && window.React) window.html = window.htm.bind(window.React.createElement)
} catch {}

// Espera o vídeo chegar na posição. Só o 'seeked' não basta: ele chega antes do quadro novo ser decodificado e o canvas
// copiava o quadro ANTERIOR (medido 14/11/2026: prévia em 52,5 s mostrava o quadro de 1 s). requestVideoFrameCallback dispara
// quando o quadro novo está pronto; se este vídeo nunca disparar (janela invisível), cai só no 'seeked' depois da 1ª vez.
const esperarVideo = (v, s) => new Promise((ok) => {
  if (Math.abs(v.currentTime - s) < 0.001 && v.readyState >= 2) return ok()
  let busca = false
  let quadro = !v.requestVideoFrameCallback || v.__sbSemRvfc
  let feito = false
  const fim = () => { if (feito) return; feito = true; v.removeEventListener('seeked', aoBuscar); ok() }
  const talvez = () => { if (busca && quadro) fim() }
  const aoBuscar = () => {
    busca = true
    talvez()
    if (!quadro) setTimeout(() => { if (!feito) { if (!v.__sbRvfcOk) v.__sbSemRvfc = true; fim() } }, 800)
  }
  v.addEventListener('seeked', aoBuscar)
  if (!quadro) v.requestVideoFrameCallback(() => { v.__sbRvfcOk = true; quadro = true; talvez() })
  setTimeout(fim, 4000)
  v.currentTime = s
})

// A janela invisível (offscreen) NÃO fotografa o <video> (camada de vídeo fica fora da captura; medido 13/11/2026: quadro preto
// com o vídeo carregado). Então cada quadro do vídeo é copiado para um <canvas> no mesmo lugar, com o mesmo object-fit, e o
// <video> fica invisível. O canvas entra logo depois do vídeo no HTML: a ordem das camadas da página continua a mesma.
function pintarVideo(v) {
  if (v.readyState < 2) return
  let c = v.__sbCanvas
  if (!c) {
    c = document.createElement('canvas')
    c.className = v.className
    c.dataset.sbVideo = '1'
    v.after(c)
    v.__sbCanvas = c
  }
  const cs = getComputedStyle(v)
  const w = v.offsetWidth
  const h = v.offsetHeight
  if (!w || !h) return
  c.style.cssText = v.style.cssText
  for (const k of ['position', 'left', 'top', 'right', 'bottom', 'transform', 'transformOrigin', 'borderRadius', 'filter', 'zIndex', 'clipPath', 'boxShadow'])
    c.style[k] = cs[k]
  c.style.opacity = cs.opacity
  c.style.visibility = 'visible'
  c.style.width = w + 'px'
  c.style.height = h + 'px'
  if (c.width !== w) c.width = w
  if (c.height !== h) c.height = h
  const g = c.getContext('2d')
  const vw = v.videoWidth
  const vh = v.videoHeight
  g.clearRect(0, 0, w, h)
  const fit = cs.objectFit
  let s = Math.min(w / vw, h / vh) // contain (padrão do <video>)
  if (fit === 'cover') s = Math.max(w / vw, h / vh)
  if (fit === 'fill') return g.drawImage(v, 0, 0, w, h)
  const dw = vw * s
  const dh = vh * s
  g.drawImage(v, (w - dw) / 2, (h - dh) / 2, dw, dh)
  // o <video> continua VISÍVEL embaixo do canvas: vídeo escondido (visibility:hidden ou opacidade ~0) para de trocar de quadro
  // e o canvas copiava sempre o anterior (medido 14/11/2026). Na janela invisível a camada do vídeo não sai na foto mesmo.
}

window.__sbSeek = async (ms) => {
  T = ms
  for (const a of document.getAnimations()) {
    try { a.pause(); a.currentTime = ms } catch {}
  }
  const l = fila
  fila = []
  for (const cb of l) { try { cb && cb(T) } catch (e) { console.error(e) } }
  if (typeof window.sbFrame === 'function') {
    try { await window.sbFrame(ms / 1000) } catch (e) { console.error(e) }
  }
  const vids = [...document.querySelectorAll('video')]
  for (const v of vids) {
    v.muted = true
    try { v.pause() } catch {}
    const ini = parseFloat(v.dataset.inicio || '0')
    await esperarVideo(v, Math.max(0, ms / 1000 - ini + parseFloat(v.dataset.corte || '0')))
  }
  // Fase 2 (vídeos): o Chromium só troca o quadro do <video> na PRÓXIMA pintura da janela invisível; copiar agora pegaria o
  // quadro anterior (medido 14/11/2026: atraso de exatamente 1 quadro). O renderizador força uma pintura e chama __sbPintar.
  window.__sbVideos = vids
  if (vids.length) return -1
  return __sbCarimbar()
}
window.__sbPintar = async () => {
  for (const v of window.__sbVideos || []) pintarVideo(v)
  return __sbCarimbar()
}
async function __sbCarimbar() {
  // CARIMBO: um pixel no canto com o número deste quadro. O renderizador só aceita a pintura que trouxer o carimbo certo
  // (a janela invisível às vezes entregava a pintura anterior: quadro atrasado/preto). Depois ele apaga o pixel.
  __sbSerie = (__sbSerie + 1) % 1024
  let m = document.getElementById('__sbcarimbo')
  if (!m) {
    m = document.createElement('div')
    m.id = '__sbcarimbo'
    m.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;z-index:2147483647;pointer-events:none'
    document.documentElement.appendChild(m)
  }
  // espera fontes e imagens novas antes de fotografar o quadro
  try { await document.fonts.ready } catch {}
  // cor em passos de 8 (o pixel pode variar ±1-2 na foto): quadro atual e anterior nunca se confundem
  m.style.background = `rgb(${(__sbSerie & 31) * 8},${(__sbSerie >> 5) * 8},77)`
  await new Promise((r) => setTimeout(r, 0))
  return __sbSerie
}
let __sbSerie = 0
