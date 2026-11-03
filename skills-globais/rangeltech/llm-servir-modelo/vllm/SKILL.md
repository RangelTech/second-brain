---
name: vllm
description: vLLM (ADOTAR). Engine de servir o nosso LLM. Medido em 7 GPUs.
---

# vLLM

**Veredito da campanha (26 a 28/10/2026):** ADOTAR. **Classe do dado:** medido.

## Para que serve
Engine de servir o nosso LLM. Medido em 7 GPUs.

> A high-throughput and memory-efficient inference and serving engine for LLMs

## O que foi medido
- 27B abliterado: ver aba Capacidade LLM; 9B BF16 4090: 657 tok/s com 16 usuarios (TTFT 0,16 s); NVFP4 roda ate na L40S

## Hardware
Precisa de GPU. Siga a skill `gpu-barata` para escolher e alugar (ligar, usar e desligar para não pagar parado).

## Licença
Apache-2.0 (permissiva). Confira a licença do código e a dos pesos antes de usar em produto.

## Instalação e uso
Siga o README do repositório: https://github.com/vllm-project/vllm
A campanha não padroniza comandos para esta ferramenta. Antes de rodar algo caro, faça um teste curto e confira a saída.


## Fonte
Skill `projetos` (campanha de benchmark da Rangel Tech). Números que mudam com o tempo (preço de GPU) valem na data da medição: confira o preço do dia.
