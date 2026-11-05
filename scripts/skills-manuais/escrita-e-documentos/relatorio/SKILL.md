---
name: relatorio
description: >-
  Gera relatórios, propostas e documentação técnica em DOCX (Word) com diagramas
  vetoriais profissionais (arquitetura em camadas, mapeamento dores→soluções,
  fases/roadmap e cronograma/Gantt) usando python-docx + matplotlib, sem depender
  de binários externos (Graphviz). Use quando o usuário pedir uma proposta,
  relatório, apresentação em Word/docx, ou diagramas de arquitetura/cronograma
  com cara corporativa. Paleta e estilo azul-marinho corporativo.
  Cuida do continente (layout, diagramas, DOCX); o conteudo escrito passa pela
  skill `humanize` antes de entrar no documento.
---

# Skill: relatorio — DOCX corporativo + diagramas em matplotlib

> **Se o pedido envolve texto, invoque a skill `humanize` ANTES de escrever prosa.**
> Use a ferramenta Skill com `skill: humanize`. Não há encadeamento automático entre
> skills: se você não invocar, ela não vem, e o DOCX sai com diagramas bons e texto de
> chatbot. Só dispensa se o pedido for exclusivamente de diagrama ou layout.

Produz documentos Word profissionais com diagramas desenhados por código. Foi
destilada de propostas reais cujos diagramas ficaram excelentes.

Esta skill cuida do **continente**: layout, diagramas, tabelas, capa, DOCX. O
**conteúdo** escrito é responsabilidade da skill [`humanize`](../humanize/SKILL.md),
que é a base comum de escrita. Carregue as duas quando o pedido envolver texto.

## Quando usar
- Proposta técnico-comercial, relatório executivo, documentação técnica em `.docx`.
- Diagramas: arquitetura em camadas (bandas + caixas + setas), mapeamento
  esquerda→direita (ex.: dores → frentes), blocos de fases/roadmap, cronograma
  (Gantt) com barras por semana e sobreposições.

## Por que matplotlib (e não Graphviz)
`matplotlib` + `Pillow` costumam já estar instalados e **não exigem binário de
sistema**. No Windows o Graphviz precisa do `dot.exe` instalado à parte — evite.
Verifique antes:
```bash
python -c "import docx, matplotlib, PIL; print('ok')"
# se faltar: pip install python-docx matplotlib pillow
```

## O texto que entra no documento

Diagrama bonito com texto de chatbot entrega um documento que ninguém assina. Todo
texto corrido do DOCX — sumário executivo, diagnóstico, escopo, legenda de figura,
justificativa de capacity — passa pela skill [`humanize`](../humanize/SKILL.md)
antes de virar `P()` ou `bullet()` no script gerador.

O que isso muda na prática num documento corporativo:

- **Sem travessão longo** (§8). Vírgula, parênteses ou duas frases.
- **Sem moldura de realce** (§31). "É importante ressaltar que o prazo é de 12
  semanas" vira "O prazo é de 12 semanas".
- **Sem conectivo automático** (§30). "Além disso" só quando o parágrafo de fato
  adiciona.
- **Sem jargão vazio** (§27). "Alavancar sinergias" não descreve entrega nenhuma;
  proposta comercial é onde esse padrão mais aparece e mais custa.
- **Sem negrito decorativo** (§19) e **sem bullet onde a prosa carrega o
  argumento** (§21). Diagnóstico fatiado em bullets esconde a ausência de análise.
- **Nada de inflar significância** (§13) nem de superlativo sobre o próprio
  serviço (§16).

Valem integralmente as travas da seção "Data and technical reports" da `humanize`:
número, prazo, valor, nome de tabela, schema, job e papel de capacity são
congelados; a reescrita não arredonda, não reordena, não renomeia e não inventa o
dado que falta. Se um parágrafo pedir um número que você não tem, pergunte.

Quando houver arquivo de contexto de voz (cliente, área, tom institucional),
referencie-o: `contexts/<cliente>.md` na `humanize`.

## Fluxo recomendado
1. **Redija o texto e rode a `humanize` nele** antes de escrever qualquer código.
   É mais barato corrigir prosa em Markdown do que dentro de chamadas `P()`.
2. **Escreva um único script gerador** `generate_<doc>.py` que: (a) desenha os
   PNGs em `docs/assets/`, (b) monta o DOCX com python-docx, (c) embute os PNGs.
   Isso torna tudo reexecutável (`python generate_<doc>.py`) após qualquer edição.
3. Reutilize os helpers de `helpers.py` (bundled nesta skill) — copie-os para o
   topo do seu script ou `import` a partir do caminho da skill.
4. **Sempre revise os PNGs abrindo-os** (tool Read na imagem) antes de finalizar.
   O checklist completo está na skill
   [`testes_relatorios`](../testes_relatorios/references/imagem.md): sobreposição,
   texto vazando, rótulo ou unidade faltando, idioma trocado. Bloqueiam a entrega.
   Depois de corrigir, gere o PNG de novo e leia de novo, porque conserto de
   sobreposição costuma criar outra em outro lugar.
5. **Rode a régua de texto** antes de entregar:
   `python ../testes_relatorios/scripts/regua.py --antes rascunho.txt --depois final.txt --tema "<assunto>"`

## Regras de layout que evitam retrabalho
- Trabalhe num "canvas" com coordenadas fixas (`ax.set_xlim/ylim`, `ax.axis('off')`).
- Faixas horizontais (bandas) e colunas de caixas **não podem colidir em Y**:
  reserve zonas verticais distintas (ex.: colunas em y=60–82, bandas em y=43–57).
- Texto de banda não quebra linha: **encurte o texto ou reduza a fonte** para não
  vazar da caixa. Se cortar no fim ("...+ Gua"), a string é longa demais.
- Setas com `FancyArrowPatch(arrowstyle="-|>")`. Fluxo principal esquerda→direita.
- DPI 200, `savefig(bbox_inches="tight", facecolor="white")`.
- No DOCX, insira imagem com `Inches(6.3–6.5)` (largura útil de página A4/Letter).

## Paleta corporativa azul-marinho
```
NAVY="#003366"  BLUE="#006699"  TEAL="#4A90A4"  LIGHT="#E8F0F5"
LIGHT2="#DCEAF2"  GREY="#8A8A8A"  ORANGE="#E8871E"  GREEN="#2E8B57"
```
Cabeçalho de tabela no DOCX: fundo `003366`, texto branco, bold.

## Os 4 diagramas de referência (receitas em helpers.py)
- **Arquitetura alvo**: banda topo (CI/CD) + colunas Fontes/Ingestão + 3 caixas de
  camadas (RAW/TRUSTED/REFINED) + bandas Governança/Orquestração + coluna
  Consumo/IA à direita + banda Observabilidade no rodapé.
- **Mapeamento dores→frentes**: duas colunas de caixas + setas cinza cruzando.
- **Roadmap de fases**: N blocos coloridos em linha, ligados por setas.
- **Cronograma (Gantt)**: `ax.barh(y, dur, left=inicio)` por etapa; faixa contínua
  com `hatch="////"` para sustentação; eixo X em semanas.

## Estrutura de DOCX que funciona bem
Capa centralizada (título 26pt navy, subtítulo, cliente) → page_break → seções
com `Heading 1` coloridos → tabelas com header navy → imagens centralizadas com
legenda em itálico cinza 9pt → rodapé de confidencialidade.

Ordem típica de proposta técnica: Sumário Executivo · Entendimento (As-Is) ·
Diagnóstico (dores) · Solução/Escopo (frentes) · Arquitetura alvo · Fases ·
**Capacity (time)** · **Tempo de execução** · **Cronograma (Gantt)** · Próximos passos.
Capacity: papéis (PO, Arquiteto, DevOps/IaC, Eng. Dados, MLOps, Sustentação),
senioridade, alocação ("integral = 8h/dia, 40h/sem" vs parcial %).

## Código reutilizável
Ver `helpers.py` nesta pasta — contém a paleta, `_box/_band/_arrow`, os 4
geradores de diagrama e os helpers de DOCX (`H`, `P`, `bullet`, `table`, `code`,
`image`, capa). Copie e adapte os textos/labels ao novo documento.

## Exemplo de referência completo
O script `generate_proposta.py` na raiz do projeto quality-finances é o exemplo
end-to-end mais completo (proposta de exemplo). Use-o como molde.
