---
name: flux-3-klein
description: FLUX.3 Klein (TESTAR). Imagem/edicao 4K em ~8 GB via ComfyUI. Licenca flux-kommunity: ler antes de uso comercial. Benchmark GPU previsto.
---

# FLUX.3 Klein

**Veredito da campanha (26 a 28/10/2026):** TESTAR. **Classe do dado:** medido.

## Para que serve
Imagem/edicao 4K em ~8 GB via ComfyUI. Licenca flux-kommunity: ler antes de uso comercial. Benchmark GPU previsto.

> diffusion-single-file, comfyui, image-generation, image-editing, flux

## O que foi medido
- s/imagem (bf16 / fp8): 5090 37,9 / 25,5; L40S 29,9 / 27,3; PRO 6000 32,7 / 27,9; 4090 OOM / 39,1; 3090 OOM / nao suporta fp8; GB10 133 / 102. Exige --no-pup; licenca gated (aceita)

## Hardware
Precisa de GPU. Siga a skill `gpu-barata` para escolher e alugar (ligar, usar e desligar para não pagar parado).

## Instalação e uso
Siga o README do repositório: https://huggingface.co/black-forest-labs/flux-3-image-klein-comfy
A campanha não padroniza comandos para esta ferramenta. Antes de rodar algo caro, faça um teste curto e confira a saída.


## Fonte
Skill `projetos` (campanha de benchmark da Rangel Tech). Números que mudam com o tempo (preço de GPU) valem na data da medição: confira o preço do dia.
