// Pop-up de limite estourado (Spec 24): quando acaba o uso da sessão ou a cota de imagem, vídeo ou áudio, oferece comprar crédito ou assinar o próximo plano.
// O mesmo arquivo roda no app e no acesso web (window.sb vem do IPC ou do WebSocket). O servidor decide pacotes, preço e checkout (GET /v1/credits).
;(() => {
  const TEXTOS = {
    tokens: { titulo: 'O seu uso acabou por agora', corpo: 'Você usou todo o limite de uso do seu plano. Para continuar agora, compre mais crédito ou passe para o próximo plano. Nada do que você pediu foi perdido.' },
    image: { titulo: 'Suas imagens do mês acabaram', corpo: 'Você usou todas as imagens incluídas no seu plano neste mês. Para continuar gerando agora, compre mais crédito de imagens ou passe para o próximo plano.' },
    video: { titulo: 'Seus vídeos do mês acabaram', corpo: 'Você usou todos os vídeos incluídos no seu plano neste mês. Para continuar gerando agora, compre mais crédito de vídeos ou passe para o próximo plano.' },
    audio: { titulo: 'Seu áudio do mês acabou', corpo: 'Você usou toda a voz e dublagem incluídas no seu plano neste mês. Para continuar agora, compre mais crédito de áudio ou passe para o próximo plano.' },
  }
  // avisos antes de acabar (spec 34 secao 6.18): o servidor decide (GET /v1/credits: low, renews_in_days, payment_failed); no maximo 1 por dia por tipo
  const AVISOS = {
    acabando: (kind) => ({ titulo: { image: 'Suas imagens do mês estão acabando', video: 'Seus vídeos do mês estão acabando', audio: 'Seu áudio do mês está acabando' }[kind] || 'Seu crédito está acabando',
      corpo: 'Para não parar no meio de um trabalho, você já pode garantir mais crédito agora. O que sobrar continua valendo.' }),
    renovacao: (dias) => ({ titulo: dias <= 1 ? 'Sua assinatura renova amanhã' : `Sua assinatura renova em ${Math.ceil(dias)} dias`,
      corpo: 'É só conferir se o cartão está em dia para continuar usando sem interrupção.' }),
    falhou: () => ({ titulo: 'Não conseguimos renovar sua assinatura', corpo: 'O pagamento não passou. Atualize o cartão ou pague de novo para continuar usando tudo sem interrupção.' }),
  }
  const CHECAR_MS = 30 * 60 * 1000
  const visto = (chave) => { try { return localStorage.getItem('sb-aviso-' + chave) === new Date().toISOString().slice(0, 10) } catch { return false } }
  const marcarVisto = (chave) => { try { localStorage.setItem('sb-aviso-' + chave, new Date().toISOString().slice(0, 10)) } catch {} }
  const POLL_MS = 5000
  const POLL_MAX_MS = 15 * 60 * 1000
  const estado = { aberto: false, kind: null, timer: null, inicio: 0, saldoInicial: 0 }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  }
  const dinheiro = (p) => `${p.currency === 'USD' ? 'US$' : p.currency || ''} ${Number(p.price_usd ?? p.price ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

  function estilo() {
    if (document.getElementById('creditos-css')) return
    const s = document.createElement('style')
    s.id = 'creditos-css'
    s.textContent = `
.cred-cortina{position:fixed;inset:0;z-index:60;background:rgba(10,9,8,.62);display:flex;align-items:center;justify-content:center;padding:16px}
.cred-cortina[hidden]{display:none}
.cred-caixa{background:var(--card,#2a2825);border:1px solid var(--bd,#3d3a35);border-radius:18px;width:min(440px,100%);padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.5);color:var(--fg,#ece9e4)}
.cred-caixa h2{margin:0 0 8px;font-size:20px;font-weight:600}
.cred-caixa p{margin:0 0 16px;color:var(--mut,#a39e96);line-height:1.55}
.cred-acoes{display:flex;flex-direction:column;gap:10px}
.cred-acoes button{border-radius:12px;padding:12px 16px;font-size:15px;border:1px solid var(--bd,#3d3a35);background:var(--card2,#33302c);color:var(--fg,#ece9e4);cursor:pointer;text-align:center}
.cred-acoes button.pri{background:var(--ac,#d97757);border-color:var(--ac,#d97757);color:#fff;font-weight:600}
.cred-acoes button:hover{filter:brightness(1.08)}
.cred-acoes button.suave{background:transparent;color:var(--mut,#a39e96);border-color:transparent}
.cred-nota{margin-top:12px;font-size:13px;color:var(--mut,#a39e96)}
.cred-ok{color:var(--ok,#7ab87a);font-weight:600}
.cred-alerta{border-color:color-mix(in srgb,#e5897f 45%,var(--bd,#3d3a35))}
.cred-alerta h2{color:#f0a49a}
`
    document.head.appendChild(s)
  }

  function montar() {
    let c = document.getElementById('creditos')
    if (c) return c
    estilo()
    c = document.createElement('div')
    c.id = 'creditos'
    c.className = 'cred-cortina'
    c.hidden = true
    c.setAttribute('role', 'dialog')
    c.setAttribute('aria-modal', 'true')
    c.setAttribute('aria-labelledby', 'creditos-tit')
    document.body.appendChild(c)
    return c
  }

  function fechar() {
    clearInterval(estado.timer)
    estado.timer = null
    estado.aberto = false
    const c = document.getElementById('creditos')
    if (c) c.hidden = true
  }

  async function acompanhar(kind) {
    clearInterval(estado.timer)
    estado.inicio = Date.now()
    estado.timer = setInterval(async () => {
      if (Date.now() - estado.inicio > POLL_MAX_MS) return clearInterval(estado.timer)
      let r
      try {
        r = await window.sb.creditos()
      } catch {
        return
      }
      if (r?.ok && Number(r.balances?.[kind] || 0) > estado.saldoInicial) {
        clearInterval(estado.timer)
        const c = document.getElementById('creditos')
        if (c) c.querySelector('.cred-corpo').innerHTML = `<h2 id="creditos-tit" class="cred-ok">Crédito liberado!</h2><p>Já pode continuar de onde parou. É só pedir de novo.</p><div class="cred-acoes"><button class="pri" data-acao="fechar">Continuar</button></div>`
        setTimeout(() => estado.aberto && fechar(), 6000)
      }
    }, POLL_MS)
  }

  async function abrir(kind) {
    if (estado.aberto) return
    const t = TEXTOS[kind] || TEXTOS.tokens
    const c = montar()
    estado.aberto = true
    estado.kind = kind in TEXTOS ? kind : 'tokens'
    c.hidden = false
    c.innerHTML = `<div class="cred-caixa"><div class="cred-corpo"><h2 id="creditos-tit">${esc(t.titulo)}</h2><p>${esc(t.corpo)}</p><div class="cred-acoes"><button disabled>Carregando…</button></div></div></div>`
    let r = null
    try {
      r = await window.sb.creditos()
    } catch {}
    const pacote = r?.ok ? (r.packs || []).find((p) => p.kind === estado.kind) : null
    const prox = r?.ok ? r.next_plan : null
    estado.saldoInicial = Number(r?.balances?.[estado.kind] || 0)
    const botoes = []
    if (pacote?.checkout_url) botoes.push(`<button class="pri" data-acao="comprar">Comprar crédito de ${esc(pacote.label)} · ${esc(dinheiro(pacote))}</button>`)
    if (prox?.url) botoes.push(`<button data-acao="plano">${prox.id === 'enterprise' ? 'Falar sobre o plano ' + esc(prox.name) : 'Assinar o plano ' + esc(prox.name)}</button>`)
    botoes.push('<button class="suave" data-acao="fechar">Agora não</button>')
    const nota = pacote ? `<div class="cred-nota">O crédito vale por ${esc(pacote.expires_days)} dias e é liberado na hora, assim que o pagamento é aprovado.</div>` : !r?.ok ? '<div class="cred-nota">Não consegui buscar as opções agora. Tente de novo em instantes.</div>' : ''
    c.querySelector('.cred-acoes').outerHTML = `<div class="cred-acoes">${botoes.join('')}</div>${nota}`
    c.onclick = (e) => {
      const acao = e.target?.dataset?.acao
      if (e.target === c || acao === 'fechar') return fechar()
      if (acao === 'comprar') {
        window.sb.abrirExterno(pacote.checkout_url)
        const n = c.querySelector('.cred-nota')
        if (n) n.textContent = 'Depois de pagar, volte aqui: eu aviso quando o crédito for liberado.'
        acompanhar(estado.kind)
      }
      if (acao === 'plano') window.sb.abrirExterno(prox.url)
    }
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') {
        fechar()
        document.removeEventListener('keydown', esc)
      }
    })
  }


  // aviso preventivo: mesma caixa, mesmos botões; nunca por cima de outro pop-up
  function avisar(modo, r, kind) {
    if (estado.aberto) return false
    const t = modo === 'acabando' ? AVISOS.acabando(kind) : modo === 'falhou' ? AVISOS.falhou() : AVISOS.renovacao(Number(r.renews_in_days || 0))
    const c = montar()
    estado.aberto = true
    estado.kind = kind || 'tokens'
    c.hidden = false
    const pacote = modo === 'acabando' ? (r.packs || []).find((p) => p.kind === kind) : null
    const botoes = []
    if (pacote?.checkout_url) botoes.push(`<button class="pri" data-acao="comprar">Comprar crédito de ${esc(pacote.label)} · ${esc(dinheiro(pacote))}</button>`)
    if (modo !== 'acabando' && r.manage_url) botoes.push(`<button class="pri" data-acao="conta">${modo === 'falhou' ? 'Atualizar pagamento' : 'Ver minha conta'}</button>`)
    botoes.push(`<button class="suave" data-acao="fechar">${modo === 'falhou' ? 'Depois' : 'Agora não'}</button>`)
    c.innerHTML = `<div class="cred-caixa${modo === 'falhou' ? ' cred-alerta' : ''}"><div class="cred-corpo"><h2 id="creditos-tit">${esc(t.titulo)}</h2><p>${esc(t.corpo)}</p><div class="cred-acoes">${botoes.join('')}</div></div></div>`
    estado.saldoInicial = Number(r.balances?.[estado.kind] || 0)
    c.onclick = (e) => {
      const acao = e.target?.dataset?.acao
      if (e.target === c || acao === 'fechar') return fechar()
      if (acao === 'comprar') { window.sb.abrirExterno(pacote.checkout_url); acompanhar(estado.kind) }
      if (acao === 'conta') { window.sb.abrirExterno(r.manage_url); fechar() }
    }
    return true
  }

  // consulta o servidor ao abrir o app e a cada 30 min; prioridade: pagamento recusado > renovação em até 3 dias > cota no fim
  async function checar(dados) {
    let r = dados
    if (!r) { try { r = await window.sb.creditos() } catch { return null } }
    if (!r?.ok && !dados) return null
    if (r.payment_failed && !visto('falhou')) { if (avisar('falhou', r)) marcarVisto('falhou'); return 'falhou' }
    if (r.renews_in_days != null && r.renews_in_days >= 0 && r.renews_in_days <= 3 && !visto('renovacao')) { if (avisar('renovacao', r)) marcarVisto('renovacao'); return 'renovacao' }
    for (const kind of Object.keys(r.low || {})) {
      if (visto('acabando-' + kind)) continue
      if (avisar('acabando', r, kind)) marcarVisto('acabando-' + kind)
      return 'acabando'
    }
    return null
  }
  function vigiar() {
    if (estado.vigia) return
    estado.vigia = setInterval(() => checar(), CHECAR_MS)
    setTimeout(() => checar(), 8000) // depois que o app terminou de abrir
  }

  window.SBCreditos = { abrir, fechar, avisar, checar, vigiar, estado: () => ({ ...estado }), TEXTOS, AVISOS }
  if (window.sb?.creditos) vigiar()
})()
