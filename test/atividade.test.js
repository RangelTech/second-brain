// Cartão de atividade (Spec 25 §15): categoria da ferramenta, frase, preferência de abrir/fechar e o desenho reagindo aos eventos.
const test = require('node:test')
const assert = require('node:assert/strict')
const A = require('../renderer/atividade.js')

test('cada ferramenta do Hermes acende o ícone certo (19 ícones)', () => {
  const c = (titulo, tipo) => A.categoriaDe({ titulo, tipo })
  assert.equal(c('read_file: C:/a/notas', 'read'), 'arquivos')
  assert.equal(c('read_file: C:/a/tabela.csv', 'read'), 'planilhas')
  assert.equal(c('write_file: relatorio.xlsx', 'edit'), 'planilhas')
  assert.equal(c('read_file: contrato.pdf', 'read'), 'documentos')
  assert.equal(c('skill_view: edicao-de-video', 'other'), 'skills')
  assert.equal(c('skills_list', 'read'), 'skills')
  assert.equal(c('navegador_abrir: https://www.google.com', 'other'), 'navegador')
  assert.equal(c('navegador_abrir: https://instagram.com/natgeo', 'other'), 'redes')
  assert.equal(c('web_search: preço do dólar', 'search'), 'web')
  assert.equal(c('terminal: ls -la', 'execute'), 'terminal')
  assert.equal(c('execute_code', 'execute'), 'codigo')
  assert.equal(c('midia_gerar_imagem', 'other'), 'imagem')
  assert.equal(c('midia_gerar_video', 'other'), 'video')
  assert.equal(c('midia_clonar_voz', 'other'), 'voz')
  assert.equal(c('memoria_buscar', 'other'), 'memoria')
  assert.equal(c('session_search', 'search'), 'pesquisa')
  assert.equal(c('todo', 'other'), 'tarefas')
  assert.equal(c('delegate_task', 'other'), 'agentes')
  assert.equal(c('coisa_desconhecida', 'other'), 'agentes')
  assert.equal(A.ICONES.length, 18 + 0, 'pensar, escrever e 16 ferramentas')
})

test('frase nunca mostra o nome interno do MCP', () => {
  const f = A.fraseDaFerramenta({ titulo: 'mcp__editor_navegador_7860dfd8__navegador_abrir: https://www.google.com' }, () => 'Abrindo o navegador', (t) => String(t).replace(/^[a-z_]+:\s*/i, ''))
  assert.ok(!/mcp__|editor_/.test(f), f)
})

test('a frase de pensamento é curta, em português e sem jargão', () => {
  const rotulo = (f) => (/read/.test(f.titulo) ? 'Lendo arquivo' : 'Trabalhando')
  const limpo = (t) => String(t).replace(/^[a-z_]+:\s*/i, '')
  assert.equal(A.fraseDaFerramenta({ titulo: 'read_file: tabela.csv', tipo: 'read' }, rotulo, limpo), 'Lendo arquivo: tabela.csv')
  assert.equal(A.fraseDaFerramenta({ titulo: 'skill_view: video-curto', tipo: 'other' }, rotulo, limpo), 'Consultando a skill video-curto')
  assert.equal(A.fraseDaFerramenta({ titulo: 'skills_list', tipo: 'other' }, rotulo, (x) => x), 'Consultando as suas skills…')
  assert.equal(A.fraseDoRaciocinio('Primeiro vou ver as skills. Depois abro o arquivo do cliente e monto o resumo.'), 'Depois abro o arquivo do cliente e monto o resumo.')
  assert.equal(A.fraseDoRaciocinio('   '), '')
})

test('aberto por padrao; fechar uma vez grava e vale para todo chat; reabrir limpa', () => {
  const mem = new Map()
  const arm = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) }
  assert.equal(A.aberto(arm), true)
  A.lembrar(false, arm)
  assert.equal(A.aberto(arm), false)
  A.lembrar(true, arm)
  assert.equal(A.aberto(arm), true)
  const quebrado = { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('x') }, removeItem: () => { throw new Error('x') } }
  assert.equal(A.aberto(quebrado), true) // sem armazenamento, abre
  A.lembrar(false, quebrado) // nao levanta erro
})

// tela falsa minima para exercitar o cartao sem navegador
function tela() {
  const chamadas = []
  const ctx = new Proxy({}, { get: (_, k) => (k === 'canvas' ? {} : (...a) => chamadas.push([k, a])), set: () => true })
  const canvas = { getContext: () => ctx, getBoundingClientRect: () => ({ width: 320, height: 150 }), width: 0, height: 0 }
  const frase = { textContent: '', classList: { add() {}, remove() {} } }
  return { canvas, frase, chamadas }
}

test('o cartao liga e desliga a sinapse da categoria e solta particulas', () => {
  const { canvas, frase } = tela()
  const c = A.criarCartao(canvas, frase, { reduzir: true })
  c.tamanho()
  c.evento('web', 'inicio')
  assert.equal(c.ativas().get('web'), 1)
  assert.ok(c.particulas() >= 1)
  c.passo()
  c.evento('web', 'ok')
  assert.equal(c.ativas().get('web'), 0)
  c.evento('categoria_que_nao_existe', 'inicio') // cai em "agentes"
  assert.equal(c.ativas().get('agentes'), 1)
})

test('a frase troca no mesmo lugar e ignora repeticao e vazio', () => {
  const { canvas, frase } = tela()
  const c = A.criarCartao(canvas, frase, { reduzir: true })
  c.pensar('Abrindo a internet…')
  assert.equal(frase.textContent, 'Abrindo a internet…')
  c.pensar('Abrindo a internet…')
  c.pensar('')
  c.pensar('Lendo o arquivo…')
  assert.equal(c.frase(), 'Lendo o arquivo…')
  assert.equal(frase.textContent, 'Lendo o arquivo…')
})
