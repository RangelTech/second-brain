// Conversa por voz (spec 45 §F, refeita na spec 52): o usuário fala, o agente responde falando, como numa conversa.
// Os cartões do chat somem, o cérebro do fundo toma a cena e uma auréola de barras pulsa com o som (microfone quando a pessoa fala,
// a voz da IA quando ela fala).
//
// Ciclo: OUVIR (stream de voz ao vivo: o texto aparece enquanto a pessoa fala) → fim de turno na pausa grande (silêncio no microfone
// + texto parado, ou o fim de fala do servidor) → PENSAR (a orb da etapa corre ao centro da auréola e cresce; depois de ~1 s ele diz
// "Deixa eu pensar"; em trabalho com ferramentas ele fala a etapa: "Estou lendo os arquivos") → FALAR (voz neural escolhida nas
// Configurações, frase a frase) → ouvir de novo.
// Interrupção em 2 tempos: voz forte por cima abaixa a IA na hora; se o stream confirmar palavras de verdade (não o eco dela), ela para,
// o turno do agente é cancelado e o que a pessoa disse vira o próximo pedido. Tosse ou barulho: o volume volta.
// Sem stream (servidor fora, navegador antigo): grava frase a frase e transcreve como antes.
(function () {
  const $ = (id) => document.getElementById(id)
  const P = () => window.__sbVoz // ponte exposta pelo app.js (enviar, estado da resposta, cancelar, ferramentas, cérebro)
  const F = window.SBVozFrases
  let st = null // estado da sessão de voz

  const ESTADOS = { ouvindo: 'Pode falar…', transcrevendo: 'Entendendo…', pensando: 'Pensando…', falando: 'Falando… (fale por cima para interromper)', erro: '' }
  const FIM_SILENCIO_MS = 1100 // pausa grande: silêncio no microfone
  const FIM_TEXTO_PARADO_MS = 650 // ...e o texto parou de mudar
  const ABAIXAR_MS = 250 // voz forte por cima por esse tempo abaixa a IA
  const CONFIRMAR_MS = 1600 // prazo para o stream confirmar que era fala (senão o volume volta)
  const ESPERA_MS = 1200 // sem resposta nesse tempo: "Deixa eu pensar"
  const ETAPA_MIN_MS = 12000 // fala de etapa no máximo a cada 12 s (5 s virou ladainha nas buscas seguidas)
  const MESMA_ETAPA_MS = 35000 // a mesma etapa só volta a ser comentada depois disso, e com frase de andamento

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
    p.innerHTML = '<canvas class="voz-aureola" aria-hidden="true"></canvas><div class="voz-cartoes" aria-live="polite"></div>' +
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
      if (st.vivo) st.vivo.pausar(st.mudo)
      if (st.mudo && st.fase === 'ouvindo') {
        st.ouvido = ''
        st.prefixo = st.ultimoTexto
        descartarFrase()
      }
      fase(st.fase)
    }
    return p
  }

  function fase(f, legenda) {
    if (!st) return
    const antes = st.fase
    st.fase = f
    const p = $('voz-palco')
    p.dataset.fase = f
    p.querySelector('.voz-estado').textContent = st.mudo && f === 'ouvindo' ? 'Microfone silenciado' : ESTADOS[f] || f
    if (legenda !== undefined) p.querySelector('.voz-legenda').textContent = legenda
    if (antes !== f) focar()
  }

  // a orb da etapa vai ao centro da auréola enquanto ele pensa; nos outros momentos ela volta a passear
  function focar() {
    if (!st) return
    if (st.fase !== 'pensando') return P().focoOrb(null)
    const r = st.canvas.getBoundingClientRect()
    // a orb vai ao centro do cérebro (onde o anel está) com o tamanho de dentro do anel
    P().focoOrb({ raio: Math.min(r.width, r.height) * 0.2 * 0.78 })
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
    // o anel fica em volta do CENTRO DO CÉREBRO do fundo (o mesmo ponto para onde a orb da etapa vai): tudo concêntrico
    let cx = w / 2, cy = h * 0.44
    const c = P().centroCerebro && P().centroCerebro()
    if (c) {
      const r = cv.getBoundingClientRect()
      cx = c.x - r.left
      cy = c.y - r.top
    }
    const raio = Math.min(w, h) * 0.2
    // fonte do som: a voz da IA quando ela fala (resposta ou frase de espera), o microfone nos outros momentos
    const an = st.tocando && st.anSaida ? st.anSaida : st.anMic
    let nivel = 0
    if (an) {
      an.getByteFrequencyData(st.freq)
      for (let i = 0; i < N_BARRAS; i++) {
        // espelha as frequências dos dois lados para o anel ficar simétrico
        const k = i < N_BARRAS / 2 ? i : N_BARRAS - 1 - i
        const idx = 2 + Math.floor((k / (N_BARRAS / 2)) * (st.freq.length * 0.45))
        const alvo = st.mudo && !st.tocando ? 0 : st.freq[idx] / 255
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
    const pensando = st.fase === 'pensando' || st.fase === 'transcrevendo'
    const giro = pensando ? t * 0.6 : 0
    g.lineCap = 'round'
    for (let i = 0; i < N_BARRAS; i++) {
      const a = (i / N_BARRAS) * Math.PI * 2 - Math.PI / 2 + giro
      const base = 3 + respira * 2
      const comp = base + st.alt[i] * raio * 0.85 + (pensando && !st.tocando ? 4 * (0.5 + 0.5 * Math.sin(t * 4 + i * 0.35)) : 0)
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

  // ---------- ouvir pelo stream ao vivo ----------
  async function abrirStream() {
    if (!window.SBVozStream) return null
    return window.SBVozStream.abrir(st.ctx, st.fluxo, {
      aoTexto: (t) => st && aoTexto(t),
      aoFimDeFala: () => st && aoFimDeFala(),
      aoErro: (_m, recebeu) => {
        if (!st || !st.vivo) return
        // caiu: segue pelo caminho antigo (grava frase a frase) sem a pessoa perceber
        st.vivo = null
        if (!recebeu) registrar('stream de voz não abriu; usando o ditado por frases')
        if (st.fase === 'ouvindo' && !st.frase) novaFrase()
      },
    })
  }
  const registrar = (m) => { try { console.info('[voz]', m) } catch {} }
  const vozRecente = () => performance.now() - st.ultimaVoz < 1800
  function ouvidoAgora(t) {
    return [st.base, F.resto(t, st.prefixo)].map((s) => (s || '').trim()).filter(Boolean).join(' ')
  }
  // o texto novo é a própria IA (o que ela está falando ou falou nos últimos segundos) entrando pelo microfone?
  function ehEcoRecente(novo) {
    const agora = performance.now()
    st.falados = st.falados.filter((f) => f.ate > agora)
    return st.falados.some((f) => F.ehEco(novo, f.t))
  }
  function aoTexto(t) {
    st.ultimoTexto = t
    st.textoEm = performance.now()
    if (st.mudo) return
    const novo = F.resto(t, st.prefixo)
    if (novo && ehEcoRecente(novo)) {
      // eco: consome esse pedaço para ele não virar pedido
      st.prefixo = t
      return
    }
    if (st.fase === 'ouvindo') {
      st.ouvido = ouvidoAgora(t)
      $('voz-palco').querySelector('.voz-legenda').textContent = st.ouvido
      return
    }
    if (!novo || !vozRecente()) return
    const palavras = F.palavras(novo)
    if (st.fase === 'pensando' && palavras.length >= 2) {
      // falou de novo enquanto ele pensava: completou o pedido ou mudou de ideia. Para o turno e junta tudo num pedido só.
      const anterior = st.enviado || ''
      interromper()
      st.base = F.soParar(novo) ? '' : anterior
      st.ouvido = ouvidoAgora(t)
      fase('ouvindo', st.ouvido)
      return
    }
    if (st.tocando && palavras.length >= 1 && (st.abaixou || palavras.length >= 2)) {
      // confirmou: era gente falando por cima. Para a IA; o que foi dito começa o próximo pedido.
      interromper()
      st.base = ''
      st.ouvido = F.soParar(novo) ? '' : ouvidoAgora(t)
      if (!st.ouvido) st.prefixo = t
      fase('ouvindo', st.ouvido)
    }
  }
  function aoFimDeFala() {
    const fala = st.fase === 'ouvindo' && st.ouvido.trim()
    st.prefixo = ''
    st.ultimoTexto = ''
    if (fala) finalizarTurno(true)
  }
  function finalizarTurno(peloServidor) {
    const texto = st.ouvido.trim()
    // tudo o que o stream mandou até aqui é desta fala; o que vier depois (pontuação final, repetição) não conta de novo
    if (!peloServidor) st.prefixo = st.ultimoTexto
    st.ouvido = ''
    st.base = ''
    if (!texto || F.soParar(texto)) return fase('ouvindo', '')
    responder(texto)
  }

  // ---------- ouvir sem stream (gravação por frase, caminho antigo) ----------
  function novaFrase() {
    const rec = new MediaRecorder(st.fluxo, st.mime ? { mimeType: st.mime, audioBitsPerSecond: 32000 } : {})
    const partes = []
    const fr = { rec, falou: 0, ini: performance.now(), descartar: false }
    rec.ondataavailable = (e) => e.data && e.data.size && partes.push(e.data)
    rec.onstop = async () => {
      if (!st || fr.descartar) return
      const blob = new Blob(partes, { type: rec.mimeType || st.mime || 'audio/webm' })
      if (fr.falou < 350 || blob.size < 1500) { if (st && st.fase === 'ouvindo' && !st.vivo) novaFrase(); return }
      await transcreverFrase(blob)
    }
    rec.start(400)
    st.frase = fr
  }
  function descartarFrase() {
    if (!st || !st.frase) return
    st.frase.descartar = true
    try { st.frase.rec.stop() } catch {}
    st.frase = null
    if (!st.mudo && st.fase === 'ouvindo' && !st.vivo) novaFrase()
  }
  async function transcreverFrase(blob) {
    if (!st) return
    const sessao = st
    st.frase = null
    fase('transcrevendo')
    let r
    try { r = await window.sb.ditadoServidor(new Uint8Array(await blob.arrayBuffer()), blob.type) } catch { r = null }
    if (st !== sessao) return
    const texto = r && r.ok ? String(r.texto || '').trim() : ''
    if (!texto) { fase('ouvindo', r && !r.ok ? 'Não consegui entender agora. Fale de novo.' : ''); novaFrase(); return }
    enviarAoAgente(texto)
  }

  // ---------- medidor do microfone: pausa grande, interrupção ----------
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
    if (fala) (st.ultimaVoz = agora), (st.quieto = 0)
    else st.quieto += dt
    if (st.fase === 'ouvindo') {
      if (st.vivo) {
        // pausa grande: já tem texto, o microfone ficou quieto e o texto parou de mudar
        if (st.ouvido.trim() && st.quieto >= FIM_SILENCIO_MS && agora - st.textoEm >= FIM_TEXTO_PARADO_MS) finalizarTurno(false)
      } else if (st.frase) {
        if (fala) st.frase.falou += dt
        const dur = agora - st.frase.ini
        // frase terminou: falou e fez pausa de ~0,8 s (ou falou muito tempo e deu uma pausa curta)
        if (st.frase.falou >= 400 && ((st.quieto >= 800 && dur >= 1200) || (dur >= 20000 && st.quieto >= 200))) {
          const r = st.frase.rec
          st.frase.fechada = true
          fase('transcrevendo')
          try { r.stop() } catch {}
        }
      }
    } else if (st.tocando) {
      const forte = fala && rms > Math.max(0.03, st.piso * 4)
      st.cima = forte ? st.cima + dt : Math.max(0, st.cima - dt * 0.5)
      if (!st.vivo) {
        // sem stream não dá para confirmar palavras: interrompe pela voz forte e contínua
        if (st.cima >= 350) (st.cima = 0), interromper(), fase('ouvindo', ''), novaFrase()
      } else if (!st.abaixou && st.cima >= ABAIXAR_MS) {
        // 1º tempo: abaixa a IA na hora (a pessoa sente que foi ouvida); o stream decide se para
        st.abaixou = agora
        if (st.tocando.volume !== undefined) st.tocando.volume = 0.2
      } else if (st.abaixou && agora - st.abaixou > CONFIRMAR_MS) {
        // não vieram palavras (tosse, barulho, eco): volta o volume
        st.abaixou = 0
        st.cima = 0
        if (st.tocando.volume !== undefined) st.tocando.volume = 1
      }
    }
    st.medidor = requestAnimationFrame(medir)
  }

  // ---------- cérebro de voz (spec 54): modelo rápido na frente; o Hermes só entra para TAREFA ----------
  let cerebroLigado = false
  function ligarCerebro() {
    if (cerebroLigado || !window.sb.vozCerebro) return
    cerebroLigado = true
    window.sb.vozCerebro.aoEvento((e) => st && st.cerebroOuvinte && st.cerebroOuvinte(e))
  }
  // fala frase por frase enquanto o texto chega (a 1ª frase já sai em ~1-2 s); a síntese de cada frase é pedida assim que ela fecha
  function criarFala(sessao, turno) {
    let buf = '', total = '', comecou = false, laco = null
    const fila = []
    const valido = () => st === sessao && st.turno === turno
    async function tocarFila() {
      while (fila.length && valido()) {
        const it = fila.shift()
        if (!comecou) (comecou = true), clearTimeout(st.timerEspera), fase('falando', '')
        let foi = false
        if (it.h) foi = await tocarTTS(it.h, it.frase)
        if (!foi && valido()) {
          const r = await sintetizar(it.frase)
          if (r && r.ok && valido()) await tocar(r, it.frase)
          else if (valido()) await falarSistema(it.frase)
        }
      }
      laco = null
    }
    function empurrar(frase) {
      frase = paraFala(frase)
      if (!frase || !valido()) return
      registrar('fala: ' + frase)
      fila.push({ frase, h: temStreamTTS() ? pedirTTS(frase) : null })
      if (!laco) laco = tocarFila()
    }
    return {
      add(d) {
        buf += d
        total += d
        let m
        while ((m = /^([\s\S]*?[.!?…])(\s+)/.exec(buf)) && m[1].trim().length >= 12) (empurrar(m[1]), (buf = buf.slice(m[0].length)))
      },
      falar(frase) { total += (total ? ' ' : '') + frase; empurrar(frase) },
      async fim() {
        if (buf.trim()) empurrar(buf)
        buf = ''
        while (laco) await laco
      },
      get comecou() { return comecou },
      get texto() { return total },
    }
  }
  function lembrar(papel, texto) {
    if (!st || !texto) return
    st.historico.push({ role: papel, content: String(texto).slice(0, 2000) })
    if (st.historico.length > 16) st.historico.splice(0, st.historico.length - 16)
  }
  async function responder(texto) {
    if (!st) return
    const cmd = F.comandoDeVoz(texto)
    if (cmd === 'mudo') return silenciarPorVoz()
    if (cmd === 'fechar') {
      const fala = criarFala(st, st.turno)
      fala.falar(st.sortear(['Até mais! Quando quiser, é só me chamar.', 'Fechado. Tô por aqui quando precisar.', 'Beleza, até daqui a pouco!']))
      await fala.fim()
      return encerrar()
    }
    if (!window.sb.vozCerebro) return enviarAoAgente(texto)
    ligarCerebro()
    const sessao = st
    const turno = ++st.turno
    st.enviado = texto
    st.cima = 0
    st.cartoesVistos = new Set()
    fase('pensando', '“' + texto + '”')
    const fala = criarFala(sessao, turno)
    const vivo = () => st === sessao && st.turno === turno
    // a resposta direta costuma começar em ~2 s; se demorar mais, uma frase de espera para não deixar no vácuo
    // com intenção clara ("pesquisa", "cria um arquivo", "abre o site") a frase de espera já diz o que vai fazer
    st.timerEspera = setTimeout(() => vivo() && !st.tocando && !fala.comecou && falarCurta(F.fraseDeAbertura(texto, st.sortear) || st.sortear(F.ESPERA)), 1800)
    const id = 'c' + Date.now() + Math.random().toString(36).slice(2, 6)
    let agente = null, erro = false
    await new Promise((ok) => {
      st.cerebroOuvinte = (e) => {
        if (e.id !== id || !vivo()) return
        if (e.tipo === 'delta') fala.add(e.data)
        else if (e.tipo === 'youtube') mostrarYoutube(e.video, e.titulo)
        else if (e.tipo === 'imagens') mostrarCartoes((e.lista || []).map((x) => ({ src: x.src, reserva: x.reserva, alt: x.titulo })))
        else if (e.tipo === 'limpar') recolherCartoes()
        else if (e.tipo === 'agente') agente = { tarefa: e.tarefa, aviso: e.aviso }
        else if (e.tipo === 'erro') (erro = true), ok()
        else if (e.tipo === 'fim') ok()
      }
      window.sb.vozCerebro.perguntar(id, { texto, historico: st.historico, nome: st.nome }).then((r) => { if (!r || !r.ok) (erro = true), ok() }).catch(() => ((erro = true), ok()))
    })
    if (!vivo()) return
    st.cerebroOuvinte = null
    if (erro && !fala.comecou && !agente) return enviarAoAgente(texto) // sem o cérebro rápido: o caminho de antes, pelo Hermes
    lembrar('user', texto)
    if (agente) {
      // TAREFA: o aviso sai já (sem repetir se o modelo já falou algo parecido) e o Hermes completo trabalha narrando
      if (!fala.texto.trim()) fala.falar(agente.aviso)
      await fala.fim()
      if (!vivo()) return
      lembrar('assistant', fala.texto)
      return executarComAgente(agente.tarefa, texto, sessao, turno)
    }
    await fala.fim()
    if (!vivo()) return
    lembrar('assistant', fala.texto)
    try { P().registrarVoz(texto, fala.texto) } catch {}
    fase('ouvindo', '')
  }
  // "silenciar o microfone" por voz: silencia e avisa que para voltar é no botão (sem escutar não dá para ouvir o "volta")
  function silenciarPorVoz() {
    const b = $('voz-palco').querySelector('.voz-mudo')
    const fala = criarFala(st, st.turno)
    fala.falar('Microfone silenciado. Quando quiser falar de novo, é só tocar no botão.')
    fala.fim().then(() => { if (st && !st.mudo && b) b.click() })
  }
  // tarefa de verdade: vai para o Hermes completo (a mesma conversa do chat) e a voz narra o caminho até o resultado
  async function executarComAgente(tarefa, original, sessao, turno) {
    const vivo = () => st === sessao && st.turno === turno
    fase('pensando', '“' + original + '”')
    // navegador só quando a pessoa pediu ou quando é preciso agir num site (abrir no automático fez site barrar como robô, 20/11)
    const pediuSite = /navegador|site|p[áa]gina|abr[ea]|entr[ae]|login|logar|whatsapp|instagram|facebook|tiktok|youtube|linkedin|gmail|e-?mail/i.test(original)
    const id = P().enviarTexto('🎙️ ' + tarefa + (pediuSite ? '' : '\n\n(Pesquise pela busca na web; não abra o navegador integrado, a não ser que precise agir dentro de um site.)'))
    if (!id) return fase('ouvindo', 'Escolha um modelo antes de conversar.')
    st.chat = id
    st.ultimaEtapa = Date.now()
    st.ultimoProgresso = Date.now()
    st.ultimaCat = null
    st.etapaPendente = null
    st.etapasDitas = {}
    const t0 = Date.now()
    while (vivo() && P().ocupado(id)) {
      await new Promise((ok) => setTimeout(ok, 400))
      mostrarCartoes(imagensNaTela())
      narrarPendente()
      // a cada ~20 s sem nada falado, conta em que etapa está ("Ainda tô nisso: estou lendo os arquivos")
      if (vivo() && !st.tocando && Date.now() - Math.max(st.ultimaEtapa, st.ultimoProgresso) > 30000) {
        st.ultimoProgresso = Date.now()
        falarCurta(st.ultimaCat ? F.fraseDeAndamento(st.ultimaCat, st.sortear) : st.sortear(F.ESPERA_LONGA), true)
      }
      if (Date.now() - t0 > 60 * 60 * 1000) break
    }
    if (!vivo()) return
    const resp = P().ultimaResposta(id)
    if (/\[\[tela:limpar\]\]/i.test(resp)) recolherCartoes()
    mostrarCartoes([...imagensNaTela(), ...imagensDoTexto(resp)])
    // o resultado do Hermes vem formatado para ler; o cérebro de voz conta em texto corrido
    const fala = criarFala(sessao, turno)
    let ok = false
    if (window.sb.vozCerebro) {
      const rid = 'r' + Date.now()
      ok = await new Promise((fim) => {
        st.cerebroOuvinte = (e) => {
          if (e.id !== rid || !vivo()) return
          if (e.tipo === 'delta') fala.add(e.data)
          else if (e.tipo === 'fim') fim(true)
          else if (e.tipo === 'erro') fim(false)
        }
        window.sb.vozCerebro.perguntar(rid, { modo: 'resumir', nome: st.nome, historico: st.historico, texto: 'Pedido: ' + original + '\n\nResultado do agente:\n' + String(resp || '').slice(0, 6000) }).then((r) => { if (!r || !r.ok) fim(false) }).catch(() => fim(false))
      })
    }
    if (!vivo()) return
    if (!ok && !fala.comecou) return (await falarResposta(resp, turno)), vivo() && fase('ouvindo', '')
    await fala.fim()
    if (!vivo()) return
    lembrar('assistant', fala.texto)
    fase('ouvindo', '')
  }

  // ---------- pensar: agente, frases de espera, etapas ----------
  async function enviarAoAgente(texto) {
    if (!st) return
    const sessao = st
    const turno = ++st.turno
    st.enviado = texto
    st.cima = 0
    fase('pensando', '“' + texto + '”')
    st.cartoesVistos = new Set()
    const id = P().enviarTexto('🎙️ ' + texto) // o SOUL sabe: pedido falado = resposta curta, de conversa, com imagem em cartão
    if (!id) { fase('ouvindo', 'Escolha um modelo antes de conversar.'); if (!st.vivo) novaFrase(); return }
    st.chat = id
    st.ultimaEtapa = 0
    st.etapasDitas = {}
    // não deixar no vácuo: sem resposta em ~1 s, uma frase de espera; trabalho longo, outra de vez em quando
    let esperas = 0
    const t0 = Date.now()
    // com intenção clara ("pesquisa", "meus arquivos", "abre o site"...) ele já diz na hora o que vai fazer, como quem entendeu;
    // sem intenção, o "deixa eu pensar" só entra se a resposta demorar
    const abertura = F.fraseDeAbertura(texto, st.sortear)
    if (abertura) (st.ultimaEtapa = Date.now()), falarCurta(abertura)
    else st.timerEspera = setTimeout(() => vivo() && !st.tocando && falarCurta(st.sortear(F.ESPERA)), ESPERA_MS)
    function vivo() { return st === sessao && st.turno === turno && st.fase === 'pensando' }
    while (st === sessao && st.turno === turno && P().ocupado(id)) {
      await new Promise((ok) => setTimeout(ok, 300))
      mostrarCartoes(imagensNaTela())
      const quieto = Date.now() - Math.max(st.ultimaEtapa, t0)
      if (vivo() && !st.tocando && esperas < 3 && quieto > 11000) {
        esperas++
        st.ultimaEtapa = Date.now()
        falarCurta(st.sortear(F.ESPERA_LONGA))
      }
      if (Date.now() - t0 > 15 * 60 * 1000) break
    }
    clearTimeout(st && st.timerEspera)
    if (st !== sessao || st.turno !== turno) return // interrompido: quem interrompeu já cuidou da fase
    const resp = P().ultimaResposta(id)
    if (/\[\[tela:limpar\]\]/i.test(resp)) recolherCartoes() // o agente decidiu tirar o que estava na tela
    mostrarCartoes([...imagensNaTela(), ...imagensDoTexto(resp)])
    await falarResposta(resp, turno)
    if (st !== sessao || st.turno !== turno) return
    fase('ouvindo', '')
    if (!st.mudo && !st.vivo) novaFrase()
  }
  // ferramenta nova no turno da voz: fala a etapa (no máx. 1 a cada 7 s, nunca por cima de outra fala)
  function aoFerramenta({ chat, cat, fim, falhou }) {
    if (!st || st.chat !== chat || st.fase !== 'pensando') return
    if (fim && !falhou) return // sucesso: a próxima etapa já conta o andamento
    if (!fim) st.ultimaCat = cat
    // falando agora ou cedo demais: a etapa fica guardada e sai assim que der (o laço da tarefa confere)
    st.etapaPendente = falhou ? 'falha' : cat
    narrarPendente()
  }
  function narrarPendente() {
    if (!st || !st.etapaPendente || st.tocando || st.fase !== 'pensando') return
    const falha = st.etapaPendente === 'falha'
    if (Date.now() - st.ultimaEtapa < (falha ? 2500 : ETAPA_MIN_MS)) return
    const cat = st.etapaPendente
    st.etapaPendente = null
    // cada etapa é anunciada UMA vez; repetida, só depois de MESMA_ETAPA_MS e com frase de andamento (nunca o mesmo anúncio)
    const ja = st.etapasDitas[cat]
    if (!falha && ja && Date.now() - ja < MESMA_ETAPA_MS) return
    st.etapasDitas[cat] = Date.now()
    st.ultimaEtapa = Date.now()
    clearTimeout(st.timerEspera)
    falarCurta(falha ? st.sortear(['Não deu certo dessa vez, vou tentar de outro jeito.', 'Opa, travou aqui. Vou tentar de novo.', 'Não consegui por esse caminho, tentando outro.']) : ja ? F.fraseDeAndamento(cat, st.sortear) : F.fraseDaEtapa(cat, st.sortear), true)
  }

  // ---------- cartões holográficos (spec 53): o que a IA quer MOSTRAR sai do centro do cérebro e para na lateral ----------
  function imagensDoTexto(texto) {
    const out = []
    // endereço da internet ou ARQUIVO do computador (gráfico que o agente gerou: C:\...\grafico.png, /home/.../x.png, file:///...)
    // internet: usa o endereço; arquivo (caminho completo OU só o nome, ex.: "grafico.png"): o app acha e entrega os bytes (vale também na web)
    for (const m of String(texto || '').matchAll(/!\[([^\]]*)\]\(<?([^)>]+?)>?\)/g)) {
      const src = m[2].trim()
      const video = /\.(mp4|webm|mov)$/i.test(src)
      if (/^https?:\/\//i.test(src)) out.push({ src, alt: m[1] || 'Imagem', video })
      else if (/\.(png|jpe?g|gif|webp|svg|mp4|webm|mov)$/i.test(src)) out.push({ arquivo: src, src: 'arquivo:' + src, alt: m[1] || 'Imagem', video })
    }
    return out
  }
  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' }
  async function carregarArquivo(nome, video) {
    try {
      const p = window.sb.acharArquivo ? await window.sb.acharArquivo(nome) : nome
      if (!p) return null
      const r = await window.sb.lerArquivo(p)
      if (!r || !r.ok) return null
      const bin = atob(r.base64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const ext = (/\.(\w+)$/.exec(p) || [])[1] || ''
      return URL.createObjectURL(new Blob([bytes], { type: MIME[ext.toLowerCase()] || (video ? 'video/mp4' : 'image/png') }))
    } catch {
      return null
    }
  }
  function imagensNaTela() {
    const msgs = document.querySelectorAll('.conversa .msg.assistant')
    const ult = msgs[msgs.length - 1]
    if (!ult) return []
    return [...ult.querySelectorAll('img.img-final, video.img-final')].map((el) => ({ src: el.currentSrc || el.src, alt: el.alt || 'Mídia', video: el.tagName === 'VIDEO' }))
  }
  // música/vídeo do YouTube num cartão maior, tocando. Enquanto toca, o microfone fica em pausa (senão ele "ouve" a letra da música)
  function mostrarYoutube(idVideo, titulo) {
    if (!st || !idVideo) return
    recolherCartoes()
    const caixa = $('voz-palco').querySelector('.voz-cartoes')
    const c = document.createElement('figure')
    c.className = 'voz-cartao voz-yt'
    const f = document.createElement('iframe')
    f.src = 'https://www.youtube.com/embed/' + encodeURIComponent(idVideo) + '?autoplay=1&rel=0&modestbranding=1'
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'
    f.referrerPolicy = 'strict-origin-when-cross-origin'
    f.title = titulo || 'Vídeo'
    c.appendChild(f)
    const leg = document.createElement('figcaption')
    leg.innerHTML = '<span></span><button type="button" class="yt-fechar" aria-label="Fechar o vídeo">✕</button>'
    leg.querySelector('span').textContent = titulo || 'YouTube'
    c.appendChild(leg)
    leg.querySelector('.yt-fechar').onclick = (ev) => { ev.stopPropagation(); fecharYoutube(c) }
    caixa.prepend(c)
    const centro = P().centroCerebro && P().centroCerebro()
    const r = c.getBoundingClientRect()
    if (centro && r.width) (c.style.setProperty('--dx', Math.round(centro.x - (r.left + r.width / 2)) + 'px'), c.style.setProperty('--dy', Math.round(centro.y - (r.top + r.height / 2)) + 'px'))
    c.classList.add('chega')
    st.ytAtivo = c
    if (!st.mudo) (st.mudoPeloVideo = true), $('voz-palco').querySelector('.voz-mudo').click()
    $('voz-palco').querySelector('.voz-legenda').textContent = 'Tocando: ' + (titulo || 'vídeo') + '. Para falar comigo, feche o vídeo ou toque no microfone.'
  }
  function fecharYoutube(c) {
    if (c) c.remove()
    if (!st) return
    st.ytAtivo = null
    if (st.mudoPeloVideo && st.mudo) $('voz-palco').querySelector('.voz-mudo').click()
    st.mudoPeloVideo = false
  }
  // recolhe os cartões de volta para o centro do cérebro (assunto novo ou o agente mandou limpar a tela)
  function recolherCartoes() {
    const caixa = $('voz-palco') && $('voz-palco').querySelector('.voz-cartoes')
    if (!caixa) return
    const centro = P().centroCerebro && P().centroCerebro()
    for (const c of [...caixa.children]) {
      if (c.classList.contains('sai')) continue
      const r = c.getBoundingClientRect()
      if (centro && r.width) {
        c.style.setProperty('--dx', Math.round(centro.x - (r.left + r.width / 2)) + 'px')
        c.style.setProperty('--dy', Math.round(centro.y - (r.top + r.height / 2)) + 'px')
      }
      c.classList.add('sai')
      setTimeout(() => (c.classList.contains('voz-yt') ? fecharYoutube(c) : c.remove()), 650)
    }
  }
  function mostrarCartoes(lista) {
    if (!st || !lista.length) return
    const caixa = $('voz-palco').querySelector('.voz-cartoes')
    // primeira imagem de um pedido novo: as do assunto anterior voltam para o cérebro antes
    if (lista.some((it) => it.src && !st.cartoesVistos.has(it.src)) && st.cartoesDoTurno !== st.turno) {
      st.cartoesDoTurno = st.turno
      recolherCartoes()
    }
    for (const it of lista) {
      if (!it.src || st.cartoesVistos.has(it.src)) continue
      st.cartoesVistos.add(it.src)
      const c = document.createElement('figure')
      c.className = 'voz-cartao'
      const midia = document.createElement(it.video ? 'video' : 'img')
      if (it.arquivo) carregarArquivo(it.arquivo, it.video).then((u) => (u ? (midia.src = u) : c.remove()))
      else midia.src = it.src
      if (it.video) Object.assign(midia, { autoplay: true, muted: true, loop: true, playsInline: true })
      else midia.alt = it.alt
      // site que bloqueia foto "de fora": tenta a miniatura do buscador antes de desistir do cartão
      midia.onerror = () => (it.reserva && midia.src !== it.reserva ? (midia.src = it.reserva) : c.remove())
      c.appendChild(midia)
      if (it.alt && !it.video) {
        const leg = document.createElement('figcaption')
        leg.textContent = it.alt
        c.appendChild(leg)
      }
      c.onclick = () => c.classList.toggle('grande')
      caixa.prepend(c)
      while (caixa.children.length > 3) caixa.lastChild.remove()
      // nasce no centro do cérebro e voa até o lugar dele
      const centro = P().centroCerebro && P().centroCerebro()
      const r = c.getBoundingClientRect()
      if (centro && r.width) {
        c.style.setProperty('--dx', Math.round(centro.x - (r.left + r.width / 2)) + 'px')
        c.style.setProperty('--dy', Math.round(centro.y - (r.top + r.height / 2)) + 'px')
      }
      c.classList.add('chega')
    }
  }

  // ---------- falar ----------
  function paraFala(texto) {
    let t = String(texto || '')
      .replace(/\[\[tela:[a-z]+\]\]/gi, ' ') // comando de tela: não é falado
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
  const sintetizar = (t) => (window.sb.vozFalar ? window.sb.vozFalar(t, st.voz).catch(() => ({ ok: false })) : Promise.resolve({ ok: false }))

  // ---- voz em stream: pede a síntese já (pode ser a do próximo bloco enquanto o atual toca) e toca no 1º pedaço que chegar ----
  const fluxosTTS = new Map()
  let ttsLigado = false
  const temStreamTTS = () => !!(window.sb.vozStream && window.MediaSource && MediaSource.isTypeSupported('audio/mpeg'))
  // A síntese do servidor às vezes demora a "acordar" (medido: 0,7 s quente, 4,8 a 9,7 s fria). Corrida: sem 1º pedaço em
  // RESERVA_MS, sai um 2º pedido igual; o que chegar primeiro toca e o outro é cancelado (a voz não custa nada).
  const RESERVA_MS = 2500
  function pedirTTS(texto) {
    if (!ttsLigado) {
      ttsLigado = true
      window.sb.vozStream.aoPedaco((ev) => {
        const x = ev && fluxosTTS.get(ev.id)
        if (!x) return
        const { h, id } = x
        if (ev.tipo === 'dados') {
          if (!h.dono) {
            h.dono = id
            clearTimeout(h.timer)
            for (const outro of h.ids) if (outro !== id) (fluxosTTS.delete(outro), window.sb.vozStream.parar(outro).catch(() => {}))
          }
          if (h.dono === id) h.pedacos.push(ev.data)
        } else if (ev.tipo === 'fim') {
          fluxosTTS.delete(id)
          if (h.dono === id || !h.dono) (h.fim = true), registrar(`tts ${h.texto.length} letras: 1º pedaço ${ev.data && ev.data.primeiro} ms, total ${ev.data && ev.data.total} ms${h.ids.length > 1 ? ' (pedido reserva)' : ''}`)
        } else {
          fluxosTTS.delete(id)
          h.falhas++
          if (h.dono === id || (!h.dono && h.falhas >= h.ids.length && !h.timer)) h.erro = String(ev.data || 'erro')
        }
        h.avisar && h.avisar()
      })
    }
    const h = { texto, ids: [], pedacos: [], fim: false, erro: null, avisar: null, dono: null, falhas: 0, timer: 0, pedido: performance.now() }
    const lancar = () => {
      const id = 't' + Date.now() + Math.random().toString(36).slice(2, 6)
      h.ids.push(id)
      fluxosTTS.set(id, { h, id })
      window.sb.vozStream.abrir(id, texto, st.voz).then((r) => {
        if (!r || !r.ok) (h.falhas++, fluxosTTS.delete(id)), h.falhas >= h.ids.length && !h.timer && !h.dono && ((h.erro = 'não abriu'), h.avisar && h.avisar())
      }).catch(() => {})
    }
    lancar()
    h.timer = setTimeout(() => {
      h.timer = 0
      if (!h.dono && !h.fim && !h.erro) lancar()
    }, RESERVA_MS)
    return h
  }
  function largarTTS(h) {
    if (!h) return
    clearTimeout(h.timer)
    h.timer = 0
    for (const id of h.ids) if (fluxosTTS.has(id)) (fluxosTTS.delete(id), window.sb.vozStream.parar(id).catch(() => {}))
  }
  // toca o stream pelo MediaSource; resolve false se falhou antes de qualquer som (quem chamou usa outro caminho)
  function tocarTTS(h, texto) {
    return new Promise((ok) => {
      if (!st) return ok(true)
      const ms = new MediaSource()
      const url = URL.createObjectURL(ms)
      const a = new Audio(url)
      let i = 0, comecou = false, sb = null, acabou = false
      const sair = (v) => {
        if (acabou) return
        acabou = true
        h.avisar = null
        ok(v)
      }
      ms.addEventListener('sourceopen', () => {
        try { sb = ms.addSourceBuffer('audio/mpeg') } catch { return sair(false) }
        const bombear = () => {
          if (!sb || sb.updating || ms.readyState !== 'open') return
          if (i < h.pedacos.length) {
            try { sb.appendBuffer(h.pedacos[i++]) } catch { return }
            return
          }
          if (h.fim || (h.erro && comecou)) try { ms.endOfStream() } catch {}
          else if (h.erro) {
            try { a.pause() } catch {}
            sair(false)
          }
        }
        sb.addEventListener('updateend', () => {
          if (!comecou && sb.buffered.length) {
            comecou = true
            registrar(`tts tocando ${Math.round(performance.now() - h.pedido)} ms depois do pedido`)
            reproduzir(a, texto, url).then(() => sair(true))
          }
          bombear()
        })
        h.avisar = bombear
        bombear()
      })
    })
  }
  // toca um áudio pela mesma saída que alimenta a auréola; resolve quando acaba ou é interrompido
  function tocar(r, texto) {
    const url = URL.createObjectURL(new Blob([r.bytes], { type: r.mime || 'audio/mpeg' }))
    return reproduzir(new Audio(url), texto, url)
  }
  function reproduzir(a, texto, url) {
    return new Promise((ok) => {
      if (!st) return ok()
      try {
        const src = st.ctx.createMediaElementSource(a)
        src.connect(st.anSaida)
      } catch {}
      st.tocando = a
      st.falandoTexto = texto
      st.falados.push({ t: texto, ate: Infinity })
      const marca = st.falados[st.falados.length - 1]
      a.addEventListener('ended', () => (marca.ate = performance.now() + 4000)) // o eco ainda chega uns segundos depois
      a.addEventListener('pause', () => (marca.ate = performance.now() + 4000))
      st.abaixou = 0
      st.cima = 0
      const fim = () => {
        URL.revokeObjectURL(url)
        if (st && st.tocando === a) (st.tocando = null), (st.abaixou = 0)
        ok()
      }
      a.onended = a.onerror = a.onpause = fim
      a.play().catch(fim)
    })
  }
  async function falarCurta(frase, narrar) {
    if (!st || !frase) return
    registrar('fala curta: ' + frase)
    let r = st.cache.get(frase)
    if (!r) {
      r = await sintetizar(frase)
      if (r && r.ok && st) st.cache.set(frase, r)
    }
    if (!st || st.fase !== 'pensando' || st.tocando || !r || !r.ok) return
    await tocar(r, frase)
  }
  async function falarResposta(texto, turno) {
    const t = paraFala(texto)
    if (!t) return
    // a frase de espera que estiver tocando sai para a resposta entrar
    try { st.tocando && st.tocando.pause() } catch {}
    fase('falando', '')
    const sessao = st
    const bl = blocos(t)
    if (temStreamTTS()) {
      // stream: toca no 1º pedaço; o próximo bloco já vai sendo sintetizado enquanto este toca
      let h = pedirTTS(bl[0])
      for (let i = 0; i < bl.length; i++) {
        const prox = i + 1 < bl.length ? pedirTTS(bl[i + 1]) : null
        const foi = await tocarTTS(h, bl[i])
        if (st !== sessao || st.turno !== turno) return largarTTS(prox)
        if (!foi) {
          largarTTS(prox)
          const r = await sintetizar(bl.slice(i).join(' '))
          if (st !== sessao || st.turno !== turno) return
          if (r && r.ok) await tocar(r, bl.slice(i).join(' '))
          else await falarSistema(bl.slice(i).join(' '))
          return
        }
        h = prox
      }
      return
    }
    let prox = sintetizar(bl[0])
    for (let i = 0; i < bl.length; i++) {
      const r = await prox
      if (st !== sessao || st.turno !== turno) return
      if (i + 1 < bl.length) prox = sintetizar(bl[i + 1])
      if (!r || !r.ok) { await falarSistema(bl.slice(i).join(' ')); return }
      await tocar(r, bl[i])
      if (st !== sessao || st.turno !== turno) return
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
  // para tudo o que ele está fazendo (fala e turno do agente); a fase seguinte fica por conta de quem chamou
  function interromper() {
    if (!st) return
    st.turno++
    clearTimeout(st.timerEspera)
    const a = st.tocando
    st.tocando = null
    st.abaixou = 0
    st.cima = 0
    try { a && a.pause() } catch {}
    try { speechSynthesis.cancel() } catch {}
    if (st.chat && P().ocupado(st.chat)) P().cancelar(st.chat)
  }

  // "Boa tarde, Lucas! Em que posso te ajudar?" ao abrir: hora local, primeiro nome da conta, pergunta sorteada. Sem LLM, sai na hora.
  async function saudar(sessao) {
    let nome = ''
    try {
      const c = await window.sb.cfg()
      nome = c.unlimitedNome || c.unlimitedEmail || ''
      if (st === sessao) st.nome = F.primeiroNome(nome) // o cérebro de voz chama a pessoa pelo nome
    } catch {}
    if (st !== sessao) return
    const frase = F.saudacao(new Date().getHours(), nome, st.sortear)
    $('voz-palco').querySelector('.voz-legenda').textContent = frase
    try {
      if (temStreamTTS()) await tocarTTS(pedirTTS(frase), frase)
      else {
        const r = await sintetizar(frase)
        if (r && r.ok && st === sessao) await tocar(r, frase)
      }
    } catch {}
  }

  // frases de espera e de etapa já sintetizadas na voz escolhida: saem na hora, sem esperar o servidor
  // Só com a conversa parada (ouvindo): durante pensar/falar a síntese da resposta tem a vez.
  async function aquecerFrases(sessao) {
    for (const f of [...F.ESPERA, ...F.ESPERA_LONGA, ...F.todas()]) {
      if (st !== sessao) return
      if (sessao.cache.has(f)) continue
      while (st === sessao && st.fase !== 'ouvindo') await new Promise((ok) => setTimeout(ok, 500))
      if (st !== sessao) return
      const r = await sintetizar(f)
      if (r && r.ok && st === sessao) sessao.cache.set(f, r)
    }
  }

  // ---------- entrar / sair ----------
  async function iniciar() {
    if (st) return encerrar()
    if (!navigator.mediaDevices?.getUserMedia) return alert('Este navegador não permite gravar áudio. Use o Chrome ou o app instalado.')
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
    anSaida.connect(ctx.destination)
    const palco = montarPalco()
    let voz = 'pt-BR-FranciscaNeural' // padrão só português (a multilíngue lia "Um segundinho" em alemão)
    try { voz = (await window.sb.cfg()).voz || voz } catch {}
    st = {
      fluxo, ctx, anMic, anSaida, canvas: palco.querySelector('canvas'), voz,
      mime: window.MediaRecorder ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) => MediaRecorder.isTypeSupported(m)) || '' : '',
      freq: new Uint8Array(anMic.frequencyBinCount), alt: new Float32Array(N_BARRAS), amostra: new Uint8Array(512),
      antes: performance.now(), piso: 0.01, quieto: 0, cima: 0, abaixou: 0, mudo: false, fase: 'ouvindo', frase: null, raf: 0, medidor: 0,
      vivo: null, ouvido: '', base: '', prefixo: '', ultimoTexto: '', textoEm: 0, ultimaVoz: -1e9, enviado: '', chat: null, turno: 0,
      tocando: null, falandoTexto: '', falados: [], cartoesVistos: new Set(), historico: [], nome: '', cerebroOuvinte: null, etapasDitas: {}, cache: new Map(), sortear: F.sorteador(), ultimaEtapa: 0, timerEspera: 0,
    }
    const sessao = st
    st.tirarFerr = P().aoFerramenta(aoFerramenta)
    document.body.classList.add('modo-voz')
    try { window.sb.navegador && window.sb.navegador.miniatura && window.sb.navegador.miniatura(true) } catch {} // navegador vira janelinha
    palco.hidden = false
    P().mostrarCerebro(true)
    $('voz-conversa').classList.add('on')
    fase('ouvindo', 'Fale naturalmente. Quando você fizer uma pausa, eu respondo.')
    medir()
    desenhar()
    const v = await abrirStream()
    if (st !== sessao) return v && v.fechar()
    if (v) st.vivo = v
    else if (window.MediaRecorder) novaFrase()
    else return encerrar()
    st.aoRedimensionar = () => focar()
    window.addEventListener('resize', st.aoRedimensionar)
    saudar(sessao).finally(() => aquecerFrases(sessao))
  }
  function encerrar() {
    const s = st
    if (!s) return
    st = null
    cancelAnimationFrame(s.raf)
    cancelAnimationFrame(s.medidor)
    clearTimeout(s.timerEspera)
    try { s.tirarFerr && s.tirarFerr() } catch {}
    try { s.aoRedimensionar && window.removeEventListener('resize', s.aoRedimensionar) } catch {}
    try { s.vivo && s.vivo.fechar() } catch {}
    try { s.frase && s.frase.rec.stop() } catch {}
    try { s.tocando && s.tocando.pause() } catch {}
    try { speechSynthesis.cancel() } catch {}
    try { s.fluxo.getTracks().forEach((t) => t.stop()) } catch {}
    try { s.ctx.close() } catch {}
    try { P().focoOrb(null) } catch {}
    document.body.classList.remove('modo-voz')
    try { window.sb.navegador && window.sb.navegador.miniatura && window.sb.navegador.miniatura(false) } catch {}
    const p = $('voz-palco')
    if (p) (p.hidden = true), p.querySelector('.voz-cartoes') && (p.querySelector('.voz-cartoes').innerHTML = '')
    const b = $('voz-conversa')
    if (b) b.classList.remove('on')
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && st) encerrar() })
  window.SBVozConversa = { iniciar, encerrar, responder: (t) => st && responder(t), mostrarCartoes: (l) => mostrarCartoes(l || []), recolherCartoes, ativo: () => !!st, estado: () => st && { fase: st.fase, ouvido: st.ouvido, vivo: !!st.vivo, tocando: !!st.tocando, abaixou: !!st.abaixou, cache: st.cache.size, turno: st.turno, enviado: st.enviado } }
  const b = $('voz-conversa')
  if (b) b.onclick = iniciar
})()
