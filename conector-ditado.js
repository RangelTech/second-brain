// Conector do ditado ao vivo (spec 49). Este arquivo é o ÚNICO lugar que sabe com quem o ditado fala: endereço, chave e protocolo.
// Hoje fala com o nosso servidor (llm-access /v1/audio/stream -> llm-queue -> Whisper da máquina do LLM). Para trocar o serviço,
// mude CONFIG (ou reescreva abrirStream mantendo a mesma interface) — o resto do app não precisa mudar.
//
// Interface usada pelo app (main.js):
//   const c = abrirStream({ base, chave, idioma }, { aoParcial(txt), aoFinal(txt), aoFimDeFala(), aoErro(msg), aoFechar() })
//   c.enviar(pcm)   -> Buffer/Uint8Array com PCM 16 bits LE, 16 kHz, mono (pedaços de ~100-200 ms)
//   c.fechar()      -> manda CloseStream e espera o último texto
//
// Protocolo: frames binários de áudio; texto {"type":"KeepAlive"} a cada 8 s e {"type":"CloseStream"} ao parar; volta
// {"type":"TranscriptInterim"|"TranscriptText","data":"..."} e {"type":"TranscriptEndpoint"}; erro {"type":"Error","data":"..."}.
const WebSocket = require('ws')

const CONFIG = {
  // base = https://qwen.rangeltech.net/v1 (a mesma das outras rotas do Unlimited); vira wss://.../v1/audio/stream
  url: (base) => String(base || '').replace(/^http/, 'ws').replace(/\/$/, '') + '/audio/stream?',
  parametros: (idioma) => ({
    encoding: 'linear16',
    sample_rate: '16000',
    channels: '1',
    endpointing_ms: '300',
    utterance_end_ms: '1000',
    language: idioma || 'pt',
    use_conversation_engine: 'true',
  }),
  cabecalhos: (chave) => ({ Authorization: chave, 'x-app': 'segundo-cerebro' }),
  keepAliveMs: 8000,
  esperaFinalMs: 6000, // depois do CloseStream, quanto esperar o último texto antes de fechar
}

function abrirStream({ base, chave, idioma } = {}, ev = {}) {
  const ws = new WebSocket(CONFIG.url(base) + new URLSearchParams(CONFIG.parametros(idioma)), { headers: CONFIG.cabecalhos(chave), handshakeTimeout: 10000 })
  let vivo = null
  let fechando = null
  let aberto = false
  const fila = [] // áudio que chegou antes da conexão abrir
  const parar = () => {
    clearInterval(vivo)
    vivo = null
  }
  ws.on('open', () => {
    aberto = true
    ws.send(JSON.stringify({ type: 'KeepAlive' }))
    vivo = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'KeepAlive' })), CONFIG.keepAliveMs)
    vivo.unref?.()
    for (const p of fila.splice(0)) ws.send(p)
    if (fechando) ws.send(JSON.stringify({ type: 'CloseStream' }))
  })
  ws.on('message', (raw, binario) => {
    if (binario) return
    let m
    try {
      m = JSON.parse(String(raw))
    } catch {
      return
    }
    if (m.type === 'TranscriptInterim') ev.aoParcial?.(String(m.data || ''))
    else if (m.type === 'TranscriptText') ev.aoFinal?.(String(m.data || ''))
    else if (m.type === 'TranscriptEndpoint') ev.aoFimDeFala?.()
    else if (m.type === 'Error') ev.aoErro?.(String(m.data || 'erro no ditado'))
  })
  ws.on('error', (e) => ev.aoErro?.(String((e && e.message) || e)))
  ws.on('close', () => {
    parar()
    clearTimeout(fechando)
    ev.aoFechar?.()
  })
  return {
    get aberto() {
      return aberto
    },
    enviar(pcm) {
      if (fechando) return
      const b = Buffer.isBuffer(pcm) ? pcm : Buffer.from(pcm)
      if (ws.readyState === WebSocket.OPEN) ws.send(b)
      else if (ws.readyState === WebSocket.CONNECTING && fila.length < 200) fila.push(b)
    },
    fechar() {
      if (fechando) return
      fechando = setTimeout(() => {
        try { ws.terminate() } catch {}
      }, CONFIG.esperaFinalMs)
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'CloseStream' }))
      else if (ws.readyState !== WebSocket.CONNECTING) try { ws.terminate() } catch {}
    },
  }
}

module.exports = { abrirStream, CONFIG }
