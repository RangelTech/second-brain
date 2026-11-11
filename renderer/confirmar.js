// Pergunta de confirmação DENTRO do app (no lugar do confirm() do sistema). O confirm() nativo congela a interface inteira até a pessoa
// responder, sai com o visual do sistema ("Cancel"/"OK" em inglês no macOS) e, no QA de 11/11/2026, travou o app no Mac logo depois do login.
// Uso: if (!(await window.sbConfirmar('Apagar esta conversa?', { sim: 'Apagar', perigo: true }))) return
;(function () {
  const CSS = `.sbc-fundo{position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;animation:sbc-in .15s ease-out}
.sbc-caixa{width:min(440px,100%);background:var(--painel,#26231f);color:var(--fg,#ece9e4);border:1px solid rgba(255,255,255,.12);border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.5);padding:20px 22px 16px;font:14px/1.5 system-ui,sans-serif}
.sbc-titulo{margin:0 0 6px;font-size:16px;font-weight:600}
.sbc-texto{margin:0 0 16px;color:var(--mut,#b8b2a8);white-space:pre-line}
.sbc-botoes{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
.sbc-botoes button{border-radius:10px;padding:8px 14px;font:inherit;cursor:pointer;border:1px solid rgba(255,255,255,.16);background:transparent;color:inherit}
.sbc-botoes .sbc-sim{background:#d97757;border-color:#d97757;color:#1b1814;font-weight:600}
.sbc-botoes .sbc-sim.perigo{background:#c0392b;border-color:#c0392b;color:#fff}
.sbc-botoes button:focus-visible{outline:2px solid #ffb36b;outline-offset:2px}
@keyframes sbc-in{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.sbc-fundo{animation:none}}`
  let estilo = false
  window.sbConfirmar = function (texto, { titulo = '', sim = 'Confirmar', nao = 'Cancelar', perigo = false } = {}) {
    if (!estilo) {
      const s = document.createElement('style')
      s.textContent = CSS
      document.head.appendChild(s)
      estilo = true
    }
    // a primeira linha vira título quando não vem um (as mensagens antigas usavam "pergunta\n\ndetalhe")
    let corpo = String(texto || '')
    if (!titulo) {
      const i = corpo.indexOf('\n\n')
      if (i > 0) {
        titulo = corpo.slice(0, i)
        corpo = corpo.slice(i + 2)
      } else {
        titulo = corpo
        corpo = ''
      }
    }
    return new Promise((resolver) => {
      const anterior = document.activeElement
      const f = document.createElement('div')
      f.className = 'sbc-fundo'
      f.innerHTML = '<div class="sbc-caixa" role="alertdialog" aria-modal="true" aria-labelledby="sbc-t" aria-describedby="sbc-d"><h2 class="sbc-titulo" id="sbc-t"></h2><p class="sbc-texto" id="sbc-d"></p><div class="sbc-botoes"><button type="button" class="sbc-nao"></button><button type="button" class="sbc-sim"></button></div></div>'
      f.querySelector('.sbc-titulo').textContent = titulo
      const d = f.querySelector('.sbc-texto')
      d.textContent = corpo
      d.hidden = !corpo
      const bSim = f.querySelector('.sbc-sim')
      const bNao = f.querySelector('.sbc-nao')
      bSim.textContent = sim
      bNao.textContent = nao
      if (perigo) bSim.classList.add('perigo')
      const fim = (v) => {
        document.removeEventListener('keydown', tecla, true)
        f.remove()
        try {
          anterior?.focus?.()
        } catch {}
        resolver(v)
      }
      const tecla = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          fim(false)
        } else if (e.key === 'Tab') {
          e.preventDefault()
          ;(document.activeElement === bSim ? bNao : bSim).focus()
        }
      }
      bSim.onclick = () => fim(true)
      bNao.onclick = () => fim(false)
      f.addEventListener('mousedown', (e) => e.target === f && fim(false))
      document.addEventListener('keydown', tecla, true)
      document.body.appendChild(f)
      ;(perigo ? bNao : bSim).focus() // ação perigosa: o foco começa em Cancelar
    })
  }
})()
