---
name: rea-reverse-engineer-anything
description: REA (Reverse Engineer Anything) (TESTAR). Skill de engenharia reversa de telas (autorizadas) via Playwright/DOM. Util a migracao de UI; exige revisao de seguranca.
---

# REA (Reverse Engineer Anything)

**Veredito da campanha (26 a 28/10/2026):** TESTAR. **Classe do dado:** medido.

## Para que serve
Skill de engenharia reversa de telas (autorizadas) via Playwright/DOM. Util a migracao de UI; exige revisao de seguranca.

> Agent skill to reverse engineer a SaaS product through the browser into a knowledge base for rebuilding it: screens, rules, data model, desi

## O que foi medido
- sandbox CPU: OK, executou, 3.5s, pico RSS 32 MB; files=391; md_files=158; skill_md=1; md_kchars=507

## Hardware
Roda sem GPU dedicada.

## Licença
MIT (permissiva). Confira a licença do código e a dos pesos antes de usar em produto.

## Instalação e uso

### Receita testada (Windows, Playwright, 05/11/2026)

Tarefa: analisar a estrutura de https://quotes.toscrape.com (tela pública de teste) e entregar o mapa dos blocos, os seletores e um esboço em HTML. **Funcionou**; o agente entregou:

- `rea_dom_map.json`: mapa do DOM com 5 blocos (`header`, `quotes`, `pagination`, `sidebar`, `footer`), 10 citações, 8 autores e 55 links (49 distintos), com os seletores principais (`div.quote`, `span.text`, `small.author`, `ul.pager li.next a`);
- `rea_home_full.png`: print da página inteira (1280x1800, mais alto que a janela de 900, confirmando `full_page`);
- `recreacao.html`: recriação em duas colunas com o CSS embutido, 3 citações reais e a nuvem de tags com fontes de 28 a 6 px medidas no DOM; renderizada em Chromium headless com zero erros no console;
- `relatorio.md`: relatório com o que foi verificado.

Como fazer, em ordem: (1) abra a página com o Playwright (veja a skill `playwright`), (2) percorra o DOM e grave os blocos com seus seletores e atributos (tag, classes, texto, tamanho de fonte), (3) tire o print com `full_page=True`, (4) salve o HTML bruto e confira que ele bate com o DOM renderizado (se bater, a tela é estática e os seletores são estáveis), (5) escreva a recriação e renderize para conferir.

### Armadilhas

- **Caminhos no Windows:** caminhos absolutos escritos como `/tmp/...` viram *drive-relative* e os arquivos caíram em `C:	mpea`, não na pasta temporária esperada. Use caminhos completos com a unidade (`C:/Users/...`) e confira onde os arquivos foram parar com um `ls`.
- Ao checar o tamanho do PNG pelo cabeçalho, a largura e a altura ficam nos bytes 16 a 23 (IHDR); ler os bytes errados dá dimensão falsa.
- Use só em telas autorizadas (a sua, a de um cliente com permissão, ou páginas públicas de teste): recriar o visual de um site de terceiros pode violar direitos autorais.

Ainda não testado: telas com JavaScript dinâmico, login e rolagem infinita.

## Fonte
Fonte: campanha de benchmark de ferramentas (out/2026). Números que mudam com o tempo (preço de GPU) valem na data da medição: confira o preço do dia.
