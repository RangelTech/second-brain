// Servidor MCP (stdio) de mídia: dá ao agente a ferramenta de gerar imagens na GPU do servidor (fila de imagem do Unlimited).
// O Hermes inicia este processo; ele pede a imagem à API do servidor (a mesma chave do chat), grava o PNG na pasta de
// trabalho e devolve o caminho. Roda com o Node do Electron (ELECTRON_RUN_AS_NODE=1), sem dependências.
const readline = require('readline')
const fs = require('fs')
// sessão reserva (Spec 26): a conversa dona deste processo pode ser definida depois que ele nasce
const chatAtual = () => {
  try {
    if (process.env.SB_VAGA_ARQ) return fs.readFileSync(process.env.SB_VAGA_ARQ, 'utf8').trim() || process.env.SB_MIDIA_CHAT || ''
  } catch {}
  return process.env.SB_MIDIA_CHAT || ''
}
const path = require('path')
const { detalhar, formatarSaida, conferirTroca, formatarConferencia } = require('./midia-detalhar')

let BASE = (process.env.SB_MIDIA_BASE || 'https://qwen.rangeltech.net/v1').replace(/\/+$/, '')
let CHAVE = process.env.SB_MIDIA_CHAVE || ''
let PASTA = process.env.SB_MIDIA_PASTA || process.cwd()
// o aplicativo (processo principal) reaproveita este módulo para concluir os jobs pesados em segundo plano: aponta para a conta e a pasta dele
function configurar(c = {}) {
  if (c.base) BASE = String(c.base).replace(/\/+$/, '')
  if (c.chave !== undefined) CHAVE = c.chave
  if (c.pasta) PASTA = c.pasta
}
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
    nome: 'dublar_video',
    desc: 'REDUBLA um vídeo com a VOZ DO USUÁRIO (clonada de uma amostra) e, se pedido, em outro idioma: o vídeo fica igual, só a fala passa a ser dita com a voz dele. Duas etapas: 1) sem confirmado, ouve a fala do vídeo, traduz se preciso e devolve o PREÇO em créditos e um trecho do texto: mostre ao usuário e espere o SIM; 2) com confirmado=true, gera a voz e remonta o vídeo (de 1 a 6 minutos). Amostra: áudio ou vídeo com 30 s a 5 min de fala limpa da pessoa (quanto mais, melhor). A música de fundo não é mantida. A dublagem não sincroniza os lábios.',
    schema: obj({
      video: { type: 'string', description: 'Caminho do vídeo com fala (MP4, MOV, WEBM; até 500 MB).' },
      amostra: { type: 'string', description: 'Caminho do áudio (ou vídeo) com a voz de quem vai falar (30 s a 5 min).' },
      idioma: { type: 'string', description: 'Idioma da dublagem (pt, en, es, fr, de, it...). Padrão: o mesmo do vídeo.' },
      idioma_origem: { type: 'string', description: 'Idioma original, se o usuário souber (senão é detectado).' },
      texto_novo: { type: 'string', description: 'Opcional: o texto exato que deve ser dito (o usuário reescreveu a fala). Sem ele usa a fala original (traduzida se o idioma mudou).' },
      confirmado: { type: 'boolean', description: 'true somente depois que o usuário aceitou o preço em créditos.' },
      nome: { type: 'string', description: 'Nome curto do arquivo, sem extensão (opcional).' },
    }, ['video', 'amostra']),
  },
  {
    nome: 'orcar',
    desc: 'Mostra o PREÇO e o tempo de um pedido do Estúdio ANTES de criar, sem gastar nada (1 segundo). Use SEMPRE antes de midia_estudio, midia_gerar_video, midia_trocar_personagem e midia_clonar_voz, mostre o valor ao usuário em reais e espere ele confirmar. Efeitos: video-rapido (texto ou foto vira vídeo, 5 a 15 s, mais barato), video-ponta (Wan 3.0, melhor movimento, 4 a 15 s), video-premium (Seedance 2.0, cinema), video-google (Veo 3.1, pode ter som), trocar-personagem (põe a pessoa de uma foto no vídeo do usuário, mantém o tamanho do vídeo), editar-video (troca objeto, roupa ou cenário num vídeo do usuário; partes de até 15 s), avatar-foto (uma foto que fala um áudio ou texto), sincronia-labial e sincronia-labial-pro (boca acompanha um áudio novo), voz e voz-hd (narração; voz aceita amostra para clonar), imagem-ponta (Seedream 5.5, quando o usuário pedir qualidade máxima), imagem-livre (imagem SEM restrição de conteúdo, 5 créditos: conteúdo adulto, violento ou que o gerador padrão recusou; para imagem comum use midia_gerar_imagem).',
    schema: obj({
      efeito: { type: 'string', enum: ['video-rapido', 'video-ponta', 'video-premium', 'video-google', 'trocar-personagem', 'editar-video', 'avatar-foto', 'sincronia-labial', 'sincronia-labial-pro', 'voz', 'voz-hd', 'imagem-livre', 'imagem-ponta'] },
      segundos: { type: 'number', description: 'Duração do vídeo (para trocar-personagem, sincronia e editar-video: a duração do vídeo do usuário).' },
      texto: { type: 'string', description: 'Para voz: o texto que será falado (o preço é por caractere).' },
      qualidade: { type: 'string', description: 'Opcional: 480p, 720p, 768p, 1080p (vídeo), turbo/hd (voz-hd), 1.5K/2K (imagem). Sem ela vale a mais barata que resolve.' },
    }, ['efeito']),
  },
  {
    nome: 'estudio',
    desc: 'CRIA no Estúdio (modelos de vídeo, voz e imagem de ponta). Só chame depois de midia_orcar e do SIM do usuário ao preço (passe confirmado=true). Troca de personagem, trocar o carro/roupa/cenário de um vídeo, foto que fala, sincronia labial, narração com voz clonada, vídeo de cinema. A ferramenta volta na hora; o app acompanha, baixa o arquivo e avisa no chat. Se falhar, nada é cobrado.',
    schema: obj({
      efeito: { type: 'string', description: 'O mesmo efeito orçado em midia_orcar.' },
      confirmado: { type: 'boolean', description: 'true somente depois que o usuário aceitou o preço mostrado.' },
      prompt: { type: 'string', description: 'O que criar ou mudar, em inglês e detalhado (para trocar objeto: "replace the old silver car with a black 2024 Ford Mustang GT, same camera, same motion, keep the street and lighting").' },
      video: { type: 'string', description: 'Caminho do vídeo do usuário (MP4/MOV/WEBM, até 40 MB).' },
      fotos: { type: 'array', items: { type: 'string' }, description: 'Caminhos de fotos de referência (pessoa que entra no vídeo, roupa, produto). Até 4.' },
      audio: { type: 'string', description: 'Caminho de um áudio (sincronia labial, avatar, ou amostra de 3 a 25 s para clonar a voz).' },
      texto: { type: 'string', description: 'Texto falado (voz, avatar-foto, sincronia labial sem áudio).' },
      idioma: { type: 'string', description: 'Idioma da fala (pt, en, es...). Padrão pt.' },
      segundos: { type: 'number', description: 'Duração (a mesma do orçamento).' },
      qualidade: { type: 'string', description: 'A mesma do orçamento.' },
      tamanho: { type: 'string', description: 'Só para imagem-livre: quadrado (padrão), paisagem ou retrato.' },
      nome: { type: 'string', description: 'Nome curto do arquivo, sem extensão (opcional).' },
    }, ['efeito', 'confirmado']),
  },
  {
    nome: 'detalhar_prompt',
    desc: 'PRIMEIRO PASSO de TODA imagem e TODO vídeo: transforma o pedido do usuário (curto ou vago) num briefing profissional em inglês (sujeito, ação e movimento, câmera, luz, cores, estilo, o que evitar) com o formato e a duração certos, e devolve o prompt pronto para você passar EXATAMENTE a midia_gerar_imagem ou midia_gerar_video. Quanto mais detalhado, mais o modelo acerta na primeira tentativa (um vídeo errado custa até 20 minutos do cliente). Leva de 5 a 15 segundos. Depois de chamar, mostre ao usuário o resumo devolvido em 1 ou 2 linhas e gere.',
    schema: obj({
      tipo: { type: 'string', enum: ['imagem', 'video'], description: 'O que será gerado.' },
      pedido: { type: 'string', description: 'O que o usuário pediu, com as palavras dele (português serve).' },
      respostas: { type: 'string', description: 'Detalhes extras que o usuário deu depois de suas perguntas (estilo, cenário, cores, clima...). Opcional.' },
      formato: { type: 'string', description: 'Formato pedido, se houver (imagem: quadrado, retrato, paisagem, story, banner; vídeo: paisagem, retrato, quadrado).' },
      segundos: { type: 'number', description: 'Duração pedida do vídeo, se houver.' },
      estilo: { type: 'string', description: 'Estilo pedido, se houver.' },
      tem_imagem_inicial: { type: 'boolean', description: 'true se o vídeo vai animar uma imagem que você já gerou (o prompt então descreve só o movimento).' },
    }, ['tipo', 'pedido']),
  },
  {
    nome: 'conferir_troca',
    desc: 'Confere o vídeo e a foto ANTES de midia_trocar_personagem (existência, formato, tamanho, duração, resolução, áudio) e diz o que olhar e o que avisar ao usuário. Sem custo de geração, leva 1 segundo. Use sempre antes da troca de personagem.',
    schema: obj({
      video: { type: 'string', description: 'Caminho do vídeo de origem.' },
      foto: { type: 'string', description: 'Caminho da foto da pessoa que vai entrar no vídeo.' },
    }, ['video', 'foto']),
  },
  {
    nome: 'clonar_voz',
    desc: 'Narração com a voz de uma AMOSTRA (3 a 25 segundos de fala limpa): lê o texto com a voz clonada e salva o áudio na pasta Audios (Estúdio). Para locução, narração e avisos com a voz da pessoa. Antes: midia_orcar (efeito voz, texto) e o SIM do usuário ao preço (narração costuma custar centavos). A ferramenta volta na hora e o app avisa quando ficar pronto.',
    schema: obj({
      texto: { type: 'string', description: 'O texto que será falado, no idioma escolhido, até 3000 caracteres.' },
      amostra: { type: 'string', description: 'Caminho do arquivo com a voz de referência (WAV, MP3, M4A ou vídeo com fala).' },
      idioma: { type: 'string', description: 'Código do idioma do texto (pt, en, es, fr, de, it, ja, ko, zh, ru). Padrão: pt.' },
      amostra_texto: { type: 'string', description: 'O que a amostra diz, se você souber (melhora a clonagem). Opcional.' },
      nome: { type: 'string', description: 'Nome curto do arquivo, sem extensão (opcional).' },
    }, ['texto', 'amostra']),
  },
  {
    nome: 'trocar_personagem',
    desc: 'Troca a pessoa principal de um VÍDEO pela pessoa de uma FOTO, mantendo câmera, cortes, movimento e áudio (Estúdio). O vídeo sai com a mesma duração do original. Antes: midia_conferir_troca e midia_orcar (efeito trocar-personagem, segundos = duração do vídeo) e o SIM do usuário ao preço. A ferramenta volta na hora e o app avisa quando ficar pronto (1 a 4 minutos).',
    schema: obj({
      video: { type: 'string', description: 'Caminho do vídeo de origem (MP4, MOV ou WEBM, até 40 MB).' },
      foto: { type: 'string', description: 'Caminho da foto da pessoa que vai entrar no vídeo (PNG, JPEG ou WEBP, até 6 MB).' },
      resolucao: { type: 'string', enum: ['480p', '768p', '1080p'], description: 'Qualidade: 480p (padrão, mais barato), 768p ou 1080p. Mais alta custa mais; confira em midia_orcar com a mesma qualidade.' },
      sem_sincronia_labial: { type: 'boolean', description: 'true (padrão) quando as pessoas do vídeo não estão cantando nem falando junto com o áudio.' },
      nome: { type: 'string', description: 'Nome curto do arquivo, sem extensão (opcional).' },
    }, ['video', 'foto']),
  },
  {
    nome: 'gerar_video',
    desc: 'Gera um VÍDEO de 4 a 15 segundos a partir de uma descrição ou de uma imagem (Estúdio). Qualidade alta (padrão): Wan 3.0 em 720p, ótimo movimento, 2 a 3 minutos. Rápida: P-Video em 480p, cerca de 1 minuto e bem mais barato, bom para testar a ideia. Antes: midia_orcar (efeito video-ponta na alta, video-rapido na rápida) e o SIM do usuário ao preço. Vídeo maior que 15 s: gere partes e junte no Editor. A ferramenta volta na hora e o app avisa quando ficar pronto.',
    schema: obj({
      prompt: { type: 'string', description: 'Cena e movimento, em inglês, MUITO detalhado (80 a 150 palavras, mínimo 40; 20 se passar imagem): sujeito, cenário, ação e movimento, câmera e lente, luz, paleta, atmosfera, estilo e qualidade.' },
      formato: { type: 'string', enum: FORMATOS_VIDEO, description: 'paisagem (768x512), retrato (512x768) ou quadrado. Padrão: paisagem.' },
      imagem: { type: 'string', description: 'Caminho de uma imagem para ANIMAR (imagem para vídeo). PNG, JPEG ou WEBP até 6 MB. Opcional.' },
      strength: { type: 'number', description: 'Quanto mudar a imagem de partida, de 0 a 1 (opcional).' },
      fps: { type: 'number', description: 'Quadros por segundo, de 8 a 30 (opcional).' },
      segundos: { type: 'number', description: 'Duração de 4 a 15 segundos. Padrão: 5.' },
      nome: { type: 'string', description: 'Nome curto do arquivo, sem extensão (opcional).' },
      negative_prompt: { type: 'string', description: 'O que evitar (em inglês): ex. "blurry, deformed hands, extra fingers, watermark, text". Opcional.' },
      qualidade: { type: 'string', enum: ['rapida', 'alta'], description: 'alta (padrão): Wan 2.2 de 14 bilhões de parâmetros, 720p, 16 quadros por segundo, movimento e rostos muito mais coerentes; leva de 5 a 20 minutos por clipe de 5 s (a primeira vez do dia inclui ~8 min de partida) e o app avisa quando fica pronto. rapida: modelo leve, cerca de 1 minuto, 640x384, só para testar uma ideia (a qualidade é bem menor). Para o melhor resultado, gere antes uma imagem com gerar_imagem, confira e anime-a passando em imagem.' },
      steps: { type: 'number', description: 'Passos de geração (opcional; normalmente deixe a qualidade escolher).' },
      cfg: { type: 'number', description: 'Fidelidade ao prompt (opcional).' },
      seed: { type: 'number', description: 'Semente para repetir ou variar um resultado (opcional).' },
    }, ['prompt']),
  },
  {
    nome: 'gerar_imagem',
    desc: 'Gera uma imagem a partir de uma descrição (cerca de 20 a 40 segundos, incluída no plano). Salva um PNG na pasta de trabalho e devolve o caminho completo. Escreva o prompt em INGLÊS, detalhado (assunto, estilo, luz, enquadramento, cores). Título curto (1 a 3 palavras, caixa alta, entre aspas no prompt) sai legível. Para frase longa ou texto com acento (ÃO, É, Ç), gere a imagem SEM texto e avise que o texto pode ser colocado depois: o modelo erra acentos e letras. Para pessoas, peça a contagem exata no prompt (exactly two people).',
    schema: obj({
      prompt: { type: 'string', description: 'Descrição da imagem, em inglês, MUITO detalhada (60 a 120 palavras, mínimo 30): sujeito e aparência, cenário, enquadramento e lente, luz, paleta, atmosfera, estilo e qualidade.' },
      estilo: { type: 'string', enum: ['foto', 'cinema', 'ilustracao', 'anime', '3d', 'minimalista', 'aquarela'], description: 'Estilo visual (opcional; segue a preferência do usuário).' },
      n: { type: 'number', description: 'Quantas opções gerar, de 1 a 4 (opcional).' },
      formato: { type: 'string', enum: Object.keys(FORMATOS), description: 'quadrado (1024x1024), retrato, paisagem, story (vertical 9:16) ou banner. Padrão: quadrado.' },
      nome: { type: 'string', description: 'Nome curto do arquivo, sem extensão (opcional).' },
      negative_prompt: { type: 'string', description: 'O que evitar (em inglês): ex. "blurry, deformed hands, extra fingers, watermark, text". Opcional.' },
      referencias: { type: 'array', items: { type: 'string' }, description: 'Caminhos de fotos do usuário (até 4) para EDITAR ou usar de base: "me veste de terno", "troca o fundo", "deixa a pessoa de óculos", "põe meu rosto neste cartaz". Com referências a imagem sai editando a foto, mantendo o rosto e a pessoa; descreva só o que muda, em inglês.' },
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

const TEXTO_PENDENTE = (o, min) => `[[midia-pendente]] ${o} em andamento, previsão de ${min} minutos. Diga ao usuário apenas: "Estou gerando o seu vídeo; fica pronto em aproximadamente ${min} minutos." Não mencione GPU, fila, servidor nem andamento. NÃO espere, NÃO consulte e NÃO gere de novo: o arquivo é salvo sozinho e o aplicativo avisa quando ficar pronto.`
const MSG_FALHA = 'Não consegui gerar agora, tente de novo em instantes.'
const MSG_RECUSADA = 'O gerador padrão de imagens não aceita este pedido (conteúdo restrito). Diga ao usuário, sem julgar, que dá para criar no Estúdio, sem restrição de conteúdo, por 5 créditos; chame midia_orcar com efeito imagem-livre e, com o SIM, midia_estudio (prompt em inglês, tamanho opcional: paisagem, retrato ou quadrado).'
const EXT_POR_MIME = { 'audio/wav': '.wav', 'audio/mpeg': '.mp3', 'video/mp4': '.mp4', 'video/webm': '.webm', 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' }
const stampAgora = () => new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{6})$/, '$1-$2')

// Contrato do servidor de mídia: POST ... { async: true } -> 202 { id }; GET /media/jobs/{id} (fila, percentual); GET /jobs/{id}/file (arquivo com o Content-Type real)
// baixa o arquivo do job pronto e salva na pasta certa (Videos ou Imagens); confere que o tipo entregue é o pedido
async function salvarResultado(id, tipo, nome, s) {
  const ehAudio = tipo === 'audio'
  const f = await api('/jobs/' + id + '/file')
  const mime = String(f.headers.get('content-type') || (s && s.mime) || '').split(';')[0].trim()
  const ext = EXT_POR_MIME[mime]
  const ehVideo = tipo === 'video'
  if (!f.ok || !ext || (ehAudio ? !/^audio\//.test(mime) : ehVideo ? !/^video\//.test(mime) : !/^image\//.test(mime))) throw new Error(MSG_FALHA)
  const dir = path.join(PASTA, ehAudio ? 'Audios' : ehVideo ? 'Videos' : 'Imagens')
  fs.mkdirSync(dir, { recursive: true })
  const arq = path.join(dir, `${limpo(nome || (ehAudio ? 'audio' : ehVideo ? 'video' : 'imagem'))}-${stampAgora()}${ext}`)
  fs.writeFileSync(arq, Buffer.from(await f.arrayBuffer()))
  return { arq }
}

async function rodarJob({ tipo, rota, corpo, prompt, nome, limiteMs, assincrono, salvar }) {
  const t0 = Date.now()
  marcar(tipo, prompt, { status: 'queued', position: null, eta_s: null, progress: 0 })
  const r = await api(rota, { method: 'POST', body: JSON.stringify({ ...corpo, async: true }) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok && r.status !== 202) {
    marcar(tipo, prompt, { status: 'failed' })
    const msg = j.error?.message || j.detail || `HTTP ${r.status}`
    if (r.status === 422) throw new Error(String(msg)) // pedido inválido: a mensagem já vem em português para o agente corrigir
    // cota do plano acabou (e não há crédito): diz a verdade. O app lê este texto no resultado da ferramenta e abre o pop-up de crédito (agent.js, Spec 24).
    if (r.status === 429 && j.error?.code === 'media_quota_exceeded') throw new Error(`${msg} O aplicativo já está oferecendo ao usuário comprar mais crédito ou assinar o próximo plano. Não tente de novo agora: avise o usuário em uma frase.`)
    throw new Error(r.status === 429 ? 'Estamos com bastante movimento agora. Tente de novo em instantes.' : r.status === 503 ? 'Este recurso não está disponível no momento.' : MSG_FALHA + (process.env.SB_MIDIA_DEBUG ? ' (' + msg + ')' : ''))
  }
  const id = j.id
  if (assincrono) {
    // job pesado (vídeo em alta, troca de personagem): o agente não fica preso esperando a GPU. O app acompanha, baixa e avisa no chat (concluirPendentes).
    try {
      fs.writeFileSync(path.join(PASTA, '.midia', `pendente-${id}.json`), JSON.stringify({ id, tipo, salvar: salvar || tipo, nome: nome || '', prompt: String(prompt || '').slice(0, 3500), chat: chatAtual(), t0: Date.now() }))
    } catch (e) {
      throw new Error(MSG_FALHA + ' (não consegui registrar o acompanhamento)')
    }
    // a previsão vem do servidor (partida da máquina + pedidos na frente + o próprio vídeo), não de um número fixo
    let min = 0
    try {
      const s0 = await andamento(id)
      marcar(tipo, prompt, s0)
      if (s0 && s0.eta_s) min = Math.max(1, Math.ceil(s0.eta_s / 60))
    } catch {}
    return { pendente: true, id, min }
  }
  while (Date.now() - t0 < limiteMs) {
    await pausa(1500)
    const s = await andamento(id)
    marcar(tipo, prompt, s)
    if (s.status === 'failed') throw new Error(s.error === 'recusada' ? MSG_RECUSADA : MSG_FALHA)
    if (s.status === 'done') {
      const r = await salvarResultado(id, salvar || tipo, nome, s)
      marcar(tipo, prompt, { status: 'done', position: null, eta_s: 0, progress: 100 })
      return { caminho: r.arq, segundos: s.seconds ?? Math.round((Date.now() - t0) / 100) / 10, tamanho: s.size, ajustes: s.adjusted, params: s.params }
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
  throw new Error(`O prompt está curto demais (${palavras} palavras; o mínimo é ${minimo}). Chame midia_detalhar_prompt com o pedido do usuário (ele escreve o briefing completo) e use o prompt devolvido; ou detalhe você mesmo: sujeito com aparência, cenário, ${tipo === 'vídeo' ? 'ação e movimento, câmera e lente, ' : 'enquadramento e lente, '}iluminação, paleta de cores, atmosfera, estilo e qualidade, mais negative_prompt. Se faltar informação do usuário, pergunte (até 5 perguntas curtas com sugestão); se ele disser "pode seguir", invente os detalhes você mesmo.`)
}

async function gerarImagem(args) {
  const { prompt, formato, nome } = args
  exigirDetalhe('imagem', prompt, Array.isArray(args.referencias) && args.referencias.length ? 8 : 30)
  if (!CHAVE) throw new Error('O Segundo Cérebro ainda não tem a chave do servidor (Unlimited). Abra Configurações e conclua o cadastro.')
  if (process.env.SB_MIDIA_MOCK) return simular('imagem', prompt, process.env.SB_MIDIA_MOCK_IMG || path.join(__dirname, 'renderer', 'img', 'segundo-cerebro-64.png'))
  const corpo = { prompt: String(prompt || '').slice(0, 3500), size: FORMATOS[formato] || FORMATOS[PREFS.proporcao] || FORMATOS.quadrado, ...paramsComuns(args, false) }
  const estilo = ESTILO_SERVIDOR[args.estilo] || ESTILO_SERVIDOR[PREFS.estilo]
  if (estilo) corpo.style = estilo
  if (args.n != null) corpo.n = Math.max(1, Math.min(4, Number(args.n)))
  if (Array.isArray(args.referencias) && args.referencias.length) corpo.images = args.referencias.slice(0, 4).map((f, i) => dataUri(f, 'Foto ' + (i + 1), 8))
  return rodarJob({ tipo: 'imagem', rota: '/images/generations', corpo, prompt, nome, limiteMs: ESPERA_MAX_MS })
}


// ---- Estúdio (Runware pelo servidor): preço antes, confirmação, criação acompanhada pelo mesmo mecanismo de jobs
const MIME_EXT = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg' }
function dataUri(caminho, rotulo, maxMb) {
  const b = lerArquivo(caminho, rotulo, maxMb)
  const mime = MIME_EXT[path.extname(String(caminho)).toLowerCase()] || 'application/octet-stream'
  return `data:${mime};base64,${b.toString('base64')}`
}
const brl = (v) => (v == null ? '' : 'R$ ' + Number(v).toFixed(2).replace('.', ','))
const minutos = (s) => Math.max(1, Math.round((Number(s) || 60) / 60))
async function orcar(args) {
  if (!CHAVE && !process.env.SB_MIDIA_MOCK) throw new Error('O Segundo Cérebro ainda não tem a chave do servidor. Entre na sua conta.')
  const corpo = { efeito: args.efeito, segundos: args.segundos, texto: args.texto, qualidade: args.qualidade }
  let o
  if (process.env.SB_MIDIA_MOCK) o = { rotulo: 'Simulação', preco_brl: 13.75, preco_usd: 2.5, tempo_estimado_s: 100, quantidade: args.segundos || 10, unidade: 'segundo', qualidade: args.qualidade || '480p', disponivel: true, acima_do_teto: false }
  else {
    const r = await api('/estudio/orcar', { method: 'POST', body: JSON.stringify(corpo) })
    o = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(o.error?.message || 'Não consegui calcular o preço agora.')
  }
  if (o.disponivel === false) return 'O Estúdio ainda não está disponível (em breve). Avise o usuário em uma frase e ofereça editar o que ele já tem (Motion) sem custo.'
  const qtd = o.unidade === 'segundo' ? `${o.quantidade} s` : o.unidade === 'caractere' ? `${o.quantidade} caracteres` : `${o.quantidade} imagem(ns)`
  const preco = o.creditos != null ? `${o.creditos} créditos (≈ ${brl(o.preco_brl)})` : `${brl(o.preco_brl)} (US$ ${Number(o.preco_usd).toFixed(2)})`
  const saldo = o.saldo != null ? ` Você tem ${o.saldo} créditos.` + (o.creditos != null && o.saldo < o.creditos ? ` Faltam ${o.creditos - o.saldo}: avise que é preciso comprar mais créditos e o app oferece o pacote.` : '') : ''
  return `${o.rotulo}: ${qtd}${o.qualidade && o.qualidade !== 'padrao' ? ' em ' + o.qualidade : ''}. Preço: ${preco}, cerca de ${minutos(o.tempo_estimado_s)} min.${saldo}` +
    (o.partes > 1 ? ` O vídeo será feito em ${o.partes} partes de até 15 s.` : '') +
    (o.acima_do_teto ? ' Atenção: passa do valor normal por ser grande; diga isso ao usuário.' : '') +
    ' Mostre este preço ao usuário em CRÉDITOS (o valor em reais é só referência) e pergunte se pode criar. Só chame midia_estudio (ou a ferramenta do pedido) depois do sim.'
}
async function estudio(args) {
  if (!args.confirmado) throw new Error('Antes de criar, chame midia_orcar, mostre o preço ao usuário e espere ele aceitar. Depois chame de novo com confirmado=true.')
  if (!CHAVE) throw new Error('O Segundo Cérebro ainda não tem a chave do servidor. Entre na sua conta.')
  if (process.env.SB_MIDIA_MOCK) return simular(args.efeito === 'voz' || args.efeito === 'voz-hd' ? 'video' : 'video', args.prompt || args.efeito, process.env.SB_MIDIA_MOCK_ARQ || '')
  const inputs = {}
  if (args.video) inputs.video = dataUri(args.video, 'Vídeo', 40)
  if (Array.isArray(args.fotos) && args.fotos.length) inputs.referenceImages = args.fotos.slice(0, 4).map((f, i) => dataUri(f, 'Foto ' + (i + 1), 8))
  if (args.audio) inputs.audio = dataUri(args.audio, 'Áudio', 20)
  if (args.efeito === 'avatar-foto' && inputs.referenceImages) inputs.referenceImages = inputs.referenceImages.slice(0, 1)
  const corpo = { efeito: args.efeito, prompt: args.prompt, tamanho: args.tamanho, texto: args.texto, idioma: args.idioma, segundos: args.segundos, qualidade: args.qualidade, ...(Object.keys(inputs).length ? { inputs } : {}) }
  if (args.efeito === 'sincronia-labial' && !args.audio && args.texto) corpo.texto_fala = args.texto
  const audio = args.efeito === 'voz' || args.efeito === 'voz-hd'
  const imagem = args.efeito === 'imagem-ponta' || args.efeito === 'imagem-livre'
  return rodarJob({ tipo: audio ? 'video' : imagem ? 'imagem' : 'video', salvar: audio ? 'audio' : imagem ? 'imagem' : 'video', rota: '/estudio/gerar', corpo,
    prompt: args.prompt || args.texto || args.efeito, nome: args.nome || args.efeito, limiteMs: 60 * 60 * 1000, assincrono: process.env.SB_MIDIA_SINCRONO !== '1' })
}

// ---- Redublagem com a voz do usuário (dublagem.js): etapa 1 orça, etapa 2 gera e remonta
async function dublarVideo(args) {
  const dub = require('./dublagem')
  if (!CHAVE) throw new Error('O Segundo Cérebro ainda não tem a chave do servidor. Entre na sua conta.')
  const video = String(args.video || '')
  if (!fs.existsSync(video) || !dub.temVideo(video)) throw new Error('O vídeo não foi encontrado nesse caminho (use MP4, MOV, WEBM ou MKV).')
  if (!fs.existsSync(String(args.amostra || ''))) throw new Error('A amostra de voz não foi encontrada nesse caminho.')
  const marca = hashMidia(video + '|' + (args.idioma || '') + '|' + (args.texto_novo || ''))
  const arqScript = path.join(PASTA, '.midia', `dublagem-${marca}.json`)
  let rascunho = null
  try { rascunho = JSON.parse(fs.readFileSync(arqScript, 'utf8')) } catch {}
  if (!rascunho) {
    marcar('video', 'dublagem ' + marca, { status: 'running', position: null, eta_s: 60, progress: 10 })
    rascunho = await dub.preparar({ video, idioma: args.idioma, idiomaOrigem: args.idioma_origem, textoNovo: args.texto_novo, api, base: BASE, chave: CHAVE, pasta: PASTA })
    fs.mkdirSync(path.dirname(arqScript), { recursive: true })
    fs.writeFileSync(arqScript, JSON.stringify(rascunho))
  }
  if (!args.confirmado) {
    const o = await orcar({ efeito: 'voz', texto: rascunho.texto })
    const previa = rascunho.texto.length > 280 ? rascunho.texto.slice(0, 280) + '…' : rascunho.texto
    return `Fala encontrada: ${rascunho.texto.length} caracteres${rascunho.origem ? ` (idioma ${rascunho.origem}${rascunho.destino && rascunho.destino.slice(0, 2) !== rascunho.origem.slice(0, 2) ? ', traduzido para ' + rascunho.destino : ''})` : ''}. Trecho: "${previa}". ${o} Pergunte se pode dublar; depois chame midia_dublar_video de novo com confirmado=true (mesmos parâmetros).`
  }
  const blocos = dub.dividir(rascunho.texto)
  const amostra = dataUri(String(args.amostra), 'Amostra de voz', 30)
  const faixas = []
  for (let i = 0; i < blocos.length; i++) {
    const r = await (process.env.SB_MIDIA_MOCK ? simular('video', 'dublagem', process.env.SB_MIDIA_MOCK_ARQ || '') : rodarJob({ tipo: 'video', salvar: 'audio', rota: '/estudio/gerar',
      corpo: { efeito: 'voz', texto: blocos[i], idioma: rascunho.destino, inputs: { audio: amostra } }, prompt: 'dublagem ' + marca + ' ' + i, nome: 'dub-voz-' + (i + 1), limiteMs: 10 * 60 * 1000 }))
    if (!r || !r.caminho) throw new Error('A voz não ficou pronta. Nada foi cobrado desse trecho; tente de novo.')
    faixas.push(r.caminho)
  }
  const saida = path.join(PASTA, 'Videos', `${limpo(args.nome || 'video-dublado')}-${stampAgora()}.mp4`)
  const m = dub.montar({ video, faixas, saida })
  try { fs.rmSync(arqScript, { force: true }) } catch {}
  return { caminho: m.saida, segundos: Math.round(m.duracaoVideo), tamanho: Math.round(fs.statSync(m.saida).size / 1024) + ' KB', ajuste: m.fator }
}

const ehArquivoVideo = (p) => /\.(mp4|mov|webm|mkv)$/i.test(String(p || ''))
function lerArquivo(caminho, rotulo, maxMb) {
  if (!caminho || !fs.existsSync(String(caminho))) throw new Error(`${rotulo}: o arquivo não foi encontrado nesse caminho.`)
  const b = fs.readFileSync(String(caminho))
  if (b.length > maxMb * 1024 * 1024) throw new Error(`${rotulo}: o arquivo é grande demais (máximo ${maxMb} MB).`)
  return b
}

async function clonarVoz(args) {
  if (!CHAVE) throw new Error('O Segundo Cérebro ainda não tem a chave do servidor. Entre na sua conta.')
  const texto = String(args.texto || '').trim()
  if (!texto) throw new Error('Diga o texto que será falado (texto).')
  if (process.env.SB_MIDIA_MOCK) return simular('video', 'clonagem de voz', process.env.SB_MIDIA_MOCK_ARQ || '')
  const corpo = { text: texto, language: args.idioma || 'pt', reference_audio: lerArquivo(args.amostra, 'Amostra de voz', 12).toString('base64') }
  if (args.amostra_texto) corpo.reference_text = String(args.amostra_texto).slice(0, 600)
  return rodarJob({ tipo: 'video', salvar: 'audio', rota: '/audio/voice-clone', corpo, prompt: 'clonagem de voz', nome: args.nome || 'voz-clonada', limiteMs: 30 * 60 * 1000, assincrono: process.env.SB_MIDIA_SINCRONO !== '1' })
}

async function trocarVoz(args) {
  if (!CHAVE) throw new Error('O Segundo Cérebro ainda não tem a chave do servidor. Entre na sua conta.')
  if (process.env.SB_MIDIA_MOCK) return simular('video', 'troca de voz', process.env.SB_MIDIA_MOCK_ARQ || '')
  const corpo = { media: lerArquivo(args.arquivo, 'Arquivo', 40).toString('base64'), target_voice: lerArquivo(args.voz_alvo, 'Voz alvo', 12).toString('base64'), keep_background: args.manter_fundo !== false }
  return rodarJob({ tipo: 'video', salvar: ehArquivoVideo(args.arquivo) ? 'video' : 'audio', rota: '/audio/voice-convert', corpo, prompt: 'troca de voz', nome: args.nome || 'voz-trocada', limiteMs: 60 * 60 * 1000, assincrono: process.env.SB_MIDIA_SINCRONO !== '1' })
}

async function redublarVideo(args) {
  if (!CHAVE) throw new Error('O Segundo Cérebro ainda não tem a chave do servidor. Entre na sua conta.')
  if (process.env.SB_MIDIA_MOCK) return simular('video', 'redublagem', process.env.SB_MIDIA_MOCK_ARQ || '')
  const corpo = { video: lerArquivo(args.video, 'Vídeo', 40).toString('base64'), target_language: args.idioma, keep_background: args.manter_fundo !== false }
  if (args.idioma_origem) corpo.source_language = args.idioma_origem
  if (args.voz) corpo.voice = lerArquivo(args.voz, 'Voz', 12).toString('base64')
  return rodarJob({ tipo: 'video', salvar: ehArquivoVideo(args.video) ? 'video' : 'audio', rota: '/videos/dub', corpo, prompt: 'redublagem', nome: args.nome || 'video-dublado', limiteMs: 60 * 60 * 1000, assincrono: process.env.SB_MIDIA_SINCRONO !== '1' })
}

async function trocarPersonagem(args) {
  const { video, foto, resolucao, nome } = args
  if (!CHAVE) throw new Error('O Segundo Cérebro ainda não tem a chave do servidor. Entre na sua conta.')
  if (process.env.SB_MIDIA_MOCK) return simular('video', 'troca de personagem', process.env.SB_MIDIA_MOCK_ARQ || '')
  const v = fs.readFileSync(String(video))
  const f = fs.readFileSync(String(foto))
  if (v.length > 40 * 1024 * 1024) throw new Error('O vídeo é grande demais (máximo 40 MB). Corte ou comprima o vídeo antes.')
  if (f.length > 6 * 1024 * 1024) throw new Error('A foto é grande demais (máximo 6 MB).')
  const corpo = { recipe: 'openjutsu-swap', video: v.toString('base64'), image: f.toString('base64'), resolution: ['480p', '768p', '1080p'].includes(resolucao) ? resolucao : '480p', no_lip_sync: args.sem_sincronia_labial !== false }
  return rodarJob({ tipo: 'video', rota: '/videos/generations', corpo, prompt: 'troca de personagem', nome: nome || 'troca-personagem', limiteMs: 60 * 60 * 1000, assincrono: process.env.SB_MIDIA_SINCRONO !== '1' })
}

async function gerarVideo(args) {
  const { prompt, formato, segundos, nome } = args
  exigirDetalhe('vídeo', prompt, args.imagem ? 20 : 40)
  if (!CHAVE) throw new Error('O Segundo Cérebro ainda não tem a chave do servidor. Entre na sua conta.')
  if (process.env.SB_MIDIA_MOCK) return simular('video', prompt, process.env.SB_MIDIA_MOCK_ARQ || '')
  const alta = (args.qualidade || PREFS.qualidade || 'alta') !== 'rapida' // qualidade é o produto: alta é o padrão, rápida só quando pedida
  const corpo = {
    prompt: String(prompt || '').slice(0, 3500),
    format: FORMATOS_VIDEO.includes(formato) ? formato : FORMATOS_VIDEO.includes(PREFS.proporcao) ? PREFS.proporcao : 'paisagem',
    seconds: Math.max(1, Math.min(60, Number(segundos) || Number(PREFS.duracao) || (alta ? 5 : 4))),
    ...paramsComuns(args, true),
  }
  // medido em 08/11/2026: vídeo em alta direto do texto saiu com o carro de TRÊS rodas de lado. Negativo padrão contra deformação (somado ao que o agente mandar).
  const NEG_VIDEO = 'deformed, distorted, extra wheels, extra limbs, extra fingers, warped body, melting, morphing geometry, asymmetrical, bad anatomy, blurry, low quality, watermark, text'
  corpo.negative_prompt = [corpo.negative_prompt, NEG_VIDEO].filter(Boolean).join(', ').slice(0, 600)
  if (args.fps != null) corpo.fps = Number(args.fps)
  if (alta) {
    corpo.recipe = 'wan22-a14b' // alta qualidade: Wan 2.2 14B numa máquina dedicada sob demanda (720p, 16 fps); o servidor encadeia clipes de 5 s
    delete corpo.fps
    if (args.steps == null) delete corpo.steps // o servidor já usa 20 passos; mais só alongaria o tempo
  } else {
    corpo.recipe = 'ltx-video' // explícito: sem receita o servidor manda o vídeo para a máquina de alta qualidade
  }
  // imagem -> vídeo: a imagem de partida vai em base64 (PNG, JPEG ou WEBP, até 6 MB)
  if (args.imagem) {
    const bin = fs.readFileSync(String(args.imagem))
    if (bin.length > 6 * 1024 * 1024) throw new Error('A imagem de partida é grande demais (máximo 6 MB).')
    corpo.image = bin.toString('base64')
    if (args.strength != null) corpo.strength = Math.max(0, Math.min(1, Number(args.strength)))
  }
  return rodarJob({ tipo: 'video', rota: '/videos/generations', corpo, prompt, nome, limiteMs: (alta ? Math.max(30, Math.ceil((corpo.seconds || 5) / 5) * 12) : Math.max(20, Math.ceil((corpo.seconds || 4) / 4) * 3)) * 60 * 1000, assincrono: alta && process.env.SB_MIDIA_SINCRONO !== '1' })
}

// Chamado pelo app a cada poucos segundos: confere os jobs enviados em segundo plano, baixa os prontos e devolve o que terminou ({ caminho, tipo, chat } ou { falhou }).
let concluindo = false
async function concluirPendentes() {
  if (concluindo) return []
  concluindo = true
  const prontos = []
  try {
    const dir = path.join(PASTA, '.midia')
    let nomes = []
    try { nomes = fs.readdirSync(dir).filter((n) => /^pendente-[\w-]+\.json$/.test(n)) } catch { return [] }
    for (const n of nomes) {
      const arqP = path.join(dir, n)
      let p
      try { p = JSON.parse(fs.readFileSync(arqP, 'utf8')) } catch { try { fs.unlinkSync(arqP) } catch {} continue }
      if (Date.now() - (p.t0 || 0) > 6 * 3600 * 1000) { try { fs.unlinkSync(arqP) } catch {} continue }
      let s
      try { s = await andamento(p.id) } catch { continue } // sem rede agora: tenta no próximo ciclo
      marcar(p.tipo, p.prompt, s)
      if (s.status === 'failed') { try { fs.unlinkSync(arqP) } catch {} prontos.push({ falhou: true, tipo: p.tipo, chat: p.chat }); continue }
      if (s.status === 'done') {
        try {
          const r = await salvarResultado(p.id, p.salvar || p.tipo, p.nome, s)
          marcar(p.tipo, p.prompt, { status: 'done', position: null, eta_s: 0, progress: 100 })
          try { fs.unlinkSync(arqP) } catch {}
          prontos.push({ caminho: r.arq, tipo: p.tipo, chat: p.chat, nome: p.nome })
        } catch { /* arquivo ainda não disponível: tenta de novo */ }
      }
    }
  } finally {
    concluindo = false
  }
  return prontos
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
      if (nome === 'detalhar_prompt') {
        if (!CHAVE && !process.env.SB_MIDIA_MOCK) throw new Error('O Segundo Cérebro ainda não tem a chave do servidor. Entre na sua conta.')
        const ctx = { base: BASE, chave: CHAVE, fetchFn: process.env.SB_MIDIA_MOCK ? async () => { throw new Error('mock') } : undefined }
        return enviar({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: formatarSaida(await detalhar(params?.arguments || {}, ctx)) }] } })
      }
      if (nome === 'dublar_video') {
        const v = await dublarVideo(params?.arguments || {})
        const texto = typeof v === 'string' ? v : `Dublagem pronta (${v.segundos} s, ${v.tamanho}). caminho: ${v.caminho}`
        return enviar({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: texto }] } })
      }
      if (nome === 'orcar') {
        return enviar({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: await orcar(params?.arguments || {}) }] } })
      }
      if (nome === 'estudio') {
        const v = await comReserva(estudio, params?.arguments || {}, 'video')
        const ehImg = /^imagem-/.test(String((params?.arguments || {}).efeito || ''))
        if (v.pendente) return enviar({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: ehImg ? TEXTO_PENDENTE('imagem do Estúdio', v.min || 1).split('o seu vídeo').join('a sua imagem') : TEXTO_PENDENTE('pedido do Estúdio', v.min || 3) }] } })
        return enviar({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Pronto em ${v.segundos} s. caminho: ${v.caminho}` }] } })
      }
      if (nome === 'conferir_troca') {
        return enviar({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: formatarConferencia(conferirTroca(params?.arguments || {})) }] } })
      }
      if (nome === 'clonar_voz' || nome === 'trocar_voz' || nome === 'redublar_video') {
        const fn = nome === 'clonar_voz' ? clonarVoz : nome === 'trocar_voz' ? trocarVoz : redublarVideo
        const v = await comReserva(fn, params?.arguments || {}, 'video')
        const o = nome === 'clonar_voz' ? 'clonagem de voz' : nome === 'trocar_voz' ? 'troca de voz' : 'redublagem'
        if (v.pendente) return enviar({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: TEXTO_PENDENTE(o, v.min || 6).replace('o seu vídeo', 'o seu arquivo') }] } })
        return enviar({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Pronto em ${v.segundos} s. caminho: ${v.caminho}` }] } })
      }
      if (nome === 'trocar_personagem') {
        const v = await comReserva(trocarPersonagem, params?.arguments || {}, 'video')
        if (v.pendente) return enviar({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: TEXTO_PENDENTE('troca de personagem', v.min || 9) }] } })
        return enviar({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Vídeo com a troca criado em ${v.segundos} s (${v.tamanho}). caminho: ${v.caminho}` }] } })
      }
      if (nome === 'gerar_video') {
        const v = await comReserva(gerarVideo, params?.arguments || {}, 'video')
        if (v.pendente) return enviar({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: TEXTO_PENDENTE('vídeo em alta qualidade', v.min || 15) }] } })
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

module.exports = { dublarVideo, gerarImagem, gerarVideo, trocarPersonagem, clonarVoz, trocarVoz, redublarVideo, detalhar, conferirTroca, orcar, estudio, FERRAMENTAS, FORMATOS, configurar, concluirPendentes }
