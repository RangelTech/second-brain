// Conversa por voz (spec 52): frases de espera/etapa e as contas de texto do stream
const test = require('node:test')
const assert = require('node:assert/strict')
const F = require('../renderer/voz-frases')
const { paraPcm16k } = require('../renderer/voz-stream')

test('sorteio nunca repete a frase anterior', () => {
  const s = F.sorteador()
  let ant = null
  for (let i = 0; i < 200; i++) {
    const f = s(F.ESPERA)
    assert.ok(F.ESPERA.includes(f))
    assert.notEqual(f, ant)
    ant = f
  }
})

test('etapa por categoria, com reserva para categoria desconhecida', () => {
  const s = F.sorteador(() => 0)
  assert.match(F.fraseDaEtapa('arquivos', s), /arquivos/)
  assert.match(F.fraseDaEtapa('codigo', s), /código|comando/)
  assert.ok(F.ESPERA.includes(F.fraseDaEtapa('categoria-que-nao-existe', s)))
  for (const f of F.todas()) assert.ok(f.length < 60 && /[.!?]$/.test(f), f)
})

test('resto: tira do texto acumulado o que já foi usado', () => {
  assert.equal(F.resto('Oi, tudo bem?', ''), 'Oi, tudo bem?')
  assert.equal(F.resto('Oi, tudo bem? Eu quero', 'Oi, tudo bem?'), 'Eu quero')
  assert.equal(F.resto('Oi, tudo', 'Oi, tudo'), '')
})

test('eco: reconhece a própria fala da IA e não confunde com pedido novo', () => {
  assert.ok(F.ehEco('estou lendo os arquivos', 'Estou lendo os arquivos.'))
  assert.ok(F.ehEco('o vídeo de dez segundos custa', 'Um vídeo de dez segundos custa quatro centavos.'))
  assert.ok(!F.ehEco('não, eu quero outra coisa', 'Estou lendo os arquivos.'))
  assert.ok(!F.ehEco('ei', 'Deixa eu pensar.'))
})

test('soParar: interrupção curta não vira pedido', () => {
  for (const t of ['Para!', 'ei, para', 'Espera aí', 'eu não quero', 'Calma.']) assert.ok(F.soParar(t), t)
  for (const t of ['para de usar vermelho no site', 'quanto custa um vídeo', 'oi, tudo bem?', '']) assert.ok(!F.soParar(t), t)
})

test('paraPcm16k: 48 kHz vira 16 kHz em Int16 com o volume certo', () => {
  const x = new Float32Array(4800).fill(0.5)
  const y = paraPcm16k(x, 48000)
  assert.equal(y.length, 1600)
  assert.ok(Math.abs(y[100] - 0.5 * 0x7fff) < 2)
  const z = paraPcm16k(new Float32Array(441).fill(-1), 44100)
  assert.equal(z.length, 160)
  assert.equal(z[0], -0x8000)
})

test('abertura por intenção: palavra inteira, com acento, na ordem certa', () => {
  const casos = {
    'Pesquisa na internet qual é a cotação do dólar hoje': 'internet',
    'Olha nos meus arquivos o contrato': 'arquivos',
    'O que tem na minha área de trabalho?': 'arquivos',
    'Abre o Instagram da padaria': 'site',
    'Cria uma imagem de um gato': 'midia',
    'Faz um script que renomeia fotos': 'codigo',
    'Me explica como funciona a fotossíntese': 'pensar',
    'Quanto é dois mais dois?': null,
    'oi tudo bem': null,
  }
  for (const [t, esperado] of Object.entries(casos)) assert.equal(F.intencao(t), esperado, t)
  const s = F.sorteador(() => 0)
  assert.match(F.fraseDeAbertura('pesquisa o clima amanhã', s), /internet/)
  assert.equal(F.fraseDeAbertura('oi', s), null)
  for (const i of F.INTENCOES) for (const f of i.frases) assert.ok(F.todas().includes(f), f)
})

test('saudação: período pela hora, primeiro nome do e-mail ou do nome, pergunta sorteada', () => {
  const s = F.sorteador(() => 0)
  assert.equal(F.periodo(5), 'Bom dia')
  assert.equal(F.periodo(11), 'Bom dia')
  assert.equal(F.periodo(12), 'Boa tarde')
  assert.equal(F.periodo(18), 'Boa noite')
  assert.equal(F.periodo(2), 'Boa noite')
  assert.equal(F.primeiroNome('lucas.rangel+light@outlook.com'), 'Lucas')
  assert.equal(F.primeiroNome('Maria Souza'), 'Maria')
  assert.equal(F.primeiroNome(''), '')
  assert.match(F.saudacao(9, 'ana@x.com', s), /^Bom dia, Ana! /)
  assert.match(F.saudacao(20, '', s), /^Boa noite! /)
})

test('comandos de voz: fechar e silenciar, sem confundir com pedido', () => {
  for (const t of ['Fecha o modo de voz', 'pode encerrar a conversa', 'sair do modo voz', 'Desliga a voz', 'tchau', 'Até mais, cérebro']) assert.equal(F.comandoDeVoz(t), 'fechar', t)
  for (const t of ['Silencia o microfone', 'mutar o mic', 'desliga o microfone', 'fecha o microfone']) assert.equal(F.comandoDeVoz(t), 'mudo', t)
  for (const t of ['fecha a janela do navegador', 'me conta sobre a conversa de ontem', 'qual a cotação do dólar', 'desliga o computador às 22h']) assert.equal(F.comandoDeVoz(t), null, t)
})
