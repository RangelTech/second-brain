---
name: impeccable
description: |
  Detector determinístico de erros de design em páginas (62 regras, sem IA nem chave): contraste, fontes batidas, gradiente roxo, cartão dentro de cartão. Use para revisar uma página HTML gerada antes de entregar.
  Use quando o cliente disser: "revise o design da minha página"; "o site está com cara de IA"; "confira contraste e acessibilidade da página".
---

# Impeccable

> **Validada na bancada (parcial):** detector testado (7 achados em 1,2 s, sem chave); comandos de IA (critique/polish) não testados

## Quando usar
Depois de gerar ou editar uma página/site/componente: rode `detect` para listar problemas de contraste, hierarquia, fonte genérica e 'cara de IA', corrija e rode de novo.

## Quando NÃO usar
Para criar o design do zero (use `design-taste` / `ui-ux`); o detector só aponta defeitos. Não substitui olhar a tela (screenshot).

## Combina com
`design-taste`, `ui-ux-pro-max` (geração) e depois `impeccable detect` (revisão); `playwright` para tirar print da página; `headroom` se a saída for longa.

## Receita validada na bancada (parcial)
Funciona sem root e sem chave (precisa só de Node):
```bash
npx -y impeccable detect pagina.html        # arquivo, pasta ou URL
npx -y impeccable detect ./site/            # pasta inteira
```
Teste (página propositalmente ruim: Inter, gradiente roxo/azul, texto cinza, cartão dentro de cartão): **7 problemas** apontados em 1,2 s, cada um com a regra e como corrigir, por exemplo `[low-contrast] 1.8:1 (need 4.5:1)`, `[gray-on-color]`, `[overused-font] inter`, `[ai-color-palette] purple/violet`. Fluxo do agente: gerar página, `detect`, corrigir os itens, `detect` de novo até zerar, tirar print e conferir visualmente.

## Armadilhas
- A saída repete o mesmo achado por seletor; resuma por regra antes de agir.
- Não testei os comandos de revisão por IA (`critique`, `audit`, `polish`, `bolder`): são prompts para o agente instalados com `npx impeccable install`, que escreve na pasta de skills do assistente. No Cérebro Pro essas skills precisam ser convertidas para a pasta do Hermes.
- O CLI envia telemetria anônima por padrão: desligue com `npx impeccable telemetry off`.
- Falso positivo: contraste de texto sobre imagem de fundo não é calculado de verdade.

## Tempo e recursos medidos
Primeira execução 4,5 s (baixa o pacote), seguintes 1,2 s. Sem GPU, sem chave.
