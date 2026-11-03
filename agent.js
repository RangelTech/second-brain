// Agente de verdade: cliente ACP (Agent Client Protocol) falando com o Hermes por stdio.
// Um processo por conversa, com sessão contínua, cancelamento e permissões mostradas na tela.
const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const OCIOSO_MS = 10 * 60 * 1000

function localizarBinario(app) {
  const candidatos = [
    process.env.SECOND_BRAIN_HERMES_BIN,
    path.join(app.getPath('userData'), 'hermes', 'bin', process.platform === 'win32' ? 'hermes-acp.exe' : 'hermes-acp'),
    path.join(os.homedir(), 'hermes', 'bin', process.platform === 'win32' ? 'hermes-acp.exe' : 'hermes-acp'),
    path.join(os.homedir(), '.local', 'bin', 'hermes-acp'),
  ].filter(Boolean)
  return candidatos.find((c) => fs.existsSync(c)) || null
}

// HERMES_HOME próprio do app. Na primeira vez traz skills, memória e SOUL.md da instalação do piloto;
// a cada início atualiza as skills globais da Rangel Tech (somente leitura) dentro de skills/rangeltech.
function prepararBase(app) {
  const home = path.join(app.getPath('userData'), 'hermes-home')
  fs.mkdirSync(path.join(home, 'skills'), { recursive: true })
  const piloto = path.join(os.homedir(), 'hermes')
  const marca = path.join(home, '.migrado')
  if (!fs.existsSync(marca) && fs.existsSync(piloto)) {
    for (const item of ['skills', 'memories', 'SOUL.md']) {
      try {
        if (fs.existsSync(path.join(piloto, item))) fs.cpSync(path.join(piloto, item), path.join(home, item), { recursive: true, force: false })
      } catch {}
    }
    fs.writeFileSync(marca, new Date().toISOString())
  }
  const globais = [path.join(process.resourcesPath || '', 'skills-globais', 'rangeltech'), path.join(__dirname, 'skills-globais', 'rangeltech')].find((p) => fs.existsSync(p))
  if (globais) {
    try {
      fs.cpSync(globais, path.join(home, 'skills', 'rangeltech'), { recursive: true, force: true })
    } catch {}
  }
  return home
}

function prepararHome(app, { base, modelo, pasta, raciocinio }) {
  const home = prepararBase(app)
  // a configuração é escrita pelo app, nunca à mão: o modelo é o combo do motor local
  const yaml = [
    'model:',
    `  default: ${JSON.stringify(modelo || 'principal')}`,
    '  provider: "custom"',
    `  base_url: ${JSON.stringify(base)}`,
    '  api_key: ${SB_LOCAL_KEY}',
    'agent:',
    `  reasoning_effort: ${JSON.stringify(raciocinio || 'low')}`,
    'terminal:',
    '  backend: "local"',
    `  cwd: ${JSON.stringify(pasta.replace(/\\/g, '/'))}`,
    '  timeout: 180',
    'attachments:',
    '  storage: "hermes-home"',
    '',
  ].join('\n')
  fs.writeFileSync(path.join(home, 'config.yaml'), yaml)
  return home
}

function contextoDeSistema({ pasta, ferramentas }) {
  const agora = new Date()
  return [
    'Você é o Second Brain, o agente do aplicativo de desktop da Rangel Tech. Responda em português do Brasil, de forma direta.',
    `Sistema operacional: ${os.type()} ${os.release()} (${process.platform}). Usuário: ${os.userInfo().username}. Pasta pessoal: ${os.homedir()}.`,
    `Pasta de trabalho: ${pasta}. Crie e edite arquivos nela, a menos que o usuário peça outra pasta.`,
    `Data e hora: ${agora.toLocaleString('pt-BR')}.`,
    'Você tem ferramentas reais: leia e escreva arquivos (inclusive extrair texto de PDF, Word e planilha), liste pastas, rode comandos, busque na web e abra arquivos. USE as ferramentas em vez de dizer que não consegue acessar a máquina do usuário.',
    'Antes de apagar arquivos, escrever fora da pasta de trabalho ou rodar comandos perigosos, peça confirmação. Quando criar um arquivo, diga o caminho completo.',
    ferramentas ? `Skills e ferramentas: ${ferramentas}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function registrar(app, linha) {
  try {
    const dir = path.join(app.getPath('userData'), 'logs')
    fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(path.join(dir, 'agente.log'), new Date().toISOString() + ' ' + linha + '\n')
  } catch {}
}

class Sessao {
  constructor({ app, id, pasta, base, modelo, chave, raciocinio, emitir, pedirPermissao }) {
    this.app = app
    this.id = id
    this.pasta = pasta
    this.emitir = emitir
    this.pedirPermissao = pedirPermissao
    this.permitirSempre = false
    this.pendentes = new Map()
    this.proxId = 1
    this.buf = ''
    this.sid = null
    this.primeira = true
    this.turno = null
    this.ocioso = null
    const bin = localizarBinario(app)
    if (!bin) throw new Error('Não encontrei o Hermes (hermes-acp). Instale o Hermes ou defina SECOND_BRAIN_HERMES_BIN.')
    const home = prepararHome(app, { base, modelo, pasta, raciocinio })
    if (!fs.existsSync(path.join(home, 'installs'))) emitir({ aviso: 'Preparando o agente pela primeira vez. Isso leva alguns minutos e acontece uma vez só…' })
    this.filho = spawn(bin, [], { cwd: pasta, env: { ...process.env, HERMES_HOME: home, SB_LOCAL_KEY: chave, PYTHONUTF8: '1' }, windowsHide: true })
    this.filho.stdout.on('data', (d) => this.aoDados(d))
    this.filho.stderr.on('data', (d) => registrar(this.app, 'stderr ' + d.toString('utf8').trim().slice(0, 300)))
    this.filho.on('exit', () => {
      for (const p of this.pendentes.values()) p.rej(new Error('O agente encerrou.'))
      this.pendentes.clear()
      this.morto = true
    })
    this.pronta = this.iniciar()
  }

  enviar(o) {
    registrar(this.app, '> ' + JSON.stringify(o).slice(0, 300))
    this.filho.stdin.write(JSON.stringify(o) + '\n')
  }
  chamar(method, params) {
    const id = this.proxId++
    return new Promise((res, rej) => {
      this.pendentes.set(id, { res, rej })
      this.enviar({ jsonrpc: '2.0', id, method, params })
    })
  }
  aoDados(d) {
    this.buf += d.toString('utf8')
    let i
    while ((i = this.buf.indexOf('\n')) >= 0) {
      const l = this.buf.slice(0, i).trim()
      this.buf = this.buf.slice(i + 1)
      if (!l) continue
      let j
      try {
        j = JSON.parse(l)
      } catch {
        continue
      }
      registrar(this.app, '< ' + l.slice(0, 300))
      this.tratar(j)
    }
  }
  async tratar(j) {
    if (j.id !== undefined && !j.method) {
      const p = this.pendentes.get(j.id)
      if (!p) return
      this.pendentes.delete(j.id)
      return j.error ? p.rej(new Error(j.error.data?.details || j.error.message)) : p.res(j.result)
    }
    if (j.method === 'session/update') return this.aoAtualizacao(j.params?.update || {})
    if (j.method === 'session/request_permission') {
      const op = j.params.options || []
      const escolha = async () => {
        const permitir = op.find((o) => o.kind === 'allow_always') || op.find((o) => o.kind === 'allow_once') || op[0]
        if (this.permitirSempre) return permitir.optionId
        const r = await this.pedirPermissao({ chat: this.id, titulo: j.params.toolCall?.title || 'Ação do agente', tipo: j.params.toolCall?.kind, opcoes: op })
        if (r === 'sempre') {
          this.permitirSempre = true
          return permitir.optionId
        }
        if (r === 'permitir') return (op.find((o) => o.kind === 'allow_once') || permitir).optionId
        return (op.find((o) => o.kind === 'reject_once') || op.find((o) => /reject/.test(o.kind)) || op[op.length - 1]).optionId
      }
      const optionId = await escolha()
      return this.enviar({ jsonrpc: '2.0', id: j.id, result: { outcome: { outcome: 'selected', optionId } } })
    }
    // pedidos do agente que o app não implementa: resposta vazia de erro para não travar
    if (j.id !== undefined && j.method) this.enviar({ jsonrpc: '2.0', id: j.id, error: { code: -32601, message: 'não suportado' } })
  }
  aoAtualizacao(u) {
    const tipo = u.sessionUpdate
    if (tipo === 'agent_message_chunk' && u.content?.text) this.emitir({ texto: u.content.text })
    else if (tipo === 'agent_thought_chunk' && u.content?.text) this.emitir({ raciocinio: u.content.text })
    else if (tipo === 'tool_call' || tipo === 'tool_call_update') {
      const conteudo = (u.content || [])
        .map((c) => c.content?.text || c.text || (c.type === 'diff' ? `${c.path}\n${c.newText || ''}` : ''))
        .filter(Boolean)
        .join('\n')
      this.emitir({
        ferramenta: {
          id: u.toolCallId,
          titulo: u.title,
          tipo: u.kind,
          status: u.status,
          conteudo: conteudo.slice(0, 4000),
          caminho: u.locations?.[0]?.path || null,
          entrada: u.rawInput ? JSON.stringify(u.rawInput).slice(0, 600) : null,
        },
      })
    }
  }
  async iniciar() {
    await this.chamar('initialize', { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } } })
    const r = await this.chamar('session/new', { cwd: this.pasta, mcpServers: [] })
    this.sid = r.sessionId
  }
  async perguntar(texto, anexos = []) {
    clearTimeout(this.ocioso)
    await this.pronta
    let corpo = texto
    if (anexos.length) corpo += '\n\nArquivos anexados (use as ferramentas para ler):\n' + anexos.map((a) => `- ${a}`).join('\n')
    if (this.primeira) {
      corpo = contextoDeSistema({ pasta: this.pasta }) + '\n\n---\n' + corpo
      this.primeira = false
    }
    this.turno = this.chamar('session/prompt', { sessionId: this.sid, prompt: [{ type: 'text', text: corpo }] })
    try {
      return await this.turno
    } finally {
      this.turno = null
      this.ocioso = setTimeout(() => this.encerrar(), OCIOSO_MS)
    }
  }
  cancelar() {
    if (this.sid) this.enviar({ jsonrpc: '2.0', method: 'session/cancel', params: { sessionId: this.sid } })
  }
  encerrar() {
    clearTimeout(this.ocioso)
    try {
      this.filho.kill()
    } catch {}
  }
}

module.exports = { Sessao, localizarBinario, prepararBase }
