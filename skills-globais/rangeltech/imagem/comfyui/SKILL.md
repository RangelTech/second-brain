---
name: comfyui
description: ComfyUI (TESTAR). Orquestrador de workflows de imagem/video. Medimos diffusers como proxy; ComfyUI nao testado.
---

# ComfyUI

**Veredito da campanha (26 a 28/10/2026):** TESTAR. **Classe do dado:** medido.

## Para que serve
Orquestrador de workflows de imagem/video. Medimos diffusers como proxy; ComfyUI nao testado.

> The most powerful and modular diffusion model GUI, api and backend with a graph/nodes interface. The fastest local inference engine in the w

## O que foi medido
- SDXL-Turbo API em GPU: ~0,45 s/imagem (lote 4); CPU sandbox: sobe e responde HTTP 200
- sandbox CPU: OK, executou, 90.9s, pico RSS 136 MB; http_code=200 / sandbox CPU: OK, executou, 185.0s, pico RSS 2293 MB; ready_s=27; first_call_s=10.9; bs1_s_per_batch_p50=1.415; bs1_s_per_image=1.415

## Hardware
Precisa de GPU. Siga a skill `gpu-barata` para escolher e alugar (ligar, usar e desligar para não pagar parado).

## Licença
GPL-3.0 (copyleft forte). Confira a licença do código e a dos pesos antes de usar em produto.

## Instalação e uso
Siga o README do repositório: https://github.com/Comfy-Org/ComfyUI
A campanha não padroniza comandos para esta ferramenta. Antes de rodar algo caro, faça um teste curto e confira a saída.


## Fonte
Fonte: campanha de benchmark de ferramentas (out/2026). Números que mudam com o tempo (preço de GPU) valem na data da medição: confira o preço do dia.
