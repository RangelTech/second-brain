---
name: design-dna
description: |
  Skill que extrai o sistema de design de um site (tokens, estilo, componentes) e aplica em outro projeto. Use quando o cliente disser: "copie o estilo deste site para o meu"; "extraia as cores e fontes de um site"; "aplicar o design de um site em outro"; "sistema de design a partir de um site".
---

# Design DNA

> **Validada no benchmark.**

## Quando usar
Reaproveitar o estilo de um site em outra página.

## Quando NÃO usar
Criar visual do zero (use `design-taste`).

## Passo a passo
Comandos e exemplos do README oficial:

```
npx skills add zanwei/design-dna
```

```
# Cursor only, non-interactive, global install
npx skills add zanwei/design-dna -a cursor -g -y
# Claude Code only
npx skills add zanwei/design-dna -a claude-code -g -y
```

## O que o benchmark mediu
Rodou em sandbox de CPU: 1.0s, pico de memória 24 MB; files=17; md_files=9; skill_md=1; md_kchars=74

## Requisitos
Node (`npx`); navegador controlado pelo agente (`playwright`). Sem GPU.

## Combina com
`awesome-design-md`, `design-md`, `impeccable`.
