// Controle de contexto do Hermes e mensagem no meio do trabalho (spec 48)
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { COMPRIMIR_EM, PODAR_EM, CONTEXTO_REAL, contextoDeSistema, embrulharDirecionamento, prepararHome } = require('../agent')

test('config.yaml: revisão em segundo plano desligada, visão no mesmo bloco auxiliary, poda e compressão escritas', () => {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'sbh-'))
  const app = { getPath: () => t, getAppPath: () => process.cwd(), isPackaged: false, getVersion: () => '0' }
  for (const visao of [null, { base: 'http://x/v1', modelo: 'visao', chave: 'k' }]) {
    const y = fs.readFileSync(path.join(prepararHome(app, { base: 'http://127.0.0.1:1/v1', pasta: t, visao }), 'config.yaml'), 'utf8')
    assert.strictEqual((y.match(/^auxiliary:/gm) || []).length, 1, 'um bloco auxiliary só (chave repetida no YAML some com a primeira)')
    assert.match(y, /^ {2}background_review:\n {4}enabled: false$/m)
    assert.strictEqual(/^ {2}vision:/m.test(y), !!visao)
    assert.match(y, new RegExp(`proactive_prune_tokens: ${PODAR_EM}`))
    assert.match(y, new RegExp(`threshold_tokens: ${COMPRIMIR_EM}`))
  }
})

test('a poda barata acontece antes da compressão e tudo cabe na janela real', () => {
  // o Hermes comprime em 75% de janelas < 512 mil; threshold_tokens só baixa esse ponto
  const gatilhoHermes = Math.floor(CONTEXTO_REAL * 0.75)
  assert.ok(COMPRIMIR_EM <= gatilhoHermes, `compressão em ${COMPRIMIR_EM} passa do gatilho real ${gatilhoHermes}`)
  assert.ok(PODAR_EM < COMPRIMIR_EM, 'poda precisa vir antes da compressão, senão nunca roda')
  assert.ok(PODAR_EM >= 48000, 'poda cedo demais quebra o cache do servidor a toda hora')
})

test('o prompt manda gravar e ler o arquivo de progresso e não largar a tarefa por pergunta de andamento', () => {
  const p = contextoDeSistema({ pasta: 'C:/x' })
  assert.match(p, /MEMÓRIA DE TRABALHO/)
  assert.match(p, /\.progresso/)
  assert.match(p, /CONTEXT COMPACTION/)
  assert.match(p, /MENSAGEM NO MEIO DO TRABALHO/)
  // as regras novas ficam no prefixo fixo (antes da parte variável), para o cache do servidor continuar valendo
  assert.ok(p.indexOf('MEMÓRIA DE TRABALHO') < p.indexOf('Pasta de trabalho: C:/x'))
})

test('mensagem no meio do trabalho chega embrulhada com a ordem de continuar', () => {
  const t = embrulharDirecionamento('  e ai terminou?  ')
  assert.match(t, /enviada enquanto você trabalhava/)
  assert.match(t, /\ne ai terminou\?\n/)
  assert.match(t, /CONTINUE a tarefa/)
  assert.strictEqual(embrulharDirecionamento('   '), '')
})
