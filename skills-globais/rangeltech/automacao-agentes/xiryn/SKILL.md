---
name: xiryn
description: |
  Equipe de agentes, cada um com um desktop Linux em Docker e controle por Telegram. Use quando o cliente disser: "quero uma equipe de agentes cada um com seu computador"; "controlar agentes pelo Telegram"; "sandbox visual para agentes".
---

# Xiryn

> **Validada no benchmark (clone e inspeção).**

## Quando usar
Ideia de sandbox visual por agente.

## Quando NÃO usar
Máquina sem Docker.

## Passo a passo
Comandos e exemplos do README oficial:

```
cd xiryn
npm run dev                    # or: npm run build && npm start
```

```
npm run background              # starts Xiryn with no terminal or browser needed
npm run background -- login     # …and whenever you log in to this computer
npm run background -- stop      # stop it (status, restart and no-login work too)
```

## O que o benchmark mediu
Clonado e inspecionado em sandbox de CPU (não executado): 1.5s, pico de memória 34 MB

## Requisitos
Docker; bot de Telegram. Sem GPU.

## Combina com
`playwright`.
