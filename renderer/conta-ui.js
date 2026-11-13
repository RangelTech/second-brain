// Conta do Segundo Cérebro na interface (spec 37): duas bolinhas na barra do chat, ao lado da do contexto
// (limite da sessão de 5 h e saldo de créditos) e o painel "Sua conta" no topo da aba Créditos e limites (créditos, pacotes, limites, plano e nível de segurança).
;(() => {
  if (!window.sb?.contaPainel) return
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const num = (n) => Number(n || 0).toLocaleString('pt-BR')
  const tok = (n) => (n >= 1e6 ? `${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi` : n >= 1e3 ? `${Math.round(n / 1e3).toLocaleString('pt-BR')} mil` : num(n))
  const renova = (iso) => {
    if (!iso) return ''
    const ms = new Date(iso).getTime() - Date.now()
    if (isNaN(ms) || ms <= 0) return 'renova agora'
    const m = Math.round(ms / 60000)
    if (m < 60) return `renova em ${m} min`
    const h = Math.floor(m / 60)
    return h < 48 ? `renova em ${h} h ${m % 60} min` : `renova em ${Math.round(h / 24)} dias`
  }
  const PLANOS = { light: 'Light', lite: 'Lite', max: 'Max', ultra: 'Ultra', enterprise: 'Enterprise', free: 'Teste grátis' }
  const NIVEIS = {
    1: { nome: 'Livre', txt: 'Sem censura. O modelo responde tudo, sem trava nenhuma.' },
    2: { nome: 'Equilibrado', txt: 'Sem censura de opinião ou de tema adulto. Um filtro barra só pedidos perigosos ou ilegais.' },
    3: { nome: 'Protegido', txt: 'Dois filtros conferem cada pedido. Bom para empresas e equipes.' },
  }
  const MOEDA = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7"/><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/></svg>'
  const INF = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6.5 8.5C4 8.5 3 10.3 3 12s1 3.5 3.5 3.5c3.5 0 7.5-7 11-7 2.5 0 3.5 1.8 3.5 3.5s-1 3.5-3.5 3.5c-3.5 0-7.5-7-11-7z"/></svg>'

  let ultimo = null
  async function buscar() {
    try {
      const r = await window.sb.contaPainel()
      ultimo = r && r.ok ? r : null
    } catch {
      ultimo = null
    }
    pintarBarra()
    return ultimo
  }

  // ---------- bolinhas da barra do chat
  function montarBarra() {
    const ctx = document.getElementById('ctx-medidor')
    if (!ctx || document.getElementById('sessao-medidor')) return
    ctx.insertAdjacentHTML('beforebegin', `
      <button class="sb-bolinha creditos" id="creditos-chip" hidden aria-label="Seus créditos">${MOEDA}<span id="creditos-txt"></span></button>
      <button class="sb-bolinha ctx-medidor sessao" id="sessao-medidor" hidden aria-label="Limite da sessão"><svg viewBox="0 0 20 20" width="16" height="16"><circle cx="10" cy="10" r="8" class="ctx-trilho"/><circle cx="10" cy="10" r="8" class="ctx-arco" id="sessao-arco" transform="rotate(-90 10 10)"/></svg><span id="sessao-txt"></span></button>`)
    for (const id of ['creditos-chip', 'sessao-medidor']) document.getElementById(id).onclick = () => window.SBConfig?.abrir('cota')
  }
  function pintarBarra() {
    montarBarra()
    const chip = document.getElementById('creditos-chip')
    const ses = document.getElementById('sessao-medidor')
    if (!chip || !ses) return
    const d = ultimo
    if (!d) {
      chip.hidden = true
      ses.hidden = true
      return
    }
    chip.hidden = d.creditos == null
    if (d.creditos != null) {
      document.getElementById('creditos-txt').textContent = num(d.creditos)
      chip.classList.toggle('baixo', d.creditos <= 25)
      chip.title = `${num(d.creditos)} créditos para imagens, vídeos, voz e edição com IA. Clique para ver ou comprar mais.`
    }
    const s = d.sessao
    ses.hidden = !s
    if (!s) return
    const arco = document.getElementById('sessao-arco')
    if (!s.limit) {
      ses.classList.remove('medio', 'alto')
      ses.classList.add('livre')
      arco.style.strokeDashoffset = '0'
      document.getElementById('sessao-txt').innerHTML = INF
      ses.title = 'Sua sessão não tem limite.'
      return
    }
    ses.classList.remove('livre')
    const pct = Math.min(100, Math.round(((s.used || 0) / s.limit) * 100))
    ses.classList.toggle('medio', pct >= 60)
    ses.classList.toggle('alto', pct >= 85)
    arco.style.strokeDashoffset = String(50.27 * (1 - pct / 100))
    document.getElementById('sessao-txt').textContent = `${pct}%`
    ses.title = `Sessão de 5 horas: ${pct}% usado (${tok(s.used || 0)} de ${tok(s.limit)} tokens). ${renova(s.resets_at)}.`
  }

  // ---------- painel "Sua conta" (topo da aba Créditos e limites)
  function barra(rotulo, w) {
    if (!w) return ''
    if (!w.limit) return `<div class="ct-lim"><div class="ct-lim-top"><span>${rotulo}</span><span class="ct-pill livre">${INF} Sem limite</span></div></div>`
    const pct = Math.min(100, Math.round(((w.used || 0) / w.limit) * 100))
    const cls = pct >= 85 ? 'bx' : pct >= 60 ? 'med' : ''
    return `<div class="ct-lim"><div class="ct-lim-top"><span>${rotulo}</span><span class="mut">${pct}% usado · ${esc(renova(w.resets_at))}</span></div><div class="trilho"><i class="${cls}" style="width:${pct}%"></i></div><div class="mut ct-mini">${tok(w.used || 0)} de ${tok(w.limit)} tokens</div></div>`
  }
  async function desenharPainel(el) {
    if (!el) return
    el.innerHTML = '<div class="ct-grade"><div class="ct-card carregando"></div><div class="ct-card carregando"></div><div class="ct-card carregando"></div></div>'
    const d = await buscar()
    if (!d) {
      el.innerHTML = '<div class="ct-card ct-vazio">Entre na sua conta do Segundo Cérebro para ver créditos, limites e o seu plano.</div><h2 class="ct-sub">Contas conectadas</h2>'
      return
    }
    const nivel = NIVEIS[d.nivel] || null
    const melhor = d.pacotes.length > 2 ? d.pacotes[d.pacotes.length - 2].id : null
    const semLimite = (!d.sessao || !d.sessao.limit) && (!d.semana || !d.semana.limit)
    el.innerHTML = `
      <div class="ct-grade">
        <section class="ct-card ct-creditos">
          <div class="ct-rot">${MOEDA} Créditos</div>
          <div class="ct-saldo">${num(d.creditos ?? 0)}<small>créditos</small></div>
          <div class="mut ct-mini">≈ US$ ${((d.creditos || 0) * 0.02).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · 1 crédito = US$ 0,02</div>
          <p class="ct-exp">Para o que o seu computador não roda sozinho: imagens e vídeos com IA, troca de rosto e de roupa, voz clonada e dublagem. O agente diz quanto custa antes e só cobra se der certo.</p>
        </section>
        <section class="ct-card">
          <div class="ct-rot">Limites de uso</div>
          ${semLimite ? `<div class="ct-semlimite">${INF}<div><b>Sua sessão não tem limite</b><div class="mut">Converse à vontade, sem janela de 5 horas nem de semana.</div></div></div>` : barra('Sessão de 5 horas', d.sessao) + barra('Semana', d.semana)}
        </section>
        <section class="ct-card">
          <div class="ct-rot">Plano e tipo de chat</div>
          <div class="ct-plano"><b>${esc(PLANOS[d.plano] || d.plano || 'Sem plano')}</b>${d.renova ? `<span class="mut"> · ${esc(renova(d.renova).replace('renova', 'renova a assinatura'))}</span>` : ''}</div>
          <div class="ct-chat">Unlimited · ${d.nivel === 3 ? 'com filtros' : 'sem censura'}</div>
          <div class="ct-niveis">${[1, 2, 3].map((n) => `<span class="${n === d.nivel ? 'on' : ''}">${n} · ${NIVEIS[n].nome}</span>`).join('')}</div>
          <div class="mut ct-mini">${esc(nivel ? nivel.txt : 'Nível de segurança não informado.')}</div>
          ${d.proximo ? `<button class="ct-link" data-url="${esc(d.proximo.url)}">Conhecer o plano ${esc(d.proximo.name)}</button>` : ''}
        </section>
      </div>
      ${d.pacotes.length ? `<div class="ct-pacotes-cab"><h2>Comprar créditos</h2><span class="mut">Liberados na hora. Valem por ${d.pacotes[0].expires_days || 30} dias.</span></div>
      <div class="ct-pacotes">${d.pacotes.map((p) => `
        <button class="ct-pacote${p.id === melhor ? ' destaque' : ''}" ${p.checkout_url ? `data-url="${esc(p.checkout_url)}"` : 'disabled'}>
          ${p.id === melhor ? '<span class="ct-selo">Mais escolhido</span>' : p.bonus_pct ? `<span class="ct-selo leve">+${p.bonus_pct}% de bônus</span>` : ''}
          <span class="ct-qtd">${num(p.creditos)}</span><span class="mut">créditos</span>
          <span class="ct-preco">R$ ${num(p.preco_brl)}</span>
          <span class="mut ct-mini">${p.checkout_url ? 'Comprar' : 'Em breve'}</span>
        </button>`).join('')}</div>` : ''}
      <div class="ct-amigo"><b>Roda no seu computador, de graça:</b> conversa com o agente, animações (Motion), editor de vídeo, transcrição, voz local e automações. O que o seu computador não aguenta, a gente roda na nuvem pra você, em créditos.</div>
      <h2 class="ct-sub">Contas conectadas</h2>`
    el.onclick = (e) => {
      const b = e.target.closest('[data-url]')
      if (b) window.sb.abrirExterno(b.dataset.url)
    }
  }

  window.SBConta = { atualizar: buscar, desenharPainel, ultimo: () => ultimo }
  buscar()
  setInterval(() => {
    if (!document.hidden) buscar()
  }, 60000)
  window.addEventListener('focus', () => buscar())
})()
