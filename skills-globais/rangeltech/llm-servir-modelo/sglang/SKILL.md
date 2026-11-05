---
name: sglang
description: SGLang (TESTAR). Engine alternativa ao vLLM. Ainda nao medido.
---

# SGLang

**Veredito da campanha (26 a 28/10/2026):** TESTAR. **Classe do dado:** medido.

## Para que serve
Engine alternativa ao vLLM. Ainda nao medido.

> SGLang is a high-performance serving framework for large language models and multimodal models.

## O que foi medido
- 9B BF16 4090 (cuda graph off): 147 tok/s agregado com 16 usuarios, TTFT p95 22 s; vLLM no mesmo teste: 657 tok/s, TTFT 0,16 s
- sandbox CPU: OK, executou, 319.6s, pico RSS 828 MB

## Hardware
Precisa de GPU. Siga a skill `gpu-barata` para escolher e alugar (ligar, usar e desligar para não pagar parado).

## Instalação e uso
Siga o README do repositório: https://github.com/sgl-project/sglang
A campanha não padroniza comandos para esta ferramenta. Antes de rodar algo caro, faça um teste curto e confira a saída.


## Fonte
Skill `projetos` (campanha de benchmark da Rangel Tech). Números que mudam com o tempo (preço de GPU) valem na data da medição: confira o preço do dia.
