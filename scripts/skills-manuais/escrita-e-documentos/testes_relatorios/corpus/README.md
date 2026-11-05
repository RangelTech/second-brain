# Corpus de calibração

Os limiares do `regua.py` saíram daqui. Estão versionados para poderem ser reconferidos, contestados e ampliados, em vez de virarem número mágico no código.

## O conjunto

Seis textos sobre **aprendizado de máquina**, mesmo registro explicativo, 394 a 477 palavras. Tema e tamanho iguais de propósito: a única coisa que varia é o estilo.

| Arquivo | Língua | Condição |
|---|---|---|
| `wiki_en.txt` | inglês | humano, Wikipedia de 31/05/2021 |
| `llm_en.txt` | inglês | IA, escrita padrão |
| `humanize_en.txt` | inglês | IA, com a skill `humanize` |
| `wiki_pt.txt` | português | humano, Wikipedia de 07/05/2021 |
| `llm_pt.txt` | português | IA, escrita padrão |
| `humanize_pt.txt` | português | IA, com a skill `humanize` |

Os textos humanos são revisões anteriores a junho de 2021. O ChatGPT abriu em 30/11/2022, então há mais de um ano de folga.

## Medições

| Texto | desklib (local) | ZeroGPT (externo) | Ritmo dp / cv |
|---|---|---|---|
| `wiki_en` | 3,3% | **73%** | 11,4 / 0,47 |
| `llm_en` | 100,0% | 86,4% | 5,4 / 0,28 plano |
| `humanize_en` | 0,5% | **5,2%** | 9,3 / 0,52 |
| `wiki_pt` | 0,3%* | **100%** | 22,3 / 0,67 |
| `llm_pt` | 70,4%* | 91,7% | 5,7 / 0,28 plano |
| `humanize_pt` | 0,1%* | 84,3% | 9,0 / 0,51 |

`*` desklib é treinado só em inglês; os números em PT não têm validade.

ZeroGPT medido em 2026-09-14, e ele só analisa as primeiras 250 palavras na versão gratuita.

## O que este corpus prova

**O ganho da humanize em inglês é real e reproduzível fora de casa.** 86,4% para 5,2% no ZeroGPT, 100% para 0,5% no desklib. Dois instrumentos independentes, mesma direção, mesma ordem de grandeza.

**O ritmo separa nas duas línguas.** Os dois textos padrão ficam em dp 5,4 e 5,7 com cv 0,28. Os dois com humanize ficam em 9,0 e 9,3. Os dois humanos em 11,4 e 22,3. É o único sinal que funciona em português.

**Detector comercial erra o controle humano.** 73% em inglês e 100% em português, em texto anterior aos LLMs. Em português a ordem inverteu: o humano foi o mais acusado dos seis.

**Detector e ritmo são ortogonais.** Corrigir o ritmo de um texto de dp 6,8 para 12,7 moveu o desklib de 0,2% para 0,1%, ou seja nada. Um sinal não substitui o outro.

## Como ampliar

O corpus é pequeno (n=6 aqui, 15 contando os textos de trabalho) e foi escrito por uma pessoa só. Para valer mais precisa de: texto de outros autores humanos, outros gêneros além do explicativo, e saída de outros modelos além deste.

Ao adicionar par novo, meça as três colunas e atualize a tabela. Se os limiares do topo do `regua.py` deixarem de separar, mude os limiares, não o corpus.
