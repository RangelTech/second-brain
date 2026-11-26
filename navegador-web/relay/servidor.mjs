// Relay Wisp do navegador WebAssembly do Cérebro: a internet do navegador do cliente sai por aqui (IP de São Paulo).
// Aceita a chave fixa de teste (?t=WISP_CHAVE) ou um passe curto assinado pela ponte (?t=<dados>.<assinatura>, HMAC-SHA256 com WISP_SEGREDO,
// dados = base64url de {"c": conta, "x": validade em ms}). Bloqueia rede privada e loopback (SSRF) e limita conexões por conta.
import http from 'http'
import crypto from 'crypto'
import dns from 'dns'
import { server as wisp } from '@mercuryworkshop/wisp-js/server'
const CHAVE = process.env.WISP_CHAVE || ''
const SEGREDO = process.env.WISP_SEGREDO || ''
const MAX_POR_CONTA = Number(process.env.WISP_MAX_POR_CONTA || 6)
wisp.options.allow_loopback_ips = false
const abertas = new Map()

// Os sites da casa (*.rangeltech.net no IP deste servidor) não respondem pelo IP público de dentro do contêiner (sem "hairpin").
// Em vez de trocar a conexão (a classe própria estragava páginas pesadas), só a resolução de nomes muda: nome que aponta para este
// servidor vira o IP interno do Caddy. Como isso exige liberar IP privado no wisp, a própria resolução recusa qualquer outro destino
// privado ou local (proteção contra SSRF) e IP digitado direto fica proibido.
const IP_PUBLICO = process.env.IP_PUBLICO || '177.153.38.54'
const CADDY_INTERNO = process.env.CADDY_INTERNO || 'nav-caddy'
const privado = (ip) => /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(ip) || ip === '::1' || /^f[cd]/i.test(ip) || /^fe80/i.test(ip)
async function resolver(host) {
  const r = await dns.promises.lookup(host, { family: 4 })
  if (r.address === IP_PUBLICO) return (await dns.promises.lookup(CADDY_INTERNO, { family: 4 })).address
  if (privado(r.address)) throw new Error('destino bloqueado')
  return r.address
}
wisp.options.allow_private_ips = true
wisp.options.allow_direct_ip = false
wisp.options.dns_method = resolver

function conferir(t) {
  if (!t) return null
  if (CHAVE && t.length === CHAVE.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(CHAVE))) return 'teste'
  if (!SEGREDO) return null
  const [dados, sig] = t.split('.')
  if (!dados || !sig) return null
  const esperado = crypto.createHmac('sha256', SEGREDO).update(dados).digest('base64url')
  if (sig.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado))) return null
  try {
    const o = JSON.parse(Buffer.from(dados, 'base64url').toString('utf8'))
    if (!o || typeof o.c !== 'string' || !(o.x > Date.now())) return null
    return 'c:' + o.c
  } catch { return null }
}

const srv = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok') })
srv.on('upgrade', (req, socket, head) => {
  const u = new URL(req.url, 'http://x')
  const quem = u.pathname.startsWith('/wisp') ? conferir(u.searchParams.get('t') || '') : null
  if (!quem) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); return socket.destroy() }
  const n = abertas.get(quem) || 0
  if (quem !== 'teste' && n >= MAX_POR_CONTA) { socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n'); return socket.destroy() }
  abertas.set(quem, n + 1)
  socket.once('close', () => { const k = (abertas.get(quem) || 1) - 1; if (k > 0) abertas.set(quem, k); else abertas.delete(quem) })
  req.url = '/wisp/' // a chave já foi conferida; o wisp decide o modo pelo final do caminho
  wisp.routeRequest(req, socket, head)
})
srv.listen(8080, '0.0.0.0', () => console.log('relay wisp na porta 8080'))
