---
name: camofox-browser
description: |
  Navegador automatizável com impressão digital de navegador real. Use quando o cliente disser: "abrir sites que bloqueiam robôs"; "navegador automatizado discreto"; "raspar página que exige navegador real".
---

# Camofox browser

> **Validada no benchmark.**

## Quando usar
Raspagem de páginas que não carregam em navegador headless comum.

## Quando NÃO usar
Quando `playwright` ou `obscura` carregam a página.

## Passo a passo
Comandos e exemplos do README oficial:

```
# macOS / Linux
openssl rand -hex 32
```

```
export CAMOFOX_API_KEY="your-generated-key"
openclaw start
```

## O que o benchmark mediu
Rodou em sandbox de CPU: 132.2s, pico de memória 803 MB; baseline_playwright_failed_mentions=3

## Requisitos
Node; Linux/macOS/Windows; sem GPU. Sem GPU.

## Combina com
`playwright`, `obscura`, `crawl4ai`.
