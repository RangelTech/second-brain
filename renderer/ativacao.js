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
  let envios = 0 // pedaços de áudio mandados ao reconhecedor (medição)
  let medida = null

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

  // uma escuta por vez: o vigia de 1,5 s chamava escutar() de novo enquanto o modelo carregava (~40 s) e abria dezenas de
  // microfones e reconhecedores em paralelo, todos gastando CPU (medido 21/11/2026)
  let abrindo = false
  // nativo: null = ainda não tentou; true = o processo nativo do app confere a frase (leve); false = WebAssembly na janela (reserva)
  let nativo = null
  const confere = (t) => {
    if (!t || !N(t).includes(N(frase))) return
    if (Date.now() - ultimo < 4000) return
    ultimo = Date.now()
    registrar('frase ouvida: ' + t)
    disparar()
  }
  if (window.sb.aoAtivacaoOuvido) window.sb.aoAtivacaoOuvido((t) => esc && confere(t))
  const int16 = (f) => {
    const o = new Int16Array(f.length)
    for (let i = 0; i < f.length; i++) o[i] = Math.max(-32768, Math.min(32767, f[i] * 32767))
    return o
  }
  async function escutar() {
    if (esc || abrindo || !ligado || (window.SBVozConversa && window.SBVozConversa.ativo())) return
    abrindo = true
    try { await abrirEscuta() } finally { abrindo = false }
  }
  async function abrirEscuta() {
    try {
      if (nativo === null && window.sb.ativacaoAbrir && window.sb.ativacaoAudio) {
        const r = await window.sb.ativacaoAbrir(frase).catch((e) => ({ ok: false, erro: e && e.message }))
        nativo = !!(r && r.ok)
        registrar(nativo ? 'escuta da frase no processo nativo' : 'reconhecedor nativo indisponível (' + ((r && r.erro) || '?') + '); uso o do navegador')
      }
      const m = nativo ? null : await garantirModelo()
      if (esc || !ligado || (window.SBVozConversa && window.SBVozConversa.ativo())) return
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } })
      // 16 kHz direto do navegador: a 48 kHz o reconhecedor (worker WASM) não dava conta em tempo real, ficava 100% ocupado e a
      // fila de áudio crescia sem fim até derrubar a janela (medido 21/11/2026). O modelo é de 16 kHz, então não perde nada.
      const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 })
      // gramática só com a frase (com e sem acento): o reconhecedor nem tenta entender o resto da conversa da casa
      const gram = [...new Set([frase.toLowerCase(), N(frase)])].concat('[unk]')
      const rec = nativo ? null : new m.KaldiRecognizer(ctx.sampleRate, JSON.stringify(gram))
      // Só manda áudio ao reconhecedor quando tem voz, e nunca deixa fila: o worker do Vosk responde 1 evento por pedaço; com mais
      // de 2 pedaços sem resposta o áudio novo é descartado. Silêncio (quase o tempo todo) não custa nada.
      let pendentes = 0
      const volta = () => { if (pendentes > 0) pendentes-- }
      if (rec) {
        rec.on('result', (msg) => (volta(), confere(msg && msg.result && msg.result.text)))
        rec.on('partialresult', (msg) => (volta(), confere(msg && msg.result && msg.result.partial)))
      }
      const src = ctx.createMediaStreamSource(fluxo)
      const proc = ctx.createScriptProcessor(4096, 1, 1) // 4096 a 16 kHz = 256 ms por pedaço
      let piso = 0.004 // ruído de fundo, aprendido devagar
      let falaAte = 0
      let anterior = null // o pedaço (256 ms) de antes da voz começar: o "Olá" não pode ficar de fora
      let ultEnvio = 0
      // Filtro de "começo de fala" (22/11/2026): quem chama o assistente começa pela frase depois de uma pausa. Só os primeiros
      // 3,2 s depois de uma pausa de 0,5 s vão ao reconhecedor; fala corrida (TV, curso tocando, conversa) não mantém o processo
      // nativo carregado. Medido antes: em ambiente com som contínuo a janela mandava ~100% do tempo e ele nunca descansava.
      let quietoDesde = 0, janelaAte = -1, fechouJanela = true
      proc.onaudioprocess = (e) => {
        try {
          const d = e.inputBuffer.getChannelData(0)
          let s = 0
          for (let i = 0; i < d.length; i += 4) s += d[i] * d[i]
          const rms = Math.sqrt(s / (d.length / 4))
          medida = { sr: ctx.sampleRate, n: d.length, rms: +rms.toFixed(4), piso: +piso.toFixed(4), pendentes }
          const agora = ctx.currentTime
          const voz = rms > Math.max(0.012, piso * 3)
          if (voz) {
            if (quietoDesde && agora - quietoDesde >= 0.5) { janelaAte = agora + 3.2; fechouJanela = false }
            quietoDesde = 0
            falaAte = agora + 1.2
          } else {
            piso = piso * 0.95 + rms * 0.05
            if (!quietoDesde) quietoDesde = agora
          }
          const copia = new Float32Array(d)
          if (agora > falaAte) return void (anterior = copia)
          if (nativo) { // processo nativo: manda o pedaço e pronto (ele dá conta em tempo real; sem fila na janela)
            if (agora > janelaAte) {
              // fim da janela no meio da fala: 0,6 s de silêncio para o reconhecedor fechar a frase e dar o resultado final
              if (!fechouJanela) { fechouJanela = true; window.sb.ativacaoAudio(new Int16Array(9600)) }
              anterior = copia
              return
            }
            if (anterior) { window.sb.ativacaoAudio(int16(anterior)); anterior = null }
            envios++
            window.sb.ativacaoAudio(int16(copia))
            return
          }
          if (pendentes > 2 && agora - ultEnvio < 3) return
          if (pendentes > 2) pendentes = 0 // sem resposta há 3 s: não fica surdo por causa da conta
          ultEnvio = agora
          if (anterior) { pendentes++; rec.acceptWaveformFloat(anterior, ctx.sampleRate); anterior = null }
          pendentes++
          envios++
          rec.acceptWaveformFloat(copia, ctx.sampleRate)
        } catch {}
      }
      src.connect(proc)
      proc.connect(ctx.destination)
      esc = { fluxo, ctx, proc, rec }
      if (!ligado || (window.SBVozConversa && window.SBVozConversa.ativo())) return void soltar() // desligaram enquanto abria
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
    if (!ligado || mudou) {
      soltar()
      if (nativo && window.sb.ativacaoFechar) window.sb.ativacaoFechar().catch(() => {}) // libera o processo (ou reabre com a frase nova)
      nativo = null
    }
    if (ligado) escutar()
  }
  // a conversa por voz pega o microfone; quando ela fecha, a escuta da frase volta
  setInterval(() => {
    if (!ligado) return
    const conversa = window.SBVozConversa && window.SBVozConversa.ativo()
    if (conversa && esc) soltar()
    else if (!conversa && !esc) escutar()
  }, 1500)

  window.SBAtivacao = { reconfigurar, estado: () => ({ ligado, frase, escutando: !!esc, nativo, modelo: !!modelo, envios, medida }), testar: (t) => N(t).includes(N(frase)) }
  setTimeout(reconfigurar, 3000)
})()
