const test = require('node:test')
const assert = require('node:assert')
const C = require('../renderer/cerebro.js')
const { kindDeCotaDeMidia } = require('../agent.js')

test('ferramentas do Hermes caem no grupo certo do cérebro', () => {
  const m = (titulo, tipo) => C.categoriaDe({ titulo, tipo })
  assert.equal(m('Gerar imagem', 'other'), 'midia')
  assert.equal(m('midia_gerar_video', 'other'), 'midia')
  assert.equal(m('Abrir página no navegador', 'other'), 'navegador')
  assert.equal(m('Lembrar da preferência', 'other'), 'memoria')
  assert.equal(m('Buscar na web', 'search'), 'web')
  assert.equal(m('Executar comando', 'execute'), 'terminal')
  assert.equal(m('Ler tabela.csv', 'read'), 'arquivos')
  assert.equal(m('Escrever arquivo', 'edit'), 'arquivos')
  assert.equal(m('delegate_task', 'other'), 'agentes')
  assert.equal(m('qualquer coisa', 'other'), 'agentes')
})

test('o grafo é sempre o mesmo, tem núcleo e o núcleo alcança todos os grupos', () => {
  const g = C.criarGrafo(110)
  const g2 = C.criarGrafo(110)
  assert.deepEqual(g.pts.map((p) => p.cat), g2.pts.map((p) => p.cat))
  assert.equal(g.nucleo.length, 4)
  for (const cat of Object.keys(C.CATS).filter((c) => c !== 'hermes')) {
    const r = C.caminho(g, g.nucleo[0], cat)
    assert.ok(r && r.length >= 2, `sem caminho até ${cat}`)
    assert.equal(g.pts[r[r.length - 1]].cat, cat)
    assert.equal(g.pts[r[0]].cat, 'hermes')
  }
  const pequeno = C.criarGrafo(30)
  for (const cat of Object.keys(C.CATS).filter((c) => c !== 'hermes')) assert.ok(C.caminho(pequeno, pequeno.nucleo[0], cat), `mini sem caminho até ${cat}`)
})

test('detector de cota de mídia esgotada reconhece imagem, vídeo e áudio', () => {
  assert.equal(kindDeCotaDeMidia('Você já usou a cota de imagens do seu plano neste mês (3 de 100). Ela renova em 01/12.'), 'image')
  assert.equal(kindDeCotaDeMidia('Você já usou a cota de vídeos do seu plano neste mês'), 'video')
  assert.equal(kindDeCotaDeMidia('Você já usou a cota de áudios do seu plano neste mês'), 'audio')
  assert.equal(kindDeCotaDeMidia('Estamos com bastante movimento agora.'), null)
})
