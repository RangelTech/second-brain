---
name: graft
description: Graft (TESTAR). Mapeia o codigo uma vez para o agente nao reexplorar a cada tarefa. Produtividade nos repos luar_*. MIT.
---

# Graft

**Veredito da campanha (26 a 28/10/2026):** TESTAR. **Classe do dado:** medido.

## Para que serve
Mapeia o codigo uma vez para o agente nao reexplorar a cada tarefa. Produtividade nos repos luar_*. MIT.

> Turbocharge Claude Code, Cursor, Codex, Gemini & every coding agent: faster, cheaper, with contextual understanding specific to your codebas

## O que foi medido
- sandbox CPU: OK, executou, 20.1s, pico RSS 654 MB

## Hardware
Roda sem GPU dedicada.

## Licença
MIT (permissiva). Confira a licença do código e a dos pesos antes de usar em produto.

## Instalação e uso

### Receita testada (Windows, Node 22+, 05/11/2026)

O Graft hoje se chama **Trail-Code** (pacote npm `@trailhq/trail-code`, comando `trail`). O comando `trail init` mapeia o repositório uma vez e não precisa de chave de API. Tarefa: mapear `segundo-cerebro-remoto` (3 arquivos JS) e responder "onde o servidor valida a chave" e "qual rota serve a interface" sem reexplorar a pasta. Respondeu certo, com arquivo e linha, e o mapa levou **1 segundo** (39 nós).

- **Não instale globalmente no Windows.** `npm install -g @trailhq/trail-code` tenta compilar `tree-sitter-kotlin` com node-gyp (exige Visual Studio) e deixa o pacote quebrado: sem `dist/bin/trail.js`. O que funcionou: instalar numa pasta própria sem rodar scripts de instalação, `npm install @trailhq/trail-code --ignore-scripts` (por exemplo em `%LOCALAPPDATA%/Temp/graft-cli`), e chamar `node_modules/.bin/trail` apontando para o repositório.
- Rode `trail init` dentro do repositório que quer mapear; o mapa fica numa pasta do projeto. Depois consulte o mapa antes de abrir arquivos: é a economia de tokens que a ferramenta promete.
- Linguagens sem gramática compilada (Kotlin, por exemplo) não entram no mapa quando se usa `--ignore-scripts`; para repositórios em JS e TS funciona.
- O agente gastou 679 mil tokens e 7 min, em parte lendo o README e se recuperando da instalação global quebrada. Com esta receita a tarefa é rápida.

Ainda não testado: repositório grande e o ganho real de tokens numa segunda pergunta.

## Fonte
Fonte: campanha de benchmark de ferramentas (out/2026). Números que mudam com o tempo (preço de GPU) valem na data da medição: confira o preço do dia.
