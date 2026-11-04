// Envia uma mensagem pelo chat real (via CDP) e espera a resposta terminar.
// Uso: node scripts/teste-chat.js <porta> "<mensagem>" [segundos] [auto-permitir]
// Se houver pedido de permissão, clica em "Permitir" sozinho (só para teste).
const [porta, mensagem, seg = '600'] = process.argv.slice(2)
;(async () => {
  const lista = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json()
  const ws = new WebSocket((lista.find((p) => p.type === 'page' && p.url.startsWith('file:') && /index.html/.test(p.url)) || lista.find((p) => p.type === 'page')).webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let n = 0
  const pend = new Map()
  ws.onmessage = (m) => {
    const j = JSON.parse(m.data)
    pend.get(j.id)?.(j.result?.result?.value)
    pend.delete(j.id)
  }
  const ev = (expressao) =>
    new Promise((r) => {
      const id = ++n
      pend.set(id, r)
      ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expressao, returnByValue: true } }))
    })
  await ev(`window.SB.enviar(${JSON.stringify(mensagem)}), 1`)
  const fim = Date.now() + +seg * 1000
  let permitidas = 0
  while (Date.now() < fim) {
    await new Promise((r) => setTimeout(r, 2500))
    const botao = document_ok(await ev(`document.getElementById('enviar').getAttribute('aria-label')`))
    const clicou = await ev(`(()=>{const b=document.querySelector('.permissao [data-p="permitir"]');if(b){b.click();return 1}return 0})()`)
    if (clicou) permitidas++
    if (botao === 'Enviar') break
  }
  const resumo = await ev(`(()=>{const c=window.SB.chats().sort((a,b)=>b.em-a.em)[0];const m=c.msgs[c.msgs.length-1];return JSON.stringify({papel:m.role,texto:(m.content||'').slice(0,700),ferramentas:(m.partes||[]).filter(p=>p.t==='ferr').map(p=>({tipo:p.f.tipo,titulo:(p.f.titulo||'').slice(0,90),status:p.f.status,caminho:p.f.caminho}))})})()`)
  console.log('permissoes concedidas:', permitidas)
  console.log(resumo)
  ws.close()
})()
function document_ok(v) {
  return v
}
