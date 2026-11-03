// O rastreamento do Next deixa o sql-wasm.wasm de fora do standalone; sem ele o 9Router não abre o banco (usa sql.js, pois o Electron tem outra ABI para o better-sqlite3).
const fs = require('fs')
const path = require('path')
const raiz = path.join(__dirname, '..', 'router')
const de = path.join(raiz, 'node_modules', 'sql.js')
const para = path.join(raiz, '.next', 'standalone', 'node_modules', 'sql.js')
fs.cpSync(de, para, { recursive: true, force: true })
console.log('sql.js copiado para o standalone')
