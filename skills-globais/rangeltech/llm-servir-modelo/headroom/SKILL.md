---
name: headroom
description: Headroom (ADOTAR). Camada de compressao de contexto (60-95% menos tokens: logs, RAG, historico). Reduz custo de entrada do 27B e das conversas longas do atendimento. Medir perda de qualidade.
---

# Headroom

**Veredito da campanha (26 a 28/10/2026):** ADOTAR. **Classe do dado:** medido.

## Para que serve
Camada de compressao de contexto (60-95% menos tokens: logs, RAG, historico). Reduz custo de entrada do 27B e das conversas longas do atendimento. Medir perda de qualidade.

> Compress tool outputs, logs, files, and RAG chunks before they reach the LLM. 20% fewer tokens for coding agents, 60-95% fewer tokens for JS

## O que foi medido
- sandbox CPU: OK, executou, 34.6s, pico RSS 129 MB; compress_s=2.74

## Hardware
Roda sem GPU dedicada.

## Licença
Apache-2.0 (permissiva). Confira a licença do código e a dos pesos antes de usar em produto.

## Instalação e uso
Siga o README do repositório: https://github.com/headroomlabs-ai/headroom
A campanha não padroniza comandos para esta ferramenta. Antes de rodar algo caro, faça um teste curto e confira a saída.


## Fonte
Fonte: campanha de benchmark de ferramentas (out/2026). Números que mudam com o tempo (preço de GPU) valem na data da medição: confira o preço do dia.
