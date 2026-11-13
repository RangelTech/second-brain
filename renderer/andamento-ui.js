// Em andamento (spec 34 §6.4): selo na barra do chat quando o agente deixou algo rodando em segundo plano; clicar mostra e permite parar tudo
;(() => {
  if (!window.sb?.andamento) return
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const tempo = (s) => (s < 60 ? s + ' s' : s < 3600 ? Math.round(s / 60) + ' min' : Math.floor(s / 3600) + ' h ' + Math.round((s % 3600) / 60) + ' min')
  let lista = []
  function montar() {
    const ctx = document.getElementById('creditos-chip') || document.getElementById('ctx-medidor')
    if (!ctx || document.getElementById('andamento-chip')) return
    ctx.insertAdjacentHTML('beforebegin', '<button class="sb-bolinha andamento" id="andamento-chip" hidden title="Tarefas que o agente deixou rodando"><span class="rodando"></span><span id="andamento-txt"></span></button>')
    document.getElementById('andamento-chip').onclick = abrir
  }
  async function atualizar() {
    montar()
    const r = await window.sb.andamento.listar().catch(() => null)
    lista = r && r.ok ? r.dado : []
    const b = document.getElementById('andamento-chip')
    if (!b) return
    b.hidden = !lista.length
    document.getElementById('andamento-txt').textContent = lista.length + ' em andamento'
  }
  function abrir() {
    const fundo = document.createElement('div')
    fundo.className = 'sb-modal-fundo'
    fundo.innerHTML = `<div class="sb-modal"><h3>Em andamento</h3><p class="mut">Coisas que o agente deixou rodando no seu computador (um servidor, um download, uma conversão). Elas continuam sozinhas até terminar.</p>
      <ul class="and-lista">${lista.map((x) => `<li><code>${esc(x.comando)}</code><span class="mut">${esc(x.estado)} · há ${tempo(x.segundos)}</span></li>`).join('') || '<li class="mut">Nada rodando agora.</li>'}</ul>
      <div class="rodape-j"><button data-a="fechar">Fechar</button>${lista.length ? '<button class="btn-perigo" data-a="parar">Parar tudo</button>' : ''}</div></div>`
    fundo.onclick = async (e) => {
      const a = e.target.dataset?.a
      if (e.target === fundo || a === 'fechar') return fundo.remove()
      if (a === 'parar') { e.target.disabled = true; await window.sb.andamento.parar(); fundo.remove(); atualizar() }
    }
    document.body.appendChild(fundo)
  }
  atualizar()
  setInterval(() => { if (!document.hidden) atualizar() }, 15000)
})()
