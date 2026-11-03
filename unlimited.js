// Cadastro automático do Unlimited: na primeira abertura o app pede uma chave ao servidor (POST /v1/enroll, sem senha).
// A chave nasce SUSPENSA e vem com um código curto (formato de placa, ex. ABC1D23). O dono acha o código no painel
// do servidor e libera. Enquanto isso o app guarda a chave cifrada e confere de tempos em tempos; ao liberar, ele liga
// o provedor e cria o combo "principal" sozinho. Ninguém precisa colar chave.
const os = require('os')
const crypto = require('crypto')

const BASE = () => (process.env.SB_UNLIMITED_BASE || 'https://qwen.rangeltech.net/v1').replace(/\/+$/, '')
const INTERVALO_MS = 30000

function criar({ app, cfgGet, cfgSet, cifrar, decifrar, embed, avisar }) {
  let estado = { fase: 'iniciando', codigo: '', detalhe: '' } // iniciando | pendente | ativo | offline | erro
  let timer = null
  let ligando = false

  const publicar = (novo) => {
    estado = { ...estado, ...novo }
    avisar(estado)
  }

  async function postar(rota, corpo) {
    const r = await fetch(BASE() + rota, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(20000) })
    let json = null
    try {
      json = await r.json()
    } catch {}
    return { status: r.status, json }
  }

  async function cadastrar() {
    const c = cfgGet()
    const maquina = c.maquinaId || crypto.randomUUID()
    if (!c.maquinaId) cfgSet({ maquinaId: maquina })
    const r = await postar('/enroll', { machine_id: maquina, app: 'segundo-cerebro', version: app.getVersion(), host: os.hostname(), os: process.platform })
    if (r.status === 404) throw Object.assign(new Error('Servidor ainda sem cadastro automático'), { semServidor: true })
    if (r.status !== 200) throw new Error(r.json?.error?.message || `HTTP ${r.status}`)
    cfgSet({ unlimitedCodigo: r.json.code })
    if (r.json.api_key) cfgSet({ unlimitedChave: cifrar(r.json.api_key) })
    return r.json
  }

  // 'ativo' (200), 'pendente' (403 suspensa), 'invalida' (401), 'offline'
  async function conferir(chave) {
    try {
      const r = await fetch(BASE() + '/usage', { headers: { Authorization: 'Bearer ' + chave }, signal: AbortSignal.timeout(15000) })
      if (r.status === 200) return 'ativo'
      if (r.status === 403) return 'pendente'
      if (r.status === 401) return 'invalida'
      return 'offline'
    } catch {
      return 'offline'
    }
  }

  // liga o provedor e o combo no motor local (uma vez, depois da liberação)
  async function ligarNoMotor(chave) {
    if (ligando) return
    ligando = true
    try {
      const nos = (await embed.api('GET', '/api/provider-nodes')).json?.nodes ?? []
      let no = nos.find((n) => n.prefix === 'unl')
      if (!no) {
        const c = await embed.api('POST', '/api/provider-nodes', { name: 'Unlimited', prefix: 'unl', apiType: 'chat', baseUrl: BASE(), type: 'openai-compatible' })
        if (c.status >= 300) throw new Error('Não consegui criar o provedor Unlimited.')
        no = c.json.node
      }
      const conex = (await embed.api('GET', '/api/providers')).json?.connections ?? []
      const atual = conex.find((x) => x.provider === no.id)
      if (atual) await embed.api('DELETE', `/api/providers/${atual.id}`)
      const r = await embed.api('POST', '/api/providers', { provider: no.id, apiKey: chave, name: 'Unlimited', defaultModel: 'qwen-abliterated' })
      if (r.status >= 300) throw new Error('Não consegui conectar o Unlimited.')
      const combos = (await embed.api('GET', '/api/combos')).json?.combos ?? []
      if (!combos.length) await embed.api('POST', '/api/combos', { name: 'principal', models: ['unl/qwen-abliterated'] })
      cfgSet({ unlimitedLigado: true })
    } finally {
      ligando = false
    }
  }

  async function ciclo() {
    clearTimeout(timer)
    try {
      const c = cfgGet()
      // sem cadastro ainda: tenta cadastrar (só se o usuário não conectou outro provedor à mão)
      if (!c.unlimitedChave && !c.unlimitedRecusado) {
        const j = await cadastrar()
        if (!j.api_key && !cfgGet().unlimitedChave) {
          publicar({ fase: 'erro', codigo: j.code, detalhe: 'Esta instalação já tem um código (' + j.code + '), mas a chave se perdeu. Peça ao suporte para gerar outra.' })
          return
        }
      }
      const c2 = cfgGet()
      if (!c2.unlimitedChave) return publicar({ fase: 'desligado' })
      const chave = decifrar(c2.unlimitedChave)
      const s = await conferir(chave)
      if (s === 'ativo') {
        if (!c2.unlimitedLigado && embed.estado().pronto) await ligarNoMotor(chave)
        publicar({ fase: 'ativo', codigo: c2.unlimitedCodigo, detalhe: '' })
        if (!cfgGet().unlimitedLigado) timer = setTimeout(ciclo, 5000) // motor ainda subindo
        return // liberado: para de conferir
      }
      if (s === 'pendente') publicar({ fase: 'pendente', codigo: c2.unlimitedCodigo, detalhe: '' })
      else if (s === 'invalida') publicar({ fase: 'erro', codigo: c2.unlimitedCodigo, detalhe: 'A chave deste computador foi revogada. Peça ao suporte para liberar de novo.' })
      else publicar({ fase: 'offline', codigo: c2.unlimitedCodigo, detalhe: 'Sem conexão com o servidor. Tentando de novo…' })
    } catch (e) {
      publicar(e.semServidor ? { fase: 'desligado', detalhe: '' } : { fase: 'offline', detalhe: String(e.message || e) })
    }
    timer = setTimeout(ciclo, INTERVALO_MS)
  }

  return {
    estado: () => estado,
    iniciar: () => ciclo(),
    parar: () => clearTimeout(timer),
    // o usuário colou uma chave à mão (ou desligou): o cadastro automático sai de cena
    recusar: () => {
      cfgSet({ unlimitedRecusado: true })
      clearTimeout(timer)
      publicar({ fase: 'desligado' })
    },
    reconferir: () => ciclo(),
  }
}

module.exports = { criar }
