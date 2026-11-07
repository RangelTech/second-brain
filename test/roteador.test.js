const test = require('node:test')
const assert = require('node:assert')
const { classificar, deveEscalar, inicioDoLoop } = require('../roteador')

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
