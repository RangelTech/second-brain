// Troca o ícone do electron.exe de desenvolvimento (o átomo) pela logo do Cérebro Pro, para a barra de tarefas do Windows.
// O npm install restaura o átomo; rode de novo (npm run icone:dev) depois dele. O app instalado já vem com o ícone certo.
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const raiz = path.join(__dirname, '..')
const exe = path.join(raiz, 'node_modules', 'electron', 'dist', 'electron.exe')
const ico = path.join(raiz, 'build', 'icon.ico')
const cache = path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', 'winCodeSign')
const rc = fs.existsSync(cache) ? fs.readdirSync(cache).map((d) => path.join(cache, d, 'rcedit-x64.exe')).find((f) => fs.existsSync(f)) : null
if (!rc) throw new Error('rcedit não encontrado (rode um build do electron-builder uma vez)')
execFileSync(rc, [exe, '--set-icon', ico, '--set-version-string', 'ProductName', 'Cérebro Pro', '--set-version-string', 'FileDescription', 'Cérebro Pro'])
console.log('ícone do electron.exe de desenvolvimento trocado')
