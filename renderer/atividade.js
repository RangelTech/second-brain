// Cartão de atividade ao vivo (Spec 25 §15): um quadradinho com um cérebro de neurônios no centro e, em volta, os ícones do que o agente pode usar
// (arquivo, internet, navegador, terminal, skill, memória, imagem/vídeo, agente auxiliar). Cada ferramenta real que o Hermes chama liga uma sinapse do
// cérebro até o ícone certo, em tempo real; sem ferramenta, o cérebro só respira. Embaixo, UMA frase de pensamento que vai mudando no mesmo lugar.
// A parte pura (categoria, frase, preferência) é testada em node; o desenho usa canvas 2D e depende do grafo de renderer/cerebro.js.
;(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./cerebro.js'))
  else raiz.SBAtividade = fabrica(raiz.SBCerebro)
})(typeof self !== 'undefined' ? self : this, function (SBC) {
  // categorias que aparecem como ícone (o núcleo "hermes" é o cérebro em si)
  const ICONES = ['arquivos', 'web', 'navegador', 'terminal', 'skills', 'memoria', 'midia', 'agentes']
  const ROTULO = { arquivos: 'Arquivos', web: 'Internet', navegador: 'Navegador', terminal: 'Terminal', skills: 'Skills', memoria: 'Memória', midia: 'Mídia', agentes: 'Agente auxiliar' }

  // categoria da ferramenta: a do cérebro, mais skill_view/skills_list (o Hermes chama assim) e as ferramentas do navegador integrado
  function categoriaDe(f) {
    const t = String((f && f.titulo) || '')
    if (/skill_view|skills_list|skill_manage|\bskill\b/i.test(t)) return 'skills'
    if (/^navegador_|navegador/i.test(t)) return 'navegador'
    const c = SBC.categoriaDe(f)
    return ICONES.includes(c) ? c : 'agentes'
  }

  // frase curta e sem jargão para o que está acontecendo; `rotulo`/`limpo` vêm do app (rotuloFerr/tituloLimpo)
  function fraseDaFerramenta(f, rotulo, limpo) {
    const cat = categoriaDe(f)
    const alvo = limpo ? String(limpo(f.titulo) || '').slice(0, 48) : ''
    const base = rotulo ? rotulo(f) : ROTULO[cat]
    if (cat === 'skills') return alvo ? `Consultando a skill ${alvo}` : 'Consultando as skills'
    if (cat === 'memoria') return 'Lembrando do que já conversamos'
    if (cat === 'midia') return base
    if (cat === 'terminal') return 'Rodando um comando…'
    return alvo && cat !== 'terminal' ? `${base}: ${alvo}` : base
  }

  // última ideia do raciocínio do modelo, em uma linha
  function fraseDoRaciocinio(txt) {
    const t = String(txt || '').replace(/\s+/g, ' ').trim()
    if (!t) return ''
    const partes = t.split(/(?<=[.!?…])\s+/)
    const ult = (partes[partes.length - 1] || t).slice(-110)
    return ult
  }

  // ---------- preferência: aberto por padrão; se o usuário fechar uma vez, fica fechado em todo chat e reinício ----------
  const CHAVE = 'sb.atividade.fechada'
  function aberto(armazen) {
    try {
      return (armazen || localStorage).getItem(CHAVE) !== '1'
    } catch {
      return true
    }
  }
  function lembrar(abrir, armazen) {
    try {
      const a = armazen || localStorage
      if (abrir) a.removeItem(CHAVE)
      else a.setItem(CHAVE, '1')
    } catch {}
  }

  // ---------- desenho ----------
  function desenharIcone(c, cat, x, y, s, cor, alfa) {
    c.save()
    c.translate(x, y)
    c.strokeStyle = cor
    c.fillStyle = cor
    c.globalAlpha = alfa
    c.lineWidth = Math.max(1.2, s * 0.09)
    c.lineCap = 'round'
    c.lineJoin = 'round'
    const h = s / 2
    c.beginPath()
    if (cat === 'arquivos') {
      c.moveTo(-h * 0.7, -h)
      c.lineTo(h * 0.2, -h)
      c.lineTo(h * 0.7, -h * 0.5)
      c.lineTo(h * 0.7, h)
      c.lineTo(-h * 0.7, h)
      c.closePath()
      c.moveTo(-h * 0.35, 0)
      c.lineTo(h * 0.35, 0)
      c.moveTo(-h * 0.35, h * 0.45)
      c.lineTo(h * 0.35, h * 0.45)
      c.stroke()
    } else if (cat === 'web') {
      c.arc(0, 0, h * 0.95, 0, 7)
      c.moveTo(-h * 0.95, 0)
      c.lineTo(h * 0.95, 0)
      c.moveTo(0, -h * 0.95)
      c.ellipse(0, 0, h * 0.42, h * 0.95, 0, -Math.PI / 2, Math.PI * 1.5)
      c.stroke()
    } else if (cat === 'navegador') {
      c.rect(-h, -h * 0.8, s, h * 1.6)
      c.moveTo(-h, -h * 0.3)
      c.lineTo(h, -h * 0.3)
      c.stroke()
      c.beginPath()
      c.arc(-h * 0.7, -h * 0.55, h * 0.1, 0, 7)
      c.fill()
    } else if (cat === 'terminal') {
      c.rect(-h, -h * 0.8, s, h * 1.6)
      c.moveTo(-h * 0.6, -h * 0.3)
      c.lineTo(-h * 0.15, 0)
      c.lineTo(-h * 0.6, h * 0.3)
      c.moveTo(h * 0.05, h * 0.35)
      c.lineTo(h * 0.55, h * 0.35)
      c.stroke()
    } else if (cat === 'skills') {
      c.moveTo(0, -h)
      c.quadraticCurveTo(h * 0.15, -h * 0.15, h, 0)
      c.quadraticCurveTo(h * 0.15, h * 0.15, 0, h)
      c.quadraticCurveTo(-h * 0.15, h * 0.15, -h, 0)
      c.quadraticCurveTo(-h * 0.15, -h * 0.15, 0, -h)
      c.stroke()
    } else if (cat === 'memoria') {
      c.ellipse(0, -h * 0.55, h * 0.85, h * 0.32, 0, 0, 7)
      c.moveTo(-h * 0.85, -h * 0.55)
      c.lineTo(-h * 0.85, h * 0.55)
      c.ellipse(0, h * 0.55, h * 0.85, h * 0.32, 0, Math.PI, 0, true)
      c.moveTo(h * 0.85, -h * 0.55)
      c.lineTo(h * 0.85, h * 0.55)
      c.stroke()
    } else if (cat === 'midia') {
      c.rect(-h, -h * 0.8, s, h * 1.6)
      c.moveTo(-h, h * 0.55)
      c.lineTo(-h * 0.35, -h * 0.05)
      c.lineTo(h * 0.1, h * 0.4)
      c.lineTo(h * 0.45, h * 0.05)
      c.lineTo(h, h * 0.6)
      c.stroke()
      c.beginPath()
      c.arc(h * 0.45, -h * 0.4, h * 0.14, 0, 7)
      c.fill()
    } else {
      // agente auxiliar: três pontos ligados
      c.arc(0, -h * 0.55, h * 0.28, 0, 7)
      c.moveTo(-h * 0.5 + h * 0.28, h * 0.5)
      c.arc(-h * 0.5, h * 0.5, h * 0.28, 0, 7)
      c.moveTo(h * 0.5 + h * 0.28, h * 0.5)
      c.arc(h * 0.5, h * 0.5, h * 0.28, 0, 7)
      c.moveTo(0, -h * 0.27)
      c.lineTo(-h * 0.5, h * 0.22)
      c.moveTo(0, -h * 0.27)
      c.lineTo(h * 0.5, h * 0.22)
      c.stroke()
    }
    c.restore()
  }

  const rgba = (hex, a) => {
    const v = parseInt(hex.slice(1), 16)
    return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${a})`
  }

  // O cartão: `canvas` e `frase` são elementos já no DOM. Devolve o controle (evento/pensar/parar/tamanho).
  function criarCartao(canvas, fraseEl, { reduzir = false } = {}) {
    const g = SBC.criarGrafo(46, 11)
    const bx = canvas.getContext('2d')
    const ativas = new Map()
    const brilho = new Float32Array(g.pts.length)
    const particulas = []
    const posicoes = {} // categoria -> {x,y}
    let W = 0
    let H = 0
    let tt = 0
    let ang = 0
    let raf = 0
    let proxEmissao = 0
    let fraseAtual = ''
    let animando = false

    function tamanho() {
      const r = canvas.getBoundingClientRect()
      const dpr = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1)
      W = Math.max(220, r.width || 320)
      H = Math.max(120, r.height || 150)
      canvas.width = W * dpr
      canvas.height = H * dpr
      bx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // ícones numa elipse em volta do cérebro (os do topo e da base ficam dentro do quadro)
      const rx = W * 0.4
      const ry = H * 0.36
      ICONES.forEach((cat, i) => {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / ICONES.length + 0.2
        posicoes[cat] = { x: W / 2 + Math.cos(a) * rx, y: H / 2 + Math.sin(a) * ry }
      })
    }

    function projetar() {
      const c = Math.cos(ang)
      const s = Math.sin(ang)
      const esc = Math.min(W, H) * 0.36
      return g.pts.map((p) => {
        const x = p.x * c - p.z * s
        const z = p.x * s + p.z * c
        const k = 1.5 / (2.3 - z)
        return { x: W / 2 + x * esc * 1.5 * k, y: H / 2 + p.y * esc * 1.5 * k, z, pulso: (Math.sin(tt * 2 + p.p) + 1) / 2 }
      })
    }

    // ponto da borda do cérebro na direção do ícone, e controle da curva (a sinapse é curva, não reta)
    function curva(cat) {
      const d = posicoes[cat]
      const dx = d.x - W / 2
      const dy = d.y - H / 2
      const n = Math.hypot(dx, dy) || 1
      const raio = Math.min(W, H) * 0.2
      const a = { x: W / 2 + (dx / n) * raio, y: H / 2 + (dy / n) * raio }
      const lado = dx >= 0 ? 1 : -1
      const c = { x: (a.x + d.x) / 2 - (dy / n) * 14 * lado, y: (a.y + d.y) / 2 + (dx / n) * 14 * lado }
      return { a, c, d: { x: d.x - (dx / n) * 13, y: d.y - (dy / n) * 13 } }
    }
    const pontoCurva = (k, t) => {
      const u = 1 - t
      return { x: u * u * k.a.x + 2 * u * t * k.c.x + t * t * k.d.x, y: u * u * k.a.y + 2 * u * t * k.c.y + t * t * k.d.y }
    }

    function emitir(cat, cor, volta) {
      particulas.push({ cat, f: 0, cor, volta: !!volta, vel: 0.016 + Math.random() * 0.006 })
      if (particulas.length > 60) particulas.shift()
    }

    function evento(cat, estado) {
      if (!ICONES.includes(cat)) cat = 'agentes'
      const cor = (SBC.CATS[cat] || SBC.CATS.agentes).cor
      if (estado === 'inicio') {
        ativas.set(cat, (ativas.get(cat) || 0) + 1)
        emitir(cat, cor, false)
      } else {
        ativas.set(cat, Math.max(0, (ativas.get(cat) || 0) - 1))
        emitir(cat, estado === 'erro' ? '#ff6b6b' : '#7ee787', true)
        for (let i = 0; i < g.pts.length; i++) brilho[i] = Math.max(brilho[i], i % 3 === 0 ? 1 : 0)
      }
    }

    function desenhar() {
      if (!W) tamanho()
      bx.clearRect(0, 0, W, H)
      const P = projetar()
      const algumaAtiva = [...ativas.values()].some((v) => v > 0)

      // sinapses (curvas) até os ícones ativos
      for (const cat of ICONES) {
        const n = ativas.get(cat) || 0
        if (n <= 0) continue
        const cor = (SBC.CATS[cat] || SBC.CATS.agentes).cor
        const k = curva(cat)
        bx.strokeStyle = rgba(cor, 0.22 + 0.1 * Math.sin(tt * 6))
        bx.lineWidth = 3
        bx.beginPath()
        bx.moveTo(k.a.x, k.a.y)
        bx.quadraticCurveTo(k.c.x, k.c.y, k.d.x, k.d.y)
        bx.stroke()
        bx.strokeStyle = rgba(cor, 0.85)
        bx.lineWidth = 1.2
        bx.stroke()
      }

      // malha do cérebro
      for (const [i, j, d] of g.links) {
        const a = P[i]
        const b = P[j]
        const prof = ((a.z + b.z) / 2 + 1) / 2
        bx.strokeStyle = `rgba(63,224,245,${(0.1 + prof * 0.4) * Math.max(0, 1 - d / 0.4) * (algumaAtiva ? 1.15 : 0.8)})`
        bx.lineWidth = 0.8
        bx.beginPath()
        bx.moveTo(a.x, a.y)
        bx.lineTo(b.x, b.y)
        bx.stroke()
      }
      for (let i = 0; i < P.length; i++) {
        const p = P[i]
        const prof = (p.z + 1) / 2
        brilho[i] = Math.max(0, brilho[i] - 0.025)
        const r = 0.9 + prof * 1.7 + p.pulso * 0.9 + brilho[i] * 1.6 + (algumaAtiva ? 0.5 : 0)
        const nucleo = g.pts[i].cat === 'hermes'
        bx.fillStyle = nucleo ? rgba(SBC.CATS.hermes.cor, 0.95) : brilho[i] > 0.05 ? rgba('#7ee787', 0.8) : p.pulso > 0.85 ? `rgba(255,255,255,${0.5 + prof * 0.5})` : `rgba(${90 + ((prof * 90) | 0)},${190 + ((prof * 50) | 0)},245,${0.35 + prof * 0.5})`
        bx.beginPath()
        bx.arc(p.x, p.y, r, 0, 7)
        bx.fill()
      }

      // ícones
      for (const cat of ICONES) {
        const pos = posicoes[cat]
        const on = (ativas.get(cat) || 0) > 0
        const cor = (SBC.CATS[cat] || SBC.CATS.agentes).cor
        if (on) {
          bx.fillStyle = rgba(cor, 0.16 + 0.08 * Math.sin(tt * 7))
          bx.beginPath()
          bx.arc(pos.x, pos.y, 17 + 2 * Math.sin(tt * 7), 0, 7)
          bx.fill()
        }
        desenharIcone(bx, cat, pos.x, pos.y, on ? 17 : 14, on ? cor : '#8a93a3', on ? 1 : 0.5)
      }

      // partículas viajando pela sinapse
      for (let k = particulas.length - 1; k >= 0; k--) {
        const q = particulas[k]
        q.f += q.vel
        if (q.f >= 1) {
          particulas.splice(k, 1)
          continue
        }
        const pt = pontoCurva(curva(q.cat), q.volta ? 1 - q.f : q.f)
        bx.fillStyle = rgba(q.cor, 0.3)
        bx.beginPath()
        bx.arc(pt.x, pt.y, 6, 0, 7)
        bx.fill()
        bx.fillStyle = '#fff'
        bx.beginPath()
        bx.arc(pt.x, pt.y, 2, 0, 7)
        bx.fill()
      }
    }

    function passo() {
      tt += 0.016
      if (!reduzir) ang += 0.006
      // enquanto uma ferramenta roda, solta uma partícula nova de vez em quando; em repouso, o cérebro só respira
      if (tt > proxEmissao) {
        proxEmissao = tt + 0.45
        for (const [cat, n] of ativas) if (n > 0) emitir(cat, (SBC.CATS[cat] || SBC.CATS.agentes).cor, false)
        if (!ativas.size || ![...ativas.values()].some((v) => v > 0)) {
          const i = (Math.random() * g.pts.length) | 0
          brilho[i] = 1
        }
      }
      desenhar()
    }

    // frase: troca no mesmo lugar, com um fade curto
    function pensar(txt) {
      txt = String(txt || '').trim()
      if (!txt || txt === fraseAtual || !fraseEl) return
      fraseAtual = txt
      if (reduzir) {
        fraseEl.textContent = txt
        return
      }
      fraseEl.classList.add('troca')
      setTimeout(() => {
        fraseEl.textContent = txt
        fraseEl.classList.remove('troca')
      }, 160)
    }

    function iniciar() {
      if (animando) return
      animando = true
      tamanho()
      const laco = () => {
        if (!animando) return
        if (!document.hidden) passo()
        raf = requestAnimationFrame(laco)
      }
      raf = requestAnimationFrame(laco)
    }
    function parar() {
      animando = false
      cancelAnimationFrame(raf)
    }

    return { evento, pensar, iniciar, parar, tamanho, desenhar, passo, ativas: () => new Map(ativas), particulas: () => particulas.length, frase: () => fraseAtual }
  }

  return { ICONES, ROTULO, categoriaDe, fraseDaFerramenta, fraseDoRaciocinio, aberto, lembrar, criarCartao }
})
