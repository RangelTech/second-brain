---
name: diagram-design
description: Diagram Design (TESTAR). Skill que gera diagramas claros (fluxos, sistemas). Documentacao do Lunar. Teste A/B previsto na spec.
---

# Diagram Design

**Veredito da campanha (26 a 28/10/2026):** TESTAR. **Classe do dado:** medido.

## Para que serve
Skill que gera diagramas claros (fluxos, sistemas). Documentacao do Lunar. Teste A/B previsto na spec.

> Editorial diagram design for Claude Code, Codex, GitHub Copilot, Cursor, Factory Droid, Qoder, and Pi. 45 diagram types. Self-contained HTML

## O que foi medido
- sandbox CPU: OK, executou, 2.5s, pico RSS 31 MB; files=627; md_files=106; skill_md=1; md_kchars=1053

## Hardware
Roda sem GPU dedicada.

## Licença
MIT (permissiva). Confira a licença do código e a dos pesos antes de usar em produto.

## Instalação e uso

### Receita testada (VM Linux sem root, 05/11/2026)

Tarefa: diagrama do fluxo "cliente no WhatsApp, Evolution API, webhook, agente de IA, resposta ao cliente, com banco guardando o histórico", salvo como imagem. **Resultado correto no conteúdo e bonito** (caixas com ícones, setas numeradas, seta de retorno, cilindro de banco, legenda de cores), gerado como SVG e rasterizado para PNG. Mas levou **mais de 25 min** e o agente montou o arquivo em muitos remendos, e a entrega saiu com defeitos que a conferência dele não pegou:

- rótulos de seta ("grava histórico", "contexto / histórico") **atravessados pela própria seta**;
- texto "histórico de conversas" **maior que o cilindro**, vazando para fora;
- uma linha pontilhada solta no canto direito e uma grande área vazia.

Como fazer melhor (receita):

1. **Gere o SVG por um script (Python ou Node) com uma função `caixa(x, y, w, h, titulo, subtitulo)` e uma função `seta(de, para, rotulo)`**, em vez de editar o arquivo em pedaços. Mudar uma posição vira mudar um número, e o diagrama inteiro é refeito em segundos.
2. Calcule a largura do texto antes de desenhar (fonte e tamanho fixos) e aumente a caixa se não couber; nunca confie no olho.
3. Ponha o rótulo da seta **ao lado** da linha, com fundo da cor da página (um retângulo atrás do texto), ou no ponto médio de um trecho reto.
4. Use fontes explícitas (`font-family: "DejaVu Sans", sans-serif`) em vez de variáveis CSS dentro de atributos SVG: variáveis não resolvem de forma confiável no rasterizador.
5. Rasterize com CairoSVG ou com o Chromium embutido do Hermes (`hermes/tools/chromium-*`) e **olhe o PNG**: procure texto cruzado por linha, texto fora da caixa, elementos soltos e áreas vazias. Corrija e gere de novo.
6. Entregue o SVG (editável) e o PNG, com o caminho dos dois.

Paleta que funcionou: azul para o núcleo de IA, verde para dados, bege neutro para infraestrutura, setas cinza e linhas tracejadas verdes para leitura e gravação no banco.

Ainda não testado: diagramas com mais de 8 nós, diagramas de sequência e a conversão para PPT.

## Fonte
Fonte: campanha de benchmark de ferramentas (out/2026). Números que mudam com o tempo (preço de GPU) valem na data da medição: confira o preço do dia.
