# Citações e verificação de fonte

A parte da escrita assistida por modelo que mais dá errado, e a que tem consequência mais grave. Referência inventada não é erro de estilo: é má conduta acadêmica quando chega ao revisor, independente de ter sido intencional.

---

## Por que isso é obrigatório, e não cautela

Taxas de referência alucinada medidas na literatura:

| Fonte | Modelo | Taxa |
|---|---|---|
| Revisões sistemáticas | GPT-3.5 | 39,6% |
| Revisões sistemáticas | GPT-4 | 28,6% |
| Revisões sistemáticas | Bard | 91,4% |
| Cuidados críticos / neuro | GPT | 27% das referências |
| Cuidados críticos / neuro | Grok | 50% das referências |
| Benchmark de 13 modelos | vários | 14% a 95% |

E a variação por área importa muito na hora de calibrar esforço:

- **Humanidades: 89,4% de DOI alucinado.**
- **Ciências naturais: 29,1%.**

A diferença tem explicação simples: quanto menos o objeto citado aparece no treino, mais o modelo preenche com o plausível. Citação rara, obra antiga, autor pouco citado e literatura não anglófona são exatamente onde a taxa sobe.

Some-se a isso que 3% a 13% das URLs citadas nunca existiram, sem registro nem no Wayback Machine, e 5% a 18% não resolvem.

**Regra operacional: nenhuma referência produzida por modelo entra no texto sem verificação.** Inclusive as que "obviamente existem". A intuição de plausibilidade é justamente o que o modelo otimiza.

---

## Protocolo de verificação

### Ordem das fontes

1. **Semantic Scholar** — melhor cobertura em computação e biomédicas, boa desambiguação de autor. Tem rate limit agressivo sem chave de API.
2. **OpenAlex** — agrega Crossref, PubMed, ORCID, arXiv. Cobertura ampla de acesso aberto e preprint. Busca estrita por token, sem fuzzy.
3. **Crossref** — autoridade canônica de DOI. Sem chave, sem rate limit rígido. Aceita "polite pool" se você mandar um e-mail no User-Agent, o que melhora a latência.

O script roda essa cadeia. Use `--mailto seu@email` para entrar no polite pool do Crossref.

### Pontuação de confiança

Cada candidato recebe nota de 0 a 100:

- **Título: peso 0,6** (similaridade fuzzy)
- **Autores: peso 0,2** (sobreposição)
- **Ano: peso 0,2** (igualdade)

Interpretação:

| Faixa | Status | O que fazer |
|---|---|---|
| ≥ 85 e sem conflito duro | verificada | segue |
| 60 a 85 | possível correspondência | **humano decide**, nunca o modelo |
| < 60 | não verificada | tratar como inexistente até prova documental |

### Conflitos duros contra brandos

Nem toda divergência derruba uma referência. A distinção importa, porque tratar tudo como erro gera ruído e faz o usuário ignorar o relatório.

**Duro (bloqueia):**
- Obra não encontrada em nenhuma das três bases.
- Divergência grande de título com DOI batendo, ou o contrário.
- Autor diferente, não apenas grafado diferente.
- Ano diferente sem explicação de versão.

**Brando (registra e segue):**
- Inicial contra nome completo, ordem de sobrenome, acento.
- Preprint arXiv contra versão publicada em periódico. Muito comum e raramente erro.
- Diferença de versão (v1 contra v3).
- Nome de veículo abreviado contra extenso.

### O limite que precisa ser dito

**Nenhuma API acadêmica gratuita pega erro de digitação em palavra distintiva do título.** Testado em Semantic Scholar, OpenAlex e Crossref: todas fazem correspondência por token, e uma palavra escrita errada some do índice. Buscar por "Atention Is All You Need" devolve artigos que casam com "All You Need" e não o artigo real.

O fuzzy matching cobre variação **estilística**: caixa, pontuação, ordem de palavras, pequena reformulação. Não cobre typo.

Consequência prática: "não encontrado" tem duas causas possíveis, alucinação e erro de digitação, e o script não distingue. Sempre confira o título à mão antes de concluir que a obra não existe. Resolver isso de verdade exigiria embedding semântico, que é API paga.

### Quando não há acesso à rede

Sem verificação possível, a regra muda de "verifique" para **"não cite"**. As alternativas, em ordem de preferência:

1. Citar apenas obras que o usuário forneceu e possui.
2. Escrever a alegação sem citação e marcar `[CITAÇÃO NECESSÁRIA]` de forma visível, para o usuário preencher.
3. Enfraquecer a alegação até o ponto em que ela não precise de fonte externa.

Nunca produzir uma referência "provavelmente correta" para preencher.

---

## Consenso entre modelos

Um achado útil quando não dá para verificar contra base: concordância entre três ou mais modelos independentes eleva a acurácia de citação de 16,5% para 95,6%, e a repetição dentro do mesmo modelo eleva de 28,6% para 88,9%.

Isso é um **paliativo**, não substituto. Verificação contra Crossref continua sendo a única prova. Use consenso só para priorizar o que checar primeiro quando a lista é grande.

---

## Citação de texto, não só de existência

Referência que existe ainda pode estar sendo usada errado. Os três erros, em ordem de frequência:

1. **Citação que não sustenta a alegação.** A obra existe, o autor existe, e ela não diz aquilo. É o erro mais comum e o mais difícil de pegar automaticamente. A única defesa é ter lido, ou pelo menos ter lido o abstract e o trecho relevante.
2. **Citação de segunda mão apresentada como primeira.** Se você leu em B que A disse algo, ou lê A, ou cita como *apud*. Nunca finja ter lido A.
3. **Alegação técnica que perde a citação ao migrar de seção.** Uma seção de projeto repete um modo de falha estabelecido com citação no referencial, e larga as citações pelo caminho. O resultado parece asserção sem evidência. Ao terminar qualquer seção, varra as alegações técnicas: cada uma tem citação ou referência cruzada explícita à seção onde a citação mora.

---

## Normas de estilo

A norma é escolhida pelo veículo, nunca pelo autor. Confirme antes de formatar.

| Norma | Onde | Formato no texto | Ordem da lista |
|---|---|---|---|
| **ABNT** NBR 6023/10520 | Brasil, quase tudo | (SOBRENOME, 2024, p. 12) ou Sobrenome (2024) | alfabética |
| **APA** 7 | psicologia, educação, ciências sociais | (Sobrenome, 2024) | alfabética |
| **IEEE** | engenharia, computação | [1] | ordem de aparição |
| **Vancouver** | biomédicas | sobrescrito ou (1) | ordem de aparição |
| **ABNT numérico** | variante aceita | [1] ou 1 | ordem de aparição |

Detalhes que mais geram correção em banca brasileira:

- ABNT: sobrenome em caixa alta **só** dentro do parêntese; no corpo do texto vai em caixa normal.
- ABNT: citação direta com mais de três linhas vira recuo de 4 cm, fonte menor, sem aspas, espaçamento simples.
- ABNT: `et al.` a partir de quatro autores na citação; na referência a regra depende da edição adotada pela instituição, então confirme com o guia do programa.
- APA 7: `et al.` já a partir de três autores, diferente da ABNT.
- Toda citação direta exige página. Sem exceção, em qualquer norma.

Quando o usuário não souber a norma, pergunte antes de formatar cinquenta referências no padrão errado.

---

## Gestão de bibliografia

- Fonte única da verdade: um `.bib` ou um gerenciador (Zotero, Mendeley, JabRef). Referência que só existe dentro do texto se perde.
- Chave de citação estável e legível: `sobrenome2024palavra`.
- Guarde o DOI sempre que existir. É o único identificador que sobrevive a mudança de URL.
- Antes de submeter: confira que toda entrada da bibliografia é citada no corpo, e que toda citação do corpo tem entrada. As duas direções.
- Rode o verificador de novo na versão final. Referência entra tarde no processo, quando a atenção já caiu, e é exatamente aí que a não verificada passa.
