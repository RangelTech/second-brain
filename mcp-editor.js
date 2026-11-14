// Servidor MCP (stdio) das ferramentas do APP para o editor de vídeo: instalar, abrir a janela, cortar silêncio e ver o estado. As ferramentas de edição
// em si (criar projeto, cortar, título, exportar...) vêm do próprio motor do editor, registrado ao lado como servidor "editor". Repassa ao app (HTTP local).
const readline = require('readline')
const URL_APP = process.env.SB_NAV_URL
const TOKEN = process.env.SB_NAV_TOKEN
const obj = (props, req = []) => ({ type: 'object', properties: props, required: req })
const FERRAMENTAS = [
  { nome: 'estado', desc: 'Diz se o editor de vídeo do Cérebro Pro está instalado e pronto, e em qual pasta guardar os projetos. Rode antes de editar vídeo.', schema: obj({}) },
  { nome: 'instalar', desc: 'Instala o editor de vídeo (uma vez só, em segundo plano, sem janelas: baixa, confere e instala). Leva cerca de 1 minuto. Depois de instalar, as ferramentas do servidor "editor" passam a existir na PRÓXIMA conversa nova: avise o usuário para abrir um chat novo.', schema: obj({}) },
  { nome: 'abrir_janela', desc: 'Abre a janela do editor de vídeo (interface completa, janela própria) com o projeto, para o usuário ASSISTIR você editar ao vivo e mexer junto. Fluxo: project_create, project_save, project_close, editor_abrir_janela, espere ~15 s e chame project_open no mesmo caminho: daí em diante cada edição sua aparece na janela na hora. Não use pelo acesso web (a janela abriria no computador remoto).', schema: obj({ projeto: { type: 'string', description: 'Pasta do projeto (a mesma que você usou em project_create)' } }) },
  { nome: 'cortar_silencio', desc: 'Remove os trechos mudos (silêncio) de um vídeo ou áudio e devolve um arquivo novo só com os trechos com som, com a duração antes e depois. Depois importe o arquivo novo no projeto (media_import).', schema: obj({ arquivo: { type: 'string', description: 'Caminho completo do vídeo ou áudio' }, limiar_db: { type: 'number', description: 'Abaixo disso é silêncio (padrão -35)' }, silencio_minimo_s: { type: 'number', description: 'Silêncio só conta se durar isso (padrão 0,6 s)' } }, ['arquivo']) },
]
const enviar = (o) => process.stdout.write(JSON.stringify(o) + '\n')
async function chamar(nome, args) {
  const r = await fetch(URL_APP, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN }, body: JSON.stringify({ nome: 'editor_' + nome, args }) })
  return r.json()
}
async function tratar(msg) {
  const { id, method, params } = msg
  if (method === 'initialize') return enviar({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'editor-app', version: '1.0.0' } } })
  if (method && method.startsWith('notifications/')) return
  if (method === 'ping') return enviar({ jsonrpc: '2.0', id, result: {} })
  if (method === 'tools/list') return enviar({ jsonrpc: '2.0', id, result: { tools: FERRAMENTAS.map((f) => ({ name: 'editor_' + f.nome, description: f.desc, inputSchema: f.schema })) } })
  if (method === 'tools/call') {
    const nome = String(params?.name || '').replace(/^editor_/, '')
    try {
      const r = await chamar(nome, params?.arguments || {})
      if (!r.ok) return enviar({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: r.erro || 'Falhou.' }] } })
      return enviar({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: r.texto || 'ok' }] } })
    } catch (e) {
      return enviar({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: 'Não consegui falar com o aplicativo: ' + e.message }] } })
    }
  }
  if (id !== undefined) enviar({ jsonrpc: '2.0', id, error: { code: -32601, message: 'método não suportado' } })
}
readline.createInterface({ input: process.stdin }).on('line', (l) => {
  let m
  try { m = JSON.parse(l) } catch { return }
  tratar(m).catch((e) => m.id !== undefined && enviar({ jsonrpc: '2.0', id: m.id, error: { code: -32603, message: String(e.message || e) } }))
})
