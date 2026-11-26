// Relay Wisp do navegador WebAssembly do Cérebro: a internet do navegador do cliente sai por aqui (IP de São Paulo).
// Aceita a chave fixa de teste (?t=WISP_CHAVE) ou um passe curto assinado pela ponte (?t=<dados>.<assinatura>, HMAC-SHA256 com WISP_SEGREDO,
// dados = base64url de {"c": conta, "x": validade em ms}). Bloqueia rede privada e loopback (SSRF) e limita conexões por conta.
import http from 'http'
import crypto from 'crypto'
import net from 'net'
import dns from 'dns'
import { server as wisp } from '@mercuryworkshop/wisp-js/server'
const CHAVE = process.env.WISP_CHAVE || ''
const SEGREDO = process.env.WISP_SEGREDO || ''
const MAX_POR_CONTA = Number(process.env.WISP_MAX_POR_CONTA || 6)
wisp.options.allow_private_ips = false
wisp.options.allow_loopback_ips = false
const abertas = new Map()

// Os sites da casa (*.rangeltech.net no IP deste servidor) não respondem pelo IP público de dentro do contêiner (sem "hairpin").
// Para esses, a conexão vai direto ao Caddy pela rede interna; o resto da internet segue normal.
const IP_PUBLICO = process.env.IP_PUBLICO || '177.153.38.54'
const CADDY_INTERNO = process.env.CADDY_INTERNO || 'nav-caddy'
class Fila {
  constructor(max) { this.max = max; this.q = []; this.esperaGet = []; this.esperaPut = [] }
  async put(x) { if (this.q.length > this.max) await new Promise((r) => this.esperaPut.push(r)); this.q.push(x); this.esperaGet.shift()?.() }
  async get() { if (!this.q.length) await new Promise((r) => this.esperaGet.push(r)); this.esperaPut.shift()?.(); return this.q.shift() }
  close() { this.q = []; let f; while ((f = this.esperaGet.shift())) f(); while ((f = this.esperaPut.shift())) f() }
  get size() { return this.q.length }
}
// Saída residencial/4G (opcional): os sites que barram IP de servidor saem por um proxy residencial brasileiro, com um IP FIXO por
// cliente (a sessão do proxy é a conta), para o "não sou robô" não voltar a cada página. SAIDA_RESIDENCIAL = http://usuario:senha@host:porta,
// onde {sessao} no usuário vira o código da conta. Sem a variável, tudo sai por São Paulo como antes.
const SAIDA_RESIDENCIAL = process.env.SAIDA_RESIDENCIAL || ''
const DOMINIOS_RESIDENCIAIS = (process.env.DOMINIOS_RESIDENCIAIS || 'instagram.com,cdninstagram.com,facebook.com,fbcdn.net,messenger.com,whatsapp.com,whatsapp.net,youtube.com,youtu.be,googlevideo.com,ytimg.com,ggpht.com,accounts.google.com,google.com,gstatic.com,googleapis.com,tiktok.com,tiktokcdn.com,tiktokv.com,byteoversea.com,x.com,twitter.com,twimg.com,linkedin.com,licdn.com,threads.net,threads.com,mercadolivre.com.br,mercadolibre.com,shopee.com.br,netflix.com,spotify.com').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean)
const usaResidencial = (host) => { const h = String(host).toLowerCase(); return !!SAIDA_RESIDENCIAL && DOMINIOS_RESIDENCIAIS.some((d) => h === d || h.endsWith('.' + d)) }
function tunelResidencial(host, port, conta) {
  const u = new URL(SAIDA_RESIDENCIAL)
  const sessao = crypto.createHash('sha256').update('sessao:' + conta).digest('hex').slice(0, 12)
  const usuario = decodeURIComponent(u.username).replace('{sessao}', sessao)
  const auth = u.username ? 'Proxy-Authorization: Basic ' + Buffer.from(usuario + ':' + decodeURIComponent(u.password)).toString('base64') + '\r\n' : ''
  return new Promise((ok, erro) => {
    const s = net.connect({ host: u.hostname, port: +u.port || 80 })
    let buf = Buffer.alloc(0)
    const falhar = (e) => { s.destroy(); erro(e) }
    s.setTimeout(20000, () => falhar(new Error('proxy sem resposta')))
    s.once('error', falhar)
    s.on('connect', () => s.write(`CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\n${auth}\r\n`))
    const ler = (d) => {
      buf = Buffer.concat([buf, d])
      const fim = buf.indexOf('\r\n\r\n')
      if (fim < 0) { if (buf.length > 16384) falhar(new Error('resposta do proxy grande demais')); return }
      s.off('data', ler); s.off('error', falhar); s.setTimeout(0)
      const linha = buf.slice(0, buf.indexOf('\r\n')).toString()
      if (!/^HTTP\/1\.[01] 200/.test(linha)) return falhar(new Error('proxy recusou: ' + linha))
      ok({ socket: s, sobra: buf.slice(fim + 4) })
    }
    s.on('data', ler)
  })
}
class ConexaoTCP {
  constructor(hostname, port) { this.hostname = hostname; this.port = port; this.socket = null; this.paused = false; this.connected = false; this.data_queue = new Fila(128) }
  async connect() {
    if (usaResidencial(this.hostname) && this.conta) {
      try {
        const { socket: s, sobra } = await tunelResidencial(this.hostname, this.port, this.conta)
        this.socket = s; this.connected = true
        s.setNoDelay(true)
        if (sobra.length) this.data_queue.put(sobra)
        s.on('data', (d) => this.data_queue.put(d))
        s.on('close', () => { this.data_queue.close(); this.socket = null })
        s.on('error', () => {})
        s.on('end', () => { if (this.socket) { this.socket.destroy(); this.socket = null } })
        return
      } catch (e) { console.warn('saída residencial falhou, indo por São Paulo:', e.message) }
    }
    let host = this.hostname
    if (!net.isIP(host)) host = (await dns.promises.lookup(host)).address
    if (host === IP_PUBLICO) host = CADDY_INTERNO
    await new Promise((ok, erro) => {
      const s = (this.socket = new net.Socket())
      s.setNoDelay(true)
      s.on('connect', () => { this.connected = true; ok() })
      s.on('data', (d) => this.data_queue.put(d))
      s.on('close', (falhou) => { if (falhou && !this.connected) erro(new Error('falhou')); else this.data_queue.close(); this.socket = null })
      s.on('error', () => {})
      s.on('end', () => { if (this.socket) { this.socket.destroy(); this.socket = null } })
      s.connect({ host, port: this.port })
    })
  }
  async recv() { return await this.data_queue.get() }
  async send(d) { await new Promise((r) => this.socket ? this.socket.write(d, r) : r()) }
  async close() { if (this.socket) { this.socket.end(); this.socket = null } }
  pause() { if (this.socket && this.data_queue.size >= this.data_queue.max) { this.socket.pause(); this.paused = true } }
  resume() { if (this.socket && this.paused) { this.socket.resume(); this.paused = false } }
}

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
  class DaConta extends ConexaoTCP { constructor(h, p) { super(h, p); this.conta = quem } }
  wisp.routeRequest(req, socket, head, { TCPSocket: DaConta })
})
srv.listen(8080, '0.0.0.0', () => console.log('relay wisp na porta 8080'))
