---
name: testes_relatorios
description: |
  Validacao do que as skills de escrita produzem, em texto e em imagem. Mede se um
  texto ainda soa gerado por IA usando o detector desklib (lider do RAID benchmark)
  rodando local, numa regua de 3 pontos: humano de referencia, texto antes da
  humanize e texto depois. Decide se vale reescrever e fecha o laco. Tambem faz QA
  visual dos graficos e diagramas gerados pela skill `relatorio`, lendo o PNG e
  conferindo sobreposicao, rotulo faltando, texto vazando da caixa e idioma trocado.
  Validation harness for AI-written text and generated charts.
  Aciona com: "testa o texto", "isso parece IA?", "roda a regua", "valida o
  relatorio", "confere os graficos", "passou no detector?", "valida antes de enviar".
license: MIT
metadata:
  version: "1.0.0"
  consumes: humanize
---

# testes_relatorios: a validacao da arvore

> **PRIMEIRA AÇÃO: invoque a skill `humanize`.** Use a ferramenta Skill com `skill: humanize`.
> Esta skill reprova texto citando padrões numerados (§1 a §37) que vivem só lá, e o laço
> de reescrita precisa deles para saber o que corrigir. Não há encadeamento automático
> entre skills: se você não invocar, ela não vem.

Esta é a quarta skill da árvore de escrita. As outras três produzem; esta **mede**.

| Skill | Papel |
|---|---|
| [`humanize`](../humanize/SKILL.md) | a base: voz, ritmo, os 37 padrões |
| [`relatorio`](../relatorio/SKILL.md) | o continente: DOCX, diagramas, layout |
| [`academico`](../academico/SKILL.md) | o argumento: estrutura, citação, fonte verificada |
| **`testes_relatorios`** | **a medida: o texto ainda soa IA? o gráfico saiu quebrado?** |

## A regra que governa tudo aqui

**Nenhum número desta skill é atestado de origem.** A régua diz posição relativa entre textos comparáveis, nunca "probabilidade de ter sido escrito por IA".

Medições próprias sustentam essa regra:

- Um texto humano de verdade, RFC de 1996 cheio de lista, marcou **79% de IA**.
- Achatar os parágrafos de outro RFC humano, sem tocar numa palavra, levou a acusação de **12% para 90%**. Formatação move o detector tanto quanto conteúdo.
- Texto passado pela `humanize` marcou **0,2%**, menos que humano real, que fica entre 7% e 12%. Ser "mais humano que humano" é assinatura de deslocamento de distribuição, não prova de humanidade.

### Validação externa no ZeroGPT (2026-09-14)

Seis textos sobre o mesmo assunto, mesmo tamanho, submetidos a um detector comercial contra o qual nada aqui foi calibrado:

| Condição | Inglês | Português |
|---|---|---|
| IA sem humanize | 86,4% | 91,7% |
| IA com humanize | **5,2%** | 84,3% |
| **Humano, Wikipedia de maio/2021** | **73%** | **100%** |

Duas conclusões, e as duas mudaram o código.

**Em inglês o ganho se confirma fora de casa.** 86,4% para 5,2%, queda de 81 pontos, num instrumento independente. Bate com o desklib local, que deu 100% para 0,5% nos mesmos dois textos.

**Em português o detector inverte.** O texto humano, escrito mais de um ano antes do ChatGPT existir, foi o **mais acusado dos seis**. A ordem ficou humano 100% > máquina 91,7% > máquina com humanize 84,3%, ou seja pior que o acaso. Em inglês o humano também foi acusado, com 73%.

Sem o terceiro ponto, o `D` com 84,3% pareceria texto ruim pedindo reescrita, quando o chão da medição era 100%. O laço reescreveria até destruir o texto perseguindo um número que não media nada.

Por isso a régua tem três pontos e não um score, e por isso **ela descarta o detector quando a referência humana é acusada**.

## Régua de 3 pontos

```
humano de referência   ->  onde fica o chão
texto antes            ->  onde o texto estava
texto depois           ->  para onde a humanize levou
```

O ponto humano é uma revisão de artigo da Wikipedia **anterior a 2021-06-01**, sobre assunto parecido, buscada automaticamente. Data escolhida com folga: o ChatGPT abriu em 2022-11-30.

Ter os três pontos no mesmo run, sobre o mesmo assunto, com o mesmo instrumento, é o que dispensa limiar absoluto. E limiar absoluto é exatamente o que não sobreviveu ao teste.

```bash
# com referência buscada pelo tema
python scripts/regua.py --antes rascunho.txt --depois final.txt --tema "análise de citações" --lang pt

# com referência que você já tem
python scripts/regua.py --antes rascunho.txt --depois final.txt --humano ref.txt

# só o texto final, sem medir ganho
python scripts/regua.py --depois final.txt --tema "..." --lang en
```

Saída: `0` aprovado, `1` reescrever.

## O laço

Quando o usuário pedir um texto (artigo, relatório, post, seção de tese), o fluxo é:

1. **Escreva** com a skill de gênero que couber (`academico` ou `relatorio`), aplicando a `humanize`.
2. **Guarde as duas versões**: a de antes da passada de humanize e a final. Sem o "antes" não dá para medir ganho, e o ganho é o que diz se a passada valeu.
3. **Rode a régua.**
4. **Aprovado** encerra.
5. **Reprovado**: reescreva atacando **o motivo que a régua deu**, e só ele. Volte ao passo 3.
6. **Máximo de 2 reescritas.** Se na terceira ainda reprovar, **pare e relate ao usuário** o que continua reprovando e por quê.

Três travas que valem mais que o laço:

**Nunca mexa no texto para baixar o número.** Isso é otimizar a métrica e destrói a escrita. Cada reescrita é aplicação honesta de um padrão da `humanize`; se nenhum padrão se aplica ao trecho, o número fica onde está e você relata.

**Nunca invente para variar.** A regra de no-fabrication da `humanize` está acima de qualquer resultado desta skill.

**Duas passadas é o teto por um motivo medido.** O ganho da primeira passada foi de 71,5% para 0,2% em média. Não sobra espaço para uma terceira fazer diferença honesta, só para estragar.

## O que a régua olha

**Detector desklib**, rodando local. É o [líder do RAID benchmark](https://raid-bench.xyz/leaderboard), DeBERTa-v3-large de 0,4B, MIT. Roda em CPU e **o texto não sai da máquina**, que é o motivo de não usar API de terceiro: relatório com dado interno não vai para servidor alheio.

**Ritmo de frase (§37)**, desvio padrão e coeficiente de variação. É o sinal que o detector **não** vê: corrigir o ritmo de 6,8 para 12,7 moveu o desklib de 0,2% para 0,1%, ou seja, nada. Os dois sinais são ortogonais e é por isso que a régua usa os dois.

Gatilhos de reprovação: detector acima de 0,50; ou texto final mais de 25 pontos acima da referência humana; ou ritmo plano.

**Trava de sanidade do instrumento.** Se a referência humana for acusada (0,50 ou mais), o detector é **descartado naquele run** e a decisão cai só para o ritmo. Texto humano anterior aos LLMs sendo acusado prova que o instrumento está errando naquele assunto ou naquela língua, e não que o texto é ruim. Sem essa trava o laço entra em ciclo perseguindo um número quebrado, que foi exatamente o cenário do teste em português.

## Português

**O desklib é só inglês.** Em texto português ele não tem validade, e a régua avisa quando detecta isso. A decisão então se apoia só no ritmo, que é agnóstico de língua, mais a auditoria mecânica do `style_audit.py` da skill `academico`, que tem as regras PT-BR.

E o problema não é só do desklib. No teste do ZeroGPT acima, Wikipedia humana em português de maio de 2021 levou **100% de probabilidade de IA**, mais que os dois textos de máquina do mesmo assunto. **Nenhum detector testado até agora funciona em português.** Trate qualquer número de detector em PT como ruído, e decida por ritmo e auditoria mecânica.

Isso é uma lacuna real e conhecida. Não finja que o número em português significa alguma coisa.

## QA de imagem

O `relatorio` desenha PNG por código, sem preview, e ninguém vê o resultado antes de ele entrar no DOCX. Não há script: **você abre o PNG com a ferramenta de leitura de imagem e olha**.

Checklist completo em [`references/imagem.md`](references/imagem.md). Bloqueiam a entrega: seta ou caixa sobrepostas, texto vazando da caixa, rótulo ou unidade faltando, idioma do rótulo diferente do documento, número ilegível.

Depois de corrigir, **gere o PNG de novo e leia de novo**: conserto de sobreposição costuma criar outra em outro lugar.

## Arquivos

- [`scripts/regua.py`](scripts/regua.py) — a régua de 3 pontos. É o ponto de entrada.
- [`scripts/detect_ai.py`](scripts/detect_ai.py) — detector desklib isolado, se quiser medir um arquivo só.
- [`scripts/human_ref.py`](scripts/human_ref.py) — busca o controle humano pré-2021 na Wikipedia.
- [`references/imagem.md`](references/imagem.md) — checklist de QA visual.
- [`corpus/`](corpus/README.md) — os 6 textos de calibração com as três medições de cada um, mais o arquivo de teste cego. É de onde saíram os limiares; se eles deixarem de separar, recalibre contra este corpus.

Primeira execução baixa ~1,7 GB do HuggingFace, depois fica em cache. Precisa de `torch`, `transformers` e `truststore` (este último porque o proxy corporativo inspeciona TLS e o `certifi` não conhece a raiz dele).

## Limites desta skill

Ditos de frente, porque uma ferramenta de validação que esconde o próprio erro é pior que não ter ferramenta:

- **Falso positivo existe.** Texto humano estruturado em lista já marcou 79%. Por isso a régua sempre mostra o ponto humano: se a própria referência marcar alto, a comparação está viciada e a régua avisa.
- **Os limiares saíram de um corpus de 15 textos**, escritos por uma pessoa só. São heurística de diagnóstico, não constante. Estão no topo do `regua.py` para serem recalibrados quando o corpus crescer.
- **O detector envelhece.** Foi treinado em saída de modelos anteriores. Texto de modelo mais novo, ou texto pós-`humanize`, está fora da distribuição de treino dele, e é parte da razão do 0,2%.
- **Passar na régua não é permissão para omitir.** Onde houver política de disclosure, ela manda, e a `academico` trata disso. A régua mede legibilidade, não autoriza ninguém a esconder nada.
