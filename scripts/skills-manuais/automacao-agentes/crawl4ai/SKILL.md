---
name: crawl4ai
description: Crawl4AI (ADOTAR). Crawler que entrega markdown/JSON limpo para LLM, com JS. Base de RAG e scrapers de dados publicos. Apache-2.0.
---

# Crawl4AI

**Veredito da campanha (26 a 28/10/2026):** ADOTAR. **Classe do dado:** medido.

## Para que serve
Crawler que entrega markdown/JSON limpo para LLM, com JS. Base de RAG e scrapers de dados publicos. Apache-2.0.

> Open-source web crawler and scraper for LLMs and AI agents: any website into clean, LLM-ready Markdown. Run it yourself, or use Crawl4AI Clo

## O que foi medido
- sandbox CPU: OK, executou, 139.7s, pico RSS 722 MB; example_com_s=0.71; md_chars=46073; docs_python_org_s=0.98

## Hardware
Roda sem GPU dedicada.

## Licença
Apache-2.0 (permissiva). Confira a licença do código e a dos pesos antes de usar em produto.

## Instalação e uso

### Receita testada (Windows, Python 3.14, Crawl4AI 0.9.5, 05/11/2026)

Tarefa: 10 manchetes do Hacker News em CSV. Resultado certo, 10 linhas com título e link real, 1,7 s de execução; o agente levou 6 min no total porque errou duas vezes antes (abaixo).

0. **Caminho curto (use primeiro):** esta skill traz `scripts/raspar.py`, que raspa qualquer página para CSV ou markdown sem escrever código:
   `<python-do-venv> <pasta-da-skill>/scripts/raspar.py --url <site> --item "<seletor do item repetido>" --campo "titulo=a.titulo" --campo "link=a.titulo@href" --max 10 --saida resultado.csv`
   (ou `--markdown --saida pagina.md`). Testado: 10 linhas em 3,8 s. Se der `ZERO_LINHAS`, o seletor está errado: salve `r.html` e inspecione, sem chutar.
1. **Reaproveite o venv que já existe** antes de criar outro (procure `c4ai-venv` na pasta `cache/scratch` do Hermes). Não crie venv dentro da pasta de trabalho do usuário. Se for preciso criar, faça em `cache/scratch` e instale num ambiente isolado, nunca no Python do sistema:
   `python -m venv <pasta-scratch>/c4ai-venv` e depois `<venv>/Scripts/pip install crawl4ai` (no Linux, `bin/pip`). O pacote traz o playwright; se o navegador faltar, rode `crawl4ai-setup` do próprio venv.
2. Use sempre assíncrono, com cache desligado para dados que mudam:

```python
import asyncio
from crawl4ai import AsyncWebCrawler, BrowserConfig, CacheMode

async def main():
    cfg = BrowserConfig(browser_type="chromium", headless=True)
    async with AsyncWebCrawler(config=cfg) as crawler:
        r = await crawler.arun(url="https://exemplo.com", cache_mode=CacheMode.BYPASS)
    if not r.success:
        raise SystemExit(r.error_message)
    html = r.html          # HTML bruto completo, com os href
    md = r.markdown        # texto limpo para LLM

asyncio.run(main())
```

3. Para extrair links, trabalhe sobre `r.html`. Não use `r.fit_html`.

### Armadilhas que custaram tempo

- **`raw_html` não existe nesta versão.** O campo do HTML bruto é `html`. Quem tenta `raw_html` recebe erro, e `fit_html` parece resolver, mas não resolve.
- **`fit_html` é uma versão condensada que apaga os atributos `href`.** Resultado: o parser acha zero linhas e o crawl parece ter falhado, embora tenha dado certo (`success=True`). Se vier zero itens, olhe `r.html` antes de culpar o site.
- **O primeiro `<a>` de cada bloco pode ser botão, não conteúdo.** No Hacker News é o link de voto (`vote?id=`); ancore o parser no elemento do título (`titleline`) ou no seletor do conteúdo.
- **Console do Windows:** use `sys.stdout.reconfigure(encoding="utf-8")` e grave o CSV com `utf-8-sig`, senão o Excel e o terminal mostram acentos quebrados.
- **Heredoc com aspas no shell falha.** Grave o script em arquivo e rode o arquivo.
- Título com vírgula fica entre aspas no CSV; é o comportamento certo do módulo `csv`.
- Medido na campanha: página simples em cerca de 1 s e pico de memória por volta de 720 MB com o Chromium aberto. Em máquina de 8 GB, feche o crawler (`async with`) ao terminar.

Segunda tentativa (site diferente, quotes.toscrape.com): acertou de primeira, sem repetir os erros de `raw_html` e `fit_html`, mas gastou 4 min 47 s e 270 mil tokens recriando o venv na pasta de trabalho e escrevendo o parser; o script acima existe para evitar isso.

Ainda não testado: Linux sem root (a VM do cliente), sites com bloqueio anti-robô e extração por esquema CSS ou LLM.

## Fonte
Fonte: campanha de benchmark de ferramentas (out/2026). Números que mudam com o tempo (preço de GPU) valem na data da medição: confira o preço do dia.
