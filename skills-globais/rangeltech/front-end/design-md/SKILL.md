---
name: design-md
description: |
  Formato DESIGN.md para descrever a identidade visual ao agente, com validador de linha de comando (lint de tokens, contraste WCAG, referências quebradas). Use para validar ou comparar o DESIGN.md do projeto.
  Use quando o cliente disser: "valide o DESIGN.md do projeto"; "confira contraste das cores do design system"; "compare duas versões do design".
---

# Design.md (Google Labs)

> **Validada na bancada.**

## Quando usar
Depois de criar ou baixar um DESIGN.md (ver `awesome-design-md`): validar tokens e contraste; comparar duas versões; exportar.

## Quando NÃO usar
Para criar o visual do zero (use `design-taste`/`ui-ux-pro-max`). Não substitui revisão visual da página.

## Combina com
`awesome-design-md` (biblioteca de marcas), `impeccable` (revisa a página), `design-taste`.

## Receita validada na bancada
Funciona sem root e sem chave (precisa de Node):
```bash
npx -y -p @google/design.md designmd lint DESIGN.md      # use o alias sem ponto
npx -y -p @google/design.md designmd diff DESIGN.md DESIGN-v2.md
```
Teste: `lint` do `DESIGN.md` do Airbnb (de `awesome-design-md`) em **1,5 s**: devolveu JSON com avisos, por exemplo `textTransform` não é propriedade válida e contraste do botão primário 3,52:1 abaixo do mínimo WCAG AA (4,5:1). Pacote `@google/design.md` 0.4.0.

## Armadilhas
- `npx @google/design.md lint` (com ponto) não imprimiu nada no teste e saiu com código 1; use `-p @google/design.md designmd`.
- A saída é JSON longo: resuma por severidade.
- Valida o arquivo, não a página gerada.

## Tempo e recursos medidos
1,5 s por arquivo.
