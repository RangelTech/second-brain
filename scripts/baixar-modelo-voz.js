// Baixa o modelo de voz (Vosk, português, ~32 MB) para dentro do app, para o ditado já vir instalado.
// Roda antes do build (npm run modelo:voz) e no CI; pula se o arquivo já existe.
const fs = require('fs')
const path = require('path')
const dest = path.join(__dirname, '..', 'renderer', 'vendor', 'vosk-model-pt.tar.gz')
;(async () => {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 20e6) return console.log('modelo de voz já está em', dest)
  const r = await fetch('https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-pt-0.3.tar.gz')
  if (!r.ok) throw new Error('download do modelo falhou: ' + r.status)
  const b = Buffer.from(await r.arrayBuffer())
  if (b.length < 20e6) throw new Error('modelo incompleto')
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, b)
  console.log('modelo de voz gravado:', (b.length / 1048576).toFixed(1), 'MB')
})().catch((e) => { console.error(e.message); process.exit(1) })
