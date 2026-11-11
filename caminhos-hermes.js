// Onde ficam a instalacao do Hermes (raiz) e a pasta de dados dele (home).
// POR QUE: o Windows limita um caminho a 260 caracteres (sem o "caminhos longos" ligado, que e o padrao de fabrica). O Hermes copia arquivos de nome
// enorme para `<pasta>\installs\<id>\environments\<hash>\workspace\plugins\...` (212 caracteres so desse trecho), entao a pasta base so pode ter ~47.
// `C:\Users\<nome>\AppData\Roaming\SegundoCerebro\hermes` tem 50+ para qualquer nome, e a instalacao do agente falhava no meio
// (`[WinError 3]` ao copiar os arquivos) deixando o Hermes sem os pacotes Python: "O agente encerrou".
// REGRA: no Windows instalado, uma instalacao nova usa uma pasta CURTA (C:\SegundoCerebro\<codigo>\h e \d). Quem ja tem o agente funcionando
// (teste-instalacao.ok) continua na pasta antiga, sem mudar nada. A decisao e gravada em caminhos.json e nao muda mais.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const MAX_BASE = 40 // sobra para o trecho de 212 caracteres dentro do limite de 259
let memo = null

function legado(dados) {
  return { raiz: path.join(dados, 'hermes'), home: path.join(dados, 'hermes-home'), modo: 'legado' }
}

function gravavel(pasta) {
  try {
    fs.mkdirSync(pasta, { recursive: true })
    const t = path.join(pasta, '.teste-' + process.pid)
    fs.writeFileSync(t, 'x')
    fs.rmSync(t, { force: true })
    return true
  } catch {
    return false
  }
}

// Instalador com o agente embutido (hermes-runtime/*.7z em resources): o pacote foi montado numa pasta FIXA e o Hermes grava o caminho absoluto do
// ambiente, entao ele so funciona nessa mesma pasta. A raiz vira C:\SegundoCerebro\hermes para todos os usuarios do PC; os dados (home) seguem por usuario.
function embutido() {
  try {
    return process.platform === 'win32' && !!process.resourcesPath && fs.existsSync(path.join(process.resourcesPath, 'hermes-runtime', 'hermes-win32-x64.7z'))
  } catch {
    return false
  }
}
const RAIZ_FIXA = () => process.env.SB_HERMES_RAIZ || 'C:\\SegundoCerebro\\hermes'
const HOME_FIXO = () => process.env.SB_HERMES_HOME_FIXO || 'C:\\SegundoCerebro\\d'
const idDoUsuario = (dados) => crypto.createHash('sha1').update(String(dados).toLowerCase()).digest('hex').slice(0, 6)

function curto(dados) {
  const id = crypto.createHash('sha1').update(String(dados).toLowerCase()).digest('hex').slice(0, 6) // varios usuarios no mesmo PC nao se misturam
  const bases = [process.env.SB_RAIZ_CURTA, 'C:\\SegundoCerebro', process.env.ProgramData && path.join(process.env.ProgramData, 'SC'), process.env.PUBLIC && path.join(process.env.PUBLIC, 'SC')].filter(Boolean)
  for (const b of bases) {
    const raiz = path.join(b, id, 'h')
    if (raiz.length > (+process.env.SB_MAX_BASE || MAX_BASE)) continue
    // instalador completo: agente E ambiente prontos em pastas FIXAS (o ambiente grava caminhos absolutos). O 1º usuário do PC fica com o home fixo;
    // outro usuário do mesmo PC cai no caminho por usuário (ambiente montado pela internet, como antes).
    if (embutido() && b === 'C:\\SegundoCerebro' && gravavel(b)) {
      let dono = ''
      try { dono = fs.readFileSync(path.join(HOME_FIXO(), '.dono'), 'utf8').trim() } catch {}
      if (!dono || dono === id) return { raiz: RAIZ_FIXA(), home: HOME_FIXO(), modo: 'embutido', id }
      if (gravavel(path.join(b, id))) return { raiz: RAIZ_FIXA(), home: path.join(b, id, 'd'), modo: 'embutido-outro-usuario', id }
    }
    if (gravavel(path.join(b, id))) return { raiz, home: path.join(b, id, 'd'), modo: 'curto' }
  }
  return null
}

function decidir(app) {
  const dados = app.getPath('userData')
  if (memo && memo.dados === dados) return memo.r
  let r = legado(dados)
  if (process.platform === 'win32' && app.isPackaged === true && !process.env.SB_CAMINHOS_LEGADO) {
    const arq = path.join(dados, 'caminhos.json')
    let salvo = null
    try {
      salvo = JSON.parse(fs.readFileSync(arq, 'utf8'))
    } catch {}
    if (salvo && salvo.raiz && salvo.home) {
      r = salvo
    } else {
      const funcionando = fs.existsSync(path.join(dados, 'teste-instalacao.ok')) // agente ja testado no caminho antigo: nao mexe
      r = (!funcionando && curto(dados)) || legado(dados)
      try {
        fs.mkdirSync(dados, { recursive: true })
        fs.writeFileSync(arq, JSON.stringify(r))
      } catch {}
    }
  }
  memo = { dados, r }
  return r
}

const raizAgente = (app) => decidir(app).raiz
const homeAgente = (app) => decidir(app).home
const esquecer = () => (memo = null) // so para testes

module.exports = { raizAgente, homeAgente, decidir, esquecer, MAX_BASE, embutido, idDoUsuario, HOME_FIXO }
