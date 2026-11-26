const fs = require('fs'), z = require('zlib')
const [js, dadosArq, fonteArq, saida] = process.argv.slice(2)
let s = fs.readFileSync(js, 'utf8')
const dados = fs.readFileSync(dadosArq), fonte = fs.readFileSync(fonteArq)
if (dados.length !== 13007436) throw new Error('dados inesperados')
const novo = Buffer.concat([dados, fonte]), N = novo.length
const velho = String.raw`\"end\": 13007436\n    } ],\n    \"remote_package_size\": 13007436`
const i = s.indexOf(velho)
if (i < 0) throw new Error('indice nao achado')
const ent = String.raw`\"end\": 13007436\n    }, {\n      \"filename\": \"/gre-baked/fonts/TwemojiMozilla.ttf\",\n      \"start\": 13007436,\n      \"end\": ` + N + String.raw`\n    } ],\n    \"remote_package_size\": ` + N
s = s.slice(0, i) + ent + s.slice(i + velho.length)
const re = /(data:application\/octet-stream;base64,)([A-Za-z0-9+\/=]{100000,})/
const m = re.exec(s)
const c = z.zstdCompressSync(novo, { params: { [z.constants.ZSTD_c_compressionLevel]: 19 } })
s = s.slice(0, m.index) + m[1] + c.toString('base64') + s.slice(m.index + m[0].length)
fs.writeFileSync(saida, s)
console.log('ok', N, s.length)
