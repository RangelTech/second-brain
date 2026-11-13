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

  // mensagens da conversa aberta: texto, quem, quando, e um marcador para mídia
  const LER_MSGS = (limite) => `(() => [...document.querySelectorAll('#main [role="row"]')].slice(-${limite}).map((r) => {
    const p = r.querySelector('[data-pre-plain-text]')
    const meta = p ? p.getAttribute('data-pre-plain-text').trim() : ''
    const texto = p ? (p.querySelector('span.selectable-text') || p).innerText.trim() : ''
    const midia = r.querySelector('img[src^="blob:"]:not([draggable="false"])') ? '[imagem]' : r.querySelector('video') ? '[vídeo]' : r.querySelector('[data-icon*="audio"], [data-icon*="ptt"], audio') ? '[áudio]' : r.querySelector('[data-icon*="document"], [title*="Baixar"]') ? '[documento: ' + ((r.innerText.split('\\n')[0]) || '') + ']' : ''
    const main = document.querySelector('#main').getBoundingClientRect()
    const bolha = (p || r.querySelector('[data-testid="msg-container"]') || r).getBoundingClientRect()
    const eu = bolha.left > main.left + main.width * 0.35 // balão à direita = enviado pelo usuário
    if (!meta && !midia) { const t = r.innerText.trim(); return t ? { info: t.slice(0, 120) } : null }
    const links = [...new Set([...r.querySelectorAll('a[href^="http"]')].map((x) => x.href))]
    return { meta, de: eu ? 'você' : undefined, texto, midia: midia || undefined, links: links.length ? links : undefined }
  }).filter(Boolean))()`

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
    await esperar(800)
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
  async function baixar({ contato, numero, limite }) {
    const a = await abrir({ contato, numero })
    await esperar(1500)
    const itens = await js(`(async () => {
      const els = [...document.querySelectorAll('#main [role="row"] img[src^="blob:"], #main [role="row"] video[src^="blob:"], #main [role="row"] audio[src^="blob:"]')].filter((e) => !(e.tagName === 'IMG' && e.naturalWidth < 120)).slice(-${Math.min(20, Number(limite) || 5)})
      const out = []
      for (const e of els) {
        try {
          const b = await (await fetch(e.src)).blob()
          const buf = new Uint8Array(await b.arrayBuffer())
          let s = ''
          for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode.apply(null, buf.subarray(i, i + 32768))
          out.push({ tipo: b.type, b64: btoa(s) })
        } catch {}
      }
      return out
    })()`)
    const pasta = path.join(pastaDownloads(), 'WhatsApp')
    fs.mkdirSync(pasta, { recursive: true })
    const ext = (t) => (/jpeg/.test(t) ? '.jpg' : /png/.test(t) ? '.png' : /webp/.test(t) ? '.webp' : /mp4/.test(t) ? '.mp4' : /ogg|opus/.test(t) ? '.ogg' : /mpeg/.test(t) ? '.mp3' : '.bin')
    const base = String(a.titulo || 'conversa').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 40) || 'conversa'
    const arquivos = itens.map((it, i) => {
      const f = path.join(pasta, `${base}-${Date.now()}-${i + 1}${ext(it.tipo)}`)
      fs.writeFileSync(f, Buffer.from(it.b64, 'base64'))
      return f
    })
    return { conversa: a.titulo, arquivos, dica: arquivos.length ? '' : 'Nenhuma mídia carregada na tela. Role a conversa para cima (navegador_rolar) para carregar as antigas e tente de novo. Documentos (PDF etc.) baixam pelo botão de download da mensagem.' }
  }

  async function estado() {
    const s = await pronto().catch(() => 'erro')
    return { conectado: s === 'ok', precisa_qr: s === 'qr' }
  }

  return { estado, conversas, abrir, ler, enviar, baixar }
}

module.exports = { criar, soDigitos }
