// Aba "Acesso web": liga este computador ao site de acesso remoto (login e senha da conta), para controlá-lo pelo celular ou
// por outro computador. Só aparece no app instalado; na versão web esta aba fica escondida.
;(() => {
  const K = window.SBConfigInternos
  if (!K || window.__sbWeb || !window.sb.acessoWeb) return
  const { esc, aviso } = K
  const $ = (sel) => K.corpo()?.querySelector(sel)
  let est = { ativo: false, conectado: false, erro: '', nome: '', url: '', maquinaId: '' }

  function desenhar() {
    if (!K.corpo()) return // a tela de configuração ainda não existe (não desenha antes de abrir)
    K.corpo().innerHTML = `
      <div class="cfg-cab"><div><h1>Acesso web</h1><p>Controle este Cérebro Pro pelo celular ou por outro computador, entrando com o e-mail e a senha da sua conta. O computador precisa estar ligado e com o app aberto.</p></div></div>
      <div class="cartao-rem">
        <div class="linha-rem"><div><b>Permitir acesso pela web</b><div class="mut" id="aw-status"></div></div><label class="interruptor"><input type="checkbox" id="aw-ativo"><span></span></label></div>
        <div class="alerta" id="aw-msg" hidden></div>
        <div class="linha-rem"><div><b>Nome deste computador</b><div class="mut">Como ele aparece na lista ao entrar pelo site.</div></div><div class="linha-nome"><input id="aw-nome" type="text" maxlength="60" aria-label="Nome deste computador"><button class="btn-pri" id="aw-salvar">Salvar</button></div></div>
        <div class="linha-rem"><div><b>Endereço</b><div class="mut">Abra no navegador do celular ou de outro computador e entre com a sua conta.</div></div><a class="btn-pri" id="aw-abrir" href="#" target="_blank" rel="noopener">Abrir o site</a></div>
      </div>`
    $('#aw-ativo').onchange = async (e) => {
      const r = await window.sb.acessoWeb.ativar(e.target.checked)
      if (r && r.erro) aviso($('#aw-msg'), 'err', r.erro)
    }
    $('#aw-salvar').onclick = async () => {
      const r = await window.sb.acessoWeb.renomear($('#aw-nome').value)
      aviso($('#aw-msg'), r && r.erro ? 'err' : 'ok', r && r.erro ? r.erro : 'Nome salvo.')
    }
    $('#aw-abrir').onclick = (e) => {
      e.preventDefault()
      window.sb.abrirExterno(est.url)
    }
    pintar(true)
  }

  function pintar(primeira) {
    if (!$('#aw-status')) return
    $('#aw-ativo').checked = est.ativo
    if (primeira) $('#aw-nome').value = est.nome || ''
    $('#aw-abrir').textContent = est.url ? est.url.replace(/^https?:\/\//, '') : 'Abrir o site'
    $('#aw-status').innerHTML = !est.ativo
      ? 'Desligado. Ninguém consegue controlar este computador pela web.'
      : est.conectado
        ? '<span class="selo ok">conectado</span> Pronto: entre pelo site com a sua conta.'
        : `<span class="selo err">sem conexão</span> ${esc(est.erro || 'Tentando conectar…')}`
  }

  window.sb.acessoWeb.aoEstado((e) => {
    est = e
    pintar(false)
  })
  window.sb.acessoWeb.estado().then((e) => {
    est = e
    pintar(true)
  })

  window.SBConfig.registrarAba({
    id: 'acessoweb',
    nome: 'Acesso web',
    grupo: 'Aplicativo',
    icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/></svg>',
    desenhar,
  })
})()
