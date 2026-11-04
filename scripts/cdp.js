// Executa JS na janela via CDP: node scripts/cdp.js <porta> "<expressao>"
const [porta, expr] = process.argv.slice(2)
;(async () => {
  const lista = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json()
  const ws = new WebSocket((lista.find((p) => p.type === 'page' && p.url.startsWith('file:') && /index.html/.test(p.url)) || lista.find((p) => p.type === 'page')).webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  ws.onmessage = (m) => { console.log(JSON.stringify(JSON.parse(m.data).result?.result?.value)); ws.close() }
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } }))
})()
