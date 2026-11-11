const test = require('node:test')
const assert = require('node:assert')
const { classificar, deveEscalar, inicioDoLoop, afirmaArquivo } = require('../roteador')

test('conversa e conhecimento geral vão pelo caminho rápido', () => {
  for (const t of ['Qual a capital da Austrália?', 'Explique o que é TCP em 3 linhas', 'Traduza "bom dia" para o inglês', 'Você lembra do que combinamos ontem?', 'Escreva um poema curto sobre o mar'])
    assert.strictEqual(classificar(t, []), 'rapido', t)
})
test('arquivo, caminho, URL, web e anexo vão para o agente', () => {
  for (const t of ['Abra o arquivo C:/Users/x/a.txt', 'Resuma https://exemplo.com/a', 'Pesquise na web as notícias de hoje', 'Crie um arquivo com a lista', 'Gere uma imagem de um farol', 'Rode o comando npm test', 'liste os arquivos da pasta'])
    assert.strictEqual(classificar(t, []), 'agente', t)
  assert.strictEqual(classificar('Resuma isto', ['x.pdf']), 'agente')
})
test('escala so quando ainda nao ha resposta de verdade', () => {
  assert.strictEqual(deveEscalar(''), true)
  assert.strictEqual(deveEscalar('Vou criar o arquivo agora.'), true)
  assert.strictEqual(deveEscalar('A capital da Austrália é Camberra, escolhida como compromisso político entre Sydney e Melbourne após disputas regionais. Sydney continuou como a maior cidade, mas o governo foi centralizado num lugar neutro.'), false)
})
test('detecta loop de palavra repetida e corta no inicio, mantendo uma ocorrência', () => {
  const base = 'A capital é Canberra. Esse trecho é normal e termina aqui. Depois o modelo entrou em loop: '
  const texto = base + 'intransponível '.repeat(12)
  const ini = inicioDoLoop(texto)
  assert.ok(ini > 0)
  assert.strictEqual(texto.slice(0, ini).trim().endsWith('intransponível'), true)
  assert.ok(texto.slice(0, ini).length < base.length + 40)
  assert.strictEqual(inicioDoLoop('texto normal sem repetição nenhuma, só prosa comum e variada para ver que não dispara.'), -1)
  assert.strictEqual(inicioDoLoop('sim sim sim'), -1) // repetição curta e legítima não é loop
})
test('pedidos de produção e de sistema vão para o agente (nada de inventar resultado)', () => {
  for (const t of ['Agora anime essa imagem em um vídeo de 5 segundos', 'Anime isso', 'Faça um vídeo do carro', 'Suba um Metabase num Docker na porta 3010', 'Construa um site de portfólio', 'Monte uma planilha com os gastos', 'Transforme esse texto em PDF', 'Crie um logo para minha loja'])
    assert.strictEqual(classificar(t, []), 'agente', t)
  for (const t of ['Qual a capital do Peru?', 'Como funciona um servidor DNS?', 'Me dá uma receita de bolo de cenoura', 'Explique o que é um container em 2 linhas', 'oi, bom dia, tudo bem?'])
    assert.strictEqual(classificar(t, []), 'rapido', t)
})
test('detecta resposta que inventa arquivo criado', () => {
  assert.strictEqual(afirmaArquivo('Vídeo pronto! Animei a cena. Arquivo: carro-video-20261107.mp4'), true)
  assert.strictEqual(afirmaArquivo('Salvei em C:/Users/x/relatorio.pdf'), true)
  assert.strictEqual(afirmaArquivo('A capital do Peru é Lima. O arquivo mp4 é um formato de vídeo comum.'), false)
  assert.strictEqual(afirmaArquivo('Pronto! A resposta é 42.'), false)
})
test('continuação automática e resposta curta dentro de chat com agente vão para o agente', () => {
  assert.strictEqual(classificar('Continue exatamente de onde parou.', []), 'agente')
  for (const t of ['sim', 'pode fazer', 'ok, manda ver', 'Pode seguir.']) assert.strictEqual(classificar(t, []), 'agente', t)
  assert.strictEqual(classificar('faz o segundo então', [], { emAgente: true }), 'agente')
  // pergunta curta de conhecimento continua rápida mesmo com agente vivo; e mensagem curta sem agente vivo também
  assert.strictEqual(classificar('Qual a capital do Peru?', [], { emAgente: true }), 'rapido')
  assert.strictEqual(classificar('bom dia', []), 'rapido')
})

test('atualidade (noticia, cotacao, jogo de ontem, tempo) vai sempre ao agente, que pesquisa na web; conhecimento fixo continua rapido', () => {
  for (const t of ['Quais as principais noticias de hoje no Brasil?', 'Quanto esta o dolar hoje?', 'Quem ganhou o jogo do Flamengo ontem?', 'Qual a previsao do tempo em Goiania?', 'Como esta o tempo hoje?'])
    assert.strictEqual(classificar(t, []), 'agente', t)
  for (const t of ['Qual e a capital da Australia?', 'Quem descobriu o Brasil?', 'Voce lembra o que combinamos ontem?', 'Quanto e 15% de 240?'])
    assert.strictEqual(classificar(t, []), 'rapido', t)
})
test('chat com agente vivo: pergunta completa (com ?) no meio do texto continua no caminho rapido', () => {
  assert.strictEqual(classificar('Qual e a capital da Australia? Responda em uma frase.', [], { emAgente: true }), 'rapido')
  assert.strictEqual(classificar('agora salva isso', [], { emAgente: true }), 'agente')
})

test('separador de tabela markdown nao e loop (nao corta a resposta no cabecalho da tabela)', () => {

  assert.strictEqual(inicioDoLoop('| Item |\n|--------------------'), -1)
  assert.strictEqual(inicioDoLoop('|---|---|---|---|---|---|'), -1)
  assert.strictEqual(inicioDoLoop('texto\n========================'), -1)
  // loop de verdade continua sendo cortado
  assert.ok(inicioDoLoop('resposta ' + 'banana '.repeat(12)) >= 0)
})
