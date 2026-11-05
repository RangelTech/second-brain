---
name: academico
description: |
  Escrita academica e profissional de fundo: artigo cientifico, tese, TCC, relatorio
  tecnico profissional, white paper e artigo de blog tecnico (Medium, Substack, dev.to).
  Cobre estrutura (IMRaD, CARS/Swales), mapa de alegacao para evidencia, citacoes e
  verificacao de fontes contra Crossref/OpenAlex/Semantic Scholar, deteccao de
  referencia alucinada, normas de estilo (ABNT, APA, IEEE, Vancouver), politica de
  disclosure de uso de IA (ICMJE 2026, COPE) e revisao adversarial pre-submissao.
  Academic and professional writing: papers, theses, technical reports, blog posts,
  citation verification, hallucinated-reference detection, claim-evidence mapping.
  Consome a skill `humanize`, que continua sendo a base de voz e ritmo.
  Aciona com: "escreva o artigo", "revise minha tese", "monta o TCC", "confere as
  referencias", "verifica se essa citacao existe", "artigo pro Medium", "review
  adversarial", "isso tem embasamento?".
license: MIT
metadata:
  version: "1.0.0"
  consumes: humanize
---

# academico: escrita de fundo com fonte verificada

> **PRIMEIRA AÇÃO, ANTES DE QUALQUER OUTRA COISA: invoque a skill `humanize`.**
> Use a ferramenta Skill com `skill: humanize`. Não é opcional e não é sugestão de leitura.
> Esta skill declara ajustes que se referem a padrões numerados (§1 a §36) que vivem **só**
> na `humanize`; sem ela carregada você tem as exceções sem as regras, e vai escrever com
> os tells que o ajuste pressupõe eliminados. Não há encadeamento automático entre skills:
> se você não invocar, ela não vem. Só siga para a próxima seção depois de invocar.

Esta skill cuida do **argumento**: o que o texto afirma, o que sustenta cada afirmação, em que ordem isso aparece e se a fonte citada existe de verdade. A voz e o ritmo continuam sendo da [`humanize`](../humanize/SKILL.md), que é a base da árvore.

A regra que organiza tudo: **uma alegação sem evidência rastreável não entra no texto.** O resto são detalhes de gênero.

## Os três gêneros

O gênero decide estrutura, registro e quais padrões da `humanize` mudam. Identifique antes de escrever uma linha.

| Gênero | Exemplos | Estrutura | Leitor |
|---|---|---|---|
| **Acadêmico** | artigo, tese, TCC, dissertação, submissão a periódico ou conferência | IMRaD + CARS | revisor cético, obrigado a encontrar defeito |
| **Profissional** | relatório técnico, white paper, RFC interno, post-mortem, parecer | problema, evidência, recomendação | decisor com pouco tempo, que vai agir |
| **Divulgação** | Medium, Substack, dev.to, blog de engenharia | gancho, artefato, resultado, implicação | leitor voluntário, que abandona em 10 segundos |

Detalhe de cada um em [`references/genres.md`](references/genres.md).

## Contrato com a `humanize`

A `humanize` permite exatamente três coisas a uma skill consumidora. Aqui estão as três, declaradas.

### 1. Voz por gênero

- **Acadêmico.** Primeira pessoa do plural quando o campo aceita ("medimos", "we evaluate"); impessoal quando a norma do periódico exige. Registro neutro. Nenhuma reação do autor, nenhum humor, nenhum aparte. A seção "Voice" da `humanize` manda texto de referência ficar neutro e liso, e é exatamente isso.
- **Profissional.** Igual ao acadêmico na sobriedade, mas a recomendação é explícita e assinada. Quem vai ler precisa saber o que fazer na segunda-feira.
- **Divulgação.** Primeira pessoa do singular, voz presente, aparte permitido. Aqui a `humanize` **preserva** opinião, incerteza e humor, em vez de aparar.

### 2. Padrões endurecidos e relaxados

Nenhum padrão é reescrito aqui, só ajustado pelo número.

**Endurecidos:**

| Padrão | Ajuste | Por quê |
|---|---|---|
| §17 borrowed authority | De "corte o não sustentado" para **toda alegação técnica precisa de citação verificada ou referência cruzada explícita** | Alegação técnica sem citação lê como asserção vazia pro revisor. É o padrão que mais derruba texto acadêmico |
| §12 e §13 | Lista de gênero adicionada: *novel, significant, substantial, impressive, promising, comprehensive, robust, powerful, state-of-the-art, paradigm, leverage, utilize* e os equivalentes PT (*inovador, significativo, robusto, abrangente, promissor, estado da arte*) | Afirmam qualidade em vez de mostrá-la. Troque por um número ou apague |
| §35 term drift | De "convirja os sinônimos" para **um termo canônico por conceito, fixado antes de escrever e nunca variado** | Em texto longo o revisor não consegue saber se dois nomes são um conceito ou dois |
| §36 count drift | Erro bloqueante, não *weak alone* | "Três contribuições" no abstract e quatro no corpo é rejeição fácil |
| §21 bullets | Em artigo e tese, prosa por padrão. Lista só para itens genuinamente paralelos (condições experimentais, critérios de inclusão) | Raciocínio picado em bullet esconde ausência de argumento |
| §4 staged run-up | "Neste artigo, nós..." e "Nesta seção, descrevemos..." são **banidos**, não só desencorajados | Abertura sem conteúdo. Comece pela alegação |

**Relaxados:**

| Padrão | Ajuste | Por quê |
|---|---|---|
| §9 stacked qualifiers | **Relaxado de forma substantiva.** *sugere*, *é consistente com*, *pode indicar*, *nos limites desta amostra* são registro científico correto, não hedge covarde | Calibrar confiança à evidência é obrigação epistêmica. O que continua banido é o **empilhamento** ("poderia potencialmente talvez"), que é reparo de exagero anterior |
| §2 one-line closers | Um parágrafo **Takeaway** ao fim de cada bloco de resultados é permitido | É convenção de gênero e carrega interpretação nova, não repetição. Se só repete o número, volta a ser §2 |
| §11 passive voice | Ver abaixo, depende da área | |
| §19 negrito e §21 bullets | Relaxados **só no gênero divulgação** | Tópica em negrito e lista são convenção de leitura em tela |
| §8 travessão | No gênero divulgação, vale a regra de amostra da `humanize`: se o autor usa travessão, mantenha a taxa dele | Em artigo e tese continua banido sem exceção |

**A questão da voz passiva, honestamente.** A melhor fonte que encontrei (SNL-UCSB) bane passiva com zero exceções, mas é um grupo de sistemas/redes, e isso não generaliza. APA 7 recomenda voz ativa e primeira pessoa. Boa parte da literatura biomédica e das humanidades ainda espera passiva em métodos. **Regra:** ativa por padrão, porque nomeia quem fez; relaxe para passiva apenas onde o guia do periódico alvo pedir, e diga ao usuário que relaxou e por quê. Nunca relaxe "porque soa mais científico".

### 3. Lista de congelados, estendida

Além do que a `humanize` já congela na seção de relatório de dados, aqui **nada disso pode ser tocado numa reescrita**:

- Toda citação e todos os seus metadados: autor, ano, título, periódico, DOI, páginas.
- Texto entre aspas de fonte externa, incluindo travessão dentro dele.
- Número de resultado, estatística, intervalo de confiança, p-valor, tamanho de efeito, n amostral.
- Redação de hipótese e de pergunta de pesquisa.
- Número de aprovação ética, registro de ensaio, número de processo de fomento.
- Termo canônico, depois de fixado.

## O pipeline

Ordem importa. As duas armadilhas mais caras são escrever a introdução antes de ter resultado, e polir um texto cuja moldura está errada.

1. **Contexto.** Antes de escrever, fixe: pergunta de pesquisa, contribuições em uma frase cada, veículo alvo, norma de citação, limite de páginas, glossário de termos canônicos. Sem isso o resto retrabalha.
2. **Introdução Rascunho 0.** Uma introdução deliberadamente descartável, escrita cedo, só para amarrar o que o trabalho *tenta* mostrar. Ela é guarda-corpo da avaliação, não começo do texto final.
3. **Corpo.** Método e resultados, que é onde a evidência de fato nasce.
4. **Mapa de alegação para evidência.** Gate obrigatório, abaixo.
5. **Introdução final, do zero.** Não edite a Rascunho 0. Reescreva em folha em branco, limitada ao que a evidência sustenta. Cada alegação da introdução tem que apontar para uma subseção de resultado específica.
6. **Abstract, por último.** Ele é o resumo do que ficou, não do que se pretendia.
7. **Verificação de referências.** Roda o script. Nenhuma referência não verificada sobrevive.
8. **Auditoria mecânica + `humanize`.** Grep primeiro, julgamento depois. Depois disso, rode a régua de 3 pontos da skill [`testes_relatorios`](../testes_relatorios/SKILL.md) com o rascunho pré-humanize e o texto final: ela mede se o resultado ainda soa gerado e diz qual padrão corrigir. Máximo de 2 reescritas, e nunca mexer no texto só para baixar o número.
9. **Revisão adversarial.** Leia como revisor que quer rejeitar.
10. **Compressão.** 30% a 50% é a faixa normal. Acima de 50% costuma significar que a moldura estava errada, não que o texto estava gordo.

Por que a introdução duas vezes: sem a Rascunho 0, a avaliação é desenhada sem saber o que está tentando mostrar. Sem a reescrita final, a introdução promete o que se esperava achar em vez do que se achou, e é assim que o texto é rejeitado.

Quando a identidade do texto muda, **reescreva do zero**; não polir. Decisão de moldura fica cozida na estrutura da frase, e polimento não a desfaz.

## Mapa de alegação para evidência

Gate duro. Antes de finalizar qualquer coisa, monte a tabela:

```
Alegação: ... | Onde aparece: ... | Evidência: ... | Status: sustentada | precisa de evidência | não sustentada
```

Regras:

- Toda alegação do abstract e da introdução precisa de linha na tabela.
- `precisa de evidência` bloqueia a entrega. Ou acha a evidência, ou **enfraquece a alegação até o que a evidência sustenta**, ou corta.
- Nunca resolva uma lacuna inventando evidência, número ou citação. A regra de no-fabrication da `humanize` vale aqui em cima de tudo e não é relaxável.
- Se duas alegações são de tipos diferentes ("funciona" e "melhora o resultado a jusante"), elas precisam de seções de avaliação separadas, com baseline e métrica próprios.

## Citações e verificação de fonte

Esta é a parte que mais importa e a que mais dá errado.

**O tamanho do problema, medido.** As taxas de referência alucinada por LLM que a literatura reporta: 39,6% no GPT-3.5, 28,6% no GPT-4, 91,4% no Bard; 27% das referências do GPT e 50% das do Grok num estudo de cuidados críticos; entre 14% e 95% num benchmark de 13 modelos. E a variação por área é brutal: 89,4% de DOI alucinado em humanidades contra 29,1% em ciências naturais.

**Consequência operacional: nenhuma referência produzida por modelo entra no texto sem passar pelo verificador.** Não é cautela, é a taxa base.

Protocolo completo, normas de estilo e limites do método em [`references/citations.md`](references/citations.md). O verificador executável está em [`scripts/verify_refs.py`](scripts/verify_refs.py) e consulta Crossref, OpenAlex e Semantic Scholar.

Um limite que precisa ser dito de cara: **nenhuma API acadêmica gratuita pega erro de digitação em palavra distintiva do título.** Todas fazem busca por token, e uma palavra escrita errada simplesmente não está no índice. Elas pegam variação estilística (caixa, pontuação, ordem). Título com typo volta como "não encontrado", que é o comportamento seguro, mas não confunda isso com prova de que a obra não existe.

## Disclosure de uso de IA

Desde a revisão de 2026 o ICMJE tem seção própria sobre IA, e COPE e WAME convergem nos mesmos três princípios: **IA não é autor; o autor humano continua integralmente responsável; o uso relevante precisa ser declarado.** A pergunta deixou de ser se declara e passou a ser onde e com que detalhe.

Na prática, ao entregar texto acadêmico:

1. Pergunte qual é o veículo e verifique a política dele. Elas divergem em detalhe.
2. Ofereça a redação da declaração de uso, normalmente em carta de apresentação e em nota no manuscrito.
3. Lembre o usuário que conferir cada conteúdo gerado é obrigação dele, não da ferramenta. Especialmente as referências.

**Sobre detectores de IA.** Otimizar texto acadêmico para passar em detector é mau negócio, por três razões concretas. Detector é pouco confiável: sete detectores marcaram 61,3% de falso positivo em redações de TOEFL contra quase zero em texto de nativo, e numa turma da UC Davis 15 de 17 alertas eram falsos, concentrados em não nativos e em quem usou monitoria de escrita. A política que vale é a de disclosure do veículo, não o placar de uma ferramenta. E o que baixa placar de detector é exatamente o que a `humanize` já faz por outro motivo: frase com variação real, termo específico, alegação calibrada. Escreva bem, declare o uso conforme a norma, e não persiga score.

## Auditoria mecânica

Grep antes de julgamento, e **reporte as contagens, não "auditei"**. Passada mental não conta. Rode:

```bash
python scripts/style_audit.py caminho/do/texto.tex      # ou .md, .txt
```

O script cobre a camada regex: travessão, passiva, antítese, abre-boca, adjetivo banido, palavra pomposa, verbo de mecanismo vago, prolixidade, ordinal falso, exclamação, deriva de termo e de contagem. Cada acerto é corrigido ou justificado explicitamente antes de declarar pronto.

O que regex não pega fica com o leitor: definir antes de usar, seguibilidade, coerência de alegação, calibragem de confiança. Isso é a revisão adversarial.

## Revisão adversarial

Leia como revisor que precisa achar motivo para rejeitar, nas cinco dimensões: contribuição, clareza de escrita, força experimental, completude da avaliação, solidez do método. Escreva as objeções mais fortes contra o próprio texto e resolva cada uma, ou registre como limitação assumida. Limitação declarada é barata; limitação descoberta pelo revisor é cara.

## Arquivos de referência

Carregue só o que a tarefa pede. Não carregue todos de uma vez.

- [`references/moves.md`](references/moves.md) — movimentos retóricos por seção: CARS/Swales para introdução, abstract, método, resultados, discussão, related work. Títulos O quê → Por quê → E daí.
- [`references/citations.md`](references/citations.md) — protocolo de verificação, ABNT/APA/IEEE/Vancouver, referência alucinada, gestão de bibliografia.
- [`references/genres.md`](references/genres.md) — perfis completos dos três gêneros, incluindo Medium e relatório profissional.
- [`scripts/verify_refs.py`](scripts/verify_refs.py) — verificador de referências.
- [`scripts/style_audit.py`](scripts/style_audit.py) — auditoria mecânica.

## Fontes

Metodologia de pipeline, gates e princípios editoriais adaptados de [SNL-UCSB/paper-writing-skill](https://github.com/SNL-UCSB/paper-writing-skill) (MIT), cujos princípios vêm de análise de mais de 7.600 edições e 5 ciclos de revisão por pares. Estrutura de seção e checagem de fluxo de parágrafo de [Master-cai/Research-Paper-Writing-Skills](https://github.com/Master-cai/Research-Paper-Writing-Skills) (MIT), que compila as notas abertas do Prof. Peng Sida. Verificação de citação modelada em [JonasBaath/mcp-refchecker](https://github.com/JonasBaath/mcp-refchecker) (MIT). Voz de divulgação técnica destilada de [IrtezaAsadRizvi/article-writing-skills](https://github.com/IrtezaAsadRizvi/article-writing-skills). Modelo CARS de Swales (1990). Políticas de disclosure: ICMJE (revisão de 2026, seção V) e COPE.
