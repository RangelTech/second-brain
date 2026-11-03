// Gera skills-globais/rangeltech/** a partir da skill `projetos` (campanha de benchmark de 26 a 28/10/2026).
// Uso: node scripts/gerar-skills-rangeltech.js [pasta-references]
// Só entram dados públicos da campanha: sem repositório privado, sem saídas de modelos abliterados, sem chaves,
// sem as linhas internas sobre o Lunar. Rode de novo quando a campanha ganhar novos benchmarks.
const fs = require('fs')
const os = require('os')
const path = require('path')

const refs = process.argv[2] || path.join(os.homedir(), '.claude', 'skills', 'projetos', 'references')
const saida = path.join(__dirname, '..', 'skills-globais', 'rangeltech')
const ler = (n) => fs.readFileSync(path.join(refs, n), 'utf8')

const VEREDITO = { Adotar: 'adotar', Testar: 'testar', Estudar: 'estudar', 'OK para o cliente': 'ok-cliente', 'OK para o cliente, com risco': 'ok-cliente-com-risco', Ignorar: 'descartar' }
const ROTULO = { adotar: 'ADOTAR', testar: 'TESTAR', estudar: 'ESTUDAR', 'ok-cliente': 'OK para quem instala (licença restritiva)', 'ok-cliente-com-risco': 'OK para quem instala, com risco', descartar: 'DESCARTAR' }

const AREAS = [
  ['rosto-avatar', /(^|[^a-z])face(swap|fusion)?|deepface|liveportrait|rvc|lip.?sync|talking.?head|reenact/i],
  ['voz-audio', /tts|stt|voice|voz|whisper|speech|audio|asr|speaker|music|personaplex/i],
  ['3d-fotogrametria', /colmap|3d|gaussian|photogramm|nerf|mesh|depth|splat|sfm/i],
  ['video', /video|animate|motion|opencut|remotion|hyperframes|clip/i],
  ['imagem', /image|imagem|diffusion|flux|comfy|text-to-image|supra|upscal/i],
  ['visao-cameras', /yolo|detect|track|camera|segment|sam\b|sam2|vision|ocr|onvif|rtsp|supervision/i],
  ['llm-servir-modelo', /llm|vllm|sglang|llama|quant|inference|awq|gguf|bitnet|airllm|ollama|modelo|model serving|qwen|token/i],
  ['automacao-agentes', /agent|crawl|scrap|browser|workflow|mcp|automation|playwright|n8n|harness|rag/i],
]
const areaDe = (nome, texto) => {
  for (const [a, re] of AREAS) if (re.test(nome)) return a
  for (const [a, re] of AREAS) if (re.test(texto)) return a
  return 'dados'
}
const slug = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

function classeMedicao(medido) {
  if (!medido || /^n\/?d$/i.test(medido.trim())) return 'não testado'
  if (/NOT_TESTED/.test(medido) && !/\d/.test(medido.replace(/NOT_TESTED/g, ''))) return 'não testado'
  if (/estimad/i.test(medido)) return 'estimado'
  if (/calculad/i.test(medido)) return 'calculado'
  return 'medido'
}

// ---------- ferramentas ----------
const fonte = ler('bibliotecas.md')
let veredito = ''
const blocos = []
for (const parte of fonte.split(/\n(?=##+ )/)) {
  const h2 = /^## (.+)/.exec(parte)
  if (h2) {
    const chave = Object.keys(VEREDITO).find((k) => h2[1].startsWith(k) && (k !== 'OK para o cliente' || !h2[1].includes('risco')))
    veredito = VEREDITO[h2[1].startsWith('OK para o cliente, com risco') ? 'OK para o cliente, com risco' : chave] || veredito
    continue
  }
  const h3 = /^### (.+)/.exec(parte)
  if (!h3) continue
  const campo = (rotulo) => {
    const m = new RegExp('^- ' + rotulo + ': (.*)$', 'm').exec(parte)
    return m ? m[1].trim() : ''
  }
  blocos.push({
    nome: h3[1].trim(),
    veredito,
    link: campo('Link'),
    licenca: campo('Licenca').replace(/\s*Impacto:.*$/, ''),
    estrelas: campo('Estrelas / ultimo push / verificado'),
    projetos: campo('Projetos onde ajuda'),
    serve: campo('Para que serve / risco'),
    medido: campo('Medido'),
    descricao: campo('Descricao'),
  })
}

fs.rmSync(saida, { recursive: true, force: true })
const indice = []
for (const b of blocos) {
  const area = areaDe(b.nome, b.serve + ' ' + b.descricao)
  const precisaGpu = /Precisa de GPU: (Sim|Nao)/.exec(b.projetos)?.[1] === 'Sim'
  const pasta = path.join(saida, area, slug(b.nome))
  fs.mkdirSync(pasta, { recursive: true })
  const classe = classeMedicao(b.medido)
  const md = `---
name: ${slug(b.nome)}
description: ${b.nome} (${ROTULO[b.veredito] || b.veredito}). ${b.serve.replace(/\s+/g, ' ').slice(0, 220)}
---

# ${b.nome}

**Veredito da campanha (26 a 28/10/2026):** ${ROTULO[b.veredito] || b.veredito}. **Classe do dado:** ${classe}.

## Para que serve
${b.serve || b.descricao}

${b.descricao ? `> ${b.descricao}\n` : ''}
## O que foi medido
${b.medido && classe !== 'não testado' ? b.medido.replace(/ \/\/ /g, '\n- ').replace(/^/, '- ') : 'Esta ferramenta não entrou na bateria de testes. Não a apresente como funcionando: valide antes de depender dela.'}

## Hardware
${precisaGpu ? 'Precisa de GPU. Siga a skill `gpu-barata` para escolher e alugar (ligar, usar e desligar para não pagar parado).' : 'Roda sem GPU dedicada.'}

## Licença
${b.licenca || 'Conferir no repositório.'} Confira a licença do código e a dos pesos antes de usar em produto.

## Instalação e uso
Siga o README do repositório: ${b.link}
A campanha não padroniza comandos para esta ferramenta. Antes de rodar algo caro, faça um teste curto e confira a saída.

${area === 'rosto-avatar' || /voice|voz|rvc|clone/i.test(b.nome + b.serve) ? REGRA_CONSENTIMENTO : ''}
## Fonte
Skill \`projetos\` (campanha de benchmark da Rangel Tech). Números que mudam com o tempo (preço de GPU) valem na data da medição: confira o preço do dia.
`
  fs.writeFileSync(path.join(pasta, 'SKILL.md'), md)
  indice.push({ area, nome: b.nome, veredito: b.veredito, pasta: `${area}/${slug(b.nome)}`, serve: b.serve })
}

var REGRA_CONSENTIMENTO = `## Regra de uso (consentimento)
Use troca de rosto, reencenação e clonagem de voz **somente** com o rosto e a voz da própria pessoa ou de quem deu consentimento por escrito (por exemplo, o dono da agência gravando comerciais com o próprio rosto). **Recuse** personificar terceiro sem consentimento, conteúdo íntimo e golpes.

`

// ---------- visão geral ----------
const porVeredito = (v) => indice.filter((i) => i.veredito === v)
const lista = (itens) => itens.map((i) => `- **${i.nome}** (${i.area}): ${i.serve.replace(/\s+/g, ' ').slice(0, 140)}`).join('\n')

const vereditos = ler('vereditos.md')
const custo = ler('custo_por_unidade.md')
const matriz = ler('matriz_modelo_gpu.md')
const armadilhas = ler('armadilhas.md')
const corte = (t, n) => t.split('\n').slice(0, n).join('\n')

const geral = (nome, descricao, corpo) => {
  const pasta = path.join(saida, '_visao-geral', nome)
  fs.mkdirSync(pasta, { recursive: true })
  fs.writeFileSync(path.join(pasta, 'SKILL.md'), `---\nname: ${nome}\ndescription: ${descricao}\n---\n\n${corpo}\n\n> Fonte: campanha de benchmark da Rangel Tech (26 a 28/10/2026). Preço de GPU muda: confira o preço do dia.\n`)
}

geral(
  'gpu-barata',
  'Como escolher e usar GPU alugada pelo custo por tarefa: qual GPU para qual modelo, quantização, ligar e desligar para não pagar parado.',
  `# Escolher GPU alugada pelo custo por tarefa

Regra principal: **memória decide** (pesos + reserva de ~1 GiB + cache KV precisam caber); depois vem o custo por tarefa, não o preço por hora. Ligue só quando houver trabalho e **desligue ao terminar**; confirme que a instância está parada.

## Matriz modelo por GPU
${matriz}

## Regras e vereditos de servir modelo
${corte(vereditos, 40)}

## Armadilhas já pagas
${armadilhas}
`,
)
geral(
  'custo-por-unidade',
  'Preço medido por imagem, minuto de vídeo, hora de áudio, câmera e token, com a classe do dado (medido, calculado, estimado).',
  `# Custo por unidade (medido na campanha)

${custo}
`,
)
geral(
  'escolher-ferramenta',
  'Dado um objetivo (gerar imagem, transcrever, clonar voz, detectar objeto, servir LLM), qual ferramenta usar e qual não.',
  `# Escolher a ferramenta pelo objetivo

Pergunte: o que o usuário quer entregar? Depois escolha entre as ferramentas **ADOTAR**; só use as de **TESTAR** com um teste curto antes; **ESTUDAR** é ideia, não produto; **DESCARTAR** não use.

## Adotar
${lista(porVeredito('adotar'))}

## Testar (promissor, medir antes)
${lista(porVeredito('testar'))}

## Estudar (ideia útil, não adotar direto)
${lista(porVeredito('estudar'))}

## Descartar
${lista(porVeredito('descartar'))}

Cada ferramenta tem a sua skill em \`rangeltech/<área>/<ferramenta>\` com licença, o que foi medido e o hardware necessário.
`,
)

// skills escritas à mão (com scripts) substituem as geradas
const manuais = path.join(__dirname, 'skills-manuais')
if (fs.existsSync(manuais)) fs.cpSync(manuais, saida, { recursive: true, force: true })

fs.writeFileSync(path.join(saida, 'README.md'), `# Skills globais da Rangel Tech\n\nGeradas por \`scripts/gerar-skills-rangeltech.js\` a partir da campanha de benchmark de 26 a 28/10/2026. Somente leitura: copie para as suas skills para editar.\n\n${indice.length} ferramentas em ${new Set(indice.map((i) => i.area)).size} áreas.\n`)
console.log(`${indice.length} skills de ferramenta + 3 de visão geral em ${saida}`)
const porArea = {}
for (const i of indice) porArea[i.area] = (porArea[i.area] || 0) + 1
console.log(porArea)
