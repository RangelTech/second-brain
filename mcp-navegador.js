// Servidor MCP (stdio) do navegador integrado. O Hermes inicia este processo e fala com ele por JSON-RPC, uma
// mensagem por linha. Cada ferramenta é repassada ao app (servidor HTTP local, com token) que controla a vista.
// Roda com o Node do Electron (ELECTRON_RUN_AS_NODE=1); não tem dependências.
const readline = require('readline')

const URL_APP = process.env.SB_NAV_URL
const TOKEN = process.env.SB_NAV_TOKEN

const obj = (props, req = []) => ({ type: 'object', properties: props, required: req })
const ONDE = { type: 'string', enum: ['auto', 'integrado', 'chrome'], description: 'Onde executar. Omita (auto): no aplicativo instalado usa o navegador integrado; na versão web usa o Chrome do usuário (extensão). Use "chrome" quando o usuário pedir o Chrome dele ou precisar das contas já abertas lá; "integrado" para o navegador do aplicativo.' }
const FERRAMENTAS = [
  { nome: 'abrir', desc: 'Abre um endereço no navegador integrado (o usuário vê a página ao lado do chat).', schema: obj({ url: { type: 'string', description: 'Endereço, por exemplo https://exemplo.com ou localhost:8080' } }, ['url']) },
  { nome: 'ler', desc: 'Lê a página atual: título, texto visível e a lista numerada de elementos clicáveis (links, botões, campos). Use os números em navegador_clicar e navegador_digitar. Rode de novo depois de cada ação que muda a página.', schema: obj({}) },
  { nome: 'clicar', desc: 'Clica em um elemento (pelo id de navegador_ler) ou em uma posição x,y da janela do navegador.', schema: obj({ id: { type: 'number', description: 'Número do elemento em navegador_ler' }, x: { type: 'number' }, y: { type: 'number' } }) },
  { nome: 'digitar', desc: 'Escreve texto em um campo (pelo id de navegador_ler). Com enter=true aperta Enter depois (envia formulário ou busca).', schema: obj({ id: { type: 'number' }, texto: { type: 'string' }, enter: { type: 'boolean' } }, ['texto']) },
  { nome: 'rolar', desc: 'Rola a página.', schema: obj({ direcao: { type: 'string', enum: ['baixo', 'cima', 'topo', 'fim'] }, pixels: { type: 'number' } }) },
  { nome: 'voltar', desc: 'Volta uma página no histórico.', schema: obj({}) },
  { nome: 'esperar', desc: 'Espera alguns milissegundos (máximo 15000), útil depois de uma ação que carrega conteúdo.', schema: obj({ ms: { type: 'number' } }) },
  { nome: 'js', desc: 'Executa JavaScript na página e devolve o resultado. O código é o corpo de uma função assíncrona: use return para devolver algo.', schema: obj({ codigo: { type: 'string' } }, ['codigo']) },
  { nome: 'chrome_estado', desc: 'Diz se o Chrome do usuário está conectado pela extensão (e se está pausada), qual é o navegador padrão e o link para baixar a extensão. Rode antes de usar onde="chrome" ou quando o usuário perguntar sobre a extensão.', schema: obj({}) },
  { nome: 'print', desc: 'Tira uma captura de tela da página e salva num arquivo PNG. Devolve o caminho; use vision_analyze nele para olhar a imagem.', schema: obj({}) },
]

const enviar = (o) => process.stdout.write(JSON.stringify(o) + '\n')

async function chamar(nome, args) {
  const r = await fetch(URL_APP, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN }, body: JSON.stringify({ nome, args }) })
  return r.json()
}

async function tratar(msg) {
  const { id, method, params } = msg
  if (method === 'initialize') return enviar({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'navegador', version: '1.0.0' } } })
  if (method === 'notifications/initialized' || (method && method.startsWith('notifications/'))) return
  if (method === 'ping') return enviar({ jsonrpc: '2.0', id, result: {} })
  if (method === 'tools/list') return enviar({ jsonrpc: '2.0', id, result: { tools: FERRAMENTAS.map((f) => ({ name: 'navegador_' + f.nome, description: f.desc, inputSchema: f.nome === 'esperar' || f.nome === 'chrome_estado' ? f.schema : { ...f.schema, properties: { ...f.schema.properties, onde: ONDE } } })) } })
  if (method === 'tools/call') {
    const nome = String(params?.name || '').replace(/^navegador_/, '')
    try {
      const r = await chamar(nome, params?.arguments || {})
      if (!r.ok) return enviar({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: r.erro || 'Falhou.' }] } })
      const content = [{ type: 'text', text: r.texto || 'ok' }]
      if (r.imagem) content.push({ type: 'image', data: r.imagem, mimeType: 'image/png' })
      return enviar({ jsonrpc: '2.0', id, result: { content } })
    } catch (e) {
      return enviar({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: 'Não consegui falar com o navegador do app: ' + e.message }] } })
    }
  }
  if (id !== undefined) enviar({ jsonrpc: '2.0', id, error: { code: -32601, message: 'método não suportado' } })
}

readline.createInterface({ input: process.stdin }).on('line', (l) => {
  let m
  try {
    m = JSON.parse(l)
  } catch {
    return
  }
  tratar(m).catch((e) => m.id !== undefined && enviar({ jsonrpc: '2.0', id: m.id, error: { code: -32603, message: String(e.message || e) } }))
})
