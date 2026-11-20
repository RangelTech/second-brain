// Palavra de ativação (spec 54, estilo "Alexa"): com o app aberto (inclusive escondido na bandeja), a pessoa fala a frase configurada
// ("Olá, cérebro") e a janela aparece já na conversa por voz. A escuta da frase é 100% NO COMPUTADOR (Vosk, modelo offline em
// português que já vem no app, com uma gramática só com a frase): nenhum áudio sai daqui até a conversa começar. Durante a
// conversa por voz o microfone fica com ela; ao fechar, a escuta da frase volta.
;(function () {
  const N = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  const PADRAO = 'Olá cérebro'
  let modelo = null // carregado uma vez (32 MB, ~2 s)
  let carregando = null
  let esc = null // { fluxo, ctx, proc, rec }
  let ultimo = 0
  let frase = PADRAO
  let ligado = false

  const registrar = (m) => { try { console.info('[ativacao]', m) } catch {} }
  function carregarScript() {
    if (window.Vosk) return Promise.resolve()
    return new Promise((ok, falha) => {
      const s = document.createElement('script')
      s.src = 'vendor/vosk.js'
      s.onload = ok
      s.onerror = () => falha(new Error('vosk.js'))
      document.head.appendChild(s)
    })
  }
  async function garantirModelo() {
    if (modelo) return modelo
    if (!carregando) {
      carregando = (async () => {
        await carregarScript()
        const bytes = await window.sb.ditadoModelo()
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/gzip' }))
        modelo = await window.Vosk.createModel(url)
        return modelo
      })().catch((e) => ((carregando = null), Promise.reject(e)))
    }
    return carregando
  }

  async function escutar() {
    if (esc || !ligado || (window.SBVozConversa && window.SBVozConversa.ativo())) return
    try {
      const m = await garantirModelo()
      if (esc || !ligado || (window.SBVozConversa && window.SBVozConversa.ativo())) return
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } })
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      // gramática só com a frase (com e sem acento): o reconhecedor nem tenta entender o resto da conversa da casa
      const gram = [...new Set([frase.toLowerCase(), N(frase)])].concat('[unk]')
      const rec = new m.KaldiRecognizer(ctx.sampleRate, JSON.stringify(gram))
      const confere = (t) => {
        if (!t || !N(t).includes(N(frase))) return
        if (Date.now() - ultimo < 4000) return
        ultimo = Date.now()
        registrar('frase ouvida: ' + t)
        disparar()
      }
      rec.on('result', (msg) => confere(msg && msg.result && msg.result.text))
      rec.on('partialresult', (msg) => confere(msg && msg.result && msg.result.partial))
      const src = ctx.createMediaStreamSource(fluxo)
      const proc = ctx.createScriptProcessor(4096, 1, 1)
      proc.onaudioprocess = (e) => { try { rec.acceptWaveformFloat(e.inputBuffer.getChannelData(0), ctx.sampleRate) } catch {} }
      src.connect(proc)
      proc.connect(ctx.destination)
      esc = { fluxo, ctx, proc, rec }
      registrar('escutando a frase "' + frase + '"')
    } catch (e) {
      registrar('não consegui escutar: ' + ((e && e.message) || e))
    }
  }
  function soltar() {
    const e = esc
    esc = null
    if (!e) return
    try { e.proc.disconnect() } catch {}
    try { e.fluxo.getTracks().forEach((t) => t.stop()) } catch {}
    try { e.ctx.close() } catch {}
    try { e.rec.remove && e.rec.remove() } catch {}
  }
  async function disparar() {
    soltar() // o microfone passa para a conversa por voz
    try { await window.sb.janelaMostrar() } catch {}
    setTimeout(() => window.SBVozConversa && !window.SBVozConversa.ativo() && window.SBVozConversa.iniciar(), 250)
  }

  async function reconfigurar() {
    let c = {}
    try { c = await window.sb.cfg() } catch {}
    const nova = String(c.palavraAtivacao || PADRAO).trim() || PADRAO
    const mudou = nova !== frase
    frase = nova
    ligado = !!c.ativacaoLigada && !window.__sbWeb // na web (navegador remoto) não: lá quem escuta é o computador
    if (!ligado || mudou) soltar()
    if (ligado) escutar()
  }
  // a conversa por voz pega o microfone; quando ela fecha, a escuta da frase volta
  setInterval(() => {
    if (!ligado) return
    const conversa = window.SBVozConversa && window.SBVozConversa.ativo()
    if (conversa && esc) soltar()
    else if (!conversa && !esc) escutar()
  }, 1500)

  window.SBAtivacao = { reconfigurar, estado: () => ({ ligado, frase, escutando: !!esc, modelo: !!modelo }), testar: (t) => N(t).includes(N(frase)) }
  setTimeout(reconfigurar, 3000)
})()
