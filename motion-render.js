// Motion desenhado (spec 37): transforma uma página HTML (CSS, SVG, canvas, React com htm, ajudante SB) num MP4, quadro a quadro.
// Roda no processo principal do app com o Chromium do próprio Electron e o FFmpeg do agente: nada para instalar no computador do cliente.
// O relógio da página é controlado (motion-preload.js), então o vídeo sai igual toda vez e no tamanho exato pedido.
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')

const LIM = { largura: [160, 3840], altura: [160, 3840], fps: [12, 60], duracao: [0.5, 180] }
const faixa = (v, [a, b], padrao) => (Number.isFinite(+v) && +v > 0 ? Math.min(b, Math.max(a, +v)) : padrao)
const par = (n) => Math.round(n / 2) * 2

function opcoes(args) {
  const largura = par(faixa(args.largura, LIM.largura, 1080))
  const altura = par(faixa(args.altura, LIM.altura, 1920))
  const fps = Math.round(faixa(args.fps, LIM.fps, 30))
  const duracao = faixa(args.duracao, LIM.duracao, 6)
  if (!args.html && !args.arquivo) throw new Error('Mande o html da animação (ou o caminho de um arquivo .html).')
  if (!args.saida) throw new Error('Diga onde salvar o vídeo (saida, um caminho .mp4).')
  const saida = path.resolve(String(args.saida))
  return { largura, altura, fps, duracao, saida, audio: args.audio ? path.resolve(String(args.audio)) : '', volume: faixa(args.volume, [0.01, 2], 1), html: args.html ? String(args.html) : '', arquivo: args.arquivo ? path.resolve(String(args.arquivo)) : '', quadros: Array.isArray(args.quadros) ? args.quadros.map(Number).filter((x) => x >= 0) : null }
}

// abre a página numa janela invisível do tamanho exato do vídeo e devolve { wc, fechar }
async function abrirPagina(o) {
  const { BrowserWindow } = require('electron')
  let pagina = o.arquivo
  let temporaria = ''
  if (!pagina) {
    fs.mkdirSync(path.dirname(o.saida), { recursive: true })
    temporaria = path.join(path.dirname(o.saida), `.motion-${process.pid}-${Date.now()}.html`)
    fs.writeFileSync(temporaria, o.html)
    pagina = temporaria
  }
  const w = new BrowserWindow({
    show: false, width: o.largura, height: o.altura, useContentSize: true, frame: false, transparent: false, backgroundColor: '#000000',
    enableLargerThanScreen: true, paintWhenInitiallyHidden: true,
    webPreferences: { offscreen: true, contextIsolation: false, nodeIntegration: false, sandbox: false, backgroundThrottling: false, preload: path.join(__dirname, 'motion-preload.js'), zoomFactor: 1 },
  })
  w.webContents.setFrameRate(60)
  const erros = []
  w.webContents.on('console-message', (_e, nivel, msg) => { if (nivel >= 3 && erros.length < 8) erros.push(String(msg).slice(0, 300)) })
  // a primeira carga de uma janela nova às vezes volta ERR_FAILED (-2) logo depois de outra janela fechar: tenta de novo
  for (let i = 0; ; i++) {
    try {
      await w.loadFile(pagina)
      break
    } catch (e) {
      if (i >= 2) { try { w.destroy() } catch {} ; if (temporaria) try { fs.unlinkSync(temporaria) } catch {} ; throw e }
      await new Promise((r) => setTimeout(r, 300))
    }
  }
  w.setContentSize(o.largura, o.altura)
  await w.webContents.executeJavaScript('document.fonts ? document.fonts.ready.then(() => true) : true')
  return {
    wc: w.webContents,
    erros,
    fechar: () => {
      try { w.destroy() } catch {}
      if (temporaria) try { fs.unlinkSync(temporaria) } catch {}
    },
  }
}

// o quadro sai do evento 'paint' da janela invisível (bem mais rápido que capturePage); se não pintar em 2 s, cai no capturePage
function proximaPintura(wc, ms = 2000) {
  return new Promise((ok) => {
    const t = setTimeout(() => { wc.off('paint', f); ok(null) }, ms)
    const f = (_e, _sujo, img) => { clearTimeout(t); wc.off('paint', f); ok(img) }
    wc.on('paint', f)
  })
}
async function quadro(wc, o, ms) {
  await wc.executeJavaScript(`window.__sbSeek(${ms})`)
  const espera = proximaPintura(wc)
  wc.invalidate()
  let img = (await espera) || (await wc.capturePage())
  const s = img.getSize()
  if (s.width !== o.largura || s.height !== o.altura) img = img.resize({ width: o.largura, height: o.altura, quality: 'best' })
  return img
}

// prévia: alguns quadros em PNG para o agente OLHAR antes de renderizar o vídeo inteiro
async function previa(args) {
  const o = opcoes(args)
  const tempos = (o.quadros && o.quadros.length ? o.quadros : [0.2, o.duracao / 2, Math.max(0, o.duracao - 0.2)]).slice(0, 8)
  const p = await abrirPagina(o)
  try {
    // os quadros vão para uma pasta temporária (não sujam a pasta do cliente); o HTML continua carregando da pasta do vídeo
    const pasta = path.join(os.tmpdir(), 'sb-motion-previa')
    fs.mkdirSync(pasta, { recursive: true })
    const base = path.join(pasta, path.basename(o.saida).replace(/\.mp4$/i, ''))
    const arquivos = []
    for (const t of tempos) {
      const img = await quadro(p.wc, o, Math.min(o.duracao, t) * 1000)
      const f = `${base}-quadro-${String(t.toFixed(2)).replace('.', '_')}s.png`
      fs.writeFileSync(f, img.toPNG())
      arquivos.push(f)
    }
    return { arquivos, erros: p.erros }
  } finally {
    p.fechar()
  }
}

async function renderizar(args, { ffmpeg, aoProgresso } = {}) {
  const o = opcoes(args)
  if (!ffmpeg) throw new Error('FFmpeg não encontrado.')
  const total = Math.round(o.duracao * o.fps)
  const p = await abrirPagina(o)
  fs.mkdirSync(path.dirname(o.saida), { recursive: true })
  const parcial = o.saida + '.parcial.mp4'
  const ent = ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', `${o.largura}x${o.altura}`, '-r', String(o.fps), '-i', '-']
  if (o.audio) ent.push('-i', o.audio)
  const sai = ['-map', '0:v', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
  if (o.audio) sai.push('-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-af', `volume=${o.volume},afade=t=out:st=${Math.max(0, o.duracao - 0.6)}:d=0.6`, '-t', String(o.duracao))
  const ff = spawn(ffmpeg, [...ent, ...sai, parcial], { windowsHide: true })
  let erroFF = ''
  ff.stderr.on('data', (d) => { erroFF = (erroFF + d).slice(-2000) })
  const terminou = new Promise((ok) => ff.on('close', ok))
  const t0 = Date.now()
  try {
    for (let i = 0; i < total; i++) {
      const img = await quadro(p.wc, o, (i * 1000) / o.fps)
      const buf = img.toBitmap()
      if (!ff.stdin.write(buf)) await new Promise((ok) => ff.stdin.once('drain', ok))
      if (aoProgresso && i % o.fps === 0) aoProgresso({ quadro: i, total })
    }
  } finally {
    ff.stdin.end()
    p.fechar()
  }
  const codigo = await terminou
  if (codigo !== 0 || !fs.existsSync(parcial)) throw new Error('Falhou ao montar o vídeo: ' + erroFF.slice(-400))
  try { fs.unlinkSync(o.saida) } catch {}
  fs.renameSync(parcial, o.saida)
  return { arquivo: o.saida, largura: o.largura, altura: o.altura, fps: o.fps, duracao: o.duracao, quadros: total, segundos: Math.round((Date.now() - t0) / 100) / 10, tamanho_mb: Math.round(fs.statSync(o.saida).size / 1e5) / 10, erros: p.erros }
}

module.exports = { renderizar, previa, opcoes }
