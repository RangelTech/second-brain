// O instalador empacota SO os arquivos listados em package.json "build.files". Um modulo novo esquecido nessa lista faz o app instalado quebrar ao abrir
// (require falha), coisa que nenhum teste de unidade pega. Este teste garante que todo require('./x') dos arquivos empacotados aponta para algo empacotado.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

const RAIZ = path.join(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'))
const lista = pkg.build.files

test('todo require local dos arquivos empacotados esta na lista do instalador', () => {
  const empacotados = new Set(lista.filter((f) => f.endsWith('.js')))
  const faltando = []
  for (const arq of empacotados) {
    const caminho = path.join(RAIZ, arq)
    if (!fs.existsSync(caminho)) {
      faltando.push(`${arq} (listado, mas nao existe)`)
      continue
    }
    const texto = fs.readFileSync(caminho, 'utf8')
    for (const m of texto.matchAll(/require\(\s*['"]\.\/([A-Za-z0-9_.-]+?)(\.js)?['"]\s*\)/g)) {
      const alvo = m[1] + '.js'
      if (!fs.existsSync(path.join(RAIZ, alvo))) continue // pasta ou arquivo de dados (ex.: ./package.json)
      if (!empacotados.has(alvo)) faltando.push(`${arq} exige ./${alvo}, que nao esta em build.files`)
    }
  }
  assert.deepEqual(faltando, [], 'arquivos que o instalador deixaria de fora:\n' + faltando.join('\n'))
})
