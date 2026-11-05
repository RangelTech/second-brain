---
name: openmontage
description: |
  Sistema agêntico de produção de vídeo com 12 pipelines, mais de 100 ferramentas e centenas de skills de produção. Use quando o cliente disser: "faça um vídeo parecido com esse short, sobre outro assunto"; "produzir vídeo completo com roteiro, cenas e edição"; "pipeline de produção de vídeo por agente".
---

# OpenMontage

> **Validada no benchmark (clone e inspeção).**

## Quando usar
Produção de vídeo em etapas pela agência.

## Quando NÃO usar
Título animado simples (use `video-motion`).

## Passo a passo
O fluxo é dar ao agente um vídeo de referência e o tema, por exemplo: _"Aqui está um YouTube Short que eu gosto. Faça algo parecido, mas sobre computação quântica."_ Instalação e pré-requisitos no README de `calesthio/OpenMontage`.

## O que o benchmark mediu
Clonado e inspecionado em sandbox de CPU (não executado): 3.5s, pico de memória 51 MB

## Requisitos
Python/Node, FFmpeg; algumas etapas usam APIs de geração de mídia (chaves). Precisa de GPU: Opcional.

## Combina com
`video-motion`, `get-brolls`, `direcao-de-midia`.
