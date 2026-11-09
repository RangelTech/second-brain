// "Visualizar cérebro" (Spec 24 §5.1): rede de neurônios em 3D, ligações por distância, pulsos e sinais viajando. Cada chamada de ferramenta do Hermes
// dispara um sinal do núcleo "Hermes" até o grupo da ferramenta e de volta. Canvas 2D, sem dependência. A parte pura (grafo, categorias, caminho) é testada em node.
;(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica()
  else raiz.SBCerebro = fabrica()
})(typeof self !== 'undefined' ? self : this, function () {
  const CATS = {
    hermes: { rotulo: 'Hermes', cor: '#e8896a' },
    memoria: { rotulo: 'Memória', cor: '#b58cff' },
    midia: { rotulo: 'Mídia', cor: '#ff7ab8' },
    navegador: { rotulo: 'Navegador', cor: '#3fe0f5' },
    arquivos: { rotulo: 'Arquivos', cor: '#7ab87a' },
    terminal: { rotulo: 'Terminal', cor: '#ffd166' },
    web: { rotulo: 'Busca na web', cor: '#6ea8ff' },
    skills: { rotulo: 'Skills', cor: '#ff9f5a' },
    agentes: { rotulo: 'Agentes', cor: '#e6e6e6' },
  }
  const SATELITES = Object.keys(CATS).filter((k) => k !== 'hermes')

  // ferramenta do Hermes (titulo + tipo do protocolo ACP) -> grupo do cérebro. Só a categoria aparece; nada do conteúdo do usuário.
  function categoriaDe(f) {
    const t = String((f && f.titulo) || '').toLowerCase()
    const k = String((f && f.tipo) || '').toLowerCase()
    if (/memor|lembr|recall|remember/.test(t)) return 'memoria'
    if (/imagem|image|v[ií]deo|video|[aá]udio|voz|voice|dubl|troc|midia|m[ií]dia|gerar/.test(t)) return 'midia'
    if (/navegador|browser|abrir (a )?p[aá]gina|clic|navigate|screenshot/.test(t)) return 'navegador'
    if (/skill/.test(t)) return 'skills'
    if (/delegat|subagent|sub-agent|agente|agent\b/.test(t)) return 'agentes'
    if (k === 'search' || /busca|search|pesquis|web/.test(t) || k === 'fetch') return 'web'
    if (k === 'execute' || /terminal|shell|comando|execut|bash|powershell/.test(t)) return 'terminal'
    if (['read', 'edit', 'delete', 'move'].includes(k) || /arquivo|file|pasta|ler |escrev|editar/.test(t)) return 'arquivos'
    if (k === 'think') return 'agentes'
    return 'agentes'
  }

  // gerador pseudoaleatório fixo: o cérebro tem sempre o mesmo desenho
  function semente(s) {
    let a = s >>> 0
    return () => ((a = (a + 0x6d2b79f5) >>> 0), (((a ^ (a >>> 15)) * (1 | a)) >>> 0) / 4294967296)
  }

  // pontos nos dois hemisférios (formato de cérebro), núcleo Hermes no centro e cada satélite numa região
  function criarGrafo(n = 110, seed = 7) {
    const rnd = semente(seed)
    const pts = []
    for (let i = 0; i < n; i++) {
      const lado = i % 2 ? 1 : -1
      const u = rnd() * Math.PI * 2
      const v = Math.acos(2 * rnd() - 1)
      pts.push({ x: lado * (0.08 + Math.abs(Math.sin(v) * Math.cos(u)) * 0.5), y: Math.cos(v) * 0.62, z: Math.sin(v) * Math.sin(u) * 0.78, p: rnd() * Math.PI * 2, cat: 'agentes' })
    }
    // núcleo: os 4 pontos mais próximos do centro
    const porCentro = pts.map((p, i) => [Math.hypot(p.x, p.y, p.z), i]).sort((a, b) => a[0] - b[0])
    const nucleo = porCentro.slice(0, 4).map((x) => x[1])
    for (const i of nucleo) pts[i].cat = 'hermes'
    // resto: ordena por ângulo em volta do eixo vertical e divide em faixas (cada ferramenta ocupa uma fatia do cérebro)
    const resto = pts.map((p, i) => i).filter((i) => !nucleo.includes(i)).sort((a, b) => Math.atan2(pts[a].z, pts[a].x) - Math.atan2(pts[b].z, pts[b].x))
    resto.forEach((i, idx) => (pts[i].cat = SATELITES[Math.floor((idx * SATELITES.length) / resto.length)]))
    const links = []
    const adj = pts.map(() => [])
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y, pts[i].z - pts[j].z)
        if (d < 0.34) {
          links.push([i, j, d])
          adj[i].push(j)
          adj[j].push(i)
        }
      }
    }
    // o núcleo precisa alcançar todo mundo: enquanto sobrar ponto fora da parte ligada ao núcleo, liga o par mais próximo (fora, dentro)
    const dist = (i, j) => Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y, pts[i].z - pts[j].z)
    const alcance = () => {
      const vistos = new Set([nucleo[0]])
      const fila = [nucleo[0]]
      while (fila.length) for (const b of adj[fila.shift()]) if (!vistos.has(b)) (vistos.add(b), fila.push(b))
      return vistos
    }
    for (let v = alcance(); v.size < n; v = alcance()) {
      let par = null
      for (let i = 0; i < n; i++) {
        if (v.has(i)) continue
        for (const j of v) if (!par || dist(i, j) < par[2]) par = [i, j, dist(i, j)]
      }
      links.push(par)
      adj[par[0]].push(par[1])
      adj[par[1]].push(par[0])
    }
    return { pts, links, adj, nucleo }
  }

  // caminho mais curto (busca em largura) de um ponto a qualquer ponto da categoria; null se não alcança
  function caminho(g, de, cat) {
    const prev = new Map([[de, -1]])
    const fila = [de]
    while (fila.length) {
      const a = fila.shift()
      if (a !== de && g.pts[a].cat === cat) {
        const rota = []
        for (let x = a; x !== -1; x = prev.get(x)) rota.unshift(x)
        return rota
      }
      for (const b of g.adj[a]) if (!prev.has(b)) (prev.set(b, a), fila.push(b))
    }
    return null
  }

  // ---------------------------------------------------------------- desenho e estado (só no navegador)
  function criarRede(canvas, { n = 110, mini = false, reduzir = false } = {}) {
    const g = criarGrafo(n)
    const bx = canvas.getContext('2d')
    const ativas = new Map() // categoria -> quantas ferramentas em andamento
    const brilho = new Float32Array(g.pts.length)
    const sinais = []
    let S = 0
    let ang = 0
    let tt = 0
    let dpr = 1
    const rgba = (hex, a) => {
      const v = parseInt(hex.slice(1), 16)
      return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${a})`
    }
    function tamanho() {
      const r = canvas.getBoundingClientRect()
      dpr = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1)
      S = Math.max(8, r.width || canvas.width)
      canvas.width = S * dpr
      canvas.height = S * dpr
      bx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    function enviar(cat, cor, volta) {
      const rota = caminho(g, g.nucleo[(Math.random() * g.nucleo.length) | 0], cat)
      if (!rota) return
      sinais.push({ rota: volta ? rota.slice().reverse() : rota, f: 0, cor, vel: mini ? 0.05 : 0.025 })
    }
    function disparar(cat, estado) {
      const c = CATS[cat] || CATS.agentes
      if (estado === 'inicio') {
        ativas.set(cat, (ativas.get(cat) || 0) + 1)
        enviar(cat, c.cor, false)
      } else {
        ativas.set(cat, Math.max(0, (ativas.get(cat) || 0) - 1))
        enviar(cat, estado === 'erro' ? '#ff6b6b' : '#7ee787', true)
        for (let i = 0; i < g.pts.length; i++) if (g.pts[i].cat === cat) brilho[i] = 1
      }
    }
    function projetar() {
      const c = Math.cos(ang)
      const s = Math.sin(ang)
      const tilt = 0.35
      const ct = Math.cos(tilt)
      const st = Math.sin(tilt)
      return g.pts.map((p) => {
        const x = p.x * c - p.z * s
        let z = p.x * s + p.z * c
        const y2 = p.y * ct - z * st
        z = p.y * st + z * ct
        const k = 1.6 / (2.4 - z)
        return { x: S / 2 + x * S * 0.78 * k, y: S / 2 + y2 * S * 0.78 * k, z, pulso: (Math.sin(tt * 2 + p.p) + 1) / 2 }
      })
    }
    function desenhar() {
      if (!S) tamanho()
      bx.clearRect(0, 0, S, S)
      const P = projetar()
      bx.lineWidth = 1
      for (const [i, j, d] of g.links) {
        const a = P[i]
        const b = P[j]
        const prof = ((a.z + b.z) / 2 + 1) / 2
        const viva = (ativas.get(g.pts[i].cat) || 0) > 0 && g.pts[i].cat === g.pts[j].cat
        bx.strokeStyle = viva ? rgba((CATS[g.pts[i].cat] || CATS.agentes).cor, 0.55 + prof * 0.35) : `rgba(63,224,245,${(0.12 + prof * 0.45) * Math.max(0, 1 - d / 0.4)})`
        bx.beginPath()
        bx.moveTo(a.x, a.y)
        bx.lineTo(b.x, b.y)
        bx.stroke()
      }
      for (let i = 0; i < P.length; i++) {
        const p = P[i]
        const cat = g.pts[i].cat
        const prof = (p.z + 1) / 2
        const emUso = (ativas.get(cat) || 0) > 0
        brilho[i] = Math.max(0, brilho[i] - 0.02)
        const r = (mini ? 0.8 : 1.2) + prof * (mini ? 1.4 : 2.2) + p.pulso * (mini ? 0.6 : 1.2) + (emUso ? 1.8 : 0) + brilho[i] * 2
        const cor = CATS[cat] || CATS.agentes
        bx.fillStyle = emUso || brilho[i] > 0.05 ? rgba(cor.cor, 0.7 + prof * 0.3) : cat === 'hermes' ? rgba(CATS.hermes.cor, 0.85) : p.pulso > 0.85 ? `rgba(255,255,255,${0.5 + prof * 0.5})` : `rgba(${80 + ((prof * 80) | 0)},${170 + ((prof * 60) | 0)},255,${0.35 + prof * 0.6})`
        bx.beginPath()
        bx.arc(p.x, p.y, r, 0, 7)
        bx.fill()
      }
      for (let k = sinais.length - 1; k >= 0; k--) {
        const sg = sinais[k]
        sg.f += sg.vel
        const seg = Math.min(sg.rota.length - 2, Math.floor(sg.f))
        if (seg < 0 || sg.f >= sg.rota.length - 1) {
          sinais.splice(k, 1)
          continue
        }
        const a = P[sg.rota[seg]]
        const b = P[sg.rota[seg + 1]]
        const f = sg.f - seg
        const x = a.x + (b.x - a.x) * f
        const y = a.y + (b.y - a.y) * f
        bx.fillStyle = rgba(sg.cor, 0.3)
        bx.beginPath()
        bx.arc(x, y, mini ? 3 : 7, 0, 7)
        bx.fill()
        bx.fillStyle = '#fff'
        bx.beginPath()
        bx.arc(x, y, mini ? 1.2 : 2.4, 0, 7)
        bx.fill()
      }
    }
    function passo() {
      if (!reduzir) ang += mini ? 0.012 : 0.005
      tt += 0.016
      desenhar()
    }
    return { disparar, passo, desenhar, tamanho, ativas: () => new Map(ativas), sinais: () => sinais.length, grafo: g }
  }

  // ---------------------------------------------------------------- interface: botão com mini cérebro e painel grande
  const ui = { grande: null, mini: null, painel: null, vistos: new Map(), raf: 0, intervaloMini: 0, legenda: null, linhaAgora: null }
  const reduzido = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const celular = () => typeof innerWidth === 'number' && innerWidth < 720

  function estilo() {
    if (document.getElementById('cerebro-css')) return
    const s = document.createElement('style')
    s.id = 'cerebro-css'
    s.textContent = `
.cerebro-mini{width:22px;height:22px;display:block}
.cerebro-tela{position:fixed;inset:0;z-index:55;background:radial-gradient(ellipse at 50% 40%,#16243a 0%,#0a1020 70%);display:flex;flex-direction:column;align-items:center;color:#e8f4ff}
.cerebro-tela[hidden]{display:none}
.cerebro-topo{width:100%;display:flex;align-items:center;justify-content:space-between;padding:14px 18px;box-sizing:border-box}
.cerebro-topo h2{margin:0;font-size:17px;font-weight:600}
.cerebro-topo button{border:1px solid #2d4057;background:transparent;color:#cfe3f7;border-radius:9px;padding:6px 14px;cursor:pointer}
.cerebro-corpo{flex:1;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:0}
.cerebro-tela canvas{width:min(78vh,92vw);height:min(78vh,92vw)}
.cerebro-agora{height:24px;font-size:14px;color:#9fc3e6;margin:4px 0 6px}
.cerebro-legenda{display:flex;flex-wrap:wrap;gap:6px 16px;justify-content:center;padding:6px 16px 16px;font-size:12.5px;color:#a9bfd6}
.cerebro-legenda i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;vertical-align:middle}
`
    document.head.appendChild(s)
  }

  function abrir() {
    estilo()
    if (!ui.painel) {
      const p = document.createElement('div')
      p.className = 'cerebro-tela'
      p.id = 'cerebro'
      p.setAttribute('role', 'dialog')
      p.setAttribute('aria-modal', 'true')
      p.setAttribute('aria-label', 'Cérebro do Hermes')
      p.innerHTML = `<div class="cerebro-topo"><h2>Cérebro do Hermes</h2><button type="button" id="cerebro-fechar">Fechar</button></div>
        <div class="cerebro-corpo"><canvas id="cerebro-canvas" aria-hidden="true"></canvas><div class="cerebro-agora" id="cerebro-agora">Em repouso. Quando o Hermes usar uma ferramenta, o sinal aparece aqui.</div></div>
        <div class="cerebro-legenda">${Object.values(CATS).map((c) => `<span><i style="background:${c.cor}"></i>${c.rotulo}</span>`).join('')}</div>`
      document.body.appendChild(p)
      ui.painel = p
      ui.linhaAgora = p.querySelector('#cerebro-agora')
      ui.grande = criarRede(p.querySelector('#cerebro-canvas'), { n: celular() ? 65 : 110, reduzir: reduzido() })
      p.querySelector('#cerebro-fechar').onclick = fechar
      document.addEventListener('keydown', (e) => e.key === 'Escape' && !p.hidden && fechar())
    }
    ui.painel.hidden = false
    ui.grande.tamanho()
    const laco = () => {
      if (ui.painel.hidden) return
      if (!document.hidden) ui.grande.passo()
      ui.raf = requestAnimationFrame(laco)
    }
    cancelAnimationFrame(ui.raf)
    ui.raf = requestAnimationFrame(laco)
  }
  function fechar() {
    if (ui.painel) ui.painel.hidden = true
    cancelAnimationFrame(ui.raf)
  }

  // liga o mini cérebro ao botão do topo do chat
  function instalar(botao) {
    if (!botao || ui.mini) return
    estilo()
    const c = document.createElement('canvas')
    c.className = 'cerebro-mini'
    c.width = c.height = 22
    botao.prepend(c)
    ui.mini = criarRede(c, { n: 30, mini: true, reduzir: reduzido() })
    ui.mini.tamanho()
    ui.intervaloMini = setInterval(() => {
      if (document.hidden) return
      if (ui.mini.sinais() || [...ui.mini.ativas().values()].some((v) => v > 0) || Math.random() < 0.34) ui.mini.passo()
    }, 90)
    botao.addEventListener('click', abrir)
  }

  // chega cada atualização de ferramenta do Hermes ({id, titulo, tipo, status}); cada ferramenta dispara início uma vez e fim uma vez
  function evento(f) {
    if (!f || !f.id) return
    const cat = categoriaDe(f)
    const antes = ui.vistos.get(f.id)
    const fim = f.status === 'completed' || f.status === 'failed'
    if (!antes) {
      ui.vistos.set(f.id, { cat, fim: false })
      for (const r of [ui.mini, ui.grande]) r && r.disparar(cat, 'inicio')
      if (ui.linhaAgora) ui.linhaAgora.textContent = `Agora: ${CATS[cat].rotulo}…`
    }
    const v = ui.vistos.get(f.id)
    if (fim && !v.fim) {
      v.fim = true
      for (const r of [ui.mini, ui.grande]) r && r.disparar(v.cat, f.status === 'failed' ? 'erro' : 'ok')
      if (ui.linhaAgora) ui.linhaAgora.textContent = f.status === 'failed' ? `${CATS[v.cat].rotulo}: não deu certo desta vez.` : `${CATS[v.cat].rotulo}: pronto.`
    }
    if (ui.vistos.size > 400) ui.vistos.delete(ui.vistos.keys().next().value)
  }

  return { CATS, categoriaDe, criarGrafo, caminho, criarRede, abrir, fechar, instalar, evento, estadoUi: () => ui }
})
