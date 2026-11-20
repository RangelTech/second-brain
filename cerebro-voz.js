// Cérebro de voz (spec 54): um modelo RÁPIDO na frente do Hermes, só na conversa por voz. Responde conversa e conhecimento direto (texto
// corrido, para ser falado), busca na web sozinho quando precisa de atualidade (Exa, ~0,8 s, sem Hermes), acha música/vídeo no YouTube e,
// quando é TAREFA de verdade (computador, WhatsApp, site, arquivos, mídia), devolve "usar_agente" para o app chamar o Hermes completo.
// O Hermes e o chat não mudam nada. Interface: conversar({ base, chave, modelo, nome, historico, texto, modo }, emitir) -> Promise
// emitir({ tipo: 'delta'|'ferramenta'|'youtube'|'agente'|'limpar'|'fim'|'erro', ... }).
const EXA = 'https://mcp.exa.ai/mcp'

// ---------------------------------------------------------------- busca rápida (o mesmo backend sem chave que o Hermes usa)
async function exa(consulta, n = 5) {
  const r = await fetch(EXA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'User-Agent': 'cerebro-pro' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'web_search_exa', arguments: { query: String(consulta || '').slice(0, 300), numResults: n } } }),
    signal: AbortSignal.timeout(12000),
  })
  if (!r.ok) throw new Error('busca respondeu ' + r.status)
  const bruto = await r.text()
  // corpo SSE ("data: {...}") ou JSON puro
  const linha = bruto.split('\n').find((l) => l.startsWith('data:'))
  const j = JSON.parse(linha ? linha.slice(5) : bruto)
  const texto = (j?.result?.content || []).map((c) => c.text || '').join('\n')
  return texto.split(/\n---\n/).map((bloco) => {
    const titulo = (/^Title: (.*)$/m.exec(bloco) || [])[1] || ''
    const url = (/^URL: (.*)$/m.exec(bloco) || [])[1] || ''
    const quando = (/^Published: (.*)$/m.exec(bloco) || [])[1] || ''
    const trecho = bloco.split(/^Highlights:\s*$/m)[1] || bloco
    return { titulo: titulo.trim(), url: url.trim(), quando: quando.trim(), trecho: trecho.replace(/\s+/g, ' ').trim().slice(0, 700) }
  }).filter((x) => x.titulo || x.trecho)
}
async function buscarNaWeb(consulta) {
  const res = await exa(consulta, 5)
  if (!res.length) return 'A busca não trouxe resultados.'
  return res.map((x, i) => `[${i + 1}] ${x.titulo}${x.quando && x.quando !== 'N/A' ? ' (' + x.quando.slice(0, 10) + ')' : ''}\n${x.trecho}`).join('\n\n').slice(0, 4500)
}
const idYoutube = (u) => (/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/.exec(u || '') || [])[1] || null
async function acharYoutube(busca) {
  const res = await exa(busca + ' youtube', 6)
  const v = res.find((x) => idYoutube(x.url))
  return v ? { id: idYoutube(v.url), titulo: v.titulo.replace(/\s*-\s*YouTube\s*$/i, '') } : null
}

// ---------------------------------------------------------------- o modelo
const FERRAMENTAS = [
  { type: 'function', function: { name: 'buscar_na_web', description: 'Busca rápida na internet. Use para QUALQUER coisa atual ou que muda: preço, cotação, clima, notícia, placar, lançamento, horário, quem é hoje, ou quando não tiver certeza do fato.', parameters: { type: 'object', properties: { consulta: { type: 'string', description: 'o que buscar, em poucas palavras' } }, required: ['consulta'] } } },
  { type: 'function', function: { name: 'tocar_youtube', description: 'Acha e toca na tela um vídeo ou música do YouTube (clipe, música, trailer, vídeo de um assunto).', parameters: { type: 'object', properties: { busca: { type: 'string', description: 'artista e música, ou o vídeo procurado' } }, required: ['busca'] } } },
  { type: 'function', function: { name: 'usar_agente', description: 'Passa uma TAREFA para o agente completo, que mexe no computador do usuário: arquivos e pastas, WhatsApp, Instagram e outras redes, navegador (entrar em sites, logar, clicar, preencher), criar ou editar site, documento, planilha, imagem ou vídeo, programar, rodar comandos, ou qualquer coisa de várias etapas. Leva de segundos a vários minutos.', parameters: { type: 'object', properties: { tarefa: { type: 'string', description: 'a tarefa completa e clara, com todos os detalhes que o usuário deu' }, aviso: { type: 'string', description: 'uma frase curta e simpática para falar agora, avisando que vai fazer (e que pode demorar, se for longo)' } }, required: ['tarefa', 'aviso'] } } },
  { type: 'function', function: { name: 'limpar_tela', description: 'Tira da tela as imagens, gráficos ou vídeos que estão sendo mostrados (o usuário pediu para fechar/tirar, ou o assunto mudou).', parameters: { type: 'object', properties: {} } } },
]
function instrucao({ nome, modo }) {
  const agora = new Date().toLocaleString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const base = [
    `Você é o Cérebro Pro, a IA pessoal${nome ? ' de ' + nome : ''}, conversando por VOZ. Agora é ${agora}.`,
    'Tudo o que você escrever vai ser FALADO em voz alta. Fale como gente numa conversa: português do Brasil, texto corrido, frases curtas e naturais.',
    'NUNCA use lista, tabela, tópicos, negrito, títulos, emoji, link ou código. No máximo 3 ou 4 frases, a não ser que peçam detalhe. Se houver opções, ofereça no FINAL, numa frase só.',
    'Tenha personalidade: caloroso, esperto, um toque de humor quando cabe. Se a pessoa estiver desabafando, escute de verdade, acolha, pergunte com cuidado, sem sermão.',
    'NUNCA invente número, data, distância, preço ou fato. Se a resposta depende de algo atual, ou de um número ou fato que você não tem CERTEZA absoluta, use buscar_na_web antes (é rápida) e responda com o que a busca trouxe. Curiosidade também: prefira uma que você sabe com segurança.',
    'Use tocar_youtube quando pedirem para ouvir ou ver música, clipe ou vídeo.',
    'Use usar_agente quando for preciso mexer no computador, nas contas ou fazer um trabalho de várias etapas; não tente fazer isso você mesmo.',
    'Nunca diga nomes de ferramentas nem termos técnicos.',
  ]
  if (modo === 'resumir') base.push('Agora o agente terminou uma tarefa. A mensagem do usuário traz o pedido e o resultado do agente: conte o resultado como numa conversa, em 2 a 4 frases, destacando o que importa. Se o resultado citar imagem ou arquivo, diga só que está na tela ou onde ficou.')
  return base.join('\n')
}

// voz não pode ficar muda: sem o 1º pedaço em PRIMEIRO_MS a chamada cai (e o app passa para o modelo reserva na hora).
// Medido 20/11: o rt-auto travou uma vez 60 s sem responder; com este prazo a troca leva ~8 s em vez de 60.
const PRIMEIRO_MS = 11000 // 8 s derrubou os dois modelos juntos num momento de servidor cheio
async function chamar({ base, chave, modelo, mensagens, comFerramentas }, aoDelta) {
  const ac = new AbortController()
  const prazo = setTimeout(() => ac.abort(new Error('sem resposta em ' + PRIMEIRO_MS / 1000 + ' s')), PRIMEIRO_MS)
  const teto = setTimeout(() => ac.abort(new Error('resposta longa demais')), 60000)
  let r
  try {
    r = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + chave, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelo, stream: true, temperature: 0.6, max_tokens: 700, messages: mensagens, ...(comFerramentas ? { tools: FERRAMENTAS, tool_choice: 'auto' } : {}), chat_template_kwargs: { enable_thinking: false } }),
      signal: ac.signal,
    })
  } catch (e) {
    clearTimeout(prazo); clearTimeout(teto)
    throw ac.signal.reason || e
  }
  if (!r.ok || !r.body) (clearTimeout(prazo), clearTimeout(teto))
  if (!r.ok || !r.body) throw new Error('modelo respondeu ' + r.status)
  let texto = ''
  const chamadas = []
  let resto = ''
  try {
  for await (const pedaco of r.body) {
    clearTimeout(prazo) // chegou o 1º pedaço: daqui para frente só o teto de 60 s
    resto += Buffer.from(pedaco).toString('utf8')
    let i
    while ((i = resto.indexOf('\n')) >= 0) {
      const l = resto.slice(0, i).trim()
      resto = resto.slice(i + 1)
      if (!l.startsWith('data:')) continue
      const d = l.slice(5).trim()
      if (d === '[DONE]') continue
      let j
      try { j = JSON.parse(d) } catch { continue }
      const delta = j?.choices?.[0]?.delta || {}
      if (delta.content) (texto += delta.content), aoDelta(delta.content)
      for (const tc of delta.tool_calls || []) {
        const k = tc.index ?? 0
        chamadas[k] ||= { id: tc.id || 'c' + k, nome: '', args: '' }
        if (tc.id) chamadas[k].id = tc.id
        if (tc.function?.name) chamadas[k].nome += tc.function.name
        if (tc.function?.arguments) chamadas[k].args += tc.function.arguments
      }
    }
  }
  } catch (e) {
    throw ac.signal.aborted ? ac.signal.reason || e : e
  } finally {
    clearTimeout(prazo)
    clearTimeout(teto)
  }
  return { texto, chamadas: chamadas.filter(Boolean) }
}

async function conversar({ base, chave, modelo, nome, historico = [], texto, modo }, emitir) {
  const mensagens = [{ role: 'system', content: instrucao({ nome, modo }) }, ...historico.slice(-12), { role: 'user', content: String(texto || '') }]
  const t0 = Date.now()
  let primeiro = 0
  const aoDelta = (d) => {
    if (!primeiro) primeiro = Date.now() - t0
    emitir({ tipo: 'delta', data: d })
  }
  let falado = ''
  for (let rodada = 0; rodada < 3; rodada++) {
    const { texto: t, chamadas } = await chamar({ base, chave, modelo, mensagens, comFerramentas: modo !== 'resumir' }, aoDelta)
    falado += t
    if (!chamadas.length) break
    mensagens.push({ role: 'assistant', content: t || null, tool_calls: chamadas.map((c) => ({ id: c.id, type: 'function', function: { name: c.nome, arguments: c.args || '{}' } })) })
    let parar = false
    for (const c of chamadas) {
      let a = {}
      try { a = JSON.parse(c.args || '{}') } catch {}
      let saida = ''
      c.nome = /busc|pesquis|search/i.test(c.nome) ? 'buscar_na_web' : /youtube|tocar|musica/i.test(c.nome) ? 'tocar_youtube' : /agente|tarefa/i.test(c.nome) ? 'usar_agente' : /limpar|tela/i.test(c.nome) ? 'limpar_tela' : c.nome
      emitir({ tipo: 'ferramenta', nome: c.nome, args: a })
      try {
        if (c.nome === 'buscar_na_web') saida = await buscarNaWeb(a.consulta || texto)
        else if (c.nome === 'tocar_youtube') {
          const v = await acharYoutube(a.busca || texto)
          if (v) emitir({ tipo: 'youtube', video: v.id, titulo: v.titulo })
          saida = v ? `Achei e já está tocando na tela: ${v.titulo}. Diga em uma frase curta que está tocando.` : 'Não achei esse vídeo. Diga isso e ofereça tentar outro nome.'
        } else if (c.nome === 'limpar_tela') {
          emitir({ tipo: 'limpar' })
          saida = 'Tela limpa.'
        } else if (c.nome === 'usar_agente') {
          emitir({ tipo: 'agente', tarefa: a.tarefa || texto, aviso: a.aviso || 'Deixa comigo, já vou fazendo.' })
          parar = true
          saida = 'ok'
        } else saida = 'ferramenta desconhecida'
      } catch (e) {
        saida = 'Não consegui agora (' + String((e && e.message) || e).slice(0, 80) + '). Diga isso de forma simples.'
      }
      mensagens.push({ role: 'tool', tool_call_id: c.id, content: saida })
    }
    if (parar) return emitir({ tipo: 'fim', falado, agente: true, primeiro, total: Date.now() - t0 })
  }
  emitir({ tipo: 'fim', falado, primeiro, total: Date.now() - t0 })
}

module.exports = { conversar, buscarNaWeb, acharYoutube, idYoutube, instrucao, FERRAMENTAS }
