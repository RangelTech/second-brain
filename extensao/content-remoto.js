// Roda só em remoto.rangeltech.net. Se a extensão ainda não está pareada, usa o login que a pessoa já tem na página (cookie da mesma origem)
// para pedir um token de pareamento e entregá-lo à extensão: entrar no site já deixa a extensão logada. Nada de senha na extensão.
;(() => {
  const marcar = (estado) => { document.documentElement.setAttribute('data-sb-extensao', estado) }
  async function tentar() {
    let r
    try { r = await chrome.runtime.sendMessage({ t: 'precisa_parear' }) } catch { return }
    if (!r) return
    if (!r.precisa) return marcar('conectada')
    marcar('nao-pareada')
    try {
      const resp = await fetch('/api/extensao/parear', { method: 'POST', credentials: 'same-origin' })
      if (!resp.ok) return // ainda não entrou no site: tenta de novo daqui a pouco
      const { token } = await resp.json()
      const ok = await chrome.runtime.sendMessage({ t: 'parear', token })
      if (ok && ok.ok) marcar('conectada')
    } catch {}
  }
  // o app abre o site com #sbp=<token de pareamento>: pareia direto, sem login (o trecho depois do # nunca vai ao servidor)
  const m = /[#&]sbp=([^&]+)/.exec(location.hash || '')
  if (m) {
    const tokenApp = decodeURIComponent(m[1])
    try { history.replaceState(null, '', location.pathname + location.search) } catch {}
    chrome.runtime.sendMessage({ t: 'parear', token: tokenApp }).then((ok) => { if (ok && ok.ok) marcar('conectada') }).catch(() => {})
  }
  tentar()
  const t = setInterval(() => { if (document.documentElement.getAttribute('data-sb-extensao') === 'conectada') return clearInterval(t); if (!document.hidden) tentar() }, 3000)
})()
