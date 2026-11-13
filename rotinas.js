// Rotinas (spec 34 §6.9): tarefas que o agente faz sozinho em horários marcados (cron do Hermes), pelo gateway.
// O app só lista, cria, pausa, retoma e apaga; quem roda é o gateway (que fica de pé enquanto o app está aberto, ou em segundo plano).
const path = require('path')
const fs = require('fs')

// "todo dia às 8h" etc. viram a expressão que o Hermes entende ("0 8 * * *", "every 1d", "30m"...). O texto livre também vale: o Hermes aceita.
const FREQUENCIAS = {
  hora: 'every 1h',
  dia: 'every 1d',
  semana: 'every 7d',
}
function agendamento({ frequencia, horario, dias, expressao }) {
  if (expressao && String(expressao).trim()) return String(expressao).trim()
  const hm = /^(\d{1,2}):(\d{2})$/.exec(String(horario || ''))
  if (frequencia === 'diaria' && hm) return `${+hm[2]} ${+hm[1]} * * *`
  if (frequencia === 'semanal' && hm) return `${+hm[2]} ${+hm[1]} * * ${(dias && dias.length ? dias : [1]).join(',')}`
  if (frequencia === 'dias-uteis' && hm) return `${+hm[2]} ${+hm[1]} * * 1-5`
  if (FREQUENCIAS[frequencia]) return FREQUENCIAS[frequencia]
  if (frequencia === 'minutos' && +horario > 0) return `every ${Math.max(5, +horario | 0)}m`
  throw new Error('Escolha quando o workflow roda.')
}

const NOMES_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
// frase em português para a tela, a partir da expressão do Hermes
function descrever(sched) {
  const s = String(sched || '').trim()
  let m = /^every (\d+)m$/.exec(s)
  if (m) { const n = +m[1]; return n % 1440 === 0 ? (n === 1440 ? 'Todo dia' : `A cada ${n / 1440} dias`) : n % 60 === 0 ? (n === 60 ? 'Toda hora' : `A cada ${n / 60} horas`) : `A cada ${n} minutos` }
  m = /^every (\d+)([hd])$/.exec(s)
  if (m) return m[2] === 'h' ? (+m[1] === 1 ? 'Toda hora' : `A cada ${m[1]} horas`) : +m[1] === 1 ? 'Todo dia' : +m[1] === 7 ? 'Toda semana' : `A cada ${m[1]} dias`
  m = /^(\d{1,2}) (\d{1,2}) \* \* (.+)$/.exec(s)
  if (m) {
    const hora = `${String(m[2]).padStart(2, '0')}:${String(m[1]).padStart(2, '0')}`
    if (m[3] === '*') return `Todo dia às ${hora}`
    if (m[3] === '1-5') return `Dias úteis às ${hora}`
    const dias = m[3].split(',').map((d) => NOMES_DIA[+d % 7]).filter(Boolean)
    return `${dias.join(', ')} às ${hora}`
  }
  return s || 'Sem horário'
}

function lista(jobs) {
  return (jobs || []).map((j) => ({
    id: j.job_id,
    nome: j.name || j.job_id,
    quando: descrever(j.schedule),
    expressao: j.schedule,
    proxima: j.next_run_at || null,
    ultima: j.last_run_at || null,
    status: j.last_status || null,
    erro: j.last_error || j.last_fire_error || null,
    concluida: j.state === 'completed',
    ativa: j.enabled !== false && j.state !== 'paused' && j.state !== 'completed',
    pedido: j.prompt_preview || '',
  }))
}

// pasta do cron do Hermes (jobs.json + output/<id>/<data>.md): da para ler sem acordar o gateway
const pastaCron = (home) => path.join(home, 'cron')
function lerJobsDoDisco(home) {
  try { return JSON.parse(fs.readFileSync(path.join(pastaCron(home), 'jobs.json'), 'utf8')) } catch { return null }
}
function ultimaSaida(home, id) {
  const dir = path.join(pastaCron(home), 'output', String(id).replace(/[^A-Za-z0-9_-]/g, ''))
  try {
    const arqs = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort()
    if (!arqs.length) return null
    const f = arqs[arqs.length - 1]
    return { arquivo: f, texto: fs.readFileSync(path.join(dir, f), 'utf8').slice(0, 20000), total: arqs.length }
  } catch { return null }
}
// quem rodou desde a ultima conferencia (compara last_run_at): devolve [{ id, nome }]
function novasExecucoes(home, vistos) {
  const j = lerJobsDoDisco(home)
  const jobs = Array.isArray(j) ? j : Array.isArray(j?.jobs) ? j.jobs : []
  const novas = []
  for (const x of jobs) {
    const id = x.job_id || x.id
    const t = x.last_run_at || null
    if (!id) continue
    if (vistos.has(id) && t && vistos.get(id) !== t) novas.push({ id, nome: x.name || id })
    vistos.set(id, t)
  }
  return novas
}

function criar({ app, obterGateway, home }) {
  const gw = () => obterGateway()
  const chamar = (params) => gw().rpc('cron.manage', params, 20000)
  return {
    async listar() {
      const r = await chamar({ action: 'list', include_disabled: true })
      return { ok: true, rotinas: lista(r.jobs), gateway: r.gateway_running !== false }
    },
    async criar({ nome, pedido, frequencia, horario, dias, expressao }) {
      const n = String(nome || '').trim()
      const p = String(pedido || '').trim()
      if (!n || !p) throw new Error('Dê um nome e diga o que o agente deve fazer.')
      const r = await chamar({ action: 'add', name: n.slice(0, 80), prompt: p.slice(0, 4000), schedule: agendamento({ frequencia, horario, dias, expressao }) })
      if (r.success === false) throw new Error(r.error || 'Não consegui criar o workflow.')
      return { ok: true, id: r.job_id }
    },
    saida: (id) => ({ ok: true, saida: ultimaSaida(home(), id) }),
    async acao(id, acao) {
      if (!['pause', 'resume', 'remove'].includes(acao)) throw new Error('Ação desconhecida.')
      const r = await chamar({ action: acao, name: String(id) })
      if (r.success === false) throw new Error(r.error || 'Não deu certo.')
      return { ok: true }
    },
  }
}

module.exports = { criar, agendamento, descrever, lista, novasExecucoes, ultimaSaida, lerJobsDoDisco }
