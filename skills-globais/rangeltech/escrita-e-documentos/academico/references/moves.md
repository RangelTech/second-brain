# Movimentos retóricos por seção

Cada seção de um texto acadêmico tem um trabalho argumentativo específico e uma sequência de movimentos que o leitor treinado espera. Escrever fora dessa sequência não é ousadia, é ruído: o revisor gasta atenção reconstruindo a ordem em vez de avaliando o conteúdo.

Carregue este arquivo quando for escrever ou revisar uma seção. As regras de voz continuam na `humanize`.

---

## Regras de parágrafo, válidas em todas as seções

Estas quatro governam o texto inteiro e resolvem a maior parte das queixas de "não flui".

1. **Um parágrafo, uma mensagem.** Se o parágrafo tem duas, são dois parágrafos.
2. **A mensagem vai na primeira frase.** O leitor que só lê tópicas precisa sair com o argumento inteiro.
3. **Substantivo autossuficiente.** Um termo só pode ser reusado depois de definido. Nada de "essa abordagem" apontando para três candidatos.
4. **Relação explícita entre frases consecutivas.** Toda frase se liga à anterior por causa, contraste, consequência, refinamento ou exemplo. Se você não consegue nomear a relação, ela não existe e o parágrafo está desmontado.

### Outline reverso

O teste mais barato de estrutura, e o que mais acha problema. Depois de escrever a seção:

1. Escreva a tese da seção em uma frase.
2. Liste as tópicas de cada parágrafo, na ordem, sem olhar o resto do texto.
3. Sob cada tópica, liste a evidência que aquele parágrafo traz.
4. Confira dois mapeamentos: cada tópica sustenta a tese, e cada evidência sustenta a sua tópica.
5. Parágrafo que não mapeia limpo é reescrito, movido ou cortado.

Se a lista de tópicas sozinha não conta a história, o problema é de estrutura e não adianta mexer em frase.

### Progressão dos títulos: O quê → Por quê → E daí

Títulos amadurecem em três estágios, e a maioria dos textos para no primeiro.

| Estágio | Exemplo | Quem escreve |
|---|---|---|
| **O quê** (descritivo) | "Resultados experimentais" | rascunho |
| **Por quê** (dirigido a problema) | "Por que abordagens lineares falham" | primeira revisão séria |
| **E daí** (alegação) | "O sistema X supera as baselines em 2 a 4x" | versão final |

**Teste:** um leitor que só lê os títulos consegue reconstruir o argumento? Se os títulos só nomeiam tópicos, ele não leva nada.

---

## Introdução: o modelo CARS (Swales, 1990)

Swales analisou um corpus grande de introduções publicadas e achou três movimentos recorrentes. Funciona porque resolve as duas competições reais de uma introdução: criar um espaço retórico e atrair o leitor para dentro dele.

### Movimento 1 — Estabelecer o território

Onde o trabalho vive e por que alguém deveria se importar.

- Passo 1: reivindicar centralidade do tema.
- Passo 2: generalizações sobre o tópico.
- Passo 3: revisar trabalho anterior.

Cuidado: este é o movimento que mais incha. Centralidade não é hype. "A área X tem recebido atenção crescente" não é reivindicação, é enchimento, e cai em §13 da `humanize`.

### Movimento 2 — Estabelecer o nicho

O movimento que a maioria dos rascunhos pula, e o que decide se o texto tem razão de existir. Quatro formas:

- **Contra-alegação:** a literatura afirma A, e há motivo para duvidar.
- **Indicar lacuna:** ninguém tratou B. A forma mais comum e a mais fácil de errar por exagero.
- **Levantar questão:** o trabalho anterior sugere, mas não responde, C.
- **Continuar tradição:** estender uma linha estabelecida.

A lacuna precisa ser verdadeira e verificável. Lacuna inventada é a alegação mais fácil de derrubar num review, porque basta o revisor conhecer um artigo.

### Movimento 3 — Ocupar o nicho

- Passo 1A: enunciar o propósito, ou 1B: anunciar a pesquisa.
- Passo 2: anunciar os achados principais.
- Passo 3: indicar a estrutura do artigo (opcional, e cada vez menos usado).

### Regras adicionais de introdução

- **Problema primeiro, método depois.** A primeira frase descreve o problema ou o domínio, nunca a tecnologia. Abertura por método posiciona o texto como "mais uma aplicação de X" e o coloca a competir com todos os outros. Abertura por problema o coloca a competir só com outras soluções daquele problema, que é uma disputa menor e mais ganhável. Em texto de ML, a técnica não deve aparecer antes do terceiro parágrafo.
- **"Neste artigo, nós..." é banido.** Abertura sem conteúdo. Comece pela alegação.
- **No máximo uma pergunta retórica**, e só na introdução.
- Cada alegação da introdução final aponta para uma subseção de resultado específica. Sem exceção.

---

## Abstract

Escrito por último, sempre. Ele resume o que ficou, não o que se pretendia.

Sequência que funciona na maioria das áreas:

1. Contexto e problema, uma ou duas frases.
2. A lacuna ou a tensão.
3. O que foi feito, incluindo o nome próprio do que foi construído ou medido.
4. Como foi avaliado, em uma frase.
5. Resultado principal, **com número**.
6. Implicação, uma frase, sem inflar.

Erros que aparecem sempre: adjetivo no lugar de número ("melhora significativa" em vez de "reduz o erro de 82 para 32"); prometer mais do que a avaliação entrega; e contagem de contribuições diferente da do corpo, que é §36.

---

## Related work

Não é uma lista. É o Movimento 2 executado com rigor: cada trabalho citado existe no texto para delimitar o nicho.

- Organize por **posição argumentativa**, não por ordem cronológica nem por autor.
- Cada bloco termina dizendo o que aquela linha não resolve, e esse "não resolve" precisa ser verdadeiro e verificável.
- Nunca caracterize trabalho alheio de forma que o autor dele não reconheceria. É o jeito mais rápido de ganhar um revisor hostil, porque frequentemente o autor citado *é* o revisor.
- Em veículos de sistemas, related work costuma ir depois da avaliação. Em ML, antes. Siga o veículo.

---

## Método

O leitor tem que conseguir reproduzir. Esse é o critério, e nenhum outro.

- Ordem: motivação do componente, projeto, vantagem técnica. Repita a tríade por componente.
- Nomeie cada componente, baseline, métrica e abstração. **Nome próprio no lugar de genérico** é o que separa um método citável de "uma abordagem em duas etapas". Se o trabalho introduz um conceito, batize, porque o nome é o que se torna citável.
- Decisão de projeto vem com a alternativa descartada e o motivo. Método sem alternativa descartada lê como o único caminho que o autor conhecia.
- Aqui mora a tentação de passiva. Ver a regra na SKILL.md: ativa por padrão, passiva só se a norma do veículo pedir.

---

## Resultados e avaliação

- **Organize por alegação, não por experimento.** Cada subseção responde "esta seção mostra que [alegação específica]". Se a subseção defende duas alegações, ela vira duas.
- **Alegações de tipos diferentes exigem avaliações separadas.** "O sistema funciona" e "o sistema melhora o resultado a jusante" pedem baselines, métricas e desenhos diferentes; misturar produz confusão.
- **Parágrafo Takeaway** ao fim de cada bloco. Ele diz o padrão, não repete o número. Este é o ponto de entrada de quem lê na diagonal, e é a exceção autorizada ao §2 da `humanize`.
  - Ruim: "Modelo A: 92%, B: 87%, C: 84%."
  - Bom: "Takeaway. A vantagem se concentra nas condições de maior ruído, e desaparece abaixo de 10 dB."
- Número negativo e resultado que contraria a hipótese ficam. Suprimi-los é má conduta, e além disso é o material de onde sai a seção de limitações.

---

## Discussão e conclusão

- Comece pelo achado, não por resumo do que já foi lido.
- Interprete até onde a evidência alcança e pare. A calibragem de confiança aqui é o §9 relaxado: *sugere*, *é consistente com*, *nos limites desta amostra*.
- Limitações são específicas e assumidas. "Mais pesquisa é necessária" não é limitação, é enchimento.
- Não termine com parágrafo de despedida sobre o futuro promissor do campo. É §13 da `humanize` em forma de seção inteira.

---

## Figuras e tabelas

Qualidade visual é conteúdo, não decoração. É a primeira coisa que o revisor olha e frequentemente decide a impressão antes da leitura.

- Uma figura teaser que passa a ideia central sozinha, e uma figura de pipeline.
- Tabela com o mínimo de tinta: sem linha vertical, sem grade completa, negrito só no melhor resultado.
- Legenda autossuficiente. O leitor entende a figura sem voltar ao corpo.
- Toda figura e tabela é referenciada no texto, e o texto diz o que ela mostra, não que ela existe.

---

## Compressão

Faixa normal de corte na passada final: **30% a 50%**.

- Acima de 50%: quase sempre a moldura estava errada e o corte foi de narrativa, não de gordura.
- Abaixo de 15%: o rascunho já estava perto do final, ou a compressão não foi feita de verdade.

Pergunta única para cada parágrafo: **ele serve a uma alegação explícita do texto?** Se não, sai.
