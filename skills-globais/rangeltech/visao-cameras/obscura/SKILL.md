---
name: obscura
description: Obscura (TESTAR). Navegador headless em Rust para agentes/scraping, sem Chromium. Comparar RAM/tempo com Playwright. Cuidado: recurso antidetect pode violar termos de sites.
---

# Obscura

**Veredito da campanha (26 a 28/10/2026):** TESTAR. **Classe do dado:** medido.

## Para que serve
Navegador headless em Rust para agentes/scraping, sem Chromium. Comparar RAM/tempo com Playwright. Cuidado: recurso antidetect pode violar termos de sites.

> The headless browser for AI agents and web scraping

## O que foi medido
- sandbox CPU: OK, executou, 7.5s, pico RSS 47 MB; fetch_ms_median=290

## Hardware
Roda sem GPU dedicada.

## Licença
Apache-2.0 (permissiva). Confira a licença do código e a dos pesos antes de usar em produto.

## Instalação e uso

### Receita testada (VM Linux sem root, Obscura 0.2.6, 05/11/2026)

Tarefa: abrir https://example.com e extrair o título e o primeiro parágrafo, comparando com o Playwright. Resultado idêntico nos dois (validação cruzada), e o Obscura medido com `/usr/bin/time -v`: **0,11 s e cerca de 32 MiB**, contra **2,34 s e cerca de 139 MiB** do Playwright (aproximadamente 21 vezes mais rápido e 4 vezes menos memória; no Playwright o número infla por incluir o driver e o Chromium).

Instalação sem Rust: não compile. Baixe o binário pronto da release do repositório `h4ckf0r0day/obscura` (`obscura-x86_64-linux.tar.gz`, 69 MB), extraia o executável `obscura` (ELF de 77 MB), dê `chmod +x` e confira com `./obscura --version`. Nenhuma biblioteca de sistema extra foi necessária.

Comandos (veja `obscura --help`):

- `obscura fetch <url>`: busca a página e devolve o conteúdo;
- `obscura scrape ...`: extração em lote;
- `obscura serve` (porta 9222 por padrão): servidor de protocolo de navegador para usar com Playwright/Puppeteer;
- `obscura mcp`: expõe como servidor MCP para agentes.

Opções úteis: `--obey-robots` (respeita o `robots.txt`), `--user-agent`, `--proxy`, `--storage-dir`, `--allow-private-network` (por padrão bloqueia loopback e redes privadas, como proteção contra SSRF; só habilite para testar `localhost`).

### Armadilhas e avisos

- O Obscura é um motor próprio em Rust com V8, **sem Chromium**: páginas com muito JavaScript ou recursos modernos de navegador podem renderizar diferente do Chrome. Para páginas complexas compare com o Playwright antes de confiar.
- A opção `--stealth` tenta mascarar a identidade do navegador para evitar bloqueios. Isso pode violar os termos de uso de sites: só use com autorização e prefira `--obey-robots`.
- O binário foi colocado na pasta de trabalho no teste; prefira `<dados>/hermes-home/cache/scratch/` para não poluir a pasta do usuário.

Ainda não testado: sites com muito JavaScript, `obscura mcp` e `serve` com Playwright.

## Fonte
Fonte: campanha de benchmark de ferramentas (out/2026). Números que mudam com o tempo (preço de GPU) valem na data da medição: confira o preço do dia.
