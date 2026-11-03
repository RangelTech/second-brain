// Aba Skills: árvore, editor, histórico, busca e atualização em tempo real.
;(() => {
  const K = window.SBConfigInternos
  if (!K) return
  const { esc, janela, aviso } = K
  const SK = { itens: [], aberta: null, original: '', previa: false, busca: '', abertos: new Set(['minhas']) }
  const $ = (sel) => K.corpo().querySelector(sel)

  async function desenhar() {
    const r = await window.sb.skills.listar()
    SK.itens = r.ok ? r.dado : []
    K.corpo().innerHTML = `
      <div class="cfg-cab"><div><h1>Skills</h1><p>O que o agente sabe fazer. Skills criadas pelo agente aparecem aqui na hora. As da Rangel Tech (rangeltech) são só leitura: copie para as suas para editar.</p></div>
        <div class="cfg-acoes"><button class="btn-pri" id="sk-nova">＋ Nova skill</button></div></div>
      <div class="sk-layout">
        <div class="sk-arvore"><input type="search" id="sk-busca" placeholder="Buscar em todas as skills" value="${esc(SK.busca)}"><div id="sk-lista"></div></div>
        <div class="sk-editor" id="sk-editor"></div>
      </div>`
    desenharArvore()
    desenharEditor()
    $('#sk-nova').onclick = novaSkill
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
    if (SK.aberta && ta && ta.value !== SK.original && !window.confirm('Há alterações não salvas. Descartar?')) return
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
      <div class="msg" id="sk-msg" hidden></div>`
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
      if (!window.confirm(`Apagar "${SK.aberta}"? Vai para a lixeira do sistema.`)) return
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

  function novaSkill() {
    const j = janela(`<h3>Nova skill</h3><div class="campo"><label for="ns-nome">Nome</label><input type="text" id="ns-nome" placeholder="ex.: relatorio-semanal"></div><div class="campo"><label for="ns-cat">Categoria (pasta)</label><input type="text" id="ns-cat" value="minhas"></div><div class="msg" id="ns-msg" hidden></div><div class="rodape-j"><button id="ns-cancelar">Cancelar</button><button class="btn-pri" id="ns-ok">Criar</button></div>`)
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
