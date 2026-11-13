// Cliente do gateway do Hermes (spec 34, fase 1): UM processo-ponte para todas as conversas.
// A ponte é um script Python (prototipo/gateway/ponte_gateway.py -> ponte_gateway.py na raiz) rodando no venv do próprio Hermes,
// que usa o cliente oficial (tíquete pelo canal privado + WebSocket canônico). O app fala com ela por linhas JSON.
// Este módulo: GatewayCliente (processo único, rpc, eventos) e traducao() (evento do gateway -> o que a tela já desenha).
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

// ---------- tradução de eventos (pura, testável sem Hermes) ----------
// Evento do gateway: { type, payload, session_id, admission_id }. Saída: objetos que o app já emite ({ texto }, { raciocinio }, { ferramenta }, { contexto }).
function traducao(ev, estado = {}) {
  const p = ev?.payload || {}
  switch (ev?.type) {
    case 'message.delta': {
      const t = typeof p.text === 'string' ? p.text : ''
      return t ? [{ texto: t }] : []
    }
    case 'reasoning.delta': {
      const t = typeof p.text === 'string' ? p.text : ''
      return t ? [{ raciocinio: t }] : []
    }
    case 'tool.start': {
      const id = p.tool_call_id
      const nome = p.tool_name || p.name || 'ferramenta'
      const args = p.args && typeof p.args === 'object' ? p.args : {}
      estado.ferramentas ||= new Map()
      estado.ferramentas.set(id, { nome, args })
      return [{ ferramenta: { id, titulo: nome, tipo: tipoDaFerramenta(nome), status: 'in_progress', conteudo: '', caminho: caminhoDe(args), entrada: JSON.stringify(args).slice(0, 600) } }]
    }
    case 'tool.complete': {
      const id = p.tool_call_id
      const guardada = estado.ferramentas?.get(id) || { nome: p.tool_name || p.name || 'ferramenta', args: {} }
      estado.ferramentas?.delete(id)
      const res = typeof p.result === 'string' ? p.result : p.result != null ? JSON.stringify(p.result) : ''
      return [{ ferramenta: { id, titulo: guardada.nome, tipo: tipoDaFerramenta(guardada.nome), status: p.is_error === true ? 'failed' : 'completed', conteudo: res.slice(0, 4000), caminho: caminhoDe(guardada.args), entrada: JSON.stringify(guardada.args).slice(0, 600) } }]
    }
    case 'session.usage': {
      const u = p.used ?? p.context_used ?? p.total_tokens
      return u >= 0 ? [{ contexto: { usado: u, tamanho: p.size || p.context_size || 262144 } }] : []
    }
    default:
      return []
  }
}
function tipoDaFerramenta(nome) {
  const n = String(nome || '')
  if (/read|ler|search_files|grep|glob/i.test(n)) return 'read'
  if (/write|patch|edit/i.test(n)) return 'edit'
  if (/terminal|execute|shell|process/i.test(n)) return 'execute'
  if (/web|browser|navegador|search/i.test(n)) return 'fetch'
  return 'other'
}
const caminhoDe = (a) => (a && (a.path || a.file_path || a.filepath)) || null

// Fim de turno: message.complete (payload.outcome) ou erro de admissão.
function fimDeTurno(ev) {
  if (ev?.type === 'message.complete') return { fim: true, outcome: ev.payload?.outcome || 'completed' }
  if (ev?.type === 'turn.failed') return { fim: true, outcome: 'failed' }
  return { fim: false }
}

// Pedido de permissão: approval.request/clarify.request -> opções que o app já mostra ({ titulo, tipo, opcoes }).
function pedidoDePermissao(ev) {
  if (ev?.type !== 'approval.request' && ev?.type !== 'clarify.request') return null
  const p = ev.payload || {}
  const escolhas = Array.isArray(p.choices) ? p.choices : ['once', 'deny']
  return {
    prompt_id: p.prompt_id,
    execution_generation: p.execution_generation,
    clarify: ev.type === 'clarify.request',
    titulo: p.description || p.command || p.question || 'Ação do agente',
    tipo: p.edit ? 'edit' : 'execute',
    escolhas,
  }
}

// ---------- processo-ponte ----------
function caminhosDaPonte(home) {
  const base = path.join(home, 'installs')
  if (!fs.existsSync(base)) return null
  for (const i of fs.readdirSync(base)) {
    const envs = path.join(base, i, 'environments')
    if (!fs.existsSync(envs)) continue
    for (const e of fs.readdirSync(envs)) {
      const ws = path.join(envs, e, 'workspace')
      const py = path.join(envs, e, 'venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
      if (fs.existsSync(path.join(ws, 'hermes_cli', 'gateway_client.py')) && fs.existsSync(py)) return { ws, py }
    }
  }
  return null
}

class GatewayCliente {
  constructor({ home, registrar = () => {}, script }) {
    this.home = home
    this.registrar = registrar
    this.script = script || path.join(__dirname, 'ponte_gateway.py')
    this.seq = 0
    this.pend = new Map()
    this.ouvintes = new Set()
    this.buf = ''
    this.filho = null
    this.pronta = null
  }
  iniciar() {
    if (this.pronta) return this.pronta
    const c = caminhosDaPonte(this.home)
    if (!c) return (this.pronta = Promise.reject(new Error('Hermes ainda não está instalado.')))
    const t0 = Date.now()
    this.pronta = new Promise((res, rej) => {
      const p = spawn(c.py, [this.script], { cwd: c.ws, env: { ...process.env, HERMES_HOME: this.home, PYTHONPATH: c.ws, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }, windowsHide: true })
      this.filho = p
      p.stdout.on('data', (d) => this._dados(String(d), res))
      p.stderr.on('data', (d) => this.registrar('ponte-gateway: ' + String(d).slice(-300)))
      p.on('exit', (cod) => {
        this.registrar(`ponte-gateway saiu (${cod})`)
        for (const f of this.pend.values()) f({ error: { message: 'A conexão com o agente caiu.', code: 'ponte_caiu' } })
        this.pend.clear()
        this.filho = null
        this.pronta = null
        this.caiu?.()
        rej(new Error('ponte saiu antes de ficar pronta'))
      })
      this._t0 = t0
    })
    return this.pronta
  }
  _dados(d, pronta) {
    this.buf += d
    let i
    while ((i = this.buf.indexOf('\n')) >= 0) {
      const linha = this.buf.slice(0, i)
      this.buf = this.buf.slice(i + 1)
      let m
      try { m = JSON.parse(linha) } catch { continue }
      if (m.pronta) { this.registrar(`ponte-gateway pronta em ${Date.now() - this._t0} ms`); pronta(true) }
      else if (m.id !== undefined && this.pend.has(m.id)) { this.pend.get(m.id)(m); this.pend.delete(m.id) }
      else if (m.evento) for (const f of this.ouvintes) f(m.evento)
      else if (m.caiu) this.registrar('gateway caiu: ' + m.caiu)
    }
  }
  async rpc(method, params = {}, timeoutMs) {
    await this.iniciar()
    return new Promise((res, rej) => {
      const id = ++this.seq
      const t = timeoutMs ? setTimeout(() => { this.pend.delete(id); rej(new Error('prazo do ' + method)) }, timeoutMs) : null
      this.pend.set(id, (m) => {
        clearTimeout(t)
        m.error ? rej(Object.assign(new Error(m.error.message || 'erro'), { codigo: m.error.code, dados: m.error.data })) : res(m.result)
      })
      this.filho.stdin.write(JSON.stringify({ id, method, params }) + '\n')
    })
  }
  ouvir(f) { this.ouvintes.add(f); return () => this.ouvintes.delete(f) }
  encerrar() { try { this.filho?.kill() } catch {} }
}

module.exports = { GatewayCliente, traducao, fimDeTurno, pedidoDePermissao, tipoDaFerramenta, caminhosDaPonte }
