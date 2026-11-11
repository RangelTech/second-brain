// Agente embutido no instalador do Windows: descompacta na pasta fixa, confere o Hermes e, se algo falhar, apaga e cai no download.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')

function cenario({ comArquivo = true, extrair = 0, versao = 0 } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'embutido-'))
  const recursos = path.join(tmp, 'resources')
  const raiz = path.join(tmp, 'fixa', 'hermes')
  fs.mkdirSync(path.join(recursos, 'hermes-runtime'), { recursive: true })
  if (comArquivo) {
    fs.writeFileSync(path.join(recursos, 'hermes-runtime', 'hermes-win32-x64.7z'), 'x')
    fs.writeFileSync(path.join(recursos, 'hermes-runtime', '7za.exe'), 'x')
  }
  process.env.SB_HERMES_RAIZ = raiz
  const chamadas = []
  const executar = async (exe, args) => {
    chamadas.push([path.basename(exe), ...args])
    if (path.basename(exe) === '7za.exe') {
      if (extrair === 0) {
        fs.mkdirSync(path.join(raiz, 'bin'), { recursive: true })
        fs.writeFileSync(path.join(raiz, 'bin', 'hermes.exe'), 'x')
        fs.writeFileSync(path.join(raiz, 'bin', 'hermes-acp.exe'), 'x')
      }
      return { codigo: extrair, saida: '' }
    }
    return { codigo: versao, saida: 'erro do hermes' }
  }
  const avisos = []
  const app = { getPath: () => path.join(tmp, 'dados') }
  // `localizar` real: o agente existe quando hermes-acp.exe esta na pasta fixa
  const localizar = () => (fs.existsSync(path.join(raiz, 'bin', 'hermes-acp.exe')) ? path.join(raiz, 'bin', 'hermes-acp.exe') : null)
  const inst = require('../hermes-instalar').criar({ app, localizar, recursos: () => recursos, executar })
  return { inst, chamadas, avisos, raiz, tmp }
}

test('com o pacote no instalador: descompacta, confere e nao baixa nada', async () => {
  const { inst, chamadas, raiz } = cenario()
  await inst.garantir(() => {})
  assert.deepEqual(chamadas.map((c) => c[0]), ['7za.exe', 'hermes.exe'])
  assert.ok(chamadas[0].some((a) => a === '-o' + raiz), 'descompacta na pasta fixa')
  assert.deepEqual(chamadas[1].slice(1), ['--version'])
  assert.ok(fs.existsSync(path.join(raiz, 'bin', 'hermes.exe')))
})

test('sem ambiente pronto, --version falhar e esperado: o agente embutido fica e NAO baixa tudo de novo', async () => {
  // antes: --version rodava antes do ambiente estar no lugar, sempre falhava, o app apagava o agente embutido e baixava tudo (CI 0.6.62: +6 min)
  const { inst, raiz, chamadas } = cenario({ versao: 1 })
  const orig = global.fetch
  let baixou = false
  global.fetch = async () => {
    baixou = true
    throw new Error('sem rede')
  }
  try {
    await inst.garantir(() => {})
  } finally {
    global.fetch = orig
  }
  assert.equal(baixou, false, 'nao foi buscar o instalador na internet')
  assert.ok(fs.existsSync(path.join(raiz, 'bin', 'hermes.exe')), 'o agente embutido continua na pasta')
  assert.deepEqual(chamadas.map((c) => c[0]), ['7za.exe', 'hermes.exe'])
})

test('sem pacote embutido: nao tenta descompactar (segue o download de sempre)', async () => {
  const { inst, chamadas } = cenario({ comArquivo: false })
  const orig = global.fetch
  global.fetch = async () => {
    throw new Error('sem rede')
  }
  try {
    await assert.rejects(() => inst.garantir(() => {}), /instalador do agente/)
  } finally {
    global.fetch = orig
  }
  assert.equal(chamadas.length, 0)
})
