// Vincula a pasta de skills a um repositório GitHub para versionar e compartilhar entre computadores.
// A pasta já é um repositório git local (skills.js). Aqui entram o remoto, o token e a sincronização.
// O token fica cifrado (safeStorage) fora do .git e só vai ao git por um cabeçalho de cada comando.
const { safeStorage } = require('electron')
const fs = require('fs')
const path = require('path')
const { execFile } = require('child_process')

const PADROES_SEGREDO = [
  /ghp_[A-Za-z0-9]{30,}/, /github_pat_[A-Za-z0-9_]{30,}/, /sk-[A-Za-z0-9_-]{24,}/, /AKIA[0-9A-Z]{16}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /xox[baprs]-[A-Za-z0-9-]{20,}/, /AIza[0-9A-Za-z_-]{35}/,
]

// Login com GitHub pelo "device flow": o app só precisa do client_id (público, sem segredo) de um OAuth App da Rangel Tech
// com "Enable Device Flow" ligado. Pode ser trocado por SB_GITHUB_CLIENT_ID.
const CLIENT_ID = process.env.SB_GITHUB_CLIENT_ID || 'Ov23liyEazvZL9lxJk44' // OAuth App 'Segundo Cérebro' da organização RangelTech (Device Flow ligado)

function criar({ app, raiz, abrirNavegador }) {
  const arqCfg = path.join(app.getPath('userData'), 'skills-repo.json')
  const arqTok = path.join(app.getPath('userData'), 'skills-repo-token.bin')
  const ler = () => {
    try {
      return JSON.parse(fs.readFileSync(arqCfg, 'utf8'))
    } catch {
      return {}
    }
  }
  const gravarCfg = (c) => fs.writeFileSync(arqCfg, JSON.stringify(c, null, 1))
  const token = () => {
    try {
      const b = fs.readFileSync(arqTok)
      return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(b) : b.toString('utf8')
    } catch {
      return ''
    }
  }
  const guardarToken = (t) => fs.writeFileSync(arqTok, safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(t) : Buffer.from(t, 'utf8'))

  function git(args, comToken) {
    const pre = ['-C', raiz, '-c', 'user.name=Segundo Cérebro', '-c', 'user.email=skills@secondbrain.local']
    const t = comToken ? token() : ''
    if (t) pre.push('-c', 'http.extraHeader=Authorization: Basic ' + Buffer.from('x-access-token:' + t).toString('base64'))
    return new Promise((resolve) => {
      execFile('git', [...pre, ...args], { encoding: 'utf8', windowsHide: true, timeout: 90000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, maxBuffer: 16 * 1024 * 1024 }, (erro, out, err) => {
        const msg = String(err || '').replace(/Authorization: Basic \S+/g, 'Authorization: ***').trim()
        resolve({ ok: !erro, out: String(out || '').trim(), err: msg || (erro ? String(erro.message) : '') })
      })
    })
  }
  const limparUrl = (u) => {
    let s = String(u || '').trim().replace(/\.git$/, '')
    const m = s.match(/^(?:https:\/\/github\.com\/|git@github\.com:)?([\w.-]+\/[\w.-]+)$/)
    if (!m) throw new Error('Informe o repositório como https://github.com/dono/nome (ou dono/nome).')
    return `https://github.com/${m[1]}.git`
  }
  const amigavel = (e) => {
    if (/Authentication failed|could not read Username|403|401/i.test(e)) return 'O GitHub recusou o acesso. Confira o token (precisa de permissão de leitura e escrita no conteúdo do repositório).'
    if (/not found|404|does not appear to be a git repository/i.test(e)) return 'Repositório não encontrado. Confira o endereço e se o token tem acesso a ele.'
    return e || 'Falhou.'
  }

  async function segredosNoRepo() {
    const l = await git(['ls-files'])
    const achados = []
    for (const f of l.out.split('\n').filter(Boolean)) {
      let txt
      try {
        const p = path.join(raiz, f)
        if (fs.statSync(p).size > 400000) continue
        txt = fs.readFileSync(p, 'utf8')
      } catch {
        continue
      }
      if (PADROES_SEGREDO.some((r) => r.test(txt))) achados.push(f)
      if (achados.length >= 10) break
    }
    return achados
  }

  async function estado() {
    const c = ler()
    if (!c.url) return { vinculado: false }
    const e = { vinculado: true, url: c.url, ultimaSync: c.ultimaSync || null, branch: c.branch || 'main', adiante: 0, atras: 0, alterado: false }
    const st = await git(['status', '--porcelain'])
    e.alterado = !!st.out
    const cont = await git(['rev-list', '--left-right', '--count', `HEAD...origin/${e.branch}`])
    if (cont.ok) {
      const [a, b] = cont.out.split(/\s+/).map(Number)
      e.adiante = a || 0
      e.atras = b || 0
    }
    return e
  }

  async function vincular(urlBruta, tok) {
    const url = limparUrl(urlBruta)
    if (tok) guardarToken(String(tok).trim())
    if (!token()) throw new Error('Informe um token do GitHub (Settings > Developer settings > Personal access tokens).')
    const t = await git(['ls-remote', '--symref', url, 'HEAD'], true)
    if (!t.ok) throw new Error(amigavel(t.err))
    const m = t.out.match(/ref: refs\/heads\/(\S+)\s+HEAD/)
    const branch = m ? m[1] : 'main'
    // arquivos internos do Hermes (travas, manifestos, estado do curador) não vão para o repositório
    const ign = path.join(raiz, '.gitignore')
    let atual = ''
    try {
      atual = fs.readFileSync(ign, 'utf8')
    } catch {}
    if (!atual.includes('.*')) {
      fs.writeFileSync(ign, atual.replace(/\n*$/, '\n') + '.*\n!.gitignore\n')
      await git(['rm', '-r', '-q', '--cached', '--ignore-unmatch', '.'])
      await git(['add', '-A'])
      await git(['commit', '-q', '-m', 'ignora arquivos internos do Hermes'])
    }
    const tem = await git(['remote'])
    await git(tem.out.split('\n').includes('origin') ? ['remote', 'set-url', 'origin', url] : ['remote', 'add', 'origin', url])
    await git(['branch', '-M', branch])
    gravarCfg({ url, branch, vinculadoEm: Date.now(), vazio: !t.out })
    return estado()
  }

  async function desvincular() {
    await git(['remote', 'remove', 'origin'])
    try {
      fs.unlinkSync(arqCfg)
      fs.unlinkSync(arqTok)
    } catch {}
    return { vinculado: false }
  }

  // estrategia: undefined (tenta mesclar e avisa se houver conflito) | 'minha' | 'remota' (resolve conflitos de uma vez)
  async function sincronizar({ estrategia, confirmarSegredos } = {}) {
    const c = ler()
    if (!c.url) throw new Error('Vincule um repositório primeiro.')
    const branch = c.branch || 'main'
    await git(['add', '-A'])
    await git(['commit', '-q', '-m', 'alterações pendentes antes de sincronizar'])
    const f = await git(['fetch', 'origin'], true)
    if (!f.ok) throw new Error(amigavel(f.err))
    const remoto = await git(['rev-parse', '--verify', '-q', `origin/${branch}`])
    if (remoto.ok) {
      const args = ['merge', '--no-edit', '--allow-unrelated-histories']
      if (estrategia === 'minha') args.push('-X', 'ours')
      if (estrategia === 'remota') args.push('-X', 'theirs')
      args.push(`origin/${branch}`)
      const m = await git(args)
      if (!m.ok) {
        const conf = await git(['diff', '--name-only', '--diff-filter=U'])
        await git(['merge', '--abort'])
        const lista = conf.out.split('\n').filter(Boolean)
        if (lista.length) return { conflito: lista }
        throw new Error(m.err || 'Não consegui mesclar.')
      }
    }
    const segredos = await segredosNoRepo()
    if (segredos.length && !confirmarSegredos) return { segredos }
    const p = await git(['push', '-u', 'origin', `HEAD:${branch}`], true)
    if (!p.ok) throw new Error(amigavel(p.err))
    c.ultimaSync = Date.now()
    gravarCfg(c)
    return { ok: true, estado: await estado() }
  }

  const gh = async (url, corpo, tok) => {
    const r = await fetch(url, { method: corpo ? 'POST' : 'GET', headers: { Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'segundo-cerebro', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined })
    return { status: r.status, json: await r.json().catch(() => ({})) }
  }

  async function loginIniciar() {
    if (!CLIENT_ID) throw new Error('O login com GitHub ainda não foi configurado nesta versão. Use um token por enquanto.')
    const r = await gh('https://github.com/login/device/code', { client_id: CLIENT_ID, scope: 'repo' })
    if (!r.json.device_code) throw new Error(r.json.error_description || 'O GitHub não respondeu ao pedido de login.')
    abrirNavegador?.(r.json.verification_uri)
    return { codigo: r.json.user_code, url: r.json.verification_uri, deviceCode: r.json.device_code, intervalo: r.json.interval || 5, expira: r.json.expires_in || 900 }
  }

  async function loginAguardar({ deviceCode, intervalo, expira }) {
    const fim = Date.now() + expira * 1000
    let espera = intervalo
    while (Date.now() < fim) {
      await new Promise((r) => setTimeout(r, espera * 1000))
      const r = await gh('https://github.com/login/oauth/access_token', { client_id: CLIENT_ID, device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' })
      if (r.json.access_token) {
        guardarToken(r.json.access_token)
        const u = await gh('https://api.github.com/user', null, r.json.access_token)
        return { usuario: u.json.login || '' }
      }
      if (r.json.error === 'slow_down') espera += 5
      else if (r.json.error && r.json.error !== 'authorization_pending') throw new Error(r.json.error === 'access_denied' ? 'Login cancelado no GitHub.' : r.json.error_description || r.json.error)
    }
    throw new Error('O código expirou. Tente de novo.')
  }

  // com o token já salvo: acha ou cria o repositório privado das skills e vincula
  async function criarRepositorio(nome = 'segundo-cerebro-skills') {
    const tok = token()
    if (!tok) throw new Error('Entre com o GitHub primeiro.')
    const u = await gh('https://api.github.com/user', null, tok)
    if (!u.json.login) throw new Error('O token não funcionou. Entre de novo com o GitHub.')
    const r = await gh('https://api.github.com/user/repos', { name: nome, private: true, description: 'Skills do Segundo Cérebro' }, tok)
    if (r.status !== 201 && r.status !== 422) throw new Error(r.json.message || 'Não consegui criar o repositório.')
    return vincular(`${u.json.login}/${nome}`)
  }

  return { estado, vincular, desvincular, sincronizar, loginIniciar, loginAguardar, criarRepositorio, loginDisponivel: () => !!CLIENT_ID }
}

module.exports = { criar }
