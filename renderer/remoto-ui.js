// Aba Celular: vincula o celular por QR code e lista os aparelhos vinculados (spec 20).
;(() => {
  const K = window.SBConfigInternos
  if (!K) return
  const { esc, janela, aviso } = K
  const $ = (sel) => K.corpo().querySelector(sel)
  let est = { ativo: false, conectado: false, celulares: [], erro: '' }
  let aoMudar = null

  // QR code estilizado: pontos arredondados, cantos em "olho", degradê e o logo no centro.
  function qrSvg(texto) {
    const qr = window.qrcode(0, 'H')
    qr.addData(texto)
    qr.make()
    const n = qr.getModuleCount()
    const c = 10
    const margem = 3
    const lado = (n + margem * 2) * c
    const dentroOlho = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7)
    const logo = Math.floor(n * 0.24)
    const ini = Math.floor((n - logo) / 2)
    const noLogo = (x, y) => x >= ini - 1 && x < ini + logo + 1 && y >= ini - 1 && y < ini + logo + 1
    let pontos = ''
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        if (!qr.isDark(y, x) || dentroOlho(x, y) || noLogo(x, y)) continue
        pontos += `<circle cx="${(x + margem + 0.5) * c}" cy="${(y + margem + 0.5) * c}" r="${c * 0.43}"/>`
      }
    const olho = (ox, oy) => {
      const px = (ox + margem) * c
      const py = (oy + margem) * c
      return `<rect x="${px + c / 2}" y="${py + c / 2}" width="${6 * c}" height="${6 * c}" rx="${c * 2.1}" fill="none" stroke="url(#g)" stroke-width="${c}"/><rect x="${px + 2 * c}" y="${py + 2 * c}" width="${3 * c}" height="${3 * c}" rx="${c * 1.1}" fill="url(#g)"/>`
    }
    const lc = (ini + margem) * c
    const lt = logo * c
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" role="img" aria-label="QR code para vincular o celular">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a1f12"/><stop offset="1" stop-color="#14100c"/></linearGradient></defs>
      <rect width="${lado}" height="${lado}" rx="${c * 3}" fill="#fffaf5"/>
      <g fill="url(#g)">${pontos}</g>${olho(0, 0)}${olho(n - 7, 0)}${olho(0, n - 7)}
      <rect x="${lc - 4}" y="${lc - 4}" width="${lt + 8}" height="${lt + 8}" rx="${c * 1.6}" fill="#fffaf5"/>
      <image href="img/segundo-cerebro-64.png" x="${lc + lt * 0.08}" y="${lc + lt * 0.08}" width="${lt * 0.84}" height="${lt * 0.84}"/>
    </svg>`
  }

  const quando = (t) => (t ? new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'nunca')

  function desenhar() {
    const corpo = K.corpo()
    corpo.innerHTML = `
      <div class="cfg-cab"><div><h1>Celular</h1><p>Use o celular como controle remoto do Segundo Cérebro: o que você escreve lá vai para o agente deste computador, que precisa estar ligado e com o app aberto. Sem login e sem senha: o vínculo é feito lendo um QR code.</p></div></div>
      <div class="cartao-rem">
        <div class="linha-rem"><div><b>Acesso remoto</b><div class="mut" id="rem-status"></div></div><label class="interruptor"><input type="checkbox" id="rem-ativo"><span></span></label></div>
        <div class="alerta" id="rem-msg" hidden></div>
        <div class="linha-rem"><div><b>Sincronizar celular</b><div class="mut">Abre um QR code de uso único, válido por 2 minutos.</div></div><button class="btn-pri" id="rem-qr">Mostrar QR code</button></div>
      </div>
      <h3 style="margin:22px 0 8px">Celulares vinculados</h3>
      <div id="rem-lista"></div>`
    $('#rem-ativo').checked = est.ativo
    $('#rem-ativo').onchange = async (e) => {
      const r = await window.sb.remoto.ativar(e.target.checked)
      if (!r.ok) aviso($('#rem-msg'), 'err', r.erro)
    }
    $('#rem-qr').onclick = mostrarQr
    pintar()
  }

  function pintar() {
    if (!$('#rem-status')) return
    $('#rem-ativo').checked = est.ativo
    $('#rem-status').innerHTML = !est.ativo ? 'Desligado. Ninguém consegue controlar este computador.' : est.conectado ? '<span class="selo ok">conectado</span> Pronto para receber o celular.' : `<span class="selo err">sem conexão</span> ${esc(est.erro || 'Tentando conectar…')}`
    $('#rem-qr').disabled = !est.ativo && false
    $('#rem-lista').innerHTML = est.celulares.length
      ? est.celulares.map((c) => `<div class="item-ed"><span class="t"><b>${esc(c.nome)}</b> <span class="mut">vinculado em ${esc(quando(c.criado))} · último acesso ${esc(quando(c.ultimo))}</span> ${c.online ? '<span class="selo ok">online</span>' : ''}</span><button class="btn-perigo" data-rev="${esc(c.id)}">Desconectar</button></div>`).join('')
      : '<div class="mut">Nenhum celular vinculado ainda.</div>'
    $('#rem-lista').onclick = async (e) => {
      const id = e.target.dataset?.rev
      if (!id || !window.confirm('Desconectar este celular? Ele perde o acesso na hora e precisa ler um novo QR code.')) return
      const r = await window.sb.remoto.revogar(id)
      if (!r.ok) aviso($('#rem-msg'), 'err', r.erro)
    }
  }

  async function mostrarQr() {
    const j = janela('<h3>Sincronizar celular</h3><div class="qr-caixa" id="qr-caixa"><div class="mut">Gerando…</div></div><p class="mut" id="qr-dica" style="text-align:center;margin:10px 0 0">Abra a câmera do celular e aponte para o QR code.</p><div class="rodape-j"><button id="qr-fechar">Fechar</button></div>')
    let vivo = true
    let timer
    const base = est.celulares.length
    const fechar = () => {
      vivo = false
      clearTimeout(timer)
      aoMudar = null
      j.fechar()
    }
    j.q('#qr-fechar').onclick = fechar
    const gerar = async () => {
      if (!vivo) return
      const r = await window.sb.remoto.vincular()
      if (!vivo) return
      if (!r.ok) {
        j.q('#qr-caixa').innerHTML = `<div class="alerta err">${esc(r.erro)}</div>`
        return
      }
      j.q('#qr-caixa').innerHTML = qrSvg(r.dado.url)
      timer = setTimeout(gerar, Math.max(20000, r.dado.expiraEm - 10000)) // renova antes de expirar
    }
    aoMudar = () => {
      if (est.celulares.length > base) {
        j.q('#qr-caixa').innerHTML = '<div class="qr-ok">✓</div>'
        j.q('#qr-dica').textContent = 'Celular vinculado!'
        setTimeout(fechar, 1500)
      }
    }
    gerar()
  }

  window.sb.remoto.aoEstado((e) => {
    est = e
    pintar()
    aoMudar?.()
  })
  window.sb.remoto.estado().then((e) => (est = e))

  window.SBConfig.registrarAba({
    id: 'celular',
    nome: 'Celular',
    grupo: 'Aplicativo',
    icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>',
    desenhar,
  })
})()
