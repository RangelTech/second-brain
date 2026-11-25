// Confere que o dist/ monta a extensão com o MESMO ID de sempre (spec 57 §3.3.5): o ID vem da chave pública em chave.json.
// ID do Chrome = sha256 da chave pública (DER), primeiros 32 dígitos hex, cada um trocado por a..p.
const fs = require('fs'), path = require('path'), crypto = require('crypto')
const raiz = path.join(__dirname, '..')
const esperado = JSON.parse(fs.readFileSync(path.join(raiz, 'chave.json'), 'utf8')).id
const m = JSON.parse(fs.readFileSync(path.join(raiz, 'dist', 'manifest.json'), 'utf8'))
const hex = crypto.createHash('sha256').update(Buffer.from(m.key, 'base64')).digest('hex').slice(0, 32)
const id = [...hex].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('')
if (id !== esperado) { console.error(`ID diferente: ${id} (esperado ${esperado})`); process.exit(1) }
console.log('ID confere:', id, '| versão', m.version)
