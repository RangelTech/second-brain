// Instagram Direct no navegador do app (mesma sessão/login do navegador), para o atendimento automático.
// Mesma interface do whatsapp-web.js usada pelo atendimento.js: pronto, novas, abrirLinha, lerAberta, enviarAberta.
// Medido 14/11/2026 (instagram.com/direct/inbox): cada conversa é um [role=button] cuja 1ª linha é o nome; a não lida tem o texto
// "Unread"/"Não lida"; na conversa, mensagem do dono fica encostada à DIREITA e a do contato à ESQUERDA; a caixa é
// [contenteditable][role=textbox] e Enter envia.
const URL_IG = 'https://www.instagram.com/direct/inbox/'

function criar({ vista, carregar, esperar }) {
  const wc = () => vista().webContents
  const js = (c) => wc().executeJavaScript(c, true)
  async function clicarEm(expr) {
    const r = await js(`(() => { const e = ${expr}; if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } })()`)
    if (!r) return false
    for (const type of ['mouseDown', 'mouseUp']) wc().sendInputEvent({ type, x: Math.round(r.x), y: Math.round(r.y), button: 'left', clickCount: 1 })
    return true
  }
  const tecla = (keyCode, modifiers = []) => { for (const type of ['keyDown', 'keyUp']) wc().sendInputEvent({ type, keyCode, modifiers }) }

  async function estadoPagina() {
    return js(String.raw`(() => {
      if (/accounts\/login|\/challenge\//.test(location.pathname) || document.querySelector('input[name="password"]')) return 'login'
      if (!/\/direct\//.test(location.pathname)) return 'fora'
      return [...document.querySelectorAll('[role=button]')].some((b) => /\n/.test(b.innerText)) ? 'ok' : 'carregando'
    })()`)
  }
  async function pronto() {
    for (let i = 0; i < 40; i++) {
      const s = await estadoPagina().catch(() => 'carregando')
      if (s === 'ok' || s === 'login') return s === 'ok' ? 'ok' : 'qr'
      if (s === 'fora' && i % 10 === 0) await carregar(URL_IG)
      await esperar(1000)
    }
    return 'carregando'
  }

  async function novas() {
    let s = await estadoPagina().catch(() => 'carregando')
    if (s === 'fora') { await carregar(URL_IG); s = await estadoPagina().catch(() => 'carregando') }
    if (s === 'login') return { estado: 'qr', conversas: [] }
    if (s !== 'ok') return { estado: 'carregando', conversas: [] }
    // volta para a caixa de entrada se estiver dentro de uma conversa (a lista continua visível ao lado, mas garante a lista inteira)
    const lista = await js(String.raw`[...document.querySelectorAll('[role=button]')].map((b) => {
      const linhas = b.innerText.split('\n').map((x) => x.trim()).filter(Boolean)
      if (linhas.length < 2) return null
      const naoLida = linhas.some((l) => /^(Unread|Não lida)$/i.test(l))
      if (!naoLida) return null
      const nome = linhas[0]
      const m = linhas.join(' ').match(/(\d+)\s+(new messages|novas mensagens)/i)
      return { nome, nao_lidas: m ? +m[1] : 1, grupo: false, previa: linhas.slice(1).filter((l) => !/^(Unread|Não lida|·)$/i.test(l)).join(' ').slice(0, 160) }
    }).filter(Boolean)`)
    return { estado: 'ok', conversas: lista }
  }

  async function abrirLinha(nome) {
    const alvo = JSON.stringify(String(nome))
    const ok = await clicarEm(`[...document.querySelectorAll('[role=button]')].find((b) => b.innerText.split('\\n')[0].trim() === ${alvo})`)
    if (!ok) throw new Error('Não achei a conversa ' + nome + ' no Direct.')
    for (let i = 0; i < 30; i++) {
      await esperar(300)
      if (await js(`!!document.querySelector('[contenteditable=true][role=textbox]') && /\\/direct\\/t\\//.test(location.pathname)`)) break
    }
    await esperar(1200) // mensagens carregando
    return { titulo: nome }
  }

  // mensagens da conversa aberta: lado direito = dono ("você"), esquerdo = contato, centro = data/aviso
  const lerAberta = (limite = 15) => js(String.raw`(() => {
    const tb = document.querySelector('[contenteditable=true][role=textbox]')
    if (!tb) return []
    const tr = tb.getBoundingClientRect()
    let pane = tb
    while (pane.parentElement && !(pane.getBoundingClientRect().height > innerHeight * 0.7 && pane.getBoundingClientRect().width >= tr.width)) pane = pane.parentElement
    const P = pane.getBoundingClientRect()
    const els = [...pane.querySelectorAll('div[dir=auto], span[dir=auto]')].filter((e) => e.innerText.trim() && !e.querySelector('[dir=auto]') && !tb.contains(e))
    const out = []
    for (const e of els) {
      const r = e.getBoundingClientRect()
      if (r.top > tr.top) continue
      const esq = r.left - P.left, dir = P.right - r.right
      const texto = e.innerText.trim()
      if (Math.abs(esq - dir) <= 30) { out.push({ info: texto.slice(0, 120) }); continue }
      out.push({ id: null, de: esq > dir ? 'você' : 'contato', texto, meta: '' })
    }
    // id estável: posição + texto (o Instagram não expõe id da mensagem)
    return out.slice(-${'${'}LIM${'}'}).map((m, i, a) => (m.info ? m : { ...m, id: 'ig|' + location.pathname + '|' + (a.length - i) + '|' + m.texto.slice(0, 80) }))
  })()`.replace('${LIM}', String(Math.min(60, Math.max(1, limite)))))

  async function enviarAberta(texto) {
    const msg = String(texto || '').trim()
    if (!msg) throw new Error('Mensagem vazia.')
    const ok = await clicarEm(`document.querySelector('[contenteditable=true][role=textbox]')`)
    if (!ok) throw new Error('Não achei a caixa de mensagem do Direct.')
    await esperar(150)
    const linhas = msg.split(/\r?\n/)
    for (let i = 0; i < linhas.length; i++) {
      if (i) tecla('Return', ['shift'])
      if (linhas[i]) await wc().insertText(linhas[i])
    }
    await esperar(250)
    const naCaixa = await js(`(document.querySelector('[contenteditable=true][role=textbox]') || {}).innerText || ''`)
    if (!naCaixa.trim()) throw new Error('O texto não entrou na caixa do Direct; nada foi enviado.')
    tecla('Return')
    await esperar(900)
    return { enviado: true }
  }

  return { pronto, novas, abrirLinha, lerAberta, enviarAberta }
}

module.exports = { criar, URL_IG }
