#!/usr/bin/env python3
"""Auditoria mecanica de estilo para texto academico e profissional (EN + PT-BR).

Sem dependencia externa. Cobre a camada que regex pega; o julgamento de leitor
(definir-antes-de-usar, seguibilidade, coerencia, calibragem) NAO esta aqui.

Uso:
    python style_audit.py texto.md
    python style_audit.py secoes/*.tex
    python style_audit.py tese.md --lang pt
    python style_audit.py artigo.md --json

Cada regra referencia o padrao correspondente da skill `humanize` (§N).
Reporte as CONTAGENS, nao "auditei". Cada acerto e corrigido ou justificado.
"""
from __future__ import annotations

import argparse
import glob
import json
import math
import re
import sys

# (id, descricao, regex, humanize_ref, severidade)
#   bloqueia = corrigir sempre | inspeciona = olhar cada acerto
RULES_ANY = [
    ("A1", "travessao (em/en dash)", r"[—–]|(?<!-)--(?!-)|(?<= )-{3}(?= )", "§8", "bloqueia"),
    ("A2", "exclamacao em prosa tecnica", r"!(?!=)", "-", "inspeciona"),
    ("A3", "aspas curvas", r"[“”‘’]", "§22", "inspeciona"),
    ("A4", "emoji decorativo", r"[\U0001F300-\U0001FAFF✨✅❌❤]", "§20", "bloqueia"),
]

RULES_EN = [
    ("E1", "not X but Y / antitese retorica", r"(?i)\bnot only\b.{0,40}\bbut\b|\bnot\b[^.]{0,30}\bbut rather\b|\brather than\b|\bless\b.{0,25}\bthan\b|\bis the point\b|\bmore than just\b", "§1", "inspeciona"),
    ("E2", "abre-boca no inicio de frase", r"(?m)(?:^|(?<=[.!?]\s))(Moreover|Furthermore|Additionally|Notably|Importantly|Indeed|Ultimately|Crucially|In turn|That said|It is worth noting|It should be noted)\b", "§30", "bloqueia"),
    ("E3", "adjetivo banido em paper", r"(?i)\b(novel|significant|substantial|impressive|promising|comprehensive|robust|powerful|state-of-the-art|paradigm|leverag\w*|utiliz\w*|crucial|seamless\w*)\b", "§12/§13", "bloqueia"),
    ("E4", "intensificador vazio", r"(?i)\b(in effect|in a sense|at (its|the) (heart|core)|in essence|truly|genuinely|essentially|fundamentally|indeed|in fact|actually|precisely because|armed with)\b", "§3", "bloqueia"),
    ("E5", "abertura sem conteudo", r"(?i)In this (paper|section|article|chapter), we\b", "§4", "bloqueia"),
    ("E6", "voz passiva", r"(?i)\b(is|are|was|were|be|been|being)\s+([a-z]+ed|done|made|shown|given|taken|held|built|drawn|chosen|written|known|found|seen|set|put|sent|kept|met|used|based|performed|conducted|observed)\b", "§11", "inspeciona"),
    ("E7", "prolixidade", r"(?i)\b(the fact that|the question (as to )?whether|in order to|owing to the fact that|the reason .{0,20} is because|in a [a-z]+ manner|in terms of|one of the most)\b", "§3", "bloqueia"),
    ("E8", "qualificador fraco", r"(?i)\b(very|rather|quite|somewhat|fairly|pretty much|certainly)\b", "§9", "inspeciona"),
    ("E9", "ordinal falso / adverbio cunhado", r"(?i)\b(firstly|secondly|thirdly|thusly|muchly|overly)\b", "-", "bloqueia"),
    ("E10", "verbo de mecanismo vago", r"(?i)\b(unlocks?|powers|promises to|stands? to|is poised to|opens the door to|has the potential to|delv\w+ into|grappl\w+ with|harness\w*)\b", "§15", "bloqueia"),
    ("E11", "autoridade emprestada sem nome", r"(?i)\b(experts? (argue|believe|say)|studies show|research (shows|indicates)|it is (well )?known that|some critics)\b", "§17", "bloqueia"),
    ("E12", "residuo de chat", r"(?i)\b(I hope this helps|Great question|Certainly!|Of course!|let me know if|as an AI|as of my last)\b", "§23", "bloqueia"),
]

RULES_PT = [
    ("P1", "nao apenas X, mas Y", r"(?i)n[aã]o (apenas|s[oó]|somente|meramente)\b[^.]{0,60}\bmas\b|n[aã]o se trata de\b[^.]{0,50}\be sim\b", "§1", "inspeciona"),
    ("P2", "conectivo automatico de paragrafo", r"(?im)^\s*(Al[eé]m disso|Por outro lado|Nesse contexto|Dessa forma|Sendo assim|Diante disso|Em suma|Em conclus[aã]o|Por fim|Vale destacar|Ademais)\b", "§30", "bloqueia"),
    ("P3", "moldura de realce", r"(?i)\b([Ée] importante (ressaltar|destacar|mencionar|notar)|Cabe (destacar|ressaltar)|Conv[eé]m salientar|Vale (a pena )?(mencionar|ressaltar|destacar)|Ressalta-se que|[Ée] fundamental compreender)\b", "§31", "bloqueia"),
    ("P4", "palavra de IA em portugues", r"(?i)\b(crucial|robust[oa]s?|abrangentes?|aprofundad[oa]s?|mergulhar|panorama|cen[aá]rio atual|jornada|desafiador[ae]?s?|impactar|potencializar|viabilizar|primordial|imprescind[ií]vel|inovador[ae]?s?|significativ[oa]s?)\b", "§26/§12", "bloqueia"),
    ("P5", "jargao corporativo", r"(?i)\b(sinergia|alavanca(r|gem)|disruptiv[oa]|ecossistema de solu|otimizar a jornada|empoderar|entregar valor|gerar valor|fora da caixa|mindset)\b", "§27", "bloqueia"),
    ("P6", "nominalizacao", r"(?i)\b(faz(er|endo)|realiza(r|ndo)|efetua(r|ndo)|proceder [aà]|promove(r|ndo)|executa(r|ndo))\s+(a|o|uma?|as|os)?\s*(an[aá]lise|avalia[cç][aã]o|acompanhamento|elabora[cç][aã]o|valida[cç][aã]o|integra[cç][aã]o|verifica[cç][aã]o)\b", "§29", "bloqueia"),
    ("P7", "adverbio inflacionado", r"(?i)\b(definitivamente|absolutamente|indubitavelmente|inegavelmente|inequivocamente|irrefutavelmente|comprovadamente)\b", "§32", "bloqueia"),
    ("P8", "passiva sem agente", r"(?i)\b(foi|foram|[eé]|s[aã]o|ser[aá]|ser[aã]o)\s+(decidid|realizad|efetuad|observad|constatad|verificad|analisad|elaborad|utilizad|aplicad)[oa]s?\b", "§11", "inspeciona"),
    ("P9", "autoridade emprestada sem nome", r"(?i)\b(estudos (mostram|indicam|apontam)|pesquisas (mostram|indicam)|especialistas (afirmam|apontam)|[eé] sabido que|dados apontam)\b", "§17", "bloqueia"),
    ("P10", "residuo de chat", r"(?i)\b([OÓ]tima pergunta|Espero ter ajudado|Fico [aà] disposi[cç][aã]o|Qualquer d[uú]vida|Claro, com prazer|Segue abaixo|Certamente!)\b", "§23", "bloqueia"),
    ("P11", "anglicismo evitavel", r"(?i)\b(stakeholders?|insights?|deadlines?|budget|gaps?|deliverables?)\b", "§28", "inspeciona"),
    ("P12", "abertura sem conteudo", r"(?i)\bNest[ea] (artigo|se[cç][aã]o|cap[ií]tulo|trabalho),? (n[oó]s )?(apresentamos|descrevemos|discutimos|abordamos)\b", "§4", "bloqueia"),
]

# deriva de contagem: "tres contribuicoes" etc.
COUNT_RE = re.compile(
    r"(?i)\b(two|three|four|five|six|seven|dois|duas|tr[eê]s|quatro|cinco|seis|sete)\s+"
    r"(contributions?|stages?|steps?|requirements?|dimensions?|axes|phases?|"
    r"contribui[cç][oõ]es|etapas?|fases?|requisitos?|dimens[oõ]es|eixos?|objetivos?)\b"
)

CODE_BLOCK = re.compile(r"```.*?```|~~~.*?~~~|\\begin\{(lstlisting|verbatim|minted)\}.*?\\end\{\1\}", re.S)
INLINE_CODE = re.compile(r"`[^`\n]+`|\$[^$\n]+\$")
COMMENT_TEX = re.compile(r"(?m)^\s*%.*$")


def strip_code(text: str) -> str:
    """Neutraliza codigo preservando offsets, para nao contar acerto dentro de bloco."""
    def blank(m: re.Match) -> str:
        return re.sub(r"\S", " ", m.group(0))
    for pat in (CODE_BLOCK, INLINE_CODE, COMMENT_TEX):
        text = pat.sub(blank, text)
    return text


def line_of(text: str, pos: int) -> int:
    return text.count("\n", 0, pos) + 1


# Linha de base medida no corpus de teste da skill: prosa tecnica humana (RFCs
# 1996-2004) fica em dp 10,6; prosa enciclopedica humana em 18,1; saida de modelo
# depois de edicao cuidadosa em 7,6; saida padrao em 7,2. Abaixo de 8 e plano.
BURST_FLAT, BURST_CV, BURST_HUMAN = 8.0, 0.60, 10.6


def rhythm(text: str) -> dict:
    """§37: variacao do tamanho de frase. Nao e para otimizar, e para ir olhar."""
    body = "\n".join(l for l in text.splitlines() if not l.strip().startswith(("#", "|", ">")))
    body = INLINE_CODE.sub(" ", body)
    sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+", body) if s.strip()]
    lens = [len(s.split()) for s in sents if len(s.split()) > 1]
    if len(lens) < 5:
        return {"n": len(lens), "sd": 0.0, "avg": 0.0, "cv": 0.0, "med": 0,
                "short": 0, "long": 0, "flat": False, "na": True}
    avg = sum(lens) / len(lens)
    sd = math.sqrt(sum((x - avg) ** 2 for x in lens) / len(lens))
    cv = sd / avg if avg else 0.0
    srt = sorted(lens)
    med = srt[len(srt) // 2]

    # Guarda contra falso positivo medido: um trecho de lista (itens curtos numa
    # enumeracao) tem media baixa, e como o dp escala com a media ele sempre
    # parece plano. Aconteceu com um RFC humano: media 5,6 e dp 7,1, marcado
    # plano sem ser. Mediana abaixo de 8 quer dizer que aquilo nao e prosa
    # corrida, e a regra de ritmo simplesmente nao se aplica.
    na = med < 8

    # Dois criterios juntos, porque nenhum sozinho separou o corpus de teste: o
    # dp pega o texto nivelado e o CV pega o texto cuja variacao e pequena em
    # relacao ao proprio tamanho de frase. Limiares ajustados nesse corpus de 15
    # textos, ou seja, sao heuristica de diagnostico e nao classificador.
    flat = (not na) and sd < BURST_FLAT and cv < BURST_CV
    return {
        "n": len(lens), "sd": sd, "avg": avg, "cv": cv, "med": med,
        "short": sum(1 for x in lens if x <= 8),
        "long": sum(1 for x in lens if x >= 30),
        "flat": flat, "na": na,
    }


def audit(path: str, lang: str) -> dict:
    # utf-8-sig: arquivo gerado no Windows vem com BOM, que envenena a ancora ^ das
    # regras ancoradas em inicio de linha (E2, P2, P12).
    raw = open(path, encoding="utf-8-sig", errors="replace").read()
    text = strip_code(raw)
    lines = raw.splitlines()

    rules = list(RULES_ANY)
    if lang in ("en", "auto", "both"):
        rules += RULES_EN
    if lang in ("pt", "auto", "both"):
        rules += RULES_PT

    findings = []
    for rid, desc, pat, ref, sev in rules:
        for m in re.finditer(pat, text):
            ln = line_of(text, m.start())
            findings.append({
                "rule": rid, "desc": desc, "humanize": ref, "sev": sev,
                "line": ln, "match": m.group(0).strip()[:60],
                "context": (lines[ln - 1].strip()[:100] if ln - 1 < len(lines) else ""),
            })

    counts: dict[str, int] = {}
    for f in findings:
        counts[f["rule"]] = counts.get(f["rule"], 0) + 1

    return {
        "file": path,
        "words": len(re.findall(r"\b\w+\b", text)),
        "counts": counts,
        "findings": findings,
        "counts_declared": sorted({m.group(0).lower() for m in COUNT_RE.finditer(text)}),
        "rhythm": rhythm(raw),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Auditoria mecanica de estilo.")
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--lang", choices=["en", "pt", "auto"], default="auto")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--show", type=int, default=4, help="acertos exibidos por regra")
    args = ap.parse_args()

    files: list[str] = []
    for p in args.paths:
        files += glob.glob(p) or [p]

    reports = []
    for f in files:
        try:
            reports.append(audit(f, args.lang))
        except OSError as e:
            print(f"erro ao ler {f}: {e}", file=sys.stderr)

    if args.json:
        print(json.dumps(reports, ensure_ascii=False, indent=2))
        return 0

    total_block = total_insp = total_flat = 0
    for rep in reports:
        print("=" * 78)
        print(f"{rep['file']}  ({rep['words']} palavras)")
        print("=" * 78)
        if not rep["findings"]:
            print("  nenhum acerto mecanico.")
        by_rule: dict[str, list] = {}
        for f in rep["findings"]:
            by_rule.setdefault(f["rule"], []).append(f)
        for rid in sorted(by_rule):
            group = by_rule[rid]
            f0 = group[0]
            flag = "BLOQUEIA" if f0["sev"] == "bloqueia" else "inspecionar"
            if f0["sev"] == "bloqueia":
                total_block += len(group)
            else:
                total_insp += len(group)
            print(f"\n  [{rid}] {f0['desc']}  ({f0['humanize']})  {len(group)}x  {flag}")
            for f in group[: args.show]:
                print(f"      L{f['line']:>4}: {f['match']}")
                if f["context"] and f["context"] != f["match"]:
                    print(f"             > {f['context']}")
            if len(group) > args.show:
                print(f"      ... mais {len(group) - args.show}")
        if rep["counts_declared"]:
            print(f"\n  [C1] contagens declaradas (confira §36 contra a lista real):")
            for c in rep["counts_declared"]:
                print(f"      {c}")

        r = rep["rhythm"]
        if r["n"] >= 5:
            flag = "nao se aplica" if r["na"] else ("PLANO" if r["flat"] else "ok")
            total_flat += 1 if r["flat"] else 0
            print(f"\n  [R1] ritmo de frase (§37)  dp={r['sd']:.1f}  cv={r['cv']:.2f}  {flag}")
            print(f"      media {r['avg']:.1f} / mediana {r['med']} palavras em {r['n']} frases; "
                  f"{r['short']} curtas (<=8), {r['long']} longas (>=30)")
            if r["na"]:
                print("      texto em lista ou estrutura, nao prosa corrida (mediana < 8).")
            else:
                print(f"      referencia: humano tecnico dp {BURST_HUMAN}, modelo padrao ~7.2;"
                      f" plano = dp<{BURST_FLAT} E cv<{BURST_CV}")
            if r["flat"]:
                print("      -> va olhar o paragrafo. NAO encha frase para subir o numero:")
                print("         deixe a frase curta ser curta e a longa ficar inteira.")
            if r["short"] == 0 and not r["na"]:
                print("      -> nenhuma frase curta. Quase sempre e pensamento curto acolchoado.")
        print()

    print("=" * 78)
    print(f"TOTAL: {total_block} para corrigir | {total_insp} para inspecionar"
          f" | {total_flat} com ritmo plano")
    print("Cada acerto e corrigido ou justificado explicitamente. Reporte as contagens.")
    print("O que regex nao pega (definir-antes-de-usar, seguibilidade, coerencia de")
    print("alegacao, calibragem) fica para a revisao adversarial.")
    return 1 if total_block else 0


if __name__ == "__main__":
    sys.exit(main())
