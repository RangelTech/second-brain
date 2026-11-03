// Skills do agente: árvore, edição, histórico (git local) e observação em tempo real.
// A pasta é <HERMES_HOME>/skills; as skills globais da Rangel Tech (rangeltech/) são somente leitura.
const { shell } = require('electron')
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const SOMENTE_LEITURA = ['rangeltech']
const IGNORAR = new Set(['.git', '.hub', '.archive', 'node_modules', '__pycache__'])

function criar({ app, avisar }) {
  const home = path.join(app.getPath('userData'), 'hermes-home')
  const raiz = path.join(home, 'skills')
  const diarioArq = path.join(app.getPath('userData'), 'skills-diario.json')
  const escritasDoApp = new Map() // rel -> instante da última gravação feita por aqui
  let diario = {}
  try {
    diario = JSON.parse(fs.readFileSync(diarioArq, 'utf8'))
  } catch {}
  const salvarDiario = () => fs.writeFileSync(diarioArq, JSON.stringify(diario, null, 1))

  const abs = (rel) => {
    const p = path.resolve(raiz, rel || '.')
    if (p !== raiz && !p.startsWith(raiz + path.sep)) throw new Error('Caminho fora da pasta de skills')
    return p
  }
  const somenteLeitura = (rel) => SOMENTE_LEITURA.includes(String(rel).split(/[\\/]/)[0])
  const rel = (p) => path.relative(raiz, p).split(path.sep).join('/')

  function git(...args) {
    try {
      return execFileSync('git', ['-C', raiz, '-c', 'user.name=Second Brain', '-c', 'user.email=skills@secondbrain.local', ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] })
    } catch {
      return null
    }
  }
  function iniciarGit() {
    fs.mkdirSync(raiz, { recursive: true })
    if (!fs.existsSync(path.join(raiz, '.git')) && git('--version') !== null) {
      git('init', '-q')
      fs.writeFileSync(path.join(raiz, '.gitignore'), 'rangeltech/\n')
      git('add', '-A')
      git('commit', '-q', '-m', 'estado inicial das skills')
    }
  }
  const registrar = (relativo, mensagem) => {
    git('add', '-A')
    git('commit', '-q', '-m', mensagem + ': ' + relativo)
  }

  function listar() {
    const saida = []
    const andar = (dir) => {
      let itens = []
      try {
        itens = fs.readdirSync(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const it of itens) {
        if (IGNORAR.has(it.name) || it.name.startsWith('.')) continue
        const p = path.join(dir, it.name)
        const r = rel(p)
        if (it.isDirectory()) {
          saida.push({ caminho: r, tipo: 'dir', somenteLeitura: somenteLeitura(r) })
          andar(p)
        } else {
          const st = fs.statSync(p)
          const d = diario[r]
          saida.push({ caminho: r, tipo: 'arquivo', tamanho: st.size, mtime: st.mtimeMs, somenteLeitura: somenteLeitura(r), nova: !!d && Date.now() - d.quando < 86400000, origem: d?.origem || null })
        }
      }
    }
    andar(raiz)
    return saida
  }

  function observar() {
    iniciarGit()
    let temporizador = null
    try {
      fs.watch(raiz, { recursive: true }, (_ev, nome) => {
        if (!nome) return
        const r = String(nome).split(path.sep).join('/')
        if (r.startsWith('.git') || r.includes('/.git')) return
        const foiApp = Date.now() - (escritasDoApp.get(r) || 0) < 3000
        if (!foiApp && fs.existsSync(path.join(raiz, r)) && fs.statSync(path.join(raiz, r)).isFile() && !somenteLeitura(r)) {
          diario[r] = { quando: Date.now(), origem: 'agente' }
          salvarDiario()
          clearTimeout(temporizador)
          temporizador = setTimeout(() => registrar(r, 'alteração do agente'), 1500)
        }
        avisar({ caminho: r })
      })
    } catch {}
  }

  return {
    raiz,
    observar,
    listar,
    ler(r) {
      return fs.readFileSync(abs(r), 'utf8')
    },
    gravar(r, conteudo) {
      if (somenteLeitura(r)) throw new Error('Skill global: somente leitura. Copie para as suas skills para editar.')
      const p = abs(r)
      fs.mkdirSync(path.dirname(p), { recursive: true })
      escritasDoApp.set(r, Date.now())
      fs.writeFileSync(p, conteudo)
      diario[r] = { ...(diario[r] || {}), quando: diario[r]?.quando || Date.now(), origem: diario[r]?.origem || 'usuario' }
      salvarDiario()
      registrar(r, 'edição')
      return true
    },
    // grava vários arquivos de uma vez (importação) com um único commit; ignora os iguais e os somente leitura
    gravarLote(mapa) {
      let n = 0
      for (const [r, conteudo] of Object.entries(mapa)) {
        if (somenteLeitura(r)) continue
        const p = abs(r)
        try {
          if (fs.existsSync(p) && fs.readFileSync(p, 'utf8') === conteudo) continue
        } catch {}
        fs.mkdirSync(path.dirname(p), { recursive: true })
        escritasDoApp.set(r, Date.now())
        fs.writeFileSync(p, conteudo)
        n++
      }
      if (n) registrar(`${n} arquivos`, 'importação')
      return n
    },
    criar(nome, categoria) {
      const slug = String(nome).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      if (!slug) throw new Error('Dê um nome para a skill.')
      const cat = String(categoria || 'minhas').toLowerCase().replace(/[^a-z0-9-]+/g, '-')
      if (somenteLeitura(cat)) throw new Error('A categoria rangeltech é somente leitura.')
      const r = `${cat}/${slug}/SKILL.md`
      if (fs.existsSync(abs(r))) throw new Error('Já existe uma skill com esse nome.')
      const modelo = `---\nname: ${slug}\ndescription: Descreva em uma frase quando o agente deve usar esta skill.\n---\n\n# ${nome}\n\nEscreva aqui o passo a passo que o agente deve seguir.\n`
      this.gravar(r, modelo)
      return r
    },
    async apagar(r) {
      if (somenteLeitura(r)) throw new Error('Skill global: somente leitura.')
      await shell.trashItem(abs(r))
      registrar(r, 'apagada')
      return true
    },
    renomear(r, novo) {
      if (somenteLeitura(r)) throw new Error('Skill global: somente leitura.')
      const destino = path.join(path.dirname(abs(r)), String(novo).replace(/[\\/:*?"<>|]/g, '_'))
      escritasDoApp.set(rel(destino), Date.now())
      fs.renameSync(abs(r), destino)
      registrar(rel(destino), 'renomeada')
      return rel(destino)
    },
    copiarParaMinhas(r) {
      const origem = abs(r)
      const alvo = path.join(raiz, 'minhas', path.relative(path.join(raiz, r.split('/')[0]), origem))
      fs.mkdirSync(path.dirname(alvo), { recursive: true })
      fs.cpSync(origem, alvo, { recursive: true })
      registrar(rel(alvo), 'cópia')
      return rel(alvo)
    },
    buscar(texto) {
      const q = String(texto).toLowerCase()
      const achados = []
      for (const it of listar()) {
        if (it.tipo !== 'arquivo' || it.tamanho > 400000) continue
        let linhas
        try {
          linhas = fs.readFileSync(abs(it.caminho), 'utf8').split('\n')
        } catch {
          continue
        }
        const i = linhas.findIndex((l) => l.toLowerCase().includes(q))
        if (i >= 0) achados.push({ caminho: it.caminho, linha: i + 1, trecho: linhas[i].trim().slice(0, 160) })
        if (achados.length >= 60) break
      }
      return achados
    },
    historico(r) {
      const t = git('log', '--pretty=format:%h|%cI|%s', '-n', '30', '--', r)
      return (t || '').split('\n').filter(Boolean).map((l) => {
        const [hash, quando, ...msg] = l.split('|')
        return { hash, quando, mensagem: msg.join('|') }
      })
    },
    versao(r, hash) {
      return git('show', `${hash}:${r}`)
    },
  }
}

module.exports = { criar }
