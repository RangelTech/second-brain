---
name: awesome-design-md
description: |
  Coleção de 84 sistemas de design de marcas conhecidas em um arquivo DESIGN.md cada, para o agente seguir ao montar uma interface. Use quando o cliente pedir 'no estilo de' uma marca.
  Use quando o cliente disser: "faça a página no estilo do Airbnb"; "quero o visual de uma marca conhecida"; "usar o design system de uma empresa".
---

# Awesome Design MD

> **Validada na bancada (parcial):** conteúdo conferido (estrutura e tokens dos arquivos); não gerei uma página para comparar o resultado.

## Quando usar
Cliente pede uma página no estilo (cores, tipografia, espaçamentos) de uma marca de referência: copie o `DESIGN.md` da marca para o projeto e mande o agente segui-lo.

## Quando NÃO usar
Copiar a marca em produto real (logos e marcas registradas). O arquivo é uma análise de estilo, não autoriza uso da marca.

## Combina com
`design-taste`, `ui-ux-pro-max`, `impeccable` (revisar depois), `playwright` (print).

## Receita validada na bancada (parcial)
```bash
git clone --depth 1 https://github.com/VoltAgent/awesome-design-md
ls awesome-design-md/design-md          # 84 pastas: airbnb, apple, airtable...
cp awesome-design-md/design-md/airbnb/DESIGN.md ./DESIGN.md
```
Cada `DESIGN.md` tem frontmatter YAML (cores, tipografia, espaçamentos, componentes) e texto de uso (31 KB no caso do Airbnb). Instrução ao agente: "construa a página seguindo o DESIGN.md na raiz".

## Armadilhas
- Arquivos grandes (30 KB): leia só as seções de cores e tipografia para economizar contexto.
- Não testei a fidelidade da página gerada.

## Tempo e recursos medidos
clone 4 MB.
