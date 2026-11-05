---
name: motionmaxxing
description: |
  Skill de motion graphics que usa HTML e Chrome headless com render determinístico e FFmpeg, com regras de movimento medidas (12 curvas, verificações G0 a G5). Use para vídeos mais bem acabados que o título animado simples.
  Use quando o cliente disser: "faça um filme de motion graphics de qualidade"; "vídeo de lançamento do meu produto"; "animação com cara de motion designer".
---

# motionmaxxing

> **Validada na bancada (parcial):** o motor de render foi testado (composição de teste renderizada em MP4); o fluxo completo do agente (roteiro, imagens, voz, revisão G0-G5) não foi executado.

## Quando usar
Cliente quer um filme de motion graphics de qualidade (produto, lançamento), com cenas em HTML renderizadas quadro a quadro.

## Quando NÃO usar
Título/legenda simples (use `video-motion`). Vídeo de cena real (geração por IA). Em fase inicial: o autor avisa limites conhecidos.

## Combina com
`video-motion`, `design-md`, `direcao-de-midia`, voz (`openvoice`).

## Receita validada na bancada (parcial)
```bash
git clone --depth 1 https://github.com/Tejashmakwana/motionmaxxing && cd motionmaxxing
export CHROME_PATH=<dados>/hermes/tools/chromium-1208/chrome-win64/chrome.exe   # Chrome do Hermes
export PATH=$PATH:<dados>/hermes/tools/ffmpeg-9.0.1-win32-x64/bin
node scripts/render.mjs examples/selftest/index.html saida.mp4 --fps 12 --duration 2
```
Teste: MP4 H.264, 1920x1080, 12 fps, 2,000 s, 173 KB, em **6 s** (cerca de 7 quadros/s de render). O render passa por Chrome DevTools e FFmpeg, determinístico.

## Armadilhas
- Exige Node 22+, Chrome e FFmpeg (o Hermes traz os três).
- Render a 1080p roda a cerca de 7 quadros/s na máquina de teste: 30 s de vídeo a 30 fps leva alguns minutos.
- Os scripts de imagem e voz (`imagegen.py`, `voice.py`) dependem de provedores externos; não testados.

## Tempo e recursos medidos
render do selftest 6 s (2 s de vídeo, 1080p).
