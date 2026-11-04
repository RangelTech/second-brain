# Perfis de gênero

O gênero decide estrutura, registro e quais padrões da `humanize` mudam. Errar o gênero é o erro mais caro, porque nenhuma quantidade de revisão de frase conserta um artigo de blog escrito como paper.

---

## 1. Acadêmico

Artigo, tese, dissertação, TCC, submissão a periódico ou conferência.

**Leitor:** revisor cético, com obrigação institucional de encontrar defeito. Ele lê para rejeitar, e o texto tem que sobreviver a isso.

**Estrutura:** IMRaD (Introdução, Método, Resultados e Discussão), com a introdução seguindo CARS. Ver [`moves.md`](moves.md).

**Registro:** neutro, impessoal ou primeira pessoa do plural conforme a área. Zero reação do autor.

**Particularidades de texto brasileiro de banca:**

- Tese e TCC carregam seções que artigo não tem: justificativa, objetivos geral e específicos, referencial teórico. Objetivo específico precisa ser verificável, ou seja, redigido com verbo que dá para checar se foi cumprido. "Compreender a dinâmica" não dá; "medir a variação de X entre Y e Z" dá.
- Objetivo específico não cumprido no corpo é a primeira coisa que a banca cobra. Antes de entregar, mapeie cada objetivo à seção que o cumpre, do mesmo jeito que o mapa de alegação para evidência.
- Norma ABNT com as particularidades em [`citations.md`](citations.md).

**Onde o texto morre:** introdução que promete o que os resultados não entregam; lacuna inventada; alegação técnica sem citação; contagem de contribuições inconsistente.

---

## 2. Profissional

Relatório técnico, white paper, RFC interno, post-mortem, parecer, documento de decisão.

**Leitor:** decisor com pouco tempo, que vai **agir** a partir do texto. Ele não vai ler tudo, e vai agir de qualquer jeito.

**Estrutura:** o inverso da acadêmica. A conclusão vem primeiro.

1. **Recomendação ou achado, no topo.** Uma ou duas frases. Se o leitor parar aqui, ele tem que sair com a informação certa.
2. Contexto mínimo para entender a recomendação.
3. Evidência que a sustenta.
4. Alternativas consideradas e por que foram descartadas.
5. Risco, custo e o que acontece se nada for feito.
6. Próximos passos, com dono e prazo.

**Registro:** sóbrio como o acadêmico, mas a recomendação é explícita e assinada. Texto que não recomenda nada não é relatório, é apanhado.

**Regras próprias:**

- Incerteza é declarada com sua consequência prática. "Não sei o volume exato, mas a decisão é a mesma entre 1 e 10 milhões de linhas" é útil; "os dados são limitados" não é.
- Se o documento vira DOCX, a skill `relatorio` cuida do continente. As duas se compõem: `academico` decide o argumento, `relatorio` monta o arquivo, `humanize` escreve a frase.
- Post-mortem: sem nome de culpado, com linha do tempo factual e causa raiz. Isso é decisão de gênero, não de gentileza, porque documento que procura culpado deixa de receber informação na próxima vez.

**Onde o texto morre:** enterrar a recomendação na página 4; listar problema sem propor ação; jargão corporativo, que é §27 da `humanize` e o padrão mais frequente aqui.

---

## 3. Divulgação técnica

Medium, Substack, dev.to, blog de engenharia.

**Leitor:** voluntário. Não deve nada a você e abandona em segundos. Toda a estrutura decorre disso.

### A regra que sustenta o gênero

**Tem que haver um artefato real no centro.** Código que rodou, reprodução que foi feita, experimento que foi medido, incidente que foi vivido. Post sem artefato vira opinião genérica, e é aí que a voz desmorona e o texto passa a soar como conteúdo de marketing.

Antes de escrever, identifique o artefato. Se não existe, diga isso ao usuário em vez de escrever mesmo assim.

### Voz

Esta é a maior divergência em relação ao acadêmico, e é onde a `humanize` **preserva** em vez de aparar.

- **Primeira pessoa do singular.** "Eu tentei", "eu suspeito", "achei estranho que".
- **Hedge epistêmico é bem-vindo e honesto:** *eu suspeito*, *provavelmente*, *até onde consegui ver*. Ele marca o que é interpretação contra o que foi medido. O que não entra é hedge retórico corporativo ("poder-se-ia argumentar que"), que é armadura, não honestidade.
- **Aparte entre parênteses é liberado.** Dão cor sem travar o fluxo.
- **Jargão sem pedir licença.** O leitor é inteligente e curioso. Nada de "vou explicar em termos simples".
- **Entusiasmo aparece por precisão, não por adjetivo.** Não escreva "isso é muito legal". Escreva "3.000 vezes mais rápido", "de 82 para 32 erros, cerca de 60% menos". Adjetivo é barato; multiplicador é conquistado.

### Estrutura

**Abertura:** um parágrafo curto, um gancho só. Nunca empilhe ganchos. Escolha um:

- gancho histórico ou de significância;
- enquadramento pessoal ("eu nunca tinha prestado atenção em...");
- declaração de construção do zero ("vamos implementar X em Python puro, sem dependência");
- epígrafe, se ela genuinamente enquadra o texto.

**Miolo:**

- Parágrafos de 2 a 4 frases. Em tela, parágrafo longo é abandonado.
- Tópica na frente, às vezes em negrito ou como pergunta. Aqui o §19 da `humanize` está relaxado: tópica em negrito é convenção de leitura, não decoração.
- Subtítulos frequentes, porque o leitor escaneia antes de ler.
- Resultado embutido no fluxo, na hora em que aparece, não numa seção "Resultados" no fim.
- Analogia de domínio vizinho: use **uma vez** e volte ao vocabulário técnico. Metáfora esticada vira §9 da `humanize`.

**Fechamento:** escolha um, nunca os três.

- extrapole para a frente;
- termine com irreverência casual;
- deixe ponteiros: repositório, leitura, exercício.

Não escreva uma seção "Conclusão" que recapitula. Recapitulação é para quem escreve, não para quem lê.

### Anti-padrões específicos deste gênero

- Nada de verbo de marketing: "desbloqueie o poder de", "no cenário em rápida evolução", "vamos mergulhar fundo". São §16 e §4 da `humanize`.
- Nada de emoji de enfeite. 🚀 ✨ 🎉 não. Um emoticon que carrega a piada é outra coisa.
- Nada de "Obrigado por ler!" nem pedido de inscrição no fim. Pare quando terminar.
- Não terceirize autoridade para uma lista de veículos onde você foi citado. É §17.

### O que continua valendo do rigor acadêmico

O gênero é solto, a factualidade não. Número citado continua precisando ser real, benchmark continua precisando dizer em que máquina rodou, e afirmação sobre trabalho alheio continua precisando estar certa. Blog não é licença para afrouxar verificação; é licença para afrouxar **registro**.
