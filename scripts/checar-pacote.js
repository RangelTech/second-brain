// Falha se algum módulo local carregado por require('./x') não estiver na lista `build.files` do electron-builder
// (o pacote só leva o que está na lista; um arquivo esquecido só quebra no computador do cliente).
const fs = require('fs')
const path = require('path')
const raiz = path.join(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8'))
const lista = new Set(pkg.build.files)
const faltando = []
for (const arq of pkg.build.files.filter((f) => f.endsWith('.js') && !f.includes('*'))) {
  const txt = fs.readFileSync(path.join(raiz, arq), 'utf8')
  for (const m of txt.matchAll(/require\('\.\/([\w-]+)'\)/g)) {
    const alvo = m[1] + '.js'
    if (!lista.has(alvo) && fs.existsSync(path.join(raiz, alvo))) faltando.push(`${arq} usa ${alvo}`)
  }
}
if (faltando.length) {
  console.error('Arquivos fora do pacote (build.files):\n - ' + [...new Set(faltando)].join('\n - '))
  process.exit(1)
}
console.log('pacote ok: todos os módulos locais estão em build.files')
