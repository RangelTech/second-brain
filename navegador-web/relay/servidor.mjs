// Relay Wisp do navegador WebAssembly do Cérebro: a internet do navegador do cliente sai por aqui (IP de São Paulo).
// Aceita a chave fixa de teste (?t=WISP_CHAVE) ou um passe curto assinado pela ponte (?t=<dados>.<assinatura>, HMAC-SHA256 com WISP_SEGREDO,
// dados = base64url de {"c": conta, "x": validade em ms}). Bloqueia rede privada e loopback (SSRF) e limita conexões por conta.
import http from 'http'
import crypto from 'crypto'
import { server as wisp } from '@mercuryworkshop/wisp-js/server'
const CHAVE = process.env.WISP_CHAVE || ''
const SEGREDO = process.env.WISP_SEGREDO || ''
const MAX_POR_CONTA = Number(process.env.WISP_MAX_POR_CONTA || 6)
wisp.options.allow_private_ips = false
wisp.options.allow_loopback_ips = false
const abertas = new Map()

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
