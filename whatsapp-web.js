// Ferramentas de WhatsApp (spec 37): atalhos testados em cima do WhatsApp Web aberto no navegador integrado, para o agente fazer em segundos
// o que levava dezenas de passos (e errava: a caixa de mensagem do WhatsApp ignora texto posto por JavaScript e guarda rascunho).
// Tudo acontece na vista do navegador, com a sessão do usuário: digitação e cliques são eventos de teclado e mouse de verdade.
const fs = require('fs')
const path = require('path')

const URL_WA = 'https://web.whatsapp.com/'
const soDigitos = (n) => String(n || '').replace(/\D/g, '')

function criar({ vista, carregar, garantirVisivel, esperar, pastaDownloads }) {
  const wc = () => vista().webContents
  const js = (codigo) => wc().executeJavaScript(codigo, true)

  async function clicarEm(seletorOuJs) {
    const r = await js(`(() => { const e = ${seletorOuJs}; if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } })()`)
    if (!r) return false
    for (const type of ['mouseDown', 'mouseUp']) wc().sendInputEvent({ type, x: Math.round(r.x), y: Math.round(r.y), button: 'left', clickCount: 1 })
    return true
  }
  const tecla = (keyCode, modifiers = []) => {
    for (const type of ['keyDown', 'keyUp']) wc().sendInputEvent({ type, keyCode, modifiers })
  }
  const limparCampo = () => {
    tecla('A', [process.platform === 'darwin' ? 'meta' : 'control'])
    tecla('Backspace')
  }

  // garante o WhatsApp aberto e logado; devolve 'ok' ou 'qr'
  async function pronto() {
    await garantirVisivel()
    if (!/web\.whatsapp\.com/.test(wc().getURL())) await carregar(URL_WA)
    for (let i = 0; i < 60; i++) {
      const s = await js(`document.querySelector('#pane-side') ? 'ok' : (document.querySelector('canvas[aria-label], [data-ref]') ? 'qr' : 'carregando')`)
      if (s === 'ok') return 'ok'
      if (s === 'qr') return 'qr'
      await esperar(1000)
    }
    throw new Error('O WhatsApp não terminou de carregar em 60 s.')
  }
  async function exigirLogin() {
    if ((await pronto()) === 'qr') throw new Error('O WhatsApp não está conectado: o QR code está na tela do navegador. Peça para o usuário escanear (WhatsApp no celular > Aparelhos conectados > Conectar um aparelho) ou entrar por Configurações > Conexões.')
  }

  const titulo = () => js(`(document.querySelector('#main [data-testid="conversation-info-header-chat-title"]') || {}).innerText || ''`)

  async function abrir({ contato, numero }) {
    await exigirLogin()
    if (numero) {
      const n = soDigitos(numero)
      if (n.length < 10) throw new Error('Número inválido: use DDI + DDD + número, por exemplo 5562999999999.')
      await carregar(`${URL_WA}send?phone=${n}`)
      for (let i = 0; i < 30; i++) {
        const s = await js(`document.querySelector('#main footer [contenteditable="true"]') ? 'ok' : (/inválido|invalid|não está no WhatsApp/i.test(document.body.innerText) ? 'invalido' : '')`)
        if (s === 'ok') return { titulo: await titulo() }
        if (s === 'invalido') throw new Error(`O número ${n} não tem WhatsApp ou é inválido.`)
        await esperar(1000)
      }
      throw new Error('A conversa não abriu em 30 s.')
    }
    const nome = String(contato || '').trim()
    if (!nome) throw new Error('Diga o contato (nome como aparece no WhatsApp) ou o número.')
    // busca: foca o campo de pesquisa, limpa, digita o nome e clica no primeiro resultado com esse nome
    const achou = await clicarEm(`document.querySelector('#side [contenteditable="true"], #side input[type="text"]')`)
    if (!achou) throw new Error('Não achei a busca do WhatsApp.')
    await esperar(200)
    limparCampo()
    await wc().insertText(nome)
    await esperar(1500)
    const alvo = JSON.stringify(nome.toLowerCase())
    const ok = await clicarEm(`(() => { const its = [...document.querySelectorAll('#pane-side [data-testid="cell-frame-title"]')]; const q = ${alvo}; const t = its.find((e) => e.innerText.toLowerCase().trim() === q) || its.find((e) => e.innerText.toLowerCase().includes(q)); return t ? (t.closest('[role="listitem"],[role="row"]') || t) : null })()`)
    if (!ok) throw new Error(`Não achei a conversa "${nome}". Confira o nome como aparece no WhatsApp ou use o número.`)
    for (let i = 0; i < 15; i++) {
      await esperar(400)
      if (await js(`!!document.querySelector('#main footer [contenteditable="true"]')`)) break
    }
    // limpa a busca para a lista voltar ao normal
    await clicarEm(`document.querySelector('#side [contenteditable="true"], #side input[type="text"]')`)
    limparCampo()
    await clicarEm(`document.querySelector('#main footer [contenteditable="true"]')`)
    return { titulo: await titulo() }
  }

  // quem mandou cada mensagem: o WhatsApp põe um rótulo escondido "Você:" ou "Nome:" no começo de cada grupo de balões
  // (o mesmo que o leitor de tela fala). Balões seguidos do mesmo autor herdam o rótulo. A posição na tela NÃO serve (medido 13/11/2026).
  const QUEM_JS = `const quemDe = (rows) => { let ult = null; return rows.map((r) => { const l = [...r.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label') || '').find((a) => /:$/.test(a) && a.length < 60); if (l) ult = l.slice(0, -1).trim(); return ult }) }; const ehVoce = (n) => /^(você|voce|you|tú)$/i.test(n || '');`

  // mensagens da conversa aberta: texto, quem, quando, e um marcador para mídia
  const LER_MSGS = (limite) => `(() => { ${QUEM_JS} const rows = [...document.querySelectorAll('#main [role="row"]')]; const quem = quemDe(rows); return rows.map((r, i) => [r, quem[i]]).slice(-${limite}).map(([r, q]) => {
    const p = r.querySelector('[data-pre-plain-text]')
    const meta = p ? p.getAttribute('data-pre-plain-text').trim() : ''
    const texto = p ? (p.querySelector('span.selectable-text') || p).innerText.trim() : ''
    const midia = r.querySelector('img[src^="blob:"]:not([draggable="false"])') ? '[imagem]' : r.querySelector('video') ? '[vídeo]' : r.querySelector('[data-icon*="audio"], [data-icon*="ptt"], audio, button[aria-label*="mensagem de voz"], button[aria-label*="voice message"]') ? '[áudio]' : r.querySelector('[data-icon*="document"], [title*="Baixar"]') ? '[documento: ' + ((r.innerText.split('\\n')[0]) || '') + ']' : ''
    if (!meta && !midia) { const t = r.innerText.trim(); return t ? { info: t.slice(0, 120) } : null }
    const links = [...new Set([...r.querySelectorAll('a[href^="http"]')].map((x) => x.href))]
    return { meta, de: ehVoce(q) ? 'você' : q || undefined, texto, midia: midia || undefined, links: links.length ? links : undefined }
  }).filter(Boolean) })()`

  // data da mensagem a partir de "[13:28, 13/11/2026] Nome:"
  const dataDe = (meta) => {
    const m = /\[(\d{1,2}):(\d{2}), (\d{1,2})\/(\d{1,2})\/(\d{4})\]/.exec(meta || '')
    return m ? new Date(+m[5], +m[4] - 1, +m[3], +m[1], +m[2]).getTime() : null
  }
  // rola a conversa para cima até a mensagem mais antiga carregada ser anterior ao corte (ou parar de carregar)
  async function carregarDesde(corte) {
    for (let i = 0; i < 40; i++) {
      const r = await js(`(() => { const p = document.querySelector('#main [data-pre-plain-text]'); const rows = document.querySelectorAll('#main [role="row"]').length; let e = document.querySelector('#main [role="row"]'); while (e && !(e.scrollHeight > e.clientHeight + 50 && /auto|scroll/.test(getComputedStyle(e).overflowY))) e = e.parentElement; if (e) e.scrollTop = 0; return { meta: p ? p.getAttribute('data-pre-plain-text') : '', rows } })()`)
      const t = dataDe(r.meta)
      if (t && t < corte) return
      await esperar(1300)
      const depois = await js(`document.querySelectorAll('#main [role="row"]').length`)
      if (depois <= r.rows && i > 1) return
    }
  }

  async function ler({ contato, numero, limite, dias }) {
    const a = await abrir({ contato, numero })
    await mensagensCarregadas()
    if (Number(dias) > 0) {
      const corte = Date.now() - Number(dias) * 86400000
      await carregarDesde(corte)
      const todas = await js(LER_MSGS(2000))
      let ultimaData = null
      const filtradas = todas.filter((m) => {
        const t = dataDe(m.meta)
        if (t) ultimaData = t
        return (t || ultimaData || Date.now()) >= corte
      })
      return { conversa: a.titulo, desde: new Date(corte).toISOString().slice(0, 10), total: filtradas.length, mensagens: filtradas.slice(-300), links: [...new Set(filtradas.flatMap((m) => m.links || []))] }
    }
    const msgs = await js(LER_MSGS(Math.min(80, Math.max(1, Number(limite) || 30))))
    return { conversa: a.titulo, mensagens: msgs }
  }

  async function enviar({ contato, numero, texto }) {
    const msg = String(texto || '')
    if (!msg.trim()) throw new Error('Mensagem vazia.')
    const a = await abrir({ contato, numero })
    const ok = await clicarEm(`document.querySelector('#main footer [contenteditable="true"]')`)
    if (!ok) throw new Error('Não achei a caixa de mensagem.')
    await esperar(200)
    limparCampo() // o WhatsApp guarda rascunho: sem limpar, o texto antigo iria junto
    const linhas = msg.split(/\r?\n/)
    for (let i = 0; i < linhas.length; i++) {
      if (i) tecla('Return', ['shift'])
      if (linhas[i]) await wc().insertText(linhas[i])
    }
    await esperar(300)
    const naCaixa = await js(`(document.querySelector('#main footer [contenteditable="true"]') || {}).innerText || ''`)
    const primeira = (linhas.find((l) => l.trim()) || '').slice(0, 20)
    if (primeira && !naCaixa.includes(primeira.replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, '').trim().slice(0, 10))) throw new Error('O texto não entrou na caixa de mensagem; nada foi enviado.')
    tecla('Return')
    await esperar(1800)
    const ultima = await js(`(() => { const r = [...document.querySelectorAll('#main [data-pre-plain-text]')].pop(); return r ? r.getAttribute('data-pre-plain-text') + r.innerText.slice(0, 200) : '' })()`)
    return { conversa: a.titulo, enviado: true, ultima_mensagem_da_conversa: ultima }
  }

  async function conversas({ filtro, limite }) {
    await exigirLogin()
    const naoLidas = filtro === 'nao_lidas'
    await clicarEm(`[...document.querySelectorAll('#side button, #side [role="tab"]')].find((b) => ${naoLidas ? "/^N[ãa]o lidas/i" : "/^Tudo$|^All$/i"}.test(b.innerText.trim()))`)
    await esperar(900)
    const lista = await js(`[...document.querySelectorAll('#pane-side [role="listitem"], #pane-side [role="row"]')].map((r) => {
      const t = r.querySelector('[data-testid="cell-frame-title"]')
      if (!t) return null
      const nome = t.innerText.split('\\n').pop().trim()
      if (nome === 'Arquivadas') return null
      const linhas = r.innerText.split('\\n').map((x) => x.trim()).filter(Boolean)
      const nl = (r.querySelector('[aria-label*="não lida"], [aria-label*="unread"]') || {}).getAttribute?.('aria-label') || ''
      return { nome, hora: linhas[1] || '', ultima: linhas.slice(2).filter((x) => !/^\\d+$/.test(x)).join(' ').slice(0, 120), nao_lidas: (nl.match(/\\d+/) || [0])[0] * 1 }
    }).filter(Boolean)`)
    if (naoLidas) await clicarEm(`[...document.querySelectorAll('#side button, #side [role="tab"]')].find((b) => /^Tudo$|^All$/i.test(b.innerText.trim()))`)
    return { conversas: lista.slice(0, Math.min(50, Number(limite) || 20)) }
  }

  // baixa as imagens, vídeos e áudios mais recentes da conversa (como estão carregados na tela) para a pasta Downloads/WhatsApp
  // tipo: 'todos' | 'audio' | 'imagem' | 'video'; de: 'todos' | 'contato' (só o que a outra pessoa mandou) | 'voce'
  // Mensagens de voz NÃO ficam no HTML: o WhatsApp cria o <audio> só quando aperta play. Aqui apertamos play com o som mudo,
  // pegamos o áudio na hora (gancho no play) e pausamos: o usuário não ouve nada e a conversa não muda.
  // logo depois de abrir, o WhatsApp ainda está trazendo as mensagens: espera a lista parar de mudar (até 12 s)
  async function mensagensCarregadas() {
    let antes = -1
    let iguais = 0
    for (let i = 0; i < 24; i++) {
      await esperar(500)
      const n = await js(`document.querySelectorAll('#main [role="row"]').length`)
      iguais = n > 0 && n === antes ? iguais + 1 : 0
      if (iguais >= 2) break
      antes = n
    }
    await esperar(500)
  }

  async function baixar({ contato, numero, limite, tipo, de }) {
    const a = await abrir({ contato, numero })
    await mensagensCarregadas()
    const N = Math.min(20, Number(limite) || 5)
    const t = String(tipo || 'todos')
    const quem = String(de || 'todos')
    const colher = () => js(`(async () => {
      const N = ${N}, T = ${JSON.stringify(t)}, DE = ${JSON.stringify(quem)}
      ${QUEM_JS}
      // A lista do WhatsApp é virtual: só as mensagens perto da tela existem no HTML. Então colhe o que está visível, de baixo para
      // cima, e sobe a conversa aos poucos (até 15 passos) até juntar N. Cada mensagem entra uma vez só (id da mensagem).
      const pegar = async (src) => {
        const b = await (await fetch(src)).blob()
        const buf = new Uint8Array(await b.arrayBuffer())
        let s = ''
        for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode.apply(null, buf.subarray(i, i + 32768))
        return { tipo: b.type, b64: btoa(s) }
      }
      if (!window.__sbHook) {
        window.__sbHook = true; window.__sbSrc = []
        const p = HTMLMediaElement.prototype.play
        HTMLMediaElement.prototype.play = function () { try { if (window.__sbCap) { this.muted = true; window.__sbSrc.push(this) } } catch {} return p.apply(this, arguments) }
      }
      const ehBotaoVoz = (b) => /mensagem de voz|voice message|mensaje de voz/i.test(b.getAttribute('aria-label') || '') && /reproduzir|play|reproducir/i.test(b.getAttribute('aria-label') || '')
      const querMidia = T === 'todos' || T === 'imagem' || T === 'video'
      const querVoz = T === 'todos' || T === 'audio'
      const selMidia = T === 'imagem' ? 'img[src^="blob:"]' : T === 'video' ? 'video[src^="blob:"]' : 'img[src^="blob:"], video[src^="blob:"]'
      const rolavel = (() => { let e = document.querySelector('#main [role="row"]'); while (e && e !== document.body) { const o = getComputedStyle(e).overflowY; if ((o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight) return e; e = e.parentElement } return null })()
      if (rolavel) { rolavel.scrollTop = rolavel.scrollHeight; await new Promise((r) => setTimeout(r, 800)) }
      const vistos = new Set()
      const out = []
      let tentou = 0
      for (let passo = 0; passo < 15 && out.length < N; passo++) {
        const linhas = [...document.querySelectorAll('#main [role="row"]')]
        const quem = quemDe(linhas)
        for (let k = linhas.length - 1; k >= 0 && out.length < N; k--) {
          const r = linhas[k]
          const idm = (r.querySelector('[data-id]') || {}).dataset?.id || r.innerText.slice(0, 80)
          if (vistos.has(idm)) continue
          if (DE !== 'todos' && (!quem[k] || (ehVoce(quem[k]) ? 'voce' : 'contato') !== DE)) continue
          const bt = querVoz ? [...r.querySelectorAll('button[aria-label], [role="button"][aria-label]')].find(ehBotaoVoz) : null
          const md = querMidia ? [...r.querySelectorAll(selMidia)].filter((e) => !(e.tagName === 'IMG' && e.naturalWidth < 120)) : []
          if (!bt && !md.length) continue
          vistos.add(idm)
          for (const e of md) { try { if (out.length < N) out.push(await pegar(e.src)) } catch {} }
          if (bt && out.length < N) {
            tentou++
            window.__sbSrc = []; window.__sbCap = true
            try {
              bt.scrollIntoView({ block: 'center' }); bt.click()
              let el = null
              for (let i = 0; i < 60 && !el; i++) { await new Promise((ok) => setTimeout(ok, 250)); el = window.__sbSrc.find((x) => x.src && x.src.startsWith('blob:')) }
              if (el) { try { el.pause(); el.currentTime = 0 } catch {} ; const it = await pegar(el.src); it.voz = true; out.push(it) }
            } catch {}
            window.__sbCap = false
          }
        }
        if (out.length >= N || !rolavel) break
        const antes = rolavel.scrollTop
        rolavel.scrollTop = Math.max(0, rolavel.scrollTop - rolavel.clientHeight * 0.8)
        await new Promise((ok) => setTimeout(ok, 1500))
        if (antes === 0 && rolavel.scrollTop === 0) break
      }
      const ls = [...document.querySelectorAll('#main [role="row"]')]
      const diag = { linhas: ls.length, comQuem: quemDe(ls).filter(Boolean).length, botoes: [...new Set(ls.flatMap((r) => [...r.querySelectorAll('button[aria-label], [role="button"][aria-label]')].map((b) => b.getAttribute('aria-label'))))].slice(0, 12) }
      return { out, tentou, diag }
    })()`)
    let r = await colher()
    // logo depois que o WhatsApp carrega, o primeiro play só "acorda" o tocador e não entrega o áudio: tenta de novo uma vez
    if (!r.out.length && r.tentou) {
      await esperar(1500)
      r = await colher()
    }
    const itens = r.out
    if (process.env.SB_WA_DIAG) console.log('[wa-baixar]', JSON.stringify(r.diag), 'tentou', r.tentou)
    const pasta = path.join(pastaDownloads(), 'WhatsApp')
    fs.mkdirSync(pasta, { recursive: true })
    const ext = (t) => (/jpeg/.test(t) ? '.jpg' : /png/.test(t) ? '.png' : /webp/.test(t) ? '.webp' : /mp4/.test(t) ? '.mp4' : /ogg|opus/.test(t) ? '.ogg' : /mpeg/.test(t) ? '.mp3' : '.bin')
    const base = String(a.titulo || 'conversa').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 40) || 'conversa'
    const carimbo = Date.now()
    const arquivos = itens.map((it, i) => {
      const f = path.join(pasta, `${base}-${it.voz ? 'voz-' : ''}${carimbo}-${i + 1}${ext(it.tipo)}`)
      fs.writeFileSync(f, Buffer.from(it.b64, 'base64'))
      return f
    })
    const dica = arquivos.length
      ? ''
      : 'Nada desse tipo carregado na tela. Role a conversa para cima (navegador_rolar direcao=cima, algumas vezes) para carregar mensagens antigas e tente de novo. Documentos (PDF etc.) baixam pelo botão de download da mensagem.'
    return { conversa: a.titulo, arquivos, dica }
  }

  async function estado() {
    const s = await pronto().catch(() => 'erro')
    return { conectado: s === 'ok', precisa_qr: s === 'qr' }
  }

  return { estado, conversas, abrir, ler, enviar, baixar }
}

module.exports = { criar, soDigitos }
