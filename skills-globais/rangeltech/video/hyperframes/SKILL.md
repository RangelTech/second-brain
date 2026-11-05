---
name: hyperframes
description: HyperFrames (TESTAR). Escreve HTML e renderiza MP4 deterministico (ffmpeg+chrome). Videos do Lunar B sem GPU. Apache-2.0.
---

> **Quando NÃO usar esta skill:** pedido de "vídeo de [cena, objeto, pessoa, animal, produto]" (conteúdo visual real, como "um vídeo de um balão subindo no céu") NÃO é motion graphics.
> Esse pedido vai SEMPRE para a ferramenta de geração de vídeo por IA, `midia_gerar_video` (mcp-midia). Esta skill só serve para animação gráfica com texto, títulos, legendas,
> gráficos e vinhetas, e apenas quando o usuário pedir isso explicitamente. Se a geração de vídeo por IA estiver indisponível, não improvise com esta skill: avise, em português
> simples, que o vídeo não pôde ser gerado agora e ofereça tentar de novo.


# HyperFrames

**Veredito da campanha (26 a 28/10/2026):** TESTAR. **Classe do dado:** medido.

## Para que serve
Escreve HTML e renderiza MP4 deterministico (ffmpeg+chrome). Videos do Lunar B sem GPU. Apache-2.0.

> Write HTML. Render video. Built for agents.

## O que foi medido
- sandbox CPU: OK, executou, 101.0s, pico RSS 384 MB

## Hardware
Roda sem GPU dedicada.

## Licença
Apache-2.0 (permissiva). Confira a licença do código e a dos pesos antes de usar em produto.

## Instalação e uso

### Receita testada (VM Linux de cliente, sem root, hyperframes 0.9.15, 05/11/2026)

Tarefa: cartão animado de 5 s, 1080x1080, com o texto "Juca Automóveis" entrando com fade e um selo "Seminovos revisados". **Funcionou:** MP4 H.264 de 1080x1080, 5,000 s, com o selo de dois anéis e a marca legíveis (quadros conferidos em 0,5 s, 2,5 s e 4,2 s). Rodou numa VM sem root, sem GPU e sem Docker.

Como funciona: o HyperFrames renderiza uma página **HTML com animação GSAP** quadro a quadro num Chrome headless e junta com FFmpeg. O projeto é uma pasta com `index.html`, `hyperframes.json`, `package.json` e `vendor/gsap.min.js` (o GSAP vai local, sem depender de internet).

```
cd <pasta-do-projeto>
npx --yes hyperframes@0.9.15 check      # valida a composição
npx --yes hyperframes@0.9.15 render     # grava renders/<nome>.mp4
```

- No `index.html`, defina o tamanho da tela com `<meta name="viewport" content="width=1080, height=1080">` e o mesmo tamanho no `html, body`. A duração e a linha do tempo vêm do GSAP.
- **Anime só `transform` e `opacity`.** São seguras para o "seek" quadro a quadro; animar `top`, `left` ou `filter` pesado gera quadros inconsistentes.
- **O navegador:** `npx hyperframes browser ensure` acha ou baixa o `chrome-headless-shell` que a versão exige (fica em `~/.cache/hyperframes/chrome/`). A variável `HYPERFRAMES_BROWSER_PATH` aponta para outro Chrome. Sem root, o Chrome headless funciona, só pode faltar ele no PATH.
- Para conferir antes do render final, capture quadros nos instantes-chave (por exemplo 1 s, 2,5 s e 4 s) e olhe cada um, sozinho, em vez de uma folha de contatos (a análise de imagem grande falhou por tempo limite).
- Confira texto cortado: o agente achou "Garantis" truncado no selo e corrigiu para "Garantidos" antes do render.

### Armadilhas

- **Memória:** o agente estimou cerca de 7,8 GB para renderizar 150 quadros no Chromium em modo software numa VM de 8 GB. Rode só um render por vez e confira `free -m`. A skill de ambiente (`ambiente-do-computador`) tem os limites da VM.
- O primeiro `npx` baixa pacotes e o Chrome: conte alguns minutos. Em rodadas seguintes é rápido.
- Não use HTML com fontes de internet: baixe e referencie arquivos locais (a pasta `.cache/hyperframes/fonts` já guarda as usadas pelo render).
- O agente gastou muito contexto até acertar; com esta receita, comece direto pelo `index.html` e pelo `check`.

Ainda não testado: tempo exato do render, vídeo com áudio e vídeo de fundo, e o fluxo `hyperframes preview`.

## Fonte
Fonte: campanha de benchmark de ferramentas (out/2026). Números que mudam com o tempo (preço de GPU) valem na data da medição: confira o preço do dia.
