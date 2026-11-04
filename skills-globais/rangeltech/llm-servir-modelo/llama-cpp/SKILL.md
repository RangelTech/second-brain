---
name: llama-cpp
description: llama.cpp (TESTAR). Inferencia com GGUF/CPU/pouca VRAM. Nao medido.
---

# llama.cpp

**Veredito da campanha (26 a 28/10/2026):** TESTAR. **Classe do dado:** medido.

## Para que serve
Inferencia com GGUF/CPU/pouca VRAM. Nao medido.

> LLM inference in C/C++

## O que foi medido
- CUDA 4090, Qwen3.5-9B: Q4_K_M 146,8 tok/s geracao / 10.864 tok/s prompt; Q8_0 97,0 / 11.743
- sandbox CPU: OK, executou, 176.7s, pico RSS 4494 MB / sandbox CPU: OK, executou, 524.1s, pico RSS 9442 MB

## Hardware
Precisa de GPU. Siga a skill `gpu-barata` para escolher e alugar (ligar, usar e desligar para não pagar parado).

## Licença
MIT (permissiva). Confira a licença do código e a dos pesos antes de usar em produto.

## Instalação e uso
Siga o README do repositório: https://github.com/ggml-org/llama.cpp
A campanha não padroniza comandos para esta ferramenta. Antes de rodar algo caro, faça um teste curto e confira a saída.


## Fonte
Fonte: campanha de benchmark de ferramentas (out/2026). Números que mudam com o tempo (preço de GPU) valem na data da medição: confira o preço do dia.
