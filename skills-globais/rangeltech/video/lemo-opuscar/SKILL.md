---
name: lemo-opuscar
description: |
  Caixa de estilos de filme feitos em código (66 estilos) para o agente dirigir curtas com Chrome headless e FFmpeg. Use só se o cliente pedir um filme estilizado inteiro em código; para título e legenda use video-motion.
  Use quando o cliente disser: "quero um filme curto estilizado feito em código"; "vídeo no estilo art déco ou CRT"; "curta com trilha e voz".
---

# Lemo-Opuscar

> **Validada na bancada (parcial):** clone e instalação funcionam; o render de quadros falhou no teste (erro de rede da página: as fontes e outros arquivos do demo não vêm no repositório). Filme completo não foi gerado.

## Quando usar
Cliente quer um curta/filme com estilo definido (art déco, CRT, quadro-negro etc.), tudo desenhado em HTML/JS e renderizado quadro a quadro, com trilha e voz.

## Quando NÃO usar
Vídeo de cena real (use a geração de vídeo por IA). Título animado simples (use `video-motion`). Os estilos foram afinados para o Claude Opus 5.5; com o Qwen o resultado pode não reproduzir.

## Combina com
`video-motion` (FFmpeg e Chrome do Hermes), `openvoice`/TTS para voz, `headroom` para ler os arquivos de estilo sem estourar contexto.

## Receita validada na bancada (parcial)
```bash
git clone --depth 1 https://github.com/lemomo-ai/lemo-opuscar && cd lemo-opuscar
npm ci            # 4 s (playwright-core e three)
# usar o Chrome do Hermes em vez de baixar outro:
export PLAYWRIGHT_CHROME=<dados>/hermes/tools/chromium-1208/chrome-win64/chrome.exe   # Linux: o chrome da mesma pasta
node core/render/still.mjs styles/<estilo>/demo 1 5 --out saida   # imagens em t=1 s e 5 s
sh core/render/mux.sh video.mp4 mix.wav out.mp4 24                # junta áudio e normaliza
```
O agente lê `DIRECTOR.md` e `styles/<estilo>/STYLE.md` e dirige: cada estilo é uma página com `window.render(t)`.

## Armadilhas
- No teste (`art-deco`) o `still.mjs` terminou com `[pageerror] A network error occurred` e 404 nas fontes (.ttf) do demo: baixe as fontes (ver `styles/<estilo>/demo/CREDITS`) antes.
- Exige FFmpeg 7+ (o do Hermes é 9; o 6 corta o áudio no `loudnorm`), Python 3.11+ para música/voz (`requirements-music.txt`, `requirements-voice.txt`), Node 20+.
- Estilos 3D e de shader pedem GPU; na VM do cliente (sem GPU) use só os 2D.
- Não é para Windows nativo segundo o autor (use WSL), mas as peças Node rodaram aqui.

## Tempo e recursos medidos
clone 193 MB, `npm ci` 4 s, tentativa de 2 quadros 1,8 s (falhou por assets). Filme completo não medido.
