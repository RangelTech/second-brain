---
name: qwen3-8-27b-4-bit-abliterado-post-3090
description: Qwen3.8 27B 4-bit abliterado (post 3090) (TESTAR). 27B 4 bits (18,2 GiB) cabe em 24 GB: vale para pool pesado barato. Benchmark em RTX 3090 em andamento.
---

# Qwen3.8 27B 4-bit abliterado (post 3090)

**Veredito da campanha (26 a 28/10/2026):** TESTAR. **Classe do dado:** medido.

## Para que serve
27B 4 bits (18,2 GiB) cabe em 24 GB: vale para pool pesado barato. Benchmark em RTX 3090 em andamento.

> transformers, safetensors, qwen3_5, image-text-to-text, qwen3.8

## O que foi medido
- AWQ 27B: 3090 8 usuarios no SLA (224 tok/s), 4090 8 (283), 5090 16 (844), A100 8 (344), PRO 6000 16 (693); GSM8K 95,3%, MMLU 80%, HumanEval 94,5%

## Hardware
Precisa de GPU. Siga a skill `gpu-barata` para escolher e alugar (ligar, usar e desligar para não pagar parado).

## Licença
apache-2.0 (permissiva). Confira a licença do código e a dos pesos antes de usar em produto.

## Instalação e uso
Siga o README do repositório: https://huggingface.co/twolven/Qwen3.8-27B-abliterated-AWQ-MTP
A campanha não padroniza comandos para esta ferramenta. Antes de rodar algo caro, faça um teste curto e confira a saída.


## Fonte
Skill `projetos` (campanha de benchmark da Rangel Tech). Números que mudam com o tempo (preço de GPU) valem na data da medição: confira o preço do dia.
