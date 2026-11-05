"""Raspa uma página com Crawl4AI e grava CSV ou markdown, sem escrever código novo.

Exemplos (rode com o python do venv do Crawl4AI):
  raspar.py --url https://quotes.toscrape.com --item "div.quote" \
            --campo "citacao=span.text" --campo "autor=small.author" --max 10 --saida citacoes.csv
  raspar.py --url https://exemplo.com --markdown --saida pagina.md
  --campo "link=a.titulo@href" pega o atributo href (use @atributo depois do seletor).
"""
import argparse, asyncio, csv, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


async def baixar(url: str, espera: float):
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CacheMode, CrawlerRunConfig
    cfg = BrowserConfig(browser_type="chromium", headless=True)
    run = CrawlerRunConfig(cache_mode=CacheMode.BYPASS, delay_before_return_html=espera)
    async with AsyncWebCrawler(config=cfg) as crawler:
        r = await crawler.arun(url=url, config=run)
    if not r.success:
        raise SystemExit(f"FALHA_CRAWL: {r.error_message}")
    return r


def extrair(html: str, item: str, campos: list[tuple[str, str]], maximo: int):
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    linhas = []
    for el in soup.select(item):
        linha = []
        for _, seletor in campos:
            sel, _, attr = seletor.partition("@")
            alvo = el.select_one(sel) if sel else el
            if alvo is None:
                linha.append("")
            elif attr:
                linha.append((alvo.get(attr) or "").strip())
            else:
                linha.append(alvo.get_text(" ", strip=True))
        if any(linha):
            linhas.append(linha)
        if len(linhas) >= maximo:
            break
    return linhas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--item", help="seletor CSS de cada item repetido")
    ap.add_argument("--campo", action="append", default=[], help="nome=seletor[@atributo]")
    ap.add_argument("--max", type=int, default=10)
    ap.add_argument("--markdown", action="store_true", help="grava o texto limpo da página")
    ap.add_argument("--espera", type=float, default=0.0, help="segundos extras para páginas com JavaScript")
    ap.add_argument("--saida", required=True)
    a = ap.parse_args()
    r = asyncio.run(baixar(a.url, a.espera))
    if a.markdown:
        open(a.saida, "w", encoding="utf-8").write(str(r.markdown))
        print(f"OK markdown {len(str(r.markdown))} caracteres -> {a.saida}")
        return
    if not a.item or not a.campo:
        raise SystemExit("informe --item e ao menos um --campo (ou use --markdown)")
    campos = [tuple(c.split("=", 1)) for c in a.campo]
    linhas = extrair(r.html, a.item, campos, a.max)  # r.html, nunca r.fit_html (ele apaga os href)
    if not linhas:
        raise SystemExit("ZERO_LINHAS: confira o seletor --item contra r.html (salve o HTML e inspecione)")
    with open(a.saida, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow([n for n, _ in campos])
        w.writerows(linhas)
    print(f"OK {len(linhas)} linhas -> {a.saida}")
    for l in linhas[:3]:
        print(" | ".join(x[:80] for x in l))


main()
