// Worker (thread separada) do ditado: Whisper pequeno rodando no próprio computador, sem internet.
// Recebe áudio mono 16 kHz (Float32) e devolve o texto em português. Fica fora da thread principal para não travar o app.
const { parentPort, workerData } = require('worker_threads')

let pipe = null
async function carregar() {
  if (pipe) return pipe
  const { pipeline, env } = await import('@huggingface/transformers')
  env.allowRemoteModels = false
  env.allowLocalModels = true
  env.localModelPath = workerData.pasta
  pipe = await pipeline('automatic-speech-recognition', workerData.modelo, { dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' }, device: 'cpu', session_options: { intraOpNumThreads: Math.max(2, Math.min(6, Math.floor(require('os').cpus().length / 3))), interOpNumThreads: 1, graphOptimizationLevel: 'all' } })
  return pipe
}

// tira repetições seguidas da mesma palavra/frase curta (alucinação) e frases típicas de silêncio
function limpar(t) {
  let x = t.trim()
  x = x.replace(/\b(\p{L}{1,8})([,.!?]?\s+\1\b){3,}/giu, '$1') // mesma palavra repetida várias vezes seguidas
  x = x.replace(/((?:\p{L}+\s+){2,6}?)(?:\1){2,}/giu, '$1') // mesma frase curta repetida
  if (/^(obrigad[oa]\.?|legendas? pela comunidade.*|tchau\.?|\.+)$/i.test(x)) return ''
  return x.trim()
}

parentPort.on('message', async (m) => {
  try {
    const p = await carregar()
    if (m.tipo === 'aquecer') return parentPort.postMessage({ id: m.id, ok: true })
    const t0 = Date.now()
    const seg = m.pcm.byteLength / 4 / 16000
    // limite de tokens proporcional à duração: corta a repetição infinita ("de de de…") que o Whisper faz em trechos ruins
    const r = await p(new Float32Array(m.pcm), { language: 'portuguese', task: 'transcribe', chunk_length_s: 30, return_timestamps: false, max_new_tokens: Math.ceil(seg * 6) + 12 })
    parentPort.postMessage({ id: m.id, ok: true, texto: limpar(String(r.text || '')), ms: Date.now() - t0 })
  } catch (e) {
    parentPort.postMessage({ id: m.id, ok: false, erro: String(e && e.message || e) })
  }
})
