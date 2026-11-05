---
name: vibe-trading
description: |
  Agentes de trading que fazem backtest e análise a partir de um pedido em linguagem natural. Use quando o cliente disser: "teste uma estratégia de média móvel no BTC"; "backtest de estratégia de criptomoeda"; "agente de trading".
---

# Vibe-Trading

> **Validada no benchmark.**

## Quando usar
Backtest de estratégias.

## Quando NÃO usar
Fora de mercado financeiro.

## Passo a passo
Comandos e exemplos do README oficial:

```
vibe-trading run -p "Backtest a BTC-USDT 20/50 moving-average crossover for 2024. Compare it with buy-and-hold and report maximum drawdown."
vibe-trading alpha bench --zoo gtja191 --universe csi300 --period 2018-2025 --top 20
```

```
pip install vibe-trading-ai
vibe-trading init
vibe-trading
```

## O que o benchmark mediu
Rodou em sandbox de CPU: 55.3s, pico de memória 228 MB

## Requisitos
Python; chaves de LLM; sem GPU. Sem GPU.

## Combina com
`autohedge`, `nautilustrader`.
