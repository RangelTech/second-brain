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
          .replace(/(https?:\/\/[^\s<)]+)/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>')
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

  function listar() {
    const q = $('busca').value.trim().toLowerCase()
    const el = $('lista')
    el.innerHTML = ''
    for (const c of chats.filter((c) => !q || c.titulo.toLowerCase().includes(q)).sort((a, b) => b.em - a.em)) {
      const b = document.createElement('div')
      b.className = 'chat' + (c.id === atual ? ' ativo' : '')
      b.tabIndex = 0
      b.setAttribute('role', 'button')
      b.innerHTML = `<span class="nome">${esc(c.titulo)}</span><button class="apagar btn-ic" title="Apagar conversa" aria-label="Apagar conversa">${IC.x}</button>`
      b.onclick = (e) => {
        if (e.target.closest('.apagar')) {
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
      b.onkeydown = (e) => e.key === 'Enter' && b.click()
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
  function bolha(m) {
    const d = document.createElement('div')
    d.className = 'msg ' + m.role
    if (m.role === 'user') {
      d.innerHTML = `<div class="corpo">${md(m.content)}</div>${(m.anexos || []).map((a) => `<div class="anexo-msg">${IC.clip}${esc(a.nome)}</div>`).join('')}`
    } else {
      d.innerHTML = `${QUEM}</div>${m.raciocinio ? `<details class="raciocinio"><summary>Raciocínio</summary><div class="rtxt">${esc(m.raciocinio)}</div></details>` : ''}<div class="partes"></div>`
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
    c.msgs.push({ role: 'user', content: texto, anexos: anexos.map((a) => ({ nome: a.nome, caminho: a.caminho })) })
    if (c.titulo === 'Nova conversa' || c.titulo === 'Novo chat') c.titulo = texto.slice(0, 42)
    c.em = Date.now()
    $('texto').value = ''
    $('texto').style.height = 'auto'
    desenhar()
    listar()
    const caixa = $('conversa')
    const d = document.createElement('div')
    d.className = 'msg assistant'
    d.innerHTML = `${QUEM}<span class="pensando" id="pensando">trabalhando</span></div><details class="raciocinio" hidden><summary>Raciocínio</summary><div class="rtxt"></div></details><div class="aviso" hidden></div><div class="partes"></div>`
    caixa.appendChild(d)
    caixa.scrollTop = caixa.scrollHeight
    resposta = { id: c.id, el: d, partes: [], raz: '', midias: [] }
    enviando = c.id
    alternarBotao(true)
    window.sb.enviar({ id: c.id, mensagens: c.msgs.map(({ role, content }) => ({ role, content })), alvo: cfg.ativo, anexos: anexos.map((a) => a.caminho) })
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
  $('pasta-chip').onclick = async () => {
    const p = await window.sb.escolherPasta()
    if (p) {
      cfg = await window.sb.salvarCfg({ pasta: p })
      pintarPasta()
    }
  }

  async function preencherAlvo() {
    modelos = await window.sb.modelos()
    if (!modelos.some((m) => m.id === cfg.ativo) && modelos.length) cfg = await window.sb.salvarCfg({ ativo: (modelos.find((m) => m.grupo === 'Combos') || modelos[0]).id })
    $('boas-vindas').hidden = modelos.length > 0
    pintarSeletor()
    pintarModo()
    pintarPasta()
  }
  window.preencherAlvo = preencherAlvo

  async function iniciar() {
    cfg = await window.sb.cfg()
    chats = await window.sb.chats()
    window.aplicarIcones()
    pintarModo()
    pintarPasta()
    alternarBotao(false)
    preencherAlvo()
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
    else abrir(chats.sort((a, b) => b.em - a.em)[0].id)
  }
  window.SB = { enviar: (txt) => (($('texto').value = txt), enviar()), anexos: () => anexosPendentes, chats: () => chats }
  iniciar()
})()
