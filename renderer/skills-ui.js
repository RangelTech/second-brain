// Aba Skills: árvore, editor, histórico, busca e atualização em tempo real.
;(() => {
  const K = window.SBConfigInternos
  if (!K) return
  const { esc, janela, aviso } = K
  const SK = { itens: [], aberta: null, original: '', previa: false, busca: '', abertos: new Set(['minhas']) }
  const $ = (sel) => K.corpo()?.querySelector(sel)

  async function desenhar() {
    const r = await window.sb.skills.listar()
    SK.itens = r.ok ? r.dado : []
    K.corpo().innerHTML = `
      <div class="cfg-cab"><div><h1>Skills</h1><p>O que o agente sabe fazer. Skills criadas pelo agente aparecem aqui na hora. As da Rangel Tech (rangeltech) são só leitura: copie para as suas para editar.</p></div>
        <div class="cfg-acoes"><span id="sk-repo-selo"></span><button id="sk-repo">GitHub</button><button class="btn-pri" id="sk-nova">＋ Nova skill</button></div></div>
      <div class="sk-layout">
        <div class="sk-arvore"><input type="search" id="sk-busca" placeholder="Buscar em todas as skills" value="${esc(SK.busca)}"><div id="sk-lista"></div></div>
        <div class="sk-editor" id="sk-editor"></div>
      </div>`
    desenharArvore()
    desenharEditor()
    $('#sk-nova').onclick = novaSkill
    $('#sk-repo').onclick = janelaRepo
    pintarSelo()
    let t
    $('#sk-busca').oninput = (e) => {
      SK.busca = e.target.value
      clearTimeout(t)
      t = setTimeout(desenharArvore, 250)
    }
    $('#sk-lista').onclick = (e) => {
      const b = e.target.closest('button')
      if (!b) return
      if (b.dataset.sk) return abrirSkill(b.dataset.sk)
      if (b.dataset.dir) {
        SK.abertos.has(b.dataset.dir) ? SK.abertos.delete(b.dataset.dir) : SK.abertos.add(b.dataset.dir)
        desenharArvore()
      }
    }
  }

  async function desenharArvore() {
    const alvo = $('#sk-lista')
    if (!alvo) return
    if (SK.busca.trim().length >= 2) {
      const r = await window.sb.skills.buscar(SK.busca)
      const achados = r.ok ? r.dado : []
      alvo.innerHTML = achados.length ? achados.map((a) => `<button class="sk-item" data-sk="${esc(a.caminho)}"><b>${esc(a.caminho)}</b><small>${a.linha}: ${esc(a.trecho)}</small></button>`).join('') : '<div class="mut">Nada encontrado.</div>'
      return
    }
    const filhos = (pref) =>
      SK.itens
        .filter((i) => i.caminho.startsWith(pref) && i.caminho.slice(pref.length).split('/').length === 1)
        .sort((a, b) => (a.tipo === b.tipo ? a.caminho.localeCompare(b.caminho) : a.tipo === 'dir' ? -1 : 1))
    const montar = (pref, nivel) =>
      filhos(pref)
        .map((i) => {
          const nome = i.caminho.split('/').pop()
          if (i.tipo === 'dir') {
            const aberto = SK.abertos.has(i.caminho)
            return `<button class="sk-dir" style="padding-left:${8 + nivel * 14}px" data-dir="${esc(i.caminho)}">${aberto ? '▾' : '▸'} ${esc(nome)}${i.somenteLeitura && nivel === 0 ? ' <span class="selo">só leitura</span>' : ''}</button>${aberto ? montar(i.caminho + '/', nivel + 1) : ''}`
          }
          return `<button class="sk-item ${SK.aberta === i.caminho ? 'on' : ''}" style="padding-left:${22 + nivel * 14}px" data-sk="${esc(i.caminho)}">${esc(nome)}${i.nova ? ` <span class="selo ok">${i.origem === 'agente' ? 'criada pelo Hermes' : 'nova'}</span>` : ''}</button>`
        })
        .join('')
    alvo.innerHTML = montar('', 0) || '<div class="mut">Nenhuma skill ainda.</div>'
  }

  async function abrirSkill(caminho) {
    const ta = $('#sk-texto')
    if (SK.aberta && ta && ta.value !== SK.original && !(await window.sbConfirmar('Há alterações não salvas. Descartar?', { sim: 'Descartar', perigo: true }))) return
    const r = await window.sb.skills.ler(caminho)
    if (!r.ok) return window.alert(r.erro)
    SK.aberta = caminho
    SK.original = r.dado
    SK.previa = false
    desenharEditor()
    desenharArvore()
  }

  function desenharEditor() {
    const el = $('#sk-editor')
    if (!el) return
    if (!SK.aberta) {
      el.innerHTML = '<div class="vazio-cfg" style="margin:12px">Escolha uma skill na árvore ou crie uma nova.</div>'
      return
    }
    const item = SK.itens.find((i) => i.caminho === SK.aberta)
    const ro = !!item?.somenteLeitura
    el.innerHTML = `
      <div class="sk-barra"><b class="sk-nome">${esc(SK.aberta)}</b><span id="sk-sujo" class="selo err" hidden>não salvo</span><span class="gap"></span>
        ${ro ? '<button id="sk-copiar">Copiar para minhas</button>' : '<button id="sk-previa">Pré-visualizar</button><button id="sk-hist">Histórico</button><button class="btn-perigo" id="sk-apagar">Apagar</button><button class="btn-pri" id="sk-salvar">Salvar</button>'}</div>
      <div class="sk-corpo"><textarea id="sk-texto" spellcheck="false" ${ro ? 'readonly' : ''}></textarea><div class="sk-previa corpo" id="sk-prev" hidden></div></div>
      <div class="alerta" id="sk-msg" hidden></div>`
    const ta = $('#sk-texto')
    ta.value = SK.original
    const sujo = () => ($('#sk-sujo').hidden = ta.value === SK.original)
    ta.oninput = () => {
      sujo()
      if (SK.previa) $('#sk-prev').innerHTML = window.SBmd(ta.value)
    }
    ta.onkeydown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (!ro) salvar()
      }
      if (e.key === 'Tab' && !ro) {
        e.preventDefault()
        ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end')
        sujo()
      }
    }
    if (ro) {
      $('#sk-copiar').onclick = async () => {
        const c = await window.sb.skills.copiar(SK.aberta)
        aviso($('#sk-msg'), c.ok ? 'ok' : 'err', c.ok ? `Copiada para ${c.dado}.` : c.erro)
        if (c.ok) desenhar()
      }
      return
    }
    $('#sk-salvar').onclick = salvar
    $('#sk-previa').onclick = () => {
      SK.previa = !SK.previa
      $('#sk-prev').hidden = !SK.previa
      $('.sk-corpo').classList.toggle('dividido', SK.previa)
      if (SK.previa) $('#sk-prev').innerHTML = window.SBmd(ta.value)
    }
    $('#sk-apagar').onclick = async () => {
      if (!(await window.sbConfirmar(`Apagar "${SK.aberta}"?\n\nVai para a lixeira do sistema.`, { sim: 'Apagar', perigo: true }))) return
      const r = await window.sb.skills.apagar(SK.aberta)
      if (!r.ok) return aviso($('#sk-msg'), 'err', r.erro)
      SK.aberta = null
      desenhar()
    }
    $('#sk-hist').onclick = historico
  }

  async function salvar() {
    const ta = $('#sk-texto')
    const r = await window.sb.skills.gravar(SK.aberta, ta.value)
    if (!r.ok) return aviso($('#sk-msg'), 'err', r.erro)
    SK.original = ta.value
    $('#sk-sujo').hidden = true
    aviso($('#sk-msg'), 'ok', 'Salvo.')
    setTimeout(() => ($('#sk-msg').hidden = true), 1800)
  }

  async function historico() {
    const r = await window.sb.skills.historico(SK.aberta)
    const lista = r.ok ? r.dado : []
    const j = janela(
      `<h3>Histórico</h3>${lista.length ? lista.map((v) => `<div class="item-ed"><span class="t">${esc(v.mensagem)} <span class="mut">${esc(new Date(v.quando).toLocaleString('pt-BR'))}</span></span><button data-h="${esc(v.hash)}">Voltar para esta versão</button></div>`).join('') : '<div class="mut">Sem histórico (o git não está disponível ou o arquivo é novo).</div>'}<div class="rodape-j"><button id="h-fechar">Fechar</button></div>`,
      true,
    )
    j.q('#h-fechar').onclick = j.fechar
    j.el.onclick = async (e) => {
      const h = e.target.dataset?.h
      if (!h) return
      const v = await window.sb.skills.versao(SK.aberta, h)
      if (v.ok && v.dado !== null) {
        $('#sk-texto').value = v.dado
        $('#sk-sujo').hidden = v.dado === SK.original
        j.fechar()
      }
    }
  }

  async function pintarSelo() {
    const el = $('#sk-repo-selo')
    if (!el) return
    const r = await window.sb.skills.repo.estado()
    const e = r.ok ? r.dado : { vinculado: false }
    if (!e.vinculado) return (el.innerHTML = '')
    const pend = e.alterado || e.adiante || e.atras
    el.innerHTML = `<span class="selo ${pend ? '' : 'ok'}" title="${esc(e.url)}">${pend ? 'pendente de sincronizar' : 'sincronizado'}</span>`
  }

  async function janelaRepo() {
    const r = await window.sb.skills.repo.estado()
    const e = r.ok ? r.dado : { vinculado: false }
    const logando = (await window.sb.skills.repo.loginDisponivel()) === true
    const quando = e.ultimaSync ? new Date(e.ultimaSync).toLocaleString('pt-BR') : 'nunca'
    const corpo = e.vinculado
      ? `<p>Vinculado a <b>${esc(e.url.replace('https://github.com/', '').replace('.git', ''))}</b>. Última sincronização: ${esc(quando)}.</p>
         <p class="mut">${e.alterado ? 'Há alterações locais ainda não enviadas. ' : ''}${e.adiante ? `${e.adiante} versão(ões) para enviar. ` : ''}${e.atras ? `${e.atras} versão(ões) novas no repositório. ` : ''}As skills da Rangel Tech (rangeltech) não vão para o repositório.</p>
         <div class="alerta" id="rp-msg" hidden></div>
         <div class="rodape-j"><button class="btn-perigo" id="rp-desv">Desvincular</button><button id="rp-fechar">Fechar</button><button class="btn-pri" id="rp-sinc">Sincronizar agora</button></div>`
      : `${logando ? '<div class="campo"><button class="btn-pri" id="rp-gh">Entrar com GitHub</button><small class="mut">Abre o GitHub no navegador, você confirma um código e pronto. Cria um repositório privado só para as suas skills.</small></div><div class="mut" style="margin:6px 0">ou use um token:</div>' : ''}<p>Versione e compartilhe suas skills entre computadores usando um repositório do GitHub (de preferência privado). O Segundo Cérebro puxa as mudanças, mescla com as suas e envia as novas.</p>
         <div class="campo"><label for="rp-url">Repositório</label><input type="text" id="rp-url" placeholder="https://github.com/voce/minhas-skills"></div>
         <div class="campo"><label for="rp-tok">Token do GitHub</label><input type="password" id="rp-tok" placeholder="ghp_… ou github_pat_…" autocomplete="off"><small class="mut">Fica cifrado neste computador. Precisa de leitura e escrita no conteúdo do repositório.</small></div>
         <div class="alerta" id="rp-msg" hidden></div>
         <div class="rodape-j"><button id="rp-fechar">Cancelar</button><button class="btn-pri" id="rp-ok">Vincular</button></div>`
    const j = janela(`<h3>Repositório das skills</h3>${corpo}`)
    const msg = (t, m) => aviso(j.q('#rp-msg'), t, m)
    j.q('#rp-fechar').onclick = j.fechar
    const sincronizar = async (opcoes = {}) => {
      msg('ok', 'Sincronizando…')
      const s = await window.sb.skills.repo.sincronizar(opcoes)
      if (!s.ok) return msg('err', s.erro)
      const d = s.dado
      if (d.conflito) {
        j.q('#rp-msg').hidden = false
        j.q('#rp-msg').className = 'alerta err'
        j.q('#rp-msg').innerHTML = `Conflito em: <b>${d.conflito.map(esc).join(', ')}</b>. Escolha qual versão vale:<div style="margin-top:8px;display:flex;gap:8px"><button id="rp-minha">Manter a minha</button><button id="rp-remota">Usar a do repositório</button></div>`
        j.q('#rp-minha').onclick = () => sincronizar({ estrategia: 'minha' })
        j.q('#rp-remota').onclick = () => sincronizar({ estrategia: 'remota' })
        return
      }
      if (d.segredos) {
        j.q('#rp-msg').hidden = false
        j.q('#rp-msg').className = 'alerta err'
        j.q('#rp-msg').innerHTML = `Estes arquivos parecem conter chaves ou senhas: <b>${d.segredos.map(esc).join(', ')}</b>. Enviar mesmo assim?<div style="margin-top:8px"><button id="rp-env">Enviar mesmo assim</button></div>`
        j.q('#rp-env').onclick = () => sincronizar({ ...opcoes, confirmarSegredos: true })
        return
      }
      msg('ok', 'Sincronizado.')
      pintarSelo()
      desenharArvore()
    }
    if (e.vinculado) {
      j.q('#rp-sinc').onclick = () => sincronizar()
      j.q('#rp-desv').onclick = async () => {
        if (!(await window.sbConfirmar('Desvincular?\n\nAs skills continuam aqui; só para de sincronizar com o GitHub.', { sim: 'Desvincular' }))) return
        await window.sb.skills.repo.desvincular()
        j.fechar()
        pintarSelo()
      }
    } else {
      if (logando)
        j.q('#rp-gh').onclick = async () => {
          msg('ok', 'Abrindo o GitHub…')
          const i = await window.sb.skills.repo.loginIniciar()
          if (!i.ok) return msg('err', i.erro)
          j.q('#rp-msg').hidden = false
          j.q('#rp-msg').className = 'alerta ok'
          j.q('#rp-msg').innerHTML = `No GitHub, digite o código <b style="font-size:18px;letter-spacing:2px">${esc(i.dado.codigo)}</b> e autorize. Esperando…`
          const a = await window.sb.skills.repo.loginAguardar(i.dado)
          if (!a.ok) return msg('err', a.erro)
          msg('ok', `Conectado como ${a.dado.usuario}. Criando o repositório…`)
          const v = await window.sb.skills.repo.criar()
          if (!v.ok) return msg('err', v.erro)
          j.fechar()
          pintarSelo()
          janelaRepo()
        }
      j.q('#rp-ok').onclick = async () => {
        msg('ok', 'Conferindo o acesso…')
        const v = await window.sb.skills.repo.vincular(j.q('#rp-url').value, j.q('#rp-tok').value)
        if (!v.ok) return msg('err', v.erro)
        j.fechar()
        pintarSelo()
        janelaRepo()
      }
    }
  }

  function novaSkill() {
    const j = janela(`<h3>Nova skill</h3><div class="campo"><label for="ns-nome">Nome</label><input type="text" id="ns-nome" placeholder="ex.: relatorio-semanal"></div><div class="campo"><label for="ns-cat">Categoria (pasta)</label><input type="text" id="ns-cat" value="minhas"></div><div class="alerta" id="ns-msg" hidden></div><div class="rodape-j"><button id="ns-cancelar">Cancelar</button><button class="btn-pri" id="ns-ok">Criar</button></div>`)
    j.q('#ns-cancelar').onclick = j.fechar
    j.q('#ns-ok').onclick = async () => {
      const r = await window.sb.skills.criar(j.q('#ns-nome').value, j.q('#ns-cat').value)
      if (!r.ok) return aviso(j.q('#ns-msg'), 'err', r.erro)
      j.fechar()
      SK.abertos.add(r.dado.split('/')[0])
      await desenhar()
      abrirSkill(r.dado)
    }
  }

  // o agente mexeu nas skills: atualiza a árvore e recarrega o arquivo aberto se não houver edição local
  let temporizador
  window.sb.skills.aoMudar(() => {
    clearTimeout(temporizador)
    temporizador = setTimeout(async () => {
      if (K.aba() !== 'skills' || K.fechado()) return
      const r = await window.sb.skills.listar()
      if (r.ok) SK.itens = r.dado
      desenharArvore()
      const ta = $('#sk-texto')
      if (SK.aberta && ta && ta.value === SK.original) {
        const l = await window.sb.skills.ler(SK.aberta)
        if (l.ok && l.dado !== SK.original) {
          SK.original = l.dado
          ta.value = l.dado
        }
      }
    }, 500)
  })

  window.SBConfig.registrarAba({
    id: 'skills',
    nome: 'Skills',
    grupo: 'Aplicativo',
    icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
    desenhar,
  })
})()
