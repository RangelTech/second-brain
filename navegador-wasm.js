// Navegador WebAssembly da versão web (spec 60 §8): o navegador roda DENTRO da aba do Chrome do cliente (motor Gecko em WebAssembly,
// saída de internet pelo relay de São Paulo). O agente continua na VM/PC; cada ação vai pela ponte até a aba e volta com o resultado.
//
// Protocolo (pelos canais genéricos do acesso web, sem mudar a ponte):
//   aba -> app   invoke('navwasm:registrar', { aba, capaz, pronto })  batimento a cada 15 s de toda tela web que consegue rodar o motor
//   app -> aba   evento 'navwasm:ligar'                               pede à tela capaz que ligue o motor (abre o painel)
//   app -> aba   evento 'navwasm:pedido' { aba, id, op, args }        só para a aba com o motor pronto
//   aba -> app   invoke('navwasm:resposta', { id, ok, valor, erro })
// Sites da pasta de trabalho (F3): o motor não enxerga o disco da VM; a pasta vira um endereço com chave curta servido pela ponte
// (/m/<máquina>/site/<chave>/<arquivo>), que pede o arquivo ao app pelo túnel.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const VALIDADE_MS = 40000
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.pdf': 'application/pdf',
}
const MAX_ARQUIVO = 25 * 1024 * 1024 // a ponte limita cada mensagem a ~30 MB

function criar() {
  let cliente = null // aba com o motor pronto: { sender, aba, ate }
  const capazes = new Map() // aba -> { sender, ate } (telas web abertas que conseguem rodar o motor)
  const pend = new Map()
  const sites = new Map() // chave -> pasta
  let seq = 0
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

  const online = () => !!cliente && cliente.ate > Date.now()
  const capazOnline = () => {
    let melhor = null
    for (const [aba, c] of capazes) {
      if (c.ate <= Date.now()) capazes.delete(aba)
      else if (!melhor || c.ate > melhor.ate) melhor = { aba, ...c }
    }
    return melhor
  }

  function registrar(sender, dados) {
    const aba = String((dados && dados.aba) || '').slice(0, 64)
    if (!aba || !sender || typeof sender.send !== 'function') return false
    const ate = Date.now() + VALIDADE_MS
    if (dados.capaz === false) capazes.delete(aba)
    else capazes.set(aba, { sender, ate })
    if (dados.pronto) cliente = { sender, aba, ate }
    else if (cliente && cliente.aba === aba) cliente = null
    return true
  }

  function responder(dados) {
    const p = pend.get(dados && dados.id)
    if (!p) return false
    pend.delete(dados.id)
    clearTimeout(p.timer)
    if (dados.ok) p.resolve(dados.valor)
    else p.reject(new Error(String(dados.erro || 'O navegador da página falhou.')))
    return true
  }

  // há alguém na web que pode rodar o motor agora?
  const disponivel = () => online() || !!capazOnline()

  // garante a aba com o motor pronto: pede à tela web mais recente que ligue (a 1ª vez baixa o motor, ~10 s) e espera
  async function garantir(ms = 45000) {
    if (online()) return true
    const c = capazOnline()
    if (!c) return false
    try { c.sender.send('navwasm:ligar', { aba: c.aba }) } catch { return false }
    const fim = Date.now() + ms
    while (Date.now() < fim) {
      await esperar(200)
      if (online()) return true
    }
    return false
  }

  function pedir(op, args = [], ms = 40000) {
    if (!online()) return Promise.reject(new Error('O navegador da página não está aberto.'))
    const id = 'p' + (++seq) + '-' + Date.now().toString(36)
    const alvo = cliente
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pend.delete(id); reject(new Error('O navegador da página não respondeu a tempo.')) }, ms)
      pend.set(id, { resolve, reject, timer })
      try {
        alvo.sender.send('navwasm:pedido', { aba: alvo.aba, id, op, args })
      } catch (e) {
        clearTimeout(timer)
        pend.delete(id)
        reject(e)
      }
    })
  }

  // ---- sites da pasta de trabalho ----
  function chaveDaPasta(pasta) {
    const real = path.resolve(pasta)
    for (const [k, p] of sites) if (p === real) return k
    const k = crypto.randomBytes(12).toString('base64url')
    sites.set(k, real)
    if (sites.size > 200) sites.delete(sites.keys().next().value)
    return k
  }
  // arquivo local -> caminho relativo servido pela ponte ("site/<chave>/<arquivo>")
  function caminhoDoSite(arquivo) {
    const real = path.resolve(arquivo)
    return 'site/' + chaveDaPasta(path.dirname(real)) + '/' + encodeURIComponent(path.basename(real))
  }
  // pedido da ponte: "site/<chave>/<resto>" -> { status, tipo, corpo }
  function lerDoSite(caminho) {
    const m = /^site\/([\w-]{8,40})\/(.*)$/.exec(String(caminho || ''))
    if (!m) return null
    const pasta = sites.get(m[1])
    if (!pasta) return { status: 404 }
    let rel = ''
    try { rel = decodeURIComponent(m[2].split('?')[0]) } catch { return { status: 400 } }
    if (!rel || rel.endsWith('/')) rel += 'index.html'
    const arq = path.resolve(pasta, rel)
    if (arq !== pasta && !arq.startsWith(pasta + path.sep)) return { status: 403 }
    try {
      const st = fs.statSync(arq)
      if (!st.isFile()) return { status: 404 }
      if (st.size > MAX_ARQUIVO) return { status: 413 }
      return { status: 200, tipo: TIPOS[path.extname(arq).toLowerCase()] || 'application/octet-stream', corpo: fs.readFileSync(arq) }
    } catch {
      return { status: 404 }
    }
  }

  return {
    registrar, responder, online, disponivel, garantir, pedir, caminhoDoSite, lerDoSite,
    estado: () => ({ online: online(), aba: cliente ? cliente.aba : '', capazes: capazes.size }),
  }
}

module.exports = { criar, VALIDADE_MS, TIPOS }
