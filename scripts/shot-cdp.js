// Captura da página via CDP: node scripts/shot-cdp.js <porta> <arquivo.png>
const [porta, arq] = process.argv.slice(2)
;(async () => {
  const lista = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json()
  const alvo = lista.find((p) => p.type === 'page' && /index.html|127\.0\.0\.1:8787|remoto/.test(p.url)) || lista.find((p) => p.type === 'page')
  const ws = new WebSocket(alvo.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  ws.onmessage = (m) => {
    const j = JSON.parse(m.data)
    if (j.id === 1) { require('fs').writeFileSync(arq, Buffer.from(j.result.data, 'base64')); ws.close() }
  }
  ws.send(JSON.stringify({ id: 1, method: 'Page.captureScreenshot', params: { format: 'png' } }))
})()
