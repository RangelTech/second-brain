// Aplica o texto de venda (planos Lite/Max/Ultra, ecossistema de provedores, FAQ) em public/index.html. Uso único; fica no repo só como registro.
const fs = require('fs')
const p = 'public/index.html'
let s = fs.readFileSync(p, 'utf8')
const crlf = s.includes('\r\n')
s = s.replace(/\r\n/g, '\n')

function lista(nome, itens) {
  const re = new RegExp('(<h3>' + nome + '</h3>[^]*?<ul>)([^]*?)(</ul>)')
  if (!re.test(s)) throw new Error('card ' + nome)
  s = s.replace(re, (m, a, b, c) => a + '\n' + itens.map((i) => '          <li' + (i.nao ? ' class="nao"' : '') + '>' + (i.t || i) + '</li>').join('\n') + '\n        ' + c)
}
lista('Lite', [
  { t: '<b>IA com filtro de conteúdo</b> (censurada), em texto e em imagens' },
  'Uso básico: é a base de comparação (1x)',
  'Até 100 imagens por mês, com filtro',
  { t: 'Sem o pacote de skills profissionais: você instala as suas', nao: true },
  'Aplicativo para Windows, macOS e Linux e Web no celular',
  'Conecte o <b>ChatGPT</b> e o <b>Claude</b> que você já usa',
])
lista('Max', [
  '<b>IA sem censura</b>, em texto e também em <b>imagens</b>',
  '<b>Clonagem liberada</b>',
  '<b>5x o uso do Lite</b> em cada sessão',
  'Até <b>1.000 imagens por mês</b>, sem censura',
  '<b>Pacote de skills profissional já configurado:</b> vídeo, imagem, voz, web, dados, documentos, marketing, automação, código e mais, prontas para usar',
  '<b>Ecossistema de provedores:</b> o seu ChatGPT e o seu Claude Code trabalham junto com a nossa IA, com as mesmas skills e a mesma memória',
  'Prioridade na fila',
  'Tudo do Lite',
])
lista('Ultra', [
  '<b>20x o uso do Lite</b> (4x o do Max): o dia inteiro, para equipes e agências',
  '<b>IA sem censura</b> em texto e imagens, e <b>clonagem liberada</b>',
  'Até <b>4.000 imagens por mês</b>, sem censura',
  'Pacote de skills profissional completo e pré-configurado',
  'Prioridade máxima na fila',
  '<b>Ecossistema de provedores:</b> ChatGPT, Claude Code e a nossa IA orquestrados num lugar só',
  'Tudo do Max',
])

s = s.replace(/<ul class="destaques"[^>]*>[^]*?<\/ul>/, `<ul class="destaques" aria-label="Diferenciais">
      <li><b>IA sem censura</b>, em texto e em imagens, a partir do Max</li>
      <li><b>Clonagem liberada</b> a partir do Max</li>
      <li><b>ChatGPT e Claude Code</b> trabalhando junto com a nossa IA, em todos os planos</li>
    </ul>`)

s = s.replace('<p class="sub">A sua IA sem limite e sem enrolação. Faz o que você quiser, quando você quiser.</p>',
  '<p class="sub">A sua IA sem limite e sem enrolação. Faz o que você quiser, quando você quiser, e ainda coloca o ChatGPT e o Claude que você já tem para trabalhar junto.</p>')
s = s.replace('<meta name="description" content="A sua IA sem limite e sem enrolação. Faz o que você quiser, quando você quiser.">',
  '<meta name="description" content="A sua IA sem limite e sem enrolação, sem censura nos planos Max e Ultra. Conecte o ChatGPT e o Claude Code que você já usa e deixe todos trabalharem junto, com as mesmas skills.">')

if (!s.includes('id="ecossistema"')) {
  s = s.replace('<section id="planos" class="alt">', `<section id="ecossistema">
  <div class="wrap">
    <div class="tit"><h2>Um ecossistema para todas as IAs</h2><p>Você não precisa escolher. Conecte o <b>ChatGPT</b>, o seu <b>Claude Code</b> e outros provedores que você já paga e coloque todos para trabalhar junto com a nossa IA, num lugar só.</p></div>
    <div class="grade">
      <article class="cartao"><h3>Todos os provedores num lugar</h3><p>Claude, GPT e a nossa IA sem censura na mesma conversa. Você escolhe quem faz cada tarefa, sem trocar de programa.</p></article>
      <article class="cartao"><h3>O mesmo conhecimento para todos</h3><p>A memória das suas conversas e todas as nossas skills ficam disponíveis para qualquer IA conectada. Cada uma trabalha com o que as outras já sabem.</p></article>
      <article class="cartao"><h3>Aproveite o que você já paga</h3><p>Já tem Claude Code ou ChatGPT? Conecte a sua conta e use junto com o agente do Cérebro Pro, que controla o seu computador e usa as nossas ferramentas.</p></article>
    </div>
  </div>
</section>

<section id="planos" class="alt">`)
}

s = s.replace(/<details><summary>Posso usar o Claude e o GPT\?<\/summary><p>[^]*?<\/p><\/details>/,
  '<details><summary>Posso usar o ChatGPT e o Claude Code junto com a nossa IA?</summary><p>Sim, em todos os planos. Você conecta a sua conta do Claude, do GPT e de outros provedores e escolhe qual usar em cada conversa, ou deixa todos trabalharem juntos. Todos passam a ter acesso à mesma memória e às mesmas skills do Cérebro Pro.</p></details>')
s = s.replace(/<details><summary>Qual a diferença entre o Lite e os outros planos\?<\/summary><p>[^]*?<\/p><\/details>/,
  '<details><summary>Qual a diferença entre o Lite, o Max e o Ultra?</summary><p>O Lite tem filtro de conteúdo (censura), em texto e em imagens, e não traz o pacote de skills. A partir do Max a IA é <b>sem censura</b> (inclusive nas imagens), a clonagem é liberada e o pacote de skills profissional já vem configurado. Entre o Max e o Ultra a diferença é a quantidade de uso: o Max dá 5 vezes o uso do Lite e o Ultra dá 20 vezes, com mais imagens por mês.</p></details>')

fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s)
console.log('texto aplicado')
