// Ponte de progresso entre o agente (Hermes) e o roteador de modelos.
// O Hermes só mostra uma ação depois de recebê-la inteira, então um arquivo grande escrito numa só chamada de ferramenta
// deixa a tela parada por minutos mesmo com o modelo trabalhando. Esta ponte repassa tudo sem alterar e, no caminho,
// conta o que o modelo já gerou (texto, raciocínio ou argumentos de ferramenta) para a tela mostrar progresso real.
// Cada agente usa uma chave "<chave real>::sb::<id da conversa>"; a ponte tira o sufixo antes de repassar ao roteador.
const http = require('http')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { criarRestaurador } = require('./ponte-restaurar')

const SEP = '::sb::'
const CHARS_POR_TOKEN = 3.6
const INTERVALO_MS = 1000
// Depois do 1º byte, o modelo gera token a token sem parar: silêncio maior que isso não é "pensando", é conexão morta
// (o sintoma real que vimos: ficava 15 min esperando o vigia do próprio Hermes perceber). Antes do 1º byte não vale
// (fila, GPU acordando), por isso só conta depois que a resposta já começou a chegar.
const LIMITE_STREAM_MORTO_MS = +process.env.SB_TESTE_STREAM_MORTO_MS || 90000

// O Hermes nomeia os servidores MCP do editor como editor_<nome>_<8 hex>, e o sufixo vem do id da sessão (muda a cada conversa).
// Esse nome aparece na descrição da ferramenta tool_search, ANTES do prompt de sistema na ordem que o modelo lê: mudar o sufixo
// invalida o cache de prefixo do servidor e cada sessão nova recalcula ~8 mil tokens à toa (medido: 9,7 s contra 2,0 s no 1º token).
// A ponte troca o sufixo por um fixo (mesmo tamanho, derivado do nome) na ida e desfaz na volta: o Hermes continua vendo e usando o nome real.
const RE_EDITOR = /editor_([A-Za-z0-9]+(?:_[A-Za-z0-9]+)*?)_([0-9a-f]{8})(?![0-9a-f])/g
function normalizarEditor(texto) {
  const pares = new Map()
  const novo = texto.replace(RE_EDITOR, (m, nome, hash) => {
    const fixo = crypto.createHash('sha1').update('sb-editor:' + nome).digest('hex').slice(0, 8)
    if (fixo === hash) return m
    pares.set(`editor_${nome}_${fixo}`, `editor_${nome}_${hash}`)
    return `editor_${nome}_${fixo}`
  })
  return { texto: novo, pares }
}
function restaurarEditor(texto, pares) {
  let t = texto
  for (const [fixo, real] of pares) if (t.includes(fixo)) t = t.split(fixo).join(real)
  return t
}

// O servidor NÃO desliga o raciocínio com reasoning_effort:"none" (medido em 08/11/2026 no mesmo pedido real do Hermes: 13,1 s assim, 2,7 s com
// chat_template_kwargs.enable_thinking=false; uma resposta de 505 caracteres gastou 5.821 tokens e 93 s). Sem raciocínio escolhido, a ponte liga o parâmetro certo.
function semPensar(texto) {
  try {
    const j = JSON.parse(texto)
    const e = j.reasoning_effort
    if (e === undefined || e === null || e === '' || e === 'none') {
      j.chat_template_kwargs = { ...(j.chat_template_kwargs || {}), enable_thinking: false }
      return JSON.stringify(j)
    }
  } catch {}
  return texto
}

function criar({ destino, aoProgresso, registrar = () => {} }) {
  let servidor = null
  const alvo = () => new URL(typeof destino === 'function' ? destino() : destino)

  function tratar(req, res) {
    const auth = String(req.headers.authorization || '')
    const i = auth.indexOf(SEP)
    const chat = i >= 0 ? auth.slice(i + SEP.length) : null
    const headers = { ...req.headers }
    if (i >= 0) headers.authorization = auth.slice(0, i)
    const d = alvo()
    headers.host = d.host
    const t0 = Date.now()
    // medição (spec de contexto): com SB_DUMP_REQ_DIR o corpo de cada chamada de chat vai para um arquivo, só para analisar a composição do contexto
    if (process.env.SB_DUMP_REQ_DIR && req.method === 'POST' && /chat\/completions/.test(req.url)) {
      const partes = []
      req.on('data', (c) => partes.push(c))
      req.on('end', () => {
        try {
          fs.mkdirSync(process.env.SB_DUMP_REQ_DIR, { recursive: true })
          fs.writeFileSync(path.join(process.env.SB_DUMP_REQ_DIR, `req-${Date.now()}-${(chat || 'x').slice(0, 8)}.json`), Buffer.concat(partes))
        } catch {}
      })
    }
    // O servidor só entrega uma chamada de ferramenta quando ela termina de ser escrita (nenhum byte antes disso), então
    // "conectado e sem erro" já é sinal de vida: a cada segundo avisamos a tela, que mostra o tempo de espera de verdade.
    const est = { ultimo: t0, primeiro: 0, destruir: null }
    let batida = null
    if (chat && req.method === 'POST' && /chat\/completions/.test(req.url || '')) {
      batida = setInterval(() => {
        // batimento sempre que o modelo está calado (antes do 1º byte ou no meio de uma ação longa)
        if (Date.now() - est.ultimo > 1500) aoProgresso(chat, { tipo: 'espera', seg: Math.round((Date.now() - t0) / 1000) })
        // stream morto de verdade (já tinha começado e parou de vez): derruba em vez de continuar fingindo que está vivo
        if (est.primeiro && est.destruir && Date.now() - est.ultimo > LIMITE_STREAM_MORTO_MS) {
          registrar(`ponte: stream parado ${Math.round((Date.now() - est.ultimo) / 1000)}s depois do 1º byte, derrubando (${chat.slice(0, 8)})`)
          const d = est.destruir
          est.destruir = null
          d()
        }
      }, 1000)
    }
    const fimBatida = () => batida && clearInterval(batida)
    let pares = new Map() // sufixos MCP trocados nesta chamada (fixo -> real)
    let restaurador = null // restaura os nomes na resposta em stream (criado quando há troca)
    let pend = '' // resposta SSE ainda sem linha completa, só usada quando há troca
    const up = http.request({ hostname: d.hostname, port: d.port, path: req.url, method: req.method, headers }, (r) => {
      res.writeHead(r.statusCode || 502, r.headers)
      const sse = /text\/event-stream/.test(String(r.headers['content-type'] || ''))
      if (!sse || !chat) return r.pipe(res)
      let resto = ''
      let chars = 0
      let tipo = 'texto'
      let primeiro = 0
      let ultimoAviso = 0
      const avisar = (forcar) => {
        const agora = Date.now()
        if (!forcar && agora - ultimoAviso < INTERVALO_MS) return
        ultimoAviso = agora
        const seg = Math.max(0.5, (agora - (primeiro || t0)) / 1000)
        const tokens = Math.round(chars / CHARS_POR_TOKEN)
        aoProgresso(chat, { tipo, tokens, tps: Math.round(tokens / seg), seg: Math.round((agora - t0) / 1000) })
      }
      est.destruir = () => {
        try { r.destroy(new Error('stream parado')) } catch {}
        try { up.destroy() } catch {}
        try { res.destroy() } catch {}
      }
      r.on('data', (b) => {
        if (pares.size) {
          // com troca de sufixo, só sai linha completa, e os argumentos de cada chamada de ferramenta passam por um restaurador com janela de
          // retenção: o nome MCP (chamado pelos argumentos do tool_call) chega partido entre eventos e precisa voltar inteiro com o sufixo real
          if (!restaurador) restaurador = criarRestaurador(pares)
          pend += b.toString('utf8')
          let k
          while ((k = pend.indexOf('\n')) >= 0) {
            const linha = pend.slice(0, k).replace(/\r$/, '')
            pend = pend.slice(k + 1)
            for (const saida of restaurador.linha(linha)) res.write(saida + '\n')
          }
        } else res.write(b)
        est.ultimo = Date.now()
        if (!primeiro) {
          primeiro = Date.now()
          est.primeiro = primeiro
          registrar(`ponte: primeiro byte em ${((primeiro - t0) / 1000).toFixed(1)} s (${chat.slice(0, 8)})`)
        }
        resto += b.toString('utf8')
        let n
        while ((n = resto.indexOf('\n')) >= 0) {
          const l = resto.slice(0, n).trim()
          resto = resto.slice(n + 1)
          if (!l.startsWith('data:') || l.includes('[DONE]')) continue
          try {
            const e = JSON.parse(l.slice(5))
            const dl = e.choices?.[0]?.delta
            if (!dl) continue
            if (dl.tool_calls) {
              tipo = 'ferramenta'
              for (const tc of dl.tool_calls) chars += (tc.function?.arguments || '').length + (tc.function?.name || '').length
            } else if (dl.content) {
              tipo = 'texto'
              chars += dl.content.length
            } else if (dl.reasoning_content || dl.reasoning) {
              tipo = 'raciocinio'
              chars += String(dl.reasoning_content || dl.reasoning).length
            }
          } catch {}
        }
        avisar(false)
      })
      r.on('end', () => {
        fimBatida()
        if (chars) avisar(true)
        if (restaurador) {
          if (pend) for (const saida of restaurador.linha(pend)) res.write(saida + '\n')
          for (const saida of restaurador.fim()) res.write(saida + '\n')
          pend = ''
        } else if (pend) res.write(restaurarEditor(pend, pares))
        res.end()
      })
      r.on('error', () => (fimBatida(), res.destroy()))
    })
    up.on('error', (e) => {
      fimBatida()
      if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'roteador indisponível: ' + e.message } }))
    })
    // o Hermes cancelou (parar): corta o pedido ao roteador também
    res.on('close', () => (fimBatida(), up.destroy()))
    if (req.method === 'POST' && /chat\/completions/.test(req.url || '') && !process.env.SB_SEM_NORMALIZAR_EDITOR) {
      const partes = []
      req.on('data', (c) => partes.push(c))
      req.on('end', () => {
        let corpo = Buffer.concat(partes)
        const n = normalizarEditor(corpo.toString('utf8'))
        if (n.pares.size) pares = n.pares
        corpo = Buffer.from(semPensar(n.pares.size ? n.texto : corpo.toString('utf8')), 'utf8')
        up.setHeader('content-length', corpo.length)
        up.end(corpo)
      })
    } else req.pipe(up)
  }

  return {
    iniciar() {
      if (servidor) return Promise.resolve(servidor.address().port)
      return new Promise((ok, falha) => {
        servidor = http.createServer(tratar)
        servidor.on('error', falha)
        servidor.listen(0, '127.0.0.1', () => ok(servidor.address().port))
      })
    },
    origem: () => (servidor ? `http://127.0.0.1:${servidor.address().port}` : null),
    fechar: () => servidor?.close(),
  }
}

module.exports = { semPensar, criar, SEP, normalizarEditor, restaurarEditor }
