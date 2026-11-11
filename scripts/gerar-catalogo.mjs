// Gera renderer/provider-catalog.js a partir do registro de provedores do 9Router (router/).
// Uso: node scripts/gerar-catalogo.mjs   (rodar de novo ao atualizar o router/)
import { register } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const router = path.join(raiz, 'router')
const hook = `
export async function resolve(spec, ctx, next) {
  const R = ${JSON.stringify(pathToFileURL(router).href + '/')}
  let alvo = null
  if (spec.startsWith('@/')) alvo = R + 'src/' + spec.slice(2)
  else if (spec.startsWith('open-sse/')) alvo = R + spec
  if (alvo) {
    for (const c of [alvo, alvo + '.js', alvo + '/index.js']) {
      try { const { fileURLToPath } = await import('node:url'); if (require_fs(fileURLToPath(c))) return next(c, ctx) } catch {}
    }
  }
  return next(spec, ctx)
}
import fs from 'node:fs'
function require_fs(p) { try { return fs.statSync(p).isFile() } catch { return false } }
`
register('data:text/javascript,' + encodeURIComponent(hook))

const M = await import(pathToFileURL(path.join(router, 'src/shared/constants/providers.js')).href)
const logos = new Set(fs.readdirSync(path.join(router, 'public/providers')).map((f) => f.replace(/\.png$/, '')))
const { FREE_PROVIDERS, FREE_TIER_PROVIDERS, OAUTH_PROVIDERS, APIKEY_PROVIDERS, WEB_COOKIE_PROVIDERS } = M
const grupos = [['free', FREE_PROVIDERS], ['freeTier', FREE_TIER_PROVIDERS], ['oauth', OAUTH_PROVIDERS], ['apikey', APIKEY_PROVIDERS], ['cookie', WEB_COOKIE_PROVIDERS]]
const vistos = new Set()
const lista = grupos
  .flatMap(([cat, mapa]) => Object.values(mapa).map((p) => ({ ...p, _cat: cat })))
  .filter((p) => !p.hidden && p._cat !== 'cookie' && (!p.serviceKinds || p.serviceKinds.includes('llm')) && p.id && !vistos.has(p.id) && vistos.add(p.id))
  .map((p) => ({
    id: p.id,
    nome: p.name,
    categoria: p._cat,
    cor: p.color || '#8a8a8a',
    site: p.website || '',
    urlChave: p.apiKeyUrl || p.website || '',
    oauth: !!p.hasOAuth,
    gratis: !!p.hasFree,
    modos: p.authModes || [],
    tipos: p.serviceKinds || null,
    alias: p.alias && p.alias !== p.id ? p.alias : null, // os modelos do roteador vêm marcados pelo apelido (ex.: cc = Claude)
    logo: logos.has(p.id) ? p.id : logos.has(p.alias) ? p.alias : null,
  }))
console.log('provedores:', lista.length, 'com logo:', lista.filter((p) => p.logo).length)
fs.writeFileSync(path.join(raiz, 'renderer', 'provider-catalog.js'), 'window.SB_CATALOGO = ' + JSON.stringify({ gerado_de: '9router', provedores: lista }) + ';\n')
