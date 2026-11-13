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

const esperarVideo = (v, s) => new Promise((ok) => {
  if (Math.abs(v.currentTime - s) < 0.001 && v.readyState >= 2) return ok()
  const fim = () => { v.removeEventListener('seeked', fim); ok() }
  v.addEventListener('seeked', fim)
  setTimeout(fim, 3000)
  v.currentTime = s
})

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
  // espera fontes e imagens novas antes de fotografar o quadro
  try { await document.fonts.ready } catch {}
  await new Promise((r) => setTimeout(r, 0))
  return true
}
