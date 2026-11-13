// Redublagem com a voz do usuário (spec 36): o vídeo mantém imagem e duração; a fala passa a ser dita com a voz clonada de uma amostra.
// Passos: 1) FFmpeg tira o áudio; 2) o servidor transcreve (Whisper, sem custo); 3) se o idioma muda (ou o usuário trouxe outro texto), o servidor traduz;
// 4) orçamento em créditos (preço por caractere) e confirmação; 5) voz clonada pelo Estúdio em blocos de até 3.500 caracteres; 6) FFmpeg ajusta a
// velocidade ao tamanho do vídeo (0,8x a 1,25x) e troca o áudio. A música de fundo some (não separamos a voz do fundo).
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const BLOCO = 3500
const LIM_TEMPO = { min: 0.8, max: 1.25 }

function binario(nome) {
  const exe = process.platform === 'win32' ? nome + '.exe' : nome
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [nome], { encoding: 'utf8' })
  if (r.status === 0 && r.stdout.trim()) return r.stdout.split(/\r?\n/)[0].trim()
  const bases = [process.env.SB_DATA_DIR, process.env.APPDATA && path.join(process.env.APPDATA, 'SegundoCerebro'), path.join(require('os').homedir(), '.config', 'SegundoCerebro'), require('os').homedir()].filter(Boolean)
  for (const b of bases) {
    const dir = path.join(b, 'hermes', 'tools')
    try {
      for (const d of fs.readdirSync(dir).filter((x) => x.startsWith('ffmpeg'))) {
        const p = path.join(dir, d, 'bin', exe)
        if (fs.existsSync(p)) return p
      }
    } catch {}
  }
  throw new Error('Não encontrei o programa de áudio e vídeo (FFmpeg) neste computador.')
}
const rodar = (bin, args, opcoes = {}) => {
  const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opcoes })
  if (r.status !== 0) throw new Error('falha no processamento do arquivo: ' + String(r.stderr || '').slice(-300))
  return r
}
function duracao(arquivo) {
  const r = spawnSync(binario('ffprobe'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', arquivo], { encoding: 'utf8' })
  const d = parseFloat(String(r.stdout).trim())
  if (!(d > 0)) throw new Error('Não consegui ler a duração do arquivo.')
  return d
}
const temVideo = (arq) => /\.(mp4|mov|webm|mkv|avi)$/i.test(arq)

// divide o texto em blocos de até `max` caracteres, cortando em fim de frase
function dividir(texto, max = BLOCO) {
  const frases = String(texto).replace(/\s+/g, ' ').trim().split(/(?<=[.!?…])\s+/)
  const blocos = []
  let atual = ''
  for (const f of frases) {
    if ((atual + ' ' + f).trim().length > max && atual) { blocos.push(atual.trim()); atual = '' }
    if (f.length > max) { for (let i = 0; i < f.length; i += max) blocos.push(f.slice(i, i + max)); continue }
    atual = (atual + ' ' + f).trim()
  }
  if (atual) blocos.push(atual.trim())
  return blocos
}

// Passo A (sem custo): audio -> texto (e tradução). Devolve { texto, origem, destino, duracao }
async function preparar({ video, idioma, idiomaOrigem, textoNovo, api, base, chave, pasta }) {
  const ff = binario('ffmpeg')
  const dir = path.join(pasta, '.midia')
  fs.mkdirSync(dir, { recursive: true })
  const wav = path.join(dir, 'dub-origem.mp3')
  rodar(ff, ['-y', '-i', video, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '48k', wav])
  const dur = duracao(video)
  let texto = String(textoNovo || '').trim()
  let origem = idiomaOrigem || ''
  if (!texto) {
    const buf = fs.readFileSync(wav)
    const fd = new FormData()
    fd.append('file', new Blob([buf], { type: 'audio/mpeg' }), 'fala.mp3')
    fd.append('model', 'whisper-1')
    const r = await fetch(base + '/audio/transcriptions', { method: 'POST', body: fd, headers: { Authorization: 'Bearer ' + chave } }) // multipart: o fetch define o Content-Type
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error?.message || 'Não consegui ouvir a fala do vídeo agora. Tente de novo em instantes.')
    texto = String(j.text || '').trim()
    origem = origem || j.language || ''
    if (!texto) throw new Error('Não encontrei fala neste vídeo para dublar.')
  }
  const destino = idioma || origem || 'pt'
  if (!textoNovo && origem && destino && origem.slice(0, 2) !== destino.slice(0, 2)) {
    const r = await api('/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model: 'qwen-abliterated', temperature: 0.2, max_tokens: Math.min(8000, Math.ceil(texto.length / 2) + 800),
        messages: [{ role: 'system', content: `Traduza a fala abaixo para o idioma "${destino}", mantendo o tom, o ritmo e o tamanho aproximado (a tradução será falada no mesmo tempo do original). Responda SOMENTE com o texto traduzido, sem aspas nem comentários.` }, { role: 'user', content: texto }] }),
    })
    const j = await r.json().catch(() => ({}))
    const t = String(j.choices?.[0]?.message?.content || '').trim()
    if (!r.ok || !t) throw new Error('Não consegui traduzir a fala agora. Tente de novo em instantes.')
    texto = t
  }
  return { texto, origem: origem || null, destino, duracao: dur }
}

// Passo B (com custo): remonta o vídeo com as faixas de voz já geradas
function montar({ video, faixas, saida }) {
  const ff = binario('ffmpeg')
  const dir = path.dirname(saida)
  fs.mkdirSync(dir, { recursive: true })
  const lista = path.join(dir, '.dub-lista.txt')
  fs.writeFileSync(lista, faixas.map((f) => `file '${f.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'))
  const voz = path.join(dir, '.dub-voz.wav')
  rodar(ff, ['-y', '-f', 'concat', '-safe', '0', '-i', lista, '-ar', '44100', '-ac', '2', voz])
  const dVideo = duracao(video)
  const dVoz = duracao(voz)
  const fator = Math.min(LIM_TEMPO.max, Math.max(LIM_TEMPO.min, dVoz / dVideo)) // >1 acelera a fala; <1 desacelera um pouco
  const filtro = `atempo=${fator.toFixed(3)},apad=whole_dur=${dVideo.toFixed(3)},atrim=0:${dVideo.toFixed(3)}`
  rodar(ff, ['-y', '-i', video, '-i', voz, '-filter_complex', `[1:a]${filtro}[a]`, '-map', '0:v:0', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', saida])
  try { fs.rmSync(lista, { force: true }); fs.rmSync(voz, { force: true }) } catch {}
  return { saida, duracaoVideo: dVideo, duracaoVoz: dVoz, fator }
}

module.exports = { preparar, montar, dividir, binario, duracao, temVideo, BLOCO }
