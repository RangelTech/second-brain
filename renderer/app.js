(() => {
  const $ = (id) => document.getElementById(id)
  const IC = window.IC
  let cfg = null
  let chats = []
  let atual = null
  const respostas = new Map() // id do chat -> resposta em curso (várias conversas respondem ao mesmo tempo)
  let relogio = null
  const fila = new Map() // id do chat -> mensagens esperando a resposta atual terminar
  const MAX_RETOMADAS = 2
  // Único controle por tempo: o modelo ficar 5 min sem dar NENHUM sinal (nem o primeiro token, nem qualquer evento depois). A atividade
  // em si (muitas chamadas, ferramentas longas, horas de trabalho) nunca é interrompida por demorar.
  const LIMITE_SEM_SINAL_MS = 300000
  // "Executando ferramenta" é isento do vigia de cima (ações longas de verdade existem), mas não pode ser isento pra
  // sempre: sem este teto, um stream que morre bem na hora de uma ferramenta ficava sem nenhum vigia nosso (só o do
  // Hermes, de 15 min, entrava em ação). A ponte (ponte-llm.js) já corta sozinha boa parte desses casos antes disso.
  const LIMITE_FERRAMENTA_MS = 600000 // menor que o vigia de 15 min do Hermes: o nosso age primeiro
  let anexosPendentes = [] // {nome, caminho, tipo}
  let gravador = null
  let modelos = []

  // na versão web o arquivo gerado fica no computador (ou na VM) do cliente: "abrir" vira baixar pelo navegador
  const ehWeb = !!window.__sbWeb
  async function baixarArquivo(caminho, el) {
    const nome = String(caminho).split(/[\\/]/).pop() || 'arquivo'
    const antes = el && el.innerHTML
    if (el) el.textContent = 'Preparando…'
    try {
      const r = await window.sb.lerArquivo(caminho)
      if (!r || !r.ok) throw new Error('nao-achei')
      const bin = atob(r.base64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const url = URL.createObjectURL(new Blob([bytes]))
      const a = document.createElement('a')
      a.href = url
      a.download = nome
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch {
      aviso('Não consegui baixar este arquivo agora. Tente de novo em instantes.')
    } finally {
      if (el) el.innerHTML = antes
    }
  }
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const attr = (s) => esc(s).replace(/'/g, '&#39;')
  const CAT = Object.fromEntries(((window.SB_CATALOGO && window.SB_CATALOGO.provedores) || []).map((p) => [p.id, p]))

  // caminho completo de um arquivo gerado pelo agente (C:\...\a.xlsx ou /home/.../a.pdf): vira link (abre no app, baixa na web)
  const EXT_ARQ = 'xlsx?|xlsm|docx?|pptx?|pdf|csv|zip|txt|md|json|png|jpe?g|gif|webp|svg|mp3|wav|mp4|mov|html?'
  const CAMINHO_ARQ = new RegExp('(?:[A-Za-z]:\\\\[^<>"\'`|*?\\n]{1,180}?|(?<![\\w:./-])/(?:home|root|var|opt|tmp|Users|srv|mnt)/[^<>"\'`|*?\\n]{1,180}?)\\.(?:' + EXT_ARQ + ')(?![\\w])', 'gi')
  // markdown mínimo: blocos de código, código em linha, negrito, títulos, listas, links http(s)
  function md(t) {
    return String(t)
      .replace(/^\s+|\s+$/g, '')
      .split(/```/)
      .map((p, i) => {
        if (i % 2 === 1) return '<pre><code>' + esc(p.replace(/^\w*\n/, '')) + '</code></pre>'
        const linhas = esc(p).split('\n')
        const saida = []
        let lista = false
        const ehLinhaTab = (x) => /^\s*\|.*\|\s*$/.test(x)
        const ehSeparador = (x) => x.includes('|') && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(x)
        const celulas = (x) => x.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
        for (let k = 0; k < linhas.length; k++) {
          const l = linhas[k]
          // tabela: linha de cabeçalho + linha de separação (|---|---|) + linhas de dados
          if (ehLinhaTab(l) && k + 1 < linhas.length && ehSeparador(linhas[k + 1])) {
            if (lista) saida.push('</ul>'), (lista = false)
            const cab = celulas(l)
            let h = '<div class="tabela-md"><table><thead><tr>' + cab.map((c) => `<th>${c}</th>`).join('') + '</tr></thead><tbody>'
            k += 2
            while (k < linhas.length && ehLinhaTab(linhas[k])) {
              const cs = celulas(linhas[k])
              h += '<tr>' + cab.map((_, j) => `<td>${cs[j] ?? ''}</td>`).join('') + '</tr>'
              k++
            }
            k--
            saida.push(h + '</tbody></table></div>')
            continue
          }
          const li = /^\s*[-*]\s+(.*)$/.exec(l)
          if (li) {
            if (!lista) saida.push('<ul>'), (lista = true)
            saida.push('<li>' + li[1] + '</li>')
            continue
          }
          if (lista) saida.push('</ul>'), (lista = false)
          const h = /^(#{1,3})\s+(.*)$/.exec(l)
          saida.push(h ? `<h${h[1].length + 2}>${h[2]}</h${h[1].length + 2}>` : l.trim() === '' ? (saida.length && !/(<br>|<\/div>)$/.test(saida[saida.length - 1]) ? '<br>' : '') : l + '<br>')
        }
        if (lista) saida.push('</ul>')
        return saida
          .join('')
          .replace(CAMINHO_ARQ, (m) => `<a class="arq-link" href="#" data-arq="${m}">${m.split(/[\\/]/).pop()}</a>`)
          .replace(/`([^`\n]+)`/g, '<code>$1</code>')
          .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
          .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<)]+)/g, (m, rotulo, urlMd, urlSolta) => {
            if (urlMd) return `<a href="${urlMd}" rel="noreferrer">${rotulo}</a>`
            const pontuacao = /[.,;:!?]+$/.exec(urlSolta)
            const url = pontuacao ? urlSolta.slice(0, -pontuacao[0].length) : urlSolta
            return `<a href="${url}" rel="noreferrer">${url}</a>${pontuacao ? pontuacao[0] : ''}`
          })
      })
      .join('')
  }
  window.SBmd = md

  const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  // Conversas compartilhadas (app + web, ou várias pessoas no mesmo login): cada alteração leva o carimbo `mod`, as apagadas
  // viajam junto e o servidor junta tudo; o que os outros mudam chega por chats:mudou.
  const assinatura = new Map()
  const apagadasPend = new Set()
  const assinar = (c) => {
    const { mod, ...resto } = c
    return JSON.stringify(resto)
  }
  const salvar = () => {
    const agora = Date.now()
    for (const c of chats) {
      const a = assinar(c)
      if (assinatura.get(c.id) !== a) {
        c.mod = agora
        assinatura.set(c.id, a)
      }
    }
    const ap = [...apagadasPend]
    apagadasPend.clear()
    return window.sb.salvarChats(chats, ap)
  }
  const chatAtual = () => chats.find((c) => c.id === atual)
  const estreito = () => window.matchMedia('(max-width:820px)').matches

  // ---------- barra lateral ----------
  function recolher(sim) {
    $('app').classList.toggle('recolhido', sim)
  }

  // fixadas primeiro, depois as mais recentes
  const ordem = (a, b) => (b.fixado ? 1 : 0) - (a.fixado ? 1 : 0) || b.em - a.em

  function renomear(c, el) {
    const nome = el.querySelector('.nome')
    const inp = document.createElement('input')
    inp.className = 'renomear'
    inp.value = c.titulo
    inp.maxLength = 80
    nome.replaceWith(inp)
    inp.focus()
    inp.select()
    let feito = false
    const fechar = (salvarTitulo) => {
      if (feito) return
      feito = true
      const novo = inp.value.trim()
      if (salvarTitulo && novo) {
        c.titulo = novo
        c.tituloManual = true
        salvar()
      }
      listar()
      if (c.id === atual) $('titulo').textContent = c.titulo
    }
    inp.onkeydown = (e) => {
      e.stopPropagation()
      if (e.key === 'Enter') fechar(true)
      if (e.key === 'Escape') fechar(false)
    }
    inp.onblur = () => fechar(true)
    inp.onclick = (e) => e.stopPropagation()
  }

  function listar() {
    const q = $('busca').value.trim().toLowerCase()
    const el = $('lista')
    el.innerHTML = ''
    for (const c of chats.filter((c) => !q || c.titulo.toLowerCase().includes(q)).sort(ordem)) {
      const b = document.createElement('div')
      b.className = 'chat' + (c.id === atual ? ' ativo' : '') + (c.fixado ? ' fixado' : '')
      b.tabIndex = 0
      b.setAttribute('role', 'button')
      b.innerHTML = `${c.fixado ? `<span class="pin-marca">${IC.pin}</span>` : ''}${respostas.has(c.id) ? '<span class="ponto-vivo mini" title="Respondendo"></span>' : ''}<span class="nome" title="${attr(c.titulo)}">${esc(c.titulo)}</span><span class="acoes"><button class="btn-ic fixar" title="${c.fixado ? 'Desafixar' : 'Fixar no topo'}" aria-label="${c.fixado ? 'Desafixar conversa' : 'Fixar conversa'}">${IC.pin}</button><button class="btn-ic ren" title="Renomear" aria-label="Renomear conversa">${IC.pencil}</button><button class="apagar btn-ic" title="Apagar" aria-label="Apagar conversa">${IC.x}</button></span>`
      b.onclick = (e) => {
        if (e.target.closest('.fixar')) {
          c.fixado = !c.fixado
          salvar()
          listar()
          return
        }
        if (e.target.closest('.ren')) return renomear(c, b)
        if (e.target.closest('.apagar')) {
          if (c.msgs.length && !window.confirm('Apagar esta conversa?')) return
          chats = chats.filter((x) => x.id !== c.id)
          apagadasPend.add(c.id)
          if (atual === c.id) atual = null
          salvar()
          listar()
          desenhar()
          return
        }
        abrir(c.id)
        if (estreito()) recolher(true)
      }
      b.ondblclick = (e) => {
        if (!e.target.closest('.acoes')) renomear(c, b)
      }
      b.onkeydown = (e) => {
        if (e.key === 'Enter' && e.target === b) b.click()
        if (e.key === 'F2' && e.target === b) renomear(c, b)
      }
      el.appendChild(b)
    }
  }

  function abrir(id) {
    atual = id
    listar()
    desenhar()
    $('texto').focus()
  }
  function criarChat() {
    const c = { id: novoId(), titulo: 'Nova conversa', msgs: [], em: Date.now() }
    chats.push(c)
    salvar()
    abrir(c.id)
  }

  // ---------- desenho das mensagens ----------
  const ICONE_FERR = { read: 'file', edit: 'pencil', delete: 'trash', move: 'move', search: 'search', execute: 'terminal', think: 'sparkles', fetch: 'globe', other: 'sparkles' }
  const ROTULO_FERR = { read: 'Lendo', edit: 'Escrevendo', delete: 'Apagando', move: 'Movendo', search: 'Buscando', execute: 'Executando', think: 'Pensando', fetch: 'Acessando a web', other: 'Usando ferramenta' }
  const nomeArq = (p) => String(p || '').split(/[\\/]/).pop()
  // nome de ferramenta -> rótulo de gente; etapas internas do agente não aparecem
  const INTERNA = /^\s*(Reading tool details|Searching tools|Unnamed call)/i
  const ehMidia = (f) => /midia_gerar_(imagem|video)/.test((f && f.titulo) || '')
  const ROTULOS = [
    [/delegate|subagent|spawn|agente_/i, 'Chamando um agente auxiliar'], [/midia_gerar_video/, 'Gerando vídeo'], [/midia_gerar_imagem/, 'Gerando imagem'], [/memoria_/, 'Relembrando nas conversas'],
    [/navegador_|browser|web_?search|search_web/i, 'Pesquisando na web'], [/vision_analyze/, 'Olhando a imagem'],
    [/read_file|^read\b/i, 'Lendo arquivo'], [/write_file|patch|edit/i, 'Escrevendo arquivo'], [/terminal|execute|shell/i, 'Executando'],
  ]
  const rotuloFerr = (f) => { const t = (f && f.titulo) || ''; const r = ROTULOS.find(([re]) => re.test(t)); return r ? r[1] : (ROTULO_FERR[(f && f.tipo) || 'other'] || 'Trabalhando') }

  function cartaoFerramenta(f) {
    const d = document.createElement('div')
    d.dataset.id = f.id || ''
    atualizarCartao(d, f)
    return d
  }
  // "read_file: C:\pasta\a.txt" -> "a.txt"; "terminal: ls -la" -> "ls -la"
  function tituloLimpo(t) {
    let x = String(t || '').replace(/^[a-z_]+:\s*/i, '')
    if (/^[A-Za-z]:[\\/]/.test(x) || x.startsWith('/')) x = x.split(/[\\/]/).pop()
    return x.replace(/^[0-9a-z]{6,9}-(?=.+\.\w+$)/i, '')
  }
  // ---------- cartão de imagem e vídeo: na fila -> gerando (percentual) -> pronto, ou "não consegui" com tentar de novo ----------
  // O servidor de mídia (mcp-midia.js) grava o andamento em <pasta de trabalho>/.midia/<tipo>-<hash do prompt>.json
  // { status: queued|running|done|failed, position, eta_s, progress 0..100 }; aqui lemos de 1,5 em 1,5 s. Sem esse arquivo, o percentual é estimado.
  const jobsMidia = new Map() // id da ferramenta -> { t0, st, pct, timer }
  const hashMidia = (s) => {
    let h = 0x811c9dc5
    const t = String(s || '')
    for (let i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
    return h.toString(16).padStart(8, '0')
  }
  const arqAndamento = (tipo, prompt) => {
    const sep = String(cfg.pasta || '').includes('\\') ? '\\' : '/'
    return `${cfg.pasta}${sep}.midia${sep}${tipo}-${hashMidia(String(prompt || '').slice(0, 3500))}.json`
  }
  const utf8 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))
  function estadoMidia(j, video) {
    const seg = (Date.now() - j.t0) / 1000
    const st = j.st
    let status = st?.status
    if (!status) status = video && seg < 3 ? 'queued' : 'running'
    if (status === 'done') status = 'running' // o cartão vira o resultado quando a ferramenta termina
    const estimado = Math.max(1, Math.min(96, Math.round(100 * (1 - Math.exp(-seg / (video ? 70 : 5.5))))))
    const real = typeof st?.progress === 'number' && status === 'running' ? Math.max(1, Math.min(99, Math.round(st.progress))) : null
    return { status, alvo: status === 'queued' ? 0 : real ?? estimado, real: real != null, pos: st?.position ?? null, eta: st?.eta_s ?? null }
  }
  const textoEta = (s) => (s == null || s <= 0 ? '' : s >= 90 ? `cerca de ${Math.ceil(s / 60)} min` : `cerca de ${Math.max(5, Math.round(s / 5) * 5)} s`)
  function pintarMidia(d, j, video) {
    const e = estadoMidia(j, video)
    const objeto = video ? 'vídeo' : 'imagem'
    const tit = d.querySelector('.mc-tit')
    const sub = d.querySelector('.mc-sub')
    if (!tit || !d.querySelector('.img-pct')) return
    const novoTit = e.status === 'queued' ? `${video ? 'Seu vídeo está' : 'Sua imagem está'} na fila para ser ${video ? 'gerado' : 'gerada'}` : `Gerando ${video ? 'o seu vídeo' : 'a sua imagem'}...`
    if (tit.textContent !== novoTit) tit.textContent = novoTit // região "status": só anuncia quando a fase muda
    const partes = []
    if (e.status === 'queued') {
      partes.push(e.pos === 1 ? 'Você é o próximo' : e.pos > 1 ? `Você é o ${e.pos}º da fila` : 'Estamos organizando o seu pedido')
      if (textoEta(e.eta)) partes.push(`tempo estimado: ${textoEta(e.eta)}`)
    } else {
      partes.push(video ? 'Vídeos levam alguns minutos. Você pode continuar usando o app.' : 'Estamos criando a sua imagem.')
      if (textoEta(e.eta)) partes.push(`faltam ${textoEta(e.eta)}`)
    }
    sub.textContent = partes.join(' · ')
    d.dataset.fase = e.status
    // o número sobe suavemente e nunca volta
    j.pct = e.status === 'queued' ? 0 : Math.max(j.pct || 0, Math.min(e.alvo, (j.pct || 0) + Math.max(1, (e.alvo - (j.pct || 0)) * 0.35)))
    const pct = Math.round(j.pct)
    d.querySelector('.img-pct').textContent = e.status === 'queued' ? '···' : pct + '%'
    const barra = d.querySelector('.mc-barra')
    barra.setAttribute('aria-valuenow', String(pct))
    barra.firstElementChild.style.width = pct + '%'
  }
  function acompanharMidia(f, video, prompt) {
    let j = jobsMidia.get(f.id)
    if (j) return j
    j = { t0: Date.now(), st: null, pct: 0, fim: 0 }
    jobsMidia.set(f.id, j)
    const arq = arqAndamento(video ? 'video' : 'imagem', prompt)
    const ler = async () => {
      if (j.fim || Date.now() - j.t0 > 25 * 60 * 1000) return
      try {
        const r = await window.sb.lerArquivo(arq)
        if (r.ok) {
          const st = JSON.parse(utf8(r.base64))
          if (j.visto === undefined) j.visto = true && (j.velho = ['done', 'failed'].includes(st.status) ? st.t : null) // sobra de um pedido igual anterior: ignora até o servidor regravar
          if (!j.velho || st.t !== j.velho) j.st = st
        }
      } catch {
        /* sem arquivo: segue com a estimativa */
      }
      for (const d of document.querySelectorAll('.mc-ferr[data-id="' + CSS.escape(String(f.id)) + '"]')) pintarMidia(d, j, video)
      j.timer = setTimeout(ler, 1500)
    }
    ler()
    j.suave = setInterval(() => {
      if (j.fim) return clearInterval(j.suave)
      for (const d of document.querySelectorAll('.mc-ferr[data-id="' + CSS.escape(String(f.id)) + '"]')) pintarMidia(d, j, video)
    }, 400)
    return j
  }
  function criandoImagem(d, f) {
    const video = /midia_gerar_video/.test(f.titulo || '')
    const arg = (() => { try { return JSON.parse(f.entrada || '{}') } catch { return {} } })()
    const prox = video ? 'o vídeo' : 'a imagem'
    if (f.status === 'completed' || f.status === 'failed') {
      const j = jobsMidia.get(f.id)
      if (j) { j.fim = Date.now(); clearTimeout(j.timer) }
    }
    if (f.status === 'completed') {
      const m = (video ? /caminho:\s*(.+?\.mp4)/i : /caminho:\s*(.+?\.png)/i).exec(String(f.conteudo || ''))
      if (!m) {
        d.className = 'ferr img-ferr'
        d.hidden = true // etapa de apoio da ferramenta (sem o arquivo): o cartão que mostra o resultado é o outro
        return true
      }
      d.hidden = false
      d.className = 'ferr img-ferr mc-ferr pronto'
      d.innerHTML = `<div class="img-pronta"><div class="img-leg" role="status"><span class="mc-ok">${IC.check}</span>Pronto! ${video ? 'Seu vídeo' : 'Sua imagem'} está ${video ? 'pronto' : 'pronta'}.</div><div class="img-slot"></div></div>`
      const caminho = m[1]
      window.sb.lerArquivo(caminho).then((r) => {
        if (!r.ok) return
        // o tipo vem do CONTEÚDO do arquivo (assinatura), não só do nome: um vídeo nunca aparece como foto
        const ini = atob(r.base64.slice(0, 24))
        const ehVideo = /ftyp|webm|\x1aE\xdf\xa3/.test(ini.slice(0, 16)) || (video && !/^(\x89PNG|\xff\xd8|GIF8|RIFF)/.test(ini))
        const mime = ehVideo ? 'video/mp4' : /^\xff\xd8/.test(ini) ? 'image/jpeg' : 'image/png'
        const src = `data:${mime};base64,${r.base64}`
        const slot = d.querySelector('.img-slot')
        if (!slot) return
        const brief = [arg.prompt && 'Descrição: ' + arg.prompt, arg.negative_prompt && 'Evitar: ' + arg.negative_prompt, arg.formato && 'Formato: ' + arg.formato, arg.segundos && 'Duração: ' + arg.segundos + ' s', arg.qualidade && 'Qualidade: ' + arg.qualidade, arg.seed != null && 'Semente: ' + arg.seed].filter(Boolean).join('\n')
        slot.innerHTML = `${ehVideo ? `<video class="img-final" src="${src}" controls loop playsinline preload="metadata"></video>` : `<img class="img-final" src="${src}" alt="${attr(arg.prompt || 'Imagem gerada')}">`}<div class="facoes" style="padding:0"><a class="baixar" href="${src}" download="${attr(nomeArq(caminho))}">Baixar</a><button data-variacao="${ehVideo ? 'video' : 'imagem'}">Variação</button><button data-ajustar="${ehVideo ? 'video' : 'imagem'}">Refazer com ajuste</button><button data-abrir="${attr(caminho)}">Abrir</button><button data-mostrar="${attr(caminho)}">${IC.folder}Mostrar na pasta</button></div>${brief ? `<details class="briefing"><summary>Ver o briefing usado</summary><pre>${esc(brief)}</pre></details>` : ''}`
      })
      return true
    }
    if (f.status === 'failed') {
      d.hidden = false
      d.className = 'ferr img-ferr mc-ferr falha'
      d.innerHTML = `<div class="mc mc-falha"><div class="mc-tit" role="status">Não consegui gerar agora, tente de novo em instantes.</div><div class="mc-sub">Seu pedido não foi perdido: é só tentar de novo.</div><button type="button" class="mc-retry" data-tentar-midia="${video ? 'video' : 'imagem'}">Tentar de novo</button></div>`
      return true
    }
    d.hidden = false
    d.className = 'ferr img-ferr mc-ferr ' + (f.status || 'pending')
    const j = acompanharMidia(f, video, arg.prompt)
    const n = 9
    let pts = ''
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) pts += `<i style="--d:${(Math.hypot(x - n / 2, y - n / 2) * 0.16).toFixed(2)}s"></i>`
    d.innerHTML = `<div class="mc"><div class="mc-topo"><div class="img-grade" style="--n:${n}" aria-hidden="true">${pts}<span class="img-pct">1%</span></div><div class="mc-textos"><div class="mc-tit" role="status" aria-live="polite"></div><div class="mc-sub"></div></div></div><div class="mc-barra" role="progressbar" aria-label="Andamento d${prox}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div></div>`
    pintarMidia(d, j, video)
    return true
  }
  function atualizarCartao(d, f) {
    d.hidden = INTERNA.test(f.titulo || '') // etapa interna do agente, sem significado para quem usa
    if (d.hidden) return
    if (/midia_gerar_(imagem|video)/.test(f.titulo || '') && criandoImagem(d, f)) return
    const estado = f.status === 'completed' ? IC.check : f.status === 'failed' ? IC.x : '<span class="rodando"></span>'
    const tipo = f.tipo || 'other'
    let titulo = tituloLimpo(f.titulo)
    let rotulo = rotuloFerr(f)
    let icone = IC[ICONE_FERR[tipo]] || IC.sparkles
    // ferramentas próprias do app aparecem com nome de gente, não de função
    const arg = (() => { try { return JSON.parse(f.entrada || '{}') } catch { return {} } })()
    if (/memoria_(buscar|ler_conversa)/.test(f.titulo || '')) {
      rotulo = 'Relembrando nas conversas'
      titulo = arg.consulta || ''
      icone = IC.search || icone
    } else if (/midia_gerar_imagem/.test(f.titulo || '')) {
      rotulo = 'Gerando imagem'
      titulo = String(arg.prompt || '').slice(0, 70)
    } else if (/midia_gerar_video/.test(f.titulo || '')) {
      rotulo = 'Gerando vídeo'
      titulo = String(arg.prompt || '').slice(0, 70)
    }
    const caminho = f.caminho
    d.className = 'ferr ' + (f.status || 'pending')
    d.innerHTML = `<details ${f.conteudo || f.entrada ? '' : 'class="sem-corpo"'}><summary><span class="fi">${icone}</span><span class="ft"><b>${esc(rotulo)}</b> ${esc(titulo)}</span><span class="fe">${estado}</span></summary>
      <div class="fcorpo">${f.entrada ? `<div class="mut">${esc(f.entrada)}</div>` : ''}${f.conteudo ? `<pre>${esc(f.conteudo)}</pre>` : ''}</div></details>
      ${caminho && f.status === 'completed' && tipo === 'edit' ? `<div class="facoes"><button data-abrir="${attr(caminho)}">${IC.file}${ehWeb ? 'Baixar' : 'Abrir'} ${esc(nomeArq(caminho))}</button>${ehWeb ? '' : `<button data-mostrar="${attr(caminho)}">${IC.folder}Mostrar na pasta</button>`}</div>` : ''}`
  }

  function partesDe(m) {
    return m.partes || [{ t: 'texto', v: m.content }]
  }
  function renderPartes(el, partes) {
    el.innerHTML = ''
    let grupo = null
    let ultimaFalha = null
    const fechaGrupo = () => {
      if (!grupo) return
      const itens = grupo.itens.filter((x) => !INTERNA.test(x.f.titulo || ''))
      if (itens.length) {
        const erro = itens.filter((x) => x.f.status === 'failed').length
        const rodando = itens.some((x) => x.f.status !== 'completed' && x.f.status !== 'failed')
        const det = document.createElement('details')
        det.className = 'grupo-ferr' + (rodando ? ' em-andamento' : '') // não usar 'rodando': é a classe da rodinha e faria o bloco inteiro girar
        det.innerHTML = `<summary><span class="gf-ic">${rodando ? '<span class="rodando"></span>' : IC.check}</span><span>${rodando ? 'Trabalhando...' : 'Concluído'} · ${itens.length} ${itens.length === 1 ? 'passo' : 'passos'}${erro && !rodando ? ` · ${erro} sem sucesso` : ''}</span></summary><div class="gf-lista"></div>`
        const lista = det.querySelector('.gf-lista')
        for (const x of itens) lista.appendChild(cartaoFerramenta(x.f))
        el.appendChild(det)
      }
      grupo = null
    }
    for (const p of partes) {
      if (p.t === 'texto') {
        fechaGrupo()
        const c = document.createElement('div')
        c.className = 'corpo'
        c.innerHTML = md(p.v)
        el.appendChild(c)
      } else if (p.t === 'ferr') {
        if (ehMidia(p.f)) {
          const card = cartaoFerramenta(p.f)
          if (p.f.status === 'failed' && ultimaFalha && ultimaFalha.tipo === (/video/.test(p.f.titulo) ? 'video' : 'imagem')) {
            ultimaFalha.n++ // tentativas repetidas viram um só cartão de falha, com contador discreto
            const c = ultimaFalha.el.querySelector('.mc-sub')
            if (c) c.textContent = `Tentamos ${ultimaFalha.n} vezes. Seu pedido não foi perdido: é só tentar de novo.`
            continue
          }
          if (card.hidden) continue
          fechaGrupo()
          el.appendChild(card)
          ultimaFalha = p.f.status === 'failed' ? { el: card, n: 1, tipo: /video/.test(p.f.titulo) ? 'video' : 'imagem' } : null
        } else {
          if (!grupo) grupo = { itens: [] }
          grupo.itens.push(p)
        }
      }
    }
    fechaGrupo()
  }

  const QUEM = `<div class="quem"><img class="av" src="img/segundo-cerebro-64.png" alt="">Segundo Cérebro`
  // ---------- horário, tempo e tokens por resposta ----------
  const hhmm = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const duracao = (ms) => {
    const t = Math.max(1, Math.round(ms / 1000))
    return t < 60 ? `${t} s` : `${Math.floor(t / 60)} min ${String(t % 60).padStart(2, '0')} s`
  }
  const nTokens = (n) => (n >= 10000 ? `${(n / 1000).toFixed(1).replace('.', ',')} mil` : new Intl.NumberFormat('pt-BR').format(Math.round(n)))
  function resumoResposta(m) {
    if (!m.inicio || !m.fim) return ''
    const ms = m.fim - m.inicio
    const u = m.uso || {}
    const total = u.totalTokens || (u.inputTokens || 0) + (u.outputTokens || 0)
    const nFerr = (m.partes || []).filter((p) => p.t === 'ferr').length
    const titulo = ms < 4000 ? `Respondeu em ${duracao(ms)}` : `Trabalhou por ${duracao(ms)}`
    const linha = titulo // horário e tokens ficam dentro do detalhe
    const det = [
      ['Tempo', duracao(ms)],
      ['Horário', `${hhmm(m.inicio)} às ${hhmm(m.fim)}`],
      u.inputTokens != null ? ['Tokens lidos (contexto)', nTokens(u.inputTokens)] : null,
      u.outputTokens != null ? ['Tokens escritos', nTokens(u.outputTokens)] : null,
      u.thoughtTokens ? ['Tokens de raciocínio', nTokens(u.thoughtTokens)] : null,
      nFerr ? ['Ferramentas usadas', String(nFerr)] : null,
    ].filter(Boolean)
    return `<details class="resumo-resp"><summary>${esc(linha)}</summary><div class="resumo-corpo">${det.map(([k, v]) => `<div class="linha-r"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div></details>`
  }

  function bolha(m) {
    const d = document.createElement('div')
    d.className = 'msg ' + m.role
    if (m.role === 'user') {
      d.innerHTML = `<div class="corpo">${md(m.content)}</div>${(m.anexos || []).map((a) => `<div class="anexo-msg">${IC.clip}${esc(a.nome)}</div>`).join('')}${m.em ? `<div class="hora-msg">${hhmm(m.em)}</div>` : ''}`
    } else {
      d.innerHTML = `${QUEM}</div>${resumoResposta(m)}${m.raciocinio ? `<details class="raciocinio"><summary>Raciocínio</summary><div class="rtxt">${esc(m.raciocinio)}</div></details>` : ''}<div class="partes"></div>`
      renderPartes(d.querySelector('.partes'), partesDe(m))
      for (const a of m.midias || []) d.appendChild(midia(a))
    }
    return d
  }

  // mídia gerada: imagem aparece na conversa, áudio/vídeo com player, outros com Abrir
  function midia(caminho) {
    const d = document.createElement('div')
    d.className = 'midia'
    const ext = (caminho.split('.').pop() || '').toLowerCase()
    const tipo = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) ? 'img' : ['mp3', 'wav', 'ogg', 'webm', 'm4a'].includes(ext) ? 'audio' : ['mp4', 'mov'].includes(ext) ? 'video' : 'arq'
    const acoes = `<div class="facoes" style="padding:0"><button data-abrir="${attr(caminho)}">${ehWeb ? 'Baixar' : 'Abrir'}</button>${ehWeb ? '' : `<button data-mostrar="${attr(caminho)}">${IC.folder}Mostrar na pasta</button>`}</div>`
    if (tipo === 'arq') d.innerHTML = `<div class="anexo-msg">${IC.file}${esc(nomeArq(caminho))}</div>${acoes}`
    else {
      d.innerHTML = `<div class="mut">${esc(nomeArq(caminho))}</div>${acoes}`
      window.sb.lerArquivo(caminho).then((r) => {
        if (!r.ok) return
        const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', webm: tipo === 'video' ? 'video/webm' : 'audio/webm', m4a: 'audio/mp4', mp4: 'video/mp4', mov: 'video/quicktime' }[ext]
        const el = document.createElement(tipo === 'img' ? 'img' : tipo)
        el.src = `data:${mime};base64,${r.base64}`
        if (tipo !== 'img') el.controls = true
        el.className = 'midia-el'
        d.insertBefore(el, d.firstChild)
      })
    }
    return d
  }

  const SUGESTOES = [
    { ic: 'globe', t: 'Criar um site', d: 'Monte um portfólio a partir do seu currículo', p: 'Crie um site de portfólio profissional com base no meu currículo (vou anexar o PDF).' },
    { ic: 'file', t: 'Resumir um documento', d: 'Leia um PDF, Word ou planilha e resuma', p: 'Leia o arquivo anexado e faça um resumo com os pontos principais e os próximos passos.' },
    { ic: 'terminal', t: 'Organizar arquivos', d: 'Arrume uma pasta do seu computador', p: 'Liste os arquivos da minha pasta de trabalho e proponha uma organização por tipo, sem mover nada ainda.' },
    { ic: 'sparkles', t: 'Pedir uma segunda opinião', d: 'Chame o Claude Code ou o Codex', p: 'Peça uma segunda opinião ao Claude Code sobre o texto que vou colar a seguir.' },
  ]
  function telaInicial() {
    const d = document.createElement('div')
    d.className = 'vazio'
    d.id = 'vazio'
    d.innerHTML = `<img class="logo-img logo-grande" src="img/segundo-cerebro.png" alt=""><h1>Como posso ajudar?</h1><p>Seu assistente pessoal: lê arquivos, roda comandos, cria sites e documentos.</p>
      <div class="sugestoes">${SUGESTOES.map((s, i) => `<button class="sugestao" data-sug="${i}">${IC[s.ic]}<div><b>${esc(s.t)}</b><span>${esc(s.d)}</span></div></button>`).join('')}</div>`
    d.onclick = (e) => {
      const b = e.target.closest('[data-sug]')
      if (!b) return
      $('texto').value = SUGESTOES[+b.dataset.sug].p
      $('texto').dispatchEvent(new Event('input'))
      $('texto').focus()
    }
    return d
  }

  // medidor de contexto: quanto da janela do modelo a conversa já ocupa (por conversa, só enquanto o app está aberto)
  const ctxPorChat = new Map()
  function pintarContexto() {
    const m = $('ctx-medidor')
    const x = ctxPorChat.get(atual)
    if (!x || !x.tamanho) {
      m.hidden = true
      return
    }
    const pct = Math.min(100, Math.round((x.usado / x.tamanho) * 100))
    m.hidden = false
    m.classList.toggle('medio', pct >= 55)
    m.classList.toggle('alto', pct >= 80)
    $('ctx-arco').style.strokeDashoffset = String(50.27 * (1 - pct / 100))
    $('ctx-txt').textContent = `${pct}%`
    m.title = `Contexto: ${nTokens(x.usado)} de ${nTokens(x.tamanho)} tokens usados (${pct}%). Perto do limite o agente compacta a conversa sozinho.`
    m.setAttribute('aria-label', m.title)
  }
  function desenhar() {
    const el = $('conversa')
    const c = chatAtual()
    pintarContexto()
    alternarBotao(respostas.has(atual))
    el.innerHTML = ''
    $('titulo').textContent = c && c.msgs.length ? c.titulo : 'Nova conversa'
    if (!c || c.msgs.length === 0) {
      el.appendChild(telaInicial())
      pintarBotaoFim()
      atualizarRodapeAtividade()
      return
    }
    for (const m of c.msgs) el.appendChild(bolha(m))
    const viva = respostas.get(c.id)
    if (viva) el.appendChild(montarVivo(viva))
    el.scrollTop = el.scrollHeight // ao abrir a conversa, vai direto pro fim (sem checar: é a primeira vez que ela aparece)
    pintarBotaoFim() // a conversa pode ter trocado: a seta não pode ficar com o estado da conversa anterior
    atualizarRodapeAtividade()
    desenharFila()
  }
  // scroll do chat: só força pro fim quando o cliente já está perto dele; se ele rolou pra cima de propósito, nada o puxa de volta
  const PERTO_DO_FIM_PX = 80
  const pertoDoFim = () => { const el = $('conversa'); return el.scrollHeight - el.scrollTop - el.clientHeight < PERTO_DO_FIM_PX }
  function rolarSeEstivaPerto() {
    const el = $('conversa')
    if (pertoDoFim()) el.scrollTop = el.scrollHeight
    pintarBotaoFim()
  }
  function pintarBotaoFim() {
    const b = document.getElementById('ir-pro-fim')
    if (b) b.hidden = pertoDoFim()
  }
  $('conversa').addEventListener('scroll', pintarBotaoFim)
  document.getElementById('ir-pro-fim')?.addEventListener('click', () => {
    const el = $('conversa')
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  })

  function alternarBotao(parar) {
    const b = $('enviar')
    if (parar && ($('texto').value.trim() || anexosPendentes.length)) {
      b.innerHTML = IC.arrowUp
      b.classList.remove('parar')
      b.setAttribute('aria-label', 'Enviar para a fila')
      return atualizarRodapeAtividade()
    }
    b.innerHTML = parar ? IC.stop : IC.arrowUp
    b.classList.toggle('parar', parar)
    b.setAttribute('aria-label', parar ? 'Parar' : 'Enviar')
    atualizarRodapeAtividade()
  }
  // sinal de atividade perto da caixa de digitar: só uma bolinha girando, discreta, e só depois que a resposta já
  // está demorando (resposta rápida não precisa disso) — sem isso, uma tarefa longa parece travada quando o card de
  // cima sai da vista (rolou pra longe, ou a conversa é comprida demais pra caber na tela)
  const RODAPE_DEMORA_MS = 8000
  function atualizarRodapeAtividade(r) {
    const el = document.getElementById('rodape-atividade')
    if (!el) return
    r = r || respostas.get(atual)
    el.hidden = !r || Date.now() - r.inicio < RODAPE_DEMORA_MS
  }

  // ---------- anexos e áudio ----------
  function desenharAnexos() {
    const el = $('anexos')
    el.hidden = anexosPendentes.length === 0
    el.innerHTML = anexosPendentes.map((a, i) => `<span class="chip-anexo">${a.tipo === 'audio' ? IC.mic : IC.clip}${esc(a.nome)}<button data-rm="${i}" aria-label="Remover anexo">${IC.x}</button></span>`).join('')
  }
  async function adicionarArquivo(arquivo) {
    if (!chatAtual()) criarChat()
    const chat = atual
    let caminho
    const original = (() => {
      try {
        return window.sb.caminhoDe(arquivo)
      } catch {
        return ''
      }
    })()
    if (original) caminho = await window.sb.anexar({ chat, nome: arquivo.name, caminho: original })
    else caminho = await window.sb.anexar({ chat, nome: arquivo.name, bytes: new Uint8Array(await arquivo.arrayBuffer()) })
    anexosPendentes.push({ nome: arquivo.name, caminho, tipo: arquivo.type.startsWith('audio') ? 'audio' : 'arquivo' })
    desenharAnexos()
  }
  $('anexar').onclick = () => $('arquivo-input').click()
  $('arquivo-input').onchange = async (e) => {
    for (const f of e.target.files) await adicionarArquivo(f)
    e.target.value = ''
  }
  $('anexos').onclick = (e) => {
    const b = e.target.closest('[data-rm]')
    if (!b) return
    anexosPendentes.splice(+b.dataset.rm, 1)
    desenharAnexos()
  }
  const caixaEl = document.querySelector('.entrada')
  for (const ev of ['dragenter', 'dragover']) window.addEventListener(ev, (e) => (e.preventDefault(), caixaEl.classList.add('arrasto')))
  for (const ev of ['dragleave', 'drop']) window.addEventListener(ev, () => caixaEl.classList.remove('arrasto'))
  window.addEventListener('drop', async (e) => {
    e.preventDefault()
    for (const f of e.dataTransfer.files) await adicionarArquivo(f)
  })
  $('texto').addEventListener('paste', async (e) => {
    const arquivos = [...(e.clipboardData?.files || [])]
    if (!arquivos.length) return
    e.preventDefault()
    for (const f of arquivos) await adicionarArquivo(f)
  })

  const hora = () => new Date().toTimeString().slice(0, 8).replace(/:/g, '')
  async function gravarComoAnexo() {
    const b = $('microfone')
    if (gravador) {
      gravador.stop()
      return
    }
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(fluxo)
      const partes = []
      rec.ondataavailable = (e) => partes.push(e.data)
      rec.onstop = async () => {
        fluxo.getTracks().forEach((t) => t.stop())
        gravador = null
        b.classList.remove('gravando')
        b.title = 'Gravar áudio'
        b.setAttribute('aria-label', 'Gravar áudio')
        const blob = new Blob(partes, { type: rec.mimeType || 'audio/webm' })
        if (blob.size) await adicionarArquivo(new File([blob], `audio-${hora()}.webm`, { type: blob.type }))
      }
      rec.start()
      gravador = rec
      b.classList.add('gravando')
      b.title = 'Parar gravação'
      b.setAttribute('aria-label', 'Parar gravação')
    } catch (e) {
      aviso('Não consegui acessar o microfone: ' + (e.message || e))
    }
  }
  // Ditado: clica no microfone, fala, clica de novo. O áudio inteiro vai ao servidor de transcrição (Whisper) e o texto cai na caixa
  // de mensagem. Igual no app (Windows, Mac, Linux) e na web. Sem tempo real: o texto aparece quando a gravação termina.
  let gravandoVoz = null // { rec, fluxo, ctx, raf, limite }
  let transcrevendo = false
  let ultimoAudio = null // { bytes, mime, em, falhou }: guardado para tentar de novo se a transcrição falhar
  const barras = () => [...document.querySelectorAll('#ditado-barras i')]
  function pintarMic(estado) {
    const b = $('microfone')
    b.classList.toggle('gravando', estado === 'ouvindo')
    b.classList.toggle('preparando', estado === 'transcrevendo')
    $('ditado-barras').hidden = estado !== 'ouvindo'
    b.title = b.ariaLabel = estado === 'ouvindo' ? 'Parar e transcrever' : estado === 'transcrevendo' ? 'Transcrevendo…' : 'Ditar por voz'
    if (estado !== 'ouvindo') barras().forEach((i) => (i.style.height = ''))
  }
  async function transcreverAudio(audio) {
    transcrevendo = true
    pintarMic('transcrevendo')
    aviso('Transcrevendo o áudio…', true)
    let r
    try {
      r = await window.sb.ditadoServidor(audio.bytes, audio.mime)
    } catch {
      r = { ok: false, erro: 'Não consegui transcrever agora. Confira a internet e tente de novo.' }
    }
    transcrevendo = false
    pintarMic(null)
    const t = $('texto')
    if (r && r.ok && r.texto) {
      ultimoAudio = null
      t.value = [t.value.trim(), r.texto].filter(Boolean).join(' ')
      t.dispatchEvent(new Event('input'))
      t.scrollTop = t.scrollHeight
      aviso('')
      t.focus()
    } else if (r && r.ok) {
      ultimoAudio = null
      aviso('Não entendi nenhuma fala nesse áudio. Tente de novo, mais perto do microfone.')
    } else if (audio.falhou) {
      ultimoAudio = null // já tentou de novo: a próxima gravação é nova
      aviso((r && r.erro) || 'Não consegui transcrever agora. Grave de novo em instantes.')
    } else {
      ultimoAudio = { ...audio, falhou: true }
      aviso(((r && r.erro) || 'Não consegui transcrever agora.') + ' Clique no microfone para tentar de novo com a mesma gravação.')
    }
  }
  function pararGravacao() {
    const g = gravandoVoz
    if (!g) return
    gravandoVoz = null
    clearTimeout(g.limite)
    cancelAnimationFrame(g.raf)
    pintarMic('transcrevendo') // o "parar" do gravador entrega o áudio logo em seguida
    try {
      g.rec.stop()
    } catch {
      pintarMic(null)
    }
  }
  async function alternarGravacao() {
    if (transcrevendo) return
    if (gravandoVoz) return pararGravacao()
    if (ultimoAudio && Date.now() - ultimoAudio.em < 5 * 60 * 1000) return transcreverAudio(ultimoAudio) // tentar de novo
    ultimoAudio = null
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return aviso('Este navegador não permite gravar áudio aqui. Use o Chrome ou o app instalado.')
    let fluxo
    try {
      fluxo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } })
    } catch (e) {
      return aviso(e && e.name === 'NotAllowedError' ? 'Permita o uso do microfone para ditar.' : 'Não consegui acessar o microfone.')
    }
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) => window.MediaRecorder.isTypeSupported(m)) || ''
    const rec = new MediaRecorder(fluxo, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : {})
    const partes = []
    rec.ondataavailable = (e) => e.data && e.data.size && partes.push(e.data)
    const AC = window.AudioContext || window.webkitAudioContext
    const ctx = AC ? new AC() : null
    const g = { rec, fluxo, ctx, raf: 0, limite: 0 }
    rec.onstop = async () => {
      try {
        fluxo.getTracks().forEach((t) => t.stop())
      } catch {}
      try {
        ctx && ctx.close()
      } catch {}
      const blob = new Blob(partes, { type: rec.mimeType || mime || 'audio/webm' })
      if (blob.size < 1500) {
        pintarMic(null)
        return aviso('Não ouvi nada. Tente de novo, mais perto do microfone.')
      }
      await transcreverAudio({ bytes: new Uint8Array(await blob.arrayBuffer()), mime: blob.type, em: Date.now() })
    }
    if (ctx) {
      try {
        const an = ctx.createAnalyser()
        an.fftSize = 512
        ctx.createMediaStreamSource(fluxo).connect(an)
        const amostra = new Uint8Array(an.fftSize)
        const f = [0.55, 0.8, 1, 0.8, 0.55]
        const medir = () => {
          an.getByteTimeDomainData(amostra)
          let soma = 0
          for (let i = 0; i < amostra.length; i++) {
            const v = (amostra[i] - 128) / 128
            soma += v * v
          }
          const n = Math.min(1, Math.sqrt(soma / amostra.length) * 4)
          barras().forEach((i, k) => (i.style.height = 4 + Math.round(n * f[k] * 16) + 'px'))
          g.raf = requestAnimationFrame(medir)
        }
        medir()
      } catch {}
    }
    rec.start(1000)
    gravandoVoz = g
    g.limite = setTimeout(pararGravacao, 15 * 60 * 1000) // trava de segurança: 15 minutos por gravação
    pintarMic('ouvindo')
  }
  $('microfone').onclick = alternarGravacao

  let avisoTimer = null
  // persistente=true: fica na tela até outra chamada de aviso() (sucesso, erro ou aviso('')) — usado quando o próprio
  // chamador sabe que vai limpar na hora certa (ex.: transcrição), em vez do timeout fixo de 6s que não serve pra isso
  function aviso(txt, persistente) {
    const a = $('aviso-geral')
    clearTimeout(avisoTimer)
    a.textContent = txt
    a.hidden = !txt
    if (txt && !persistente) avisoTimer = setTimeout(() => (a.hidden = true), 6000)
  }

  // ---------- envio ----------
  // resposta em curso de uma conversa: o estado vive em `respostas`; a bolha só existe enquanto a conversa está na tela
  function cartaoPermissao(r, p) {
    const d = document.createElement('div')
    d.className = 'permissao'
    d.innerHTML = `<div><b>${IC.shield} O agente pede permissão</b><div class="mut">${esc(p.titulo)}</div></div><div class="facoes"><button data-p="permitir" class="primario">Permitir</button><button data-p="sempre">Permitir sempre nesta conversa</button><button data-p="negar">Negar</button></div>`
    d.onclick = (e) => {
      const resp = e.target.dataset?.p
      if (!resp) return
      window.sb.responderPermissao(p.req, resp)
      r.perms = r.perms.filter((x) => x.req !== p.req)
      d.remove()
    }
    return d
  }
  // registro do que o agente está fazendo, só para quem abrir a setinha: uma linha por etapa, em português, sem jargão
  const semNumero = (t) => String(t).replace(/\d+/g, '#')
  function anotar(r, txt) {
    if (!txt) return
    r.log = r.log || []
    const ult = r.log[r.log.length - 1]
    if (ult && semNumero(ult.txt) === semNumero(txt)) {
      ult.txt = txt
    } else {
      r.log.push({ ms: Date.now() - r.inicio, txt })
      if (r.log.length > 80) r.log.shift()
    }
    pintarLog(r)
  }
  function pintarLog(r) {
    if (!r.el || !r.el.isConnected) return
    const box = r.el.querySelector('.atv-log')
    if (!box || box.hidden) return
    const linhas = (r.log || []).map((l) => `<div class="atv-lin"><span class="atv-t">${fmtTempo(l.ms)}</span><span>${esc(l.txt)}</span></div>`).join('')
    const perto = box.scrollHeight - box.scrollTop - box.clientHeight < 40
    box.innerHTML = linhas || '<div class="atv-lin"><span>Começando…</span></div>'
    if (perto) box.scrollTop = box.scrollHeight
  }
  function montarVivo(r) {
    const d = document.createElement('div')
    d.className = 'msg assistant'
    d.innerHTML = `${QUEM}</div><div class="atividade"><span class="ponto-vivo"></span><span class="atv-txt">${esc(r.fase)}</span><span class="tempo">${fmtTempo(Date.now() - r.inicio)}</span><span class="atv-extra"></span><button class="atv-seta" type="button" aria-expanded="false" aria-label="Ver o que está sendo feito" title="Ver o que está sendo feito">›</button></div><div class="atv-log" hidden></div><details class="raciocinio" hidden><summary>Raciocínio</summary><div class="rtxt"></div></details><div class="aviso" hidden></div><div class="partes"></div>`
    r.el = d
    const seta = d.querySelector('.atv-seta')
    const caixa = d.querySelector('.atv-log')
    seta.onclick = () => {
      r.logAberto = !r.logAberto
      caixa.hidden = !r.logAberto
      seta.setAttribute('aria-expanded', String(!!r.logAberto))
      seta.classList.toggle('aberta', !!r.logAberto)
      pintarLog(r)
    }
    if (r.logAberto) {
      caixa.hidden = false
      seta.classList.add('aberta')
      seta.setAttribute('aria-expanded', 'true')
      pintarLog(r)
    }
    if (r.raz) {
      const det = d.querySelector('.raciocinio')
      det.hidden = false
      det.open = true
      det.querySelector('.rtxt').textContent = r.raz
    }
    if (r.aviso) {
      const a = d.querySelector('.aviso')
      a.hidden = false
      a.textContent = r.aviso
    }
    renderPartes(d.querySelector('.partes'), r.partes)
    for (const p of r.perms) d.appendChild(cartaoPermissao(r, p))
    return d
  }
  const visivel = (r) => r.el && r.el.isConnected && r.id === atual

  // manda uma mensagem a uma conversa (a que está na tela ou outra, como no controle remoto)
  function enviarMensagem(c, texto, anexos, retomadas = 0, reenvio = false) {
    if (!reenvio) c.msgs.push({ role: 'user', em: Date.now(), content: texto, anexos: anexos.map((a) => ({ nome: a.nome, caminho: a.caminho })) })
    if (!c.tituloManual && (c.titulo === 'Nova conversa' || c.titulo === 'Novo chat')) c.titulo = texto.slice(0, 42)
    c.em = Date.now()
    salvar()
    respostas.set(c.id, { id: c.id, el: null, partes: [], raz: '', aviso: '', midias: [], perms: [], inicio: Date.now(), ultimo: Date.now(), fase: 'Aguardando o modelo…', log: [{ ms: 0, txt: 'Enviando o pedido ao agente…' }], retomadas, texto, anexosEnviados: anexos })
    if (!relogio) relogio = setInterval(tiquetaque, 1000)
    if (c.id === atual) desenhar()
    alternarBotao(respostas.has(atual))
    listar()
    window.sb.enviar({ id: c.id, mensagens: c.msgs.map(({ role, content }) => ({ role, content })), alvo: cfg.ativo, anexos: anexos.map((a) => a.caminho) })
  }

  async function enviar() {
    const t = $('texto').value.trim()
    if (respostas.has(atual)) {
      if (!t && !anexosPendentes.length) {
        const rr = respostas.get(atual)
        rr.paradoManual = true
        fila.delete(atual)
        desenharFila()
        window.sb.parar(atual)
        return
      }
      const anexosF = anexosPendentes
      anexosPendentes = []
      desenharAnexos()
      $('texto').value = ''
      $('texto').style.height = 'auto'
      if (!fila.has(atual)) fila.set(atual, [])
      fila.get(atual).push({ texto: t || 'Veja o(s) arquivo(s) anexado(s).', anexos: anexosF })
      desenharFila()
      alternarBotao(true)
      return
    }
    if (!t && !anexosPendentes.length) return
    if (!cfg.ativo) return aviso('Escolha um modelo antes de enviar (ou conecte um provedor em Configurações).')
    if (!chatAtual()) criarChat()
    const c = chatAtual()
    const anexos = anexosPendentes
    anexosPendentes = []
    desenharAnexos()
    $('texto').value = ''
    $('texto').style.height = 'auto'
    enviarMensagem(c, t || 'Veja o(s) arquivo(s) anexado(s).', anexos)
  }

  function desenharFila() {
    const el = $('fila')
    const itens = fila.get(atual) || []
    el.hidden = itens.length === 0
    el.innerHTML = itens.map((m, i) => `<span class="chip-fila" title="${esc(m.texto)}"><b>${i + 1}</b>${esc(m.texto.slice(0, 60))}<button data-fq="${i}" aria-label="Tirar da fila">${IC.x}</button></span>`).join('')
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-fq]')
    if (!b) return
    fila.get(atual)?.splice(+b.dataset.fq, 1)
    desenharFila()
  })
  function proximaDaFila(id) {
    const itens = fila.get(id)
    if (!itens || !itens.length || respostas.has(id)) return
    const c = chats.find((x) => x.id === id)
    if (!c) return fila.delete(id)
    const m = itens.shift()
    if (!itens.length) fila.delete(id)
    desenharFila()
    enviarMensagem(c, m.texto, m.anexos || [])
  }

  // mensagens técnicas do motor (em inglês, com HTTP, chave, "hermes setup"...) nunca chegam ao cliente: o app tenta de novo
  // em silêncio e, se continuar falhando, mostra uma frase simples
  const ERRO_TECNICO = /rejected your API key|Invalid API key|HTTP [45]\d\d|Provider said|hermes setup|Stream stalled|admitted_turn_failed|Internal error|Traceback|Your request was not processed|model can't be reached/i
  // só vale para texto curto (as mensagens de erro reais são curtas); uma explicação longa sobre HTTP 404 não é trocada
  const eErroTecnico = (t) => !!t && t.length < 500 && ERRO_TECNICO.test(t)
  const FRASE_FALHA = 'Não consegui responder agora. Tente enviar de novo em instantes.'
  function fim(id, texto, erro, uso) {
    const r = respostas.get(id)
    if (!r) return
    respostas.delete(id)
    if (!respostas.size) {
      clearInterval(relogio)
      relogio = null
    }
    const c = chats.find((x) => x.id === id)
    const textoFinal = (r.partes.length ? r.partes.filter((p) => p.t === 'texto').map((p) => p.v).join(' ') : texto) || ''
    const sohErroTecnico = eErroTecnico(textoFinal) && !r.partes.some((p) => p.t === 'ferr')
    if (c && sohErroTecnico && !r.paradoManual && (r.retomadas || 0) < MAX_RETOMADAS) {
      enviarMensagem(c, r.texto, r.anexosEnviados || [], (r.retomadas || 0) + 1, true)
      if (id === atual) desenhar()
      alternarBotao(respostas.has(atual))
      return
    }
    if (c) {
      const partes = (r.partes.length ? r.partes : texto ? [{ t: 'texto', v: texto }] : []).map((p) => (p.t === 'texto' && eErroTecnico(p.v) ? { ...p, v: FRASE_FALHA } : p))
      if (erro) partes.push({ t: 'texto', v: eErroTecnico(erro) ? FRASE_FALHA : `⚠ ${erro}` })
      const conteudo = partes.filter((p) => p.t === 'texto').map((p) => p.v).join('\n') || (r.paradoManual ? '(interrompido por você)' : '(sem resposta)')
      c.msgs.push({ role: 'assistant', content: conteudo, partes, raciocinio: r.raz || undefined, midias: r.midias, inicio: r.inicio, fim: Date.now(), uso: uso || undefined })
      c.em = Date.now()
      salvar()
    }
    if (id === atual) desenhar()
    alternarBotao(respostas.has(atual))
    listar()
    if (r.paradoManual) return
    // o app parou sozinho por falta de sinal: retoma em partes menores, sem o usuário precisar pedir de novo
    if (r.travou && c && (r.retomadas || 0) < MAX_RETOMADAS) {
      // nada aconteceu ainda (agente não chegou a responder): reenvia o pedido original; se já havia trabalho feito, retoma em passos pequenos
      if (!r.partes.length) enviarMensagem(c, r.texto, r.anexosEnviados || [], (r.retomadas || 0) + 1, true)
      else enviarMensagem(c, 'Continue exatamente de onde parou.', [], (r.retomadas || 0) + 1)
      return
    }
    proximaDaFila(id)
  }

  const fmtTempo = (ms) => {
    const t = Math.floor(ms / 1000)
    return t < 60 ? t + ' s' : Math.floor(t / 60) + ' min ' + String(t % 60).padStart(2, '0') + ' s'
  }
  // atualiza o relógio e avisa quando o modelo fica muito tempo sem dar sinal
  function tiquetaque() {
    for (const r of respostas.values()) {
      // compactar o contexto é demorado de propósito: enquanto estiver acontecendo não conta como "sem sinal" (até 10 min)
      if (r.compactando && Date.now() - r.compactando < 600000) r.ultimo = Date.now()
      if (r.compactando && visivel(r)) {
        const at = r.el.querySelector('.atividade')
        if (at) {
          at.classList.add('compactando')
          at.querySelector('.tempo').textContent = fmtTempo(Date.now() - r.inicio)
      if (r.fase && !/^(Pensando|Executando ferramenta|Analisando o resultado|Compactando)/.test(r.fase)) anotar(r, r.fase) // a espera também aparece no painel, com o tempo correndo
          at.querySelector('.atv-txt').innerHTML = `<i class="relogio-compactar"></i>Compactando o contexto · ${fmtTempo(Date.now() - r.compactando)}`
          at.querySelector('.atv-extra').innerHTML = ''
        }
        continue
      }
      if (visivel(r)) r.el.querySelector('.atividade')?.classList.remove('compactando')
      const parou = Date.now() - r.ultimo
      const isento = r.fase === 'Executando ferramenta' && parou < LIMITE_FERRAMENTA_MS
      if (parou > LIMITE_SEM_SINAL_MS && !isento && !r.travou && !r.paradoManual) {
        r.travou = true
        window.sb.parar(r.id)
      }
      if (!visivel(r)) continue
      const at = r.el.querySelector('.atividade')
      if (!at) continue
      const parado = Date.now() - r.ultimo
      at.querySelector('.tempo').textContent = fmtTempo(Date.now() - r.inicio)
      // nunca falamos de "sinal" ou "silêncio" ao cliente: etapa longa é etapa longa, e o relógio mostra que está andando
      const faseMostrada = parado > 45000 && !/ação longa|Compactando/.test(r.fase) ? 'Trabalhando numa etapa longa…' : r.fase
      at.querySelector('.atv-txt').textContent = faseMostrada
      at.classList.remove('demora')
      const extra = at.querySelector('.atv-extra')
      if (extra.firstChild) extra.innerHTML = ''
      atualizarRodapeAtividade(r)
    }
  }
  document.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-act]')
    if (!a || !respostas.has(atual)) return
    if (a.dataset.act === 'desligar') {
      cfg = await window.sb.salvarCfg({ raciocinio: 'none' })
      pintarPensar()
    }
    window.sb.parar(atual)
  })
  function sinal(r, fase) {
    r.ultimo = Date.now()
    if (fase) {
      r.fase = fase
      if (!/^(Pensando|Executando ferramenta|Analisando o resultado)/.test(fase)) anotar(r, fase)
    }
  }
  const EXT_MIDIA = /\.(png|jpe?g|gif|webp|svg|mp3|wav|ogg|m4a|mp4|mov)$/i
  window.sb.aoDelta((d) => {
    const r = respostas.get(d.id)
    if (!r) return
    // o agente morreu com o turno em andamento e já foi relançado por baixo dos panos (sem o cliente precisar pedir):
    // o que já tinha sido escrito vira um card encerrado de verdade na conversa, e um card novo começa do zero
    if (d.novoCard) {
      const c = chats.find((x) => x.id === d.id)
      if (c && (r.partes.length || r.raz)) {
        const partes = r.partes.length ? r.partes : []
        c.msgs.push({ role: 'assistant', content: partes.filter((p) => p.t === 'texto').map((p) => p.v).join('\n') || '(continuando…)', partes, raciocinio: r.raz || undefined, midias: r.midias, inicio: r.inicio, fim: Date.now() })
        salvar()
      }
      r.partes = []
      r.raz = ''
      r.aviso = ''
      r.midias = []
      r.log = [{ ms: 0, txt: 'O agente precisou recomeçar; continuando…' }]
      r.inicio = Date.now()
      sinal(r, 'Reconectando ao agente…')
      if (d.id === atual) desenhar()
      return
    }
    if (d.raciocinio) {
      r.raz += d.raciocinio
      sinal(r, 'Pensando… (' + Math.round(r.raz.length / 4) + ' palavras)')
      anotar(r, 'Pensando… ' + String(r.raz).replace(/\s+/g, ' ').trim().slice(-110))
      if (visivel(r)) {
        const det = r.el.querySelector('.raciocinio')
        det.hidden = false
        det.open = true
        det.querySelector('.rtxt').textContent = r.raz
      }
    }
    if (d.contexto) {
      ctxPorChat.set(d.id, d.contexto)
      if (d.id === atual) pintarContexto()
    }
    if (d.progresso) {
      // bytes chegando do modelo (inclusive um arquivo grande sendo escrito numa só ação): é sinal de vida, não trava
      const p = d.progresso
      if (p.tipo === 'espera') {
        // o servidor está escrevendo uma ação inteira (só aparece quando termina): sinal de vida com o tempo real de espera
        r.esperaDesde = r.esperaDesde || Date.now() - p.seg * 1000
        sinal(r, p.seg < 12 ? `Aguardando o modelo… ${p.seg} s` : `O modelo está escrevendo uma ação longa (um arquivo, por exemplo) · ${fmtTempo(p.seg * 1000)} · a tela só mostra quando ela termina`)
        return
      }
      r.esperaDesde = 0
      const oque = p.tipo === 'ferramenta' ? 'uma ação longa (provavelmente um arquivo)' : p.tipo === 'raciocinio' ? 'o raciocínio' : 'a resposta'
      if (!r.compactando) sinal(r, `Escrevendo ${oque} · ${nTokens(p.tokens)} tokens${p.tps ? ' · ' + p.tps + ' tok/s' : ''}`)
      else r.ultimo = Date.now()
    }
    if (d.compactando) {
      if (d.compactando.fase === 'inicio') {
        r.compactando = Date.now()
        sinal(r, 'Compactando o contexto…')
      } else {
        const seg = r.compactando ? Math.round((Date.now() - r.compactando) / 1000) : 0
        r.compactando = 0
        sinal(r, 'Retomando…')
        r.aviso = `Contexto compactado${seg ? ` em ${fmtTempo(seg * 1000)}` : ''}. A conversa continua de onde parou.`
        if (visivel(r)) {
          const a = r.el.querySelector('.aviso')
          a.hidden = false
          a.textContent = r.aviso
        }
      }
    }
    if (d.aviso) {
      sinal(r)
      r.aviso = d.aviso
      if (visivel(r)) {
        const a = r.el.querySelector('.aviso')
        a.hidden = false
        a.textContent = d.aviso
      }
    }
    if (d.texto) {
      sinal(r, 'Escrevendo a resposta…')
      const ult = r.partes[r.partes.length - 1]
      if (ult && ult.t === 'texto') ult.v += d.texto
      else r.partes.push({ t: 'texto', v: d.texto })
    }
    if (d.ferramenta) {
      const f = d.ferramenta
      sinal(r, f.status === 'completed' || f.status === 'failed' ? 'Analisando o resultado…' : 'Executando ferramenta')
      const existente = r.partes.find((p) => p.t === 'ferr' && p.f.id === f.id)
      if (!INTERNA.test(f.titulo || '')) {
        const o = `${rotuloFerr(f)}${tituloLimpo(f.titulo) ? ': ' + tituloLimpo(f.titulo).slice(0, 70) : ''}`
        if (f.status === 'completed') anotar(r, '✓ ' + o)
        else if (f.status === 'failed') anotar(r, 'Não deu certo, tentando de outro jeito: ' + o)
        else if (!existente) anotar(r, o)
      }
      if (existente) Object.assign(existente.f, Object.fromEntries(Object.entries(f).filter(([, v]) => v !== null && v !== undefined && v !== '')))
      else r.partes.push({ t: 'ferr', f: { ...f } })
      if (f.status === 'completed' && f.caminho && f.tipo === 'edit' && EXT_MIDIA.test(f.caminho) && !r.midias.includes(f.caminho)) r.midias.push(f.caminho)
      // imagem gerada pela ferramenta de mídia: o caminho vem no texto do resultado ("caminho: C:\...\x.png")
      if (f.status === 'completed' && /midia_gerar_(imagem|video)/.test(f.titulo || '')) {
        const m = /caminho:\s*(.+?\.(?:png|mp4))/i.exec(String(existente?.conteudo || f.conteudo || ''))
        if (m && !r.midias.includes(m[1])) r.midias.push(m[1])
      }
    }
    if (visivel(r)) {
      renderPartes(r.el.querySelector('.partes'), r.partes)
      rolarSeEstivaPerto()
    }
  })
  window.sb.aoFim((d) => fim(d.id, d.texto, '', d.uso))
  // primeira abertura: o agente está sendo preparado em segundo plano; aviso discreto, some sozinho quando termina
  window.sb.aoPreparando?.((t) => {
    let p = document.getElementById('sb-preparando')
    if (!t) return p?.remove()
    if (!p) {
      p = document.createElement('div')
      p.id = 'sb-preparando'
      p.setAttribute('role', 'status')
      p.style.cssText = 'position:fixed;left:50%;bottom:92px;transform:translateX(-50%);z-index:9999;background:#2a1f14;color:#f3ece4;border:1px solid #5a4630;border-radius:999px;padding:8px 16px;font:13px system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.5);max-width:90vw;text-align:center;pointer-events:none'
      document.body.appendChild(p)
    }
    p.textContent = t
  })
  // atualização do app: aviso discreto com botão; só no app instalado (a versão web não troca o programa)
  if (window.__sbRaw && window.sb.atualizacao) {
    const desenharAtualizacao = (e) => {
      let b = document.getElementById('sb-atualizacao')
      if (!e || !['disponivel', 'baixando', 'pronta'].includes(e.fase) || window.__sbAtualizacaoAdiada === e.versao) return b?.remove()
      if (!b) {
        b = document.createElement('div')
        b.id = 'sb-atualizacao'
        b.setAttribute('role', 'status')
        b.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:9999;background:#2a1f14;color:#f3ece4;border:1px solid #5a4630;border-radius:12px;padding:12px 14px;font:13px system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.5);max-width:340px;display:flex;flex-direction:column;gap:8px'
        document.body.appendChild(b)
      }
      const txt = e.fase === 'baixando' ? 'Baixando a nova versão…' : e.fase === 'pronta' ? 'Nova versão pronta. Reinicie para usar.' : 'Tem uma nova atualização do Segundo Cérebro (' + e.versao + ').'
      b.innerHTML = '<span></span><div style="display:flex;gap:8px;justify-content:flex-end"></div>'
      b.firstChild.textContent = txt + (e.erro ? ' ' + e.erro : '')
      const acoes = b.lastChild
      const botao = (rotulo, fn, forte) => {
        const x = document.createElement('button')
        x.textContent = rotulo
        x.style.cssText = 'border:1px solid #5a4630;border-radius:8px;padding:6px 12px;cursor:pointer;font:inherit;' + (forte ? 'background:#e0805f;color:#1a120b;border-color:#e0805f' : 'background:transparent;color:#f3ece4')
        x.onclick = fn
        acoes.appendChild(x)
      }
      if (e.fase === 'disponivel') {
        botao('Depois', () => ((window.__sbAtualizacaoAdiada = e.versao), b.remove()))
        botao('Atualizar', () => window.sb.atualizacao.baixar(), true)
      } else if (e.fase === 'pronta') botao('Reiniciar agora', () => window.sb.atualizacao.instalar(), true)
    }
    window.sb.atualizacao.aoMudar(desenharAtualizacao)
    window.sb.atualizacao.estado().then(desenharAtualizacao).catch(() => {})
  }
  // versão web: a conexão caiu e voltou (a máquina pode ter reiniciado e perdido a conversa em andamento).
  // Quem não der sinal em 10 s é dado como perdido: a tela fecha a resposta e refaz o pedido sozinha, sem o cliente precisar pedir de novo.
  window.sb.aoRetomar?.(() => {
    const desde = Date.now()
    setTimeout(() => {
      for (const [id, r] of [...respostas]) {
        if (r.ultimo > desde || r.paradoManual) continue
        r.travou = true
        fim(id, '', '')
      }
    }, 10000)
  })
  window.sb.aoErro((d) => fim(d.id, '', d.erro))

  // permissões do agente (cartão na conversa)
  window.sb.aoPermissao((p) => {
    const r = respostas.get(p.id)
    if (!r) return
    r.perms.push(p)
    if (visivel(r)) {
      r.el.appendChild(cartaoPermissao(r, p))
      rolarSeEstivaPerto()
    }
  })

  // ações dos cartões e mídia
  document.addEventListener('click', (e) => {
    const va = e.target.closest('[data-variacao]')
    if (va) {
      const c = chats.find((x) => x.id === atual)
      if (c && !respostas.has(c.id)) enviarMensagem(c, `Faça uma variação ${va.dataset.variacao === 'video' ? 'deste vídeo' : 'desta imagem'}: mesmo pedido, outra semente.`, [])
      return
    }
    const aj = e.target.closest('[data-ajustar]')
    if (aj) {
      $('texto').value = `Refaça ${aj.dataset.ajustar === 'video' ? 'o vídeo' : 'a imagem'} com este ajuste: `
      $('texto').focus()
      return
    }
    const tm = e.target.closest('[data-tentar-midia]')
    if (tm) {
      const c = chats.find((x) => x.id === atual)
      if (c && !respostas.has(c.id)) enviarMensagem(c, tm.dataset.tentarMidia === 'video' ? 'Tente gerar o vídeo de novo, por favor.' : 'Tente gerar a imagem de novo, por favor.', [])
      return
    }
    const lk = e.target.closest('[data-arq]')
    if (lk) {
      e.preventDefault()
      return ehWeb ? baixarArquivo(lk.dataset.arq, lk) : window.sb.abrirArquivo(lk.dataset.arq)
    }
    const ab = e.target.closest('[data-abrir]')
    if (ab) return ehWeb ? baixarArquivo(ab.dataset.abrir, ab) : window.sb.abrirArquivo(ab.dataset.abrir)
    const mo = e.target.closest('[data-mostrar]')
    if (mo) return window.sb.mostrarArquivo(mo.dataset.mostrar)
    const a = e.target.closest('a[href^="http"]')
    if (a) {
      e.preventDefault()
      window.sb.abrirExterno(a.href)
    }
    if (!e.target.closest('.seletor')) fecharMenu()
    if (!e.target.closest('#permissao') && !e.target.closest('#menu-permissao')) fecharMenuPerm()
  })

  // ---------- modelo, modo e pasta ----------
  const logoModelo = (m) => {
    if (!m) return `<span class="mlogo">${IC.layers}</span>`
    if (m.logo === 'unlimited') return '<span class="mlogo"><img src="img/unlimited.svg" alt=""></span>'
    if (m.grupo === 'Combos') return `<span class="mlogo">${IC.layers}</span>`
    const p = CAT[m.provedor]
    return p && p.logo ? `<span class="mlogo"><img src="img/providers/${esc(p.id)}.png" alt=""></span>` : `<span class="mlogo">${IC.sparkles}</span>`
  }
  const subModelo = (m) => (m.grupo === 'Combos' ? m.sub || 'Combo' : (CAT[m.provedor] && CAT[m.provedor].nome) || m.sub || '')

  function pintarSeletor() {
    const m = modelos.find((x) => x.id === cfg.ativo)
    $('modelo-logo').innerHTML = m ? logoModelo(m).replace(/^<span class="mlogo">|<\/span>$/g, '') : ''
    $('modelo-nome').textContent = m ? m.nome : modelos.length ? 'Escolher modelo' : 'Sem provedor'
    $('modelo').title = m ? `${m.nome} · ${subModelo(m)}` : 'Escolher modelo'
  }
  function pintarModo() {
    const agente = !cfg.soConversa
    const b = $('modo')
    b.classList.toggle('agente', agente)
    b.innerHTML = `${agente ? IC.sparkles : IC.chat}<span id="modo-nome">${agente ? 'Agente' : 'Conversa'}</span>`
    b.title = agente ? 'Modo agente: lê arquivos, roda comandos e cria coisas. Clique para só conversar.' : 'Só conversa, sem ferramentas. Clique para ativar o agente.'
  }
  function pintarPensar() {
    const ligado = cfg.raciocinio && cfg.raciocinio !== 'none'
    const b = $('pensar')
    b.classList.toggle('on', !!ligado)
    $('pensar-nome').textContent = ligado ? 'Pensando' : 'Pensar'
    b.title = ligado ? 'Raciocínio ligado: respostas melhores em tarefas difíceis, porém mais lentas. Clique para desligar.' : 'Raciocínio desligado: respostas rápidas. Clique para ligar.'
  }
  function pintarPasta() {
    const partes = String(cfg.pasta || '').split(/[\\/]/).filter(Boolean)
    $('pasta').textContent = partes.slice(-2).join('/') || 'Escolher pasta'
    $('pasta-chip').title = 'Pasta de trabalho: ' + cfg.pasta + ' (clique para mudar)'
  }
  function fecharMenu() {
    $('menu-modelo').hidden = true
    $('modelo').setAttribute('aria-expanded', 'false')
  }
  function abrirMenu() {
    const menu = $('menu-modelo')
    if (!modelos.length) {
      menu.innerHTML = '<div class="menu-vazio">Nenhum provedor conectado.<br><button class="primario" id="menu-conectar" style="margin-top:8px">Conectar provedor</button></div>'
    } else {
      menu.innerHTML = ['Combos', 'Modelos']
        .map((g) => {
          const itens = modelos.filter((m) => m.grupo === g)
          if (!itens.length) return ''
          return `<div class="menu-grupo">${g}</div>${itens.map((m) => `<button class="menu-item ${m.id === cfg.ativo ? 'on' : ''}" role="option" data-id="${attr(m.id)}">${logoModelo(m)}<span class="mnome">${esc(m.nome)}<small>${esc(subModelo(m))}</small></span><span class="ok">${IC.check}</span></button>`).join('')}`
        })
        .join('')
    }
    menu.hidden = false
    $('modelo').setAttribute('aria-expanded', 'true')
    ;(menu.querySelector('.menu-item.on') || menu.querySelector('.menu-item'))?.focus()
  }
  $('modelo').onclick = (e) => {
    e.stopPropagation()
    $('menu-modelo').hidden ? abrirMenu() : fecharMenu()
  }
  $('menu-modelo').onclick = async (e) => {
    if (e.target.id === 'menu-conectar') return fecharMenu(), window.SBConfig.abrir('prov')
    const b = e.target.closest('.menu-item')
    if (!b) return
    cfg = await window.sb.salvarCfg({ ativo: b.dataset.id })
    pintarSeletor()
    fecharMenu()
    $('texto').focus()
  }
  document.addEventListener('keydown', (e) => e.key === 'Escape' && fecharMenu())
  $('modo').onclick = async () => {
    cfg = await window.sb.salvarCfg({ soConversa: !cfg.soConversa })
    pintarModo()
  }
  $('pensar').onclick = async () => {
    cfg = await window.sb.salvarCfg({ raciocinio: cfg.raciocinio && cfg.raciocinio !== 'none' ? 'none' : 'medium' })
    pintarPensar()
  }
  $('pasta-chip').onclick = async () => {
    const p = await window.sb.escolherPasta()
    if (p) {
      cfg = await window.sb.salvarCfg({ pasta: p })
      pintarPasta()
    }
  }

  // ---------- modo de permissão do agente ----------
  const MODOS = [
    { id: 'manual', nome: 'Manual', curto: 'Manual', desc: 'Pergunta antes de escrever arquivos e de rodar comandos.' },
    { id: 'editar', nome: 'Editar sozinho', curto: 'Editar', desc: 'Edita arquivos da pasta de trabalho sem perguntar. Comandos e o resto ainda perguntam.' },
    { id: 'auto', nome: 'Automático', curto: 'Automático', desc: 'Aprova o que é seguro (ler, editar na pasta, comandos comuns) e pergunta nos arriscados: apagar, instalar, rede e sistema.' },
    { id: 'ignorar', nome: 'Ignorar permissões', curto: 'Sem perguntas', desc: 'Nunca pergunta. O agente pode apagar e alterar qualquer coisa no computador.', perigo: true },
  ]
  const modoAtual = () => MODOS.find((m) => m.id === (cfg.modoPermissao || 'manual')) || MODOS[0]
  function pintarPermissao() {
    const m = modoAtual()
    const b = $('permissao')
    b.classList.toggle('perm-ignorar', m.id === 'ignorar')
    $('permissao-nome').textContent = m.curto
    b.title = `Permissões: ${m.nome}. ${m.desc}`
  }
  function fecharMenuPerm() {
    $('menu-permissao').hidden = true
  }
  $('permissao').onclick = (e) => {
    e.stopPropagation()
    const menu = $('menu-permissao')
    if (!menu.hidden) return fecharMenuPerm()
    fecharMenu()
    menu.innerHTML = '<div class="menu-grupo">Permissões do agente</div>' + MODOS.map((m) => `<button class="menu-item ${m.perigo ? 'perigo' : ''} ${m.id === modoAtual().id ? 'on' : ''}" role="menuitem" data-modo="${m.id}"><span class="mnome">${esc(m.nome)}<small>${esc(m.desc)}</small></span><span class="ok">${IC.check}</span></button>`).join('')
    menu.hidden = false
  }
  $('menu-permissao').onclick = async (e) => {
    const b = e.target.closest('[data-modo]')
    if (!b) return
    const id = b.dataset.modo
    if (id === 'ignorar' && !window.confirm('Modo "Ignorar permissões": o agente deixa de pedir confirmação e pode apagar ou alterar qualquer arquivo e rodar qualquer comando no seu computador.\n\nLigar mesmo assim?')) return
    cfg = await window.sb.salvarCfg({ modoPermissao: id })
    pintarPermissao()
    fecharMenuPerm()
  }

  // ---------- navegador integrado ----------
  const NAV = window.sb.navegador
  let navAberto = false
  function navPos() {
    if (!navAberto) return
    const r = $('nav-host').getBoundingClientRect()
    NAV.limites({ x: r.x, y: r.y, width: r.width, height: r.height })
  }
  async function navAbrir(sim) {
    navAberto = !!sim
    $('nav').hidden = !sim
    $('app').classList.toggle('nav-aberto', !!sim)
    $('abrir-nav').classList.toggle('on', !!sim)
    await NAV.mostrar(!!sim)
    if (sim) setTimeout(navPos, 80)
    if (window.__sbWeb) webNavLigar(!!sim)
  }
  // Versão web: a página roda na máquina (computador ou VM); aqui aparece uma captura ao vivo, e clique, rolagem e teclado
  // do usuário viram entradas na página de lá.
  let webNavTimer = null
  let webNavImg = null
  let webNavDim = { largura: 1, altura: 1 }
  function webNavLigar(sim) {
    clearInterval(webNavTimer)
    if (!sim) return
    const host = $('nav-host')
    if (!webNavImg) {
      host.style.position = 'relative'
      host.innerHTML = '<img id="nav-web-img" alt="Página do navegador da máquina" tabindex="0" draggable="false" style="width:100%;height:100%;object-fit:contain;object-position:top left;display:block;outline:none;cursor:pointer;background:#fff"><form id="nav-web-teclado" style="position:absolute;left:0;right:0;bottom:0;display:flex;gap:6px;padding:8px;background:rgba(20,16,12,.92)"><input id="nav-web-texto" placeholder="Digitar na página (clique antes no campo)" autocomplete="off" style="flex:1;min-width:0"><button type="submit" class="primario">Digitar</button><button type="button" id="nav-web-enter">Enter</button></form>'
      webNavImg = $('nav-web-img')
      webNavImg.addEventListener('click', (e) => {
        const r = webNavImg.getBoundingClientRect()
        const esc = Math.min(r.width / webNavDim.w, r.height / webNavDim.h)
        const x = ((e.clientX - r.left) / esc) * (webNavDim.largura / webNavDim.w)
        const y = ((e.clientY - r.top) / esc) * (webNavDim.altura / webNavDim.h)
        NAV.clique(x, y)
        webNavImg.focus()
      })
      webNavImg.addEventListener('wheel', (e) => {
        e.preventDefault()
        NAV.rolarPonto(e.deltaY > 0 ? -300 : 300, 200, 200)
      }, { passive: false })
      webNavImg.addEventListener('keydown', (e) => {
        if (/^(Enter|Backspace|Tab|Escape|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Delete|Home|End|PageUp|PageDown)$/.test(e.key)) {
          e.preventDefault()
          NAV.tecla(e.key)
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          NAV.digitarTexto(e.key)
        }
      })
      $('nav-web-teclado').onsubmit = (e) => {
        e.preventDefault()
        const t = $('nav-web-texto')
        if (t.value) NAV.digitarTexto(t.value)
        t.value = ''
      }
      $('nav-web-enter').onclick = () => NAV.tecla('Enter')
    }
    const atualizar = async () => {
      if (!navAberto || document.hidden) return
      const c = await NAV.captura().catch(() => null)
      if (!c) return
      webNavDim = { largura: c.largura, altura: c.altura, w: c.w, h: c.h }
      webNavImg.src = 'data:image/jpeg;base64,' + c.base64
    }
    atualizar()
    webNavTimer = setInterval(atualizar, 1500)
  }
  $('abrir-nav').onclick = () => navAbrir(!navAberto)
  $('nav-fechar').onclick = () => navAbrir(false)
  $('nav-voltar').onclick = () => NAV.acao('voltar')
  $('nav-avancar').onclick = () => NAV.acao('avancar')
  $('nav-recarregar').onclick = () => NAV.acao('recarregar')
  $('nav-form').onsubmit = async (e) => {
    e.preventDefault()
    const r = await NAV.acao('ir', $('nav-url').value)
    if (r && r.ok === false) aviso('Não consegui abrir: ' + r.erro)
  }
  // favoritos: estrela salva/remove a página atual; o menu lista e importa dos marcadores do Chrome/Edge/Brave
  let navUrlAtual = { url: '', titulo: '' }
  async function desenharFavoritos() {
    const m = $('nav-fav-menu')
    const favs = await NAV.favoritos()
    const ja = favs.some((f) => f.url === navUrlAtual.url)
    m.innerHTML = `<div class="fav-topo"><button data-fav="toggle">${ja ? 'Remover esta página' : 'Favoritar esta página'}</button><button data-fav="importar">Importar do Chrome/Edge</button></div>` +
      (favs.length ? favs.slice(0, 300).map((f) => `<button class="fav-item" data-fav-url="${esc(f.url)}" title="${esc(f.url)}">${esc(f.titulo)}</button>`).join('') : '<div class="fav-vazio">Nenhum favorito ainda.</div>')
  }
  $('nav-fav').onclick = async () => {
    const m = $('nav-fav-menu')
    m.hidden = !m.hidden
    NAV.esconderTemp(!m.hidden)
    if (!m.hidden) await desenharFavoritos()
  }
  $('nav-fav-menu').onclick = async (e) => {
    const b = e.target.closest('button')
    if (!b) return
    if (b.dataset.fav === 'toggle' && navUrlAtual.url) await NAV.favoritar(navUrlAtual)
    else if (b.dataset.fav === 'importar') {
      const r = await NAV.importarFavoritos()
      aviso(r.novos ? `${r.novos} favoritos importados.` : 'Nenhum favorito novo encontrado.')
    } else if (b.dataset.favUrl) {
      $('nav-fav-menu').hidden = true
      NAV.esconderTemp(false)
      return NAV.acao('ir', b.dataset.favUrl)
    }
    await desenharFavoritos()
  }
  NAV.aoEstado((e) => {
    navUrlAtual = { url: e.url || '', titulo: e.titulo || '' }
    if (document.activeElement !== $('nav-url')) $('nav-url').value = e.url || ''
    $('nav-voltar').disabled = !e.podeVoltar
    $('nav-avancar').disabled = !e.podeAvancar
    $('nav-ctl').hidden = !e.controlando
    $('nav').classList.toggle('carregando', !!e.carregando)
    $('nav-vazio').hidden = !!e.url
  })
  NAV.aoAbrirPainel(() => navAbrir(true))
  new ResizeObserver(navPos).observe($('nav-host'))
  window.addEventListener('resize', navPos)
  window.addEventListener('sb-config-abriu', () => NAV.esconderTemp(true))
  window.addEventListener('sb-config-fechou', () => NAV.esconderTemp(false))

  async function preencherAlvo() {
    modelos = await window.sb.modelos()
    if (!modelos.some((m) => m.id === cfg.ativo) && modelos.length) cfg = await window.sb.salvarCfg({ ativo: (modelos.find((m) => m.grupo === 'Combos') || modelos[0]).id })
    $('boas-vindas').hidden = modelos.length > 0 || faseAnterior === 'pendente' || faseAnterior === 'erro'
    pintarSeletor()
    pintarModo()
    pintarPensar()
    pintarPasta()
  }
  window.preencherAlvo = preencherAlvo

  // ---------- acesso ao Unlimited (cadastro automático) ----------
  let faseAnterior = ''
  // login: a tela cheia aparece quando nao ha conta entrada; some sozinha quando o acesso fica ativo
  const loginMsg = (txt, ok) => {
    const m = $('login-msg')
    m.hidden = !txt
    m.textContent = txt || ''
    m.classList.toggle('ok', !!ok)
  }
  $('login-form').onsubmit = async (ev) => {
    ev.preventDefault()
    const btn = $('login-entrar')
    btn.disabled = true
    btn.textContent = 'Entrando…'
    loginMsg('')
    const r = await window.sb.unlimitedEntrar($('login-email').value, $('login-senha').value)
    btn.disabled = false
    btn.textContent = 'Entrar'
    if (r.ok) {
      $('login-senha').value = ''
      $('login').hidden = true
      cfg = await window.sb.cfg()
      pintarConta()
    } else loginMsg(r.erro, false)
  }
  $('login-esqueci').onclick = async () => {
    const email = $('login-email').value.trim()
    if (!email) return loginMsg('Digite o seu e-mail acima e toque de novo em "Esqueci a senha".')
    await window.sb.unlimitedEsqueci(email)
    loginMsg('Se este e-mail tiver uma conta, enviamos o link para criar uma nova senha. Se não chegar, peça o link ao suporte.', true)
  }
  // botão Conta: sem conta entrada abre o login (com "Agora não"); com conta mostra quem está entrado e deixa sair
  const pintarConta = () => {
    const email = cfg?.unlimitedEmail
    $('conta-rotulo').textContent = email ? email : 'Entrar na conta'
  }
  $('abrir-conta').onclick = async () => {
    cfg = await window.sb.cfg()
    if (cfg.unlimitedEmail) {
      if (confirm(`Sair da conta ${cfg.unlimitedEmail}? O app deixa de usar o Unlimited neste computador até você entrar de novo.`)) {
        await window.sb.unlimitedSair()
        cfg = await window.sb.cfg()
        pintarConta()
      }
      return
    }
    $('login').hidden = false
    setTimeout(() => $('login-email').focus(), 50)
  }
  $('login-assinar').onclick = () => window.sb.abrirExterno('https://brain.rangeltech.net')
  function pintarAcesso(e) {
    if (e) {
      const mostrarLogin = e.fase === 'login'
      $('login').hidden = !mostrarLogin
      if (mostrarLogin && e.detalhe) loginMsg(e.detalhe, false)
      if (mostrarLogin) setTimeout(() => $('login-email').focus(), 50)
    }
    const el = $('acesso')
    const mostrar = e && (e.fase === 'pendente' || e.fase === 'erro' || (e.fase === 'ativo' && faseAnterior === 'pendente'))
    el.hidden = !mostrar
    el.className = 'acesso' + (e && e.fase === 'ativo' ? ' ok' : e && e.fase === 'erro' ? ' erro' : '')
    if (mostrar) {
      if (e.fase === 'pendente') {
        $('acesso-tit').textContent = 'Seu acesso está aguardando liberação'
        $('acesso-sub').textContent = e.detalhe || 'Assim que for liberado, o app começa a funcionar sozinho.'
      } else if (e.fase === 'ativo') {
        $('acesso-tit').textContent = 'Acesso liberado!'
        $('acesso-sub').textContent = 'O Unlimited já está pronto para usar.'
        setTimeout(() => ($('acesso').hidden = true), 6000)
      } else {
        $('acesso-tit').textContent = 'Acesso com problema'
        $('acesso-sub').textContent = e.detalhe || ''
      }
      $('acesso-cod').hidden = !e.codigo || e.fase === 'ativo'
      $('acesso-codigo').textContent = e.codigo || ''
    }
    if (e && e.fase === 'ativo' && faseAnterior !== 'ativo') preencherAlvo()
    if (e) faseAnterior = e.fase
    if (e) $('boas-vindas').hidden = $('boas-vindas').hidden || e.fase === 'pendente' || e.fase === 'erro'
  }
  $('acesso-copiar').onclick = async () => {
    await navigator.clipboard.writeText($('acesso-codigo').textContent).catch(() => {})
    $('acesso-copiar').textContent = 'Copiado'
    setTimeout(() => ($('acesso-copiar').textContent = 'Copiar código'), 1800)
  }
  window.sb.aoUnlimited(pintarAcesso)

  async function iniciar() {
    cfg = await window.sb.cfg()
    chats = await window.sb.chats()
    for (const c of chats) assinatura.set(c.id, assinar(c))
    window.aplicarIcones()
    pintarPensar()
    pintarModo()
    pintarPermissao()
    pintarPasta()
    alternarBotao(false)
    preencherAlvo()
    window.sb.unlimitedEstado().then(pintarAcesso)
    pintarConta()
    setTimeout(preencherAlvo, 6000)
    listar()
    desenhar()
    const mq = window.matchMedia('(max-width:820px)')
    const ajustar = () => {
      if (mq.matches) recolher(true)
      $('texto').placeholder = window.matchMedia('(max-width:560px)').matches ? 'Escreva uma mensagem…' : 'Escreva uma mensagem, anexe um arquivo ou grave um áudio'
    }
    ajustar()
    mq.addEventListener('change', ajustar)
    window.matchMedia('(max-width:560px)').addEventListener('change', ajustar)
    $('novo').onclick = () => (criarChat(), estreito() && recolher(true))
    $('enviar').onclick = enviar
    $('busca').oninput = listar
    $('recolher').onclick = () => recolher(true)
    $('mostrar').onclick = () => recolher(!$('app').classList.contains('recolhido'))
    $('cortina').onclick = () => recolher(true)
    $('abrir-config').onclick = () => window.SBConfig.abrir()
    $('bv-ir').onclick = () => window.SBConfig.abrir('prov')
    window.SBConfig.aoFechar = async () => {
      cfg = await window.sb.cfg()
      preencherAlvo()
    }
    const t = $('texto')
    t.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault()
        enviar()
      }
    })
    t.addEventListener('input', () => {
      if (respostas.has(atual)) alternarBotao(true)
      t.style.height = 'auto'
      t.style.height = Math.min(t.scrollHeight, Math.round(window.innerHeight * 0.45)) + 'px'
      t.style.overflowY = t.scrollHeight > window.innerHeight * 0.45 ? 'auto' : 'hidden'
    })
    if (chats.length === 0) criarChat()
    else abrir([...chats].sort(ordem)[0].id)
  }
  // alterações feitas por outra tela (outro computador, a web ou outra pessoa do mesmo login)
  window.sb.aoChatsMudou((d) => {
    let mudou = false
    let atualMudou = false
    for (const r of d.chats || []) {
      const l = chats.find((x) => x.id === r.id)
      if (!l) {
        chats.push(r)
        assinatura.set(r.id, assinar(r))
        mudou = true
      } else if ((r.mod || r.em || 0) > (l.mod || l.em || 0) && !respostas.has(l.id)) {
        Object.assign(l, r)
        assinatura.set(l.id, assinar(l))
        mudou = true
        if (l.id === atual) atualMudou = true
      }
    }
    const antes = chats.length
    const mortos = new Set(d.apagados || [])
    chats = chats.filter((c) => !mortos.has(c.id) || respostas.has(c.id))
    if (chats.length !== antes) {
      mudou = true
      if (atual && !chats.some((c) => c.id === atual)) {
        atual = null
        atualMudou = true
      }
    }
    if (!mudou) return
    listar()
    if (atualMudou) atual ? abrir(atual) : desenhar()
  })

  window.SB = { enviar: (txt) => (($('texto').value = txt), enviar()), anexos: () => anexosPendentes, chats: () => chats }
  iniciar()
})()
