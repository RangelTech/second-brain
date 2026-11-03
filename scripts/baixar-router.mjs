// Baixa o motor de provedores (9Router, MIT) na versão fixada para a pasta router/.
// O código dele não é versionado aqui: roda no desenvolvimento (npm run router:fetch) e no CI.
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const VERSAO = 'v0.5.112'
const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const destino = path.join(raiz, 'router')
if (existsSync(path.join(destino, 'package.json')) && !process.argv.includes('--forcar')) {
  console.log('router/ já existe (use --forcar para baixar de novo)')
  process.exit(0)
}
rmSync(destino, { recursive: true, force: true })
execFileSync('git', ['clone', '--depth', '1', '--branch', VERSAO, 'https://github.com/decolua/9router.git', destino], { stdio: 'inherit' })
rmSync(path.join(destino, '.git'), { recursive: true, force: true })
console.log('9Router', VERSAO, 'em', destino)
