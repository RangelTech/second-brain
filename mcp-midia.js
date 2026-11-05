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
const FORMATOS_VIDEO = ['paisagem', 'retrato', 'quadrado']
const FERRAMENTAS = [
  {
    nome: 'gerar_video',
    desc: 'Gera um VÍDEO curto (2 a 6 segundos, sem áudio) a partir de uma descrição, numa GPU do servidor. Leva de 1 a vários minutos; o app mostra o andamento. Salva um MP4 na pasta Videos da pasta de trabalho e devolve o caminho. Escreva o prompt em INGLÊS, descrevendo a cena e o movimento da câmera (ex.: "slow camera push-in, a juicy cheeseburger falls onto a wooden board, bun and lettuce bounce, studio lighting, shallow depth of field"). Serve para cenas realistas (produto, comida, natureza, pessoas). Para animações gráficas com texto, gráficos, títulos e legendas use a skill video-motion, que não gasta GPU.',
    schema: obj({
      prompt: { type: 'string', description: 'Cena e movimento, em inglês, detalhado.' },
      formato: { type: 'string', enum: FORMATOS_VIDEO, description: 'paisagem (768x512), retrato (512x768) ou quadrado. Padrão: paisagem.' },
      segundos: { type: 'number', description: 'Duração de 2 a 6 segundos. Padrão: 4.' },
      nome: { type: 'string', description: 'Nome curto do arquivo, sem extensão (opcional).' },
      seed: { type: 'number', description: 'Semente para repetir ou variar um resultado (opcional).' },
    }, ['prompt']),
  },
  {
    nome: 'gerar_imagem',
    desc: 'Gera uma imagem a partir de uma descrição, numa GPU do servidor (cerca de 10 a 30 segundos). Salva um PNG na pasta de trabalho e devolve o caminho completo. Escreva o prompt em INGLÊS, detalhado (assunto, estilo, luz, enquadramento, cores). Título curto (1 a 3 palavras, caixa alta, entre aspas no prompt) sai legível. Para frase longa ou texto com acento (ÃO, É, Ç), gere a imagem SEM texto e avise que o texto pode ser colocado depois: o modelo erra acentos e letras. Para pessoas, peça a contagem exata no prompt (exactly two people).',
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

async function gerarVideo({ prompt, formato, segundos, nome, seed }) {
  if (!CHAVE) throw new Error('O Segundo Cérebro ainda não tem a chave do servidor. Entre na sua conta.')
  const corpo = { prompt: String(prompt || '').slice(0, 3500), formato: FORMATOS_VIDEO.includes(formato) ? formato : 'paisagem', seconds: Math.max(2, Math.min(6, Number(segundos) || 4)) }
  if (seed != null) corpo.seed = Number(seed)
  const t0 = Date.now()
  const r = await api('/videos/generations', { method: 'POST', body: JSON.stringify(corpo) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok && r.status !== 202) {
    const msg = j.error?.message || `HTTP ${r.status}`
    throw new Error(r.status === 429 ? 'A fila de vídeos está cheia. Tente de novo em instantes.' : r.status === 503 ? 'A máquina de vídeo está indisponível agora: ' + msg : 'Não consegui gerar: ' + msg)
  }
  const id = j.id
  const LIMITE = 20 * 60 * 1000
  while (Date.now() - t0 < LIMITE) {
    await pausa(4000)
    const s = await (await api('/jobs/' + id)).json().catch(() => ({}))
    if (s.state === 'failed') throw new Error(s.error || 'A geração do vídeo falhou.')
    if (s.state === 'done') {
      const f = await api('/jobs/' + id + '/file')
      const dir = path.join(PASTA, 'Videos')
      fs.mkdirSync(dir, { recursive: true })
      const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{6})$/, '$1-$2')
      const arq = path.join(dir, `${limpo(nome)}-${stamp}.mp4`)
      fs.writeFileSync(arq, Buffer.from(await f.arrayBuffer()))
      return { caminho: arq, segundos: s.seconds ?? Math.round((Date.now() - t0) / 1000), tamanho: s.size }
    }
  }
  throw new Error('O vídeo demorou demais (mais de 20 min). Tente de novo em instantes.')
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
      if (nome === 'gerar_video') {
        const v = await gerarVideo(params?.arguments || {})
        return enviar({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Vídeo criado em ${v.segundos} s (${v.tamanho}). caminho: ${v.caminho}` }] } })
      }
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

module.exports = { gerarImagem, gerarVideo, FORMATOS }
