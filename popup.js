const $ = (i) => document.getElementById(i)
const falar = (m) => chrome.runtime.sendMessage(m)

async function pintar() {
  const e = await falar({ t: 'estado' })
  if (!e) return
  $('versao').textContent = 'Versão ' + e.versao
  const botoes = { entrar: false, pausar: false, desconectar: false }
  let ponto = '', titulo = '', texto = ''
  if (!e.pareada) {
    titulo = 'Não conectado'
    texto = e.erro || 'Entre na sua conta pelo site. Ao entrar, esta extensão fica conectada sozinha, sem senha aqui.'
    botoes.entrar = true
  } else if (e.pausada) {
    ponto = 'pausa'; titulo = 'Pausada'; texto = 'O Segundo Cérebro não pode usar o seu Chrome enquanto estiver pausada.'
    botoes.pausar = true; botoes.desconectar = true
  } else if (e.agindo) {
    ponto = 'age'; titulo = 'Trabalhando no seu Chrome'; texto = 'O Segundo Cérebro está usando uma aba do grupo "Segundo Cérebro". Pause se quiser assumir.'
    botoes.pausar = true; botoes.desconectar = true
  } else if (e.conectado) {
    ponto = 'ok'; titulo = 'Conectado'; texto = 'O Segundo Cérebro pode usar este Chrome quando você pedir, com as suas contas abertas.'
    botoes.pausar = true; botoes.desconectar = true
  } else {
    titulo = 'Conectando…'; texto = 'Tentando falar com o Segundo Cérebro.'
    botoes.desconectar = true
  }
  $('ponto').className = 'ponto ' + ponto
  $('titulo').textContent = titulo
  $('texto').textContent = texto
  $('pausar').textContent = e.pausada ? 'Continuar' : 'Pausar'
  for (const [k, v] of Object.entries(botoes)) $(k).hidden = !v
  $('entrar').dataset.base = e.base
}
$('entrar').onclick = async () => {
  await falar({ t: 'religar' })
  const base = $('entrar').dataset.base || 'https://remoto.rangeltech.net'
  chrome.tabs.create({ url: base + '/?extensao=1' })
  window.close()
}
$('pausar').onclick = async () => { const e = await falar({ t: 'estado' }); await falar({ t: 'pausar', valor: !e.pausada }); pintar() }
$('desconectar').onclick = async () => { await falar({ t: 'desconectar' }); pintar() }
pintar()
setInterval(pintar, 2000)
