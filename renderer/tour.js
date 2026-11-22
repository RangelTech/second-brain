// Tour de boas-vindas (spec 38 A): balões passo a passo apontando para a tela real, com o resto escurecido.
// Abre sozinho uma vez por versão do tour (localStorage) e pelo botão "Ver o tour" (window.SBTour.abrir()).
// Passo cujo elemento não existe ou está escondido (web no celular, menu recolhido) vira balão no centro.
;(() => {
  const VERSAO = 2 // 22/11/2026: tour refeito (voz, Olá cérebro, cortes automáticos, workflows, memória, acesso pelo celular)
  const CHAVE = 'sb.tourVisto'
  const cfg = (aba) => () => window.SBConfig && window.SBConfig.abrir(aba)
  const TODOS = [
    { titulo: 'Bem-vindo ao Cérebro Pro', texto: 'Eu sou seu assistente que lembra de tudo e faz de tudo por você: vídeos, cortes, imagens, voz, sites, atendimento e tarefas no computador. Em um minuto eu te mostro onde fica cada coisa.', icone: '🧠' },
    { alvo: '#texto', titulo: 'É só pedir', texto: 'Escreva aqui o que você precisa, do jeito que falaria com uma pessoa. Eu leio arquivos, pesquiso na internet, mexo no computador e entrego pronto.' },
    { alvo: '#voz-conversa', titulo: 'Converse comigo por voz', texto: 'Clique aqui e fale normalmente: eu respondo falando, como numa ligação. Pode me interromper a qualquer momento. Cotação, clima ou notícia eu pesquiso na hora antes de responder.' },
    { alvo: '#abrir-config', titulo: 'Diga "Olá cérebro"', texto: 'Ligue "Chamar por voz" e é só falar "Olá cérebro" (ou a frase que você escolher) para a conversa por voz abrir sozinha, mesmo com o app minimizado. A frase é reconhecida no seu computador.', acao: { rotulo: 'Ligar agora', fazer: cfg('agente') }, so: 'desktop' },
    { alvo: '#microfone', titulo: 'Ditar em vez de digitar', texto: 'Prefere ditar a mensagem? Clique no microfone, fale e clique de novo: o texto aparece na caixa para você conferir antes de enviar.' },
    { alvo: '#anexar', titulo: 'Mande arquivos', texto: 'Anexe PDF, planilha, foto, áudio ou vídeo. Eu leio, resumo, edito e respondo sobre eles.' },
    { titulo: 'Cortes automáticos', icone: '✂️', texto: 'Cole o link de uma live, podcast ou vídeo do YouTube e peça "faz 3 cortes pra reels". Eu acho os melhores momentos sozinho e entrego os vídeos verticais prontos em poucos minutos: legenda palavra por palavra, título-gancho, barra de progresso e o @ do seu canal, com a legenda do post.' },
    { titulo: 'O que mais eu faço', icone: '✨', lista: ['🎬 Vídeos com IA, animações e vídeos animados com narração', '🖼️ Imagens e edição de fotos', '🎙️ Voz natural, voz clonada e dublagem', '💬 Atendimento automático no WhatsApp e Instagram', '🌐 Sites e páginas de venda prontos para publicar', '📄 Documentos, planilhas e apresentações'] },
    { alvo: '#lista', titulo: 'Veja exemplos prontos', texto: 'Deixei conversas de exemplo aqui na lateral, marcadas como "Exemplo": cortes, vídeo animado, foto editada, voz, WhatsApp e site. Abra para ver como pedir. Pode apagar quando quiser.' },
    { alvo: '#abrir-nav', titulo: 'Navegador integrado', texto: 'Eu uso este navegador para entrar em sites, preencher formulários e cuidar das suas redes sociais com o seu login. Você entra uma vez e eu passo a usar.' },
    { alvo: '#abrir-config', titulo: 'Tarefas que rodam sozinhas', texto: 'Em Configurações > Workflows você agenda tarefas: um relatório toda manhã, um lembrete, vigiar o preço de um produto ou um site. Também dá para pedir na conversa: "todo dia às 8h me manda...".', acao: { rotulo: 'Ver workflows', fazer: cfg('rotinas') } },
    { alvo: '#abrir-config', titulo: 'Eu lembro de você', texto: 'Guardo o que importa (seus gostos, seus clientes, como você trabalha) em Memória, e aprendo jeitos novos de fazer as coisas em Skills. Você vê e edita tudo lá.', acao: { rotulo: 'Ver memória', fazer: cfg('memoria') } },
    { alvo: '#abrir-config', titulo: 'Use pelo celular', texto: 'Em Configurações > Acesso web você liga este computador ao site e passa a me usar pelo celular, com o mesmo login da sua conta. O computador precisa estar ligado com o app aberto.', acao: { rotulo: 'Ligar acesso web', fazer: cfg('acessoweb') }, so: 'desktop' },
    { alvo: '#modelo', titulo: 'Nossa IA Unlimited', texto: 'Já vem com a nossa IA Unlimited, que responde tudo, sem frescura. Use com responsabilidade: confira bem o que você pede e o que ela entrega. Em Configurações > Provedores dá para conectar outras IAs que você assina.' },
    { alvo: '#abrir-conta', titulo: 'Sua conta e créditos', texto: 'Aqui você vê o seu plano e quanto já usou. Imagem, vídeo e voz gastam créditos; se acabar, dá para comprar mais sem trocar de plano.' },
    { titulo: 'Pronto!', icone: '🚀', texto: 'Agora é com você. Me peça qualquer coisa, por texto ou por voz. Para ver este tour de novo: Configurações > Sobre > Ver o tour.' },
  ]
  let PASSOS = TODOS

  let i = 0
  let raiz = null
  const visivel = (el) => {
    if (!el) return false
    const r = el.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) return false
    const cs = getComputedStyle(el)
    return cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

  function montar() {
    raiz = document.createElement('div')
    raiz.className = 'sb-tour'
    raiz.setAttribute('role', 'dialog')
    raiz.setAttribute('aria-modal', 'true')
    raiz.innerHTML = '<div class="sb-tour-furo"></div><div class="sb-tour-balao" tabindex="-1"></div>'
    document.body.appendChild(raiz)
    raiz.addEventListener('click', (e) => {
      const b = e.target.closest('[data-t]')
      if (!b) return
      const t = b.dataset.t
      if (t === 'prox') ir(i + 1)
      else if (t === 'volt') ir(i - 1)
      else if (t === 'pular' || t === 'fim') fechar()
      else if (t === 'acao') {
        const a = PASSOS[i].acao
        fechar()
        try { a && a.fazer() } catch {}
      }
    })
    addEventListener('resize', posicionar)
    addEventListener('keydown', tecla, true)
  }
  function tecla(e) {
    if (!raiz) return
    if (e.key === 'Escape') { e.preventDefault(); fechar() }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); ir(i + 1) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(i - 1) }
  }
  function desenhar() {
    const p = PASSOS[i]
    const balao = raiz.querySelector('.sb-tour-balao')
    const ultimo = i === PASSOS.length - 1
    balao.innerHTML = `
      <div class="sb-tour-topo">${p.icone ? `<span class="sb-tour-ic">${p.icone}</span>` : ''}<b>${esc(p.titulo)}</b><button class="sb-tour-x" data-t="pular" aria-label="Fechar o tour">×</button></div>
      ${p.texto ? `<p>${esc(p.texto)}</p>` : ''}
      ${p.lista ? `<ul>${p.lista.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <div class="sb-tour-pe">
        <span class="sb-tour-pontos">${PASSOS.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</span>
        <span class="sb-tour-bts">
          ${p.acao ? `<button class="sb-tour-sec" data-t="acao">${esc(p.acao.rotulo)}</button>` : ''}
          ${i > 0 ? '<button class="sb-tour-sec" data-t="volt">Voltar</button>' : '<button class="sb-tour-sec" data-t="pular">Pular</button>'}
          <button class="sb-tour-pri" data-t="${ultimo ? 'fim' : 'prox'}">${ultimo ? 'Começar' : 'Próximo'}</button>
        </span>
      </div>`
    posicionar()
    balao.focus({ preventScroll: true })
  }
  function posicionar() {
    if (!raiz) return
    const p = PASSOS[i]
    const furo = raiz.querySelector('.sb-tour-furo')
    const balao = raiz.querySelector('.sb-tour-balao')
    const el = p.alvo ? document.querySelector(p.alvo) : null
    const m = 8
    if (!visivel(el)) {
      furo.style.cssText = `left:50%;top:50%;width:0;height:0`
      balao.classList.add('centro')
      balao.style.left = balao.style.top = ''
      return
    }
    balao.classList.remove('centro')
    const r = el.getBoundingClientRect()
    furo.style.cssText = `left:${r.left - m}px;top:${r.top - m}px;width:${r.width + m * 2}px;height:${r.height + m * 2}px`
    const b = balao.getBoundingClientRect()
    // tenta abaixo, acima, à direita e à esquerda do elemento, nessa ordem
    const opcoes = [
      [r.left + r.width / 2 - b.width / 2, r.bottom + m + 12],
      [r.left + r.width / 2 - b.width / 2, r.top - m - 12 - b.height],
      [r.right + m + 12, r.top + r.height / 2 - b.height / 2],
      [r.left - m - 12 - b.width, r.top + r.height / 2 - b.height / 2],
    ]
    let [x, y] = opcoes.find(([ox, oy]) => oy >= 8 && oy + b.height <= innerHeight - 8 && ox + b.width >= 8 && ox <= innerWidth - 8) || opcoes[1]
    x = Math.max(12, Math.min(x, innerWidth - b.width - 12))
    y = Math.max(12, Math.min(y, innerHeight - b.height - 12))
    balao.style.left = Math.round(x) + 'px'
    balao.style.top = Math.round(y) + 'px'
  }
  function ir(n) {
    if (n < 0) return
    if (n >= PASSOS.length) return fechar()
    i = n
    desenhar()
  }
  function fechar() {
    try { localStorage.setItem(CHAVE, String(VERSAO)) } catch {}
    if (!raiz) return
    removeEventListener('resize', posicionar)
    removeEventListener('keydown', tecla, true)
    raiz.remove()
    raiz = null
    try { document.getElementById('texto').focus() } catch {}
  }
  function abrir() {
    if (raiz) return
    PASSOS = TODOS.filter((p) => !(p.so === 'desktop' && window.__sbWeb))
    i = 0
    montar()
    desenhar()
  }
  function jaViu() {
    try { return +localStorage.getItem(CHAVE) >= VERSAO } catch { return true }
  }
  // abre sozinho quando a tela principal estiver pronta (sem login, sem tela de preparo, sem pop-up aberto)
  function talvezAbrir(tentativas = 0) {
    if (jaViu() || raiz) return
    const bloqueio = ['#login', '#acesso', '.sb-preparando', '.sb-confirmar', '#config:not([hidden])'].some((s) => {
      const el = document.querySelector(s)
      return el && !el.hidden && visivel(el)
    })
    if (bloqueio || !visivel(document.getElementById('texto'))) {
      if (tentativas < 120) setTimeout(() => talvezAbrir(tentativas + 1), 2000)
      return
    }
    abrir()
  }
  window.SBTour = { abrir, fechar, talvezAbrir, PASSOS: TODOS }
})()
