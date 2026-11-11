// Partida direta do Hermes (Spec 26 §3-C). O comando `hermes-acp` é um lançador: sobe um Python, carrega o gerenciador de pacotes do Hermes,
// confere o ambiente e só então roda o agente. Medido em 11/11/2026 neste PC: o lançador sozinho gasta ~8 s; o `initialize` cai de ~12 s para ~4,5 s
// chamando o Python do ambiente direto (`python -m acp_adapter`). O lançador só injeta duas coisas no ambiente: o PATH das ferramentas dele (node, git,
// ripgrep, ffmpeg...) e PLAYWRIGHT_BROWSERS_PATH; isso sai de `hermes pm env` e fica guardado num arquivo da pasta do agente.
// Segurança: só vale depois de o ambiente estar montado e de uma partida pelo lançador ter dado certo; a chave do cache inclui o executável e o facts.json
// do ambiente (mudou a versão ou o ambiente, volta ao lançador e refaz). Qualquer falha na partida direta faz a sessão voltar ao lançador na hora.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execFile } = require('child_process')

const ARQ = 'sb-partida-direta.json'
const win = process.platform === 'win32'

function factsDoAmbiente(home) {
  const raiz = path.join(home, 'installs')
  let dirs = []
  try {
    dirs = fs.readdirSync(raiz).map((d) => path.join(raiz, d, 'facts.json')).filter((f) => fs.existsSync(f))
  } catch {}
  if (dirs.length !== 1) return null // nenhum ou mais de um ambiente: deixa o lançador decidir
  return dirs[0]
}

function assinatura(home, bin) {
  const facts = factsDoAmbiente(home)
  if (!facts) return null
  try {
    const h = crypto.createHash('sha256')
    h.update(bin)
    const s = fs.statSync(bin)
    h.update(String(s.size) + ':' + String(s.mtimeMs))
    h.update(fs.readFileSync(facts))
    return h.digest('hex').slice(0, 32)
  } catch {
    return null
  }
}

function pythonDoAmbiente(home) {
  const facts = factsDoAmbiente(home)
  if (!facts) return null
  try {
    const j = JSON.parse(fs.readFileSync(facts, 'utf8'))
    const amb = j?.packages?.venv?.environment
    if (!amb) return null
    const py = win ? path.join(amb, 'Scripts', 'python.exe') : path.join(amb, 'bin', 'python')
    return fs.existsSync(py) ? { py, venv: amb } : null
  } catch {
    return null
  }
}

// Devolve { cmd, args, env } para subir o agente sem o lançador, ou null (usar o lançador).
function resolver(home, bin, envBase) {
  if (process.env.SB_PARTIDA_DIRETA === '0') return null
  try {
    const c = JSON.parse(fs.readFileSync(path.join(home, ARQ), 'utf8'))
    const ass = assinatura(home, bin)
    if (!ass || c.assinatura !== ass || !c.python || !fs.existsSync(c.python)) return null
    const sep = win ? ';' : ':'
    const chavePath = Object.keys(envBase).find((k) => k.toUpperCase() === 'PATH') || 'PATH'
    const extras = [...(c.path || []), path.dirname(c.python), path.dirname(bin)]
    const env = { ...envBase, [chavePath]: extras.join(sep) + sep + (envBase[chavePath] || '') }
    for (const [k, v] of Object.entries(c.env || {})) env[k] = v
    return { cmd: c.python, args: ['-m', 'acp_adapter'], env }
  } catch {
    return null
  }
}

// Monta o cache (uma vez por versão/ambiente), em segundo plano, depois de uma partida bem-sucedida pelo lançador.
const emAndamento = new Set()
function preparar(home, bin, envBase, registrar = () => {}) {
  if (process.env.SB_PARTIDA_DIRETA === '0') return Promise.resolve(false)
  const ass = assinatura(home, bin)
  if (!ass || emAndamento.has(home)) return Promise.resolve(false)
  try {
    const c = JSON.parse(fs.readFileSync(path.join(home, ARQ), 'utf8'))
    if (c.assinatura === ass) return Promise.resolve(true)
  } catch {}
  const amb = pythonDoAmbiente(home)
  if (!amb) return Promise.resolve(false)
  const hermes = path.join(path.dirname(bin), win ? 'hermes.exe' : 'hermes')
  if (!fs.existsSync(hermes)) return Promise.resolve(false)
  emAndamento.add(home)
  return new Promise((resolve) => {
    execFile(hermes, ['pm', 'env'], { env: envBase, windowsHide: true, timeout: 120000, maxBuffer: 4 * 1024 * 1024 }, (erro, saida) => {
      emAndamento.delete(home)
      if (erro) {
        registrar('partida direta: pm env falhou (' + String(erro.message || erro).slice(0, 120) + '); segue pelo lançador')
        return resolve(false)
      }
      try {
        const j = JSON.parse(String(saida).trim())
        const sep = win ? ';' : ':'
        const chavePath = Object.keys(j).find((k) => k.toUpperCase() === 'PATH')
        const env = {}
        for (const [k, v] of Object.entries(j)) if (k !== chavePath && typeof v === 'string') env[k] = v
        const dados = { assinatura: ass, python: amb.py, path: chavePath ? String(j[chavePath]).split(sep).filter(Boolean) : [], env, criado: new Date().toISOString() }
        fs.writeFileSync(path.join(home, ARQ), JSON.stringify(dados, null, 2))
        registrar('partida direta preparada (próximas sessões sobem sem o lançador)')
        resolve(true)
      } catch (e) {
        registrar('partida direta: resposta do pm env inválida; segue pelo lançador')
        resolve(false)
      }
    })
  })
}

function invalidar(home) {
  try {
    fs.rmSync(path.join(home, ARQ), { force: true })
  } catch {}
}

module.exports = { resolver, preparar, invalidar, assinatura, pythonDoAmbiente, ARQ }
