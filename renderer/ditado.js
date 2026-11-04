// Ditado em tempo real, 100% no aparelho do usuário (Vosk em WebAssembly): o áudio nunca sai da máquina nem vira anexo,
// só o texto chega à caixa de mensagem. Usado no app e na página do celular (mesmo arquivo nos dois repositórios).
// Precisa do vosk.js carregado antes (global Vosk).
;(function (g) {
  const OCIOSO_MS = 120000 // descarrega o modelo da memória depois de 2 min sem uso
  let modelo = null
  let carregando = null
  let descarga = null

  function suportado() {
    return !!(navigator.mediaDevices?.getUserMedia && g.Vosk && g.WebAssembly && (g.AudioContext || g.webkitAudioContext))
  }

  async function obterModelo(urlModelo, aoProgresso) {
    clearTimeout(descarga)
    if (modelo) return modelo
    if (!carregando) {
      carregando = (async () => {
        const url = await urlModelo(aoProgresso)
        // o Vosk não rejeita quando o worker falha: sem prazo o usuário ficaria preso em "preparando"
        const m = await Promise.race([g.Vosk.createModel(url), new Promise((_, rej) => setTimeout(() => rej(new Error('O modelo de voz não carregou.')), 90000))])
        modelo = m
        return m
      })().finally(() => (carregando = null))
    }
    return carregando
  }

  // Captura paralela a 16 kHz: corta o áudio em trechos nas pausas da fala e entrega cada trecho (Float32) a aoSegmento.
  function capturar16(fluxo, aoSegmento) {
    const AC = g.AudioContext || g.webkitAudioContext
    const ctx = new AC({ sampleRate: 16000 })
    const fonte = ctx.createMediaStreamSource(fluxo)
    const proc = ctx.createScriptProcessor(2048, 1, 1)
    const PRE = 5 // blocos de pré-roll (~0,6 s) para não cortar o começo da frase
    const SILENCIO_BLOCOS = 6 // ~0,75 s calado fecha o trecho
    const MAX_BLOCOS = 16000 * 25 / 2048
    let pre = []
    let seg = []
    let falando = false
    let calado = 0
    let ruido = 0.004
    const fechar = () => {
      if (seg.length > 4) {
        const n = seg.reduce((a, b) => a + b.length, 0)
        const out = new Float32Array(n)
        let o = 0
        for (const b of seg) (out.set(b, o), (o += b.length))
        aoSegmento(out)
      }
      seg = []
      falando = false
      calado = 0
    }
    proc.onaudioprocess = (e) => {
      const d = new Float32Array(e.inputBuffer.getChannelData(0))
      let soma = 0
      for (let i = 0; i < d.length; i++) soma += d[i] * d[i]
      const rms = Math.sqrt(soma / d.length)
      const voz = rms > Math.max(0.012, ruido * 3.5)
      if (!voz && !falando) ruido = ruido * 0.95 + rms * 0.05
      if (voz) {
        if (!falando) {
          falando = true
          seg = pre.slice()
        }
        calado = 0
      } else if (falando) calado++
      if (falando) {
        seg.push(d)
        if (calado >= SILENCIO_BLOCOS || seg.length >= MAX_BLOCOS) fechar()
      } else {
        pre.push(d)
        if (pre.length > PRE) pre.shift()
      }
    }
    fonte.connect(proc)
    proc.connect(ctx.destination)
    return {
      parar() {
        try { if (falando) fechar() } catch {}
        try { proc.disconnect() } catch {}
        try { ctx.close() } catch {}
      },
    }
  }

  // opcoes: { urlModelo(aoProgresso) -> url, aoTexto(finais, parcial), aoNivel(0..1), aoEstado(estado, detalhe) }
  // estados: 'carregando' (baixa/abre o modelo, só na 1ª vez) | 'ouvindo' | 'parado' | 'erro'
  async function iniciar(opcoes) {
    const { urlModelo, aoTexto, aoNivel, aoEstado, aoSegmento } = opcoes
    let cap16 = null
    let finais = ''
    let parou = false
    let fluxo
    let ctx
    let rec
    let raf
    const limpar = () => {
      cancelAnimationFrame(raf)
      try {
        fluxo?.getTracks().forEach((t) => t.stop())
      } catch {}
      try {
        ctx?.close()
      } catch {}
      try {
        rec?.remove()
      } catch {}
      aoNivel?.(0)
      if (modelo) {
        clearTimeout(descarga)
        descarga = setTimeout(() => {
          try {
            modelo?.terminate()
          } catch {}
          modelo = null
        }, OCIOSO_MS)
      }
    }
    try {
      aoEstado?.('carregando')
      // o microfone abre primeiro: se a permissão for negada, o usuário descobre na hora, antes de baixar o modelo
      fluxo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } })
      const m = await obterModelo(urlModelo, (p) => aoEstado?.('carregando', p))
      if (parou) return limpar()
      const AC = g.AudioContext || g.webkitAudioContext
      ctx = new AC()
      if (ctx.state === 'suspended') await ctx.resume()
      rec = new m.KaldiRecognizer(ctx.sampleRate)
      rec.on('result', (msg) => {
        const t = (msg.result?.text || '').trim()
        if (t) finais = (finais + ' ' + t).trim()
        aoTexto?.(finais, '')
      })
      rec.on('partialresult', (msg) => aoTexto?.(finais, (msg.result?.partial || '').trim()))
      const fonte = ctx.createMediaStreamSource(fluxo)
      const analisador = ctx.createAnalyser()
      analisador.fftSize = 512
      fonte.connect(analisador)
      const proc = ctx.createScriptProcessor(4096, 1, 1)
      proc.onaudioprocess = (e) => {
        try {
          rec.acceptWaveform(e.inputBuffer)
        } catch {}
      }
      fonte.connect(proc)
      proc.connect(ctx.destination) // saída muda: o processador só roda se estiver ligado ao destino
      const amostra = new Uint8Array(analisador.fftSize)
      const medir = () => {
        analisador.getByteTimeDomainData(amostra)
        let soma = 0
        for (let i = 0; i < amostra.length; i++) {
          const v = (amostra[i] - 128) / 128
          soma += v * v
        }
        aoNivel?.(Math.min(1, Math.sqrt(soma / amostra.length) * 4))
        raf = requestAnimationFrame(medir)
      }
      medir()
      if (aoSegmento) cap16 = capturar16(fluxo, aoSegmento)
      aoEstado?.('ouvindo')
    } catch (e) {
      limpar()
      aoEstado?.('erro', e?.name === 'NotAllowedError' ? 'Permissão do microfone negada.' : e?.message || String(e))
      return { parar() {} }
    }
    return {
      // devolve o texto final (inclui o que ainda estava sendo reconhecido)
      async parar() {
        if (parou) return finais
        parou = true
        try { cap16?.parar() } catch {}
        try {
          const r = await Promise.race([new Promise((res) => (rec.on('result', res), rec.retrieveFinalResult())), new Promise((res) => setTimeout(res, 1500))])
          const t = (r?.result?.text || '').trim()
          if (t) {
            finais = (finais + ' ' + t).trim()
            aoTexto?.(finais, '')
          }
        } catch {}
        limpar()
        aoEstado?.('parado')
        return finais
      },
    }
  }

  g.Ditado = { suportado, iniciar }
})(window)
