// "Olá cérebro" NATIVO (22/11/2026). Antes o reconhecedor (Vosk) rodava em WebAssembly dentro da janela: medido no PC do Lucas,
// ~2,6 GB de memória fixos e boa parte da CPU da tela, só para esperar uma frase. Agora é como os assistentes de celular:
// a janela só capta o microfone e corta o silêncio (barato); o áudio com voz vem para cá e um processo NATIVO (Vosk em Python,
// modelo pequeno de português, gramática de uma frase só) confere a palavra. Se o processo nativo não der para montar, a janela
// volta sozinha para o jeito antigo (WebAssembly), então o recurso nunca some.
const fs = require('fs')
const path = require('path')
const { spawn, spawnSync } = require('child_process')

const ESCUTA_PY = `import json, os, shutil, sys, tarfile
modelo_tgz, pasta, gram = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
alvo = os.path.join(pasta, 'modelo')
pronto = lambda d: os.path.isfile(os.path.join(d, 'final.mdl')) or os.path.isfile(os.path.join(d, 'am', 'final.mdl'))
if not pronto(alvo):
    tmp = os.path.join(pasta, 'modelo.tmp')
    shutil.rmtree(tmp, ignore_errors=True)
    shutil.rmtree(alvo, ignore_errors=True)
    with tarfile.open(modelo_tgz) as t:
        t.extractall(tmp)
    raiz = tmp
    while not pronto(raiz):
        sub = [d for d in os.listdir(raiz) if os.path.isdir(os.path.join(raiz, d)) and not d.startswith('.')]
        if len(sub) != 1:
            break
        raiz = os.path.join(raiz, sub[0])
    shutil.move(raiz, alvo)
    shutil.rmtree(tmp, ignore_errors=True)
from vosk import Model, KaldiRecognizer, SetLogLevel
SetLogLevel(-1)
rec = KaldiRecognizer(Model(alvo), 16000, json.dumps(gram, ensure_ascii=False))
rec.SetWords(True)
# Só o resultado FINAL, com confiança por palavra: gramática de uma frase força qualquer fala a virar aquelas palavras.
# Medido 22/11/2026: frase dita = 0,91-1,0 por palavra. Em 40 min de conversa de podcast a frase NUNCA abriu uma fala (a regra
# abaixo); no meio da fala apareceu com até 0,86/0,93. Por isso o que separa é "abrir a fala", e a confiança só corta lixo (0,5):
# voz de gente de verdade, com ruído da casa, varia mais que a sintética.
alvo_pal = gram[0].split()
LIM = 0.5
print(json.dumps({'pronto': True}), flush=True)
entrada = sys.stdin.buffer
while True:
    b = entrada.read(4096 * 2)
    if not b:
        break
    if not rec.AcceptWaveform(b):
        continue
    ws = json.loads(rec.Result()).get('result') or []
    pal = [w.get('word', '') for w in ws]
    # a frase ABRE a fala (quem chama o assistente começa por ela); "[unk] olá cérebro" é a palavra no meio de uma conversa:
    # foi o único falso positivo em 10 min de podcast (0,86 e 0,93), com fala antes na mesma frase
    if any(x in alvo_pal for x in pal):  # diagnóstico: o que ouviu perto da frase (vai para o agente.log)
        print(json.dumps({'visto': [[w.get('word'), round(w.get('conf', 0), 2)] for w in ws][:8]}, ensure_ascii=False), flush=True)
    if pal[:len(alvo_pal)] == alvo_pal and all(w.get('conf', 0) >= LIM for w in ws[:len(alvo_pal)]):
        print(json.dumps({'texto': gram[0], 'conf': [round(w.get('conf', 0), 2) for w in ws[:len(alvo_pal)]]}, ensure_ascii=False), flush=True)
`

function criar({ app, modeloTgz, registrar = () => {}, aoOuvir = () => {} }) {
  const raiz = path.join(app.getPath('userData'), 'ativacao')
  const venv = path.join(raiz, 'venv')
  const py = path.join(venv, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
  let filho = null, gramAtual = '', prontoP = null, falhou = ''

  function ferramenta(prefixo, exe) {
    const tools = path.join(app.getPath('userData'), 'hermes', 'tools')
    try {
      for (const d of fs.readdirSync(tools).sort().reverse()) {
        if (!d.startsWith(prefixo)) continue
        for (const f of [path.join(tools, d, exe), path.join(tools, d, 'bin', exe)]) if (fs.existsSync(f)) return f
      }
    } catch {}
    return null
  }
  const ok = () => fs.existsSync(py) && spawnSync(py, ['-c', 'import vosk'], { windowsHide: true, timeout: 30000 }).status === 0

  // venv próprio com o vosk (uv e Python que já vêm com o agente); uma vez por computador, ~20 s
  function preparar() {
    if (prontoP) return prontoP
    prontoP = new Promise((resolve) => {
      if (ok()) return resolve(true)
      const uv = ferramenta('uv-', process.platform === 'win32' ? 'uv.exe' : 'uv')
      const pyBase = ferramenta('python-', process.platform === 'win32' ? 'python.exe' : 'python3')
      if (!uv) { falhou = 'sem uv'; return resolve(false) }
      fs.mkdirSync(raiz, { recursive: true })
      const passo = (args, depois) => {
        const p = spawn(uv, args, { windowsHide: true })
        let err = ''
        p.stderr.on('data', (d) => (err += d))
        p.on('close', (c) => (c === 0 ? depois() : ((falhou = err.slice(-300)), registrar('ativação nativa: ' + falhou), resolve(false))))
        p.on('error', (e) => ((falhou = e.message), resolve(false)))
      }
      const instalar = () => passo(['pip', 'install', '--python', py, 'vosk==0.3.45'], () => resolve(ok()))
      if (fs.existsSync(py)) instalar()
      else passo(['venv', '--python', pyBase || '3.12', venv], instalar)
    })
    return prontoP
  }

  function fechar() {
    const f = filho
    filho = null
    gramAtual = ''
    if (f) try { f.stdin.end(); f.kill() } catch {}
  }

  async function abrir(frase) {
    const gram = JSON.stringify([...new Set([String(frase).toLowerCase(), String(frase).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()])].concat('[unk]'))
    if (filho && gramAtual === gram) return { ok: true }
    fechar()
    if (!(await preparar()) || !modeloTgz()) return { ok: false, erro: falhou || 'sem modelo' }
    const script = path.join(raiz, 'escuta.py')
    try { if (!fs.existsSync(script) || fs.readFileSync(script, 'utf8') !== ESCUTA_PY) fs.writeFileSync(script, ESCUTA_PY) } catch {}
    const f = spawn(py, [script, modeloTgz(), raiz, gram], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PYTHONUTF8: '1' } })
    filho = f
    gramAtual = gram
    let resto = ''
    const pronto = new Promise((res) => {
      f.stdout.on('data', (d) => {
        resto += d
        const linhas = resto.split('\n')
        resto = linhas.pop()
        for (const l of linhas) {
          try {
            const j = JSON.parse(l)
            if (j.pronto) res(true)
            if (j.texto) aoOuvir(j.texto)
            if (j.visto) registrar('ativação ouviu: ' + j.visto.map((w) => w[0] + ' ' + w[1]).join(', '))
          } catch {}
        }
      })
      f.on('close', () => { if (filho === f) { filho = null; gramAtual = '' } res(false) })
      setTimeout(() => res(false), 120000)
    })
    f.stderr.on('data', () => {})
    f.stdin.on('error', () => {})
    const r = await pronto
    if (!r) { fechar(); return { ok: false, erro: 'o reconhecedor nativo não abriu' } }
    registrar('ativação nativa escutando (pid ' + f.pid + ')')
    return { ok: true }
  }

  // pedaço de áudio com voz: Int16 mono 16 kHz
  function audio(buf) {
    if (!filho || !buf) return false
    try { filho.stdin.write(Buffer.from(buf.buffer ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : buf)) } catch { return false }
    return true
  }

  return { abrir, fechar, audio, estado: () => ({ vivo: !!filho, pid: filho && filho.pid, falhou }) }
}

module.exports = { criar }
