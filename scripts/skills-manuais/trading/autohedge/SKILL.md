---
name: autohedge
description: |
  Enxame de agentes que analisa mercado e simula decisões de um fundo. Use quando o cliente disser: "simule um fundo de investimento com agentes"; "analise o mercado com vários agentes"; "backtest de estratégia de ações".
---

# AutoHedge

> **Validada no benchmark.**

## Quando usar
Estudo e simulação de estratégias com agentes.

## Quando NÃO usar
Quando não houver chave de LLM/dados de mercado.

## Passo a passo
Comandos e exemplos do README oficial:

```
pip install -U autohedge
```

## O que o benchmark mediu
Rodou em sandbox de CPU: 15.1s, pico de memória 84 MB

## Requisitos
Python (pip); chaves de LLM; sem GPU. Sem GPU.

## Combina com
`vibe-trading`, `nautilustrader`.
