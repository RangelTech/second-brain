// Captura de tela da janela via CDP: node scripts/captura.js <porta> <saida.png> [largura] [altura]
const [porta, saida, w, h] = process.argv.slice(2)
;(async () => {
  const lista = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json()
  const ws = new WebSocket(lista.find((p) => p.type === 'page').webSocketDebuggerUrl)
  let n = 0
  const pend = new Map()
  const cmd = (method, params = {}) => new Promise((r) => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
  ws.onmessage = (m) => { const j = JSON.parse(m.data); pend.get(j.id)?.(j.result); pend.delete(j.id) }
  await new Promise((r) => (ws.onopen = r))
  if (w) await cmd('Emulation.setDeviceMetricsOverride', { width: +w, height: +h || 800, deviceScaleFactor: 1, mobile: false })
  const r = await cmd('Page.captureScreenshot', { format: 'png' })
  require('fs').writeFileSync(saida, Buffer.from(r.data, 'base64'))
  ws.close()
})()
