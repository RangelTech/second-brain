// Suíte de escritório integrada (spec 37): documentos, planilhas e apresentações que o agente gera abrem num editor completo
// com um clique ("Abrir no editor"). Motor: ONLYOFFICE Desktop Editors (AGPL-3.0, grátis), na versão PORTÁTIL (sem admin, sem
// instalador do Windows), baixada do snapshot NOSSO (RangelTech/segundo-cerebro-artefatos, release escritorio-v1) e conferida
// por sha256; a origem oficial só se a nossa falhar. Se o usuário já tem o ONLYOFFICE instalado, usa o dele.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawn, spawnSync } = require('child_process')

const VERSAO = 'v10.0.0'
const NOSSA = 'https://github.com/RangelTech/segundo-cerebro-artefatos/releases/download/escritorio-v1/'
const ORIGEM = `https://github.com/ONLYOFFICE/DesktopEditors/releases/download/${VERSAO}/`
const PACOTES = {
  'win32-x64': { arq: 'DesktopEditors_x64.zip', sha: '54979d04f1cdca56deb0c62e0356355a45f392cdb54f04f6b7e436b1f44c3605', exe: 'DesktopEditors.exe', mb: 379 },
  'linux-x64': { arq: 'onlyoffice-desktopeditors-x64.tar.xz', sha: 'b44158be6499c6fb3813b5904d000f72ef4d93c0e8f6ea6696501e575995da9a', exe: 'DesktopEditors', mb: 272 },
}
const EXT = /\.(docx?|docm|xlsx?|xlsm|pptx?|ppsx|odt|ods|odp|csv|rtf)$/i
const ehDoEscritorio = (p) => EXT.test(String(p || ''))

const pasta = (app) => path.join(app.getPath('userData'), 'escritorio')
const pacote = () => PACOTES[`${process.platform}-${process.arch}`] || null

function doSistema() {
  const c =
    process.platform === 'win32'
      ? [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs')]
          .filter(Boolean)
          .map((b) => path.join(b, 'ONLYOFFICE', 'DesktopEditors', 'DesktopEditors.exe'))
      : process.platform === 'darwin'
        ? ['/Applications/ONLYOFFICE.app/Contents/MacOS/ONLYOFFICE']
        : ['/opt/onlyoffice/desktopeditors/DesktopEditors', '/usr/bin/onlyoffice-desktopeditors']
  return c.find((x) => fs.existsSync(x)) || null
}

// o executável dentro da pasta portátil (o pacote do Linux vem com uma subpasta; procura até 4 níveis)
function achar(dir, nome, nivel = 0) {
  if (nivel > 4 || !fs.existsSync(dir)) return null
  const direto = path.join(dir, nome)
  if (fs.existsSync(direto) && fs.statSync(direto).isFile()) return direto
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue
    const r = achar(path.join(dir, d.name), nome, nivel + 1)
    if (r) return r
  }
  return null
}

function executavel(app) {
  const p = pacote()
  const portatil = p && fs.existsSync(path.join(pasta(app), '.pronto')) ? achar(path.join(pasta(app), 'app'), p.exe) : null
  return portatil || doSistema()
}

function estado(app) {
  const p = pacote()
  return { instalado: !!executavel(app), suportado: !!p || !!doSistema(), tamanhoMb: p ? p.mb : 0, versao: VERSAO }
}

async function baixar(urls, destino, sha, progresso) {
  for (const url of urls) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(30 * 60 * 1000) })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const total = Number(r.headers.get('content-length')) || 0
      const h = crypto.createHash('sha256')
      const tmp = destino + '.parcial'
      const out = fs.createWriteStream(tmp)
      let feito = 0
      let ultimo = 0
      for await (const bloco of r.body) {
        h.update(bloco)
        feito += bloco.length
        if (!out.write(bloco)) await new Promise((ok) => out.once('drain', ok))
        const pct = total ? Math.floor((feito / total) * 100) : 0
        if (pct !== ultimo) progresso?.({ fase: 'baixando', pct }), (ultimo = pct)
      }
      await new Promise((ok, erro) => out.end((e) => (e ? erro(e) : ok())))
      if (h.digest('hex') !== sha) {
        fs.rmSync(tmp, { force: true })
        throw new Error('sha256 não confere')
      }
      fs.renameSync(tmp, destino)
      return
    } catch (e) {
      console.warn('[escritorio] falhou em', url, e.message)
    }
  }
  throw new Error('Não consegui baixar o editor de documentos. Confira a internet e tente de novo.')
}

let instalando = null
function instalar(app, progresso) {
  if (executavel(app)) return Promise.resolve({ ok: true })
  if (instalando) return instalando
  instalando = (async () => {
    const p = pacote()
    if (!p) throw new Error('O editor de documentos ainda não tem versão para este sistema. O arquivo abre no programa padrão do computador.')
    const raiz = pasta(app)
    fs.mkdirSync(raiz, { recursive: true })
    const arq = path.join(raiz, p.arq)
    await baixar([NOSSA + p.arq, ORIGEM + p.arq], arq, p.sha, progresso)
    progresso?.({ fase: 'abrindo o pacote', pct: 100 })
    const destino = path.join(raiz, 'app')
    fs.rmSync(destino, { recursive: true, force: true })
    fs.mkdirSync(destino, { recursive: true })
    // tar abre .zip no Windows 10+ (bsdtar) e .tar.xz no Linux: sem dependência extra
    const tarExe = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar'
    const r = spawnSync(tarExe, ['-xf', arq, '-C', destino], { windowsHide: true })
    if (r.status !== 0) throw new Error('Não consegui abrir o pacote do editor: ' + String(r.stderr || '').slice(-200))
    fs.rmSync(arq, { force: true })
    if (!achar(destino, p.exe)) throw new Error('O pacote do editor veio incompleto.')
    fs.writeFileSync(path.join(raiz, '.pronto'), VERSAO)
    return { ok: true }
  })().finally(() => (instalando = null))
  return instalando
}

function abrir(app, arquivo) {
  const exe = executavel(app)
  if (!exe) throw new Error('O editor de documentos não está instalado.')
  if (!fs.existsSync(arquivo)) throw new Error('Arquivo não encontrado: ' + arquivo)
  const filho = spawn(exe, [arquivo], { detached: true, stdio: 'ignore', windowsHide: false, cwd: path.dirname(exe) })
  filho.unref()
  return { ok: true }
}

module.exports = { estado, instalar, abrir, ehDoEscritorio, executavel, PACOTES, VERSAO }
