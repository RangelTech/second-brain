#!/usr/bin/env python3
"""Verifica referencias academicas contra Crossref, OpenAlex e Semantic Scholar.

Sem dependencia externa: usa apenas a stdlib (urllib + difflib).

Uso:
    python verify_refs.py refs.bib
    python verify_refs.py refs.json --mailto voce@exemplo.com
    python verify_refs.py --title "Attention Is All You Need" --year 2017
    python verify_refs.py refs.bib --json > relatorio.json

Entrada aceita .bib, .json (lista de objetos com title/authors/year/doi) ou
uma referencia solta via --title.

Pontuacao (0-100): titulo 0.6, autores 0.2, ano 0.2.
  >= 85 e sem conflito duro -> verificada
  60-85                     -> possivel correspondencia, humano decide
  < 60                      -> nao verificada

LIMITE CONHECIDO: nenhuma API academica gratuita encontra erro de digitacao em
palavra distintiva do titulo. Todas fazem busca por token, e uma palavra
escrita errada some do indice. "nao encontrado" pode significar alucinacao OU
typo; o script nao distingue. Confira o titulo a mao antes de concluir que a
obra nao existe.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from difflib import SequenceMatcher

TIMEOUT = 15
UA_BASE = "academico-verify-refs/1.0"
PAUSE = 0.34  # cortesia entre chamadas

W_TITLE, W_AUTHORS, W_YEAR = 0.6, 0.2, 0.2
VERIFIED_AT, MAYBE_AT = 85.0, 60.0


# --------------------------------------------------------------------------- util

def norm(s: str) -> str:
    """Minusculas, sem acento, sem pontuacao, espacos colapsados."""
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^\w\s]", " ", s.lower())
    return re.sub(r"\s+", " ", s).strip()


def ratio(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, norm(a), norm(b)).ratio() * 100


def surname(name: str) -> str:
    """Ultimo token alfabetico -- funciona para 'Ada Lovelace' e 'Lovelace, Ada'."""
    n = norm(name)
    if not n:
        return ""
    if "," in name:
        n = norm(name.split(",")[0])
    parts = [p for p in n.split() if len(p) > 1]
    return parts[-1] if parts else ""


def get_json(url: str, headers: dict | None = None) -> dict | None:
    req = urllib.request.Request(url, headers={"User-Agent": UA_BASE, **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return json.loads(r.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        if e.code == 429:
            return {"__ratelimited__": True}
        return None
    except Exception:
        return None


# ------------------------------------------------------------------------ parsing

def parse_bib(text: str) -> list[dict]:
    """Parser minimo de BibTeX. Cobre o caso comum; nao e um parser completo."""
    out = []
    for raw in re.split(r"(?m)^\s*@", text)[1:]:
        entry = {"key": (re.match(r"\w+\s*\{\s*([^,]+),", raw) or [None, ""])[1].strip()}
        for field in ("title", "author", "year", "doi", "journal", "booktitle"):
            m = re.search(rf"(?is)\b{field}\s*=\s*[{{\"](.+?)[}}\"]\s*[,\n}}]", raw)
            if m:
                entry[field] = re.sub(r"[{}]", "", m.group(1)).strip()
        if entry.get("title"):
            out.append({
                "key": entry["key"],
                "title": re.sub(r"\s+", " ", entry["title"]),
                "authors": [a.strip() for a in re.split(r"\s+and\s+", entry.get("author", "")) if a.strip()],
                "year": int(entry["year"]) if str(entry.get("year", "")).strip().isdigit() else None,
                "doi": entry.get("doi"),
            })
    return out


def load_refs(path: str) -> list[dict]:
    # utf-8-sig, nao utf-8: arquivo gerado no Windows costuma vir com BOM, e o BOM
    # sobrevivente quebra a ancora ^\s*@ do split de BibTeX, descartando a primeira
    # entrada em silencio.
    text = open(path, encoding="utf-8-sig", errors="replace").read()
    if path.lower().endswith(".json"):
        data = json.loads(text)
        refs = data if isinstance(data, list) else data.get("references", [])
        for i, r in enumerate(refs):
            r.setdefault("key", f"ref{i + 1}")
            a = r.get("authors") or []
            r["authors"] = [a] if isinstance(a, str) else list(a)
        return refs
    return parse_bib(text)


# ------------------------------------------------------------------------- fontes

def q_crossref(ref: dict, mailto: str | None) -> list[dict]:
    ua = f"{UA_BASE} (mailto:{mailto})" if mailto else UA_BASE
    if ref.get("doi"):
        doi = re.sub(r"^https?://(dx\.)?doi\.org/", "", str(ref["doi"])).strip()
        d = get_json(f"https://api.crossref.org/works/{urllib.parse.quote(doi)}", {"User-Agent": ua})
        if d and d.get("message"):
            return [_cr_item(d["message"])]
    p = urllib.parse.urlencode({
        "query.bibliographic": ref["title"], "rows": 5,
        "select": "DOI,title,author,issued,container-title,URL",
    })
    d = get_json(f"https://api.crossref.org/works?{p}", {"User-Agent": ua})
    items = ((d or {}).get("message") or {}).get("items") or []
    return [_cr_item(i) for i in items]


def _cr_item(i: dict) -> dict:
    yr = None
    for k in ("published-print", "published-online", "issued", "created"):
        dp = (i.get(k) or {}).get("date-parts") or []
        if dp and dp[0] and isinstance(dp[0][0], int):
            yr = dp[0][0]
            break
    return {
        "source": "Crossref",
        "title": (i.get("title") or [""])[0],
        "authors": [f"{a.get('given', '')} {a.get('family', '')}".strip() for a in (i.get("author") or [])],
        "year": yr,
        "doi": i.get("DOI"),
        "venue": (i.get("container-title") or [None])[0],
        "url": i.get("URL"),
    }


def q_openalex(ref: dict, mailto: str | None) -> list[dict]:
    params = {"search": ref["title"], "per-page": 5}
    if mailto:
        params["mailto"] = mailto
    d = get_json("https://api.openalex.org/works?" + urllib.parse.urlencode(params))
    out = []
    for w in (d or {}).get("results", [])[:5]:
        out.append({
            "source": "OpenAlex",
            "title": w.get("display_name") or "",
            "authors": [(a.get("author") or {}).get("display_name", "") for a in (w.get("authorships") or [])],
            "year": w.get("publication_year"),
            "doi": (w.get("doi") or "").replace("https://doi.org/", "") or None,
            "venue": ((w.get("primary_location") or {}).get("source") or {}).get("display_name"),
            "url": w.get("doi") or w.get("id"),
        })
    return out


def q_s2(ref: dict) -> list[dict]:
    p = urllib.parse.urlencode({
        "query": ref["title"], "limit": 5,
        "fields": "title,authors,year,externalIds,venue,url",
    })
    # Sem chave o Semantic Scholar devolve 429 quase sempre, e e justamente a base
    # com melhor cobertura de computacao e biomedicas. Chave gratuita em
    # https://www.semanticscholar.org/product/api  ->  export SEMANTIC_SCHOLAR_API_KEY
    key = os.environ.get("SEMANTIC_SCHOLAR_API_KEY")
    hdr = {"x-api-key": key} if key else None
    d = get_json(f"https://api.semanticscholar.org/graph/v1/paper/search?{p}", hdr)
    if d and d.get("__ratelimited__"):
        return []
    out = []
    for w in (d or {}).get("data", [])[:5]:
        out.append({
            "source": "SemanticScholar",
            "title": w.get("title") or "",
            "authors": [a.get("name", "") for a in (w.get("authors") or [])],
            "year": w.get("year"),
            "doi": (w.get("externalIds") or {}).get("DOI"),
            "venue": w.get("venue"),
            "url": w.get("url"),
        })
    return out


# ---------------------------------------------------------------------- pontuacao

def score(ref: dict, cand: dict) -> tuple[float, list[str], list[str]]:
    """Retorna (nota, conflitos_duros, avisos_brandos)."""
    hard: list[str] = []
    soft: list[str] = []

    t = ratio(ref["title"], cand["title"])

    want = {surname(a) for a in (ref.get("authors") or []) if surname(a)}
    got = {surname(a) for a in (cand.get("authors") or []) if surname(a)}
    if want and got:
        overlap = len(want & got) / len(want)
        a_score = overlap * 100
        if overlap == 0:
            hard.append(f"nenhum autor em comum (esperado {sorted(want)[:3]}, achado {sorted(got)[:3]})")
        elif overlap < 0.5:
            soft.append(f"autores parcialmente diferentes ({overlap:.0%} de sobreposicao)")
    else:
        a_score = 50.0  # sem dado dos dois lados: neutro, nao penaliza nem premia
        if not want:
            soft.append("referencia sem autor informado")

    # Identidade da obra: titulo forte + autores batendo. Quando os dois casam, a
    # obra FOI encontrada, e uma divergencia de ano e artefato de indice (reimpressao,
    # preprint vs anais, re-indexacao), nao sinal de alucinacao. Caso real: "Attention
    # Is All You Need" volta do OpenAlex com ano 2025. O sinal de alucinacao e titulo
    # ou autor errado, nunca o ano sozinho.
    identity = t >= 90 and (not want or not got or len(want & got) / len(want) >= 0.5)

    ry, cy = ref.get("year"), cand.get("year")
    if ry and cy:
        d = abs(int(ry) - int(cy))
        y_score = 100.0 if d == 0 else (60.0 if d == 1 else 0.0)
        if d == 1:
            soft.append(f"ano difere em 1 ({ry} vs {cy}) -- tipico de preprint vs publicado")
        elif d > 1:
            msg = f"ano divergente ({ry} vs {cy})"
            if identity:
                soft.append(msg + " -- titulo e autores batem, provavel artefato de indice; confira a data na fonte")
            else:
                hard.append(msg)
    else:
        y_score = 50.0

    if ref.get("doi") and cand.get("doi"):
        a = re.sub(r"^https?://(dx\.)?doi\.org/", "", str(ref["doi"])).lower().strip()
        b = str(cand["doi"]).lower().strip()
        if a != b:
            if t >= 90:
                soft.append(f"DOI difere mas titulo casa ({a} vs {b}) -- confira versao")
            else:
                hard.append(f"DOI divergente ({a} vs {b})")

    if t < 60:
        hard.append(f"titulo muito diferente ({t:.0f}% de similaridade)")

    return W_TITLE * t + W_AUTHORS * a_score + W_YEAR * y_score, hard, soft


def verify(ref: dict, mailto: str | None) -> dict:
    cands: list[dict] = []
    silent: list[str] = []
    for name, fn in (("SemanticScholar", lambda r: q_s2(r)),
                     ("OpenAlex", lambda r: q_openalex(r, mailto)),
                     ("Crossref", lambda r: q_crossref(r, mailto))):
        try:
            got = fn(ref) or []
        except Exception:
            got = []
        # Base que nao responde precisa aparecer no relatorio. Semantic Scholar
        # aplica rate limit agressivo sem chave de API e, calado, tira do ar
        # justamente a melhor cobertura de computacao e biomedicas.
        if not got:
            silent.append(name)
        cands += got
        time.sleep(PAUSE)

    # Avalia todo candidato, depois escolhe. Um candidato LIMPO sempre ganha de um
    # candidato com conflito duro, mesmo que este tenha nota maior: as bases
    # devolvem registros duplicados (reimpressao, indexacao nova com ano errado) que
    # batem o titulo e envenenariam a decisao se so a nota mandasse.
    scored = []
    for c in cands:
        if not c.get("title"):
            continue
        s, hard, soft = score(ref, c)
        scored.append((s, hard, soft, c))

    clean = [x for x in scored if not x[1]]
    pool = clean or scored
    if pool:
        best_score, best_hard, best_soft, best = max(pool, key=lambda x: x[0])
    else:
        best, best_score, best_hard, best_soft = None, -1.0, [], []

    if best is None:
        status = "NAO_VERIFICADA"
        best_score = 0.0
        best_hard = ["nao encontrada em Crossref, OpenAlex nem Semantic Scholar"]
    elif best_hard:
        status = "NAO_VERIFICADA"
    elif best_score >= VERIFIED_AT:
        status = "VERIFICADA"
    elif best_score >= MAYBE_AT:
        status = "POSSIVEL"
    else:
        status = "NAO_VERIFICADA"

    return {
        "key": ref.get("key"),
        "input": {k: ref.get(k) for k in ("title", "authors", "year", "doi")},
        "status": status,
        "score": round(best_score, 1),
        "match": best,
        "conflitos": best_hard,
        "avisos": best_soft,
        "fontes_com_resposta": sorted({c["source"] for c in cands}),
        "fontes_sem_resposta": silent,
    }


# --------------------------------------------------------------------------- main

def main() -> int:
    ap = argparse.ArgumentParser(description="Verifica referencias academicas.")
    ap.add_argument("path", nargs="?", help="arquivo .bib ou .json")
    ap.add_argument("--title")
    ap.add_argument("--authors", help="separados por ';'")
    ap.add_argument("--year", type=int)
    ap.add_argument("--doi")
    ap.add_argument("--mailto", help="e-mail para o polite pool do Crossref/OpenAlex")
    ap.add_argument("--json", action="store_true", help="saida em JSON")
    args = ap.parse_args()

    if args.title:
        refs = [{
            "key": "cli",
            "title": args.title,
            "authors": [a.strip() for a in (args.authors or "").split(";") if a.strip()],
            "year": args.year,
            "doi": args.doi,
        }]
    elif args.path:
        refs = load_refs(args.path)
    else:
        ap.print_help()
        return 2

    if not refs:
        print("Nenhuma referencia encontrada na entrada.", file=sys.stderr)
        return 1

    results = []
    for i, r in enumerate(refs, 1):
        if not args.json:
            print(f"[{i}/{len(refs)}] {r['title'][:70]}...", file=sys.stderr)
        results.append(verify(r, args.mailto))

    if args.json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
        return 0

    counts = {"VERIFICADA": 0, "POSSIVEL": 0, "NAO_VERIFICADA": 0}
    print("\n" + "=" * 78)
    for r in results:
        counts[r["status"]] += 1
        mark = {"VERIFICADA": "OK  ", "POSSIVEL": "?   ", "NAO_VERIFICADA": "XX  "}[r["status"]]
        print(f"\n{mark}[{r['key']}] nota {r['score']}  ({r['status']})")
        print(f"     entrada: {r['input']['title'][:66]}")
        if r["match"]:
            m = r["match"]
            print(f"     achado : {(m['title'] or '')[:66]}")
            print(f"              {', '.join((m['authors'] or [])[:3])}{' et al.' if len(m['authors'] or []) > 3 else ''}"
                  f"  {m.get('year') or '?'}  via {m['source']}")
            if m.get("doi"):
                print(f"              doi:{m['doi']}")
        for c in r["conflitos"]:
            print(f"     CONFLITO: {c}")
        for w in r["avisos"]:
            print(f"     aviso   : {w}")
        if r["fontes_sem_resposta"]:
            print(f"     sem resposta: {', '.join(r['fontes_sem_resposta'])}"
                  f"  (cobertura reduzida nesta referencia)")

    print("\n" + "=" * 78)
    print(f"verificadas {counts['VERIFICADA']} | possiveis {counts['POSSIVEL']} | nao verificadas {counts['NAO_VERIFICADA']}")
    if counts["NAO_VERIFICADA"]:
        print("\nNAO VERIFICADA nao prova que a obra nao existe: erro de digitacao em")
        print("palavra distintiva do titulo produz o mesmo resultado. Confira a mao.")
    if counts["POSSIVEL"]:
        print("POSSIVEL exige decisao humana. Nao aceite automaticamente.")
    return 1 if counts["NAO_VERIFICADA"] else 0


if __name__ == "__main__":
    sys.exit(main())
