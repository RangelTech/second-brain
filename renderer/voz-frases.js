// Frases e regras puras da conversa por voz (spec 52), testadas em node: o que ele fala enquanto pensa ("Deixa eu pensar…"), a etapa
// do trabalho por categoria de ferramenta ("Estou lendo os arquivos"), o sorteio sem repetir, e as contas de texto do stream de voz
// (o servidor manda a fala ACUMULADA; aqui se tira o que já foi usado, se reconhece o eco da própria IA e o "para!" da pessoa).
;(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica()
  else raiz.SBVozFrases = fabrica()
})(typeof self !== 'undefined' ? self : this, function () {
  const ESPERA = ['Deixa eu pensar.', 'Hum, deixa eu ver.', 'Só um instante.', 'Estou pensando aqui.', 'Deixa eu ver isso.', 'Um segundinho.']
  const ESPERA_LONGA = ['Ainda estou nisso, já te falo.', 'Estou quase lá.', 'Só mais um pouquinho.', 'Está dando um pouco de trabalho, mas já volto.']
  // categoria da ferramenta (SBAtividade.categoriaDe) -> frases curtas da etapa, no jeito de quem conversa
  const ETAPA = {
    arquivos: ['Estou lendo os arquivos.', 'Deixa eu olhar os arquivos aqui.'],
    documentos: ['Estou mexendo no documento.', 'Deixa eu abrir o documento.'],
    planilhas: ['Estou olhando a planilha.', 'Estou mexendo na planilha.'],
    pesquisa: ['Deixa eu procurar aqui.', 'Estou procurando.'],
    web: ['Deixa eu pesquisar na internet.', 'Estou procurando na internet.'],
    navegador: ['Estou abrindo o navegador.', 'Deixa eu ver isso no navegador.'],
    redes: ['Estou olhando a rede social.', 'Deixa eu ver lá na rede social.'],
    codigo: ['Estou escrevendo o código.', 'Estou rodando um comando aqui.'],
    terminal: ['Estou rodando um comando aqui.', 'Estou mexendo no computador.'],
    memoria: ['Deixa eu lembrar.', 'Estou olhando minhas anotações.'],
    skills: ['Estou vendo o passo a passo.', 'Deixa eu ver como se faz isso.'],
    imagem: ['Estou criando a imagem.', 'Estou preparando a imagem.'],
    video: ['Estou preparando o vídeo.', 'O vídeo está saindo.'],
    voz: ['Estou cuidando do áudio.'],
    midia: ['Estou preparando a mídia.'],
    tarefas: ['Estou organizando as tarefas.'],
    agentes: ['Vou pedir uma ajuda aqui.', 'Chamei um ajudante para isso.'],
    escrever: ['Estou escrevendo a resposta.'],
  }
  // abertura por INTENÇÃO (pedido do Lucas 20/11): no instante em que o pedido sai, ele já diz o que vai fazer, como alguém que entendeu.
  // A ordem importa: a primeira que casar vale. Sem intenção clara: nada aqui (a frase de espera entra depois de ~1 s, se precisar).
  // palavra inteira mesmo com acento ("foto" não casa em "fotossíntese"): o \b do JavaScript não entende letra acentuada
  const palavra = (alts) => new RegExp('(?<!\\p{L})(' + alts + ')(?!\\p{L})', 'iu')
  const INTENCOES = [
    { id: 'internet', re: palavra('pesquis\\p{L}*|internet|google|cota[çc][ãa]o|not[íi]cias?|previs[ãa]o do tempo|clima|quanto (est[áa]|t[áa]) o'),
      frases: ['Vou dar uma procurada na internet, um momentinho.', 'Deixa comigo, vou buscar isso na internet.', 'Já vou pesquisar isso pra você.'] },
    { id: 'arquivos', re: palavra('arquivos?|pastas?|documentos?|planilhas?|pdf|computador|meu pc|no pc|[áa]rea de trabalho|desktop|downloads'),
      frases: ['Vou dar uma olhada aqui no seu computador, um momentinho.', 'Deixa eu procurar nos seus arquivos.', 'Já vou olhar isso no seu computador.'] },
    { id: 'codigo', re: palavra('c[óo]digo|programa\\p{L}*|script|sistema|aplicativo|app|landing|p[áa]gina de vendas'),
      frases: ['Beleza, vou colocar a mão na massa.', 'Deixa comigo, vou começar a construir.'] },
    { id: 'site', re: palavra('abr[ea]\\p{L}*|entr[ae] n[oa]|site|instagram|youtube|whatsapp|facebook|tiktok|linkedin'),
      frases: ['Vou abrir isso pra você.', 'Deixa comigo, já estou abrindo.'] },
    { id: 'midia', re: palavra('imagem|imagens|fotos?|v[íi]deos?|logo|desenh\\p{L}*|arte|anima[çc][ãa]o'),
      frases: ['Vou preparar isso pra você, já te mostro.', 'Deixa comigo, vou criar isso agora.'] },
    { id: 'pensar', re: palavra('explica\\p{L}*|analis\\p{L}*|compar\\p{L}*|planej\\p{L}*|estrat[ée]gia|por que|porque|como (eu )?(fa[çc]o|funciona)|me ajuda a'),
      frases: ['Hum, deixa eu pensar com calma.', 'Boa pergunta. Deixa eu pensar.', 'Deixa eu organizar as ideias.'] },
  ]
  // pergunta longa sem intenção reconhecida também ganha "deixa eu pensar"
  function intencao(texto) {
    const t = String(texto || '')
    for (const i of INTENCOES) if (i.frases.length && i.re.test(t)) return i.id
    return palavras(t).length >= 18 ? 'pensar' : null
  }
  function fraseDeAbertura(texto, sortear) {
    const id = intencao(texto)
    const i = id && INTENCOES.find((x) => x.id === id)
    return i ? sortear(i.frases) : null
  }
  const PARAR = new Set(['para', 'pare', 'parar', 'parou', 'chega', 'espera', 'espere', 'perai', 'peraí', 'ei', 'ow', 'calma', 'cala', 'silencio', 'nao', 'stop', 'ok', 'tá', 'ta', 'beleza', 'quero', 'eu', 'não', 'aí', 'ai', 'pera'])

  function todas() {
    return [...new Set([...INTENCOES.flatMap((i) => i.frases), ...ESPERA, ...ESPERA_LONGA, ...Object.values(ETAPA).flat()])]
  }
  // sorteia da lista sem repetir a última frase dita (de qualquer lista)
  function sorteador(rnd = Math.random) {
    let ultima = null
    return (lista) => {
      const op = lista.length > 1 ? lista.filter((x) => x !== ultima) : lista
      ultima = op[Math.floor(rnd() * op.length)] || lista[0]
      return ultima
    }
  }
  const fraseDaEtapa = (cat, sortear) => sortear(ETAPA[cat] || ESPERA)

  function palavras(t) {
    return String(t || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
  }
  // o servidor manda a fala inteira de novo a cada palavra: tira o começo que já foi usado (`prefixo` = último texto já consumido)
  function resto(texto, prefixo) {
    const t = String(texto || '').trim()
    if (!prefixo) return t
    const n = String(prefixo).trim().split(/\s+/).filter(Boolean).length
    return t.split(/\s+/).filter(Boolean).slice(n).join(' ')
  }
  // o microfone ouviu a própria IA (o cancelamento de eco deixou passar)? 60% das palavras de verdade estão no que ela está falando
  function ehEco(ouvido, falando) {
    const w = palavras(ouvido).filter((x) => x.length >= 3)
    if (!w.length) return false
    const f = new Set(palavras(falando))
    return w.filter((x) => f.has(x)).length / w.length >= 0.6
  }
  // fala curta só de "para", "ei", "espera", "não quero": interrompe e não vira pedido
  function soParar(t) {
    const w = palavras(t)
    return w.length > 0 && w.length <= 4 && w.every((x) => PARAR.has(x))
  }

  return { ESPERA, ESPERA_LONGA, ETAPA, INTENCOES, intencao, fraseDeAbertura, todas, sorteador, fraseDaEtapa, palavras, resto, ehEco, soParar }
})
