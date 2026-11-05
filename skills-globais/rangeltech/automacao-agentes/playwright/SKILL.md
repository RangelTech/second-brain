---
name: playwright
description: Playwright (ADOTAR). Automacao de navegador e testes E2E. Ja usado.
---

# Playwright

**Veredito da campanha (26 a 28/10/2026):** ADOTAR. **Classe do dado:** medido.

## Para que serve
Automacao de navegador e testes E2E. Ja usado.

> Playwright is a framework for Web Testing and Automation. It allows testing Chromium, Firefox and WebKit with a single API.

## O que foi medido
- sandbox CPU: OK, executou, 70.9s, pico RSS 532 MB; goto_ms_median=24

## Hardware
Roda sem GPU dedicada.

## Licença
Apache-2.0 (permissiva). Confira a licença do código e a dos pesos antes de usar em produto.

## Instalação e uso

### Receita testada (Windows, Python 3.14, 05/11/2026)

Tarefa: abrir https://quotes.toscrape.com, tirar print da página inteira e listar os links. Resultado correto em 6,4 s de execução (PNG 1280x1800, 49 links únicos); o agente levou 5 min no total.

```
python -m venv <scratch>/pw-venv
<scratch>/pw-venv/Scripts/pip install playwright
<scratch>/pw-venv/Scripts/playwright install chromium      # só se ainda não houver navegador em %LOCALAPPDATA%/ms-playwright
```

O Chromium é guardado em um cache global (`%LOCALAPPDATA%/ms-playwright` no Windows, `~/.cache/ms-playwright` no Linux) e reaproveitado entre ambientes: confira antes de baixar de novo.

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    nav = p.chromium.launch(headless=True)
    pag = nav.new_page(viewport={"width": 1280, "height": 900})
    pag.goto("https://exemplo.com", wait_until="networkidle", timeout=60_000)
    pag.screenshot(path="pagina.png", full_page=True)          # página inteira, não só a janela
    links = [a.get_attribute("href") for a in pag.query_selector_all("a")]
    nav.close()
```

- `full_page=True` é o que faz o print pegar a página toda. Confirme lendo o tamanho do PNG (altura maior que a janela).
- Remova links vazios e duplicados, preservando a ordem da página.
- Para páginas com JavaScript pesado, `wait_until="networkidle"`; para sites que nunca ficam ociosos, use `"load"` e `pag.wait_for_selector(...)`.
- Abrir o navegador leva de 4 a 5 s; o resto é rápido. Em lote, reutilize o mesmo navegador e abra várias páginas.
- Ainda não testado: Linux sem root (a VM do cliente) e sites com bloqueio anti-robô.
- Para sites de terceiros, respeite os termos de uso e o `robots.txt`.

## Fonte
Fonte: campanha de benchmark de ferramentas (out/2026). Números que mudam com o tempo (preço de GPU) valem na data da medição: confira o preço do dia.
