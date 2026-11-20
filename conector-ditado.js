// Conector da voz ao vivo (spec 52). ÚNICO lugar que sabe com quem a transcrição fala: endereço, cabeçalho e protocolo.
// Produção: llm-access /v1/audio/stream (repassa ao 9Router com a chave do servidor). Teste no PC do Lucas: SB_VOZ_STREAM_URL e
// SB_VOZ_STREAM_CHAVE apontam direto para o 9Router (nunca vão no pacote).
//
// Interface (main.js):
//   const c = abrirStream({ url, auth, idioma, rotacaoMs }, { aoTexto(txt), aoFimDeFala(), aoErro(msg), aoFechar() })
//   c.enviar(pcm)  -> PCM 16 bits LE, 16 kHz, mono, pedaços de ~100-200 ms
//   c.fechar()     -> CloseStream em todas as conexões e espera o último texto
//
// Protocolo: frames binários de áudio; {"type":"KeepAlive"} a cada 8 s; {"type":"CloseStream"} ao parar. Volta
// {"type":"TranscriptText","data":"<texto ACUMULADO da fala atual>"} (cada um substitui o anterior), {"type":"TranscriptEndpoint"}
// (a fala terminou) e {"type":"Error","data":"..."}. TranscriptInterim (servidor antigo) é tratado igual a TranscriptText.
//
// Regra do Lucas: nenhuma conexão vive mais de 2 min. Depois de `rotacaoMs - 10 s` troca na primeira pausa (fim de fala); se a pessoa
// não parar de falar, troca em `rotacaoMs` assim mesmo. A conexão nova recebe o áudio a partir dali (o que chega antes de ela abrir
// fica na fila) e a velha recebe CloseStream; o texto que a velha ainda devolver entra na mesma fala, na ordem certa.
const WebSocket = require('ws')

const CONFIG = {
  parametros: (idioma) => ({
    encoding: 'linear16',
    sample_rate: '16000',
    channels: '1',
    endpointing_ms: '300',
    utterance_end_ms: '1000',
    language: idioma || 'pt',
    use_conversation_engine: 'true',
  }),
  keepAliveMs: 8000,
  esperaFinalMs: 6000, // depois do CloseStream, quanto esperar o último texto antes de derrubar
  rotacaoMs: 120000,
  folgaRotacaoMs: 10000, // a partir de rotacaoMs - folga, troca na primeira pausa
}

// base do llm-access (https://.../v1) -> wss://.../v1/audio/stream
const urlDoServidor = (base) => String(base || '').replace(/^http/, 'ws').replace(/\/$/, '') + '/audio/stream'

function abrirStream({ url, auth, idioma, rotacaoMs = CONFIG.rotacaoMs, folgaMs = CONFIG.folgaRotacaoMs } = {}, ev = {}) {
  const alvo = url + (url.includes('?') ? '&' : '?') + new URLSearchParams(CONFIG.parametros(idioma))
  const segs = [] // conexões vivas, da mais velha para a atual
  let fechando = false
  let recebeuAlgo = false
  let falhasSeguidas = 0
  let fechouTudo = false

  const atual = () => segs[segs.length - 1]
  const vivas = () => segs.filter((s) => !s.fechado).length
  const combinado = () => segs.map((s) => s.texto.trim()).filter(Boolean).join(' ')
  const emitirTexto = () => ev.aoTexto?.(combinado())
  function concluirFala() {
    // conexão já em CloseStream cuja fala foi fechada: o que ela ainda mandar é repetição do que já foi entregue
    for (const s of segs) (s.texto = ''), s.morto && (s.ignorar = true)
    for (let i = segs.length - 1; i >= 0; i--) if (segs[i].fechado) segs.splice(i, 1)
    ev.aoFimDeFala?.()
  }
  function talvezAcabou() {
    if (fechouTudo || !fechando || vivas()) return
    fechouTudo = true
    if (combinado()) concluirFala()
    ev.aoFechar?.()
  }

  function novaConexao() {
    const ws = new WebSocket(alvo, { headers: { Authorization: auth, 'x-app': 'segundo-cerebro' }, handshakeTimeout: 10000 })
    const s = { ws, texto: '', aberto: false, fila: [], vivo: null, nasceu: Date.now(), tCedo: null, tLimite: null, querTrocar: false, morto: false }
    segs.push(s)
    const limpar = () => {
      clearInterval(s.vivo)
      clearTimeout(s.tCedo)
      clearTimeout(s.tLimite)
      clearTimeout(s.tMatar)
    }
    ws.on('open', () => {
      s.aberto = true
      falhasSeguidas = 0
      ws.send(JSON.stringify({ type: 'KeepAlive' }))
      s.vivo = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'KeepAlive' })), CONFIG.keepAliveMs)
      s.vivo.unref?.()
      for (const p of s.fila.splice(0)) ws.send(p)
      if (s.encerrar) encerrarSeg(s)
    })
    // rotação: perto dos 2 min troca na próxima pausa; no limite, troca de qualquer jeito
    s.tCedo = setTimeout(() => {
      s.querTrocar = true
      if (!s.texto.trim()) trocar(s)
    }, Math.max(0, rotacaoMs - folgaMs))
    s.tLimite = setTimeout(() => trocar(s), rotacaoMs)
    s.tCedo.unref?.()
    s.tLimite.unref?.()
    ws.on('message', (raw, binario) => {
      if (binario || s.ignorar) return
      let m
      try {
        m = JSON.parse(String(raw))
      } catch {
        return
      }
      if (m.type === 'TranscriptText' || m.type === 'TranscriptInterim') {
        recebeuAlgo = true
        s.texto = String(m.data || '')
        emitirTexto()
      } else if (m.type === 'TranscriptEndpoint') {
        // a fala acabou; se uma conexão mais nova já tem texto, esta parte espera para fechar junto com a dela
        const i = segs.indexOf(s)
        const maisNovaFalando = segs.slice(i + 1).some((x) => x.texto.trim())
        if (!maisNovaFalando) concluirFala()
        if (s.querTrocar && s === atual()) trocar(s)
      } else if (m.type === 'Error') ev.aoErro?.(String(m.data || 'erro na transcrição'))
    })
    ws.on('error', (e) => {
      s.erro = String((e && e.message) || e)
    })
    ws.on('close', () => {
      limpar()
      s.fechado = true
      // texto pendente fica na lista (entra no combinado) até a fala fechar; sem texto, sai já
      if (!s.texto.trim()) segs.splice(segs.indexOf(s), 1)
      // a conexão velha saiu com texto que ninguém fechou e as outras estão quietas: essa fala acabou
      else if (!segs.some((x) => x !== s && x.texto.trim())) concluirFala()
      if (!fechando && !s.morto && vivas() === 0) {
        // caiu sozinha (rede, servidor): tenta de novo uma vez; sem texto nenhum ainda, o app volta ao caminho antigo
        falhasSeguidas++
        if (!recebeuAlgo || falhasSeguidas > 2) {
          fechando = true
          ev.aoErro?.(s.erro || 'a conexão de voz caiu')
          return talvezAcabou()
        }
        novaConexao()
      }
      talvezAcabou()
    })
    return s
  }

  function encerrarSeg(s) {
    if (s.morto) return
    s.morto = true
    clearTimeout(s.tCedo)
    clearTimeout(s.tLimite)
    s.tMatar = setTimeout(() => {
      try {
        s.ws.terminate()
      } catch {}
    }, CONFIG.esperaFinalMs)
    s.tMatar.unref?.()
    if (s.ws.readyState === WebSocket.OPEN) s.ws.send(JSON.stringify({ type: 'CloseStream' }))
    else if (s.ws.readyState === WebSocket.CONNECTING) s.encerrar = true
    else {
      try {
        s.ws.terminate()
      } catch {}
    }
  }

  function trocar(s) {
    if (fechando || s !== atual() || s.morto) return
    novaConexao()
    encerrarSeg(s)
  }

  novaConexao()
  return {
    get conexoes() {
      return segs.length
    },
    enviar(pcm) {
      if (fechando) return
      const s = atual()
      if (!s) return
      const b = Buffer.isBuffer(pcm) ? pcm : Buffer.from(pcm)
      if (s.ws.readyState === WebSocket.OPEN) s.ws.send(b)
      else if (s.ws.readyState === WebSocket.CONNECTING && s.fila.length < 300) s.fila.push(b)
    },
    fechar() {
      if (fechando) return
      fechando = true
      for (const s of segs.slice()) encerrarSeg(s)
      talvezAcabou()
    },
  }
}

module.exports = { abrirStream, urlDoServidor, CONFIG }
