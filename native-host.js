// Host de mensageria nativa da extensão do Chrome (net.rangeltech.segundocerebro). O Chrome inicia este processo quando a extensão pede
// (chrome.runtime.connectNative); ele fala por stdin/stdout (4 bytes de tamanho + JSON) e repassa o pedido ao app aberto no mesmo
// computador, por um servidor só local (porta e token em extensao-host.json, na pasta de dados do app). O app devolve um token de
// pareamento de uso único; assim a extensão entra na conta sozinha, sem a pessoa digitar nada.
// Roda com o Node do Electron (ELECTRON_RUN_AS_NODE=1); não tem dependências.
const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')

function pastaDados() {
  if (process.env.SB_DADOS) return process.env.SB_DADOS
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Segundo Cérebro')
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'Segundo Cérebro')
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'Segundo Cérebro')
}

function lerControle(arquivo) {
  try {
    const j = JSON.parse(fs.readFileSync(arquivo, 'utf8'))
    return j && j.porta && j.token ? j : null
  } catch {
    return null
  }
}

function pedirPareamento(controle) {
  return new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port: controle.porta, path: '/extensao/parear', method: 'POST', headers: { Authorization: 'Bearer ' + controle.token }, timeout: 15000 }, (res) => {
      let t = ''
      res.on('data', (d) => (t += d))
      res.on('end', () => {
        try {
          const j = JSON.parse(t)
          resolve(res.statusCode === 200 && j.token ? { token: j.token, base: j.base } : { erro: j.erro || 'O app não aceitou o pedido.', codigo: j.codigo || 'recusado' })
        } catch {
          resolve({ erro: 'Resposta inválida do app.', codigo: 'invalida' })
        }
      })
    })
    req.on('error', () => resolve({ erro: 'O Segundo Cérebro não está aberto neste computador.', codigo: 'app_fechado' }))
    req.on('timeout', () => { req.destroy(); resolve({ erro: 'O app demorou a responder.', codigo: 'timeout' }) })
    req.end()
  })
}

function enviar(o) {
  const corpo = Buffer.from(JSON.stringify(o))
  const cab = Buffer.alloc(4)
  cab.writeUInt32LE(corpo.length, 0)
  process.stdout.write(Buffer.concat([cab, corpo]))
}

// lê UMA mensagem do protocolo de mensageria nativa
function lerMensagem(entrada) {
  return new Promise((resolve) => {
    let buf = Buffer.alloc(0)
    const onDados = (d) => {
      buf = Buffer.concat([buf, d])
      if (buf.length >= 4) {
        const n = buf.readUInt32LE(0)
        if (n > 1024 * 1024) return resolve(null)
        if (buf.length >= 4 + n) {
          entrada.off('data', onDados)
          try { resolve(JSON.parse(buf.slice(4, 4 + n).toString())) } catch { resolve(null) }
        }
      }
    }
    entrada.on('data', onDados)
    entrada.on('end', () => resolve(null))
  })
}

async function principal() {
  const m = await lerMensagem(process.stdin)
  if (!m || m.t !== 'parear') return enviar({ t: 'erro', erro: 'Mensagem inválida.' }), process.exit(0)
  const controle = lerControle(path.join(pastaDados(), 'extensao-host.json'))
  if (!controle) return enviar({ t: 'erro', codigo: 'app_fechado', erro: 'O Segundo Cérebro não está aberto neste computador.' }), process.exit(0)
  const r = await pedirPareamento(controle)
  enviar(r.token ? { t: 'parear', token: r.token, base: r.base } : { t: 'erro', codigo: r.codigo, erro: r.erro })
  process.exit(0)
}

if (require.main === module) principal()
module.exports = { lerControle, pedirPareamento, pastaDados }
