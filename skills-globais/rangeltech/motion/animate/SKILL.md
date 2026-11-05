---
name: animate
description: |
  Skill de animação procedural em canvas, renderizada em MP4 com navegador headless e FFmpeg, em oito estilos. Use quando o cliente disser: "faça uma animação desenhada em código"; "vídeo animado no estilo papel recortado"; "animação em pixel art ou nanquim"; "quero um vídeo animado com narração".
---

# animate (cth9191)

> **Validada no benchmark.**

## Quando usar
Vídeo animado desenhado em código com roteiro, storyboard e aprovação em etapas.

## Quando NÃO usar
Título simples (use `video-motion`).

## Passo a passo
Comandos e exemplos do README oficial:

```
npm i -g playwright && npx playwright install chromium
```

```
/plugin marketplace add cth9191/animate
/plugin install animate@animate
```

## O que o benchmark mediu
Rodou em sandbox de CPU: 1.5s, pico de memória 29 MB; files=111; md_files=19; skill_md=1; md_kchars=136

## Requisitos
Node, Playwright (Chromium), FFmpeg; sem GPU. Sem GPU.

## Combina com
`video-motion`, `motionmaxxing`, `lemo-opuscar`.
