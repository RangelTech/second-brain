---
name: freellmapi
description: |
  Roteia entre 34 provedores gratuitos (cerca de 635 endpoints de modelos) atrás de um endpoint `/v1` compatível com OpenAI. Use quando o cliente disser: "preciso de um endpoint de IA gratuito"; "usar vários provedores gratuitos num endereço só"; "gateway de LLM com fallback".
---

# FreeLLMAPI

> **Validada no benchmark.**

## Quando usar
Experimentos sem custo.

## Quando NÃO usar
Quando o gateway próprio (`9router`) já resolve.

## Passo a passo
Comandos e exemplos do README oficial:

```
curl -fsSL https://freellmapi.co/install.sh | bash
```

## O que o benchmark mediu
Rodou em sandbox de CPU: 18.1s, pico de memória 486 MB

## Requisitos
Node; sem GPU; chaves gratuitas de cada provedor. Sem GPU.

## Combina com
`9router`, `llm-servir-modelo`.
