// Editor de vídeo do Segundo Cérebro (spec 25 §21): o motor é o Concat (AGPL, projeto aberto), baixado da release OFICIAL, conferido por SHA-256 e instalado em
// MODO SILENCIOSO na pasta do próprio app (nenhum assistente aparece). O Hermes usa as ferramentas dele pelo MCP (`concat --mcp`), o usuário abre a janela do editor
// pelo app (`--project <pasta>`). Quando sair o fork com o nome Segundo Cérebro (RangelTech/segundo-cerebro-editor) só mudam as constantes ORIGEM abaixo.
const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const { spawn, execFile } = require('child_process')

// Origens da release, em ordem: o fork com o nome do Segundo Cérebro (RangelTech/segundo-cerebro-editor) e, se ele ainda não tiver release, o Concat
// oficial (mesmo motor, só muda o nome da janela). O hash vem SEMPRE do SHA256SUMS da própria release; o do Concat oficial também é fixo aqui.
const ORIGENS = [
  { repo: 'RangelTech/segundo-cerebro-editor', tag: 'v0.2.9-sc.1', win32: { arquivo: 'SegundoCerebroEditor-0.2.9-windows-x86_64-setup.exe', sha256: '', exe: 'concat.exe' } },
  { repo: 'jub0t/Concat', tag: 'v0.2.9', win32: { arquivo: 'Concat-0.2.9-windows-x86_64-setup.exe', sha256: 'bc3e994a592d46c9dce037bf0b41e329de7b3821c25bc27717a8e0d5d34d1a0a', exe: 'concat.exe' } },
]
const ORIGEM = { win32: ORIGENS[0].win32 } // só o nome do executável e o suporte por sistema são lidos daqui
const NOME_EXIBIDO = 'Editor de vídeo do Segundo Cérebro'

// INTERRUPTOR: o editor de vídeo só existe para o usuário quando ligado (variável SB_EDITOR=1 ou o arquivo `editor-video.on` na pasta de dados).
// Desligado: o Hermes não recebe skill nem ferramentas, o app não instala nada e as telas não mostram o botão.
function habilitado(app) {
  if (process.env.SB_EDITOR === '1') return true
  if (process.env.SB_EDITOR === '0') return false
  try { return !!app && fs.existsSync(path.join(app.getPath('userData'), 'editor-video.on')) } catch { return false }
}

function pastaEditor(app) {
  if (process.env.SB_EDITOR_DIR) return process.env.SB_EDITOR_DIR
  if (process.platform === 'win32') return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Programs', 'SegundoCerebroEditor')
  return path.join(app.getPath('userData'), 'editor')
}
function suportado() {
  return !!ORIGEM[process.platform]
}
function caminhoExe(app) {
  const o = ORIGEM[process.platform]
  return o ? path.join(pastaEditor(app), o.exe) : ''
}
const instalado = (app) => {
  const e = caminhoExe(app)
  return !!e && fs.existsSync(e)
}

function sha256Arquivo(arq) {
  return new Promise((res, rej) => {
    const h = crypto.createHash('sha256')
    fs.createReadStream(arq).on('data', (d) => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej)
  })
}

// baixa para um arquivo com progresso (0 a 1); segue redirecionamento (a release do GitHub redireciona para o CDN)
async function baixar(url, destino, progresso) {
  const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20 * 60000) })
  if (!r.ok) throw new Error('download falhou (' + r.status + ')')
  const total = +r.headers.get('content-length') || 0
  const f = fs.createWriteStream(destino)
  let lido = 0
  const reader = r.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    f.write(Buffer.from(value))
    lido += value.length
    if (total && progresso) progresso(lido / total)
  }
  await new Promise((res) => f.end(res))
}

function executar(exe, args, ms = 10 * 60000) {
  return new Promise((resolve) => {
    const p = spawn(exe, args, { windowsHide: true, stdio: 'ignore' })
    const t = setTimeout(() => { try { p.kill() } catch {} resolve(-1) }, ms)
    p.on('close', (c) => (clearTimeout(t), resolve(c === null ? -1 : c)))
    p.on('error', () => (clearTimeout(t), resolve(-2)))
  })
}

// confere que o programa sobe de verdade (--smoke é o autoteste dele; sem janela)
function conferir(exe) {
  return new Promise((resolve) => {
    execFile(exe, ['--version'], { windowsHide: true, timeout: 30000 }, (e, out, err) => resolve(!e && /Concat|\d+\.\d+/.test(String(out) + String(err))))
  })
}

let andamento = null
// instala em silêncio; `progresso({ etapa, fracao })` alimenta a tela e a resposta do Hermes
function instalar(app, progresso = () => {}) {
  if (!habilitado(app)) return Promise.reject(new Error('O editor de vídeo ainda não está disponível.'))
  if (!suportado()) return Promise.reject(new Error('O editor de vídeo ainda não está disponível neste sistema (por enquanto só no Windows).'))
  if (instalado(app)) return Promise.resolve({ ok: true, ja: true })
  if (andamento) return andamento
  andamento = (async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-editor-'))
    try {
      let arq = ''
      let ultimoErro = null
      for (const origem of ORIGENS) {
        const o = origem[process.platform]
        if (!o) continue
        const base = `https://github.com/${origem.repo}/releases/download/${origem.tag}/`
        try {
          progresso({ etapa: 'Baixando o editor de vídeo (uma vez só)', fracao: 0 })
          arq = path.join(tmp, o.arquivo)
          await baixar(base + o.arquivo, arq, (f) => progresso({ etapa: 'Baixando o editor de vídeo (uma vez só)', fracao: f * 0.85 }))
          progresso({ etapa: 'Conferindo o arquivo', fracao: 0.87 })
          const h = await sha256Arquivo(arq)
          const sums = await fetch(base + 'SHA256SUMS', { signal: AbortSignal.timeout(60000) }).then((r) => (r.ok ? r.text() : '')).catch(() => '')
          const esperadoRelease = (sums.split('\n').find((l) => l.includes(o.arquivo)) || '').trim().split(/\s+/)[0]
          const aceitos = [o.sha256, esperadoRelease].filter(Boolean)
          if (!aceitos.length || !aceitos.includes(h)) throw new Error('O arquivo baixado não confere com a assinatura oficial (SHA-256). Não instalei.')
          ultimoErro = null
          break
        } catch (e) {
          ultimoErro = e
          arq = ''
          if (/SHA-256/.test(String(e.message))) throw e // arquivo adulterado: não tenta outra origem em silêncio
        }
      }
      if (!arq) throw ultimoErro || new Error('Não consegui baixar o editor de vídeo.')
      progresso({ etapa: 'Instalando o editor', fracao: 0.9 })
      const dir = pastaEditor(app)
      fs.mkdirSync(path.dirname(dir), { recursive: true })
      // Inno Setup: /VERYSILENT = nenhuma janela; /SUPPRESSMSGBOXES = nenhuma pergunta; /DIR = nossa pasta. (O "/S" do NSIS é ignorado e abriria o assistente.)
      const codigo = await executar(arq, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-', '/DIR=' + dir])
      if (codigo !== 0 || !instalado(app)) throw new Error('A instalação do editor não terminou (código ' + codigo + ').')
      if (!(await conferir(caminhoExe(app)))) throw new Error('O editor foi instalado mas não abriu no teste.')
      progresso({ etapa: 'Editor de vídeo pronto', fracao: 1 })
      return { ok: true, ja: false }
    } finally {
      try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {}
    }
  })().finally(() => (andamento = null))
  return andamento
}

// abre a janela do editor (a interface dele, em janela própria, não espremida no chat), já com o projeto do Hermes
// Predefine o editor para o Segundo Cérebro: português e a automação ligada (é por ela que o Hermes conversa com a janela). O arquivo é JSON puro, SEM BOM
// (com BOM o editor o descarta). Só mexe se o editor não estiver aberto, para não ser sobrescrito.
function configDir() {
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'app.concat.editor')
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'app.concat.editor')
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'app.concat.editor')
}
function prepararConfig() {
  const arq = path.join(configDir(), 'settings.json')
  let j = {}
  try { j = JSON.parse(fs.readFileSync(arq, 'utf8').replace(/^\uFEFF/, '')) } catch {}
  const srv = j.server || {}
  const novo = { ...j, locale: j.locale || 'pt-BR', server: { enabled: true, listen: srv.listen || '127.0.0.1:7420', token: srv.token || crypto.randomBytes(16).toString('hex') } }
  fs.mkdirSync(path.dirname(arq), { recursive: true })
  fs.writeFileSync(arq, JSON.stringify(novo, null, 2))
  return novo
}
function abrirJanela(app, projeto) {
  if (!habilitado(app)) throw new Error('O editor de vídeo ainda não está disponível.')
  try { prepararConfig() } catch {}
  if (!instalado(app)) throw new Error('O editor ainda não foi instalado.')
  const args = projeto && fs.existsSync(projeto) ? ['--project', projeto] : []
  const p = spawn(caminhoExe(app), args, { detached: true, stdio: 'ignore', windowsHide: false })
  p.unref()
  return { ok: true, pid: p.pid }
}

// servidor MCP do Concat para o Hermes: o próprio binário, em stdio. `auto` = usa a janela se estiver aberta, senão roda sozinho (headless)
function mcp(app, pastaTrabalho) {
  if (!habilitado(app) || !instalado(app)) return null
  return {
    name: 'editor',
    command: caminhoExe(app),
    args: ['--mcp', 'auto'], // com a janela aberta e a automação ligada fala por ela; sem janela roda sozinho
    env: [{ name: 'CONCAT_MCP_ROOTS', value: [pastaTrabalho, path.join(pastaTrabalho, 'Videos')].filter(Boolean).join(process.platform === 'win32' ? ';' : ':') }],
  }
}

// corte de silêncio: acha os trechos COM som (ffmpeg silencedetect) e monta um arquivo novo só com eles
function ffmpegBin() {
  return process.env.SB_FFMPEG || 'ffmpeg'
}
function rodar(bin, args) {
  return new Promise((res) => {
    execFile(bin, args, { windowsHide: true, maxBuffer: 64 * 1024 * 1024, timeout: 30 * 60000 }, (e, out, err) => res({ codigo: e ? e.code || 1 : 0, saida: String(out || ''), erro: String(err || '') }))
  })
}
function trechosComSom(log, duracao, margem = 0.12) {
  const ini = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1])
  const fim = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1])
  const sil = ini.map((s, i) => [s, fim[i] != null ? fim[i] : duracao])
  const som = []
  let cursor = 0
  for (const [s, e] of sil) {
    if (s - cursor > 0.25) som.push([Math.max(0, cursor - margem), Math.min(duracao, s + margem)])
    cursor = e
  }
  if (duracao - cursor > 0.25) som.push([Math.max(0, cursor - margem), duracao])
  return som
}
async function cortarSilencio(arquivo, { limiar = -35, minimo = 0.6, saida } = {}) {
  const dur = await rodar('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', arquivo])
  const duracao = parseFloat(dur.saida)
  if (!(duracao > 0)) throw new Error('Não consegui ler a duração do arquivo.')
  const det = await rodar(ffmpegBin(), ['-hide_banner', '-nostats', '-i', arquivo, '-af', `silencedetect=noise=${limiar}dB:d=${minimo}`, '-f', 'null', '-'])
  const som = trechosComSom(det.erro + det.saida, duracao)
  if (!som.length) throw new Error('Não encontrei trechos com som.')
  const out = saida || arquivo.replace(/(\.[^.]+)?$/, '-sem-silencio.mp4')
  const temVideo = /Video:/.test(det.erro)
  const filtros = []
  som.forEach(([a, b], i) => {
    if (temVideo) filtros.push(`[0:v]trim=start=${a.toFixed(3)}:end=${b.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`)
    filtros.push(`[0:a]atrim=start=${a.toFixed(3)}:end=${b.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`)
  })
  const juntar = som.map((_, i) => (temVideo ? `[v${i}][a${i}]` : `[a${i}]`)).join('')
  filtros.push(`${juntar}concat=n=${som.length}:v=${temVideo ? 1 : 0}:a=1${temVideo ? '[v][a]' : '[a]'}`)
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', arquivo, '-filter_complex', filtros.join(';'), ...(temVideo ? ['-map', '[v]'] : []), '-map', '[a]', ...(temVideo ? ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p'] : []), '-c:a', 'aac', '-b:a', '160k', out]
  const r = await rodar(ffmpegBin(), args)
  if (r.codigo !== 0) throw new Error('O corte falhou: ' + r.erro.slice(-300))
  const novo = parseFloat((await rodar('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', out])).saida)
  return { arquivo: out, duracaoAntes: duracao, duracaoDepois: novo, trechos: som.length, cortado: +(duracao - novo).toFixed(2) }
}

module.exports = { habilitado, ORIGENS, ORIGEM, prepararConfig, configDir, NOME_EXIBIDO, pastaEditor, caminhoExe, instalado, suportado, instalar, abrirJanela, mcp, cortarSilencio, trechosComSom, sha256Arquivo }
