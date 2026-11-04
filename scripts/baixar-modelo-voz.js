// Baixa os modelos de voz para dentro do app, para o ditado já vir instalado (nada baixa na hora de usar).
//  - Whisper pequeno (int8, ~240 MB): texto final preciso, roda no computador.
//  - Vosk português (~32 MB): texto provisório em tempo real enquanto o Whisper processa.
// Roda antes do build (npm run modelo:voz) e no CI; pula o que já existe.
const fs = require('fs')
const path = require('path')
const raiz = path.join(__dirname, '..')
async function baixar(url, destino, minimo) {
  if (fs.existsSync(destino) && fs.statSync(destino).size >= minimo) return
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
  const b = Buffer.from(await r.arrayBuffer())
  if (b.length < minimo) throw new Error(`${url}: arquivo incompleto`)
  fs.mkdirSync(path.dirname(destino), { recursive: true })
  fs.writeFileSync(destino, b)
  console.log('ok', path.relative(raiz, destino), (b.length / 1048576).toFixed(1) + ' MB')
}
;(async () => {
  await baixar('https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-pt-0.3.tar.gz', path.join(raiz, 'renderer', 'vendor', 'vosk-model-pt.tar.gz'), 20e6)
  const hf = 'https://huggingface.co/onnx-community/whisper-small/resolve/main/'
  const dir = path.join(raiz, 'modelos', 'whisper-small')
  for (const f of ['config.json', 'generation_config.json', 'preprocessor_config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json', 'normalizer.json', 'vocab.json', 'merges.txt', 'added_tokens.json']) await baixar(hf + f, path.join(dir, f), 10)
  await baixar(hf + 'onnx/encoder_model_quantized.onnx', path.join(dir, 'onnx', 'encoder_model_quantized.onnx'), 80e6)
  await baixar(hf + 'onnx/decoder_model_merged_quantized.onnx', path.join(dir, 'onnx', 'decoder_model_merged_quantized.onnx'), 140e6)
})().catch((e) => { console.error(e.message); process.exit(1) })
