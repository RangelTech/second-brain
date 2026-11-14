// Aba Workflows (era Rotinas): o agente faz sozinho, em horários marcados (cron do Hermes pelo gateway). Mesmo visual das outras abas de Configurações.
;(() => {
  const K = window.SBConfigInternos
  if (!K || !window.sb?.rotinas) return
  const { esc, janela, aviso } = K
  const R = { lista: [], erro: '', carregando: false }
  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const fmt = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    if (isNaN(d)) return '—'
    const hoje = new Date()
    const mesmoDia = d.toDateString() === hoje.toDateString()
    const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return mesmoDia ? `hoje às ${hm}` : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${hm}`
  }

  async function carregar() {
    R.carregando = true
    R.erro = ''
    try {
      const r = await window.sb.rotinas.listar()
      if (r.ok && r.dado?.ok) R.lista = r.dado.rotinas
      else R.erro = r.erro || 'Não consegui ler os workflows agora.'
    } catch (e) {
      R.erro = String(e.message || e)
    }
    R.carregando = false
  }

  async function desenhar() {
    const corpo = K.corpo()
    if (!corpo) return
    corpo.innerHTML = `<div class="cfg-cab"><div><h1>Workflows</h1><p>Tarefas que o agente faz sozinho, nos horários que você escolher, mesmo com esta janela fechada: mandar o bom dia aos clientes no WhatsApp, um relatório toda sexta, uma conferência a cada hora. O resultado aparece aqui e você recebe um aviso. Para mudar um workflow, clique em <b>Editar no chat</b> e diga o que quer.</p></div>
      <div class="cfg-acoes"><button class="btn-pri" id="ro-nova">＋ Novo workflow</button></div></div><div id="ro-wa"></div><div id="ro-ig"></div><div id="ro-lista"><div class="vazio-cfg">Carregando…</div></div>`
    corpo.querySelector('#ro-nova').onclick = nova
    pintarWa('whatsapp')
    pintarWa('instagram')
    await carregar()
    pintar()
  }

  // ---------- Atendimento automático do WhatsApp (gatilho: confere a cada N segundos e a IA responde) ----------
  const ESTADOS = { vigiando: ['ok', 'Ligado, conferindo'], iniciando: ['', 'Ligando…'], precisa_qr: ['err', 'Desconectado: entre na conta (Ver a conta)'], carregando: ['', 'Abrindo o WhatsApp…'], erro: ['err', 'Deu erro'], parado: ['', 'Desligado'] }
  async function pintarWa(canal = 'whatsapp') {
    const IG = canal === 'instagram'
    const el = K.corpo()?.querySelector(IG ? '#ro-ig' : '#ro-wa')
    if (!el || !window.sb.atendimento) return
    let d = {}
    try { const r = await window.sb.atendimento.estado(canal); d = (r && r.ok ? r.dado : r) || {} } catch {}
    const c = d.config || {}
    const st = d.status || {}
    const [cls, txt] = ESTADOS[c.ativo ? st.estado || 'iniciando' : 'parado'] || ['', st.estado || '']
    const ult = (d.ultimos || []).slice(0, 8)
    el.innerHTML = `<div class="cartao-prov ro-item ro-wa" style="display:block;margin-bottom:16px">
      <div class="col"><span class="nm">${IG ? '📸 Responder o Direct do Instagram automaticamente' : '💬 Responder o WhatsApp automaticamente'} <span class="selo ${cls}">${esc(txt)}</span></span>
      <span class="sub">A cada ${esc(c.intervalo || 10)} segundos o app confere se chegou mensagem nova. Chegou: a IA lê a conversa e responde do jeito que você mandar aqui embaixo. ${st.erro ? '<br><b>Erro:</b> ' + esc(st.erro) : ''}</span></div>
      <label class="sub" style="display:block;margin-top:10px">Como responder (quem é você, tom, preços, horários, quando NÃO responder)</label>
      <textarea id="${canal}-instr" rows="5" style="width:100%;margin-top:6px" placeholder="Ex.: Sou a Loja da Ana (roupas femininas). Responda simpática e curta. Horário: seg a sáb, 9h às 18h. Entrega em Goiânia R$ 10. Se pedirem desconto, diga que vou verificar. Não responda grupos nem a minha mãe.">${esc(c.instrucoes || '')}</textarea>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:10px">
        <label class="sub">Conferir a cada <input id="${canal}-int" type="number" min="3" max="3600" value="${esc(c.intervalo || 10)}" style="width:70px"> s</label>
        ${IG ? '' : `<label class="sub"><input id="${canal}-grupos" type="checkbox" ${c.grupos ? 'checked' : ''}> responder grupos</label>`}
        <label class="sub">Não responder: <input id="${canal}-ign" type="text" value="${esc((c.ignorar || []).join(', '))}" placeholder="Mãe, Chefe" style="width:180px"></label>
      </div>
      <div class="ro-acoes" style="margin-top:12px"><button class="btn-pri" id="${canal}-lig">${c.ativo ? 'Salvar' : 'Ligar'}</button>${c.ativo ? '<button id="${canal}-desl">Desligar</button>' : ''}<button id="${canal}-ver">${IG ? 'Ver o Direct' : 'Ver o WhatsApp'}</button></div>
      ${ult.length ? `<div class="sub" style="margin-top:12px"><b>Últimas</b>${ult.map((x) => `<div style="margin-top:6px;border-top:1px solid rgba(127,127,127,.2);padding-top:6px">${esc(fmt(x.quando))} · <b>${esc(x.contato)}</b>: “${esc(String(x.recebida || '').slice(0, 120))}”<br>${x.erro ? '⚠ ' + esc(x.erro) : x.pulou ? '— sem resposta (não precisava)' : '↳ ' + esc(String(x.resposta || '').slice(0, 220)) + (x.segundos ? ` <i>(${esc(x.segundos)} s)</i>` : '')}</div>`).join('')}</div>` : ''}
    </div>`
    const salvar = async (ativo) => {
      const q = (k) => el.querySelector('#' + canal + '-' + k)
      const r = await window.sb.atendimento.configurar({ ativo, instrucoes: q('instr').value, intervalo: +q('int').value || 10, grupos: !!q('grupos')?.checked, ignorar: q('ign').value }, canal)
      if (r && r.ok === false) aviso?.(r.erro || 'Não consegui salvar.')
      setTimeout(() => pintarWa(canal), 300)
    }
    el.querySelector('#' + canal + '-lig').onclick = () => salvar(true)
    const dl = el.querySelector('#' + canal + '-desl')
    if (dl) dl.onclick = () => salvar(false)
    el.querySelector('#' + canal + '-ver').onclick = () => window.sb.atendimento.mostrar(canal)
  }
  try { window.sb.atendimento?.aoEvento((e) => { const c = (e && e.canal) || 'whatsapp'; if (K.corpo()?.querySelector('#ro-wa') && !K.corpo().querySelector('#' + c + '-instr:focus')) pintarWa(c) }) } catch {}

  function pintar() {
    const el = K.corpo()?.querySelector('#ro-lista')
    if (!el) return
    if (R.erro) return (el.innerHTML = `<div class="alerta err">${esc(R.erro)}</div>`)
    if (!R.lista.length) return (el.innerHTML = '<div class="vazio-cfg">Você ainda não tem workflows. Clique em <b>Novo workflow</b> ou peça no chat: “todo dia às 8h, manda bom dia no WhatsApp para os meus clientes”.</div>')
    el.innerHTML = `<div class="ro-itens">${R.lista.map((r) => `
      <div class="cartao-prov ro-item${r.ativa ? '' : ' ro-pausada'}" data-id="${esc(r.id)}">
        <div class="col"><span class="nm">${esc(r.nome)} ${r.concluida ? '<span class="selo">Concluído</span>' : r.ativa ? '' : '<span class="selo">Pausada</span>'} ${r.erro ? '<span class="selo err">Deu erro</span>' : r.status === 'ok' || r.status === 'success' ? '<span class="selo ok">Rodou</span>' : ''}</span>
          <span class="sub">${esc(r.quando)} · próxima: ${esc(r.ativa ? fmt(r.proxima) : '—')} · última: ${esc(fmt(r.ultima))}</span>
          <span class="sub ro-pedido">${esc(String(r.pedido).slice(0, 160))}</span></div>
        <div class="ro-acoes"><button data-a="ver">Ver resultado</button><button data-a="editar">Editar no chat</button>${r.concluida ? '' : `<button data-a="${r.ativa ? 'pause' : 'resume'}">${r.ativa ? 'Pausar' : 'Retomar'}</button>`}<button class="btn-perigo" data-a="remove">Apagar</button></div>
      </div>`).join('')}</div>`
    el.onclick = async (e) => {
      const b = e.target.closest('button[data-a]')
      if (!b) return
      const id = b.closest('.ro-item').dataset.id
      const a = b.dataset.a
      if (a === 'ver') return ver(id)
      if (a === 'editar') return editar(id)
      if (a === 'remove' && !confirm('Apagar este workflow?')) return
      b.disabled = true
      const r = await window.sb.rotinas.acao(id, a)
      if (!r.ok) K.corpo().querySelector('#ro-lista').insertAdjacentHTML('afterbegin', `<div class="alerta err">${esc(r.erro || 'Não deu certo.')}</div>`)
      await carregar()
      pintar()
    }
  }

  async function ver(id) {
    const r = await window.sb.rotinas.saida(id)
    const o = r.ok ? r.dado?.saida : null
    const item = R.lista.find((x) => x.id === id)
    const j = janela(`<h3>${esc(item?.nome || 'Workflow')}</h3>${o ? `<div class="mut">Última execução (${o.total} no total)</div><pre class="ro-saida">${esc(o.texto)}</pre>` : '<div class="vazio-cfg">Ainda não rodou. Quando rodar, o resultado aparece aqui.</div>'}<div class="rodape-j"><button id="ro-fechar">Fechar</button></div>`, true)
    j.q('#ro-fechar').onclick = () => j.fechar()
  }

  // editar = abrir uma conversa nova já com o pedido e os dados do workflow; o agente (skill workflows) mostra, pergunta e atualiza
  function editar(id) {
    const r = R.lista.find((x) => x.id === id)
    if (!r) return
    const txt = `Quero editar o workflow "${r.nome}" (id ${r.id}). Hoje ele roda: ${r.quando}. Ele faz: ${String(r.pedido).slice(0, 600)}

O que eu quero mudar: `
    window.SBConfig.fechar()
    window.SB?.novaConversa?.(txt)
  }

  function nova() {
    const j = janela(`
      <h3>Novo workflow</h3>
      <div class="campo"><label for="ro-nome">Nome</label><input id="ro-nome" placeholder="Ex.: Resumo das notícias" maxlength="80"></div>
      <div class="campo"><label for="ro-pedido">O que o agente deve fazer</label><textarea id="ro-pedido" rows="4" placeholder="Ex.: Pesquise as principais notícias de educação de hoje e me entregue um resumo de 5 linhas."></textarea></div>
      <div class="campo"><label for="ro-freq">Quando</label><select id="ro-freq"><option value="diaria">Todo dia</option><option value="dias-uteis">Dias úteis</option><option value="semanal">Toda semana</option><option value="hora">A cada hora</option><option value="minutos">A cada N minutos</option></select></div>
      <div class="campo" id="ro-h-box"><label for="ro-h">Horário</label><input id="ro-h" type="time" value="08:00"></div>
      <div class="campo" id="ro-d-box" hidden><label>Dias</label><div class="chips" id="ro-dias">${DIAS.map((d, i) => `<button type="button" class="chip${i === 1 ? ' on' : ''}" data-d="${i}">${d}</button>`).join('')}</div></div>
      <div class="campo" id="ro-m-box" hidden><label for="ro-m">Minutos</label><input id="ro-m" type="number" min="5" value="30"></div>
      <div class="alerta" id="ro-msg" hidden></div>
      <div class="rodape-j"><button id="ro-cancelar">Cancelar</button><button class="btn-pri" id="ro-criar">Criar workflow</button></div>`)
    const q = (s) => j.q(s)
    const ajustar = () => {
      const f = q('#ro-freq').value
      q('#ro-h-box').hidden = !['diaria', 'dias-uteis', 'semanal'].includes(f)
      q('#ro-d-box').hidden = f !== 'semanal'
      q('#ro-m-box').hidden = f !== 'minutos'
    }
    q('#ro-freq').onchange = ajustar
    q('#ro-dias').onclick = (e) => e.target.closest('.chip')?.classList.toggle('on')
    q('#ro-cancelar').onclick = () => j.fechar()
    q('#ro-criar').onclick = async () => {
      const f = q('#ro-freq').value
      const dias = [...q('#ro-dias').querySelectorAll('.chip.on')].map((c) => +c.dataset.d)
      const horario = f === 'minutos' ? q('#ro-m').value : q('#ro-h').value
      const btn = q('#ro-criar')
      btn.disabled = true
      const r = await window.sb.rotinas.criar({ nome: q('#ro-nome').value, pedido: q('#ro-pedido').value, frequencia: f, horario, dias })
      btn.disabled = false
      if (!r.ok) return aviso(q('#ro-msg'), 'err', r.erro || 'Não consegui criar o workflow.')
      j.fechar()
      await carregar()
      pintar()
    }
  }

  window.sb.rotinas.aoRodar?.(() => { if (K.aba() === 'rotinas' && !K.fechado()) carregar().then(pintar) })

  window.SBConfig.registrarAba({
    id: 'rotinas',
    nome: 'Workflows',
    grupo: 'Aplicativo',
    icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    desenhar,
  })
})()
