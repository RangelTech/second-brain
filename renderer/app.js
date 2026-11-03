(() => {
  const $ = (id) => document.getElementById(id)
  const IC = window.IC
  let cfg = null
  let chats = []
  let atual = null
  let enviando = null // id do chat em resposta
  let resposta = null // elementos da resposta em curso
  let anexosPendentes = [] // {nome, caminho, tipo}
  let gravador = null
  let modelos = []

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const attr = (s) => esc(s).replace(/'/g, '&#39;')
  const CAT = Object.fromEntries(((window.SB_CATALOGO && window.SB_CATALOGO.provedores) || []).map((p) => [p.id, p]))

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
        for (const l of linhas) {
          const li = /^\s*[-*]\s+(.*)$/.exec(l)
          if (li) {
            if (!lista) saida.push('<ul>'), (lista = true)
            saida.push('<li>' + li[1] + '</li>')
            continue
          }
          if (lista) saida.push('</ul>'), (lista = false)
          const h = /^(#{1,3})\s+(.*)$/.exec(l)
          saida.push(h ? `<h${h[1].length + 2}>${h[2]}</h${h[1].length + 2}>` : l.trim() === '' ? (saida.length && !/<br>$/.test(saida[saida.length - 1]) ? '<br>' : '') : l + '<br>')
        }
        if (lista) saida.push('</ul>')
        return saida
          .join('')
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
  const salvar = () => window.sb.salvarChats(chats)
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
      b.innerHTML = `${c.fixado ? `<span class="pin-marca">${IC.pin}</span>` : ''}<span class="nome" title="${attr(c.titulo)}">${esc(c.titulo)}</span><span class="acoes"><button class="btn-ic fixar" title="${c.fixado ? 'Desafixar' : 'Fixar no topo'}" aria-label="${c.fixado ? 'Desafixar conversa' : 'Fixar conversa'}">${IC.pin}</button><button class="btn-ic ren" title="Renomear" aria-label="Renomear conversa">${IC.pencil}</button><button class="apagar btn-ic" title="Apagar" aria-label="Apagar conversa">${IC.x}</button></span>`
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
  function atualizarCartao(d, f) {
    const estado = f.status === 'completed' ? IC.check : f.status === 'failed' ? IC.x : '<span class="rodando"></span>'
    const tipo = f.tipo || 'other'
    const titulo = tituloLimpo(f.titulo)
    const caminho = f.caminho
    d.className = 'ferr ' + (f.status || 'pending')
    d.innerHTML = `<details ${f.conteudo || f.entrada ? '' : 'class="sem-corpo"'}><summary><span class="fi">${IC[ICONE_FERR[tipo]] || IC.sparkles}</span><span class="ft"><b>${esc(ROTULO_FERR[tipo] || '')}</b> ${esc(titulo)}</span><span class="fe">${estado}</span></summary>
      <div class="fcorpo">${f.entrada ? `<div class="mut">${esc(f.entrada)}</div>` : ''}${f.conteudo ? `<pre>${esc(f.conteudo)}</pre>` : ''}</div></details>
      ${caminho && f.status === 'completed' && tipo === 'edit' ? `<div class="facoes"><button data-abrir="${attr(caminho)}">${IC.file}Abrir ${esc(nomeArq(caminho))}</button><button data-mostrar="${attr(caminho)}">${IC.folder}Mostrar na pasta</button></div>` : ''}`
  }

  function partesDe(m) {
    return m.partes || [{ t: 'texto', v: m.content }]
  }
  function renderPartes(el, partes) {
    el.innerHTML = ''
    for (const p of partes) {
      if (p.t === 'texto') {
        const c = document.createElement('div')
        c.className = 'corpo'
        c.innerHTML = md(p.v)
        el.appendChild(c)
      } else if (p.t === 'ferr') el.appendChild(cartaoFerramenta(p.f))
    }
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
    const linha = [titulo, `${hhmm(m.inicio)} às ${hhmm(m.fim)}`, total ? `${nTokens(total)} tokens` : ''].filter(Boolean).join(' · ')
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
    const acoes = `<div class="facoes" style="padding:0"><button data-abrir="${attr(caminho)}">Abrir</button><button data-mostrar="${attr(caminho)}">${IC.folder}Mostrar na pasta</button></div>`
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

  function desenhar() {
    const el = $('conversa')
    const c = chatAtual()
    el.innerHTML = ''
    $('titulo').textContent = c && c.msgs.length ? c.titulo : 'Nova conversa'
    if (!c || c.msgs.length === 0) {
      el.appendChild(telaInicial())
      return
    }
    for (const m of c.msgs) el.appendChild(bolha(m))
    el.scrollTop = el.scrollHeight
  }

  function alternarBotao(parar) {
    const b = $('enviar')
    b.innerHTML = parar ? IC.stop : IC.arrowUp
    b.classList.toggle('parar', parar)
    b.setAttribute('aria-label', parar ? 'Parar' : 'Enviar')
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
  async function alternarGravacao() {
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
  $('microfone').onclick = alternarGravacao

  function aviso(txt) {
    const a = $('aviso-geral')
    a.textContent = txt
    a.hidden = !txt
    if (txt) setTimeout(() => (a.hidden = true), 6000)
  }

  // ---------- envio ----------
  async function enviar() {
    if (enviando) {
      window.sb.parar(enviando)
      return
    }
    const t = $('texto').value.trim()
    if (!t && !anexosPendentes.length) return
    if (!cfg.ativo) return aviso('Escolha um modelo antes de enviar (ou conecte um provedor em Configurações).')
    if (!chatAtual()) criarChat()
    const c = chatAtual()
    const anexos = anexosPendentes
    anexosPendentes = []
    desenharAnexos()
    const texto = t || 'Veja o(s) arquivo(s) anexado(s).'
    c.msgs.push({ role: 'user', em: Date.now(), content: texto, anexos: anexos.map((a) => ({ nome: a.nome, caminho: a.caminho })) })
    if (!c.tituloManual && (c.titulo === 'Nova conversa' || c.titulo === 'Novo chat')) c.titulo = texto.slice(0, 42)
    c.em = Date.now()
    $('texto').value = ''
    $('texto').style.height = 'auto'
    desenhar()
    listar()
    const caixa = $('conversa')
    const d = document.createElement('div')
    d.className = 'msg assistant'
    d.innerHTML = `${QUEM}</div><div class="atividade" id="atividade"><span class="ponto-vivo"></span><span class="atv-txt">Enviando…</span><span class="tempo">0 s</span><span class="atv-extra"></span></div><details class="raciocinio" hidden><summary>Raciocínio</summary><div class="rtxt"></div></details><div class="aviso" hidden></div><div class="partes"></div>`
    caixa.appendChild(d)
    caixa.scrollTop = caixa.scrollHeight
    resposta = { id: c.id, el: d, partes: [], raz: '', midias: [], inicio: Date.now(), ultimo: Date.now(), fase: 'Enviando…', timer: null }
    resposta.timer = setInterval(tiquetaque, 1000)
    enviando = c.id
    alternarBotao(true)
    resposta.fase = 'Aguardando o modelo…'
    window.sb.enviar({ id: c.id, mensagens: c.msgs.map(({ role, content }) => ({ role, content })), alvo: cfg.ativo, anexos: anexos.map((a) => a.caminho) })
  }

  function fim(texto, erro, uso) {
    if (!resposta) return
    clearInterval(resposta.timer)
    const c = chats.find((x) => x.id === resposta.id)
    if (c) {
      const partes = resposta.partes.length ? resposta.partes : texto ? [{ t: 'texto', v: texto }] : []
      if (erro) partes.push({ t: 'texto', v: `⚠ ${erro}` })
      const conteudo = partes.filter((p) => p.t === 'texto').map((p) => p.v).join('\n') || '(sem resposta)'
      c.msgs.push({ role: 'assistant', content: conteudo, partes, raciocinio: resposta.raz || undefined, midias: resposta.midias, inicio: resposta.inicio, fim: Date.now(), uso: uso || undefined })
      c.em = Date.now()
      salvar()
    }
    resposta = null
    enviando = null
    alternarBotao(false)
    if (c && c.id === atual) desenhar()
    listar()
  }

  const fmtTempo = (ms) => {
    const t = Math.floor(ms / 1000)
    return t < 60 ? t + ' s' : Math.floor(t / 60) + ' min ' + String(t % 60).padStart(2, '0') + ' s'
  }
  // atualiza o relógio e avisa quando o modelo fica muito tempo sem dar sinal
  function tiquetaque() {
    if (!resposta) return
    const at = resposta.el.querySelector('.atividade')
    if (!at) return
    const parado = Date.now() - resposta.ultimo
    at.querySelector('.tempo').textContent = fmtTempo(Date.now() - resposta.inicio)
    at.querySelector('.atv-txt').textContent = parado > 20000 && resposta.fase !== 'Executando ferramenta' ? resposta.fase.replace('…', '') + ' (sem novidades há ' + fmtTempo(parado) + ')' : resposta.fase
    const demora = parado > 60000
    at.classList.toggle('demora', demora)
    const extra = at.querySelector('.atv-extra')
    if (demora && !extra.firstChild) {
      extra.innerHTML = 'O modelo está demorando. <button data-act="parar">Parar</button>' + (cfg.raciocinio && cfg.raciocinio !== 'none' ? ' <button data-act="desligar">Parar e desligar o raciocínio</button>' : '')
    } else if (!demora && extra.firstChild) extra.innerHTML = ''
  }
  document.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-act]')
    if (!a || !enviando) return
    if (a.dataset.act === 'desligar') {
      cfg = await window.sb.salvarCfg({ raciocinio: 'none' })
      pintarPensar()
    }
    window.sb.parar(enviando)
  })
  function sinal(fase) {
    if (!resposta) return
    resposta.ultimo = Date.now()
    if (fase) resposta.fase = fase
  }
  const EXT_MIDIA = /\.(png|jpe?g|gif|webp|svg|mp3|wav|ogg|m4a|mp4|mov)$/i
  window.sb.aoDelta((d) => {
    if (!resposta || d.id !== resposta.id) return
    const caixa = $('conversa')
    if (d.raciocinio) {
      resposta.raz += d.raciocinio
      sinal('Pensando… (' + Math.round(resposta.raz.length / 4) + ' palavras)')
      const det = resposta.el.querySelector('.raciocinio')
      det.hidden = false
      det.open = true
      det.querySelector('.rtxt').textContent = resposta.raz
    }
    if (d.aviso) {
      sinal()
      const a = resposta.el.querySelector('.aviso')
      a.hidden = false
      a.textContent = d.aviso
    }
    if (d.texto) {
      sinal('Escrevendo a resposta…')
      const ult = resposta.partes[resposta.partes.length - 1]
      if (ult && ult.t === 'texto') ult.v += d.texto
      else resposta.partes.push({ t: 'texto', v: d.texto })
    }
    if (d.ferramenta) {
      const f = d.ferramenta
      sinal(f.status === 'completed' || f.status === 'failed' ? 'Analisando o resultado…' : 'Executando ferramenta')
      const existente = resposta.partes.find((p) => p.t === 'ferr' && p.f.id === f.id)
      if (existente) Object.assign(existente.f, Object.fromEntries(Object.entries(f).filter(([, v]) => v !== null && v !== undefined && v !== '')))
      else resposta.partes.push({ t: 'ferr', f: { ...f } })
      if (f.status === 'completed' && f.caminho && f.tipo === 'edit' && EXT_MIDIA.test(f.caminho) && !resposta.midias.includes(f.caminho)) resposta.midias.push(f.caminho)
    }
    renderPartes(resposta.el.querySelector('.partes'), resposta.partes)
    caixa.scrollTop = caixa.scrollHeight
  })
  window.sb.aoFim((d) => fim(d.texto, '', d.uso))
  window.sb.aoErro((d) => fim('', d.erro))

  // permissões do agente (cartão na conversa)
  window.sb.aoPermissao((p) => {
    if (!resposta || p.id !== resposta.id) return
    const caixa = $('conversa')
    const d = document.createElement('div')
    d.className = 'permissao'
    d.innerHTML = `<div><b>${IC.shield} O agente pede permissão</b><div class="mut">${esc(p.titulo)}</div></div><div class="facoes"><button data-p="permitir" class="primario">Permitir</button><button data-p="sempre">Permitir sempre nesta conversa</button><button data-p="negar">Negar</button></div>`
    d.onclick = (e) => {
      const r = e.target.dataset?.p
      if (!r) return
      window.sb.responderPermissao(p.req, r)
      d.remove()
    }
    resposta.el.appendChild(d)
    caixa.scrollTop = caixa.scrollHeight
  })

  // ações dos cartões e mídia
  document.addEventListener('click', (e) => {
    const ab = e.target.closest('[data-abrir]')
    if (ab) return window.sb.abrirArquivo(ab.dataset.abrir)
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
  NAV.aoEstado((e) => {
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
  function pintarAcesso(e) {
    const el = $('acesso')
    const mostrar = e && (e.fase === 'pendente' || e.fase === 'erro' || (e.fase === 'ativo' && faseAnterior === 'pendente'))
    el.hidden = !mostrar
    el.className = 'acesso' + (e && e.fase === 'ativo' ? ' ok' : e && e.fase === 'erro' ? ' erro' : '')
    if (mostrar) {
      if (e.fase === 'pendente') {
        $('acesso-tit').textContent = 'Falta liberar o seu acesso'
        $('acesso-sub').textContent = 'Envie este código para a Rangel Tech. Quando liberarem, o app começa a funcionar sozinho.'
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
    window.aplicarIcones()
    pintarPensar()
    pintarModo()
    pintarPermissao()
    pintarPasta()
    alternarBotao(false)
    preencherAlvo()
    window.sb.unlimitedEstado().then(pintarAcesso)
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
      t.style.height = 'auto'
      t.style.height = Math.min(t.scrollHeight, 220) + 'px'
    })
    if (chats.length === 0) criarChat()
    else abrir([...chats].sort(ordem)[0].id)
  }
  // ---------- controle remoto: ordens vindas do celular (spec 20) ----------
  window.sb.remoto.aoComando((m) => {
    const R = (o) => window.sb.remoto.responder({ para: m.de, ...o })
    const resumo = () => chats.slice().sort((a, b) => (b.fixado ? 1 : 0) - (a.fixado ? 1 : 0) || b.em - a.em).slice(0, 80).map((c) => ({ id: c.id, titulo: tituloLimpo(c.titulo), fixado: !!c.fixado, em: c.em, ocupado: enviando === c.id }))
    if (m.t === 'chats') return R({ t: 'chats', lista: resumo() })
    if (m.t === 'abrir') {
      const c = chats.find((x) => x.id === m.id)
      return R({ t: 'historico', id: m.id, ocupado: enviando === m.id, msgs: c ? c.msgs.slice(-60).map((x) => ({ role: x.role, content: String(x.content || '').slice(0, 8000), em: x.em, inicio: x.inicio, fim: x.fim, uso: x.uso })) : [] })
    }
    if (m.t === 'novo') {
      criarChat()
      return R({ t: 'novo', id: atual, lista: resumo() })
    }
    if (m.t === 'enviar') {
      const c = chats.find((x) => x.id === m.id)
      const texto = String(m.texto || '').trim().slice(0, 8000)
      if (!c || !texto) return R({ t: 'erro', id: m.id, texto: 'Conversa não encontrada.' })
      if (enviando) return R({ t: 'erro', id: m.id, texto: 'O computador está respondendo outra mensagem. Espere terminar.' })
      if (!cfg.ativo) return R({ t: 'erro', id: m.id, texto: 'Nenhum modelo escolhido no computador.' })
      abrir(c.id)
      $('texto').value = texto
      enviar()
      return R({ t: 'comecou', id: c.id })
    }
  })

  window.SB = { enviar: (txt) => (($('texto').value = txt), enviar()), anexos: () => anexosPendentes, chats: () => chats }
  iniciar()
})()
