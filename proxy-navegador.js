// Proxy do navegador (spec 31 §2.1): nas VMs o navegador sai por IP de datacenter (Alemanha) e o Instagram e afins barram.
// O servidor entrega, por conta, um proxy (residencial/ISP do Brasil) e a lista de domínios que passam por ele; o resto sai direto
// (economiza GB e não muda nada nos outros sites). Vale só para a partição do navegador integrado. Usuário e senha do proxy
// respondem ao pedido de autenticação do Chromium e nunca vão para log.
const PARTICAO = 'persist:navegador'
const DOMINIOS_PADRAO = ['instagram.com', 'cdninstagram.com', 'facebook.com', 'fbcdn.net', 'facebook.net', 'fbsbx.com', 'arkoselabs.com', 'funcaptcha.com', 'arkoselabs.cn', 'messenger.com', 'threads.net', 'tiktok.com', 'tiktokcdn.com', 'tiktokv.com', 'byteoversea.com', 'whatsapp.com', 'whatsapp.net', 'x.com', 'twitter.com', 'twimg.com', 'linkedin.com', 'licdn.com']

function pacDe(proxyUrl, dominios) {
  const u = new URL(proxyUrl)
  const tipo = u.protocol === 'socks5:' ? 'SOCKS5' : u.protocol === 'https:' ? 'HTTPS' : 'PROXY'
  const alvo = `${tipo} ${u.hostname}:${u.port}`
  const ds = (dominios || []).map((d) => String(d).toLowerCase().replace(/[^a-z0-9.-]/g, '')).filter(Boolean)
  return `function FindProxyForURL(url, host) {
  host = host.toLowerCase();
  var d = ${JSON.stringify(ds)};
  for (var i = 0; i < d.length; i++) { if (host === d[i] || dnsDomainIs(host, '.' + d[i])) return '${alvo}'; }
  return 'DIRECT';
}`
}

function criar({ app, session, net, buscar, registrar = () => {} }) {
  let atual = null // { url, dominios, host, porta, usuario, senha }
  const ses = () => session.fromPartition(PARTICAO)

  // autenticação do proxy: só para o host/porta do proxy configurado
  app.on('login', (event, _wc, _det, authInfo, callback) => {
    if (!authInfo || !authInfo.isProxy || !atual || !atual.usuario) return
    if (String(authInfo.host) !== atual.host || Number(authInfo.port) !== atual.porta) return
    event.preventDefault()
    callback(atual.usuario, atual.senha)
  })

  async function aplicar(conf) {
    const s = ses()
    if (!conf || !conf.proxy) {
      atual = null
      await s.setProxy({ mode: 'direct' })
      await s.closeAllConnections?.()
      return { ativo: false }
    }
    const u = new URL(conf.proxy)
    atual = { url: conf.proxy, dominios: conf.dominios || [], host: u.hostname, porta: Number(u.port), usuario: decodeURIComponent(u.username || ''), senha: decodeURIComponent(u.password || '') }
    // TUDO pelo proxy (só nas VMs; no computador do cliente não há proxy). Proxiar só alguns domínios misturava IPs
    // (site por um IP, captcha e CDN por outro) e os antifraudes travavam o login (14/11/2026). Só o local fica direto.
    await s.setProxy({ mode: 'fixed_servers', proxyRules: `http=${u.hostname}:${u.port};https=${u.hostname}:${u.port}`, proxyBypassRules: '<local>;localhost;127.0.0.1;[::1]' })
    await s.closeAllConnections?.()
    registrar(`navegador: proxy ligado para toda a navegação (${u.protocol}//${u.hostname}:${u.port})`)
    return { ativo: true }
  }

  // busca no servidor e aplica; sem conta ou sem resposta, mantém o que estava
  async function atualizar() {
    try {
      const conf = await buscar()
      if (conf) return await aplicar(conf)
    } catch (e) {
      registrar('navegador: não consegui buscar o proxy: ' + (e.message || e))
    }
    return estado()
  }

  function estado() {
    return atual ? { ativo: true, servidor: `${atual.host}:${atual.porta}`, dominios: atual.dominios } : { ativo: false, dominios: [] }
  }

  // teste: por qual caminho o Instagram sai, e qual é o IP e o país de saída por esse caminho
  async function testar() {
    const s = ses()
    const rota = await s.resolveProxy('https://www.instagram.com/')
    const out = { rota: rota === 'DIRECT' ? 'direto' : 'proxy' }
    // a mesma rota forçada para um serviço de IP (só neste teste, numa sessão temporária)
    const tmp = session.fromPartition('sb-proxy-teste-' + Date.now())
    try {
      if (atual) {
        const u = new URL(atual.url)
        const tipo = u.protocol === 'socks5:' ? 'socks5' : u.protocol === 'https:' ? 'https' : 'http'
        await tmp.setProxy({ proxyRules: `${tipo}://${u.hostname}:${u.port}` })
      }
      const txt = await new Promise((ok, falha) => {
        const req = net.request({ url: 'https://ipinfo.io/json', session: tmp, useSessionCookies: false })
        let corpo = ''
        req.on('response', (r) => { r.on('data', (c) => (corpo += c)); r.on('end', () => ok(corpo)) })
        req.on('login', (auth, cb) => (auth && auth.isProxy && atual ? cb(atual.usuario, atual.senha) : cb()))
        req.on('error', falha)
        setTimeout(() => falha(new Error('sem resposta em 20 s')), 20000)
        req.end()
      })
      const j = JSON.parse(txt)
      Object.assign(out, { ip: j.ip, pais: j.country, cidade: j.city, rede: j.org })
    } catch (e) {
      out.erro = String(e.message || e)
    }
    return out
  }

  return { aplicar, atualizar, estado, testar }
}

module.exports = { criar, pacDe, PARTICAO, DOMINIOS_PADRAO }
