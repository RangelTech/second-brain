// Servidor MCP (stdio) do Motion desenhado (spec 37): página HTML (CSS, SVG, canvas, React com htm, ajudante SB) vira MP4 no próprio app.
const readline = require('readline')
// Conversas: endereço e senha vêm no ambiente. Workflows (servidor global do Hermes): vêm do arquivo SB_PONTE_ARQ, que o app regrava a cada início.
let URL_APP = process.env.SB_NAV_URL
let TOKEN = process.env.SB_NAV_TOKEN
function ponte() {
  if (!process.env.SB_PONTE_ARQ) return
  try {
    const j = JSON.parse(require('fs').readFileSync(process.env.SB_PONTE_ARQ, 'utf8'))
    URL_APP = j.url
    TOKEN = j.token
  } catch {
    throw new Error('O Segundo Cérebro precisa estar aberto (pode ser só na bandeja) para usar o navegador, o WhatsApp e o Motion.')
  }
}
const obj = (props, req = []) => ({ type: 'object', properties: props, required: req })
const ARGS = {
  html: { type: 'string', description: 'Página HTML completa da animação (CSS, SVG, canvas). React, ReactDOM, html`...` (JSX sem compilar) e SB (easing, spring, stagger, split, mix, noise) já estão carregados. Anime com CSS @keyframes, Web Animations ou defina window.sbFrame = (t) => {...} (t em segundos). Caminhos relativos partem da pasta do vídeo de saída.' },
  arquivo: { type: 'string', description: 'Em vez de html: caminho de um arquivo .html já salvo.' },
  saida: { type: 'string', description: 'Caminho do .mp4 a gerar (na pasta Videos da pasta de trabalho).' },
  largura: { type: 'number', description: 'Pixels. Padrão 1080.' },
  altura: { type: 'number', description: 'Pixels. Padrão 1920 (vertical 9:16). Use 1080x1080 (1:1), 1920x1080 (16:9), 1080x1350 (4:5).' },
  fps: { type: 'number', description: 'Quadros por segundo, 24 a 60. Padrão 30.' },
  duracao: { type: 'number', description: 'Segundos, 0,5 a 180. Padrão 6.' },
}
const FERRAMENTAS = [
  { nome: 'previa', desc: 'Tira alguns quadros (PNG) da animação HTML sem gerar o vídeo, para você OLHAR com vision_analyze antes de renderizar. Sempre rode antes de motion_animar e corrija o que estiver feio (texto cortado, fora da área segura, sobreposto, cor sem contraste).', schema: obj({ ...ARGS, quadros: { type: 'array', items: { type: 'number' }, description: 'Tempos em segundos (até 8). Padrão: começo, meio e fim.' } }, ['saida']) },
  { nome: 'animar', desc: 'Renderiza a animação HTML em vídeo MP4 (H.264), quadro a quadro, no tamanho e duração pedidos, com trilha opcional. Roda no computador do usuário, sem custo. Devolve o caminho, a duração e o tempo gasto.', schema: obj({ ...ARGS, audio: { type: 'string', description: 'Opcional: música ou narração (mp3, wav, m4a) para pôr no vídeo.' }, volume: { type: 'number', description: 'Volume da trilha, 0,01 a 2. Padrão 1.' } }, ['saida']) },
]
const enviar = (o) => process.stdout.write(JSON.stringify(o) + '\n')
// http puro (sem fetch): render longo pode passar de 5 min e o fetch do Node corta a espera da resposta nesse ponto
function chamar(nome, args) {
  ponte()
  const u = new URL(URL_APP)
  const corpo = Buffer.from(JSON.stringify({ nome: 'motion_' + nome, args }))
  return new Promise((ok, falha) => {
    const req = require('http').request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': corpo.length, Authorization: 'Bearer ' + TOKEN } }, (res) => {
      let d = ''
      res.setEncoding('utf8')
      res.on('data', (c) => (d += c))
      res.on('end', () => { try { ok(JSON.parse(d)) } catch (e) { falha(e) } })
    })
    req.on('error', falha)
    req.end(corpo)
  })
}
async function tratar(msg) {
  const { id, method, params } = msg
  if (method === 'initialize') return enviar({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'motion', version: '1.0.0' } } })
  if (method && method.startsWith('notifications/')) return
  if (method === 'ping') return enviar({ jsonrpc: '2.0', id, result: {} })
  if (method === 'tools/list') return enviar({ jsonrpc: '2.0', id, result: { tools: FERRAMENTAS.map((f) => ({ name: 'motion_' + f.nome, description: f.desc, inputSchema: f.schema })) } })
  if (method === 'tools/call') {
    const nome = String(params?.name || '').replace(/^motion_/, '')
    try {
      const r = await chamar(nome, params?.arguments || {})
      if (!r.ok) return enviar({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: r.erro || 'Falhou.' }] } })
      return enviar({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: r.texto || 'ok' }] } })
    } catch (e) {
      return enviar({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: 'Não consegui falar com o aplicativo: ' + e.message }] } })
    }
  }
  if (id !== undefined) enviar({ jsonrpc: '2.0', id, error: { code: -32601, message: 'método não suportado' } })
}
readline.createInterface({ input: process.stdin }).on('line', (l) => {
  let m
  try { m = JSON.parse(l) } catch { return }
  tratar(m).catch((e) => m.id !== undefined && enviar({ jsonrpc: '2.0', id: m.id, error: { code: -32603, message: String(e.message || e) } }))
})
