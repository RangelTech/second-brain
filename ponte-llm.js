// Ponte de progresso entre o agente (Hermes) e o roteador de modelos.
// O Hermes só mostra uma ação depois de recebê-la inteira, então um arquivo grande escrito numa só chamada de ferramenta
// deixa a tela parada por minutos mesmo com o modelo trabalhando. Esta ponte repassa tudo sem alterar e, no caminho,
// conta o que o modelo já gerou (texto, raciocínio ou argumentos de ferramenta) para a tela mostrar progresso real.
// Cada agente usa uma chave "<chave real>::sb::<id da conversa>"; a ponte tira o sufixo antes de repassar ao roteador.
const http = require('http')
const fs = require('fs')
const path = require('path')

const SEP = '::sb::'
const CHARS_POR_TOKEN = 3.6
const INTERVALO_MS = 1000
// Depois do 1º byte, o modelo gera token a token sem parar: silêncio maior que isso não é "pensando", é conexão morta
// (o sintoma real que vimos: ficava 15 min esperando o vigia do próprio Hermes perceber). Antes do 1º byte não vale
// (fila, GPU acordando), por isso só conta depois que a resposta já começou a chegar.
const LIMITE_STREAM_MORTO_MS = +process.env.SB_TESTE_STREAM_MORTO_MS || 90000

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
        res.write(b)
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
    req.pipe(up)
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

module.exports = { criar, SEP }
