// Conversa pelo gateway do Hermes (spec 34, fase 1): mesma interface da Sessao (agent.js), mas SEM um processo hermes-acp por conversa.
// Todas as conversas dividem UMA ponte (gateway-cliente.js); criar conversa custa ~0,2 s e não gasta o modelo, então não existe reserva nem aquecimento.
// Ligado por cfg.motorGateway (padrão desligado). Nada aqui muda a tela: os eventos viram os mesmos { texto, raciocinio, ferramenta, contexto }.
const path = require('path')
const crypto = require('crypto')
const { GatewayCliente, traducao, fimDeTurno, pedidoDePermissao } = require('./gateway-cliente')
const agente = require('./agent')

let compartilhado = null
function obterGateway(app, home) {
  if (compartilhado && compartilhado.home === home) return compartilhado // uma ponte so, mesmo antes de ela terminar de subir
  if (compartilhado && compartilhado.home !== home) compartilhado.encerrar()
  compartilhado = new GatewayCliente({ home, registrar: (m) => agente.registrar(app, m) })
  compartilhado.caiu = () => { for (const f of compartilhado.aoCair || []) f() }
  compartilhado.aoCair = new Set()
  return compartilhado
}
const id = () => crypto.randomBytes(8).toString('hex')

class SessaoGateway {
  get emitir() { return this.mudo ? () => {} : this._emitir || (() => {}) }
  set emitir(f) { this._emitir = f }

  constructor({ app, id: chat, pasta, base, modelo, raciocinio, emitir, pedirPermissao, modo, navegador, midia, memoria, ias, nivel, gateway, filhos }) {
    this.app = app
    this.id = chat
    this.pasta = pasta
    this.modo = modo || (() => 'manual')
    this.navegador = navegador || null
    this.memoria = memoria || null
    this.ias = ias || null
    this.midia = midia || null
    this.vagaArq = null
    this.emitir = emitir
    this.pedirPermissao = pedirPermissao
    this.primeira = true
    this.aquecida = true // não existe aquecimento: a conversa já nasce pronta
    this.morto = false
    this.falhouIniciar = false
    this.ativo = false
    this.turno = null
    this.sid = null
    this.estado = {}
    this.permitirSempre = false
    this.turnosVivos = ''
    const home = agente.prepararHome(app, { base, modelo: 'principal', pasta, raciocinio, nivel, gateway: true, filhos: filhos || 3, visao: midia ? { base: midia.base, modelo: 'qwen-abliterated', chave: midia.chave } : null })
    this.home = home
    this.gw = gateway || obterGateway(app, home) // `gateway`: injetado nos testes
    this.cai = () => { this.sid = null } // a ponte caiu: a próxima pergunta cria a conversa de novo
    this.gw.aoCair?.add(this.cai)
    this.desouvir = this.gw.ouvir((ev) => this._evento(ev))
    this.pronta = this._criar().catch((e) => { this.falhouIniciar = true; throw e })
    this.pronta.catch(() => {})
  }

  async _criar() {
    const mcp = agente.Sessao.prototype.servidoresMcp.call(this)
    const r = await this.gw.rpc('session.create', {
      request_id: id(), source: 'acp', cwd: this.pasta,
      editor: { mcp_servers: mcp, edit_approval_policy: 'ask' },
    }, 60000)
    this.sid = r.session_id
    this.estado = {}
    return this.sid
  }

  _evento(ev) {
    if (!this.sid || ev.session_id !== this.sid) return
    const perm = pedidoDePermissao(ev)
    if (perm) return void this._permissao(perm, ev)
    const fim = fimDeTurno(ev)
    if (fim.fim && this._fim) return this._fim(fim)
    for (const e of traducao(ev, this.estado)) {
      if (e.texto) {
        if (/^\s*gateway\.errors\./.test(e.texto)) continue
        this.parcial += e.texto
      }
      if (e.ferramenta) this._ferramenta(e.ferramenta)
      this.emitir(e)
    }
  }
  _ferramenta(f) {
    if (f.status === 'completed' && f.titulo) this.feitos.push(String(f.titulo).slice(0, 120) + (f.conteudo ? ' -> ' + String(f.conteudo).replace(/\s+/g, ' ').slice(0, 200) : ''))
    const cota = agente.kindDeCotaDeMidia(f.conteudo || '')
    if (cota && !this.cotasAvisadas?.has(cota)) (this.cotasAvisadas ||= new Set()).add(cota), this.emitir({ creditos: { kind: cota } })
  }

  async _permissao(p, ev) {
    const opcoes = (p.escolhas || []).map((c) => ({ optionId: c, kind: c === 'deny' ? 'reject_once' : c === 'once' ? 'allow_once' : 'allow_always', name: c }))
    const responder = (choice) => this.gw.rpc(p.clarify ? 'clarify.respond' : 'approval.respond', {
      session_id: ev.session_id, prompt_id: p.prompt_id, execution_generation: p.execution_generation, ...(p.clarify ? { answer: choice } : { choice }),
    }).catch((e) => agente.registrar(this.app, 'permissao: ' + e.message))
    try {
      if (p.clarify) {
        // pergunta do agente: o cartao mostra as escolhas (ou campo aberto); sem resposta em 5 min o agente segue com o padrao dele
        let t
        const r = await Promise.race([this.pedirPermissao({ chat: this.id, titulo: p.pergunta?.texto || p.titulo, tipo: 'clarify', pergunta: p.pergunta }), new Promise((ok) => { t = setTimeout(() => ok('resp:'), 300000); t.unref?.() })])
        clearTimeout(t)
        return void (await responder(typeof r === 'string' && r.startsWith('resp:') ? r.slice(5) : ''))
      }
      if (this.permitirSempre) return void (await responder('once'))
      const tc = { title: p.titulo, kind: p.tipo, rawInput: { command: p.titulo } }
      if (agente.decidirPermissao(this.modo(), tc, this.pasta) === 'permitir') return void (await responder('once'))
      const r = await this.pedirPermissao({ chat: this.id, titulo: p.titulo, tipo: p.tipo, opcoes })
      if (r === 'sempre') { this.permitirSempre = true; return void (await responder('once')) }
      await responder(r === 'permitir' ? 'once' : 'deny')
    } catch { await responder('deny') }
  }

  async aquecer() { return null } // sem aquecimento: criar conversa no gateway já é instantâneo e não chama o modelo
  tocar() {}
  agendarOcioso() {}

  async perguntar(texto, anexos = []) {
    this.ativo = true
    try { return await this._perguntar(texto, anexos) } finally { this.ativo = false }
  }

  async _perguntar(texto, anexos) {
    this.limiteUso = false
    this.cotasAvisadas = null
    this.pedidoParar = false
    let corpo = texto
    if (anexos.length) corpo += '\n\nArquivos anexados (use as ferramentas para ler):\n' + anexos.map((a) => `- ${a}`).join('\n')
    const corpoPuro = corpo
    const nl = String.fromCharCode(10)
    if (this.historicoPendente) { corpo = 'Conversa até aqui (continue dela):' + nl + this.historicoPendente + nl + nl + '---' + nl + corpo; this.historicoPendente = null }
    if (this.primeira) {
      const hist = this.historico ? nl + nl + 'Conversa até aqui (continue dela):' + nl + this.historico : ''
      corpo = agente.contextoDeSistema({ pasta: this.pasta, navegador: !!this.navegador, midia: !!this.midia, memoria: !!this.memoria }) + hist + nl + nl + '---' + nl + corpo
      this.primeira = false
    }
    this.parcial = ''
    this.feitos = []
    const original = this._emitir || (() => {})
    let tentativa = 0
    try {
      while (true) {
        tentativa++
        try {
          await this.pronta.catch(() => {}) // a criação feita no construtor termina antes de decidir se precisa criar outra
          const sid = this.sid || (await this._criarComTentativas())
          if (this.pedidoParar) throw new Error('Interrompido.')
          const fim = new Promise((ok) => { this._fim = ok })
          const r = await this.gw.rpc('prompt.submit', { session_id: sid, input_id: id(), text: corpo + (this.chatMarca ? nl + '<!--sb:' + this.chatMarca + '-->' : '') }, 60000)
          this.turno = fim
          const f = await fim
          this.turno = null
          this._fim = null
          if (f.outcome === 'failed') throw Object.assign(new Error('admitted_turn_failed'), { codigo: 'turno_falhou' })
          this.turnosVivos = ((this.turnosVivos || '') + '\nUsuário: ' + texto.slice(0, 2000) + '\nAssistente: ' + this.parcial.slice(0, 2000)).slice(-12000)
          return { usage: null, receipt: r }
        } catch (e) {
          this.turno = null
          this._fim = null
          if (this.pedidoParar) throw new Error('Interrompido.')
          const recuperavel = /ponte_caiu|Gateway disconnected|admitted_turn_failed|launch_credentials_unavailable|stale/i.test(String(e.message) + String(e.codigo))
          if (!recuperavel || tentativa > 3) throw new Error(tentativa > 3 ? 'Não consegui responder agora. Tente enviar de novo em instantes.' : e.message)
          agente.registrar(this.app, `gateway: turno interrompido (${String(e.message).slice(0, 80)}), retomando (tentativa ${tentativa})`)
          this.emitir({ novoCard: true })
          this.sid = null
          const hist = [this.historico, this.turnosVivos].filter(Boolean).join(nl)
          corpo = agente.contextoDeSistema({ pasta: this.pasta, navegador: !!this.navegador, midia: !!this.midia, memoria: !!this.memoria }) +
            (hist ? nl + nl + 'Conversa até aqui (continue dela):' + nl + hist : '') + nl + nl + '---' + nl + corpoPuro + nl + nl +
            '[Retomada automática] A conexão caiu no meio desta tarefa, sem culpa do usuário. ' +
            (this.feitos.length ? 'Já foi feito neste pedido:' + nl + this.feitos.map((f) => '- ' + f).join(nl) + nl : '') +
            (this.parcial ? 'Texto que você já tinha escrito: ' + this.parcial.slice(-1500) + nl : '') +
            'Continue de onde parou, sem refazer o que já foi entregue e SEM mencionar a queda nem pedir desculpas.'
          await new Promise((ok) => setTimeout(ok, Math.min(8000, 1000 * tentativa)))
        }
      }
    } finally {
      this._emitir = this._emitir === original ? original : this._emitir
    }
  }
  async _criarComTentativas() {
    let ultimo
    for (let i = 0; i < 3; i++) {
      try { return await this._criar() } catch (e) { ultimo = e; await new Promise((ok) => setTimeout(ok, 1500 * (i + 1))) }
    }
    throw ultimo
  }

  async direcionar(texto) {
    if (!this.sid || !this.turno) return false
    try { await this.gw.rpc('session.steer', { session_id: this.sid, text: String(texto) }, 15000); return true } catch { return false }
  }

  cancelar() {
    this.pedidoParar = true
    if (!this.sid) return
    this.gw.rpc('session.interrupt', { session_id: this.sid }, 15000).catch(() => {})
    if (this._fim) this._fim({ fim: true, outcome: 'cancelled' })
  }

  encerrar() {
    this.morto = true
    try { this.desouvir?.() } catch {}
    try { this.gw.aoCair?.delete(this.cai) } catch {}
  }
}

function encerrarGateway() { try { compartilhado?.encerrar() } catch {} compartilhado = null }

module.exports = { SessaoGateway, obterGateway, encerrarGateway }
