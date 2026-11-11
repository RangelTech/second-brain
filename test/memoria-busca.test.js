const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

// Bug achado no QA de 11/11/2026: "Você lembra do que conversamos sobre a confeitaria? Resuma em uma frase." trazia conversas que só tinham
// "lembra/conversamos/frase" e deixava de fora as conversas da confeitaria. As palavras de "lembrar" não podem pesar na busca.
test('pergunta de lembrar acha o assunto, não as palavras de lembrar', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-mem-'))
  const arq = path.join(dir, 'chats.json')
  const agora = Date.now()
  const chats = [
    { id: 'c1', titulo: 'Plano da confeitaria', atualizado: agora - 9e6, msgs: [{ role: 'user', content: 'Estou abrindo uma confeitaria artesanal em Goiânia, monte um plano', t: agora - 9e6 }, { role: 'assistant', content: 'Plano da confeitaria: equipamentos, precificação com margem de 60% e MEI.', t: agora - 9e6 }] },
    ...[1, 2, 3, 4, 5, 6].map((i) => ({ id: 'x' + i, titulo: 'Você lembra do que conversamos? Resuma em uma frase', atualizado: agora - i * 1e6, msgs: [{ role: 'user', content: 'Você lembra do que conversamos ontem? Resuma em uma frase.', t: agora - i * 1e6 }, { role: 'assistant', content: 'Não lembro, resuma para mim em uma frase o que conversamos.', t: agora - i * 1e6 }] })),
  ]
  fs.writeFileSync(arq, JSON.stringify(chats))
  process.env.SB_MEMORIA_ARQ = arq
  delete require.cache[require.resolve('../mcp-memoria')]
  const m = require('../mcp-memoria')
  const r = m.buscar('Você lembra do que conversamos sobre a confeitaria? Resuma em uma frase.', { limite: 3, incluirAtual: true })
  assert.ok(r.length > 0, 'achou algo')
  assert.strictEqual(r[0].chat, 'c1', 'a conversa da confeitaria vem primeiro')
})
