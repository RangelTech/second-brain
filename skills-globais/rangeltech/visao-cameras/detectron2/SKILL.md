---
name: detectron2
description: Detectron2 (TESTAR). Referencia de deteccao/mascara. Nao compila em torch2.8/CUDA13 (falha medida); usar Mask R-CNN do torchvision como proxy (medido).
---

# Detectron2

**Veredito da campanha (26 a 28/10/2026):** TESTAR. **Classe do dado:** medido.

## Para que serve
Referencia de deteccao/mascara. Nao compila em torch2.8/CUDA13 (falha medida); usar Mask R-CNN do torchvision como proxy (medido).

> Detectron2 is a platform for object detection, segmentation and other visual recognition tasks.

## O que foi medido
- RTX 3090: Mask R-CNN 51,1 ms (p95 91), Faster R-CNN 44,5 ms, VRAM 0,6 GB (build uv py3.10 + torch cu124); proxy torchvision 13-31 ms em todas as GPUs
- sandbox CPU: OK, executou, 118.3s, pico RSS 8581 MB; mask_rcnn_R__p50_ms=51.1; mask_rcnn_R__p95_ms=91.3; mask_rcnn_R__vram_gb=0.63; faster_rcnn__p50_ms=44.5

## Hardware
Precisa de GPU. Siga a skill `gpu-barata` para escolher e alugar (ligar, usar e desligar para não pagar parado).

## Instalação e uso
Siga o README do repositório: https://github.com/facebookresearch/detectron2
A campanha não padroniza comandos para esta ferramenta. Antes de rodar algo caro, faça um teste curto e confira a saída.


## Fonte
Skill `projetos` (campanha de benchmark da Rangel Tech). Números que mudam com o tempo (preço de GPU) valem na data da medição: confira o preço do dia.
