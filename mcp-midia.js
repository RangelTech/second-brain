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

// preferências que o usuário edita em Configurações > Imagens e vídeos (o agente pode sobrescrever caso a caso)
const PREFS = (() => { try { return JSON.parse(process.env.SB_MIDIA_PREFS || '{}') } catch { return {} } })()
const ESTILOS = { realista: 'photorealistic, natural lighting, high detail', ilustracao: 'clean digital illustration, flat colors, soft shading' }
function extras(a, video) {
  const o = {}
  const neg = [PREFS.negativos, a.negative_prompt].filter(Boolean).join(', ')
  if (neg) o.negative_prompt = neg.slice(0, 600)
  const q = a.qualidade || PREFS.qualidade
  if (q === 'alta' || q === 'rapida') o.quality = q
  if (a.steps != null) o.steps = Number(a.steps)
  if (a.cfg != null) o.cfg = Number(a.cfg)
  return o
}
const comEstilo = (prompt) => { const e = ESTILOS[PREFS.estilo]; return e && !String(prompt).includes(e) ? `${prompt}, ${e}` : prompt }

const obj = (props, req = []) => ({ type: 'object', properties: props, required: req })
const FORMATOS = { quadrado: '1024x1024', retrato: '832x1216', paisagem: '1216x832', story: '720x1280', banner: '1344x768' }
const FORMATOS_VIDEO = ['paisagem', 'retrato', 'quadrado']
const FERRAMENTAS = [
  {
    nome: 'trocar_personagem',
    desc: 'Troca a pessoa principal de um VÍDEO pela pessoa de uma FOTO (troca de personagem / de rosto), mantendo câmera, cortes, movimento e áudio do vídeo original. Roda na GPU do servidor com o Openjutsu (MiniMax H3) e leva vários minutos (cerca de 9 minutos para 5 segundos em 480p). Use quando o usuário pedir para colocar o rosto ou a pessoa de uma foto num vídeo. Funciona melhor com uma pessoa em primeiro plano, rosto grande no quadro e foto nítida de frente; espelhos e reflexos falham. Salva um MP4 na pasta Videos e devolve o caminho.',
    schema: obj({
      video: { type: 'string', description: 'Caminho do vídeo de origem (MP4, MOV ou WEBM, até 40 MB).' },
      foto: { type: 'string', description: 'Caminho da foto da pessoa que vai entrar no vídeo (PNG, JPEG ou WEBP, até 6 MB).' },
      resolucao: { type: 'string', enum: ['480p', '576p', '736p'], description: 'Altura do vídeo gerado. Padrão: 480p (mais rápido). Mais alto leva muito mais tempo.' },
      sem_sincronia_labial: { type: 'boolean', description: 'true (padrão) quando as pessoas do vídeo não estão cantando nem falando junto com o áudio.' },
      nome: { type: 'string', description: 'Nome curto do arquivo, sem extensão (opcional).' },
    }, ['video', 'foto']),
  },
  {
    nome: 'gerar_video',
    desc: 'Gera um VÍDEO (1 a 60 segundos, sem áudio, até 512x512; acima de 4 s o servidor encadeia vários clipes e entrega um MP4 só, o que leva alguns minutos) a partir de uma descrição, numa GPU do servidor. Leva de 1 a vários minutos; o app mostra o andamento. Salva um MP4 na pasta Videos da pasta de trabalho e devolve o caminho. Escreva o prompt em INGLÊS, descrevendo a cena e o movimento da câmera (ex.: "slow camera push-in, a juicy cheeseburger falls onto a wooden board, bun and lettuce bounce, studio lighting, shallow depth of field"). Serve para cenas realistas (produto, comida, natureza, pessoas). Para animações gráficas com texto, gráficos, títulos e legendas use a skill video-motion, que não gasta GPU.',
    schema: obj({
      prompt: { type: 'string', description: 'Cena e movimento, em inglês, MUITO detalhado (80 a 150 palavras, mínimo 40; 20 se passar imagem): sujeito, cenário, ação e movimento, câmera e lente, luz, paleta, atmosfera, estilo e qualidade.' },
      formato: { type: 'string', enum: FORMATOS_VIDEO, description: 'paisagem (768x512), retrato (512x768) ou quadrado. Padrão: paisagem.' },
      imagem: { type: 'string', description: 'Caminho de uma imagem para ANIMAR (imagem para vídeo). PNG, JPEG ou WEBP até 6 MB. Opcional.' },
      strength: { type: 'number', description: 'Quanto mudar a imagem de partida, de 0 a 1 (opcional).' },
      fps: { type: 'number', description: 'Quadros por segundo, de 8 a 30 (opcional).' },
      segundos: { type: 'number', description: 'Duração total de 1 a 60 segundos (o servidor encadeia clipes de 4 s na qualidade rápida e de 5 s na alta). Padrão: 4.' },
      nome: { type: 'string', description: 'Nome curto do arquivo, sem extensão (opcional).' },
      negative_prompt: { type: 'string', description: 'O que evitar (em inglês): ex. "blurry, deformed hands, extra fingers, watermark, text". Opcional.' },
      qualidade: { type: 'string', enum: ['rapida', 'alta'], description: 'rapida (padrão): modelo leve, cerca de 1 minuto, 640x384, serve para testar. alta: modelo Wan 2.2 em 1280x704 e 24 quadros por segundo, mantém logos, rostos e detalhes, leva de 7 a 20 minutos (5 segundos de vídeo levam cerca de 7 minutos). Use alta quando o usuário pedir qualidade, cinema, comercial ou algo para publicar. Para o melhor resultado, gere antes uma imagem com gerar_imagem e anime-a passando em imagem.' },
      steps: { type: 'number', description: 'Passos de geração (opcional; normalmente deixe a qualidade escolher).' },
      cfg: { type: 'number', description: 'Fidelidade ao prompt (opcional).' },
      seed: { type: 'number', description: 'Semente para repetir ou variar um resultado (opcional).' },
    }, ['prompt']),
  },
  {
    nome: 'gerar_imagem',
    desc: 'Gera uma imagem a partir de uma descrição, numa GPU do servidor (cerca de 10 a 30 segundos). Salva um PNG na pasta de trabalho e devolve o caminho completo. Escreva o prompt em INGLÊS, detalhado (assunto, estilo, luz, enquadramento, cores). Título curto (1 a 3 palavras, caixa alta, entre aspas no prompt) sai legível. Para frase longa ou texto com acento (ÃO, É, Ç), gere a imagem SEM texto e avise que o texto pode ser colocado depois: o modelo erra acentos e letras. Para pessoas, peça a contagem exata no prompt (exactly two people).',
    schema: obj({
      prompt: { type: 'string', description: 'Descrição da imagem, em inglês, MUITO detalhada (60 a 120 palavras, mínimo 30): sujeito e aparência, cenário, enquadramento e lente, luz, paleta, atmosfera, estilo e qualidade.' },
      estilo: { type: 'string', enum: ['foto', 'cinema', 'ilustracao', 'anime', '3d', 'minimalista', 'aquarela'], description: 'Estilo visual (opcional; segue a preferência do usuário).' },
      n: { type: 'number', description: 'Quantas opções gerar, de 1 a 4 (opcional).' },
      formato: { type: 'string', enum: Object.keys(FORMATOS), description: 'quadrado (1024x1024), retrato, paisagem, story (vertical 9:16) ou banner. Padrão: quadrado.' },
      nome: { type: 'string', description: 'Nome curto do arquivo, sem extensão (opcional).' },
      negative_prompt: { type: 'string', description: 'O que evitar (em inglês): ex. "blurry, deformed hands, extra fingers, watermark, text". Opcional.' },
      qualidade: { type: 'string', enum: ['rapida', 'alta'], description: 'rapida (padrão, menos passos) ou alta (mais passos, mais lento).' },
      steps: { type: 'number', description: 'Passos de geração (opcional; normalmente deixe a qualidade escolher).' },
      cfg: { type: 'number', description: 'Fidelidade ao prompt (opcional).' },
      seed: { type: 'number', description: 'Semente para repetir ou variar um resultado (opcional).' },
    }, ['prompt']),
  },
]

const enviar = (o) => process.stdout.write(JSON.stringify(o) + '\n')
const pausa = (ms) => new Promise((r) => setTimeout(r, ms))
const limpo = (s) => String(s || 'imagem').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'imagem'

// ---- andamento para a tela: o app lê este arquivo (pasta de trabalho/.midia) a cada 1-2 s e mostra fila, percentual e resultado.
// Nome = tipo + hash do prompt (o app calcula o mesmo hash a partir da entrada da ferramenta). Nada de texto técnico vai para a tela.
const hashMidia = (s) => {
  let h = 0x811c9dc5
  const t = String(s || '')
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16).padStart(8, '0')
}
function marcar(tipo, prompt, st) {
  try {
    const dir = path.join(PASTA, '.midia')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, `${tipo}-${hashMidia(String(prompt || '').slice(0, 3500))}.json`), JSON.stringify({ ...st, t: Date.now() }))
  } catch { /* andamento é só enfeite: nunca derruba a geração */ }
}
// GET /media/jobs/{id} -> { status: queued|running|done|failed, position, eta_s, progress 0..100, message }. Servidor antigo: cai no /jobs/{id}.
async function andamento(id) {
  let r = await api('/media/jobs/' + id)
  if (r.status === 404) {
    r = await api('/jobs/' + id)
    const o = await r.json().catch(() => ({}))
    return { mime: o.mime, status: o.state === 'failed' ? 'failed' : o.state === 'done' ? 'done' : o.state === 'queued' || o.state === 'waiting' ? 'queued' : 'running', position: null, eta_s: null, progress: null, seconds: o.seconds, size: o.size, error: o.error }
  }
  const o = await r.json().catch(() => ({}))
  return { mime: o.mime, status: o.status || 'running', position: o.position ?? null, eta_s: o.eta_s ?? null, progress: typeof o.progress === 'number' ? o.progress : null, seconds: o.seconds, size: o.size, error: o.error }
}
// simulação (SB_MIDIA_MOCK=1 dá certo, =fail falha) para desenvolver a tela sem o servidor
async function simular(tipo, prompt, arquivo) {
  const falha = process.env.SB_MIDIA_MOCK === 'fail'
  for (const pos of [2, 2, 1, 1]) { marcar(tipo, prompt, { status: 'queued', position: pos, eta_s: 40, progress: 0 }); await pausa(1500) }
  for (let p = 0; p <= 100; p += 5) {
    if (falha && p >= 45) { marcar(tipo, prompt, { status: 'failed', position: null, eta_s: null, progress: p }); throw new Error('Não consegui gerar agora, tente de novo em instantes.') }
    marcar(tipo, prompt, { status: 'running', position: null, eta_s: Math.round((100 - p) * 0.3), progress: p }); await pausa(700)
  }
  marcar(tipo, prompt, { status: 'done', position: null, eta_s: 0, progress: 100 })
  const dir = path.join(PASTA, tipo === 'video' ? 'Videos' : 'Imagens')
  fs.mkdirSync(dir, { recursive: true })
  const dest = path.join(dir, `simulado-${Date.now()}${path.extname(arquivo)}`)
  fs.copyFileSync(arquivo, dest)
  return { caminho: dest, segundos: 20, tamanho: 'simulado' }
}

async function api(rota, opcoes = {}) {
  const r = await fetch(BASE + rota, { ...opcoes, headers: { Authorization: 'Bearer ' + CHAVE, 'Content-Type': 'application/json', ...(opcoes.headers || {}) } })
  return r
}

const MSG_FALHA = 'Não consegui gerar agora, tente de novo em instantes.'
const EXT_POR_MIME = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' }
const stampAgora = () => new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{6})$/, '$1-$2')

// Contrato do servidor de mídia: POST ... { async: true } -> 202 { id }; GET /media/jobs/{id} (fila, percentual); GET /jobs/{id}/file (arquivo com o Content-Type real)
async function rodarJob({ tipo, rota, corpo, prompt, nome, limiteMs }) {
  const t0 = Date.now()
  marcar(tipo, prompt, { status: 'queued', position: null, eta_s: null, progress: 0 })
  const r = await api(rota, { method: 'POST', body: JSON.stringify({ ...corpo, async: true }) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok && r.status !== 202) {
    marcar(tipo, prompt, { status: 'failed' })
    const msg = j.error?.message || j.detail || `HTTP ${r.status}`
    if (r.status === 422) throw new Error(String(msg)) // pedido inválido: a mensagem já vem em português para o agente corrigir
    throw new Error(r.status === 429 ? 'Estamos com bastante movimento agora. Tente de novo em instantes.' : r.status === 503 ? 'Este recurso não está disponível no momento.' : MSG_FALHA + (process.env.SB_MIDIA_DEBUG ? ' (' + msg + ')' : ''))
  }
  const id = j.id
  while (Date.now() - t0 < limiteMs) {
    await pausa(1500)
    const s = await andamento(id)
    marcar(tipo, prompt, s)
    if (s.status === 'failed') throw new Error(MSG_FALHA)
    if (s.status === 'done') {
      const f = await api('/jobs/' + id + '/file')
      const mime = String(f.headers.get('content-type') || s.mime || '').split(';')[0].trim()
      const ext = EXT_POR_MIME[mime]
      const ehVideo = tipo === 'video'
      // o tipo vem do que o servidor entregou: vídeo precisa chegar como vídeo e imagem como imagem
      if (!f.ok || !ext || (ehVideo ? !/^video\//.test(mime) : !/^image\//.test(mime))) { marcar(tipo, prompt, { status: 'failed' }); throw new Error(MSG_FALHA) }
      const dir = path.join(PASTA, ehVideo ? 'Videos' : 'Imagens')
      fs.mkdirSync(dir, { recursive: true })
      const arq = path.join(dir, `${limpo(nome || (ehVideo ? 'video' : 'imagem'))}-${stampAgora()}${ext}`)
      fs.writeFileSync(arq, Buffer.from(await f.arrayBuffer()))
      marcar(tipo, prompt, { status: 'done', position: null, eta_s: 0, progress: 100 })
      return { caminho: arq, segundos: s.seconds ?? Math.round((Date.now() - t0) / 100) / 10, tamanho: s.size, ajustes: s.adjusted, params: s.params }
    }
  }
  marcar(tipo, prompt, { status: 'failed' })
  throw new Error(MSG_FALHA)
}

// preferências -> parâmetros do servidor
const ESTILO_SERVIDOR = { realista: 'foto', foto: 'foto', cinema: 'cinema', ilustracao: 'ilustracao', anime: 'anime', '3d': '3d', minimalista: 'minimalista', aquarela: 'aquarela' }
function paramsComuns(a, video) {
  const o = {}
  const neg = [PREFS.negativos, a.negative_prompt].filter(Boolean).join(', ')
  if (neg) o.negative_prompt = neg.slice(0, 600)
  if (a.seed != null) o.seed = Number(a.seed)
  if (a.cfg != null) o.cfg = Number(a.cfg)
  const q = a.qualidade || PREFS.qualidade
  if (a.steps != null) o.steps = Number(a.steps)
  else if (q === 'alta') o.steps = video ? 40 : 8
  return o
}

// O resultado só é tão bom quanto o prompt: prompt curto vira resultado genérico. Recusa e orienta o agente a detalhar (ele tenta de novo sozinho).
function exigirDetalhe(tipo, prompt, minimo) {
  const palavras = String(prompt || '').trim().split(/\s+/).filter(Boolean).length
  if (palavras >= minimo) return
  throw new Error(`O prompt está curto demais (${palavras} palavras; o mínimo é ${minimo}). Detalhe mais e chame a ferramenta de novo: sujeito com aparência, cenário, ${tipo === 'vídeo' ? 'ação e movimento, câmera e lente, ' : 'enquadramento e lente, '}iluminação, paleta de cores, atmosfera, estilo e qualidade, mais negative_prompt. Se faltar informação do usuário, pergunte (até 5 perguntas curtas com sugestão); se ele disser "pode seguir", invente os detalhes você mesmo.`)
}

async function gerarImagem(args) {
  const { prompt, formato, nome } = args
  exigirDetalhe('imagem', prompt, 30)
  if (!CHAVE) throw new Error('O Segundo Cérebro ainda não tem a chave do servidor (Unlimited). Abra Configurações e conclua o cadastro.')
  if (process.env.SB_MIDIA_MOCK) return simular('imagem', prompt, process.env.SB_MIDIA_MOCK_IMG || path.join(__dirname, 'renderer', 'img', 'segundo-cerebro-64.png'))
  const corpo = { prompt: String(prompt || '').slice(0, 3500), size: FORMATOS[formato] || FORMATOS[PREFS.proporcao] || FORMATOS.quadrado, ...paramsComuns(args, false) }
  const estilo = ESTILO_SERVIDOR[args.estilo] || ESTILO_SERVIDOR[PREFS.estilo]
  if (estilo) corpo.style = estilo
  if (args.n != null) corpo.n = Math.max(1, Math.min(4, Number(args.n)))
  return rodarJob({ tipo: 'imagem', rota: '/images/generations', corpo, prompt, nome, limiteMs: ESPERA_MAX_MS })
}

async function trocarPersonagem(args) {
  const { video, foto, resolucao, nome } = args
  if (!CHAVE) throw new Error('O Segundo Cérebro ainda não tem a chave do servidor. Entre na sua conta.')
  if (process.env.SB_MIDIA_MOCK) return simular('video', 'troca de personagem', process.env.SB_MIDIA_MOCK_ARQ || '')
  const v = fs.readFileSync(String(video))
  const f = fs.readFileSync(String(foto))
  if (v.length > 40 * 1024 * 1024) throw new Error('O vídeo é grande demais (máximo 40 MB). Corte ou comprima o vídeo antes.')
  if (f.length > 6 * 1024 * 1024) throw new Error('A foto é grande demais (máximo 6 MB).')
  const corpo = { recipe: 'openjutsu-swap', video: v.toString('base64'), image: f.toString('base64'), resolution: ['480p', '576p', '736p'].includes(resolucao) ? resolucao : '480p', no_lip_sync: args.sem_sincronia_labial !== false }
  return rodarJob({ tipo: 'video', rota: '/videos/generations', corpo, prompt: 'troca de personagem', nome: nome || 'troca-personagem', limiteMs: 60 * 60 * 1000 })
}

async function gerarVideo(args) {
  const { prompt, formato, segundos, nome } = args
  exigirDetalhe('vídeo', prompt, args.imagem ? 20 : 40)
  if (!CHAVE) throw new Error('O Segundo Cérebro ainda não tem a chave do servidor. Entre na sua conta.')
  if (process.env.SB_MIDIA_MOCK) return simular('video', prompt, process.env.SB_MIDIA_MOCK_ARQ || '')
  const corpo = {
    prompt: String(prompt || '').slice(0, 3500),
    format: FORMATOS_VIDEO.includes(formato) ? formato : FORMATOS_VIDEO.includes(PREFS.proporcao) ? PREFS.proporcao : 'paisagem',
    seconds: Math.max(1, Math.min(60, Number(segundos) || Number(PREFS.duracao) || 4)),
    ...paramsComuns(args, true),
  }
  if (args.fps != null) corpo.fps = Number(args.fps)
  const alta = args.qualidade === 'alta'
  if (alta) {
    corpo.recipe = 'wan22-ti2v' // alta qualidade: Wan 2.2 (1280x704, 24 fps); o servidor encadeia clipes de 5 s
    delete corpo.fps
    if (args.steps == null) delete corpo.steps // o Wan já usa 20 passos; 40 só dobraria o tempo
  }
  // imagem -> vídeo: a imagem de partida vai em base64 (PNG, JPEG ou WEBP, até 6 MB)
  if (args.imagem) {
    const bin = fs.readFileSync(String(args.imagem))
    if (bin.length > 6 * 1024 * 1024) throw new Error('A imagem de partida é grande demais (máximo 6 MB).')
    corpo.image = bin.toString('base64')
    if (args.strength != null) corpo.strength = Math.max(0, Math.min(1, Number(args.strength)))
  }
  return rodarJob({ tipo: 'video', rota: '/videos/generations', corpo, prompt, nome, limiteMs: (alta ? Math.max(30, Math.ceil((corpo.seconds || 5) / 5) * 12) : Math.max(20, Math.ceil((corpo.seconds || 4) / 4) * 3)) * 60 * 1000 })
}

// uma nova tentativa em silêncio (o cartão segue em "Gerando...") antes de mostrar a falha
async function comReserva(fn, args, tipo) {
  for (let t = 0; ; t++) {
    try {
      return await fn(args)
    } catch (e) {
      if (t >= 1 || /chave|sua conta/i.test(String(e.message))) throw e
      marcar(tipo, args.prompt, { status: 'queued', position: null, eta_s: null, progress: 0 })
      await pausa(2500)
    }
  }
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
      if (nome === 'trocar_personagem') {
        const v = await comReserva(trocarPersonagem, params?.arguments || {}, 'video')
        return enviar({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Vídeo com a troca criado em ${v.segundos} s (${v.tamanho}). caminho: ${v.caminho}` }] } })
      }
      if (nome === 'gerar_video') {
        const v = await comReserva(gerarVideo, params?.arguments || {}, 'video')
        return enviar({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Vídeo criado em ${v.segundos} s (${v.tamanho}). caminho: ${v.caminho}` }] } })
      }
      if (nome !== 'gerar_imagem') throw new Error('ferramenta desconhecida')
      const r = await comReserva(gerarImagem, params?.arguments || {}, 'imagem')
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

module.exports = { gerarImagem, gerarVideo, trocarPersonagem, FORMATOS }
