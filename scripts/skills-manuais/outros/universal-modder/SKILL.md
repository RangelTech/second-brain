---
name: universal-modder
description: |
  Fluxo de agente para criar mods de jogos. Use quando o cliente disser: "modificar um jogo com agente"; "criar mod para jogo".
---

# universal-modder

> **Validada no benchmark.**

## Quando usar
Pedido de mod de jogo.

## Quando NÃO usar
Outros usos.

## Passo a passo
Comandos e exemplos do README oficial:

```
uv tool install git+https://github.com/rehan-remade/universal-modder     # or: pipx install git+...
```

```
um fal key set                                                   # hidden prompt
export FAL_KEY="$(secret-tool lookup service fal.ai key api)"    # Linux: before starting the agent
```

## O que o benchmark mediu
Rodou em sandbox de CPU: 3.0s, pico de memória 33 MB; files=685; md_files=348; skill_md=12; md_kchars=4510

## Requisitos
Python (uv ou pipx). Sem GPU.

## Combina com
nada.
