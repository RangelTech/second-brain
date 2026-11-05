---
name: reelmimic
description: |
  Analisa um vídeo de referência e produz outro no mesmo estilo, com agentes que planejam, montam e revisam. Use quando o cliente disser: "quero um vídeo igual a esse reel, mas sobre outro assunto"; "copiar o estilo de um vídeo de referência"; "refazer esse reels com meu tema".
---

# ReelMimic

> **Validada no benchmark.**

## Quando usar
Agência que quer replicar o estilo de um reel em conteúdo novo.

## Quando NÃO usar
Cena real gerada por IA (use a geração de vídeo).

## Passo a passo
```bash
git clone https://github.com/edenfunf/reelmimic.git && cd reelmimic
```
Depois siga o README: passe o vídeo de referência e o tema.

## O que o benchmark mediu
Rodou em sandbox de CPU: 3.0s, pico de memória 33 MB; files=93; md_files=19; skill_md=0; md_kchars=135

## Requisitos
Node, FFmpeg e Chrome; sem GPU. Sem GPU.

## Combina com
`video-motion` (baixar e assistir o reel com yt-dlp), `motionmaxxing`.
