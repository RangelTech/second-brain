// Cartão de atividade ao vivo (Spec 25 §15): um quadradinho com um cérebro de neurônios no centro e, em volta, os ícones do que o agente pode usar
// (arquivo, internet, navegador, terminal, skill, memória, imagem/vídeo, agente auxiliar). Cada ferramenta real que o Hermes chama liga uma sinapse do
// cérebro até o ícone certo, em tempo real; sem ferramenta, o cérebro só respira. Embaixo, UMA frase de pensamento que vai mudando no mesmo lugar.
// Não depende mais de renderer/cerebro.js (o motor tem o próprio cérebro); o cerebro.js só empresta a categoria das ferramentas.
// A parte pura (categoria, frase, preferência) é testada em node; o desenho usa canvas 2D e depende do grafo de renderer/cerebro.js.
;(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./cerebro.js'))
  else raiz.SBAtividade = fabrica(raiz.SBCerebro)
})(typeof self !== 'undefined' ? self : this, function (SBC) {
  // ícones em volta do cérebro. `pensar` e `escrever` não são ferramentas: são o estado de base (o cérebro nunca fica sem nada aceso)
  const ICONES = ['pensar', 'escrever', 'skills', 'arquivos', 'documentos', 'planilhas', 'web', 'navegador', 'redes', 'terminal', 'codigo', 'memoria', 'imagem', 'video', 'voz', 'pesquisa', 'tarefas', 'agentes']
  const ROTULO = { pensar: 'Raciocínio', escrever: 'Escrevendo', skills: 'Skills', arquivos: 'Arquivos', documentos: 'Documentos', planilhas: 'Planilhas', web: 'Internet', navegador: 'Navegador',
    redes: 'Redes sociais', terminal: 'Terminal', codigo: 'Código', memoria: 'Memória', imagem: 'Imagem', video: 'Vídeo', voz: 'Voz', pesquisa: 'Pesquisa', tarefas: 'Tarefas', agentes: 'Agente auxiliar' }

  // categoria da ferramenta pelo nome (e pelo arquivo/endereço que ela toca): só a categoria aparece, nada do conteúdo do usuário
  function categoriaDe(f) {
    const t = String((f && f.titulo) || '')
    const k = String((f && f.tipo) || '').toLowerCase()
    const tl = t.toLowerCase()
    if (/skill_view|skills_list|skill_manage|\bskills?\b/.test(tl)) return 'skills'
    if (/memoria_|memory|lembr|recall/.test(tl)) return 'memoria'
    if (/delegate|subagent|spawn|agente_/.test(tl)) return 'agentes'
    if (/todo|kanban|cron|tarefa|agenda/.test(tl)) return 'tarefas'
    if (/clonar_voz|trocar_voz|redublar|transcri|whisper|audio|áudio|\.(mp3|wav|ogg|m4a)\b/.test(tl)) return 'voz'
    if (/gerar_video|video|vídeo|\.(mp4|mov|webm)\b|trocar_personagem/.test(tl)) return 'video'
    if (/gerar_imagem|vision|imagem|image|\.(png|jpe?g|gif|webp|svg)\b|midia_detalhar|midia_conferir/.test(tl)) return 'imagem'
    if (/navegador_|browser/.test(tl)) return /instagram|whatsapp|facebook|tiktok|twitter|x\.com|linkedin|youtube|messenger/.test(tl) ? 'redes' : 'navegador'
    if (/instagram|whatsapp|facebook|tiktok|linkedin|youtube/.test(tl)) return 'redes'
    if (/web_search|search_web|web_extract|fetch|http/.test(tl) || k === 'fetch') return 'web'
    if (/session_search|search_files|grep|procur|busca/.test(tl) || k === 'search') return 'pesquisa'
    if (/execute_code|python|\.(py|js|ts|html|css|json)\b/.test(tl)) return 'codigo'
    if (/terminal|shell|powershell|bash|comando|execute/.test(tl) || k === 'execute') return 'terminal'
    if (/\.(xlsx?|csv|ods)\b|planilha/.test(tl)) return 'planilhas'
    if (/\.(pdf|docx?|pptx?|odt|txt|md|rtf)\b|documento/.test(tl)) return 'documentos'
    if (/read_file|write_file|patch|arquivo|file|pasta/.test(tl) || ['read', 'edit', 'delete', 'move'].includes(k)) return 'arquivos'
    if (k === 'think') return 'pensar'
    return 'agentes'
  }

  // frase curta e sem jargão para o que está acontecendo; `rotulo`/`limpo` vêm do app (rotuloFerr/tituloLimpo)
  // nome interno do MCP (mcp__editor_navegador_7860dfd8__navegador_abrir) nunca aparece para o cliente
  const semMcp = (t) => String(t || '').replace(/mcp__[A-Za-z0-9_]+?__/g, '').replace(/^editor_[a-z]+_[0-9a-f]{8}_?/i, '')
  function fraseDaFerramenta(f, rotulo, limpo) {
    f = { ...f, titulo: semMcp(f && f.titulo) }
    const cat = categoriaDe(f)
    const alvo = limpo ? String(limpo(f.titulo) || '').slice(0, 48) : ''
    const base = rotulo ? rotulo(f) : ROTULO[cat]
    if (cat === 'skills') return alvo && !/^skills?_?(list|manage)?$/i.test(alvo) ? `Consultando a skill ${alvo}` : 'Consultando as suas skills…'
    if (cat === 'memoria') return 'Lembrando do que já conversamos'
    if (cat === 'imagem' || cat === 'video' || cat === 'voz') return base
    if (cat === 'terminal') return 'Rodando um comando…'
    if (cat === 'codigo') return 'Rodando um código…'
    if (cat === 'redes') return alvo ? `Abrindo a rede social: ${alvo}` : 'Abrindo a rede social…'
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
  const COR = { pensar: '#c4a7ff', escrever: '#f2f6ff', skills: '#ff9f5a', arquivos: '#7dde8a', documentos: '#ffb4a2', planilhas: '#4fd69c', web: '#6ea8ff', navegador: '#3fe0f5',
    redes: '#ff5fa2', terminal: '#ffe08a', codigo: '#f9a03f', memoria: '#b58cff', imagem: '#ff7ab8', video: '#ff4d6d', voz: '#7ae7ff', pesquisa: '#9bd1ff', tarefas: '#a8e6a1', agentes: '#e8eefc' }
  const NOME = { ...ROTULO, codigo: 'Código', midia: 'Mídia' }
  // 11 orbes vagando (o Lucas pediu menos); as categorias finas de categoriaDe caem na orbe mais próxima
  const ORDEM = ['pensar', 'escrever', 'skills', 'arquivos', 'web', 'navegador', 'redes', 'codigo', 'midia', 'memoria', 'agentes']
  const ORBE_DE = { terminal: 'codigo', documentos: 'arquivos', planilhas: 'arquivos', pesquisa: 'arquivos', imagem: 'midia', video: 'midia', voz: 'midia', tarefas: 'pensar' }
  COR.midia = '#ff7ab8'
  const BASE = '#59c8ff' // ativo (pergunta rodando): azul
  const NUCLEO = '#ff8a66'
  const BASE_P = '#ffc861' // parado (sem pergunta): ambar, girando devagar
  const NUCLEO_P = '#ffb347'
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
  const NC = 860 // neurônios do córtex: a mesma densidade do protótipo aprovado
  let MODELO = null
  function modelo() {
    if (MODELO) return MODELO
    let sem = 20261110
    const rnd = () => ((sem = (sem + 0x6d2b79f5) >>> 0), (((sem ^ (sem >>> 15)) * (1 | sem)) >>> 0) / 4294967296)
    const P = []
    const ponto = (x, y, z, peso = 1) => P.push({ x, y, z, f: rnd() * TAU, peso })
    for (let i = 0; i < NC; i++) {
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
    for (let i = 0; i < 128; i++) {
      const u = rnd() * TAU
      const v = Math.acos(2 * rnd() - 1)
      const r = 0.3 * Math.cbrt(0.4 + rnd() * 0.6)
      ponto(-0.66 + Math.sin(v) * Math.cos(u) * r, -0.42 + Math.cos(v) * r * 0.72, Math.sin(v) * Math.sin(u) * r * 1.5, 0.8)
    }
    for (let i = 0; i < 52; i++) {
      const t = i / 51
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
    } else if (id === 'pensar') {
      cx.arc(0, -h * 0.2, h * 0.62, Math.PI * 0.8, Math.PI * 2.2); cx.lineTo(h * 0.28, h * 0.55); cx.lineTo(-h * 0.28, h * 0.55); cx.closePath()
      cx.moveTo(-h * 0.24, h * 0.8); cx.lineTo(h * 0.24, h * 0.8); cx.moveTo(-h * 0.12, h); cx.lineTo(h * 0.12, h); cx.stroke()
    } else if (id === 'escrever') {
      cx.moveTo(-h * 0.8, h * 0.8); cx.lineTo(-h * 0.6, h * 0.25); cx.lineTo(h * 0.45, -h * 0.8); cx.lineTo(h * 0.8, -h * 0.45); cx.lineTo(-h * 0.25, h * 0.6); cx.closePath()
      cx.moveTo(h * 0.25, -h * 0.6); cx.lineTo(h * 0.6, -h * 0.25); cx.stroke()
    } else if (id === 'documentos') {
      cx.moveTo(-h * 0.7, -h); cx.lineTo(h * 0.2, -h); cx.lineTo(h * 0.7, -h * 0.5); cx.lineTo(h * 0.7, h); cx.lineTo(-h * 0.7, h); cx.closePath()
      for (const yy of [-0.3, 0.05, 0.4, 0.72]) { cx.moveTo(-h * 0.4, h * yy); cx.lineTo(h * (yy > 0.6 ? 0.1 : 0.4), h * yy) }
      cx.stroke()
    } else if (id === 'planilhas') {
      rr(-h, -h * 0.8, s, h * 1.6)
      cx.moveTo(-h, -h * 0.27); cx.lineTo(h, -h * 0.27); cx.moveTo(-h, h * 0.27); cx.lineTo(h, h * 0.27); cx.moveTo(-h * 0.33, -h * 0.8); cx.lineTo(-h * 0.33, h * 0.8); cx.moveTo(h * 0.33, -h * 0.8); cx.lineTo(h * 0.33, h * 0.8); cx.stroke()
    } else if (id === 'redes') {
      cx.moveTo(-h * 0.9, -h * 0.5); cx.quadraticCurveTo(-h * 0.9, -h * 0.9, -h * 0.5, -h * 0.9); cx.lineTo(h * 0.5, -h * 0.9); cx.quadraticCurveTo(h * 0.9, -h * 0.9, h * 0.9, -h * 0.5)
      cx.lineTo(h * 0.9, h * 0.25); cx.quadraticCurveTo(h * 0.9, h * 0.6, h * 0.5, h * 0.6); cx.lineTo(-h * 0.2, h * 0.6); cx.lineTo(-h * 0.6, h * 0.95); cx.lineTo(-h * 0.55, h * 0.6)
      cx.quadraticCurveTo(-h * 0.9, h * 0.6, -h * 0.9, h * 0.25); cx.closePath(); cx.stroke()
      cx.beginPath(); cx.moveTo(0, h * 0.32); cx.bezierCurveTo(-h * 0.55, -h * 0.05, -h * 0.3, -h * 0.65, 0, -h * 0.32); cx.bezierCurveTo(h * 0.3, -h * 0.65, h * 0.55, -h * 0.05, 0, h * 0.32); cx.fill()
    } else if (id === 'codigo') {
      cx.moveTo(-h * 0.35, -h * 0.8); cx.quadraticCurveTo(-h * 0.75, -h * 0.8, -h * 0.65, -h * 0.3); cx.quadraticCurveTo(-h * 0.6, 0, -h * 0.95, 0); cx.quadraticCurveTo(-h * 0.6, 0, -h * 0.65, h * 0.3); cx.quadraticCurveTo(-h * 0.75, h * 0.8, -h * 0.35, h * 0.8)
      cx.moveTo(h * 0.35, -h * 0.8); cx.quadraticCurveTo(h * 0.75, -h * 0.8, h * 0.65, -h * 0.3); cx.quadraticCurveTo(h * 0.6, 0, h * 0.95, 0); cx.quadraticCurveTo(h * 0.6, 0, h * 0.65, h * 0.3); cx.quadraticCurveTo(h * 0.75, h * 0.8, h * 0.35, h * 0.8)
      cx.moveTo(h * 0.15, -h * 0.45); cx.lineTo(-h * 0.15, h * 0.45); cx.stroke()
    } else if (id === 'imagem') {
      rr(-h, -h * 0.8, s, h * 1.6); cx.moveTo(-h, h * 0.55); cx.lineTo(-h * 0.35, -h * 0.05); cx.lineTo(h * 0.1, h * 0.4); cx.lineTo(h * 0.45, h * 0.05); cx.lineTo(h, h * 0.6); cx.stroke()
      cx.beginPath(); cx.arc(h * 0.45, -h * 0.4, h * 0.14, 0, TAU); cx.fill()
    } else if (id === 'video') {
      rr(-h, -h * 0.8, s, h * 1.6); cx.moveTo(-h * 0.25, -h * 0.35); cx.lineTo(h * 0.45, 0); cx.lineTo(-h * 0.25, h * 0.35); cx.closePath(); cx.stroke()
    } else if (id === 'voz') {
      const barras = [0.25, 0.6, 1, 0.7, 0.4, 0.85, 0.3]
      barras.forEach((v, i) => { const x0 = -h * 0.9 + i * h * 0.3; cx.moveTo(x0, -h * v * 0.85); cx.lineTo(x0, h * v * 0.85) })
      cx.stroke()
    } else if (id === 'pesquisa') {
      cx.arc(-h * 0.15, -h * 0.15, h * 0.58, 0, TAU); cx.moveTo(h * 0.28, h * 0.28); cx.lineTo(h * 0.88, h * 0.88); cx.stroke()
    } else if (id === 'tarefas') {
      for (const yy of [-0.62, 0, 0.62]) { cx.moveTo(-h * 0.9, h * yy); cx.lineTo(-h * 0.7, h * (yy + 0.2)); cx.lineTo(-h * 0.4, h * (yy - 0.22)); cx.moveTo(-h * 0.1, h * yy); cx.lineTo(h * 0.9, h * yy) }
      cx.stroke()
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
    let alvoAtivo = 0, kAtivo = 0, yaw = 0.6, base = 'pensar'
    const mix = (a, b, k) => { const x = rgb(a), y = rgb(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('') }
    const agora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000

    function tamanho() {
      if (semTela) return
      const r = canvas.getBoundingClientRect()
      dpr = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1)
      W = Math.max(240, r.width || 640)
      H = Math.max(160, r.height || 320)
      if (W * H > 500000) dpr = Math.min(dpr, 1) // fundo de tela inteira: 1:1 já é nítido e a composição fica bem mais leve
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
      // geometria: o canvas é o FUNDO da tela do chat inteira; o cérebro fica grande no meio da área da conversa
      // (desconta o topo e a caixa de mensagem com a frase) e as orbes vagam em volta, sem sair da tela
      const R0 = 32
      const topo = Math.min(70, H * 0.1), baixo = H - Math.min(180, H * 0.24)
      const CX = W / 2, CY = (topo + baixo) / 2
      const ativas = ferr.filter((f) => f.aceso)
      const energia = (ativas.length ? 1 : 0.35) * (0.35 + 0.65 * kAtivo)

      // SEM FUNDO: o desenho acontece direto sobre a tela do chat (canvas transparente, sem quadro, sem borda)
      kAtivo = lerp(kAtivo, alvoAtivo, 1 - Math.pow(0.08, dt))
      const corBase = mix(BASE_P, BASE, kAtivo)
      const corNucleo = mix(NUCLEO_P, NUCLEO, kAtivo)
      cx.setTransform(1, 0, 0, 1, 0, 0)
      cx.clearRect(0, 0, canvas.width, canvas.height)
      cx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cx.globalCompositeOperation = 'lighter'
      for (const f of ativas) luz(f.cor, f.ix, f.iy, Math.min(W, H) * 0.28, 0.05 * f.liga)
      for (const d of M.poeira) {
        if (kAtivo < 0.15 && d.f > 3) continue // parado: menos poeira
        const x = ((d.x + t * d.v * d.z) % 1) * W + Math.sin(t * 0.3 + d.f) * 6 * d.z
        const y = d.y * H + Math.cos(t * 0.25 + d.f) * 5 * d.z
        const borda = Math.min(x, W - x, y, H - y) / 40
        if (borda <= 0) continue
        luz(mix('#ffe2a8', '#9fc8ff', kAtivo), x, y, 1.2 + d.z * 2.2, (0.1 + 0.25 * (0.5 + 0.5 * Math.sin(t * 1.7 + d.f))) * d.z * (0.5 + 0.5 * kAtivo) * Math.min(1, borda))
      }

      if (!reduzir) yaw += dt * (0.05 + 0.12 * kAtivo)
      const inc = -0.2 + (reduzir ? 0 : Math.sin(t * 0.29) * 0.06)
      const cy_ = Math.cos(yaw), sy_ = Math.sin(yaw), ci = Math.cos(inc), si = Math.sin(inc)
      const S = Math.min(W * 0.62, baixo - topo) * 0.55 * (1 + (reduzir ? 0 : (0.008 + 0.012 * kAtivo) * Math.sin(t * 1.25)))
      const E = Math.max(1, Math.sqrt(S / 170))
      for (const p of P) {
        const x = p.x * cy_ - p.z * sy_
        const z0 = p.x * sy_ + p.z * cy_
        const y = p.y * ci - z0 * si
        const z = p.y * si + z0 * ci
        const k = 2.7 / (2.7 - z)
        p.sx = CX + x * S * k; p.sy = CY - y * S * k; p.sz = z; p.k = k
      }

      const algumaFerr = ferr.some((f) => f.ativo > 0)
      // ORBES VAGANDO: cada uma tem a sua região em volta do cérebro e passeia devagar (ângulo, distância e um desvio lento), sem ficar
      // num círculo parado; a sinapse alcança a orbe onde ela estiver e a acompanha enquanto ela anda.
      const rxO = Math.min(W / 2 - R0 - 24, S * 2.15), ryO = Math.min((baixo - topo) / 2 + 30, S * 1.3)
      for (const f of ferr) {
        if (!f.mov) f.mov = { a: (f.i / ferr.length) * TAU + 0.28, ph: f.i * 1.913, w1: 0.045 + ((f.i * 7) % 5) * 0.006, w2: 0.06 + ((f.i * 3) % 5) * 0.008 }
        const m = f.mov
        const vel = reduzir ? 0 : 1
        const ang = m.a + 0.22 * Math.sin(t * m.w1 * vel + m.ph)
        const rad = 0.8 + 0.16 * Math.sin(t * m.w2 * vel + m.ph * 0.7)
        let x = CX + Math.cos(ang) * rxO * rad + 24 * Math.sin(t * 0.13 * vel + m.ph * 2)
        let y = CY + Math.sin(ang) * ryO * rad + 16 * Math.cos(t * 0.11 * vel + m.ph)
        f.ix = Math.max(R0 + 18, Math.min(W - R0 - 18, x))
        f.iy = Math.max(R0 + 18, Math.min(H - R0 - 18, y))
        const aceso = f.ativo > 0 || (alvoAtivo > 0 && !algumaFerr && f.id === base)
        f.aceso = aceso
        f.liga = lerp(f.liga, aceso ? 1 : 0, 1 - Math.pow(0.0015, dt))
        if (f.liga > 0.01) {
          const dx = f.ix - CX, dy = f.iy - CY, n = Math.hypot(dx, dy) || 1
          let melhor = -1e9, mi = 0
          for (let i = 0; i < NC; i++) {
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
          const dx = p.x - a.x, dy = p.y - a.y, dz = p.z - a.z
          if (dx > 0.62 || dx < -0.62 || dy > 0.62 || dy < -0.62 || dz > 0.62 || dz < -0.62) continue
          const q = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy + dz * dz) / 0.62) * f.liga
          if (q > alvo) { alvo = q; cor = f.i }
        }
        p.cor = cor
        p.calor = lerp(p.calor, alvo, 1 - Math.pow(0.004, dt))
      }

      // ligações em LOTES: traçar cada uma separada (1.500 strokes por quadro) derrubava para ~24 quadros por segundo; agrupadas por faixa de
      // profundidade (frias) e por orbe (quentes), são uns 20 strokes por quadro, com o mesmo desenho
      cx.lineCap = 'round'
      const FAIXAS = 6
      const frias = Array.from({ length: FAIXAS }, () => [])
      const quentes = new Map() // orbe -> [ligacoes]
      for (const l of M.L) {
        const a = P[l.a], b = P[l.b]
        const calor = Math.min(a.calor, b.calor)
        if (calor > 0.06) {
          const k = a.cor * 10 + Math.min(9, (calor * 10) | 0)
          if (!quentes.has(k)) quentes.set(k, [])
          quentes.get(k).push(l)
        } else {
          const prof = ((a.sz + b.sz) / 2 + 1.1) / 2.2
          frias[Math.max(0, Math.min(FAIXAS - 1, (prof * FAIXAS) | 0))].push(l)
        }
      }
      cx.globalAlpha = 1
      for (let f = 0; f < FAIXAS; f++) {
        if (!frias[f].length) continue
        const prof = (f + 0.5) / FAIXAS
        cx.strokeStyle = rgba(corBase, (0.07 + prof * 0.24) * (0.75 + energia * 0.4) + clarao * 0.2)
        cx.lineWidth = 0.6 * E
        cx.beginPath()
        for (const l of frias[f]) {
          const a = P[l.a], b = P[l.b]
          cx.moveTo(a.sx, a.sy)
          cx.lineTo(b.sx, b.sy)
        }
        cx.stroke()
      }
      for (const [k, lista] of quentes) {
        const calor = ((k % 10) + 0.5) / 10
        cx.strokeStyle = rgba(ferr[Math.floor(k / 10)].cor, 0.18 + calor * 0.55)
        cx.lineWidth = (0.7 + calor * 1.1) * E
        cx.beginPath()
        for (const l of lista) {
          const a = P[l.a], b = P[l.b]
          cx.moveTo(a.sx, a.sy)
          cx.lineTo(b.sx, b.sy)
        }
        cx.stroke()
      }
      luz(corNucleo, CX, CY, S * (0.5 + 0.05 * Math.sin(t * 2.2)), 0.14 + energia * 0.1 + clarao * 0.25)
      for (const p of P) {
        const prof = (p.sz + 1.1) / 2.2
        const pisca = 0.5 + 0.5 * Math.sin(t * (1.4 + p.peso) + p.f)
        const r = (2.2 + prof * 4.2 + pisca * 1.6) * p.k * p.peso * E
        const alfa = (0.16 + prof * 0.5) * (0.55 + pisca * 0.45) + clarao * 0.5
        if (prof < 0.42 && p.calor < 0.03 && clarao < 0.05) {
          // neurônio do fundo do cérebro (quase apagado): um ponto simples, sem o brilho completo (metade do custo do quadro estava aqui)
          cx.globalAlpha = Math.min(1, alfa * 1.6)
          cx.fillStyle = corBase
          const q = Math.max(1, r * 0.32)
          cx.fillRect(p.sx - q / 2, p.sy - q / 2, q, q)
        } else luz(corBase, p.sx, p.sy, r, alfa)
        if (p.calor > 0.03 && prof > 0.35) luz(ferr[p.cor].cor, p.sx, p.sy, r * (1.5 + p.calor * 1.4), p.calor * (0.55 + prof * 0.45))
      }

      if (!reduzir) {
        acum += dt * (2 + kAtivo * (ativas.length ? 50 : 22) + (base === 'pensar' && !algumaFerr ? 26 * kAtivo : 0))
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
        luz(Math.max(a.calor, b.calor) > 0.1 ? ferr[a.cor].cor : kAtivo > 0.5 ? '#ffffff' : '#fff1cc', lerp(a.sx, b.sx, q.f), lerp(a.sy, b.sy, q.f), (3 + prof * 4) * E, 0.35 + prof * 0.5)
      }
      if (pulsos.length > 220) pulsos.splice(0, pulsos.length - 220)

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
        if (f.aceso && t > f.prox) {
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
        for (let c = 0; c < 6; c++) {
          const tt = q.p - c * 0.033
          if (tt < 0) break
          const pos = bez(f.A, C, f.D, q.volta ? 1 - tt : tt)
          luz(c === 0 || q.volta ? '#ffffff' : f.cor, pos.x, pos.y, (c === 0 ? 7 : 5.5) - c * 0.6, (1 - c / 6) * (c === 0 ? 0.95 : 0.5) * f.liga)
        }
      }

      cx.globalCompositeOperation = 'source-over'
      for (const f of ferr) {
        const on = f.liga, R = R0 + on * 4
        cx.globalAlpha = 1
        cx.beginPath(); cx.arc(f.ix, f.iy, R, 0, TAU)
        cx.fillStyle = on > 0.05 ? rgba(f.cor, 0.1 + on * 0.1) : 'rgba(150,160,190,0.04)'
        cx.fill()
        cx.strokeStyle = on > 0.05 ? rgba(f.cor, 0.35 + on * 0.55) : 'rgba(170,175,200,0.13)'
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
            cx.beginPath(); cx.arc(f.ix, f.iy, R + ph * 14, 0, TAU); cx.stroke()
          }
          cx.globalCompositeOperation = 'source-over'
        }
        icone(cx, f.id, f.ix, f.iy, 26 + on * 4, on > 0.05 ? '#ffffff' : mix('#c9b48a', '#93a6c8', kAtivo), 0.38 + 0.12 * kAtivo + on * 0.5)
        if (on > 0.3) {
          cx.globalAlpha = Math.min(1, (on - 0.3) * 2)
          cx.fillStyle = f.cor
          cx.font = '600 13px "Segoe UI",system-ui,sans-serif'
          cx.textAlign = 'center'
          cx.fillText(f.rotulo, f.ix, f.iy > CY ? f.iy - R - 8 : f.iy + R + 16) // rótulo do lado de dentro, nunca fora do quadro
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
    }

    function chip() {
      if (!chipEl) return
      const a = ferr.filter((f) => f.ativo).pop() || (alvoAtivo ? porId[base] : null)
      chipEl.style.setProperty('--c', a ? a.cor : '#ffc861')
      const b = chipEl.querySelector('b')
      if (b) b.textContent = a ? a.rotulo : 'Em repouso'
    }

    function evento(cat, estado) {
      const f = porId[ORBE_DE[cat] || cat] || porId.agentes
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
        if (!document.hidden && canvas.isConnected) quadro(agora()) // sem offsetParent: ele forçava recalcular o layout a cada quadro (19% do tempo); quem esconde chama parar()
        raf = requestAnimationFrame(laco)
      }
      raf = requestAnimationFrame(laco)
    }
    function parar() {
      animando = false
      if (!semTela) cancelAnimationFrame(raf)
    }

    // 'ativo' = pergunta rodando (azul, sinapses); 'parado' = sem pergunta (ambar, girando devagar). Nunca some: so muda de estado.
    function modo(m) {
      alvoAtivo = m === 'ativo' ? 1 : 0
      if (!alvoAtivo) for (const f of ferr) f.ativo = 0
      chip()
    }
    // estado de base enquanto nenhuma ferramenta roda: 'pensar' (raciocinio) ou 'escrever' (escrevendo a resposta)
    function definirBase(b) {
      b = ORBE_DE[b] || b
      if (!porId[b] || b === base) return
      base = b
      chip()
    }
    function limpar() {
      for (const f of ferr) f.ativo = 0
      chip()
    }
    return {
      evento, pensar, iniciar, parar, tamanho, passo, modo, base: definirBase, limpar, estado: () => ({ ativo: alvoAtivo, base }),
      ativas: () => new Map(ferr.filter((f) => f.ativo).map((f) => [f.id, f.ativo]).concat(ferr.filter((f) => !f.ativo && f.liga >= 0).map((f) => [f.id, f.ativo]))),
      particulas: () => pacotes.length + estouros.length + (ferr.some((f) => f.ativo) ? 1 : 0),
      frase: () => fraseAtual,
    }
  }

  return { ICONES, ROTULO, COR, categoriaDe, fraseDaFerramenta, fraseDoRaciocinio, aberto, lembrar, criarCartao }
})
