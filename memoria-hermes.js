// Memória do agente (Hermes): MEMORY.md (fatos do ambiente e do trabalho) e USER.md (quem é o usuário e como prefere). Entradas separadas por "\n§\n".
const fs = require('fs')
const path = require('path')

const DELIM = '\n§\n'
const ARQ = { agente: 'MEMORY.md', usuario: 'USER.md' }
const LIMITE = { agente: 2200, usuario: 1375 }

const pasta = (home) => path.join(home, 'memories')
function ler(home, quem) {
  try {
    const t = fs.readFileSync(path.join(pasta(home), ARQ[quem]), 'utf8')
    return t.split(DELIM).map((x) => x.trim()).filter(Boolean)
  } catch { return [] }
}
function gravar(home, quem, entradas) {
  if (!ARQ[quem]) throw new Error('Lista desconhecida.')
  const limpas = entradas.map((x) => String(x).replace(/\r/g, '').trim()).filter(Boolean)
  const texto = limpas.join(DELIM)
  if (texto.length > LIMITE[quem]) throw new Error(`Passou do limite (${texto.length} de ${LIMITE[quem]} caracteres). Apague alguma entrada.`)
  fs.mkdirSync(pasta(home), { recursive: true })
  fs.writeFileSync(path.join(pasta(home), ARQ[quem]), texto)
  return limpas
}
const estado = (home) => ({ agente: { entradas: ler(home, 'agente'), limite: LIMITE.agente }, usuario: { entradas: ler(home, 'usuario'), limite: LIMITE.usuario } })

module.exports = { ler, gravar, estado, DELIM, LIMITE }
