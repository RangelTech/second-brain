// Restaura, na resposta em stream, os nomes de servidores MCP que a ponte normalizou (ver normalizarEditor em ponte-llm.js).
// O modelo chama as ferramentas MCP carregadas sob demanda pelo NOME dentro dos argumentos da chamada (tool_call {"name": "mcp__editor_x_<sufixo>__..."}),
// e os argumentos chegam em vários eventos do stream: o nome com o sufixo fixo pode vir partido entre dois eventos. Por isso, para cada chamada de
// ferramenta (campo `index`), seguramos no fim do texto só o que ainda pode ser o começo de um nome fixo e liberamos o resto já restaurado.
// Nada é segurado quando não há troca ativa; no fim (finish_reason, [DONE] ou fim da resposta) o que sobrou é liberado.

function criarRestaurador(pares) {
  const fixos = [...pares.keys()]
  const maxLen = fixos.reduce((m, f) => Math.max(m, f.length), 0)
  const pend = new Map() // index da chamada -> final do texto ainda indeciso
  let envelope = null // id/modelo do último evento, para os eventos sintéticos de descarga

  const restaurar = (t) => {
    let r = t
    for (const [fixo, real] of pares) if (r.includes(fixo)) r = r.split(fixo).join(real)
    return r
  }
  // quantos caracteres do fim do texto podem ser o começo de um nome fixo (no máximo maxLen - 1)
  const reter = (t) => {
    const limite = Math.min(maxLen - 1, t.length)
    for (let k = limite; k > 0; k--) {
      const cauda = t.slice(t.length - k)
      if (fixos.some((f) => f.startsWith(cauda))) return k
    }
    return 0
  }
  const sintetico = (index, texto) => {
    const base = envelope || {}
    return 'data: ' + JSON.stringify({ id: base.id, object: base.object || 'chat.completion.chunk', created: base.created, model: base.model, choices: [{ index: 0, delta: { tool_calls: [{ index, function: { arguments: texto } }] }, finish_reason: null }] })
  }
  const descarregar = () => {
    const saida = []
    // cada evento sintetico leva a linha em branco que fecha o evento SSE (senao ele se fundiria com o seguinte)
    for (const [index, texto] of pend) if (texto) saida.push(sintetico(index, restaurar(texto)), '')
    pend.clear()
    return saida
  }

  return {
    // recebe UMA linha do SSE (sem o \n) e devolve as linhas a escrever
    linha(l) {
      if (!l.startsWith('data:')) return [l]
      if (l.includes('[DONE]')) return [...descarregar(), l]
      let obj
      try {
        obj = JSON.parse(l.slice(5))
      } catch {
        return [restaurar(l)]
      }
      if (obj && typeof obj === 'object') envelope = { id: obj.id, object: obj.object, created: obj.created, model: obj.model }
      const saida = []
      const ch = obj && Array.isArray(obj.choices) ? obj.choices : []
      const terminou = ch.some((c) => c && c.finish_reason)
      if (terminou) saida.push(...descarregar())
      for (const c of ch) {
        const tcs = c && c.delta && Array.isArray(c.delta.tool_calls) ? c.delta.tool_calls : null
        if (!tcs) continue
        for (const tc of tcs) {
          if (!tc.function) continue
          if (typeof tc.function.name === 'string') tc.function.name = restaurar(tc.function.name)
          if (typeof tc.function.arguments === 'string') {
            const idx = tc.index ?? 0
            const texto = (pend.get(idx) || '') + tc.function.arguments
            const seg = terminou ? 0 : reter(texto)
            tc.function.arguments = restaurar(texto.slice(0, texto.length - seg))
            pend.set(idx, texto.slice(texto.length - seg))
          }
        }
      }
      // o resto do evento (conteúdo, raciocínio, nomes inteiros) também volta ao nome real
      saida.push('data: ' + restaurar(JSON.stringify(obj)))
      return saida
    },
    // fim da resposta: libera o que ficou segurado
    fim() {
      return descarregar()
    },
  }
}

module.exports = { criarRestaurador }
