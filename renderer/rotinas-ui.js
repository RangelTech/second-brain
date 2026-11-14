// Aba Workflows: tudo o que o agente faz sozinho, numa lista (um por linha). Dois tipos:
//  - gatilho: atendimento automático do WhatsApp / Instagram (confere a cada N segundos e responde);
//  - agendado: tarefa em horário marcado (cron do Hermes pelo gateway) — pode ser qualquer coisa (ler um arquivo, relatório, mensagem...).
// Clicar numa linha abre uma janela com as opções DAQUELE workflow. O que a tela não cobre, "Ajustar com a IA" resolve pelo chat.
;(() => {
  const K = window.SBConfigInternos
  if (!K || !window.sb?.rotinas) return
  const { esc, janela } = K
  const R = { lista: [], erro: '', atend: {}, filtro: 'todos', busca: '' }
  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const CANAIS = {
    whatsapp: { nome: 'Responder o WhatsApp', icone: '💬', cor: '#25d366', ver: 'Ver o WhatsApp' },
    instagram: { nome: 'Responder o Direct do Instagram', icone: '📸', cor: '#e1306c', ver: 'Ver o Direct' },
  }
  const ESTADOS = { vigiando: ['ok', 'Ligado'], iniciando: ['', 'Ligando…'], precisa_qr: ['err', 'Desconectado'], carregando: ['', 'Abrindo…'], erro: ['err', 'Erro'], parado: ['', 'Desligado'] }

  const fmt = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    if (isNaN(d)) return '—'
    const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const hoje = new Date()
    const amanha = new Date(hoje.getTime() + 864e5)
    if (d.toDateString() === hoje.toDateString()) return `hoje às ${hm}`
    if (d.toDateString() === amanha.toDateString()) return `amanhã às ${hm}`
    return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${hm}`
  }

  // ícone e cor pelo assunto do workflow (o agendado pode ser qualquer coisa)
  const TIPOS = [
    [/whats|zap/i, '💬', '#25d366'],
    [/insta|direct|reels?/i, '📸', '#e1306c'],
    [/e-?mail|gmail|outlook/i, '✉️', '#5b8def'],
    [/arquivo|pasta|planilha|excel|pdf|csv|documento|backup/i, '📁', '#d9a441'],
    [/relat[oó]rio|resumo|m[eé]trica|vendas|dashboard/i, '📊', '#9b7ede'],
    [/not[ií]cia|pesquis|site|pre[cç]o|monitor/i, '🌐', '#4fb3bf'],
    [/v[ií]deo|imagem|post|conte[uú]do|legenda/i, '🎬', '#e07a5f'],
    [/lembr|aviso|alerta/i, '⏰', '#d97757'],
  ]
  const tipoDe = (r) => {
    const t = `${r.nome} ${r.pedido}`
    for (const [re, ic, cor] of TIPOS) if (re.test(t)) return { ic, cor }
    return { ic: '⚙️', cor: '#a39e96' }
  }

  // ---------- dados ----------
  async function carregar() {
    R.erro = ''
    const tarefas = [
      window.sb.rotinas.listar().then((r) => {
        if (r.ok && r.dado?.ok) R.lista = r.dado.rotinas
        else R.erro = r.erro || 'Não consegui ler os workflows agora.'
      }).catch((e) => { R.erro = String(e.message || e) }),
    ]
    for (const c of Object.keys(CANAIS)) tarefas.push(lerAtend(c))
    await Promise.all(tarefas)
  }
  async function lerAtend(canal) {
    if (!window.sb.atendimento) return
    try { const r = await window.sb.atendimento.estado(canal); R.atend[canal] = (r && r.ok ? r.dado : r) || {} } catch { R.atend[canal] = {} }
  }

  // tudo numa lista só, no mesmo formato
  function itens() {
    const out = []
    for (const [c, info] of Object.entries(CANAIS)) {
      const d = R.atend[c] || {}
      const cfg = d.config || {}
      if (!cfg.ativo && !String(cfg.instrucoes || '').trim()) continue // nunca configurado: aparece em "Novo workflow"
      const st = d.status || {}
      const [cls, txt] = ESTADOS[cfg.ativo ? st.estado || 'iniciando' : 'parado'] || ['', st.estado || '']
      const ult = (d.ultimos || [])[0]
      out.push({
        chave: 'at:' + c, tipo: 'atendimento', canal: c, nome: info.nome, ic: info.icone, cor: info.cor,
        ativo: !!cfg.ativo, erro: cls === 'err' ? st.erro || txt : '', selo: [cls, cfg.simular && cfg.ativo ? 'Modo teste' : txt],
        linha: `Gatilho · confere a cada ${cfg.intervalo || 10} s${ult ? ' · última resposta ' + fmt(ult.quando) : ''}`,
      })
    }
    for (const r of R.lista) {
      const t = tipoDe(r)
      out.push({
        chave: 'cr:' + r.id, tipo: 'agendado', id: r.id, nome: r.nome, ic: t.ic, cor: t.cor, ativo: r.ativa, concluida: r.concluida, erro: r.erro || '',
        selo: r.erro ? ['err', 'Deu erro'] : r.concluida ? ['', 'Concluído'] : r.ativa ? ['ok', 'Ligado'] : ['', 'Pausado'],
        linha: `${r.quando}${r.ativa ? ' · próxima ' + fmt(r.proxima) : ''}${r.ultima ? ' · rodou ' + fmt(r.ultima) : ''}`,
      })
    }
    return out
  }

  // ---------- tela ----------
  async function desenhar() {
    const corpo = K.corpo()
    if (!corpo) return
    corpo.innerHTML = `
      <div class="cfg-cab"><div><h1>Workflows</h1><p>O que o agente faz sozinho, mesmo com a janela fechada: responder clientes, conferir um arquivo todo dia, mandar um relatório toda sexta. Clique num workflow para ver e mudar tudo dele.</p></div>
        <div class="cfg-acoes"><button class="btn-pri" id="wf-novo">＋ Novo workflow</button></div></div>
      <div class="wf-barra"><div class="wf-filtros" id="wf-filtros"></div><input type="search" id="wf-busca" placeholder="Buscar workflow…" value="${esc(R.busca)}"></div>
      <div id="wf-lista"><div class="wf-esq"></div><div class="wf-esq"></div><div class="wf-esq"></div></div>`
    corpo.querySelector('#wf-novo').onclick = novo
    corpo.querySelector('#wf-busca').oninput = (e) => { R.busca = e.target.value; pintar() }
    await carregar()
    pintar()
  }

  function pintar() {
    const corpo = K.corpo()
    const el = corpo?.querySelector('#wf-lista')
    if (!el) return
    const todos = itens()
    const cont = { todos: todos.length, ligados: todos.filter((x) => x.ativo).length, pausados: todos.filter((x) => !x.ativo).length, erro: todos.filter((x) => x.erro).length }
    const NOMES = { todos: 'Todos', ligados: 'Ligados', pausados: 'Desligados', erro: 'Com erro' }
    corpo.querySelector('#wf-filtros').innerHTML = Object.keys(NOMES).filter((k) => k === 'todos' || cont[k])
      .map((k) => `<button class="chip${R.filtro === k ? ' on' : ''}" data-f="${k}">${NOMES[k]} <b>${cont[k]}</b></button>`).join('')
    corpo.querySelector('#wf-filtros').onclick = (e) => { const b = e.target.closest('[data-f]'); if (b) { R.filtro = b.dataset.f; pintar() } }

    const b = R.busca.trim().toLowerCase()
    const vis = todos.filter((x) => (R.filtro === 'todos' || (R.filtro === 'ligados' && x.ativo) || (R.filtro === 'pausados' && !x.ativo) || (R.filtro === 'erro' && x.erro)) && (!b || `${x.nome} ${x.linha}`.toLowerCase().includes(b)))
    const alerta = R.erro ? `<div class="alerta err">${esc(R.erro)}</div>` : ''
    if (!todos.length) {
      el.innerHTML = alerta + `<div class="wf-vazio"><div class="wf-vazio-ic">⚡</div><h3>Nenhum workflow ainda</h3><p>Crie o primeiro aqui ou peça no chat, do seu jeito: “todo dia às 8h, leia a planilha de vendas e me mande o resumo”.</p><button class="btn-pri" id="wf-novo2">＋ Criar o primeiro</button></div>`
      el.querySelector('#wf-novo2').onclick = novo
      return
    }
    el.innerHTML = alerta + (vis.length ? `<div class="wf-lista">${vis.map(linha).join('')}</div>` : '<div class="vazio-cfg">Nada com esse filtro.</div>')
    el.onclick = (e) => {
      const row = e.target.closest('.wf-linha')
      if (!row) return
      const it = todos.find((x) => x.chave === row.dataset.k)
      if (!it) return
      if (e.target.closest('.wf-chave')) { e.stopPropagation(); return alternar(it, e.target.closest('.wf-chave')) }
      abrir(it)
    }
    el.onkeydown = (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('wf-linha')) { e.preventDefault(); e.target.click() } }
  }

  const linha = (x) => `
    <div class="wf-linha${x.ativo ? '' : ' wf-off'}" data-k="${esc(x.chave)}" tabindex="0" role="button" aria-label="Abrir ${esc(x.nome)}">
      <div class="wf-ic" style="--c:${x.cor}">${x.ic}</div>
      <div class="wf-tx"><div class="wf-nm">${esc(x.nome)}</div><div class="wf-sub">${esc(x.linha)}</div></div>
      <span class="selo ${x.selo[0]}">${esc(x.selo[1])}</span>
      ${x.concluida ? '<span class="wf-chave-vazia"></span>' : `<button class="wf-chave${x.ativo ? ' on' : ''}" role="switch" aria-checked="${x.ativo}" title="${x.ativo ? 'Desligar' : 'Ligar'}"><i></i></button>`}
      <svg class="wf-seta" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>
    </div>`

  async function alternar(it, btn) {
    btn.disabled = true
    btn.classList.toggle('on')
    let r
    if (it.tipo === 'atendimento') {
      const cfg = R.atend[it.canal]?.config || {}
      if (!it.ativo && !String(cfg.instrucoes || '').trim()) { btn.disabled = false; btn.classList.toggle('on'); return abrir(it, 'instr') }
      r = await window.sb.atendimento.configurar({ ativo: !it.ativo }, it.canal)
    } else r = await window.sb.rotinas.acao(it.id, it.ativo ? 'pause' : 'resume')
    if (r && r.ok === false) K.corpo()?.querySelector('#wf-lista')?.insertAdjacentHTML('afterbegin', `<div class="alerta err">${esc(r.erro || 'Não deu certo.')}</div>`)
    await carregar()
    pintar()
  }

  // ---------- janela de um workflow ----------
  function moldura(it, abas, corpoAbas, rodape) {
    const j = janela(`
      <div class="wf-j-cab"><div class="wf-ic grande" style="--c:${it.cor}">${it.ic}</div>
        <div class="wf-tx"><h3 id="wf-j-nome">${esc(it.nome)}</h3><div class="wf-sub">${esc(it.linha)}</div></div>
        <span class="selo ${it.selo[0]}">${esc(it.selo[1])}</span><button class="icone wf-x" id="wf-fechar" aria-label="Fechar">✕</button></div>
      <div class="wf-abas" role="tablist">${abas.map(([k, n], i) => `<button role="tab" class="wf-aba${i ? '' : ' on'}" data-a="${k}">${n}</button>`).join('')}</div>
      <div class="wf-j-corpo">${abas.map(([k], i) => `<section data-p="${k}"${i ? ' hidden' : ''}>${corpoAbas[k]}</section>`).join('')}</div>
      <div class="alerta" id="wf-msg" hidden></div>
      <div class="rodape-j wf-rodape">${rodape}</div>`, true)
    j.el.querySelector('.janela').classList.add('wf-janela')
    const ir = (k) => {
      j.el.querySelectorAll('.wf-aba').forEach((b) => b.classList.toggle('on', b.dataset.a === k))
      j.el.querySelectorAll('[data-p]').forEach((s) => { s.hidden = s.dataset.p !== k })
    }
    j.q('.wf-abas').onclick = (e) => { const b = e.target.closest('.wf-aba'); if (b) ir(b.dataset.a) }
    j.q('#wf-fechar').onclick = () => j.fechar()
    j.ir = ir
    j.msg = (tipo, txt) => { const m = j.q('#wf-msg'); m.className = 'alerta ' + tipo; m.textContent = txt; m.hidden = !txt }
    const esc_ = (e) => { if (e.key === 'Escape') { j.fechar(); document.removeEventListener('keydown', esc_) } }
    document.addEventListener('keydown', esc_)
    return j
  }

  // pedir à IA: abre o chat com o contexto do workflow + o que a pessoa quer (qualquer coisa que a tela não tenha)
  const blocoIA = (ph) => `<div class="wf-ia"><label for="wf-ia-tx">Quer algo que não está aqui? Diga para a IA</label>
    <div class="wf-ia-l"><input id="wf-ia-tx" type="text" placeholder="${esc(ph)}"><button id="wf-ia-ir">Pedir no chat →</button></div></div>`
  function ligarIA(j, contexto) {
    const ir = () => {
      const pedido = j.q('#wf-ia-tx').value.trim()
      j.fechar()
      window.SBConfig.fechar()
      window.SB?.novaConversa?.(`${contexto}\n\nO que eu quero: ${pedido}`)
    }
    j.q('#wf-ia-ir').onclick = ir
    j.q('#wf-ia-tx').onkeydown = (e) => { if (e.key === 'Enter') ir() }
  }

  function abrir(it, aba) {
    if (it.tipo === 'atendimento') return abrirAtendimento(it, aba)
    return abrirAgendado(it, aba)
  }

  // ---- atendimento (gatilho) ----
  function abrirAtendimento(it, aba) {
    const c = it.canal
    const IG = c === 'instagram'
    const d = R.atend[c] || {}
    const cfg = d.config || {}
    const st = d.status || {}
    const log = d.ultimos || []
    const resp = log.filter((x) => x.resposta && !x.erro)
    const hoje = resp.filter((x) => new Date(x.quando).toDateString() === new Date().toDateString())
    const media = resp.length ? (resp.reduce((s, x) => s + (+x.segundos || 0), 0) / resp.length).toFixed(1) : '—'
    const geral = `
      <div class="wf-kpis"><div><b>${hoje.length}</b><span>respostas hoje</span></div><div><b>${media}${media === '—' ? '' : ' s'}</b><span>tempo médio</span></div><div><b>${cfg.intervalo || 10} s</b><span>conferência</span></div></div>
      <dl class="wf-dl"><dt>Como funciona</dt><dd>A cada ${cfg.intervalo || 10} segundos o app olha se chegou mensagem nova (sem gastar IA). Chegou: a IA lê a conversa e responde do jeito que você mandou.</dd>
      <dt>Situação</dt><dd>${esc(it.selo[1])}${st.erro ? ' — ' + esc(st.erro) : ''}${cfg.simular ? ' · <b>modo teste</b>: responde só aqui no histórico, não envia' : ''}</dd>
      ${(cfg.so || []).length ? `<dt>Só responde</dt><dd>${esc(cfg.so.join(', '))}</dd>` : ''}${(cfg.ignorar || []).length ? `<dt>Não responde</dt><dd>${esc(cfg.ignorar.join(', '))}</dd>` : ''}</dl>
      ${blocoIA(IG ? 'Ex.: responda em inglês quem escrever em inglês' : 'Ex.: fora do horário, diga que retorno amanhã às 9h')}`
    const instr = `<div class="campo"><label for="wf-instr">Como a IA deve responder</label>
      <textarea id="wf-instr" rows="10" placeholder="Ex.: Sou a Loja da Ana (roupas femininas). Responda simpática e curta. Horário: seg a sáb, 9h às 18h. Entrega em Goiânia R$ 10. Se pedirem desconto, diga que vou verificar. Não responda grupos nem a minha mãe.">${esc(cfg.instrucoes || '')}</textarea>
      <small class="mut">Diga quem é o negócio, o tom, preços, horários, links, o que fazer quando não souber e quando passar para você.</small></div>`
    const regras = `<div class="wf-grade">
      <div class="campo"><label for="wf-int">Conferir a cada (segundos)</label><input id="wf-int" type="number" min="3" max="3600" value="${esc(cfg.intervalo || 10)}"></div>
      <div class="campo"><label for="wf-ign">Não responder (nomes)</label><input id="wf-ign" type="text" value="${esc((cfg.ignorar || []).join(', '))}" placeholder="Mãe, Chefe"></div>
      <div class="campo wf-largo"><label for="wf-so">Responder só estes contatos (vazio = todos)</label><input id="wf-so" type="text" value="${esc((cfg.so || []).join(', '))}" placeholder="Cliente A, Cliente B"></div></div>
      ${IG ? '' : `<label class="wf-op"><input id="wf-grupos" type="checkbox" ${cfg.grupos ? 'checked' : ''}><span><b>Responder em grupos</b><small>Desligado, a IA só responde conversas individuais.</small></span></label>`}
      <label class="wf-op"><input id="wf-sim" type="checkbox" ${cfg.simular ? 'checked' : ''}><span><b>Modo teste</b><small>A IA escreve a resposta só no histórico, sem enviar. Bom para o primeiro dia.</small></span></label>`
    const hist = log.length ? `<div class="wf-hist">${log.slice(0, 30).map((x) => `<div class="wf-h"><div class="wf-h-cab"><b>${esc(x.contato || '')}</b><span>${esc(fmt(x.quando))}</span></div>
      <div class="wf-h-msg">“${esc(String(x.recebida || '').slice(0, 200))}”</div>
      <div class="wf-h-resp${x.erro ? ' err' : ''}">${x.erro ? '⚠ ' + esc(x.erro) : x.pulou ? '— sem resposta (não precisava)' : '↳ ' + esc(String(x.resposta || '').slice(0, 400)) + (x.segundos ? ` <i>${esc(x.segundos)} s</i>` : '') + (x.simulado ? ' <span class="selo">teste</span>' : '')}</div></div>`).join('')}</div>`
      : '<div class="vazio-cfg">Nenhuma mensagem respondida ainda.</div>'
    const j = moldura(it, [['geral', 'Visão geral'], ['instr', 'Como responder'], ['regras', 'Regras'], ['hist', `Histórico${log.length ? ' (' + log.length + ')' : ''}`]],
      { geral, instr, regras, hist },
      `<button id="wf-ver">${CANAIS[c].ver}</button><span class="wf-esp"></span>${cfg.ativo ? '<button id="wf-desl">Desligar</button>' : ''}<button class="btn-pri" id="wf-salvar">${cfg.ativo ? 'Salvar' : 'Salvar e ligar'}</button>`)
    if (aba) j.ir(aba)
    ligarIA(j, `Quero ajustar o atendimento automático do ${IG ? 'Instagram Direct' : 'WhatsApp'} (ferramenta navegador_${IG ? 'instagram' : 'whatsapp'}_atendimento). Instruções atuais: ${String(cfg.instrucoes || '(nenhuma)').slice(0, 800)}`)
    j.q('#wf-ver').onclick = () => window.sb.atendimento.mostrar(c)
    const salvar = async (ativo) => {
      const q = (s) => j.q(s)
      if (ativo && !q('#wf-instr').value.trim()) { j.ir('instr'); return j.msg('err', 'Escreva como a IA deve responder antes de ligar.') }
      const r = await window.sb.atendimento.configurar({ ativo, instrucoes: q('#wf-instr').value, intervalo: +q('#wf-int').value || 10, ignorar: q('#wf-ign').value, so: q('#wf-so').value, grupos: !!q('#wf-grupos')?.checked, simular: q('#wf-sim').checked }, c)
      if (r && r.ok === false) return j.msg('err', r.erro || 'Não consegui salvar.')
      j.fechar()
      await lerAtend(c)
      pintar()
    }
    j.q('#wf-salvar').onclick = () => salvar(true)
    const dl = j.q('#wf-desl')
    if (dl) dl.onclick = () => salvar(false)
  }

  // ---- agendado (cron) ----
  async function abrirAgendado(it, aba) {
    const r = R.lista.find((x) => x.id === it.id)
    if (!r) return
    const geral = `<dl class="wf-dl"><dt>O que faz</dt><dd class="wf-pedido">${esc(r.pedido || '—')}</dd>
      <dt>Quando</dt><dd>${esc(r.quando)}</dd><dt>Próxima vez</dt><dd>${esc(r.ativa ? fmt(r.proxima) : r.concluida ? 'já terminou' : 'pausado')}</dd>
      <dt>Última vez</dt><dd>${esc(fmt(r.ultima))}${r.status ? ` · ${r.status === 'ok' || r.status === 'success' ? 'deu certo' : esc(r.status)}` : ''}</dd>
      ${r.erro ? `<dt>Erro</dt><dd class="wf-erro">${esc(r.erro)}</dd>` : ''}</dl>${blocoIA('Ex.: mande o resultado também no meu WhatsApp')}`
    const editar = `<div class="campo"><label for="wf-nome">Nome</label><input id="wf-nome" type="text" maxlength="80" value="${esc(r.nome)}"></div>
      <div class="campo"><label for="wf-ped">O que o agente deve fazer</label><textarea id="wf-ped" rows="7">${esc(r.pedido)}</textarea>
      <small class="mut">Escreva como pediria a uma pessoa: o que olhar, o que fazer e onde entregar o resultado.</small></div>
      ${editorQuando('wf-q')}`
    const res = '<div class="vazio-cfg">Carregando…</div>'
    const j = moldura(it, [['geral', 'Visão geral'], ['editar', 'Editar'], ['res', 'Último resultado']], { geral, editar, res },
      `<button class="btn-perigo" id="wf-apagar">Apagar</button><span class="wf-esp"></span>${r.concluida ? '' : `<button id="wf-pausa">${r.ativa ? 'Pausar' : 'Retomar'}</button>`}<button id="wf-rodar">▶ Rodar agora</button><button class="btn-pri" id="wf-salvar" hidden>Salvar</button>`)
    const quando = ligarQuando(j, 'wf-q', r.expressao)
    const mudou = () => { j.q('#wf-salvar').hidden = false }
    ;['#wf-nome', '#wf-ped'].forEach((s) => j.q(s).addEventListener('input', mudou))
    j.q('[data-p="editar"]').addEventListener('change', mudou)
    j.q('[data-p="editar"]').addEventListener('click', (e) => { if (e.target.closest('.chip')) mudou() })
    if (aba) j.ir(aba)
    ligarIA(j, `Quero ajustar o workflow "${r.nome}" (id ${r.id}). Hoje ele roda: ${r.quando}. Ele faz: ${String(r.pedido).slice(0, 600)}`)
    window.sb.rotinas.saida(r.id).then((s) => {
      const o = s.ok ? s.dado?.saida : null
      // a saída do Hermes traz o pedido inteiro + "## Response": mostra só a resposta (o resto fica em "ver tudo")
      const i = o ? o.texto.lastIndexOf('## Response') : -1
      const resp = o ? (i >= 0 ? o.texto.slice(i + 11).trim() : o.texto) : ''
      j.q('[data-p="res"]').innerHTML = o ? `<div class="mut">Execução de ${esc(o.arquivo.replace(/\.md$/, '').replace(/_/g, ' '))} · ${o.total} no total</div><pre class="ro-saida">${esc(resp)}</pre>${i >= 0 ? `<details><summary class="mut">Ver tudo (pedido completo enviado ao agente)</summary><pre class="ro-saida">${esc(o.texto)}</pre></details>` : ''}` : '<div class="vazio-cfg">Ainda não rodou. Clique em <b>Rodar agora</b> para testar.</div>'
    })
    const acao = async (btn, fn, ok) => {
      btn.disabled = true
      const x = await fn()
      btn.disabled = false
      if (x && x.ok === false) return j.msg('err', x.erro || 'Não deu certo.')
      if (ok) j.msg('ok', ok)
      await carregar()
      pintar()
      return true
    }
    j.q('#wf-rodar').onclick = (e) => acao(e.target, () => window.sb.rotinas.rodar(r.id), 'Rodando agora. O resultado aparece aqui quando terminar (você recebe um aviso).')
    const pz = j.q('#wf-pausa')
    if (pz) pz.onclick = async (e) => { if (await acao(e.target, () => window.sb.rotinas.acao(r.id, r.ativa ? 'pause' : 'resume'))) j.fechar() }
    j.q('#wf-apagar').onclick = async (e) => { if (confirm(`Apagar o workflow "${r.nome}"?`) && (await acao(e.target, () => window.sb.rotinas.acao(r.id, 'remove')))) j.fechar() }
    j.q('#wf-salvar').onclick = async (e) => {
      const q = quando()
      const d = { nome: j.q('#wf-nome').value, pedido: j.q('#wf-ped').value, ...(q.mudou ? q.valor : {}) }
      if (await acao(e.target, () => window.sb.rotinas.editar(r.id, d))) j.fechar()
    }
  }

  // ---------- editor de "quando" (reaproveitado no novo e no editar) ----------
  const editorQuando = (p) => `<div class="campo"><label for="${p}-f">Quando</label><select id="${p}-f">
      <option value="diaria">Todo dia</option><option value="dias-uteis">Dias úteis (seg a sex)</option><option value="semanal">Dias da semana que eu escolher</option>
      <option value="hora">A cada hora</option><option value="minutos">A cada N minutos</option><option value="expressao">Personalizado</option></select></div>
    <div class="wf-grade"><div class="campo" data-q="h"><label for="${p}-h">Horário</label><input id="${p}-h" type="time" value="08:00"></div>
    <div class="campo" data-q="m" hidden><label for="${p}-m">Minutos</label><input id="${p}-m" type="number" min="5" value="30"></div>
    <div class="campo wf-largo" data-q="e" hidden><label for="${p}-e">Expressão</label><input id="${p}-e" type="text" placeholder="0 9 * * 1  ·  every 2h"><small class="mut">Formato cron (min hora dia mês semana) ou "every 2h".</small></div></div>
    <div class="campo" data-q="d" hidden><label>Dias</label><div class="chips" id="${p}-d">${DIAS.map((d, i) => `<button type="button" class="chip" data-d="${i}">${d}</button>`).join('')}</div></div>`
  function ligarQuando(j, p, expr) {
    const q = (s) => j.q(s)
    const f = q(`#${p}-f`)
    // preenche a partir da expressão atual
    let m
    const s = String(expr || '').trim()
    if ((m = /^(\d{1,2}) (\d{1,2}) \* \* (.+)$/.exec(s))) {
      q(`#${p}-h`).value = `${String(m[2]).padStart(2, '0')}:${String(m[1]).padStart(2, '0')}`
      if (m[3] === '*') f.value = 'diaria'
      else if (m[3] === '1-5') f.value = 'dias-uteis'
      else { f.value = 'semanal'; m[3].split(',').forEach((d) => q(`#${p}-d [data-d="${+d % 7}"]`)?.classList.add('on')) }
    } else if (/^every 1h$|^every 60m$/.test(s)) f.value = 'hora'
    else if ((m = /^every (\d+)m$/.exec(s))) { f.value = 'minutos'; q(`#${p}-m`).value = m[1] }
    else if (s) { f.value = 'expressao'; q(`#${p}-e`).value = s }
    else q(`#${p}-d [data-d="1"]`)?.classList.add('on')
    const caixa = (k) => q(`[data-q="${k}"]`)
    const ajustar = () => {
      const v = f.value
      caixa('h').hidden = !['diaria', 'dias-uteis', 'semanal'].includes(v)
      caixa('d').hidden = v !== 'semanal'
      caixa('m').hidden = v !== 'minutos'
      caixa('e').hidden = v !== 'expressao'
    }
    let mudou = false
    f.onchange = () => { mudou = true; ajustar() }
    ;[`#${p}-h`, `#${p}-m`, `#${p}-e`].forEach((s2) => q(s2).addEventListener('input', () => { mudou = true }))
    q(`#${p}-d`).onclick = (e) => { const c = e.target.closest('.chip'); if (c) { c.classList.toggle('on'); mudou = true } }
    ajustar()
    return () => {
      const v = f.value
      const valor = v === 'expressao' ? { expressao: q(`#${p}-e`).value } : { frequencia: v, horario: v === 'minutos' ? q(`#${p}-m`).value : q(`#${p}-h`).value, dias: [...q(`#${p}-d`).querySelectorAll('.chip.on')].map((c) => +c.dataset.d) }
      return { mudou, valor }
    }
  }

  // ---------- novo workflow: modelos prontos + do zero + pelo chat ----------
  const MODELOS = [
    { k: 'at:whatsapp', ic: '💬', cor: '#25d366', nome: 'Responder o WhatsApp', desc: 'A IA responde seus clientes em segundos, do seu jeito.', gatilho: true },
    { k: 'at:instagram', ic: '📸', cor: '#e1306c', nome: 'Responder o Direct do Instagram', desc: 'Mensagens do Direct respondidas na hora.', gatilho: true },
    { k: 'arquivo', ic: '📁', cor: '#d9a441', nome: 'Ler um arquivo todo dia', desc: 'Confere uma planilha, pasta ou PDF e te avisa o que importa.', nomeP: 'Conferir a planilha de vendas', pedido: 'Abra o arquivo C:\\caminho\\do\\arquivo.xlsx, compare com o dia anterior e me diga em 5 linhas o que mudou. Se algo estiver fora do normal, destaque no começo.', f: 'diaria', h: '08:00' },
    { k: 'relatorio', ic: '📊', cor: '#9b7ede', nome: 'Relatório da semana', desc: 'Um resumo pronto toda semana, no dia que você escolher.', nomeP: 'Relatório semanal', pedido: 'Monte o relatório da semana: o que foi feito, números principais e próximos passos. Entregue em tópicos curtos.', f: 'semanal', h: '17:00', dias: [5] },
    { k: 'monitor', ic: '🌐', cor: '#4fb3bf', nome: 'Vigiar um site ou assunto', desc: 'Pesquisa notícias, preços ou concorrentes e te avisa.', nomeP: 'Notícias do meu mercado', pedido: 'Pesquise as notícias de hoje sobre <assunto> e me entregue as 5 mais importantes, com o link de cada uma.', f: 'diaria', h: '07:30' },
    { k: 'mensagem', ic: '⏰', cor: '#d97757', nome: 'Mensagem ou lembrete', desc: 'Manda uma mensagem ou lembrete no horário certo.', nomeP: 'Bom dia aos clientes', pedido: 'Mande no WhatsApp para os contatos <nomes> uma mensagem curta de bom dia, variando o texto a cada dia.', f: 'dias-uteis', h: '08:00' },
    { k: 'zero', ic: '✨', cor: '#a39e96', nome: 'Do zero', desc: 'Qualquer tarefa, no horário que quiser.', nomeP: '', pedido: '', f: 'diaria', h: '08:00' },
    { k: 'chat', ic: '🗨️', cor: '#5b8def', nome: 'Descrever para a IA', desc: 'Conte o que quer automatizar e a IA monta tudo com você.', chat: true },
  ]
  function novo() {
    const j = janela(`<div class="wf-j-cab"><div class="wf-tx"><h3>Novo workflow</h3><div class="wf-sub">Escolha um ponto de partida. Tudo pode ser mudado depois.</div></div><button class="icone wf-x" id="wf-fechar" aria-label="Fechar">✕</button></div>
      <div class="wf-modelos">${MODELOS.map((m) => `<button class="wf-modelo" data-k="${m.k}"><div class="wf-ic" style="--c:${m.cor}">${m.ic}</div><div><b>${esc(m.nome)}</b><small>${esc(m.desc)}</small></div></button>`).join('')}</div>`, true)
    j.el.querySelector('.janela').classList.add('wf-janela')
    j.q('#wf-fechar').onclick = () => j.fechar()
    j.q('.wf-modelos').onclick = (e) => {
      const b = e.target.closest('.wf-modelo')
      if (!b) return
      const m = MODELOS.find((x) => x.k === b.dataset.k)
      j.fechar()
      if (m.gatilho) {
        const c = m.k.slice(3)
        const it = itens().find((x) => x.chave === m.k) || { chave: m.k, tipo: 'atendimento', canal: c, nome: CANAIS[c].nome, ic: CANAIS[c].icone, cor: CANAIS[c].cor, ativo: false, selo: ['', 'Novo'], linha: 'Gatilho · confere a cada 10 s' }
        return abrirAtendimento(it, 'instr')
      }
      if (m.chat) {
        window.SBConfig.fechar()
        return window.SB?.novaConversa?.('Quero criar um workflow (uma tarefa que você faz sozinho). O que eu quero automatizar: ')
      }
      formNovo(m)
    }
  }
  function formNovo(m) {
    const j = janela(`<div class="wf-j-cab"><div class="wf-ic grande" style="--c:${m.cor}">${m.ic}</div><div class="wf-tx"><h3>${esc(m.nome)}</h3><div class="wf-sub">${esc(m.desc)}</div></div><button class="icone wf-x" id="wf-fechar" aria-label="Fechar">✕</button></div>
      <div class="wf-form"><div class="campo"><label for="wf-nome">Nome</label><input id="wf-nome" type="text" maxlength="80" value="${esc(m.nomeP)}" placeholder="Ex.: Resumo das notícias"></div>
      <div class="campo"><label for="wf-ped">O que o agente deve fazer</label><textarea id="wf-ped" rows="6" placeholder="Ex.: Leia a pasta Downloads, separe os PDFs de nota fiscal e me diga o total do mês.">${esc(m.pedido)}</textarea>
      <small class="mut">Pode ser qualquer coisa que você pediria no chat: ler arquivos, pesquisar, mandar mensagem, gerar relatório. Troque o que estiver entre &lt; &gt;.</small></div>
      ${editorQuando('wf-nq')}</div>
      <div class="alerta" id="wf-msg" hidden></div>
      <div class="rodape-j wf-rodape"><button id="wf-voltar">← Voltar</button><span class="wf-esp"></span><button class="btn-pri" id="wf-criar">Criar workflow</button></div>`, true)
    j.el.querySelector('.janela').classList.add('wf-janela')
    const quando = ligarQuando(j, 'wf-nq', '')
    const f = j.q('#wf-nq-f')
    f.value = m.f
    j.q('#wf-nq-h').value = m.h
    ;(m.dias || [1]).forEach((d) => j.q(`#wf-nq-d [data-d="${d}"]`)?.classList.add('on'))
    f.dispatchEvent(new Event('change'))
    j.q('#wf-fechar').onclick = () => j.fechar()
    j.q('#wf-voltar').onclick = () => { j.fechar(); novo() }
    j.q('#wf-criar').onclick = async (e) => {
      const msg = (t) => { const x = j.q('#wf-msg'); x.className = 'alerta err'; x.textContent = t; x.hidden = !t }
      const ped = j.q('#wf-ped').value
      if (/<[^>]+>/.test(ped)) return msg('Troque o que está entre < > pelo seu caso.')
      e.target.disabled = true
      const r = await window.sb.rotinas.criar({ nome: j.q('#wf-nome').value, pedido: ped, ...quando().valor })
      e.target.disabled = false
      if (!r.ok) return msg(r.erro || 'Não consegui criar o workflow.')
      j.fechar()
      await carregar()
      pintar()
    }
  }

  // ---------- atualização automática ----------
  const naTela = () => K.aba() === 'rotinas' && !K.fechado() && K.corpo()?.querySelector('#wf-lista')
  const aberto = () => document.querySelector('.wf-janela')
  window.sb.rotinas.aoRodar?.(() => { if (naTela() && !aberto()) carregar().then(pintar) })
  try { window.sb.atendimento?.aoEvento((e) => { const c = (e && e.canal) || 'whatsapp'; if (naTela() && !aberto()) lerAtend(c).then(pintar) }) } catch {}

  window.SBConfig.registrarAba({
    id: 'rotinas',
    nome: 'Workflows',
    grupo: 'Aplicativo',
    icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    desenhar,
  })
})()
