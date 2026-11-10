// Cartão de atividade ao vivo (Spec 25 §15): um quadradinho com um cérebro de neurônios no centro e, em volta, os ícones do que o agente pode usar
// (arquivo, internet, navegador, terminal, skill, memória, imagem/vídeo, agente auxiliar). Cada ferramenta real que o Hermes chama liga uma sinapse do
// cérebro até o ícone certo, em tempo real; sem ferramenta, o cérebro só respira. Embaixo, UMA frase de pensamento que vai mudando no mesmo lugar.
// Não depende mais de renderer/cerebro.js (o motor tem o próprio cérebro); o cerebro.js só empresta a categoria das ferramentas.
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
    if (cat === 'skills') return alvo && !/^skills?_?(list|manage)?$/i.test(alvo) ? `Consultando a skill ${alvo}` : 'Consultando as suas skills…'
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

  // ---------- motor cinematográfico (protótipo aprovado pelo Lucas em 10/11/2026: specs/prototipos/sinapse-cinematica.html) ----------
  // Cérebro de ~520 neurônios em 3D (hemisférios, cerebelo, tronco) girando devagar; disparos correndo pelas ligações; cada ferramenta em uso
  // acende a região do cérebro virada para o ícone dela e um feixe de 3 fios cresce até o ícone, com pacotes de luz indo e voltando.
  // Ao terminar, anel e faíscas no ícone e um clarão no cérebro. Brilho por sprites pré-desenhados com 'lighter' (sem shadowBlur, que é caro).
  const TAU = Math.PI * 2
  const COR = { skills: '#ff9f5a', arquivos: '#7dde8a', web: '#6ea8ff', navegador: '#3fe0f5', terminal: '#ffd166', memoria: '#b58cff', midia: '#ff7ab8', agentes: '#e8eefc' }
  const NOME = { skills: 'Skills', arquivos: 'Arquivos', web: 'Internet', navegador: 'Navegador', terminal: 'Código', memoria: 'Memória', midia: 'Mídia', agentes: 'Agente' }
  const ORDEM = ['skills', 'arquivos', 'web', 'navegador', 'terminal', 'memoria', 'midia', 'agentes']
  const BASE = '#59c8ff'
  const NUCLEO = '#ff8a66'
  const lerp = (a, b, k) => a + (b - a) * k
  const rgb = (hex) => {
    const v = parseInt(hex.slice(1), 16)
    return [v >> 16, (v >> 8) & 255, v & 255]
  }
  const rgba = (hex, a) => {
    const [r, g, b] = rgb(hex)
    return `rgba(${r},${g},${b},${a})`
  }

  // o cérebro é o mesmo desenho sempre (semente fixa); calculado uma vez e reaproveitado por todos os cartões
  let MODELO = null
  function modelo() {
    if (MODELO) return MODELO
    let sem = 20261110
    const rnd = () => ((sem = (sem + 0x6d2b79f5) >>> 0), (((sem ^ (sem >>> 15)) * (1 | sem)) >>> 0) / 4294967296)
    const P = []
    const ponto = (x, y, z, peso = 1) => P.push({ x, y, z, f: rnd() * TAU, peso })
    for (let i = 0; i < 430; i++) {
      const lado = i % 2 ? 1 : -1
      const u = rnd() * TAU
      const v = Math.acos(2 * rnd() - 1)
      const dx = Math.sin(v) * Math.cos(u)
      const dy = Math.cos(v)
      const dz = Math.abs(Math.sin(v) * Math.sin(u))
      const dobra = 1 + 0.07 * Math.sin(u * 5 + v * 3) + 0.05 * Math.sin(v * 9)
      const r = (rnd() < 0.22 ? Math.cbrt(rnd()) * 0.85 : 1) * dobra
      let x = dx * r
      let y = dy * 0.72 * r
      let z = lado * (0.07 + dz * 0.6 * r)
      if (y < -0.28) y = -0.28 - -(y + 0.28) * 0.45
      if (x > 0.35 && y > 0.1) x *= 1.06
      if (y < -0.12 && x > -0.35 && x < 0.55) z *= 1.14
      ponto(x, y + 0.06, z)
    }
    for (let i = 0; i < 64; i++) {
      const u = rnd() * TAU
      const v = Math.acos(2 * rnd() - 1)
      const r = 0.3 * Math.cbrt(0.4 + rnd() * 0.6)
      ponto(-0.66 + Math.sin(v) * Math.cos(u) * r, -0.42 + Math.cos(v) * r * 0.72, Math.sin(v) * Math.sin(u) * r * 1.5, 0.8)
    }
    for (let i = 0; i < 26; i++) {
      const t = i / 25
      ponto(-0.36 + t * 0.08 + (rnd() - 0.5) * 0.09, -0.4 - t * 0.6, (rnd() - 0.5) * 0.11, 0.7)
    }
    const L = []
    const viz = P.map(() => [])
    const visto = new Set()
    for (let i = 0; i < P.length; i++) {
      const d = []
      for (let j = 0; j < P.length; j++) if (j !== i) d.push([Math.hypot(P[i].x - P[j].x, P[i].y - P[j].y, P[i].z - P[j].z), j])
      d.sort((a, b) => a[0] - b[0])
      for (const [dist, j] of d.slice(0, 3)) {
        const k = i < j ? i + ':' + j : j + ':' + i
        if (visto.has(k) || dist > 0.34) continue
        visto.add(k)
        viz[i].push(L.length)
        viz[j].push(L.length)
        L.push({ a: i, b: j })
      }
    }
    const poeira = Array.from({ length: 110 }, () => ({ x: rnd(), y: rnd(), z: 0.25 + rnd() * 0.75, f: rnd() * TAU, v: 0.004 + rnd() * 0.012 }))
    MODELO = { P, L, viz, poeira }
    return MODELO
  }

  const sprites = new Map()
  function sprite(cor) {
    let s = sprites.get(cor)
    if (s) return s
    s = document.createElement('canvas')
    s.width = s.height = 96
    const g = s.getContext('2d')
    const [r, gg, b] = rgb(cor)
    const gr = g.createRadialGradient(48, 48, 0, 48, 48, 48)
    gr.addColorStop(0, 'rgba(255,255,255,1)')
    gr.addColorStop(0.12, `rgba(${r},${gg},${b},.95)`)
    gr.addColorStop(0.38, `rgba(${r},${gg},${b},.28)`)
    gr.addColorStop(1, `rgba(${r},${gg},${b},0)`)
    g.fillStyle = gr
    g.fillRect(0, 0, 96, 96)
    sprites.set(cor, s)
    return s
  }

  function icone(cx, id, x, y, s, cor, a) {
    cx.save()
    cx.translate(x, y)
    cx.strokeStyle = cor
    cx.fillStyle = cor
    cx.globalAlpha = a
    cx.lineWidth = 1.6
    cx.lineCap = 'round'
    cx.lineJoin = 'round'
    const h = s / 2
    const rr = (x0, y0, w, hh) => (cx.roundRect ? cx.roundRect(x0, y0, w, hh, 3) : cx.rect(x0, y0, w, hh))
    cx.beginPath()
    if (id === 'arquivos') {
      cx.moveTo(-h * 0.7, -h); cx.lineTo(h * 0.2, -h); cx.lineTo(h * 0.7, -h * 0.5); cx.lineTo(h * 0.7, h); cx.lineTo(-h * 0.7, h); cx.closePath()
      cx.moveTo(-h * 0.35, 0); cx.lineTo(h * 0.35, 0); cx.moveTo(-h * 0.35, h * 0.45); cx.lineTo(h * 0.35, h * 0.45); cx.stroke()
    } else if (id === 'web') {
      cx.arc(0, 0, h * 0.95, 0, TAU); cx.moveTo(-h * 0.95, 0); cx.lineTo(h * 0.95, 0); cx.moveTo(h * 0.42, 0); cx.ellipse(0, 0, h * 0.42, h * 0.95, 0, 0, TAU); cx.stroke()
    } else if (id === 'navegador') {
      rr(-h, -h * 0.8, s, h * 1.6); cx.moveTo(-h, -h * 0.3); cx.lineTo(h, -h * 0.3); cx.stroke()
      cx.beginPath(); cx.arc(-h * 0.68, -h * 0.55, 1.3, 0, TAU); cx.arc(-h * 0.38, -h * 0.55, 1.3, 0, TAU); cx.fill()
    } else if (id === 'terminal') {
      rr(-h, -h * 0.8, s, h * 1.6); cx.moveTo(-h * 0.58, -h * 0.28); cx.lineTo(-h * 0.14, 0.02 * h); cx.lineTo(-h * 0.58, h * 0.32); cx.moveTo(h * 0.06, h * 0.36); cx.lineTo(h * 0.56, h * 0.36); cx.stroke()
    } else if (id === 'skills') {
      cx.moveTo(0, -h); cx.quadraticCurveTo(h * 0.16, -h * 0.16, h, 0); cx.quadraticCurveTo(h * 0.16, h * 0.16, 0, h); cx.quadraticCurveTo(-h * 0.16, h * 0.16, -h, 0); cx.quadraticCurveTo(-h * 0.16, -h * 0.16, 0, -h); cx.stroke()
    } else if (id === 'memoria') {
      cx.ellipse(0, -h * 0.55, h * 0.85, h * 0.32, 0, 0, TAU); cx.moveTo(-h * 0.85, -h * 0.55); cx.lineTo(-h * 0.85, h * 0.55)
      cx.ellipse(0, h * 0.55, h * 0.85, h * 0.32, 0, Math.PI, 0, true); cx.lineTo(h * 0.85, -h * 0.55); cx.moveTo(-h * 0.85, 0); cx.ellipse(0, 0, h * 0.85, h * 0.32, 0, Math.PI, 0, true); cx.stroke()
    } else if (id === 'midia') {
      rr(-h, -h * 0.8, s, h * 1.6); cx.moveTo(-h * 0.25, -h * 0.35); cx.lineTo(h * 0.45, 0); cx.lineTo(-h * 0.25, h * 0.35); cx.closePath(); cx.stroke()
    } else {
      cx.arc(0, -h * 0.55, h * 0.27, 0, TAU); cx.moveTo(-h * 0.5 + h * 0.27, h * 0.5); cx.arc(-h * 0.5, h * 0.5, h * 0.27, 0, TAU)
      cx.moveTo(h * 0.5 + h * 0.27, h * 0.5); cx.arc(h * 0.5, h * 0.5, h * 0.27, 0, TAU); cx.moveTo(-h * 0.1, -h * 0.3); cx.lineTo(-h * 0.4, h * 0.25); cx.moveTo(h * 0.1, -h * 0.3); cx.lineTo(h * 0.4, h * 0.25); cx.stroke()
    }
    cx.restore()
  }

  // O cartão: `canvas` e `fraseEl` já estão no DOM; `chipEl` (opcional) mostra a ferramenta em uso, na cor dela.
  // Devolve o controle: evento(cat, 'inicio'|'ok'|'erro'), pensar(txt), iniciar(), parar(), tamanho(), ativas(), particulas(), frase().
  function criarCartao(canvas, fraseEl, { reduzir = false, chipEl = null } = {}) {
    const semTela = typeof document === 'undefined' // testes em node: só o estado, sem desenhar
    const M = modelo()
    const P = M.P.map((p) => ({ ...p, calor: 0, cor: 0, sx: 0, sy: 0, sz: 0, k: 1 }))
    const ferr = ORDEM.map((id, i) => ({ id, i, cor: COR[id], rotulo: NOME[id], ativo: 0, liga: 0, ax: 0, ay: 0, ix: 0, iy: 0, ancora: 0, prox: 0, fios: null }))
    const porId = Object.fromEntries(ferr.map((f) => [f.id, f]))
    const pulsos = []
    const pacotes = []
    const estouros = []
    const cx = semTela ? null : canvas.getContext('2d')
    let W = 0, H = 0, dpr = 1, clarao = 0, ult = 0, acum = 0, raf = 0, animando = false, fraseAtual = '', relogio = 0
    const agora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000

    function tamanho() {
      if (semTela) return
      const r = canvas.getBoundingClientRect()
      dpr = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1)
      W = Math.max(240, r.width || 640)
      H = Math.max(160, r.height || 320)
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
    }
    const luz = (cor, x, y, r, a) => {
      if (a <= 0.003) return
      cx.globalAlpha = Math.min(1, a)
      cx.drawImage(sprite(cor), x - r, y - r, r * 2, r * 2)
    }
    const bez = (a, c, d, t) => {
      const u = 1 - t
      return { x: u * u * a.x + 2 * u * t * c.x + t * t * d.x, y: u * u * a.y + 2 * u * t * c.y + t * t * d.y }
    }

    function quadro(t) {
      const dt = Math.min(0.05, ult ? t - ult : 0.016)
      ult = t
      if (!W) tamanho()
      cx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const CX = W / 2, CY = H * 0.47
      const ativas = ferr.filter((f) => f.ativo)
      const energia = ativas.length ? 1 : 0.35

      cx.globalCompositeOperation = 'source-over'
      cx.globalAlpha = 1
      const fundo = cx.createRadialGradient(CX, CY, 10, CX, CY, Math.max(W, H) * 0.75)
      fundo.addColorStop(0, '#0f1a33'); fundo.addColorStop(0.5, '#080d1c'); fundo.addColorStop(1, '#04060d')
      cx.fillStyle = fundo
      cx.fillRect(0, 0, W, H)
      cx.globalCompositeOperation = 'lighter'
      luz('#5a3cff', CX + Math.cos(t * 0.11) * W * 0.26, CY + Math.sin(t * 0.13) * H * 0.2, W * 0.42, 0.1)
      luz('#00b7ff', CX + Math.cos(t * 0.09 + 2) * W * 0.3, CY + Math.sin(t * 0.07 + 1) * H * 0.26, W * 0.38, 0.08)
      for (const f of ativas) luz(f.cor, f.ix, f.iy, W * 0.2, 0.06 * f.liga)
      for (const d of M.poeira) {
        const x = ((d.x + t * d.v * d.z) % 1) * W + Math.sin(t * 0.3 + d.f) * 6 * d.z
        const y = d.y * H + Math.cos(t * 0.25 + d.f) * 5 * d.z
        luz('#9fc8ff', x, y, 1.2 + d.z * 2.2, (0.1 + 0.25 * (0.5 + 0.5 * Math.sin(t * 1.7 + d.f))) * d.z)
      }

      const yaw = reduzir ? 0.6 : t * 0.17 + Math.sin(t * 0.37) * 0.18
      const inc = -0.2 + (reduzir ? 0 : Math.sin(t * 0.29) * 0.06)
      const cy_ = Math.cos(yaw), sy_ = Math.sin(yaw), ci = Math.cos(inc), si = Math.sin(inc)
      const S = Math.min(W * 0.6, H) * 0.4 * (1 + (reduzir ? 0 : 0.018 * Math.sin(t * 1.25)))
      for (const p of P) {
        const x = p.x * cy_ - p.z * sy_
        const z0 = p.x * sy_ + p.z * cy_
        const y = p.y * ci - z0 * si
        const z = p.y * si + z0 * ci
        const k = 2.7 / (2.7 - z)
        p.sx = CX + x * S * k; p.sy = CY - y * S * k; p.sz = z; p.k = k
      }

      const rx = Math.min(W * 0.43, 320), ry = H * 0.375
      for (const f of ferr) {
        const a = -Math.PI / 2 + (f.i / ferr.length) * TAU + 0.39 + Math.sin(t * 0.21 + f.i) * 0.035
        f.ix = CX + Math.cos(a) * rx
        f.iy = CY + Math.sin(a) * ry + Math.sin(t * 0.9 + f.i * 1.7) * 3
        f.liga = lerp(f.liga, f.ativo ? 1 : 0, 1 - Math.pow(0.0015, dt))
        if (f.liga > 0.01) {
          const dx = f.ix - CX, dy = f.iy - CY, n = Math.hypot(dx, dy) || 1
          let melhor = -1e9, mi = 0
          for (let i = 0; i < 430; i++) {
            const p = P[i]
            const v = ((p.sx - CX) * dx + (p.sy - CY) * dy) / n + p.sz * 14
            if (v > melhor) { melhor = v; mi = i }
          }
          f.ancora = mi
          f.ax = f.ax ? lerp(f.ax, P[mi].sx, 0.12) : P[mi].sx
          f.ay = f.ay ? lerp(f.ay, P[mi].sy, 0.12) : P[mi].sy
        } else { f.ax = 0; f.ay = 0 }
      }
      for (const p of P) {
        let alvo = 0, cor = p.cor
        for (const f of ferr) {
          if (f.liga < 0.02) continue
          const a = P[f.ancora]
          const q = Math.max(0, 1 - Math.hypot(p.x - a.x, p.y - a.y, p.z - a.z) / 0.62) * f.liga
          if (q > alvo) { alvo = q; cor = f.i }
        }
        p.cor = cor
        p.calor = lerp(p.calor, alvo, 1 - Math.pow(0.004, dt))
      }

      cx.lineCap = 'round'
      for (const l of M.L) {
        const a = P[l.a], b = P[l.b]
        const prof = ((a.sz + b.sz) / 2 + 1.1) / 2.2
        const calor = Math.min(a.calor, b.calor)
        cx.globalAlpha = 1
        if (calor > 0.06) { cx.strokeStyle = rgba(ferr[a.cor].cor, 0.18 + calor * 0.55); cx.lineWidth = 0.7 + calor * 1.1 }
        else { cx.strokeStyle = rgba(BASE, (0.05 + prof * 0.2) * (0.75 + energia * 0.4) + clarao * 0.2); cx.lineWidth = 0.6 }
        cx.beginPath(); cx.moveTo(a.sx, a.sy); cx.lineTo(b.sx, b.sy); cx.stroke()
      }
      luz(NUCLEO, CX, CY, S * (0.5 + 0.05 * Math.sin(t * 2.2)), 0.16 + energia * 0.1 + clarao * 0.25)
      for (const p of P) {
        const prof = (p.sz + 1.1) / 2.2
        const pisca = 0.5 + 0.5 * Math.sin(t * (1.4 + p.peso) + p.f)
        const r = (2.2 + prof * 4.2 + pisca * 1.6) * p.k * p.peso
        luz(BASE, p.sx, p.sy, r, (0.16 + prof * 0.5) * (0.55 + pisca * 0.45) + clarao * 0.5)
        if (p.calor > 0.03) luz(ferr[p.cor].cor, p.sx, p.sy, r * (1.5 + p.calor * 1.4), p.calor * (0.55 + prof * 0.45))
      }

      if (!reduzir) {
        acum += dt * (ativas.length ? 46 : 18)
        while (acum > 1) {
          acum--
          pulsos.push({ e: (Math.random() * M.L.length) | 0, f: 0, inv: Math.random() < 0.5, saltos: 0, v: 2.2 + Math.random() * 2 })
        }
      }
      for (let i = pulsos.length - 1; i >= 0; i--) {
        const q = pulsos[i]
        q.f += dt * q.v
        const l = M.L[q.e]
        const a = P[q.inv ? l.b : l.a], b = P[q.inv ? l.a : l.b]
        if (q.f >= 1) {
          const destino = q.inv ? l.a : l.b
          if (q.saltos < 4 && Math.random() < 0.72) {
            const op = M.viz[destino]
            const ne = op[(Math.random() * op.length) | 0]
            q.e = ne; q.inv = M.L[ne].b === destino; q.f = 0; q.saltos++
          } else pulsos.splice(i, 1)
          continue
        }
        const prof = (lerp(a.sz, b.sz, q.f) + 1.1) / 2.2
        luz(Math.max(a.calor, b.calor) > 0.1 ? ferr[a.cor].cor : '#ffffff', lerp(a.sx, b.sx, q.f), lerp(a.sy, b.sy, q.f), 3 + prof * 4, 0.35 + prof * 0.5)
      }
      if (pulsos.length > 400) pulsos.splice(0, pulsos.length - 400)

      for (const f of ferr) {
        if (f.liga < 0.02 || !f.ax) continue
        const A = { x: f.ax, y: f.ay }
        const dx = f.ix - A.x, dy = f.iy - A.y, n = Math.hypot(dx, dy) || 1
        const D = { x: f.ix - (dx / n) * 26, y: f.iy - (dy / n) * 26 }
        const px = -dy / n, py = dx / n
        f.fios = []
        for (let k = -1; k <= 1; k++) {
          const o = k * 16 + Math.sin(t * 2.1 + k * 2 + f.i) * 9
          const C = { x: (A.x + D.x) / 2 + px * o, y: (A.y + D.y) / 2 + py * o }
          f.fios.push(C)
          const ate = Math.min(1, f.liga * 1.15)
          cx.beginPath()
          for (let s = 0; s <= 26; s++) {
            const q = bez(A, C, D, (s / 26) * ate)
            s ? cx.lineTo(q.x, q.y) : cx.moveTo(q.x, q.y)
          }
          cx.globalAlpha = 1
          cx.strokeStyle = rgba(f.cor, 0.07 * f.liga); cx.lineWidth = 9; cx.stroke()
          cx.strokeStyle = rgba(f.cor, 0.16 * f.liga); cx.lineWidth = 3.4; cx.stroke()
          cx.strokeStyle = rgba(k === 0 ? '#ffffff' : f.cor, (k === 0 ? 0.6 : 0.5) * f.liga); cx.lineWidth = k === 0 ? 1.1 : 0.8; cx.stroke()
        }
        f.A = A
        f.D = D
        if (f.ativo && t > f.prox) {
          f.prox = t + 0.11 + Math.random() * 0.1
          pacotes.push({ f, fio: (Math.random() * 3) | 0, p: 0, volta: Math.random() < 0.38, v: 0.85 + Math.random() * 0.5 })
        }
        luz(f.cor, A.x, A.y, 16 + 4 * Math.sin(t * 6), 0.55 * f.liga)
      }
      for (let i = pacotes.length - 1; i >= 0; i--) {
        const q = pacotes[i], f = q.f
        q.p += dt * q.v
        if (q.p >= 1 || !f.fios || f.liga < 0.05) { pacotes.splice(i, 1); continue }
        const C = f.fios[q.fio]
        for (let c = 0; c < 9; c++) {
          const tt = q.p - c * 0.022
          if (tt < 0) break
          const pos = bez(f.A, C, f.D, q.volta ? 1 - tt : tt)
          luz(c === 0 || q.volta ? '#ffffff' : f.cor, pos.x, pos.y, (c === 0 ? 7 : 5.5) - c * 0.45, (1 - c / 9) * (c === 0 ? 0.95 : 0.5) * f.liga)
        }
      }

      cx.globalCompositeOperation = 'source-over'
      for (const f of ferr) {
        const on = f.liga, R = 19 + on * 5
        cx.globalAlpha = 1
        cx.beginPath(); cx.arc(f.ix, f.iy, R, 0, TAU)
        cx.fillStyle = on > 0.05 ? rgba(f.cor, 0.1 + on * 0.1) : 'rgba(140,170,220,0.045)'
        cx.fill()
        cx.strokeStyle = on > 0.05 ? rgba(f.cor, 0.35 + on * 0.55) : 'rgba(140,170,220,0.16)'
        cx.lineWidth = 1 + on * 0.6
        cx.stroke()
        if (on > 0.05) {
          cx.globalCompositeOperation = 'lighter'
          luz(f.cor, f.ix, f.iy, R * 2.6, 0.32 * on)
          for (let k = 0; k < 2; k++) {
            const ph = (t * 0.9 + k * 0.5) % 1
            cx.globalAlpha = (1 - ph) * 0.5 * on
            cx.strokeStyle = f.cor
            cx.lineWidth = 1.2
            cx.beginPath(); cx.arc(f.ix, f.iy, R + ph * 26, 0, TAU); cx.stroke()
          }
          cx.globalCompositeOperation = 'source-over'
        }
        icone(cx, f.id, f.ix, f.iy, 15 + on * 3, on > 0.05 ? '#ffffff' : '#93a6c8', 0.5 + on * 0.5)
        if (on > 0.3) {
          cx.globalAlpha = Math.min(1, (on - 0.3) * 2)
          cx.fillStyle = f.cor
          cx.font = '600 11px "Segoe UI",system-ui,sans-serif'
          cx.textAlign = 'center'
          cx.fillText(f.rotulo, f.ix, f.iy + R + 15)
        }
      }

      cx.globalCompositeOperation = 'lighter'
      for (let i = estouros.length - 1; i >= 0; i--) {
        const e = estouros[i]
        const a = (t - e.t) / 0.85
        if (a >= 1) { estouros.splice(i, 1); continue }
        const ease = 1 - Math.pow(1 - a, 3)
        cx.globalAlpha = (1 - a) * 0.9
        cx.strokeStyle = e.cor
        cx.lineWidth = 2.2 * (1 - a) + 0.4
        cx.beginPath(); cx.arc(e.f.ix, e.f.iy, 22 + ease * 58, 0, TAU); cx.stroke()
        luz(e.cor, e.f.ix, e.f.iy, 34 + ease * 60, (1 - a) * 0.5)
        for (const s of e.fa) luz(e.cor, e.f.ix + Math.cos(s.a) * ease * s.d, e.f.iy + Math.sin(s.a) * ease * s.d, 4 * (1 - a) + 1, (1 - a) * 0.9)
      }
      clarao = Math.max(0, clarao - dt * 1.6)

      cx.globalCompositeOperation = 'source-over'
      cx.globalAlpha = 1
      const vin = cx.createRadialGradient(CX, CY, Math.min(W, H) * 0.35, CX, CY, Math.max(W, H) * 0.72)
      vin.addColorStop(0, 'rgba(0,0,0,0)')
      vin.addColorStop(1, 'rgba(0,0,0,0.62)')
      cx.fillStyle = vin
      cx.fillRect(0, 0, W, H)
    }

    function chip() {
      if (!chipEl) return
      const a = ferr.filter((f) => f.ativo).pop()
      chipEl.style.setProperty('--c', a ? a.cor : '#9fd0ff')
      const b = chipEl.querySelector('b')
      if (b) b.textContent = a ? a.rotulo : 'Pensando'
    }

    function evento(cat, estado) {
      const f = porId[cat] || porId.agentes
      if (estado === 'inicio') f.ativo++
      else {
        f.ativo = Math.max(0, f.ativo - 1)
        estouros.push({ f, cor: estado === 'erro' ? '#ff6b6b' : '#7ee787', t: agora(), fa: Array.from({ length: 12 }, () => ({ a: Math.random() * TAU, d: 40 + Math.random() * 55 })) })
        if (estouros.length > 12) estouros.shift()
        clarao = estado === 'erro' ? 0.25 : 0.7
      }
      chip()
    }

    function pensar(txt) {
      txt = String(txt || '').trim()
      if (!txt || txt === fraseAtual || !fraseEl) return
      fraseAtual = txt
      if (reduzir || semTela) {
        fraseEl.textContent = txt
        return
      }
      fraseEl.classList.add('sai')
      clearTimeout(relogio)
      relogio = setTimeout(() => {
        fraseEl.textContent = fraseAtual
        fraseEl.classList.remove('sai')
      }, 200)
    }

    function passo() {
      if (semTela) return
      quadro(agora())
    }
    function iniciar() {
      if (animando || semTela) return
      animando = true
      tamanho()
      const laco = () => {
        if (!animando) return
        // só desenha com a janela visível e o cartão na tela (vários chats trabalhando não pesam: só o da tela anima)
        if (!document.hidden && canvas.isConnected && canvas.offsetParent !== null) quadro(agora())
        raf = requestAnimationFrame(laco)
      }
      raf = requestAnimationFrame(laco)
    }
    function parar() {
      animando = false
      if (!semTela) cancelAnimationFrame(raf)
    }

    return {
      evento, pensar, iniciar, parar, tamanho, passo,
      ativas: () => new Map(ferr.filter((f) => f.ativo).map((f) => [f.id, f.ativo]).concat(ferr.filter((f) => !f.ativo && f.liga >= 0).map((f) => [f.id, f.ativo]))),
      particulas: () => pacotes.length + estouros.length + (ferr.some((f) => f.ativo) ? 1 : 0),
      frase: () => fraseAtual,
    }
  }

  return { ICONES, ROTULO, COR, categoriaDe, fraseDaFerramenta, fraseDoRaciocinio, aberto, lembrar, criarCartao }
})
