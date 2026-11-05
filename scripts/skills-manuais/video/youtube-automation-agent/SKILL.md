---
name: youtube-automation-agent
description: |
  Agente que automatiza o fluxo do canal: ideia, roteiro, vídeo, título e publicação. Use quando o cliente disser: "automatize meu canal do YouTube"; "gerar vídeos e publicar no YouTube"; "roteiro, vídeo e título automáticos".
---

# youtube-automation-agent

> **Validada no benchmark.**

## Quando usar
Canal do cliente com publicação automática.

## Quando NÃO usar
Sem conta do YouTube do cliente.

## Passo a passo
Comandos e exemplos do README oficial:

```
git clone https://github.com/darkzOGx/youtube-automation-agent.git
cd youtube-automation-agent
npm install
npx playwright install chromium   # renders slideshow videos; on Linux add --with-deps
npm run walkthrough
npm start
```

## O que o benchmark mediu
Rodou em sandbox de CPU: 11.5s, pico de memória 428 MB

## Requisitos
Node; chaves de API; sem GPU. Sem GPU.

## Combina com
`video-motion`, `get-brolls`, `direcao-de-midia`.
