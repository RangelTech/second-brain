// Progresso estimado da preparação do agente (tela de primeira abertura): percentual de 0 a 100 e tempo restante.
// O instalador do agente não informa percentual, então o cálculo junta duas coisas: o PASSO atual (cada passo conhecido tem um piso) e o TEMPO
// (curva que sobe rápido e desacelera, sem nunca passar de 96% antes de terminar). O percentual nunca diminui. O tempo esperado vem do instalador que
// está sendo usado (completo/offline: ~2 min; com download: ~7 min) e é refinado com a duração da última preparação deste computador.
;(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica()
  else raiz.SBPreparo = fabrica()
})(typeof self !== 'undefined' ? self : this, function () {
  // piso de percentual por palavra-chave do passo (o primeiro que casar vale; o maior piso já visto é mantido)
  const PISOS = [
    [/instalador que vem|copiando o agente/i, 8],
    [/copiando os pacotes/i, 30],
    [/conferindo/i, 70],
    [/baixando o instalador/i, 3],
    [/ffmpeg/i, 14],
    [/node/i, 24],
    [/python/i, 34],
    [/ripgrep|uv\b/i, 44],
    [/git/i, 52],
    [/node dep|dependências do node|pnpm/i, 55],
    [/ambiente|pacotes|depend/i, 66],
    [/pronto|verific|testando/i, 85],
  ]
  const TETO_TEMPO = 96

  function esperadoMs(texto, ultimaDuracaoMs) {
    const offline = /instalador que vem|copiando o agente|copiando os pacotes/i.test(texto || '')
    const base = offline ? 150000 : 840000 // com download: medido em 11/11/2026 neste PC, mais de 16 min (pnpm/npm); o instalador completo evita isso
    if (ultimaDuracaoMs && ultimaDuracaoMs > 20000) return Math.round((base + ultimaDuracaoMs) / 2) // aprende com a última vez
    return base
  }

  // estado: { piso, pct } guardado entre chamadas (para nunca voltar atrás)
  function estimar(estado, { texto, decorridoMs, ultimaDuracaoMs }) {
    const e = estado || { piso: 0, pct: 0 }
    for (const [re, piso] of PISOS) if (re.test(texto || '') && piso > e.piso) { e.piso = piso; break }
    const total = esperadoMs(texto, ultimaDuracaoMs)
    const tempo = Math.min(TETO_TEMPO, 100 * (1 - Math.exp(-(decorridoMs / total) * 2.6)))
    const bruto = Math.max(e.piso, tempo)
    e.pct = Math.min(TETO_TEMPO, Math.max(e.pct, bruto))
    // restante: o que falta da curva (no mínimo 10 s, para nunca mostrar "0 s" antes de acabar)
    const ate = (p) => total * (-Math.log(Math.max(0.02, 1 - p / 100)) / 2.6) // tempo da curva até p%
    const restanteMs = Math.max(10000, ate(90) - ate(e.pct))
    e.restanteMs = Math.max(0, restanteMs)
    return e
  }

  function textoRestante(ms) {
    const s = Math.max(10, Math.round(ms / 1000))
    if (s < 50) return 'menos de 1 minuto'
    const min = Math.round(s / 60)
    return min <= 1 ? 'cerca de 1 minuto' : `cerca de ${min} minutos`
  }
  // o instalador do agente escreve em inglês: mostra em português e sem pontos repetidos
  const TRADUCAO = [
    [/preparing node dependencies/i, 'preparando as dependências do Node'],
    [/preparing (python|pip|uv) dependencies/i, 'preparando as dependências do Python'],
    [/installing (python )?(packages|dependencies)/i, 'instalando os pacotes'],
    [/installing node/i, 'instalando o Node'],
    [/installing python/i, 'instalando o Python'],
    [/installing (ffmpeg|ripgrep|git|uv)/i, (m) => 'instalando o ' + m[1].toLowerCase()],
    [/downloading/i, 'baixando os componentes'],
    [/cloning|checkout|repository/i, 'baixando o agente'],
    [/building|compiling/i, 'montando o agente'],
    [/browser/i, 'preparando as ferramentas de navegador'],
    [/verifying|checking|testing/i, 'conferindo o agente'],
  ]
  function traduzir(passo) {
    const limpo = String(passo || '').replace(/[.…]+\s*$/g, '').replace(/\.{2,}/g, '').trim()
    for (const [re, t] of TRADUCAO) { const m = limpo.match(re); if (m) return typeof t === 'function' ? t(m) : t }
    // texto do instalador sem tradução (inglês: "Reload your shell…", "Install complete! [detached @ …]"): o cliente vê uma frase em português
    if (/^(ffmpeg|node|python|ripgrep|git|uv|npm|pnpm)$/i.test(limpo)) return 'instalando o ' + limpo.toLowerCase() // etapa conhecida (a barra usa o nome)
    if (/[a-z]{3,}/i.test(limpo) && !/[áàâãéêíóôõúç]|\b(os|as|de|do|da|dos|das|com|para|agente|ambiente|instalando|baixando|copiando|conferindo|preparando|montando|pacotes)\b/i.test(limpo)) return 'preparando o agente'
    return limpo
  }
  return { estimar, textoRestante, esperadoMs, traduzir, PISOS }
})
