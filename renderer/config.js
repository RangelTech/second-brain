// Configurações do Second Brain: Provedores, Combos, Uso e Cota.
// As telas são nativas; os dados vêm do motor de provedores (rotas /api/* via window.sb.api).
;(() => {
  const CAT = (window.SB_CATALOGO && window.SB_CATALOGO.provedores) || []
  const POR_ID = Object.fromEntries(CAT.map((p) => [p.id, p]))
  const UNLIMITED = { prefixo: 'unl', base: 'https://qwen.rangeltech.net/v1', modelo: 'qwen-abliterated', nome: 'Unlimited' }
  // Provedores com entrada por conta (assinatura) que o app sabe completar sozinho.
  const OAUTH_CODIGO = ['codex', 'claude', 'gemini-cli']
  const OAUTH_DISPOSITIVO = ['github']
  const REDIRECT = 'http://localhost:8080/callback'

  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const api = (m, r, b) => window.sb.api(m, r, b)
  const fmt = (n) => new Intl.NumberFormat('pt-BR').format(Math.round(n || 0))
  const brl = (n) => 'US$ ' + (n || 0).toFixed(n >= 100 ? 0 : 2)
  const erroDe = (r) => (r.json && (r.json.error || r.json.message)) || `Erro ${r.status}`

  const ICONES = {
    prov: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01"/></svg>',
    combo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/></svg>',
    uso: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    agente: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
    sobre: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    cota: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  }
  const ABAS = [
    { id: 'prov', nome: 'Provedores', grupo: 'Modelos' },
    { id: 'combo', nome: 'Combos', grupo: 'Modelos' },
    { id: 'uso', nome: 'Uso', grupo: 'Consumo' },
    { id: 'cota', nome: 'Cota', grupo: 'Consumo' },
    { id: 'agente', nome: 'Agente', grupo: 'Aplicativo' },
    { id: 'sobre', nome: 'Sobre', grupo: 'Aplicativo' },
  ]

  const S = { aba: 'prov', filtro: 'todos', busca: '', periodo: '7d', conex: [], nodes: [], combos: [], estrategias: {}, modelos: [], timerCota: null, erroMotor: '' }
  let raiz
  const $ = (sel) => raiz.querySelector(sel)

  // ---------- util de exibição ----------
  function nomeProvedor(id) {
    const no = S.nodes.find((n) => n.id === id)
    if (no) return no.name
    return POR_ID[id]?.nome || id
  }
  function logoHtml(id, cls = 'lg') {
    const no = S.nodes.find((n) => n.id === id)
    if (no?.prefix === UNLIMITED.prefixo) return `<img class="${cls}" src="img/unlimited.svg" alt="">`
    const p = POR_ID[id]
    if (p?.logo) return `<img class="${cls}" src="img/providers/${esc(p.id)}.png" alt="">`
    const letra = (no?.name || p?.nome || id || '?').trim()[0]?.toUpperCase() || '?'
    return `<span class="${cls} sem" aria-hidden="true">${esc(letra)}</span>`
  }
  function nomeModelo(id) {
    const m = S.modelos.find((x) => x.id === id)
    if (m) return m.nome
    const [pref, ...resto] = String(id).split('/')
    if (pref === UNLIMITED.prefixo) return UNLIMITED.nome
    return resto.length ? resto.join('/') : id
  }
  function logoDoModelo(id) {
    const m = S.modelos.find((x) => x.id === id)
    return m?.provedor ? logoHtml(m.provedor, 'lg-p') : ''
  }

  // ---------- janela (modal) ----------
  function janela(html, larga) {
    const f = document.createElement('div')
    f.className = 'fundo'
    f.innerHTML = `<div class="janela${larga ? ' larga' : ''}" role="dialog" aria-modal="true">${html}</div>`
    f.addEventListener('mousedown', (e) => e.target === f && f.remove())
    raiz.appendChild(f)
    return { el: f, q: (s) => f.querySelector(s), fechar: () => f.remove() }
  }
  const aviso = (el, tipo, txt) => {
    el.className = 'msg ' + tipo
    el.textContent = txt
    el.hidden = !txt
  }

  // ---------- carga ----------
  async function carregarBase() {
    const est = await window.sb.routerEstado()
    if (!est.pronto) {
      S.erroMotor = est.erro || 'O motor de provedores ainda está iniciando…'
      return false
    }
    S.erroMotor = ''
    const [c, n] = await Promise.all([api('GET', '/api/providers'), api('GET', '/api/provider-nodes')])
    S.conex = c.json?.connections || []
    S.nodes = n.json?.nodes || []
    S.modelos = await window.sb.modelos()
    return true
  }

  // =====================================================================
  // PROVEDORES
  // =====================================================================
  function statusConexao(c) {
    if (c.isActive === false) return ['', 'Desativado']
    if (c.testStatus === 'active' || c.testStatus === 'success') return ['ok', 'Conectado']
    if (c.testStatus === 'error' || c.testStatus === 'unavailable' || c.testStatus === 'expired') return ['err', c.lastError ? String(c.lastError).slice(0, 60) : 'Com erro']
    return ['', 'Não testado']
  }
  function conexUnlimited() {
    const no = S.nodes.find((n) => n.prefix === UNLIMITED.prefixo)
    return no ? S.conex.find((c) => c.provider === no.id) : null
  }

  async function telaProvedores() {
    const unl = conexUnlimited()
    const conectados = S.conex
      .map(
        (c) => {
          const [cls, txt] = statusConexao(c)
          const sub = c.email || c.displayName || (c.authType === 'oauth' ? 'Conta' : 'Chave de API')
          return `<div class="conex" data-id="${esc(c.id)}">
            ${logoHtml(c.provider)}
            <div class="col"><div class="nm">${esc(c.name || nomeProvedor(c.provider))}</div><div class="sub">${esc(nomeProvedor(c.provider))} · ${esc(sub)}</div></div>
            <span class="ponto ${cls}"></span><span class="sub mut" data-st>${esc(txt)}</span>
            <button class="btn-leve" data-acao="testar">Testar</button>
            <button class="chave ${c.isActive === false ? '' : 'on'}" data-acao="alternar" aria-label="Ativar ou desativar" title="Ativar ou desativar"></button>
            <button class="btn-leve btn-perigo" data-acao="remover">Remover</button>
          </div>`
        },
      )
      .join('')
    const termo = S.busca.trim().toLowerCase()
    const catalogo = CAT.filter((p) => {
      if (termo && !p.nome.toLowerCase().includes(termo) && !p.id.includes(termo)) return false
      if (S.filtro === 'oauth') return p.categoria === 'oauth'
      if (S.filtro === 'chave') return p.categoria === 'apikey' || p.modos.includes('apikey')
      if (S.filtro === 'gratis') return p.categoria === 'free' || p.categoria === 'freeTier' || p.gratis
      return true
    })
    const chip = (id, nome) => `<button class="chip ${S.filtro === id ? 'on' : ''}" data-filtro="${id}">${nome}</button>`
    $('.cfg-corpo').innerHTML = `
      <div class="cfg-cab"><div><h1>Provedores</h1><p>Contas e chaves que o Second Brain usa para responder. Conecte quantas quiser e depois monte combos com elas.</p></div>
        <div class="cfg-acoes"><button data-acao="compat">＋ Compatível com OpenAI</button></div></div>
      <div class="destaque">
        <img src="img/unlimited.svg" alt="">
        <div class="tx"><b>Unlimited</b> <span class="selo ${unl ? 'ok' : 'gr'}">${unl ? 'Conectado' : 'Recomendado'}</span>
          <span>A IA da casa da Rangel Tech: sem recusa, sem custo por token. Cole a chave que você recebeu.</span></div>
        <button class="btn-pri" data-acao="unlimited">${unl ? 'Trocar chave' : 'Conectar'}</button>
      </div>
      <h2>Conectados (${S.conex.length})</h2>
      ${S.conex.length ? `<div class="lista-conex" id="lc">${conectados}</div>` : '<div class="vazio-cfg">Nenhum provedor conectado ainda. Escolha um abaixo ou conecte o Unlimited.</div>'}
      <h2>Disponíveis</h2>
      <div class="cfg-acoes" style="margin-bottom:12px"><input type="search" id="busca-prov" placeholder="Buscar provedor" value="${esc(S.busca)}" style="width:240px">
        <div class="chips">${chip('todos', 'Todos')}${chip('oauth', 'Assinatura')}${chip('chave', 'Chave de API')}${chip('gratis', 'Gratuitos')}</div></div>
      <div class="grade">${catalogo
        .map(
          (p) => `<button class="cartao-prov" data-conectar="${esc(p.id)}">${logoHtml(p.id)}<span class="col"><span class="nm">${esc(p.nome)}</span><span class="sub">${p.categoria === 'oauth' ? 'Assinatura' : p.categoria === 'apikey' ? 'Chave de API' : 'Gratuito'}</span></span></button>`,
        )
        .join('') || '<div class="vazio-cfg" style="grid-column:1/-1">Nenhum provedor encontrado.</div>'}</div>`
    const busca = $('#busca-prov')
    if (S.focoBusca) {
      busca.focus()
      busca.setSelectionRange(busca.value.length, busca.value.length)
      S.focoBusca = false
    }
    busca.oninput = () => {
      S.busca = busca.value
      S.focoBusca = true
      telaProvedores()
    }
  }

  async function acaoConexao(acao, id, linha) {
    const c = S.conex.find((x) => x.id === id)
    if (!c) return
    if (acao === 'testar') {
      const st = linha.querySelector('[data-st]')
      st.textContent = 'Testando…'
      const r = await api('POST', `/api/providers/${id}/test`)
      const ok = r.json?.valid === true || r.json?.success === true
      linha.querySelector('.ponto').className = 'ponto ' + (ok ? 'ok' : 'err')
      st.textContent = ok ? 'Conectado' : String(r.json?.error || erroDe(r)).slice(0, 70)
    } else if (acao === 'alternar') {
      await api('PUT', `/api/providers/${id}`, { isActive: c.isActive === false })
      await recarregar()
    } else if (acao === 'remover') {
      if (!window.confirm(`Remover "${c.name || nomeProvedor(c.provider)}"? Os combos que usam este provedor deixam de funcionar.`)) return
      await api('DELETE', `/api/providers/${id}`)
      await recarregar()
    }
  }

  // ---- conectar por chave ----
  function modalChave(p, opcoes = {}) {
    const j = janela(`
      <h3>${logoHtml(p.id)} Conectar ${esc(p.nome)}</h3>
      <div class="campo"><label for="m-nome">Nome (opcional)</label><input type="text" id="m-nome" placeholder="${esc(p.nome)}"></div>
      <div class="campo"><label for="m-chave">Chave de API</label><input type="password" id="m-chave" autocomplete="off" placeholder="Cole a chave"></div>
      ${p.urlChave ? `<div class="passo">Não tem chave? <a href="#" id="m-onde">Abrir o site do ${esc(p.nome)}</a></div>` : ''}
      <div class="msg" id="m-msg" hidden></div>
      <div class="rodape-j"><button id="m-cancelar">Cancelar</button><button class="btn-pri" id="m-ok">Conectar</button></div>`)
    j.q('#m-cancelar').onclick = j.fechar
    if (p.urlChave) j.q('#m-onde').onclick = (e) => (e.preventDefault(), window.sb.abrirExterno(p.urlChave))
    let forcar = false
    j.q('#m-ok').onclick = async () => {
      const chave = j.q('#m-chave').value.trim()
      const msg = j.q('#m-msg')
      if (!chave) return aviso(msg, 'err', 'Cole a chave.')
      const btn = j.q('#m-ok')
      btn.disabled = true
      btn.textContent = 'Verificando…'
      if (!forcar) {
        const v = await api('POST', '/api/providers/validate', { provider: p.id, apiKey: chave })
        if (v.json?.valid === false) {
          aviso(msg, 'err', (v.json.error || 'Chave recusada') + '. Clique em "Conectar" de novo para salvar mesmo assim.')
          forcar = true
          btn.disabled = false
          btn.textContent = 'Conectar'
          return
        }
      }
      const r = await api('POST', '/api/providers', { provider: p.id, apiKey: chave, name: j.q('#m-nome').value.trim() || p.nome })
      if (r.status >= 300) {
        aviso(msg, 'err', erroDe(r))
        btn.disabled = false
        btn.textContent = 'Conectar'
        return
      }
      j.fechar()
      await recarregar()
    }
  }

  // ---- conectar por conta (assinatura) ----
  function modalConta(p) {
    const modoChave = p.modos.includes('apikey') || p.categoria === 'apikey'
    const suportado = OAUTH_CODIGO.includes(p.id) || OAUTH_DISPOSITIVO.includes(p.id)
    const dispositivo = OAUTH_DISPOSITIVO.includes(p.id)
    const j = janela(`
      <h3>${logoHtml(p.id)} Conectar ${esc(p.nome)}</h3>
      ${suportado ? `<div class="passo" id="m-passo">Entre com a sua conta ${esc(p.nome)}. O login abre no navegador e o Second Brain guarda o acesso neste computador.</div>
      <div id="m-area"></div>` : `<div class="msg">A entrada por conta de ${esc(p.nome)} ainda não está disponível no Second Brain.${modoChave ? ' Você pode usar uma chave de API.' : ''}</div>`}
      <div class="msg" id="m-msg" hidden></div>
      <div class="rodape-j"><button id="m-cancelar">Fechar</button>${modoChave ? '<button id="m-chave">Usar chave de API</button>' : ''}${suportado ? '<button class="btn-pri" id="m-ok">Entrar com a conta</button>' : ''}</div>`)
    j.q('#m-cancelar').onclick = () => (parar(), j.fechar())
    if (modoChave) j.q('#m-chave').onclick = () => (parar(), j.fechar(), modalChave(p))
    let parado = false
    const parar = () => (parado = true)
    if (!suportado) return
    const msg = j.q('#m-msg')
    j.q('#m-ok').onclick = async () => {
      const btn = j.q('#m-ok')
      btn.disabled = true
      parado = false
      try {
        if (dispositivo) {
          const d = await api('GET', `/api/oauth/${p.id}/device-code`)
          if (d.status >= 300 || !d.json?.user_code) throw new Error(erroDe(d))
          const dc = d.json
          j.q('#m-area').innerHTML = `<div class="passo">Digite este código na página que vai abrir:</div><div class="codigo">${esc(dc.user_code)}</div>`
          window.sb.abrirExterno(dc.verification_uri_complete || dc.verification_uri)
          btn.textContent = 'Aguardando você entrar…'
          const espera = (dc.interval || 5) * 1000
          const limite = Date.now() + (dc.expires_in || 600) * 1000
          while (!parado && Date.now() < limite) {
            await new Promise((r) => setTimeout(r, espera))
            if (parado) return
            const r = await api('POST', `/api/oauth/${p.id}/poll`, { deviceCode: dc.device_code, codeVerifier: dc.codeVerifier, extraData: dc.extraData })
            if (r.json?.success) {
              j.fechar()
              return recarregar()
            }
            if (r.json && r.json.pending === false && r.json.error) throw new Error(r.json.error)
          }
          throw new Error('O tempo para entrar acabou. Tente de novo.')
        }
        const a = await api('GET', `/api/oauth/${p.id}/authorize?redirect_uri=${encodeURIComponent(REDIRECT)}`)
        if (a.status >= 300 || !a.json?.authUrl) throw new Error(erroDe(a))
        const auth = a.json
        window.sb.abrirExterno(auth.authUrl)
        j.q('#m-area').innerHTML = `<div class="passo">Depois de entrar, o navegador vai mostrar uma página de erro em <b>localhost:8080</b>. Isso é esperado: copie o endereço completo dessa página e cole aqui.</div>
          <div class="campo" style="margin-top:8px"><label for="m-url">Endereço de retorno</label><input type="text" id="m-url" placeholder="http://localhost:8080/callback?code=…"></div>`
        btn.textContent = 'Concluir'
        btn.disabled = false
        btn.onclick = async () => {
          const bruto = j.q('#m-url').value.trim()
          let code = null
          let state = null
          try {
            const u = new URL(bruto)
            code = u.searchParams.get('code')
            state = u.searchParams.get('state')
          } catch {}
          if (!code) return aviso(msg, 'err', 'Não achei o código nesse endereço. Cole o endereço completo.')
          btn.disabled = true
          const t = await api('POST', `/api/oauth/${p.id}/exchange`, { code, redirectUri: auth.redirectUri || REDIRECT, codeVerifier: auth.codeVerifier, state: state || auth.state })
          if (t.status >= 300 || t.json?.success === false) {
            aviso(msg, 'err', erroDe(t))
            btn.disabled = false
            return
          }
          j.fechar()
          recarregar()
        }
      } catch (e) {
        aviso(msg, 'err', String(e.message || e))
        btn.disabled = false
        btn.textContent = 'Entrar com a conta'
      }
    }
  }

  function abrirConectar(id) {
    const p = POR_ID[id]
    if (!p) return
    if (p.categoria === 'oauth') modalConta(p)
    else modalChave(p)
  }

  // ---- Unlimited ----
  function modalUnlimited() {
    const atual = conexUnlimited()
    const j = janela(`
      <h3><img class="lg" src="img/unlimited.svg" alt=""> Unlimited</h3>
      <div class="passo">Cole a chave do Unlimited que a Rangel Tech enviou. A chave fica cifrada neste computador.</div>
      <div class="campo"><label for="u-chave">Chave</label><input type="password" id="u-chave" autocomplete="off" placeholder="Cole a chave"></div>
      <div class="msg" id="u-msg" hidden></div>
      <div class="rodape-j"><button id="u-cancelar">Cancelar</button><button class="btn-pri" id="u-ok">${atual ? 'Trocar chave' : 'Conectar'}</button></div>`)
    j.q('#u-cancelar').onclick = j.fechar
    j.q('#u-ok').onclick = async () => {
      const msg = j.q('#u-msg')
      const chave = j.q('#u-chave').value.trim()
      if (!chave) return aviso(msg, 'err', 'Cole a chave.')
      const btn = j.q('#u-ok')
      btn.disabled = true
      btn.textContent = 'Verificando…'
      try {
        let no = S.nodes.find((n) => n.prefix === UNLIMITED.prefixo)
        if (!no) {
          const c = await api('POST', '/api/provider-nodes', { name: UNLIMITED.nome, prefix: UNLIMITED.prefixo, apiType: 'chat', baseUrl: UNLIMITED.base, type: 'openai-compatible' })
          if (c.status >= 300) throw new Error(erroDe(c))
          no = c.json.node
          S.nodes.push(no)
        }
        const v = await api('POST', '/api/providers/validate', { provider: no.id, apiKey: chave })
        if (v.json?.valid === false) throw new Error(v.json.error === 'Invalid API key' ? 'Chave recusada pelo Unlimited. Confira se copiou inteira.' : v.json.error)
        if (atual) await api('DELETE', `/api/providers/${atual.id}`)
        const r = await api('POST', '/api/providers', { provider: no.id, apiKey: chave, name: UNLIMITED.nome, defaultModel: UNLIMITED.modelo })
        if (r.status >= 300) throw new Error(erroDe(r))
        j.fechar()
        await recarregar()
      } catch (e) {
        aviso(msg, 'err', String(e.message || e))
        btn.disabled = false
        btn.textContent = atual ? 'Trocar chave' : 'Conectar'
      }
    }
  }

  // ---- compatível com OpenAI ----
  function modalCompat() {
    const j = janela(`
      <h3>Compatível com OpenAI</h3>
      <div class="passo">Qualquer serviço que fale o formato da OpenAI (Ollama, LM Studio, vLLM, OpenRouter próprio, etc.).</div>
      <div class="campo"><label for="c-nome">Nome</label><input type="text" id="c-nome" placeholder="Meu servidor"></div>
      <div class="campo"><label for="c-pref">Prefixo (aparece antes do modelo, ex.: meu/gpt-4o)</label><input type="text" id="c-pref" placeholder="meu"></div>
      <div class="campo"><label for="c-base">Endereço base</label><input type="text" id="c-base" placeholder="https://api.exemplo.com/v1"></div>
      <div class="campo"><label for="c-chave">Chave de API</label><input type="password" id="c-chave" autocomplete="off"></div>
      <div class="msg" id="c-msg" hidden></div>
      <div class="rodape-j"><button id="c-cancelar">Cancelar</button><button class="btn-pri" id="c-ok">Conectar</button></div>`)
    j.q('#c-cancelar').onclick = j.fechar
    j.q('#c-ok').onclick = async () => {
      const msg = j.q('#c-msg')
      const nome = j.q('#c-nome').value.trim()
      const prefixo = j.q('#c-pref').value.trim()
      const base = j.q('#c-base').value.trim()
      const chave = j.q('#c-chave').value.trim()
      if (!nome || !prefixo || !base) return aviso(msg, 'err', 'Preencha nome, prefixo e endereço.')
      const btn = j.q('#c-ok')
      btn.disabled = true
      try {
        const c = await api('POST', '/api/provider-nodes', { name: nome, prefix: prefixo, apiType: 'chat', baseUrl: base, type: 'openai-compatible' })
        if (c.status >= 300) throw new Error(erroDe(c))
        const r = await api('POST', '/api/providers', { provider: c.json.node.id, apiKey: chave || 'sem-chave', name: nome })
        if (r.status >= 300) throw new Error(erroDe(r))
        j.fechar()
        await recarregar()
      } catch (e) {
        aviso(msg, 'err', String(e.message || e))
        btn.disabled = false
      }
    }
  }

  // =====================================================================
  // COMBOS
  // =====================================================================
  const ESTRATEGIAS = {
    fallback: { nome: 'Em ordem', desc: 'Tenta o primeiro; se falhar, passa para o próximo.' },
    'round-robin': { nome: 'Rodízio', desc: 'Reveza os modelos a cada pedido para dividir a carga.' },
  }
  async function carregarCombos() {
    const [c, s] = await Promise.all([api('GET', '/api/combos'), api('GET', '/api/settings')])
    S.combos = (c.json?.combos || []).filter((x) => !x.kind || x.kind === 'llm')
    S.estrategias = s.json?.comboStrategies || {}
  }
  const estrategiaDe = (nome) => S.estrategias[nome]?.fallbackStrategy || 'fallback'

  async function telaCombos() {
    await carregarCombos()
    const cartoes = S.combos
      .map((c) => {
        const est = estrategiaDe(c.name)
        const cadeia = (c.models || [])
          .map((m) => `<span class="mod">${logoDoModelo(m)}${esc(nomeModelo(m))}</span>`)
          .join('<span class="seta">›</span>')
        return `<div class="combo" data-id="${esc(c.id)}">
          <div class="combo-topo"><span class="nm">${esc(c.name)}</span><span class="selo">${esc(ESTRATEGIAS[est]?.nome || est)}</span><span class="gap"></span>
            <button class="btn-leve" data-acao="usar">${window.__ativoCombo === c.name ? '✓ Em uso no chat' : 'Usar no chat'}</button>
            <button class="btn-leve" data-acao="editar">Editar</button><button class="btn-leve btn-perigo" data-acao="apagar">Apagar</button></div>
          <div class="modelos-cadeia">${cadeia || '<span class="mut">Sem modelos</span>'}</div></div>`
      })
      .join('')
    $('.cfg-corpo').innerHTML = `
      <div class="cfg-cab"><div><h1>Combos</h1><p>Um combo agrupa modelos sob um nome. O chat usa o nome do combo e o Second Brain decide qual modelo responde, na ordem ou em rodízio.</p></div>
        <div class="cfg-acoes"><button class="btn-pri" data-acao="novo">＋ Novo combo</button></div></div>
      ${S.combos.length ? `<div class="combos">${cartoes}</div>` : `<div class="vazio-cfg">${S.modelos.some((m) => m.grupo === 'Modelos') ? 'Nenhum combo ainda. Crie o primeiro.' : 'Conecte um provedor antes de criar combos.'}</div>`}`
  }

  function modalCombo(combo) {
    const modelosDisp = S.modelos.filter((m) => m.grupo === 'Modelos')
    let itens = [...(combo?.models || [])]
    let est = combo ? estrategiaDe(combo.name) : 'fallback'
    const j = janela(`
      <h3>${combo ? 'Editar combo' : 'Novo combo'}</h3>
      <div class="campo"><label for="cb-nome">Nome (letras, números, - _ .)</label><input type="text" id="cb-nome" value="${esc(combo?.name || '')}" placeholder="principal"></div>
      <div class="campo"><label>Estratégia</label><div class="estr" id="cb-est">
        ${Object.entries(ESTRATEGIAS).map(([k, v]) => `<label data-k="${k}" class="${est === k ? 'on' : ''}"><input type="radio" name="est">${esc(v.nome)}<small>${esc(v.desc)}</small></label>`).join('')}</div></div>
      <div class="campo"><label>Modelos, em ordem de preferência</label><div class="itens-ed" id="cb-itens"></div>
        <div class="cfg-acoes"><select id="cb-sel" style="flex:1">${modelosDisp.length ? modelosDisp.map((m) => `<option value="${esc(m.id)}">${esc(m.nome)} · ${esc(nomeProvedor(m.provedor))}</option>`).join('') : '<option value="">Conecte um provedor primeiro</option>'}</select>
        <button id="cb-add">Adicionar</button></div></div>
      <div class="msg" id="cb-msg" hidden></div>
      <div class="rodape-j"><button id="cb-cancelar">Cancelar</button><button class="btn-pri" id="cb-ok">Salvar</button></div>`, true)
    const desenhar = () => {
      j.q('#cb-itens').innerHTML = itens.length
        ? itens.map((m, i) => `<div class="item-ed"><span class="n">${i + 1}</span><span class="t">${logoDoModelo(m)} ${esc(nomeModelo(m))} <span class="mut">(${esc(m)})</span></span>
            <button data-mv="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button><button data-mv="dn" data-i="${i}" ${i === itens.length - 1 ? 'disabled' : ''} aria-label="Descer">↓</button><button data-mv="rm" data-i="${i}" class="btn-perigo" aria-label="Tirar">✕</button></div>`).join('')
        : '<div class="mut">Nenhum modelo adicionado.</div>'
    }
    desenhar()
    j.q('#cb-itens').onclick = (e) => {
      const mv = e.target.dataset?.mv
      if (!mv) return
      const i = +e.target.dataset.i
      if (mv === 'rm') itens.splice(i, 1)
      else {
        const k = mv === 'up' ? i - 1 : i + 1
        ;[itens[i], itens[k]] = [itens[k], itens[i]]
      }
      desenhar()
    }
    j.q('#cb-add').onclick = () => {
      const v = j.q('#cb-sel').value
      if (v && !itens.includes(v)) itens.push(v)
      desenhar()
    }
    j.q('#cb-est').onclick = (e) => {
      const l = e.target.closest('label')
      if (!l) return
      est = l.dataset.k
      j.el.querySelectorAll('#cb-est label').forEach((x) => x.classList.toggle('on', x === l))
    }
    j.q('#cb-cancelar').onclick = j.fechar
    j.q('#cb-ok').onclick = async () => {
      const msg = j.q('#cb-msg')
      const nome = j.q('#cb-nome').value.trim()
      if (!/^[a-zA-Z0-9_.-]+$/.test(nome)) return aviso(msg, 'err', 'Nome só com letras, números, - _ e .')
      if (!itens.length) return aviso(msg, 'err', 'Adicione pelo menos um modelo.')
      const r = combo ? await api('PUT', `/api/combos/${combo.id}`, { name: nome, models: itens }) : await api('POST', '/api/combos', { name: nome, models: itens })
      if (r.status >= 300) return aviso(msg, 'err', erroDe(r))
      const novas = { ...S.estrategias }
      if (combo && combo.name !== nome) delete novas[combo.name]
      if (est === 'fallback') delete novas[nome]
      else novas[nome] = { ...(novas[nome] || {}), fallbackStrategy: est }
      await api('PATCH', '/api/settings', { comboStrategies: novas })
      j.fechar()
      await recarregar()
    }
  }

  // =====================================================================
  // USO
  // =====================================================================
  async function telaUso() {
    const [st, ch] = await Promise.all([api('GET', `/api/usage/stats?period=${S.periodo}`), api('GET', `/api/usage/chart?period=${S.periodo}`)])
    const d = st.json || {}
    const dias = Array.isArray(ch.json) ? ch.json : []
    const maxT = Math.max(1, ...dias.map((x) => x.tokens || 0))
    const linhas = (obj, vazio) => {
      const l = Object.entries(obj || {}).sort((a, b) => (b[1].promptTokens + b[1].completionTokens) - (a[1].promptTokens + a[1].completionTokens))
      return l.length ? l.map(([k, v]) => `<tr><td>${esc(nomeChave(k, v))}</td><td class="n">${fmt(v.requests)}</td><td class="n">${fmt(v.promptTokens + v.completionTokens)}</td><td class="n">${brl(v.cost)}</td></tr>`).join('') : `<tr><td colspan="4" class="mut">${vazio}</td></tr>`
    }
    const nomeChave = (k, v) => (v.rawModel ? `${nomeModelo(`${(S.nodes.find((n) => n.name === v.provider)?.prefix) || ''}/${v.rawModel}`) || v.rawModel} · ${v.provider || ''}` : nomeProvedor(k))
    $('.cfg-corpo').innerHTML = `
      <div class="cfg-cab"><div><h1>Uso</h1><p>Quanto o Second Brain consumiu por provedor e modelo. O custo é uma estimativa pela tabela de preços; contas de assinatura não cobram por token.</p></div>
        <div class="cfg-acoes"><select id="periodo">${[['today', 'Hoje'], ['24h', '24 horas'], ['7d', '7 dias'], ['30d', '30 dias'], ['60d', '60 dias'], ['all', 'Tudo']].map(([v, n]) => `<option value="${v}" ${S.periodo === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
      <div class="kpis">
        <div class="kpi"><span>Pedidos</span><b>${fmt(d.totalRequests)}</b></div>
        <div class="kpi"><span>Tokens enviados</span><b>${fmt(d.totalPromptTokens)}</b></div>
        <div class="kpi"><span>Tokens recebidos</span><b>${fmt(d.totalCompletionTokens)}</b></div>
        <div class="kpi"><span>Custo estimado</span><b>${brl(d.totalCost)}</b></div>
      </div>
      <div class="grafico"><span class="mut">Tokens por dia</span>
        <div class="barras">${dias.map((x) => `<div class="barra-c" title="${esc(x.label)}: ${fmt(x.tokens)} tokens, ${fmt(x.requests)} pedidos"><div class="bar-uso" style="height:${x.tokens ? Math.max(4, Math.round((x.tokens / maxT) * 110)) : 2}px"></div><small>${esc(dias.length > 14 ? '' : x.label)}</small></div>`).join('') || '<span class="mut">Sem dados no período.</span>'}</div></div>
      <div class="duas">
        <div><h2>Por provedor</h2><table class="tabela"><thead><tr><th>Provedor</th><th class="n">Pedidos</th><th class="n">Tokens</th><th class="n">Custo</th></tr></thead><tbody>${linhas(d.byProvider, 'Nada usado ainda.')}</tbody></table></div>
        <div><h2>Por modelo</h2><table class="tabela"><thead><tr><th>Modelo</th><th class="n">Pedidos</th><th class="n">Tokens</th><th class="n">Custo</th></tr></thead><tbody>${linhas(d.byModel, 'Nada usado ainda.')}</tbody></table></div>
      </div>`
    $('#periodo').onchange = (e) => ((S.periodo = e.target.value), telaUso())
  }

  // =====================================================================
  // COTA
  // =====================================================================
  function parseCotas(dados) {
    if (!dados || typeof dados !== 'object') return []
    if (dados.message && !dados.quotas) return [{ erro: dados.message }]
    const lista = Array.isArray(dados.quotas) ? dados.quotas.map((q, i) => [q.name || `#${i + 1}`, q]) : Object.entries(dados.quotas || {})
    return lista.map(([k, q]) => {
      let restante
      if (typeof q.remainingPercentage === 'number') restante = q.remainingPercentage
      else if (typeof q.percentage === 'number') restante = q.percentageIsUsed ? 100 - q.percentage : q.percentage
      else if (q.total > 0) restante = 100 - ((q.used || 0) / q.total) * 100
      else restante = null
      return { nome: q.name || k, restante, usado: q.used, total: q.total, reset: q.resetAt }
    })
  }
  function quandoReseta(iso) {
    if (!iso) return ''
    const ms = new Date(iso).getTime() - Date.now()
    if (isNaN(ms)) return ''
    if (ms <= 0) return 'renova agora'
    const m = Math.round(ms / 60000)
    if (m < 60) return `renova em ${m} min`
    const h = Math.floor(m / 60)
    return h < 48 ? `renova em ${h} h ${m % 60} min` : `renova em ${Math.round(h / 24)} dias`
  }

  async function telaCota() {
    const conta = S.conex.filter((c) => c.isActive !== false && (c.authType === 'oauth' || POR_ID[c.provider]))
    $('.cfg-corpo').innerHTML = `
      <div class="cfg-cab"><div><h1>Cota</h1><p>Quanto ainda resta em cada conta conectada. Atualiza sozinho a cada minuto enquanto esta tela está aberta.</p></div>
        <div class="cfg-acoes"><button id="atualizar">Atualizar agora</button></div></div>
      <div class="cotas" id="cotas">${conta.length ? conta.map((c) => `<div class="cota" data-id="${esc(c.id)}"><div class="cota-topo">${logoHtml(c.provider)}<div class="col"><div class="nm" style="font-weight:500">${esc(c.name || nomeProvedor(c.provider))}</div><div class="sub mut">${esc(nomeProvedor(c.provider))}</div></div><span class="mut" data-estado>Consultando…</span></div><div data-corpo></div></div>`).join('') : '<div class="vazio-cfg">Nenhuma conta conectada. Conecte um provedor para acompanhar a cota.</div>'}</div>`
    const buscar = async (forcar) => {
      for (const c of conta) {
        const el = raiz.querySelector(`.cota[data-id="${CSS.escape(c.id)}"]`)
        if (!el) return
        const r = await api('GET', `/api/usage/${c.id}${forcar ? '?force=1' : ''}`)
        const est = el.querySelector('[data-estado]')
        const corpo = el.querySelector('[data-corpo]')
        if (r.status >= 300) {
          est.textContent = r.status === 404 ? 'Sem dados de cota' : String(r.json?.error || erroDe(r)).slice(0, 80)
          corpo.innerHTML = ''
          continue
        }
        est.textContent = r.json?.plan ? `Plano ${r.json.plan}` : ''
        const cotas = parseCotas(r.json)
        corpo.innerHTML = cotas.length
          ? cotas
              .map((q) => {
                if (q.erro) return `<div class="msg err" style="margin-top:10px">${esc(q.erro)}</div>`
                const rest = q.restante == null ? null : Math.max(0, Math.min(100, q.restante))
                const cls = rest == null ? '' : rest <= 10 ? 'bx' : rest <= 35 ? 'med' : ''
                return `<div class="medidor"><div class="linha-m"><span>${esc(q.nome)}</span><span class="mut">${rest == null ? '' : Math.round(rest) + '% restante'}${q.reset ? ' · ' + esc(quandoReseta(q.reset)) : ''}</span></div>${rest == null ? '' : `<div class="trilho"><i class="${cls}" style="width:${rest}%"></i></div>`}</div>`
              })
              .join('')
          : '<div class="mut" style="margin-top:10px">Este provedor não informa cota.</div>'
      }
    }
    buscar(false)
    $('#atualizar').onclick = () => buscar(true)
    clearInterval(S.timerCota)
    S.timerCota = setInterval(() => (S.aba === 'cota' && !raiz.hidden ? buscar(false) : null), 60000)
  }


  // =====================================================================
  // AGENTE e SOBRE (não dependem do motor)
  // =====================================================================
  async function telaAgente() {
    const c = await window.sb.cfg()
    $('.cfg-corpo').innerHTML = `
      <div class="cfg-cab"><div><h1>Agente</h1><p>Onde o agente trabalha e como ele pede permissão.</p></div></div>
      <h2>Pasta de trabalho</h2>
      <div class="cfg-acoes"><input type="text" id="ag-pasta" value="${esc(c.pasta)}" readonly style="flex:1;min-width:260px"><button id="ag-escolher">Escolher…</button></div>
      <p class="mut" style="margin-top:8px">Os arquivos que o agente criar (sites, documentos) ficam aqui, a menos que você peça outra pasta.</p>
      <h2>Modo</h2>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ag-so" ${c.soConversa ? 'checked' : ''}> Só conversa (sem ferramentas: o modelo não lê arquivos nem roda comandos)</label>
      <h2>Raciocínio</h2>
      <div class="cfg-acoes"><select id="ag-rac">${[['minimal', 'Mínimo (mais rápido)'], ['low', 'Baixo (recomendado)'], ['medium', 'Médio'], ['high', 'Alto (mais lento)']].map(([v, n]) => `<option value="${v}" ${(c.raciocinio || 'low') === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <p class="mut">Quanto o modelo pensa antes de agir. Alto melhora tarefas difíceis, mas demora mais.</p>
      <h2>Permissões</h2>
      <p class="mut">O agente sempre pergunta antes de rodar comandos, escrever fora da pasta de trabalho ou apagar arquivos. Em cada pergunta você pode escolher "Permitir sempre nesta conversa".</p>`
    $('#ag-escolher').onclick = async () => {
      const p = await window.sb.escolherPasta()
      if (p) {
        await window.sb.salvarCfg({ pasta: p })
        telaAgente()
      }
    }
    $('#ag-rac').onchange = (e) => window.sb.salvarCfg({ raciocinio: e.target.value })
    $('#ag-so').onchange = (e) => window.sb.salvarCfg({ soConversa: e.target.checked })
  }
  async function telaSobre() {
    const i = await window.sb.info()
    $('.cfg-corpo').innerHTML = `
      <div class="cfg-cab"><div><h1>Sobre</h1><p>Second Brain, da Rangel Tech.</p></div></div>
      <div class="kpis"><div class="kpi"><span>Versão</span><b>${esc(i.versao)}</b></div><div class="kpi"><span>Sistema</span><b>${esc(i.so)}</b></div><div class="kpi"><span>Electron</span><b>${esc(i.electron)}</b></div></div>
      <h2>Dados e logs</h2>
      <p class="mut">Tudo fica neste computador: <code>${esc(i.dados)}</code>. Nada é enviado para fora, além das chamadas aos provedores que você conectou.</p>
      <div class="cfg-acoes"><button id="so-logs">Abrir pasta de dados e logs</button></div>
      <h2>Licenças</h2>
      <p class="mut">Hermes Agent (motor do agente), 9Router (MIT, motor de provedores) e Electron (MIT). O Second Brain é MIT.</p>`
    $('#so-logs').onclick = () => window.sb.abrirLogs()
  }
  // =====================================================================
  // casca
  // =====================================================================
  async function recarregar() {
    await carregarBase()
    await desenharAba()
  }
  async function desenharAba() {
    clearInterval(S.timerCota)
    raiz.querySelectorAll('.cfg-aba').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === S.aba))
    if (S.aba === 'agente') return telaAgente()
    if (S.aba === 'sobre') return telaSobre()
    if (S.erroMotor) {
      $('.cfg-corpo').innerHTML = `<div class="cfg-cab"><div><h1>${esc(ABAS.find((a) => a.id === S.aba).nome)}</h1></div></div><div class="vazio-cfg">${esc(S.erroMotor)}</div>`
      return
    }
    window.__ativoCombo = (await window.sb.cfg()).ativo
    if (S.aba === 'prov') return telaProvedores()
    if (S.aba === 'combo') return telaCombos()
    if (S.aba === 'uso') return telaUso()
    if (S.aba === 'cota') return telaCota()
  }

  function montar() {
    raiz = document.getElementById('config')
    let grupo = ''
    const nav = ABAS.map((a) => {
      const cab = a.grupo !== grupo ? `<div class="cfg-grupo">${(grupo = a.grupo)}</div>` : ''
      return `${cab}<button class="cfg-aba" data-aba="${a.id}">${ICONES[a.id]}${a.nome}</button>`
    }).join('')
    raiz.innerHTML = `<nav class="cfg-nav" aria-label="Configurações"><button class="cfg-voltar" id="cfg-voltar">← Voltar ao chat</button>${nav}</nav><div class="cfg-corpo" tabindex="-1"></div>`
    $('#cfg-voltar').onclick = () => SBConfig.fechar()
    raiz.addEventListener('keydown', (e) => e.key === 'Escape' && !raiz.querySelector('.fundo') && SBConfig.fechar())
    raiz.addEventListener('click', async (e) => {
      const t = e.target.closest('button')
      if (!t) return
      if (t.classList.contains('cfg-aba')) {
        S.aba = t.dataset.aba
        return desenharAba()
      }
      if (t.dataset.filtro) {
        S.filtro = t.dataset.filtro
        return telaProvedores()
      }
      if (t.dataset.conectar) return abrirConectar(t.dataset.conectar)
      const acao = t.dataset.acao
      if (!acao) return
      if (acao === 'unlimited') return modalUnlimited()
      if (acao === 'compat') return modalCompat()
      if (acao === 'novo') return modalCombo(null)
      const linha = t.closest('[data-id]')
      if (linha && t.closest('.conex')) return acaoConexao(acao, linha.dataset.id, linha)
      if (linha && t.closest('.combo')) {
        const c = S.combos.find((x) => x.id === linha.dataset.id)
        if (acao === 'editar') return modalCombo(c)
        if (acao === 'usar') {
          await window.sb.salvarCfg({ ativo: c.name })
          return desenharAba()
        }
        if (acao === 'apagar' && window.confirm(`Apagar o combo "${c.name}"?`)) {
          await api('DELETE', `/api/combos/${c.id}`)
          const novas = { ...S.estrategias }
          delete novas[c.name]
          await api('PATCH', '/api/settings', { comboStrategies: novas })
          return recarregar()
        }
      }
    })
  }

  const SBConfig = {
    aoFechar: null,
    async abrir(aba) {
      if (!raiz) montar()
      if (aba) S.aba = aba
      raiz.hidden = false
      await carregarBase()
      desenharAba()
      // se o motor ainda estiver subindo, tenta de novo até ficar pronto
      if (S.erroMotor) {
        const t = setInterval(async () => {
          if (raiz.hidden) return clearInterval(t)
          if (await carregarBase()) {
            clearInterval(t)
            desenharAba()
          }
        }, 1500)
      }
    },
    fechar() {
      if (!raiz) return
      clearInterval(S.timerCota)
      raiz.hidden = true
      SBConfig.aoFechar?.()
    },
  }
  window.SBConfig = SBConfig
})()
