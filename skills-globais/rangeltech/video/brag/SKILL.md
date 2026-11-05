---
name: brag
description: |
  Skill que transforma um projeto pronto em vídeo curto de lançamento, com música, movimento e texto para divulgação. Use quando o cliente disser: "faça um vídeo de lançamento do meu projeto"; "quero divulgar meu site em vídeo curto"; "vídeo de 20 segundos para mostrar meu app"; "post de divulgação do projeto".
---

# brag (/brag)

> **Validada no benchmark.**

## Quando usar
Divulgação de site ou app em vídeo curto.

## Quando NÃO usar
Cena real (use a geração de vídeo por IA).

## Passo a passo
Instalar como plugin e pedir `/brag` no projeto. Há versão enxuta `/brag-slim`.

## O que o benchmark mediu
Rodou em sandbox de CPU: 5.5s, pico de memória 35 MB; files=357; md_files=25; skill_md=2; md_kchars=130

## Requisitos
Node 22+, Chrome e FFmpeg (o Hermes traz); sem GPU, sem root. Sem GPU.

## Combina com
`video-motion`, `hyperframes`, geração de vídeo por IA.
