// rt-sites (spec 69): cada cliente do Cérebro Pro publica os sites dele em <nome>.rangeltech.net.
// O cliente NUNCA mexe no DNS: um curinga *.rangeltech.net aponta para este servidor, o Caddy serve /srv/sites/<nome>/ e pede
// certificado só para nome registrado (GET /ask). A publicação é autorizada pela chave da conta (conferida no llm-access) e só
// grava na pasta do nome ligado àquela conta.
import http from 'http'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const PORTA = +process.env.PORT || 8090
const ACCESS = (process.env.ACCESS_URL || 'https://qwen.rangeltech.net').replace(/\/+$/, '')
const DOMINIO = process.env.DOMINIO || 'rangeltech.net'
const RAIZ = process.env.SITES_DIR || '/sites'
const DADOS = process.env.DADOS_DIR || '/dados'
const ADMIN = process.env.ADMIN_TOKEN || ''
const COTA = (+process.env.COTA_MB || 300) * 1024 * 1024
const MAX_PUB = (+process.env.MAX_PUB_MB || 50) * 1024 * 1024
const MAX_ARQ = 3000
const EXT_OK = new Set(['.html', '.htm', '.css', '.js', '.mjs', '.json', '.txt', '.md', '.xml', '.csv', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.bmp', '.mp4', '.webm', '.mov', '.m4v', '.mp3', '.wav', '.ogg', '.m4a', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.pdf', '.webmanifest', '.map', '.glb', '.gltf', '.bin', '.vtt'])

// nomes que nenhum cliente pode ter: serviços da casa, infraestrutura e palavras de golpe
const RESERVADOS = new Set(('www mail email smtp imap pop ftp api app apps admin administrador painel panel dashboard login entrar conta contas ' +
  'senha suporte ajuda help status blog loja shop store cdn static assets media img images files arquivos download downloads docs doc ' +
  'dev stg staging test teste prod producao beta demo novo nova site sites web portal home inicio cliente clientes rangeltech rangel ' +
  'cerebro cerebropro segundocerebro segundo-cerebro brain qwen remoto nav user bi airflow gw chat luar auto metricas conector minio ' +
  'minio-admin infisical traefik uptime bridge storage rag ia ai turn painel-admin autoconfig autodiscover webmail cpanel whm ns ns1 ns2 ' +
  'mx autoai cortai rendai viralizai perfilai atendeai astral shape casa arena azul volupia evolution metabase capitalcerto').split(/\s+/))
const GOLPE = ['banco', 'itau', 'bradesco', 'santander', 'caixa', 'nubank', 'inter', 'sicredi', 'sicoob', 'bb-', 'pix', 'gov', 'receita',
  'detran', 'inss', 'serasa', 'paypal', 'mercadopago', 'mercado-pago', 'picpay', 'apple', 'google', 'microsoft', 'facebook', 'instagram',
  'whatsapp', 'netflix', 'amazon', 'senha', 'login', 'verifica', 'seguranca', 'suporte', 'premio', 'sorteio']

fs.mkdirSync(RAIZ, { recursive: true })
fs.mkdirSync(DADOS, { recursive: true })
const ARQ_CONTAS = path.join(DADOS, 'contas.json')
let db = { contas: {}, nomes: {} } // contas: account_id -> { nome, email, criado, bloqueado }; nomes: nome -> account_id
try { db = JSON.parse(fs.readFileSync(ARQ_CONTAS, 'utf8')) } catch {}
const gravarDb = () => { const t = ARQ_CONTAS + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 1)); fs.renameSync(t, ARQ_CONTAS) }

export function slug(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' e ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-').slice(0, 30).replace(/-+$/, '')
}
export function nomeLivre(base, ocupado) {
  let b = slug(base)
  if (b.length < 3) b = (b + '-site').replace(/^-/, '')
  if (GOLPE.some((g) => b.includes(g))) b = (b.slice(0, 24) + '-site')
  if (RESERVADOS.has(b)) b = b.slice(0, 24) + '-site'
  if (!ocupado(b) && !RESERVADOS.has(b)) return b
  for (let i = 2; i < 10000; i++) { const n = b.slice(0, 26) + '-' + i; if (!ocupado(n) && !RESERVADOS.has(n)) return n }
  return b.slice(0, 20) + '-' + crypto.randomBytes(3).toString('hex')
}

// ---- conta pela chave (cache curto) ----
const cache = new Map()
async function contaDaChave(chave) {
  if (!chave || chave.length < 20) return null
  const k = crypto.createHash('sha256').update(chave).digest('hex')
  const c = cache.get(k)
  if (c && c.ate > Date.now()) return c.conta
  const r = await fetch(ACCESS + '/v1/auth/whoami', { headers: { Authorization: 'Bearer ' + chave }, signal: AbortSignal.timeout(15000) }).catch(() => null)
  if (!r || !r.ok) return null
  const j = await r.json().catch(() => ({}))
  const id = j.account_id ?? j.account?.id ?? j.id
  if (id === undefined || id === null) return null
  const conta = { id: String(id), email: j.email || j.account?.email || '', nome: j.name || j.account?.name || '' }
  cache.set(k, { conta, ate: Date.now() + 5 * 60 * 1000 })
  return conta
}
function nomeDaConta(conta) {
  const ja = db.contas[conta.id]
  if (ja) return ja
  const base = conta.nome || String(conta.email).split('@')[0] || 'cliente'
  const nome = nomeLivre(base, (n) => !!db.nomes[n])
  db.contas[conta.id] = { nome, email: conta.email, criado: new Date().toISOString(), bloqueado: false }
  db.nomes[nome] = conta.id
  gravarDb()
  fs.mkdirSync(path.join(RAIZ, nome), { recursive: true })
  return db.contas[conta.id]
}

// ---- utilidades ----
function tamanhoPasta(p) {
  let t = 0
  try { for (const e of fs.readdirSync(p, { withFileTypes: true })) { if (e.name.startsWith('.')) continue; const f = path.join(p, e.name); t += e.isDirectory() ? tamanhoPasta(f) : fs.statSync(f).size } } catch {}
  return t
}
function listarSites(p) {
  const out = []
  try {
    if (fs.existsSync(path.join(p, 'index.html'))) out.push('')
    for (const e of fs.readdirSync(p, { withFileTypes: true })) if (e.isDirectory() && !e.name.startsWith('.') && fs.existsSync(path.join(p, e.name, 'index.html'))) out.push(e.name)
  } catch {}
  return out
}
const lerCorpo = (req, max) => new Promise((ok, erro) => {
  const partes = []; let n = 0
  req.on('data', (d) => { n += d.length; if (n > max) { erro(Object.assign(new Error('Publicação grande demais (limite de ' + Math.round(max / 1048576) + ' MB).'), { status: 413 })); req.destroy() } else partes.push(d) })
  req.on('end', () => ok(Buffer.concat(partes)))
  req.on('error', erro)
})
const json = (res, st, o) => { res.writeHead(st, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)) }
const urlDe = (nome, site) => `https://${nome}.${DOMINIO}/${site ? encodeURIComponent(site) + '/' : ''}`
const limites = new Map()
function limite(chave, max, ms) { const a = Date.now(); const j = limites.get(chave) || { n: 0, ate: a + ms }; if (a > j.ate) { j.n = 0; j.ate = a + ms } j.n++; limites.set(chave, j); return j.n <= max }

// ---- publicar: { site?: "nome-do-site", arquivos: [{ caminho, b64 }] } ----
async function publicar(conta, corpo) {
  const reg = nomeDaConta(conta)
  if (reg.bloqueado) throw Object.assign(new Error('Este endereço foi bloqueado. Fale com o suporte.'), { status: 403 })
  let site = corpo.site ? slug(corpo.site) : ''
  if (corpo.site && !site) throw Object.assign(new Error('Nome do site inválido.'), { status: 400 })
  const arquivos = Array.isArray(corpo.arquivos) ? corpo.arquivos : []
  if (!arquivos.length) throw Object.assign(new Error('Nenhum arquivo para publicar.'), { status: 400 })
  if (arquivos.length > MAX_ARQ) throw Object.assign(new Error(`Arquivos demais (limite de ${MAX_ARQ}).`), { status: 400 })
  const base = path.join(RAIZ, reg.nome)
  const destino = site ? path.join(base, site) : base
  const tmp = path.join(base, '.novo-' + crypto.randomBytes(6).toString('hex'))
  fs.mkdirSync(tmp, { recursive: true })
  let total = 0, temIndex = false
  try {
    for (const a of arquivos) {
      const rel = String(a.caminho || '').replace(/\\/g, '/').replace(/^\/+/, '')
      if (!rel || rel.split('/').some((p) => p === '..' || p === '' || p.startsWith('.'))) throw Object.assign(new Error('Caminho inválido: ' + rel), { status: 400 })
      const ext = path.extname(rel).toLowerCase()
      if (!EXT_OK.has(ext)) continue // arquivo que não é de site (script, executável): fica de fora sem travar a publicação
      const buf = Buffer.from(String(a.b64 || ''), 'base64')
      total += buf.length
      const f = path.join(tmp, rel)
      if (!f.startsWith(tmp + path.sep)) throw Object.assign(new Error('Caminho inválido.'), { status: 400 })
      fs.mkdirSync(path.dirname(f), { recursive: true })
      fs.writeFileSync(f, buf)
      if (rel.toLowerCase() === 'index.html') temIndex = true
    }
    if (!temIndex) throw Object.assign(new Error('A pasta precisa ter um index.html na raiz.'), { status: 400 })
    // cota: o que já existe na conta, menos o que vai ser trocado, mais o novo
    const outrosSites = listarSites(base).filter(Boolean)
    const atual = site ? tamanhoPasta(destino) : tamanhoPasta(base) - outrosSites.reduce((t, n) => t + tamanhoPasta(path.join(base, n)), 0)
    if (tamanhoPasta(base) - atual + total > COTA) throw Object.assign(new Error(`Passou do espaço da conta (${Math.round(COTA / 1048576)} MB).`), { status: 413 })
    if (site) {
      const velho = destino + '.velho-' + Date.now()
      if (fs.existsSync(destino)) fs.renameSync(destino, velho)
      fs.renameSync(tmp, destino)
      fs.rmSync(velho, { recursive: true, force: true })
    } else {
      // raiz: troca só os arquivos soltos e as pastas que não são outros sites
      const outros = new Set(listarSites(base).filter(Boolean))
      for (const e of fs.readdirSync(base)) if (!e.startsWith('.novo-') && !outros.has(e)) fs.rmSync(path.join(base, e), { recursive: true, force: true })
      for (const e of fs.readdirSync(tmp)) {
        if (outros.has(e)) continue // não pisa num site de mesmo nome
        fs.renameSync(path.join(tmp, e), path.join(base, e))
      }
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  } catch (e) {
    fs.rmSync(tmp, { recursive: true, force: true })
    throw e
  }
  return { ok: true, url: urlDe(reg.nome, site), nome: reg.nome, bytes: total }
}

const servidor = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x')
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim()
  try {
    // o Caddy pergunta antes de pedir certificado: só nome registrado e não bloqueado
    if (u.pathname === '/ask') {
      const d = String(u.searchParams.get('domain') || '').toLowerCase()
      const m = d.endsWith('.' + DOMINIO) ? d.slice(0, -(DOMINIO.length + 1)) : ''
      const id = m && !m.includes('.') ? db.nomes[m] : null
      res.writeHead(id && !db.contas[id]?.bloqueado ? 200 : 404).end()
      return
    }
    if (u.pathname === '/saude') return json(res, 200, { ok: true, contas: Object.keys(db.contas).length })
    // admin: bloquear/desbloquear um nome (abuso) e listar
    if (u.pathname.startsWith('/api/admin/')) {
      if (!ADMIN || req.headers.authorization !== 'Bearer ' + ADMIN) return json(res, 401, { erro: 'não autorizado' })
      if (u.pathname === '/api/admin/contas') return json(res, 200, db)
      const m = /^\/api\/admin\/(bloquear|desbloquear)\/([a-z0-9-]+)$/.exec(u.pathname)
      if (m && req.method === 'POST') {
        const id = db.nomes[m[2]]
        if (!id) return json(res, 404, { erro: 'nome não existe' })
        db.contas[id].bloqueado = m[1] === 'bloquear'
        gravarDb()
        return json(res, 200, { ok: true, ...db.contas[id] })
      }
      return json(res, 404, { erro: 'não encontrado' })
    }
    if (!u.pathname.startsWith('/api/')) return json(res, 404, { erro: 'não encontrado' })
    if (!limite('ip:' + ip, 120, 3600000)) return json(res, 429, { erro: 'Muitas tentativas. Tente daqui a pouco.' })
    const chave = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    const conta = await contaDaChave(chave)
    if (!conta) return json(res, 401, { erro: 'Entre na sua conta do Cérebro Pro para publicar.' })
    if (u.pathname === '/api/endereco' && req.method === 'GET') {
      const reg = nomeDaConta(conta)
      const base = path.join(RAIZ, reg.nome)
      return json(res, 200, { nome: reg.nome, url: urlDe(reg.nome, ''), sites: listarSites(base).map((s) => ({ site: s || '(principal)', url: urlDe(reg.nome, s) })), usado_mb: +(tamanhoPasta(base) / 1048576).toFixed(1), cota_mb: Math.round(COTA / 1048576), bloqueado: !!reg.bloqueado })
    }
    if (u.pathname === '/api/publicar' && req.method === 'POST') {
      if (!limite('conta:' + conta.id, 30, 3600000)) return json(res, 429, { erro: 'Muitas publicações nesta hora. Tente daqui a pouco.' })
      const corpo = JSON.parse((await lerCorpo(req, Math.ceil(MAX_PUB * 1.4) + 65536)).toString('utf8') || '{}')
      return json(res, 200, await publicar(conta, corpo))
    }
    const mr = /^\/api\/sites\/([a-z0-9-]+)$/.exec(u.pathname)
    if (mr && req.method === 'DELETE') {
      const reg = nomeDaConta(conta)
      const p = path.join(RAIZ, reg.nome, mr[1])
      if (!fs.existsSync(path.join(p, 'index.html'))) return json(res, 404, { erro: 'Esse site não existe.' })
      fs.rmSync(p, { recursive: true, force: true })
      return json(res, 200, { ok: true })
    }
    json(res, 404, { erro: 'não encontrado' })
  } catch (e) {
    json(res, e.status || 500, { erro: e.status ? e.message : 'Erro ao publicar. Tente de novo.' })
    if (!e.status) console.error(e)
  }
})
if (process.argv[1] && process.argv[1].endsWith('servidor.mjs')) servidor.listen(PORTA, '0.0.0.0', () => console.log('rt-sites na porta ' + PORTA))
export { servidor, nomeDaConta, publicar, db }
