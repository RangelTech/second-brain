const test = require('node:test')
const assert = require('node:assert')
const { classificar } = require('../roteador')

test('conversa e conhecimento geral vão pelo caminho rápido', () => {
  for (const t of ['Qual a capital da Austrália?', 'Explique o que é TCP em 3 linhas', 'Traduza "bom dia" para o inglês', 'Você lembra do que combinamos ontem?', 'Escreva um poema curto sobre o mar'])
    assert.strictEqual(classificar(t, []), 'rapido', t)
})
test('arquivo, caminho, URL, web e anexo vão para o agente', () => {
  for (const t of ['Abra o arquivo C:/Users/x/a.txt', 'Resuma https://exemplo.com/a', 'Pesquise na web as notícias de hoje', 'Crie um arquivo com a lista', 'Gere uma imagem de um farol', 'Rode o comando npm test', 'liste os arquivos da pasta'])
    assert.strictEqual(classificar(t, []), 'agente', t)
  assert.strictEqual(classificar('Resuma isto', ['x.pdf']), 'agente')
})
