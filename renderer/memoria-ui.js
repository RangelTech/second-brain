// Aba Memória: o que o agente guardou sobre você e sobre o seu trabalho. Dá para editar, apagar e acrescentar.
;(() => {
  const K = window.SBConfigInternos
  if (!K || !window.sb?.memoriaAgente) return
  const { esc, aviso } = K
  const M = { dado: null }

  async function carregar() {
    const r = await window.sb.memoriaAgente.estado()
    M.dado = r.ok ? r.dado : null
  }
  const total = (l) => l.reduce((n, x) => n + x.length + 3, 0)

  function bloco(quem, titulo, ajuda) {
    const d = M.dado[quem]
    return `<div class="mem-bloco" data-q="${quem}">
      <div class="mem-cab"><h2>${titulo}</h2><span class="selo">${total(d.entradas)} de ${d.limite}</span></div>
      <p class="mut">${ajuda}</p>
      <ul class="mem-lista">${d.entradas.length ? d.entradas.map((e, i) => `<li data-i="${i}"><textarea rows="2" aria-label="Entrada ${i + 1}">${esc(e)}</textarea><div class="mem-acoes"><button data-a="salvar">Salvar</button><button class="btn-perigo" data-a="apagar">Apagar</button></div></li>`).join('') : '<li class="vazio-cfg">Nada guardado ainda.</li>'}</ul>
      <div class="mem-nova"><input type="text" placeholder="Acrescentar algo" aria-label="Nova entrada"><button data-a="add">Acrescentar</button></div>
      <div class="alerta" hidden></div></div>`
  }

  async function desenhar() {
    const corpo = K.corpo()
    if (!corpo) return
    corpo.innerHTML = '<div class="vazio-cfg">Carregando…</div>'
    await carregar()
    if (!M.dado) return (corpo.innerHTML = '<div class="alerta err">Não consegui ler a memória agora.</div>')
    corpo.innerHTML = `<div class="cfg-cab"><div><h1>Memória</h1><p>O que o agente guarda entre as conversas. Ele usa isso para conhecer você e o seu trabalho. Você manda no que fica.</p></div></div>
      ${bloco('usuario', 'Sobre você', 'Seu nome, como você prefere as respostas, o que importa para você.')}
      ${bloco('agente', 'Sobre o trabalho', 'Fatos do seu computador, projetos e combinados que o agente aprendeu.')}`
    corpo.onclick = async (e) => {
      const b = e.target.closest('button[data-a]')
      if (!b) return
      const bl = b.closest('.mem-bloco')
      const quem = bl.dataset.q
      let lista = [...M.dado[quem].entradas]
      const a = b.dataset.a
      try {
        if (a === 'add') {
          const v = bl.querySelector('.mem-nova input').value.trim()
          if (!v) return
          lista.push(v)
        } else {
          const i = +b.closest('li').dataset.i
          if (a === 'apagar') lista.splice(i, 1)
          else lista[i] = b.closest('li').querySelector('textarea').value
        }
        const r = await window.sb.memoriaAgente.gravar(quem, lista)
        if (!r.ok) throw new Error(r.erro)
        await desenhar()
      } catch (err) {
        aviso(bl.querySelector('.alerta'), 'err', String(err.message || err))
      }
    }
  }

  window.SBConfig.registrarAba({
    id: 'memoria',
    nome: 'Memória',
    grupo: 'Aplicativo',
    icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 1 5 3 3 0 0 0 4 3 3 3 0 0 0 3-1V4a2 2 0 0 0-3-1z"/><path d="M15 3a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-1 5 3 3 0 0 1-4 3 3 3 0 0 1-3-1"/></svg>',
    desenhar,
  })
})()
