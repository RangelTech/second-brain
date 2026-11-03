(() => {
  const $ = (id) => document.getElementById(id)
  let cfg = null
  let chats = []
  let atual = null
  let enviando = null // id do chat em resposta
  let resposta = null // elementos da resposta em curso
  let anexosPendentes = [] // {nome, caminho, tipo}
  let gravador = null

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const attr = (s) => esc(s).replace(/'/g, '&#39;')

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
          .replace(/(https?:\/\/[^\s<)]+)/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>')
      })
      .join('')
  }

  window.SBmd = md
  const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const salvar = () => window.sb.salvarChats(chats)
  const chatAtual = () => chats.find((c) => c.id === atual)

  // ---------- lista de conversas ----------
  function listar() {
    const q = $('busca').value.trim().toLowerCase()
    const el = $('lista')
    el.innerHTML = ''
    for (const c of chats.filter((c) => !q || c.titulo.toLowerCase().includes(q)).sort((a, b) => b.em - a.em)) {
      const b = document.createElement('button')
      b.className = 'chat' + (c.id === atual ? ' ativo' : '')
      b.innerHTML = `<span class="nome">${esc(c.titulo)}</span><span class="apagar" title="Apagar" role="button" aria-label="Apagar conversa">✕</span>`
      b.onclick = (e) => {
        if (e.target.classList.contains('apagar')) {
          chats = chats.filter((x) => x.id !== c.id)
          if (atual === c.id) atual = null
          salvar()
          listar()
          desenhar()
          return
        }
        abrir(c.id)
        if (window.matchMedia('(max-width:760px)').matches) $('app').classList.add('recolhido')
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
    const c = { id: novoId(), titulo: 'Novo chat', msgs: [], em: Date.now() }
    chats.push(c)
    salvar()
    abrir(c.id)
  }

  // ---------- desenho das mensagens ----------
  const ICONE_FERR = { read: '📖', edit: '✏️', delete: '🗑', move: '↔', search: '🔎', execute: '⌨', think: '💭', fetch: '🌐', other: '🔧' }
  const ROTULO_FERR = { read: 'Lendo arquivo', edit: 'Escrevendo arquivo', delete: 'Apagando', move: 'Movendo', search: 'Buscando', execute: 'Rodando comando', think: 'Pensando', fetch: 'Acessando a web', other: 'Usando ferramenta' }
  const nomeArq = (p) => String(p || '').split(/[\\/]/).pop()

  function cartaoFerramenta(f) {
    const d = document.createElement('div')
    d.className = 'ferr ' + (f.status || '')
    d.dataset.id = f.id || ''
    atualizarCartao(d, f)
    return d
  }
  function atualizarCartao(d, f) {
    const estado = f.status === 'completed' ? '✓' : f.status === 'failed' ? '✕' : '…'
    const tipo = f.tipo || 'other'
    const titulo = f.titulo || ROTULO_FERR[tipo]
    const caminho = f.caminho
    d.className = 'ferr ' + (f.status || 'pending')
    d.innerHTML = `<details ${f.conteudo || f.entrada ? '' : 'class="sem-corpo"'}><summary><span class="fi">${ICONE_FERR[tipo] || ICONE_FERR.other}</span><span class="ft"><b>${esc(ROTULO_FERR[tipo] || '')}</b> ${esc(titulo)}</span><span class="fe">${estado}</span></summary>
      <div class="fcorpo">${f.entrada ? `<div class="mut">${esc(f.entrada)}</div>` : ''}${f.conteudo ? `<pre>${esc(f.conteudo)}</pre>` : ''}</div></details>
      ${caminho && f.status === 'completed' && (tipo === 'edit' || tipo === 'read') ? `<div class="facoes"><button data-abrir="${attr(caminho)}">Abrir ${esc(nomeArq(caminho))}</button><button data-mostrar="${attr(caminho)}">Mostrar na pasta</button></div>` : ''}`
  }

  function partesDe(m) {
    if (m.partes) return m.partes
    return [{ t: 'texto', v: m.content }]
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

  function bolha(m) {
    const d = document.createElement('div')
    d.className = 'msg ' + m.role
    if (m.role === 'user') {
      d.innerHTML = `<div class="quem">Você</div><div class="corpo">${md(m.content)}</div>${(m.anexos || []).map((a) => `<div class="anexo-msg">📎 ${esc(a.nome)}</div>`).join('')}`
    } else {
      d.innerHTML = `<div class="quem"><img class="pv" src="img/unlimited.svg" alt="">Unlimited</div>${m.raciocinio ? `<details class="raciocinio"><summary>Raciocínio</summary><div class="rtxt">${esc(m.raciocinio)}</div></details>` : ''}<div class="partes"></div>`
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
    const rotulo = `<div class="facoes"><button data-abrir="${attr(caminho)}">Abrir</button><button data-mostrar="${attr(caminho)}">Mostrar na pasta</button></div>`
    if (tipo === 'arq') d.innerHTML = `<div class="anexo-msg">📄 ${esc(nomeArq(caminho))}</div>${rotulo}`
    else {
      d.innerHTML = `<div class="mut">${esc(nomeArq(caminho))}</div>${rotulo}`
      window.sb.lerArquivo(caminho).then((r) => {
        if (!r.ok) return
        const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', webm: tipo === 'video' ? 'video/webm' : 'audio/webm', m4a: 'audio/mp4', mp4: 'video/mp4', mov: 'video/quicktime' }[ext]
        const url = `data:${mime};base64,${r.base64}`
        const el = document.createElement(tipo === 'img' ? 'img' : tipo)
        el.src = url
        if (tipo !== 'img') el.controls = true
        el.className = 'midia-el'
        d.insertBefore(el, d.firstChild)
      })
    }
    return d
  }

  function desenhar() {
    const el = $('conversa')
    const c = chatAtual()
    el.innerHTML = ''
    $('titulo').textContent = c ? c.titulo : 'Novo chat'
    if (!c || c.msgs.length === 0) {
      el.innerHTML = `<div class="vazio" id="vazio"><img class="logo-img grande" src="img/second-brain.svg" alt=""><h1>Como posso ajudar?</h1><p>Converse com o Unlimited. Ele lê arquivos, roda comandos, cria sites e chama o Claude Code ou o Codex quando precisar.</p></div>`
      return
    }
    for (const m of c.msgs) el.appendChild(bolha(m))
    el.scrollTop = el.scrollHeight
  }

  function alternarBotao(parar) {
    const b = $('enviar')
    b.textContent = parar ? '■' : '↑'
    b.classList.toggle('parar', parar)
    b.setAttribute('aria-label', parar ? 'Parar' : 'Enviar')
  }

  // ---------- anexos e áudio ----------
  function desenharAnexos() {
    const el = $('anexos')
    el.hidden = anexosPendentes.length === 0
    el.innerHTML = anexosPendentes.map((a, i) => `<span class="chip-anexo">${a.tipo === 'audio' ? '🎙' : '📎'} ${esc(a.nome)}<button data-rm="${i}" aria-label="Remover anexo">✕</button></span>`).join('')
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
    const i = e.target.dataset?.rm
    if (i === undefined) return
    anexosPendentes.splice(+i, 1)
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
        b.setAttribute('aria-label', 'Gravar áudio')
        const blob = new Blob(partes, { type: rec.mimeType || 'audio/webm' })
        if (blob.size) await adicionarArquivo(new File([blob], `audio-${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.webm`, { type: blob.type }))
      }
      rec.start()
      gravador = rec
      b.classList.add('gravando')
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
    if (!chatAtual()) criarChat()
    const c = chatAtual()
    const anexos = anexosPendentes
    anexosPendentes = []
    desenharAnexos()
    const texto = t || 'Veja o(s) arquivo(s) anexado(s).'
    c.msgs.push({ role: 'user', content: texto, anexos: anexos.map((a) => ({ nome: a.nome, caminho: a.caminho })) })
    if (c.titulo === 'Novo chat') c.titulo = texto.slice(0, 42)
    c.em = Date.now()
    $('texto').value = ''
    $('texto').style.height = 'auto'
    desenhar()
    listar()
    const caixa = $('conversa')
    const d = document.createElement('div')
    d.className = 'msg assistant'
    d.innerHTML = `<div class="quem"><img class="pv" src="img/unlimited.svg" alt="">Unlimited <span class="pensando" id="pensando">trabalhando…</span></div><details class="raciocinio" hidden><summary>Raciocínio</summary><div class="rtxt"></div></details><div class="aviso" hidden></div><div class="partes"></div>`
    caixa.appendChild(d)
    caixa.scrollTop = caixa.scrollHeight
    resposta = { id: c.id, el: d, partes: [], raz: '', midias: [] }
    enviando = c.id
    alternarBotao(true)
    window.sb.enviar({ id: c.id, mensagens: c.msgs.map(({ role, content }) => ({ role, content })), alvo: $('alvo').value, anexos: anexos.map((a) => a.caminho) })
  }

  function fim(texto, erro) {
    if (!resposta) return
    const c = chats.find((x) => x.id === resposta.id)
    if (c) {
      const partes = resposta.partes.length ? resposta.partes : texto ? [{ t: 'texto', v: texto }] : []
      if (erro) partes.push({ t: 'texto', v: `⚠ ${erro}` })
      const conteudo = partes.filter((p) => p.t === 'texto').map((p) => p.v).join('\n') || '(sem resposta)'
      c.msgs.push({ role: 'assistant', content: conteudo, partes, raciocinio: resposta.raz || undefined, midias: resposta.midias })
      c.em = Date.now()
      salvar()
    }
    resposta = null
    enviando = null
    alternarBotao(false)
    if (c && c.id === atual) desenhar()
    listar()
  }

  const EXT_MIDIA = /\.(png|jpe?g|gif|webp|svg|mp3|wav|ogg|m4a|mp4|mov)$/i
  window.sb.aoDelta((d) => {
    if (!resposta || d.id !== resposta.id) return
    const caixa = $('conversa')
    if (d.raciocinio) {
      resposta.raz += d.raciocinio
      const det = resposta.el.querySelector('.raciocinio')
      det.hidden = false
      det.querySelector('.rtxt').textContent = resposta.raz
    }
    if (d.aviso) {
      const a = resposta.el.querySelector('.aviso')
      a.hidden = false
      a.textContent = d.aviso
    }
    if (d.texto) {
      const ult = resposta.partes[resposta.partes.length - 1]
      if (ult && ult.t === 'texto') ult.v += d.texto
      else resposta.partes.push({ t: 'texto', v: d.texto })
    }
    if (d.ferramenta) {
      const f = d.ferramenta
      const existente = resposta.partes.find((p) => p.t === 'ferr' && p.f.id === f.id)
      if (existente) Object.assign(existente.f, Object.fromEntries(Object.entries(f).filter(([, v]) => v !== null && v !== undefined && v !== '')))
      else resposta.partes.push({ t: 'ferr', f: { ...f } })
      if (f.status === 'completed' && f.caminho && f.tipo === 'edit' && EXT_MIDIA.test(f.caminho) && !resposta.midias.includes(f.caminho)) resposta.midias.push(f.caminho)
    }
    renderPartes(resposta.el.querySelector('.partes'), resposta.partes)
    caixa.scrollTop = caixa.scrollHeight
  })
  window.sb.aoFim((d) => fim(d.texto))
  window.sb.aoErro((d) => fim('', d.erro))

  // permissões do agente (cartão na conversa)
  window.sb.aoPermissao((p) => {
    if (!resposta || p.id !== resposta.id) return
    const caixa = $('conversa')
    const d = document.createElement('div')
    d.className = 'permissao'
    d.innerHTML = `<div><b>O agente quer permissão</b><div class="mut">${esc(p.titulo)}</div></div><div class="facoes"><button data-p="permitir" class="primario">Permitir</button><button data-p="sempre">Permitir sempre nesta conversa</button><button data-p="negar">Negar</button></div>`
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
  })

  // ---------- alvo, modo, pasta ----------
  async function preencherAlvo() {
    const s = $('alvo')
    const lista = await window.sb.modelos()
    s.innerHTML = ''
    if (!lista.length) s.appendChild(new Option('Nenhum modelo: cadastre um provedor', ''))
    for (const grupo of ['Combos', 'Modelos']) {
      const itens = lista.filter((m) => m.grupo === grupo)
      if (!itens.length) continue
      const og = document.createElement('optgroup')
      og.label = grupo
      for (const m of itens) og.appendChild(new Option(m.nome, m.id))
      s.appendChild(og)
    }
    if (lista.some((m) => m.id === cfg.ativo)) s.value = cfg.ativo
    else if (lista.length) {
      s.value = lista[0].id
      cfg = await window.sb.salvarCfg({ ativo: lista[0].id })
    }
    $('so-conversa').checked = !!cfg.soConversa
    $('pasta').textContent = cfg.pasta
  }

  async function iniciar() {
    cfg = await window.sb.cfg()
    chats = await window.sb.chats()
    preencherAlvo()
    setTimeout(preencherAlvo, 6000)
    listar()
    desenhar()
    if (window.matchMedia('(max-width:760px)').matches) $('app').classList.add('recolhido')
    $('novo').onclick = criarChat
    $('enviar').onclick = enviar
    $('busca').oninput = listar
    $('recolher').onclick = () => $('app').classList.add('recolhido')
    $('mostrar').onclick = () => $('app').classList.toggle('recolhido')
    $('alvo').onchange = async () => (cfg = await window.sb.salvarCfg({ ativo: $('alvo').value }))
    $('so-conversa').onchange = async () => (cfg = await window.sb.salvarCfg({ soConversa: $('so-conversa').checked }))
    $('abrir-config').onclick = () => window.SBConfig.abrir()
    window.SBConfig.aoFechar = async () => {
      cfg = await window.sb.cfg()
      preencherAlvo()
    }
    const t = $('texto')
    t.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        enviar()
      }
    })
    t.addEventListener('input', () => {
      t.style.height = 'auto'
      t.style.height = Math.min(t.scrollHeight, 220) + 'px'
    })
    if (chats.length === 0) criarChat()
    else abrir(chats.sort((a, b) => b.em - a.em)[0].id)
  }
  window.SB = { enviar: (txt) => (($('texto').value = txt), enviar()), anexos: () => anexosPendentes, chats: () => chats }
  iniciar()
})()
