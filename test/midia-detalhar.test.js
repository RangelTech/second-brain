// Tool de detalhamento (midia_detalhar_prompt) e conferência da troca de personagem: servidor de texto falso, sem rede.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { detalhar, formatarSaida, conferirTroca, formatarConferencia, extrairJson, contar } = require('../midia-detalhar')

const palavras = (n) => Array.from({ length: n }, (_, i) => 'word' + i).join(' ')
const resposta = (obj) => async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: typeof obj === 'string' ? obj : JSON.stringify(obj) } }] }) })

test('imagem: devolve o prompt do modelo com formato, estilo e avisos', async () => {
  const r = await detalhar({ tipo: 'imagem', pedido: 'logo de carros' }, { base: 'x', chave: 'k', fetchFn: resposta({ prompt: palavras(80), negative_prompt: 'blurry', formato: 'quadrado', estilo: 'ilustracao', resumo_pt: 'Um logo.', alertas: ['texto depois'] }) })
  assert.equal(r.origem, 'modelo')
  assert.equal(r.palavras, 80)
  assert.equal(r.formato, 'quadrado')
  assert.equal(r.estilo, 'ilustracao')
  assert.equal(r.segundos, null)
  assert.match(formatarSaida(r), /Use EXATAMENTE este prompt/)
})

test('resposta em bloco de código markdown também é lida', async () => {
  const r = await detalhar({ tipo: 'video', pedido: 'carro' }, { fetchFn: resposta('```json\n' + JSON.stringify({ prompt: palavras(90), negative_prompt: 'x', formato: 'paisagem', segundos: 5, resumo_pt: 'ok', alertas: [] }) + '\n```') })
  assert.equal(r.origem, 'modelo')
  assert.equal(r.segundos, 5)
})

test('prompt curto demais: tenta de novo uma vez com mais palavras e aceita', async () => {
  let n = 0
  const f = async () => { n++; return resposta({ prompt: palavras(n === 1 ? 10 : 90), negative_prompt: 'x', formato: 'paisagem', segundos: 5, resumo_pt: 'ok', alertas: [] })() }
  const r = await detalhar({ tipo: 'video', pedido: 'carro' }, { fetchFn: f })
  assert.equal(n, 2)
  assert.equal(r.origem, 'modelo')
  assert.ok(r.palavras >= 70)
})

test('modelo fora do ar: usa o detalhamento padrão (nunca bloqueia) e avisa', async () => {
  const r = await detalhar({ tipo: 'video', pedido: 'um balão subindo' }, { fetchFn: async () => { throw new Error('rede') } })
  assert.equal(r.origem, 'padrao')
  assert.ok(r.palavras >= r.minimo, `composto com ${r.palavras} palavras, minimo ${r.minimo}`)
  assert.match(r.prompt, /um balão subindo/)
  assert.ok(r.alertas.length >= 1)
  const i = await detalhar({ tipo: 'imagem', pedido: 'um gato' }, { fetchFn: async () => { throw new Error('rede') } })
  assert.ok(i.palavras >= i.minimo)
  const v = await detalhar({ tipo: 'video', pedido: 'ela caminha', tem_imagem_inicial: true }, { fetchFn: async () => { throw new Error('rede') } })
  assert.ok(v.palavras >= v.minimo)
})

test('o formato pedido pelo usuário (ou da imagem inicial) vale mais que o do modelo; segundos pedidos prevalecem', async () => {
  const r = await detalhar({ tipo: 'video', pedido: 'ela caminha', formato: 'retrato', segundos: 3, tem_imagem_inicial: true }, { fetchFn: resposta({ prompt: palavras(50), negative_prompt: '', formato: 'paisagem', segundos: 5, resumo_pt: 'ok', alertas: [] }) })
  assert.equal(r.formato, 'retrato')
  assert.equal(r.segundos, 3)
  assert.equal(r.minimo, 35)
})

test('pedido vazio é recusado com mensagem clara', async () => {
  await assert.rejects(() => detalhar({ tipo: 'imagem', pedido: '  ' }, {}), /pedido/)
})

test('extrairJson e contar', () => {
  assert.deepEqual(extrairJson('lixo {"a":1} lixo'), { a: 1 })
  assert.equal(extrairJson('sem json'), null)
  assert.equal(contar('  a  b c '), 3)
})

test('conferir troca: arquivos ausentes, formato errado e grandes demais bloqueiam', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-troca-'))
  const r0 = conferirTroca({ video: path.join(d, 'nao.mp4'), foto: path.join(d, 'nao.png') })
  assert.equal(r0.ok, false)
  assert.equal(r0.bloqueios.length, 2)
  const v = path.join(d, 'a.avi')
  const f = path.join(d, 'a.png')
  fs.writeFileSync(v, 'x')
  fs.writeFileSync(f, Buffer.alloc(40 * 1024))
  const r1 = conferirTroca({ video: v, foto: f })
  assert.equal(r1.ok, false)
  assert.match(r1.bloqueios.join(' '), /MP4, MOV ou WEBM/)
  const grande = path.join(d, 'g.mp4')
  fs.writeFileSync(grande, Buffer.alloc(41 * 1024 * 1024))
  assert.match(conferirTroca({ video: grande, foto: f }).bloqueios.join(' '), /máximo é 40 MB/)
  const ok = path.join(d, 'ok.mp4')
  fs.writeFileSync(ok, Buffer.alloc(2048))
  const r2 = conferirTroca({ video: ok, foto: f })
  assert.equal(r2.ok, true)
  assert.match(formatarConferencia(r2), /ok para seguir/)
  assert.match(formatarConferencia(r2), /vision_analyze/)
})
