// Voz ao vivo na tela (spec 52): pega o microfone já aberto (MediaStream + AudioContext), converte para PCM 16 bits 16 kHz mono e manda em
// pedaços de ~160 ms pelo window.sb.ditadoVivo (o main abre o stream e troca a conexão a cada 2 min). Devolve o texto ACUMULADO da fala
// atual (cada evento substitui o anterior) e o fim de cada fala. Usado pelo ditado (app.js) e pela conversa por voz (voz-conversa.js).
// A parte pura (reamostrar) é testada em node.
;(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica()
  else raiz.SBVozStream = fabrica()
})(typeof self !== 'undefined' ? self : this, function () {
  // Float32 [-1,1] numa taxa qualquer -> Int16 a 16 kHz (média por janela: corta o chiado que a amostragem simples deixava)
  function paraPcm16k(x, taxa) {
    const r = taxa / 16000
    const n = Math.floor(x.length / r)
    const out = new Int16Array(n)
    for (let i = 0; i < n; i++) {
      const a = Math.floor(i * r), b = Math.max(a + 1, Math.floor((i + 1) * r))
      let s = 0
      for (let k = a; k < b && k < x.length; k++) s += x[k]
      s = Math.max(-1, Math.min(1, s / (b - a)))
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return out
  }

  const ouvintes = new Map() // id -> callbacks
  let ligado = false
  function ligar() {
    if (ligado || typeof window === 'undefined' || !window.sb || !window.sb.ditadoVivo) return
    ligado = true
    window.sb.ditadoVivo.aoEvento((ev) => {
      const o = ev && ouvintes.get(ev.id)
      if (!o) return
      if (ev.tipo === 'texto') (o.recebeu = true), o.aoTexto && o.aoTexto(String(ev.data || ''))
      else if (ev.tipo === 'fimDeFala') o.aoFimDeFala && o.aoFimDeFala()
      else if (ev.tipo === 'erro') o.aoErro && o.aoErro(String(ev.data || ''), o.recebeu)
      else if (ev.tipo === 'fechou') (ouvintes.delete(ev.id), o.aoFechou && o.aoFechou(o.recebeu))
    })
  }

  // ctx: AudioContext; fluxo: MediaStream do microfone. cb: { aoTexto(txt), aoFimDeFala(), aoErro(msg, jaRecebeu), aoFechou(jaRecebeu) }
  // Devolve null se não deu para abrir (sem conta, sem suporte): quem chamou usa o caminho antigo.
  async function abrir(ctx, fluxo, cb = {}) {
    if (typeof window === 'undefined' || !window.sb || !window.sb.ditadoVivo || !ctx || !ctx.createScriptProcessor) return null
    ligar()
    const id = 'v' + Date.now() + Math.random().toString(36).slice(2, 6)
    const o = { ...cb, recebeu: false }
    ouvintes.set(id, o)
    // o microfone já começa a ser guardado AGORA: quem fala logo ao clicar não perde as primeiras palavras enquanto a conexão abre
    const fonte = ctx.createMediaStreamSource(fluxo)
    const proc = ctx.createScriptProcessor(4096, 1, 1)
    let acum = new Int16Array(0)
    let pausado = false
    let fechado = false
    let pronto = false
    const guardado = []
    const mandar = (bytes) => {
      if (!pronto) return void (guardado.length < 200 && guardado.push(bytes))
      window.sb.ditadoVivo.audio(id, bytes).catch(() => {})
    }
    proc.onaudioprocess = (e) => {
      if (fechado) return
      const pcm = paraPcm16k(e.inputBuffer.getChannelData(0), ctx.sampleRate)
      // pausado (microfone silenciado): manda silêncio para a conexão não cair e o servidor fechar a fala
      if (pausado) pcm.fill(0)
      const out = new Int16Array(acum.length + pcm.length)
      out.set(acum)
      out.set(pcm, acum.length)
      acum = out
      if (acum.length >= 2560) {
        mandar(new Uint8Array(acum.buffer.slice(0)))
        acum = new Int16Array(0)
      }
    }
    fonte.connect(proc)
    proc.connect(ctx.destination) // o ScriptProcessor só roda ligado à saída (sai mudo: o buffer de saída fica zerado)
    let r
    try {
      r = await window.sb.ditadoVivo.abrir(id)
    } catch {
      r = null
    }
    if (!r || !r.ok) {
      fechado = true
      ouvintes.delete(id)
      try { proc.disconnect() } catch {}
      try { fonte.disconnect() } catch {}
      return null
    }
    pronto = true
    for (const b of guardado.splice(0)) window.sb.ditadoVivo.audio(id, b).catch(() => {})
    return {
      id,
      get recebeu() {
        return o.recebeu
      },
      pausar(sim) {
        pausado = !!sim
      },
      fechar() {
        if (fechado) return
        fechado = true
        try { proc.disconnect() } catch {}
        try { fonte.disconnect() } catch {}
        window.sb.ditadoVivo.fechar(id).catch(() => {})
      },
    }
  }

  return { abrir, paraPcm16k }
})
