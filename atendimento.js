// Atendimento automático do WhatsApp (workflow de gatilho): a cada N segundos o app confere a lista do WhatsApp Web (sem IA,
// só lê as bolinhas de "não lida"). Chegou mensagem nova: abre a conversa, lê as últimas mensagens, pede a resposta para a IA
// seguindo as instruções do dono e envia. Tudo fica no histórico (atendimento.json + atendimento-log.json em userData).
// Por que não é um workflow do cron do Hermes: o cron roda no mínimo a cada 5 min e acorda o agente inteiro a cada execução;
// aqui a conferência custa ~50 ms e a IA só é chamada quando há mensagem de verdade.
const fs = require('fs')
const path = require('path')

const PADRAO = {
  ativo: false,
  intervalo: 10, // segundos entre conferências
  instrucoes: '',
  grupos: false, // responder grupos também?
  so: [], // só estes contatos (vazio = todos)
  ignorar: [], // nunca responder estes
  historico: 15, // quantas mensagens da conversa a IA lê
  simular: false, // teste: faz tudo menos enviar (a resposta só aparece no histórico)
}
const MAX_LOG = 300

function criar({ app, wa, canal = 'whatsapp', responder, direto, alvo, avisar = () => {}, registrar = () => {} }) {
  const sufixo = canal === 'whatsapp' ? '' : '-' + canal // WhatsApp mantém os arquivos antigos
  const arqCfg = path.join(app.getPath('userData'), 'atendimento' + sufixo + '.json')
  const arqLog = path.join(app.getPath('userData'), 'atendimento' + sufixo + '-log.json')
  const NOME = canal === 'instagram' ? 'Instagram (Direct)' : 'WhatsApp'
  const ler = (f, p) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return p } }
  let cfg = { ...PADRAO, ...ler(arqCfg, {}) }
  let log = ler(arqLog, [])
  let timer = null
  let ocupado = false
  let ultimoEstado = { estado: 'parado', quando: null, erro: null }
  const respondidas = new Set(log.slice(-200).map((x) => x.msgId).filter(Boolean))

  const salvarLog = () => { try { fs.writeFileSync(arqLog, JSON.stringify(log.slice(-MAX_LOG), null, 1)) } catch {} }
  const anotar = (item) => {
    log.push({ quando: new Date().toISOString(), ...item })
    if (log.length > MAX_LOG) log = log.slice(-MAX_LOG)
    salvarLog()
    avisar({ tipo: 'log', item: log[log.length - 1] })
  }
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  const naLista = (nome, lista) => (lista || []).some((x) => norm(x) && norm(nome).includes(norm(x)))

  function prompt(contato, msgs) {
    const linhas = msgs.map((m) => {
      if (m.info) return `   (${m.info})`
      const quem = m.de === 'você' ? 'VOCÊ (dono)' : m.de || contato
      return `${quem}: ${m.texto || ''}${m.midia ? ' ' + m.midia : ''}`
    })
    return [
      'Você está respondendo o ' + NOME + ' do usuário (o dono deste Cérebro Pro) AUTOMATICAMENTE, como se fosse ele.',
      `Chegou mensagem nova de: ${contato}`,
      '',
      'INSTRUÇÕES DO DONO (siga à risca):',
      cfg.instrucoes && cfg.instrucoes.trim() ? cfg.instrucoes.trim() : 'Responda de forma educada, curta e útil. Se não souber algo, diga que vai verificar e retorna em breve.',
      '',
      'CONVERSA (mais antigas primeiro):',
      ...linhas,
      '',
      'Escreva SÓ o texto da resposta que será enviada no ' + NOME + ' (sem aspas, sem "Resposta:", sem explicar).',
      'Mensagem curta, tom de conversa de celular. Se a última mensagem não precisa de resposta (ex.: "ok", figurinha, agradecimento final)',
      'ou se as instruções mandam não responder este caso, escreva exatamente: SEM_RESPOSTA',
    ].join('\n')
  }

  async function pedirIA(contato, msgs) {
    const a = alvo()
    if (!a) throw new Error('Escolha um modelo no topo do chat antes de ligar o atendimento automático.')
    let acumulado = ''
    const ac = new AbortController()
    const limite = setTimeout(() => ac.abort(), 180000)
    try {
      if (direto && !cfg.usarAgente) {
        try {
          const t = await direto(a, prompt(contato, msgs), ac.signal)
          if (String(t).trim()) return String(t).trim()
        } catch (e) { registrar('atendimento: chamada direta falhou, indo pelo agente: ' + (e.message || e)) }
      }
      const r = await responder(a, [{ role: 'user', content: prompt(contato, msgs) }], {
        chat: 'atendimento-' + canal,
        onDelta: (d) => { if (d && d.texto) acumulado += d.texto },
        sinal: ac.signal,
        anexos: [],
        pedirPermissao: async () => 'negar', // sem ninguém olhando: nada que precise de permissão
      })
      return String(r || acumulado || '').trim()
    } finally {
      clearTimeout(limite)
    }
  }

  // limpa o que a IA devolveu: tira aspas/rótulos e blocos de raciocínio
  function limpar(t) {
    let s = String(t || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    s = s.replace(/^(resposta|mensagem)\s*:\s*/i, '').replace(/^["“](.*)["”]$/s, '$1').trim()
    return s
  }

  async function conferir() {
    if (ocupado || !cfg.ativo) return
    ocupado = true
    const t0 = Date.now()
    const comLimite = (p, ms, o) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(o + ' demorou mais de ' + ms / 1000 + ' s')), ms))])
    try {
      const r = await comLimite(wa.novas(), 20000, 'conferir o ' + NOME)
      if (r.estado !== 'ok') {
        ultimoEstado = { estado: r.estado === 'qr' ? 'precisa_qr' : 'carregando', quando: Date.now(), erro: null }
        if (r.estado === 'qr' || r.estado === 'carregando') await comLimite(wa.pronto(), 70000, 'abrir o ' + NOME).catch(() => {}) // carrega o WhatsApp na janela própria
        return
      }
      ultimoEstado = { estado: 'vigiando', quando: Date.now(), erro: null, conversas: r.conversas.length }
      const fila = r.conversas.filter((c) => (cfg.grupos || !c.grupo) && !naLista(c.nome, cfg.ignorar) && (!cfg.so?.length || naLista(c.nome, cfg.so)))
      for (const c of fila.slice(0, 5)) {
        if (!cfg.ativo) break
        const ab = await comLimite(wa.abrirLinha(c.nome), 40000, 'abrir a conversa')
        const msgs = await comLimite(wa.lerAberta(cfg.historico || 15), 20000, 'ler a conversa')
        const ultima = [...msgs].reverse().find((m) => !m.info)
        if (!ultima || ultima.de === 'você') continue // a última já é do dono: nada a fazer (abrir já marcou como lida)
        const msgId = ultima.id || `${c.nome}|${ultima.meta}|${ultima.texto}`
        if (respondidas.has(msgId)) continue
        respondidas.add(msgId)
        const ti = Date.now()
        let resposta
        try {
          resposta = limpar(await pedirIA(ab.titulo || c.nome, msgs))
        } catch (e) {
          anotar({ contato: c.nome, recebida: ultima.texto || ultima.midia || '', erro: 'IA: ' + (e.message || e), msgId })
          continue
        }
        if (!resposta || /^SEM_RESPOSTA\b/.test(resposta)) {
          anotar({ contato: c.nome, recebida: ultima.texto || ultima.midia || '', resposta: null, pulou: true, msgId, segundos: Math.round((Date.now() - ti) / 100) / 10 })
          continue
        }
        if (!cfg.simular) await comLimite(wa.enviarAberta(resposta), 30000, 'enviar')
        anotar({ contato: c.nome, recebida: ultima.texto || ultima.midia || '', resposta, simulado: !!cfg.simular || undefined, msgId, segundos: Math.round((Date.now() - ti) / 100) / 10 })
        registrar(`atendimento ${canal}: respondeu ${c.nome} em ${((Date.now() - ti) / 1000).toFixed(1)} s`)
      }
    } catch (e) {
      ultimoEstado = { estado: 'erro', quando: Date.now(), erro: String(e.message || e) }
      registrar('atendimento: ' + (e.message || e))
    } finally {
      ultimoEstado.ms = Date.now() - t0
      ocupado = false
      agendar()
    }
  }

  function agendar() {
    clearTimeout(timer)
    timer = null
    if (!cfg.ativo) return
    timer = setTimeout(conferir, Math.max(3, Number(cfg.intervalo) || 10) * 1000)
  }

  function configurar(novo = {}) {
    const antes = cfg.ativo
    cfg = { ...cfg, ...novo }
    for (const k of ['so', 'ignorar']) if (typeof cfg[k] === 'string') cfg[k] = cfg[k].split(/[,\n]/).map((x) => x.trim()).filter(Boolean)
    cfg.intervalo = Math.min(3600, Math.max(3, Number(cfg.intervalo) || 10))
    fs.writeFileSync(arqCfg, JSON.stringify(cfg, null, 1))
    if (cfg.ativo && !antes) {
      // ao ligar: o que já estava não lido NÃO é respondido de surpresa? Responde sim (é o que o dono quer), mas só o que chegou por último.
      ultimoEstado = { estado: 'iniciando', quando: Date.now(), erro: null }
      setTimeout(conferir, 500)
    } else agendar()
    if (!cfg.ativo) ultimoEstado = { estado: 'parado', quando: Date.now(), erro: null }
    return estado()
  }

  function estado() {
    return { canal, config: cfg, status: ultimoEstado, ultimos: log.slice(-30).reverse() }
  }

  if (cfg.ativo) setTimeout(conferir, 20000) // app abriu com o atendimento ligado: começa depois que tudo carregou

  return { configurar, estado, conferir }
}

module.exports = { criar, PADRAO }
