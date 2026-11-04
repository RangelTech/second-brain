#!/usr/bin/env python3
"""Busca um texto humano de referencia, anterior aos LLMs, sobre assunto parecido.

E o terceiro ponto da regua. Sem ele so da para comparar dois textos de maquina
entre si, e nao se sabe onde fica o chao.

Fonte: revisao de artigo da Wikipedia anterior a 2021-06-01. O ChatGPT abriu em
2022-11-30, entao essa data da margem folgada contra texto ja tocado por modelo.

Preserva os paragrafos. Isto nao e detalhe cosmetico: achatar paragrafos de um
RFC humano com regex subiu a acusacao do detector de 12% para 90% no MESMO
conteudo. Formatacao mexe no detector tanto quanto o texto.

Uso:
    python human_ref.py "aprendizado de maquina" --lang pt -o ref.txt
    python human_ref.py "citation analysis" --lang en -o ref.txt --min-words 400
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.parse
import urllib.request

CUTOFF = "2021-06-01T00:00:00Z"
UA = {"User-Agent": "testes-relatorios/1.0 (skill de validacao)"}


def api(lang: str, params: dict) -> dict | None:
    params = {**params, "format": "json", "formatversion": "2"}
    url = f"https://{lang}.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
            return json.loads(r.read().decode("utf-8", "replace"))
    except Exception as e:
        print(f"[erro] {type(e).__name__}: {e}", file=sys.stderr)
        return None


def find_titles(query: str, lang: str, n: int = 8) -> list[str]:
    d = api(lang, {"action": "query", "list": "search", "srsearch": query, "srlimit": n})
    return [h["title"] for h in (((d or {}).get("query") or {}).get("search") or [])]


def old_wikitext(title: str, lang: str) -> tuple[str, str] | None:
    d = api(lang, {"action": "query", "prop": "revisions", "titles": title,
                   "rvprop": "content|timestamp", "rvslots": "main", "rvlimit": 1,
                   "rvstart": CUTOFF, "rvdir": "older"})
    pages = ((d or {}).get("query") or {}).get("pages") or []
    if not pages or "revisions" not in pages[0]:
        return None
    rev = pages[0]["revisions"][0]
    return rev["slots"]["main"]["content"], rev.get("timestamp", "?")


def to_prose(wt: str, min_para: int = 140) -> str:
    """Markup -> prosa, MANTENDO a separacao de paragrafos."""
    t = wt
    for pat in (r"(?s)\{\{.*?\}\}", r"(?s)<ref[^>]*>.*?</ref>", r"(?s)<!--.*?-->",
                r"(?s)\{\|.*?\|\}", r"(?s)<gallery.*?</gallery>"):
        prev = None
        while prev != t:               # aninhados
            prev, t = t, re.sub(pat, "", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = re.sub(r"\[\[(?:[^\]\|]*\|)?([^\]]*)\]\]", r"\1", t)
    t = re.sub(r"\[https?://\S+\s+([^\]]*)\]", r"\1", t)
    t = re.sub(r"'{2,}", "", t)
    t = re.sub(r"&nbsp;", " ", t)

    paras = []
    for block in t.split("\n"):
        b = block.strip()
        if len(b) < min_para:
            continue
        if b[0] in "*#:;=|!{" or b.lower().startswith(("thumb", "file:", "ficheiro:", "imagem:")):
            continue
        paras.append(re.sub(r"[ \t]+", " ", b))
    return "\n\n".join(paras)


def main() -> int:
    ap = argparse.ArgumentParser(description="Controle humano pre-LLM da Wikipedia.")
    ap.add_argument("query")
    ap.add_argument("--lang", default="pt", choices=["pt", "en"])
    ap.add_argument("-o", "--out")
    ap.add_argument("--min-words", type=int, default=300)
    args = ap.parse_args()

    titles = find_titles(args.query, args.lang)
    if not titles:
        print(f"nenhum artigo encontrado para '{args.query}' em {args.lang}", file=sys.stderr)
        return 1

    # Percorre os candidatos ate achar um que tenha revisao antiga E prosa
    # suficiente. O primeiro resultado da busca costuma ser um artigo recente ou
    # curto demais; desistir nele deixava a regua sem o terceiro ponto.
    title = prose = ts = None
    for cand in titles:
        got = old_wikitext(cand, args.lang)
        if not got:
            print(f"[pulei] '{cand}': sem revisao anterior a {CUTOFF[:10]}", file=sys.stderr)
            continue
        p = to_prose(got[0])
        if len(p.split()) < args.min_words:
            print(f"[pulei] '{cand}': so {len(p.split())} palavras de prosa", file=sys.stderr)
            continue
        title, prose, ts = cand, p, got[1]
        break

    if not prose:
        print(f"nenhum dos {len(titles)} candidatos serve como referencia humana", file=sys.stderr)
        return 1
    n = len(prose.split())

    print(f"artigo   : {title} ({args.lang})", file=sys.stderr)
    print(f"revisao  : {ts}", file=sys.stderr)
    print(f"prosa    : {n} palavras em {prose.count(chr(10)*2)+1} paragrafos", file=sys.stderr)

    if args.out:
        open(args.out, "w", encoding="utf-8").write(prose)
        print(f"gravado  : {args.out}", file=sys.stderr)
    else:
        print(prose)
    return 0


if __name__ == "__main__":
    sys.exit(main())
