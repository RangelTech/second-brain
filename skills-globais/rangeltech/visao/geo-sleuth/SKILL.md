---
name: geo-sleuth
description: |
  Skill que deduz o local de uma foto por pistas visuais. Use quando o cliente disser: "descubra onde esta foto foi tirada"; "localizar lugar por imagem"; "geolocalizar foto".
---

# geo-sleuth

> **Validada no benchmark (clone e inspeção).**

## Quando usar
Descobrir o local de uma foto de um imóvel, paisagem ou rua.

## Quando NÃO usar
Fotos sem pistas visuais.

## Passo a passo
Comandos e exemplos do README oficial:

```
npx skills add Oldcircle/geo-sleuth
```

```
npx skills add Oldcircle/geo-sleuth -g -a claude-code -a codex -a cursor -a gemini-cli -a opencode -a github-copilot -y
```

## O que o benchmark mediu
Clonado e inspecionado em sandbox de CPU (não executado): 1.5s, pico de memória 31 MB

## Requisitos
Node (`npx`); sem GPU. Sem GPU.

## Combina com
`vision`.
