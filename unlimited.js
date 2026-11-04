// Acesso ao Unlimited por LOGIN (e-mail e senha). Só assinante liberado entra: o servidor (POST /v1/auth/login) devolve uma chave
// própria deste computador, que o app guarda cifrada; a senha nunca é guardada. Com a chave, o app confere de tempos em tempos e,
// liberado, liga o provedor e cria o combo "principal" sozinho. Instalações antigas, que já têm chave, seguem como estavam.
const os = require('os')

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
      // sem chave: o app pede o login (se o usuário não conectou outro provedor à mão)
      // sem conta entrada não há acesso (instalações antigas, com chave colada à mão, também precisam entrar)
      if (!c.unlimitedEmail || !c.unlimitedChave) return publicar({ fase: 'login' })
      const c2 = cfgGet()
      const chave = decifrar(c2.unlimitedChave)
      const s = await conferir(chave)
      if (s === 'ativo') {
        if (!c2.unlimitedLigado && embed.estado().pronto) await ligarNoMotor(chave)
        publicar({ fase: 'ativo', codigo: c2.unlimitedCodigo, detalhe: '' })
        if (!cfgGet().unlimitedLigado) timer = setTimeout(ciclo, 5000) // motor ainda subindo
        return // liberado: para de conferir
      }
      if (s === 'pendente') publicar({ fase: 'pendente', detalhe: 'O seu acesso está aguardando liberação ou foi bloqueado. Assim que for liberado, o app volta a funcionar sozinho.' })
      else if (s === 'invalida') {
        // a chave deste computador caiu (limite de computadores, assinatura encerrada ou troca de senha): pede o login de novo
        cfgSet({ unlimitedChave: undefined, unlimitedLigado: false, unlimitedEmail: undefined, unlimitedPlano: undefined })
        publicar({ fase: 'login', detalhe: 'Sua sessão neste computador terminou. Entre de novo.' })
      }
      else publicar({ fase: 'offline', codigo: c2.unlimitedCodigo, detalhe: 'Sem conexão com o servidor. Tentando de novo…' })
    } catch (e) {
      publicar({ fase: 'offline', detalhe: String(e.message || e) })
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
    // login: devolve {ok} ou {ok:false, codigo, erro} com texto pronto para mostrar
    entrar: async (email, senha) => {
      let r
      try {
        r = await postar('/auth/login', { email: String(email || '').trim(), password: String(senha || ''), device: os.hostname() })
      } catch {
        return { ok: false, codigo: 'offline', erro: 'Sem conexão com o servidor. Confira a internet e tente de novo.' }
      }
      if (r.status === 200 && r.json?.api_key) {
        cfgSet({ unlimitedChave: cifrar(r.json.api_key), unlimitedEmail: r.json.account?.email, unlimitedPlano: r.json.plan?.name, unlimitedLigado: false, unlimitedRecusado: false })
        clearTimeout(timer)
        ciclo()
        return { ok: true, plano: r.json.plan?.name }
      }
      const codigo = r.json?.error?.code
      const texto = { invalid_credentials: 'E-mail ou senha incorretos.', awaiting_release: 'Sua conta ainda não foi liberada. Avisaremos assim que estiver pronta.',
        subscription_inactive: 'Sua assinatura não está ativa. Renove para continuar.', account_blocked: 'Conta bloqueada. Fale com o suporte.', too_many_attempts: 'Muitas tentativas. Aguarde alguns minutos.' }
      return { ok: false, codigo, erro: texto[codigo] || r.json?.error?.message || `Não consegui entrar (HTTP ${r.status}).` }
    },
    esqueci: async (email) => {
      try {
        await postar('/auth/forgot', { email: String(email || '').trim() })
        return { ok: true }
      } catch {
        return { ok: false, erro: 'Sem conexão com o servidor.' }
      }
    },
    sair: () => {
      clearTimeout(timer)
      cfgSet({ unlimitedChave: undefined, unlimitedLigado: false, unlimitedEmail: undefined, unlimitedPlano: undefined })
      publicar({ fase: 'login', detalhe: '' })
    },
  }
}

module.exports = { criar }
