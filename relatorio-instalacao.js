// Relatorio de falha da instalacao: o preparo do agente (instalador do Windows, `--preparar-agente`) grava um preparo.log so no computador do
// cliente. Quando ele falha, este modulo manda ao servidor (sem conta, o instalador ainda nao tem login) a versao, o sistema, a etapa, uma
// sondagem de rede e as ultimas linhas do log, para a equipe ver o motivo sem pedir nada ao cliente. Nunca derruba nem atrasa a instalacao.
const fs = require('fs')
const os = require('os')
const path = require('path')

const BASE = () => (process.env.SB_UNLIMITED_BASE || 'https://qwen.rangeltech.net/v1').replace(/\/+$/, '')
const LINHAS = 100

// tira o nome de usuario do Windows dos caminhos e do texto, para o relatorio nao identificar a pessoa
function limpar(texto, usuario = '') {
  let t = String(texto || '')
  t = t.replace(/([A-Za-z]:[\\/]+Users[\\/]+)[^\\/\s"']+/gi, '$1<usuario>')
  t = t.replace(/(\/(?:home|Users)\/)[^/\s"']+/g, '$1<usuario>')
  if (usuario && usuario.length >= 3) t = t.split(usuario).join('<usuario>')
  return t
}

function ultimasLinhas(arquivo, n = LINHAS) {
  try {
    return fs.readFileSync(arquivo, 'utf8').split(/\r?\n/).filter(Boolean).slice(-n).join('\n')
  } catch {
    return ''
  }
}

// a etapa que falhou: a ultima linha "falhou: ..." do log, ou a ultima linha qualquer
function etapaDoLog(log) {
  const linhas = String(log || '').split('\n').filter(Boolean)
  const f = [...linhas].reverse().find((l) => /falhou/i.test(l)) || linhas[linhas.length - 1] || ''
  return f.replace(/^\S+\s+/, '').slice(0, 80)
}

// quem bloqueia o GitHub (antivirus, proxy, firewall) aparece aqui: cada destino com status ou erro
async function sondarRede(buscar = fetch) {
  const destinos = ['https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.ps1', 'https://github.com/', new URL(BASE()).origin + '/health']
  const saida = []
  for (const u of destinos) {
    try {
      const r = await buscar(u, { method: 'HEAD', signal: AbortSignal.timeout(8000) })
      saida.push(`${new URL(u).host}=${r.status}`)
    } catch (e) {
      saida.push(`${new URL(u).host}=erro:${String((e && (e.cause && e.cause.code || e.message)) || e).slice(0, 40)}`)
    }
  }
  return saida.join(' ')
}

// monta e envia; devolve true se o servidor aceitou. Falha de rede aqui e engolida (a instalacao ja falhou por outro motivo).
async function enviar({ versao, logArq, codigo, buscar = fetch, base = BASE() }) {
  try {
    const usuario = (() => {
      try {
        return os.userInfo().username
      } catch {
        return ''
      }
    })()
    const rede = await sondarRede(buscar).catch(() => '')
    // o servidor guarda so o comeco do texto: o que mais explica a falha vem primeiro (saida do instalador do Hermes, depois o agente, depois o preparo)
    const dir = path.dirname(logArq)
    const bloco = (titulo, arq, n) => {
      const t = ultimasLinhas(arq, n).split('\n').map((l) => l.slice(0, 200)).join('\n')
      return t ? `--- ${titulo}\n${t}\n` : ''
    }
    const partes = bloco('instalador do Hermes', path.join(dir, 'hermes-instalacao.log'), 40) + bloco('agente', path.join(dir, 'logs', 'agente.log'), 16) + bloco('preparo', logArq, 24)
    const log = limpar((rede ? 'rede: ' + rede + '\n' : '') + partes, usuario)
    const corpo = { versao, so: `${process.platform} ${os.release()}`, arch: process.arch, etapa: etapaDoLog(log), codigo: String(codigo), maquina: '', log }
    const r = await buscar(base + '/diag/instalacao', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(15000) })
    return r.ok
  } catch {
    return false
  }
}

module.exports = { enviar, limpar, ultimasLinhas, etapaDoLog, sondarRede }
