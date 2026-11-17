// Conversa por voz (spec 45 §F): o usuário fala, o agente responde falando. Os cartões do chat somem, o cérebro do fundo
// toma a cena e uma auréola de barras pulsa com o som (microfone quando o usuário fala, a voz da IA quando ela fala).
// Ciclo: ouvir (VAD no navegador) → transcrever (mesmo servidor do ditado) → mandar ao agente (mesmo envio do chat) →
// falar a resposta (mesma voz neural do "Ouvir") → ouvir de novo. Falar por cima interrompe a IA (barge-in).
// Funciona igual no app e na web; sem nenhuma dependência nova.
(function () {
  const $ = (id) => document.getElementById(id)
  const P = () => window.__sbVoz // ponte exposta pelo app.js (enviar, estado da resposta, cérebro)
  let st = null // estado da sessão de voz

  const ESTADOS = { ouvindo: 'Pode falar…', transcrevendo: 'Entendendo…', pensando: 'Pensando…', falando: 'Falando… (fale por cima para interromper)', erro: '' }

  function cor(nome, reserva) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim()
    return v || reserva
  }

  // ---------- palco (overlay com a auréola) ----------
  function montarPalco() {
    let p = $('voz-palco')
    if (p) return p
    p = document.createElement('div')
    p.id = 'voz-palco'
    p.className = 'voz-palco'
    p.setAttribute('role', 'dialog')
    p.setAttribute('aria-label', 'Conversa por voz')
    p.innerHTML = '<canvas class="voz-aureola" aria-hidden="true"></canvas>' +
      '<div class="voz-rodape"><p class="voz-estado" role="status" aria-live="polite"></p><p class="voz-legenda" aria-live="polite"></p>' +
      '<div class="voz-acoes"><button type="button" class="voz-mudo" aria-pressed="false">Silenciar microfone</button>' +
      '<button type="button" class="voz-sair">Encerrar conversa</button></div></div>'
    document.querySelector('main.central').appendChild(p)
    p.querySelector('.voz-sair').onclick = () => encerrar()
    p.querySelector('.voz-mudo').onclick = (e) => {
      if (!st) return
      st.mudo = !st.mudo
      e.currentTarget.setAttribute('aria-pressed', String(st.mudo))
      e.currentTarget.textContent = st.mudo ? 'Ligar microfone' : 'Silenciar microfone'
      if (st.mudo && st.fase === 'ouvindo') descartarFrase()
    }
    return p
  }

  function fase(f, legenda) {
    if (!st) return
    st.fase = f
    const p = $('voz-palco')
    p.dataset.fase = f
    p.querySelector('.voz-estado').textContent = st.mudo && f === 'ouvindo' ? 'Microfone silenciado' : ESTADOS[f] || f
    if (legenda !== undefined) p.querySelector('.voz-legenda').textContent = legenda
  }

  // ---------- auréola ----------
  const N_BARRAS = 84
  function desenhar() {
    if (!st) return
    const cv = st.canvas
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = cv.clientWidth, h = cv.clientHeight
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr) }
    const g = cv.getContext('2d')
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)
    const cx = w / 2, cy = h * 0.44
    const raio = Math.min(w, h) * 0.2
    // fonte do som: a voz da IA quando ela fala, o microfone nos outros momentos
    const an = st.fase === 'falando' && st.anSaida ? st.anSaida : st.anMic
    let nivel = 0
    if (an) {
      an.getByteFrequencyData(st.freq)
      for (let i = 0; i < N_BARRAS; i++) {
        // espelha as frequências dos dois lados para o anel ficar simétrico
        const k = i < N_BARRAS / 2 ? i : N_BARRAS - 1 - i
        const idx = 2 + Math.floor((k / (N_BARRAS / 2)) * (st.freq.length * 0.45))
        const alvo = (st.mudo && st.fase === 'ouvindo') ? 0 : st.freq[idx] / 255
        st.alt[i] = st.alt[i] * 0.72 + alvo * 0.28 // suaviza para pulsar sem tremer
        nivel += st.alt[i]
      }
      nivel /= N_BARRAS
    }
    const t = performance.now() / 1000
    const ac = cor('--ac', '#d97757'), ac2 = cor('--ac2', '#e8896a')
    const respira = 0.5 + 0.5 * Math.sin(t * 1.6)
    // halo suave
    const halo = g.createRadialGradient(cx, cy, raio * 0.6, cx, cy, raio * 1.9)
    halo.addColorStop(0, 'rgba(0,0,0,0)')
    halo.addColorStop(0.55, hexA(ac, 0.07 + nivel * 0.25))
    halo.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = halo
    g.beginPath(); g.arc(cx, cy, raio * 1.9, 0, Math.PI * 2); g.fill()
    // barras
    const giro = st.fase === 'pensando' || st.fase === 'transcrevendo' ? t * 0.6 : 0
    g.lineCap = 'round'
    for (let i = 0; i < N_BARRAS; i++) {
      const a = (i / N_BARRAS) * Math.PI * 2 - Math.PI / 2 + giro
      const base = 3 + respira * 2
      const comp = base + st.alt[i] * raio * 0.85 + (st.fase === 'pensando' ? 4 * (0.5 + 0.5 * Math.sin(t * 4 + i * 0.35)) : 0)
      const x1 = cx + Math.cos(a) * raio, y1 = cy + Math.sin(a) * raio
      const x2 = cx + Math.cos(a) * (raio + comp), y2 = cy + Math.sin(a) * (raio + comp)
      const grd = g.createLinearGradient(x1, y1, x2, y2)
      grd.addColorStop(0, hexA(ac, 0.55))
      grd.addColorStop(1, hexA(ac2, 0.95))
      g.strokeStyle = grd
      g.lineWidth = Math.max(1.6, (Math.PI * 2 * raio / N_BARRAS) * 0.42)
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke()
    }
    // anel fino
    g.strokeStyle = hexA(ac2, 0.35 + respira * 0.2)
    g.lineWidth = 1.2
    g.beginPath(); g.arc(cx, cy, raio - 6, 0, Math.PI * 2); g.stroke()
    st.raf = requestAnimationFrame(desenhar)
  }
  function hexA(hex, a) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim())
    if (!m) return `rgba(217,119,87,${a})`
    const n = parseInt(m[1], 16)
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`
  }

  // ---------- ouvir (VAD + gravação por frase) ----------
  function novaFrase() {
    const rec = new MediaRecorder(st.fluxo, st.mime ? { mimeType: st.mime, audioBitsPerSecond: 32000 } : {})
    const partes = []
    const fr = { rec, falou: 0, ini: performance.now(), descartar: false }
    rec.ondataavailable = (e) => e.data && e.data.size && partes.push(e.data)
    rec.onstop = async () => {
      if (!st || fr.descartar) return
      const blob = new Blob(partes, { type: rec.mimeType || st.mime || 'audio/webm' })
      if (fr.falou < 350 || blob.size < 1500) { if (st && st.fase === 'ouvindo') novaFrase(); return }
      await processar(blob)
    }
    rec.start(400)
    st.frase = fr
  }
  function descartarFrase() {
    if (!st || !st.frase) return
    st.frase.descartar = true
    try { st.frase.rec.stop() } catch {}
    st.frase = null
    if (!st.mudo && st.fase === 'ouvindo') novaFrase()
  }

  function medir() {
    if (!st) return
    st.anMic.getByteTimeDomainData(st.amostra)
    let soma = 0
    for (let i = 0; i < st.amostra.length; i++) { const v = (st.amostra[i] - 128) / 128; soma += v * v }
    const rms = Math.sqrt(soma / st.amostra.length)
    const agora = performance.now(), dt = agora - st.antes
    st.antes = agora
    st.piso = rms < st.piso ? rms * 0.2 + st.piso * 0.8 : st.piso * 0.999 + rms * 0.001
    const fala = !st.mudo && rms > Math.max(0.014, st.piso * 2.6)
    if (st.fase === 'ouvindo' && st.frase) {
      if (fala) { st.frase.falou += dt; st.quieto = 0 } else st.quieto += dt
      const dur = agora - st.frase.ini
      // frase terminou: falou e fez pausa de ~0,8 s (ou falou muito tempo e deu uma pausa curta)
      if (st.frase.falou >= 400 && ((st.quieto >= 800 && dur >= 1200) || (dur >= 20000 && st.quieto >= 200))) {
        const r = st.frase.rec
        st.frase = null
        fase('transcrevendo')
        try { r.stop() } catch {}
      }
    } else if (st.fase === 'falando') {
      // falar por cima interrompe a IA: voz forte e contínua por ~350 ms (o eco da própria IA é cortado pelo echoCancellation)
      st.cima = fala && rms > Math.max(0.03, st.piso * 4) ? st.cima + dt : 0
      if (st.cima >= 350) { st.cima = 0; interromper() }
    }
    st.medidor = requestAnimationFrame(medir)
  }

  // ---------- transcrever → agente → falar ----------
  async function processar(blob) {
    if (!st) return
    const sessao = st
    fase('transcrevendo')
    let r
    try { r = await window.sb.ditadoServidor(new Uint8Array(await blob.arrayBuffer()), blob.type) } catch { r = null }
    if (st !== sessao) return
    const texto = r && r.ok ? String(r.texto || '').trim() : ''
    if (!texto) { fase('ouvindo', r && !r.ok ? 'Não consegui entender agora. Fale de novo.' : ''); novaFrase(); return }
    fase('pensando', '“' + texto + '”')
    const id = P().enviarTexto(texto)
    if (!id) { fase('ouvindo', 'Escolha um modelo antes de conversar.'); novaFrase(); return }
    // espera o agente terminar (a resposta também aparece no chat normalmente)
    const t0 = Date.now()
    while (st === sessao && P().ocupado(id)) {
      await new Promise((ok) => setTimeout(ok, 300))
      if (Date.now() - t0 > 15 * 60 * 1000) break
    }
    if (st !== sessao) return
    const resp = P().ultimaResposta(id)
    await falar(resp, sessao)
    if (st !== sessao) return
    fase('ouvindo', '')
    if (!st.mudo) novaFrase()
  }

  function paraFala(texto) {
    let t = String(texto || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/https?:\/\/\S+/g, 'link')
      .replace(/[#*_>`|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    // resposta longa: fala o começo e avisa que o resto está na tela
    if (t.length > 700) {
      const corte = t.slice(0, 700)
      const fim = Math.max(corte.lastIndexOf('. '), corte.lastIndexOf('! '), corte.lastIndexOf('? '))
      t = (fim > 200 ? corte.slice(0, fim + 1) : corte) + ' Deixei o resto escrito na tela.'
    }
    return t
  }
  function blocos(texto) {
    const fr = texto.match(/[^.!?\n]+[.!?]*/g) || [texto]
    const out = []
    let cur = ''
    for (const f of fr.map((x) => x.trim()).filter(Boolean)) {
      const lim = out.length === 0 ? 110 : 320
      if (cur && (cur + ' ' + f).length > lim) { out.push(cur); cur = f } else cur = cur ? cur + ' ' + f : f
    }
    if (cur) out.push(cur)
    return out
  }
  async function falar(texto, sessao) {
    const t = paraFala(texto)
    if (!t) return
    fase('falando', '')
    st.interrompido = false
    const voz = (window.SB_CFG && window.SB_CFG.voz) || 'feminina'
    const pedir = (b) => (window.sb.vozFalar ? window.sb.vozFalar(b, voz).catch(() => ({ ok: false })) : Promise.resolve({ ok: false }))
    const bl = blocos(t)
    let prox = pedir(bl[0])
    for (let i = 0; i < bl.length; i++) {
      const r = await prox
      if (st !== sessao || st.interrompido) return
      if (i + 1 < bl.length) prox = pedir(bl[i + 1])
      if (!r || !r.ok) { await falarSistema(bl.slice(i).join(' ')); return }
      const url = URL.createObjectURL(new Blob([r.bytes], { type: r.mime || 'audio/mpeg' }))
      const a = new Audio(url)
      st.audio = a
      try {
        // liga a voz da IA ao analisador da auréola (e às caixas de som)
        const src = st.ctx.createMediaElementSource(a)
        src.connect(st.anSaida)
        st.anSaida.connect(st.ctx.destination)
      } catch {}
      await new Promise((ok) => { a.onended = a.onerror = ok; a.play().catch(ok) })
      URL.revokeObjectURL(url)
      if (st !== sessao || st.interrompido) return
    }
  }
  function falarSistema(t) {
    return new Promise((ok) => {
      if (!window.speechSynthesis) return ok()
      const u = new SpeechSynthesisUtterance(t)
      u.lang = 'pt-BR'
      u.rate = 1.05
      u.onend = u.onerror = ok
      speechSynthesis.speak(u)
    })
  }
  function interromper() {
    if (!st) return
    st.interrompido = true
    try { st.audio && st.audio.pause() } catch {}
    try { speechSynthesis.cancel() } catch {}
    fase('ouvindo', '')
    novaFrase()
  }

  // ---------- entrar / sair ----------
  async function iniciar() {
    if (st) return encerrar()
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return alert('Este navegador não permite gravar áudio. Use o Chrome ou o app instalado.')
    let fluxo
    try {
      fluxo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } })
    } catch (e) {
      return alert(e && e.name === 'NotAllowedError' ? 'Permita o uso do microfone para conversar por voz.' : 'Não consegui acessar o microfone.')
    }
    const AC = window.AudioContext || window.webkitAudioContext
    const ctx = new AC()
    ctx.resume().catch(() => {}) // sem await: em aba sem gesto o resume pode nunca resolver
    const anMic = ctx.createAnalyser(); anMic.fftSize = 512; anMic.smoothingTimeConstant = 0.6
    ctx.createMediaStreamSource(fluxo).connect(anMic)
    const anSaida = ctx.createAnalyser(); anSaida.fftSize = 512; anSaida.smoothingTimeConstant = 0.6
    const palco = montarPalco()
    st = {
      fluxo, ctx, anMic, anSaida, canvas: palco.querySelector('canvas'),
      mime: ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) => MediaRecorder.isTypeSupported(m)) || '',
      freq: new Uint8Array(anMic.frequencyBinCount), alt: new Float32Array(N_BARRAS), amostra: new Uint8Array(512),
      antes: performance.now(), piso: 0.01, quieto: 0, cima: 0, mudo: false, fase: 'ouvindo', frase: null, raf: 0, medidor: 0,
    }
    document.body.classList.add('modo-voz')
    palco.hidden = false
    P().mostrarCerebro(true)
    $('voz-conversa').classList.add('on')
    fase('ouvindo', 'Fale naturalmente. Quando você fizer uma pausa, eu respondo.')
    novaFrase()
    medir()
    desenhar()
  }
  function encerrar() {
    const s = st
    if (!s) return
    st = null
    cancelAnimationFrame(s.raf)
    cancelAnimationFrame(s.medidor)
    try { s.frase && s.frase.rec.stop() } catch {}
    try { s.audio && s.audio.pause() } catch {}
    try { speechSynthesis.cancel() } catch {}
    try { s.fluxo.getTracks().forEach((t) => t.stop()) } catch {}
    try { s.ctx.close() } catch {}
    document.body.classList.remove('modo-voz')
    const p = $('voz-palco')
    if (p) p.hidden = true
    const b = $('voz-conversa')
    if (b) b.classList.remove('on')
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && st) encerrar() })
  window.SBVozConversa = { iniciar, encerrar, ativo: () => !!st }
  const b = $('voz-conversa')
  if (b) b.onclick = iniciar
})()
