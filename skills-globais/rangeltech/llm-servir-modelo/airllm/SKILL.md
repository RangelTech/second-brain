---
name: airllm
description: AirLLM (ESTUDAR). Roda modelos enormes em GPU pequena com offload em camadas: lento, so lote offline. Nao serve a chat/API interativa.
---

# AirLLM

**Veredito da campanha (26 a 28/10/2026):** ESTUDAR. **Classe do dado:** medido.

## Para que serve
Roda modelos enormes em GPU pequena com offload em camadas: lento, so lote offline. Nao serve a chat/API interativa.

> AirLLM 2.8T LLM inference with single 4GB GPU

## O que foi medido
- 27B BF16: 3090 0,039 tok/s; 4090 0,089; L40S 0,05; 5090 0,03 (VRAM 3,5 GB, nao usa a placa) -> inviavel p/ uso interativo; AWQ nativo roda 40-60 tok/s nas mesmas placas

## Hardware
Precisa de GPU. Siga a skill `gpu-barata` para escolher e alugar (ligar, usar e desligar para não pagar parado).

## Licença
Apache-2.0 (permissiva). Confira a licença do código e a dos pesos antes de usar em produto.

## Instalação e uso
Siga o README do repositório: https://github.com/lyogavin/airllm
A campanha não padroniza comandos para esta ferramenta. Antes de rodar algo caro, faça um teste curto e confira a saída.


## Fonte
Fonte: campanha de benchmark de ferramentas (out/2026). Números que mudam com o tempo (preço de GPU) valem na data da medição: confira o preço do dia.
