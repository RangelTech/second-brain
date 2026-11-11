// Onde cada ferramenta do navegador roda: app instalado = navegador integrado (Chrome do usuário só se ele pedir); web/VM = sempre a extensão.
const test = require('node:test')
const assert = require('node:assert')
const os = require('os')
const path = require('path')
const fs = require('fs')
const { criar } = require('../navegador.js')

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'nav-onde-'))
const app = { getPath: () => pasta }
function montar({ modoServidor = false, resposta, estado = { conectado: true, pausada: false, nome: 'Chrome no Windows', acessoWeb: true } } = {}) {
  const chamadas = []
  const extensao = { executar: async (acao, args, ms) => (chamadas.push({ acao, args, ms }), typeof resposta === 'function' ? resposta(acao, args) : resposta), estado: () => estado, disponivel: () => estado.conectado && !estado.pausada }
  const nav = criar({ app, janela: () => null, avisar: () => {}, pedirPainel: () => {}, extensao: () => extensao, modoServidor })
  return { nav, chamadas }
}

test('na web (modo servidor) tudo vai para a extensão por padrão', async () => {
  const { nav, chamadas } = montar({ modoServidor: true, resposta: { ok: true, dado: { texto: 'Aberto: Exemplo' } } })
  const r = await nav.atender('abrir', { url: 'example.com' })
  assert.strictEqual(r.texto, 'Aberto: Exemplo')
  assert.deepStrictEqual([chamadas[0].acao, chamadas[0].args.url], ['abrir', 'https://example.com']) // o endereço é resolvido antes de ir ao Chrome
  assert.ok(!('onde' in chamadas[0].args))
})

test('no app instalado o padrão NÃO usa a extensão (é o navegador integrado)', async () => {
  const { nav, chamadas } = montar({ modoServidor: false, resposta: { ok: true, dado: { texto: 'x' } } })
  // sem vista nativa em Node a ferramenta integrada falha, mas o que importa: a extensão não foi chamada
  await assert.rejects(nav.atender('ler', {}))
  assert.strictEqual(chamadas.length, 0)
})

test('no app instalado, onde="chrome" usa a extensão', async () => {
  const { nav, chamadas } = montar({ modoServidor: false, resposta: { ok: true, dado: { texto: 'lido no Chrome' } } })
  assert.strictEqual((await nav.atender('ler', { onde: 'chrome' })).texto, 'lido no Chrome')
  assert.strictEqual(chamadas.length, 1)
})

test('print da extensão salva o PNG e devolve o caminho para o vision_analyze', async () => {
  const png = Buffer.from('89504e470d0a1a0a0000', 'hex').toString('base64')
  const { nav } = montar({ modoServidor: true, resposta: { ok: true, dado: { texto: 'Captura', imagem: png, largura: 1000, altura: 700 } } })
  const r = await nav.atender('print', {})
  assert.match(r.texto, /Captura salva em .*captura-\d+\.png \(1000x700\)/)
  assert.ok(fs.existsSync(r.arquivo) && fs.readFileSync(r.arquivo).slice(1, 4).toString() === 'PNG')
})

test('sem Chrome conectado a mensagem manda o link da extensão (e não troca de navegador sozinha)', async () => {
  for (const codigo of ['sem_extensao', 'pausado', 'timeout', 'desconectada']) {
    const { nav } = montar({ modoServidor: true, resposta: { ok: false, codigo, erro: 'x' } })
    await assert.rejects(nav.atender('abrir', { url: 'https://a.com' }), /brain\.rangeltech\.net\/extensao.*onde="integrado"/s)
  }
})

test('erro da própria ferramenta (elemento sumiu) vem como erro normal, sem mandar instalar nada', async () => {
  const { nav } = montar({ modoServidor: true, resposta: { ok: false, erro: 'Elemento 3 não existe mais.' } })
  await assert.rejects(nav.atender('clicar', { id: 3 }), (e) => /Elemento 3 não existe mais/.test(e.message) && !/extensao/.test(e.message))
})

test('esperar é sempre local e chrome_estado informa o estado', async () => {
  const { nav, chamadas } = montar({ modoServidor: true, resposta: { ok: true, dado: {} } })
  assert.match((await nav.atender('esperar', { ms: 10 })).texto, /Esperei/)
  const e = JSON.parse((await nav.atender('chrome_estado', {})).texto)
  assert.deepStrictEqual([e.chrome_conectado, e.pausado, e.onde_padrao, e.acesso_web_ligado], [true, false, 'chrome', true])
  assert.match(e.link_extensao, /brain\.rangeltech\.net\/extensao/)
  assert.strictEqual(chamadas.length, 0)
})
