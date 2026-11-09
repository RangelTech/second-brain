// Detalhamento de pedidos de mídia: transforma o pedido curto do usuário num briefing profissional (em inglês, para o Flux e o Wan 2.2) e confere
// a troca de personagem antes de gastar a geração. Quanto mais o prompt descreve, mais o modelo acerta na primeira tentativa (um vídeo errado custa até
// 20 minutos do cliente). O modelo de texto do próprio servidor faz o detalhamento; se ele falhar, um composto determinístico garante o mínimo.
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const MODELO = 'qwen-abliterated'
const MINIMO = { imagem: 55, video: 70, video_com_imagem: 35 }
const FORMATOS = { imagem: ['quadrado', 'retrato', 'paisagem', 'story', 'banner'], video: ['paisagem', 'retrato', 'quadrado'] }
const ESTILOS = ['foto', 'cinema', 'ilustracao', 'anime', '3d', 'minimalista', 'aquarela']

const contar = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length

const SISTEMA_COMUM = `You are a senior prompt director for generative image and video models. The user's request is short and may be in Portuguese. You write ONE rich English prompt that a model can follow literally, and you never invent brand names, readable text, or the faces of real people. Interpret camera and shot terms (drone shot, aerial view, POV, time-lapse, handheld) as how the scene is FILMED, not as an object to show, unless the user clearly wants the object itself. Reply with a single JSON object only (no markdown, no commentary) with the keys: "prompt" (string), "negative_prompt" (string, English, comma separated), "formato" (string), "segundos" (number or null), "estilo" (string or null), "resumo_pt" (1 or 2 short sentences in Brazilian Portuguese describing what will be generated, for the user), "alertas" (array of short Brazilian Portuguese warnings about risks of this specific request, may be empty).`

const SISTEMA = {
  imagem: `${SISTEMA_COMUM}
TARGET: a text-to-image model (Flux). Write ${MINIMO.imagem + 5} to 120 words of flowing descriptive prose in this order: subject with exact count and appearance (age, clothing, material, color) -> setting and background -> composition, framing and lens (close-up, medium shot, 35mm, 85mm, camera angle) -> lighting (type, direction, time of day, color temperature) -> color palette -> atmosphere and emotion -> style or medium (editorial photography, cinematic still, clean digital illustration) -> quality words (sharp focus, natural skin texture, high detail).
RULES: state exact counts ("exactly two people", "one white sneaker"); text inside the image only if the user asked, at most 1 to 3 short uppercase words in quotes and no accents (otherwise add an alert that text should be added afterwards); hands and faces: describe them simply and naturally; avoid contradictions. "formato" must be one of ${FORMATOS.imagem.join(', ')}. "segundos" must be null. "estilo" one of ${ESTILOS.join(', ')} or null.
"negative_prompt": a short list such as blurry, deformed, extra limbs, extra fingers, watermark, text, logo, low quality (drop "text" and "logo" if the user wants them).`,
  video: `${SISTEMA_COMUM}
TARGET: a text-to-video model (Wan 2.2) making a clip of up to 5 seconds. Write ${MINIMO.video + 10} to 150 words of flowing prose in this order: ONE main subject with exact count and appearance -> setting -> the ONE main action described with verbs and rhythm ("walks steadily away from the camera", "rotates slowly ninety degrees") -> the camera movement named ONCE (slow push-in, tracking shot alongside, static camera, slow orbit) with lens and angle -> lighting and time of day -> color grade -> atmosphere -> style (photorealistic cinematic, commercial look) -> quality words.
RULES: one subject, one action, one camera movement (two actions fight each other and become confused motion); give exact counts and parts ("a sedan with four wheels", "exactly one woman", "two hands holding the cup"); always describe motion explicitly, even for landscapes (camera flies forward, clouds drift left to right); no readable text, logos or captions in motion; people are most stable walking away, in profile or in medium shots; physical plausibility. "formato" must be one of ${FORMATOS.video.join(', ')}. "segundos": 3 to 5 for a single clip (up to 60 only if the user explicitly asked for a long video, then describe an evolving scene in simple beats). "estilo": null.
"negative_prompt": short extra list for this request (the server already adds the model's official negative), e.g. extra wheels, morphing geometry, flicker, warped faces.`,
  video_com_imagem: `${SISTEMA_COMUM}
TARGET: an image-to-video model (Wan 2.2) that will animate an existing starting image of up to 5 seconds. The image already defines the subject, setting and look, so DO NOT redescribe them at length: write ${MINIMO.video_com_imagem + 10} to 90 words that say what moves and how: the one main action with verbs and rhythm, the camera movement named once, how light and atmosphere evolve, what must stay identical (faces, logos, shapes, number of parts). No new objects entering the frame. "formato" must be one of ${FORMATOS.video.join(', ')}. "segundos" 3 to 5. "estilo" null. "negative_prompt": short extra list (morphing, flicker, warped faces, extra limbs).`,
}

function extrairJson(texto) {
  const t = String(texto || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
  try { return JSON.parse(t) } catch {}
  const a = t.indexOf('{')
  const b = t.lastIndexOf('}')
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)) } catch {} }
  return null
}

function normalizar(tipo, j, args) {
  const chave = tipo === 'video' && args.tem_imagem_inicial ? 'video_com_imagem' : tipo
  const fmts = FORMATOS[tipo]
  // o formato pedido pelo usuário (ou o da imagem inicial) vale mais que a escolha do modelo
  const formato = fmts.includes(String(args.formato || '').toLowerCase()) ? String(args.formato).toLowerCase() : fmts.includes(String(j.formato || '').toLowerCase()) ? String(j.formato).toLowerCase() : fmts[0]
  let segundos = null
  if (tipo === 'video') {
    segundos = Number(j.segundos)
    if (!(segundos >= 1 && segundos <= 60)) segundos = Number(args.segundos) || 5
    if (args.segundos) segundos = Number(args.segundos)
  }
  const estilo = tipo === 'imagem' && ESTILOS.includes(String(j.estilo || '').toLowerCase()) ? String(j.estilo).toLowerCase() : null
  return {
    tipo, prompt: String(j.prompt || '').trim(), negative_prompt: String(j.negative_prompt || '').trim().slice(0, 400), formato, segundos, estilo,
    resumo_pt: String(j.resumo_pt || '').trim().slice(0, 400), alertas: Array.isArray(j.alertas) ? j.alertas.map((x) => String(x).slice(0, 200)).slice(0, 5) : [],
    minimo: MINIMO[chave],
  }
}

// plano B sem modelo: nunca deixa o usuário sem prompt utilizável (completa com receitas de direção de cena)
function composto(tipo, args) {
  const base = String(args.pedido || '').trim()
  const extras = tipo === 'imagem'
    ? [`Subject: ${base}.`, 'Setting: a coherent, uncluttered background that supports the subject and adds depth.', 'Composition: centered subject, medium shot, 50mm lens, eye-level angle, shallow depth of field.', 'Lighting: soft natural key light from the left with gentle fill, golden hour warmth, clean shadows.', 'Color palette: harmonious, balanced contrast with one accent color.', 'Atmosphere: calm, polished, professional.', 'Style: photorealistic editorial photography, sharp focus, natural textures, high detail, ultra detailed.']
    : args.tem_imagem_inicial
      ? [`The scene from the starting image comes to life: ${base}.`, 'One main movement, smooth and steady, at a natural rhythm.', 'The camera performs a slow push-in and keeps the subject centered.', 'Light and atmosphere stay consistent, with soft natural motion in the background.', 'Faces, logos, shapes and the number of parts remain identical to the starting image, no new objects enter the frame, cinematic and photorealistic.']
      : [`Subject: ${base}.`, 'Setting: a coherent, uncluttered environment with depth and natural details.', 'Action: one main movement, smooth and steady at a natural rhythm, described clearly from start to end.', 'Camera: a slow tracking shot alongside the subject at 35mm, steady and stabilized.', 'Lighting: warm golden hour sunlight with long soft shadows.', 'Color grade: warm orange and teal, balanced contrast.', 'Atmosphere: calm and cinematic.', 'Style: photorealistic commercial look, sharp focus, ultra detailed, natural motion blur.']
  return { prompt: extras.join(' '), negative_prompt: tipo === 'imagem' ? 'blurry, deformed, extra limbs, extra fingers, watermark, text, logo, low quality' : 'morphing geometry, flicker, warped faces, extra limbs, extra wheels, jitter', formato: args.formato, segundos: args.segundos, estilo: null,
    resumo_pt: `Vou gerar: ${base}.`, alertas: ['Usei um detalhamento padrão (o modelo de texto não respondeu agora); descreva melhor o que você quer para ficar mais fiel.'] }
}

async function chamar({ base, chave, fetchFn, sistema, usuario, tempo = 40000 }) {
  const f = fetchFn || fetch
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), tempo)
  try {
    const r = await f(base + '/chat/completions', {
      method: 'POST', signal: ctl.signal,
      headers: { Authorization: 'Bearer ' + chave, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODELO, temperature: 0.6, max_tokens: 900, chat_template_kwargs: { enable_thinking: false }, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuario }] }),
    })
    if (!r.ok) throw new Error('HTTP ' + r.status)
    const j = await r.json()
    return j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content
  } finally {
    clearTimeout(t)
  }
}

// args: { tipo: 'imagem'|'video', pedido, respostas?, formato?, segundos?, estilo?, tem_imagem_inicial? }
async function detalhar(args, ctx = {}) {
  const tipo = args.tipo === 'imagem' ? 'imagem' : 'video'
  if (!String(args.pedido || '').trim()) throw new Error('Diga o que o usuário pediu (campo pedido).')
  const chave = tipo === 'video' && args.tem_imagem_inicial ? 'video_com_imagem' : tipo
  const min = MINIMO[chave]
  const usuario = [`Request (may be Portuguese): ${String(args.pedido).trim()}`, args.respostas ? `Extra details and answers from the user: ${String(args.respostas).trim()}` : '',
    args.formato ? `Requested format: ${args.formato}` : '', args.segundos ? `Requested duration: ${args.segundos} seconds` : '', args.estilo ? `Requested style: ${args.estilo}` : '',
    tipo === 'video' && args.tem_imagem_inicial ? 'A starting image already exists (image-to-video).' : ''].filter(Boolean).join('\n')
  let resultado = null
  let aviso = ''
  for (let t = 0; t < 2 && !resultado; t++) {
    try {
      const texto = await chamar({ base: ctx.base, chave: ctx.chave, fetchFn: ctx.fetchFn, sistema: SISTEMA[chave], usuario: t ? `${usuario}\nYour previous prompt had too few words. Write at least ${min + 10} words, keeping the same JSON format.` : usuario })
      const j = extrairJson(texto)
      if (j && j.prompt) {
        const n = normalizar(tipo, j, args)
        if (contar(n.prompt) >= min) resultado = n
        else aviso = `prompt de ${contar(n.prompt)} palavras`
      }
    } catch (e) {
      aviso = String(e.message || e)
    }
  }
  let origem = 'modelo'
  if (!resultado) {
    origem = 'padrao'
    resultado = normalizar(tipo, composto(tipo, args), args)
    resultado.alertas = [...resultado.alertas]
  }
  resultado.origem = origem
  resultado.palavras = contar(resultado.prompt)
  if (aviso && origem === 'padrao' && process.env.SB_MIDIA_DEBUG) resultado.debug = aviso
  return resultado
}

function formatarSaida(r) {
  const linhas = [
    `DETALHAMENTO PRONTO (${r.palavras} palavras${r.origem === 'padrao' ? ', versão padrão' : ''}). Use EXATAMENTE este prompt na ferramenta de geração, sem encurtar:`,
    `prompt: ${r.prompt}`,
    `negative_prompt: ${r.negative_prompt}`,
    `formato: ${r.formato}`,
    r.segundos ? `segundos: ${r.segundos}` : '',
    r.estilo ? `estilo: ${r.estilo}` : '',
    `Diga ao usuário (1 ou 2 linhas): ${r.resumo_pt}`,
    r.alertas.length ? `Avise também: ${r.alertas.join(' | ')}` : '',
  ]
  return linhas.filter(Boolean).join('\n')
}

// ---- conferência da troca de personagem (sem GPU)
const EXT_VIDEO = /\.(mp4|mov|webm)$/i
const EXT_FOTO = /\.(png|jpe?g|webp)$/i
function sonda(arq) {
  try {
    const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate:format=duration', '-of', 'json', arq], { encoding: 'utf8', timeout: 15000 })
    if (r.status !== 0) return null
    const j = JSON.parse(r.stdout)
    const v = (j.streams || []).find((s) => s.codec_type === 'video') || {}
    return { largura: v.width, altura: v.height, duracao: Number(j.format && j.format.duration) || null, audio: (j.streams || []).some((s) => s.codec_type === 'audio') }
  } catch { return null }
}

function conferirTroca(args) {
  const achados = []
  const bloqueios = []
  const video = String(args.video || '')
  const foto = String(args.foto || '')
  const iv = fs.existsSync(video) ? fs.statSync(video) : null
  const iF = fs.existsSync(foto) ? fs.statSync(foto) : null
  if (!iv) bloqueios.push('O vídeo não foi encontrado nesse caminho.')
  else {
    if (!EXT_VIDEO.test(video)) bloqueios.push('O vídeo precisa ser MP4, MOV ou WEBM.')
    if (iv.size > 40 * 1024 * 1024) bloqueios.push(`O vídeo tem ${(iv.size / 1048576).toFixed(0)} MB; o máximo é 40 MB (corte um trecho ou comprima).`)
  }
  if (!iF) bloqueios.push('A foto não foi encontrada nesse caminho.')
  else {
    if (!EXT_FOTO.test(foto)) bloqueios.push('A foto precisa ser PNG, JPEG ou WEBP.')
    if (iF.size > 6 * 1024 * 1024) bloqueios.push(`A foto tem ${(iF.size / 1048576).toFixed(1)} MB; o máximo é 6 MB.`)
    if (iF.size < 30 * 1024) achados.push('A foto é muito pequena em bytes: provavelmente de baixa resolução; o rosto precisa ficar nítido e grande.')
  }
  let info = null
  if (iv && !bloqueios.length) {
    info = sonda(video)
    if (info) {
      if (info.duracao) {
        if (info.duracao > 30) achados.push(`O vídeo tem ${Math.round(info.duracao)} s; a troca leva cerca de 9 minutos a cada 5 s. Sugira cortar o trecho que importa.`)
        else achados.push(`Duração ${info.duracao.toFixed(1)} s: previsão de ~${Math.max(5, Math.round((info.duracao / 5) * 9))} minutos.`)
      }
      if (info.altura && info.altura < 360) achados.push('A resolução do vídeo é baixa (menos de 360p): o resultado sai sem nitidez.')
      if (!info.audio) achados.push('O vídeo não tem áudio (a troca mantém o áudio original quando existe).')
    }
  }
  const proximos = ['Olhe a foto com vision_analyze: uma só pessoa, rosto de frente, nítido, bem iluminado, sem óculos escuros, mão, cabelo ou máscara cobrindo.',
    `Extraia UM quadro do meio do vídeo para uma pasta temporária (ffmpeg -ss ${info && info.duracao ? (info.duracao / 2).toFixed(1) : '2'} -i "${video}" -frames:v 1 quadro.png) e olhe com vision_analyze: pessoa principal em primeiro plano, rosto grande, sem espelho ou reflexo, sem várias pessoas disputando o centro.`,
    'Se algo estiver ruim, diga ao usuário o que trocar antes de gerar. Se estiver bom, pergunte só o que faltar (resolução 480p/736p, sincronia labial) e chame midia_trocar_personagem uma vez.']
  return { ok: bloqueios.length === 0, bloqueios, achados, info, proximos }
}

function formatarConferencia(r) {
  return [r.ok ? 'CONFERÊNCIA DE ARQUIVOS: ok para seguir.' : 'CONFERÊNCIA DE ARQUIVOS: há problemas que impedem a troca.', ...r.bloqueios.map((b) => 'PROBLEMA: ' + b), ...r.achados.map((a) => 'ATENÇÃO: ' + a), 'PRÓXIMOS PASSOS:', ...r.proximos.map((p, i) => `${i + 1}. ${p}`)].join('\n')
}

module.exports = { detalhar, formatarSaida, conferirTroca, formatarConferencia, extrairJson, contar, composto, MINIMO }
