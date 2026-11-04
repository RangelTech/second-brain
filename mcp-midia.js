// Servidor MCP (stdio) de mídia: dá ao agente a ferramenta de gerar imagens na GPU do servidor (fila de imagem do Unlimited).
// O Hermes inicia este processo; ele pede a imagem à API do servidor (a mesma chave do chat), grava o PNG na pasta de
// trabalho e devolve o caminho. Roda com o Node do Electron (ELECTRON_RUN_AS_NODE=1), sem dependências.
const readline = require('readline')
const fs = require('fs')
const path = require('path')

const BASE = (process.env.SB_MIDIA_BASE || 'https://qwen.rangeltech.net/v1').replace(/\/+$/, '')
const CHAVE = process.env.SB_MIDIA_CHAVE || ''
const PASTA = process.env.SB_MIDIA_PASTA || process.cwd()
const ESPERA_MAX_MS = 5 * 60 * 1000

const obj = (props, req = []) => ({ type: 'object', properties: props, required: req })
const FORMATOS = { quadrado: '1024x1024', retrato: '832x1216', paisagem: '1216x832', story: '720x1280', banner: '1344x768' }
const FERRAMENTAS = [
  {
    nome: 'gerar_imagem',
    desc: 'Gera uma imagem a partir de uma descrição, numa GPU do servidor (cerca de 10 a 30 segundos). Salva um PNG na pasta de trabalho e devolve o caminho completo. Escreva o prompt em INGLÊS, detalhado (assunto, estilo, luz, enquadramento, cores). Para arte de marketing com texto (título, slogan), prefira gerar a imagem SEM texto e avisar o usuário que o texto pode ser colocado depois: o modelo de imagem erra acentos e letras.',
    schema: obj({
      prompt: { type: 'string', description: 'Descrição da imagem, em inglês e detalhada.' },
      formato: { type: 'string', enum: Object.keys(FORMATOS), description: 'quadrado (1024x1024), retrato, paisagem, story (vertical 9:16) ou banner. Padrão: quadrado.' },
      nome: { type: 'string', description: 'Nome curto do arquivo, sem extensão (opcional).' },
      seed: { type: 'number', description: 'Semente para repetir ou variar um resultado (opcional).' },
    }, ['prompt']),
  },
]

const enviar = (o) => process.stdout.write(JSON.stringify(o) + '\n')
const pausa = (ms) => new Promise((r) => setTimeout(r, ms))
const limpo = (s) => String(s || 'imagem').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'imagem'

async function api(rota, opcoes = {}) {
  const r = await fetch(BASE + rota, { ...opcoes, headers: { Authorization: 'Bearer ' + CHAVE, 'Content-Type': 'application/json', ...(opcoes.headers || {}) } })
  return r
}

async function gerarImagem({ prompt, formato, nome, seed }) {
  if (!CHAVE) throw new Error('O Segundo Cérebro ainda não tem a chave do servidor (Unlimited). Abra Configurações e conclua o cadastro.')
  const corpo = { prompt: String(prompt || '').slice(0, 3500), size: FORMATOS[formato] || FORMATOS.quadrado, response_format: 'b64_json' }
  if (seed != null) corpo.seed = Number(seed)
  const t0 = Date.now()
  let r = await api('/images/generations', { method: 'POST', body: JSON.stringify(corpo) })
  let j = await r.json().catch(() => ({}))
  if (r.status === 202 && j.id) {
    // passou do tempo de espera síncrona: acompanha o pedido até terminar
    while (Date.now() - t0 < ESPERA_MAX_MS) {
      await pausa(3000)
      const s = await (await api('/jobs/' + j.id)).json().catch(() => ({}))
      if (s.state === 'failed') throw new Error(s.error || 'A geração falhou.')
      if (s.state === 'done') {
        const img = await api('/jobs/' + j.id + '/image')
        j = { data: [{ b64_json: Buffer.from(await img.arrayBuffer()).toString('base64') }], id: j.id, seconds: s.seconds, size: s.size }
        break
      }
    }
    if (!j.data) throw new Error('A imagem demorou demais (mais de 5 min). Tente de novo em instantes.')
  } else if (!r.ok) {
    const msg = j.error?.message || `HTTP ${r.status}`
    throw new Error(r.status === 429 ? 'A fila de imagens está cheia. Tente de novo em instantes.' : r.status === 503 ? 'A máquina de imagens está indisponível agora: ' + msg : 'Não consegui gerar: ' + msg)
  }
  const b64 = j.data?.[0]?.b64_json
  if (!b64) throw new Error('O servidor não devolveu a imagem.')
  const dir = path.join(PASTA, 'Imagens')
  fs.mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{6})$/, '$1-$2')
  const arq = path.join(dir, `${limpo(nome)}-${stamp}.png`)
  fs.writeFileSync(arq, Buffer.from(b64, 'base64'))
  return { caminho: arq, segundos: j.seconds ?? Math.round((Date.now() - t0) / 100) / 10, tamanho: j.size }
}

async function tratar(msg) {
  const { id, method, params } = msg
  if (method === 'initialize') return enviar({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'midia', version: '1.0.0' } } })
  if (method && method.startsWith('notifications/')) return
  if (method === 'ping') return enviar({ jsonrpc: '2.0', id, result: {} })
  if (method === 'tools/list') return enviar({ jsonrpc: '2.0', id, result: { tools: FERRAMENTAS.map((f) => ({ name: 'midia_' + f.nome, description: f.desc, inputSchema: f.schema })) } })
  if (method === 'tools/call') {
    const nome = String(params?.name || '').replace(/^midia_/, '')
    try {
      if (nome !== 'gerar_imagem') throw new Error('ferramenta desconhecida')
      const r = await gerarImagem(params?.arguments || {})
      return enviar({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Imagem criada em ${r.segundos} s (${r.tamanho}). caminho: ${r.caminho}` }] } })
    } catch (e) {
      return enviar({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: String(e.message || e) }] } })
    }
  }
  if (id !== undefined) enviar({ jsonrpc: '2.0', id, error: { code: -32601, message: 'método não suportado' } })
}

if (require.main === module) {
  readline.createInterface({ input: process.stdin }).on('line', (l) => {
    let m
    try {
      m = JSON.parse(l)
    } catch {
      return
    }
    tratar(m).catch((e) => m.id !== undefined && enviar({ jsonrpc: '2.0', id: m.id, error: { code: -32603, message: String(e.message || e) } }))
  })
}

module.exports = { gerarImagem, FORMATOS }
