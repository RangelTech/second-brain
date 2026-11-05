#!/usr/bin/env python3
"""Regua de 3 pontos: humano de referencia, texto antes da humanize, texto depois.

Por que 3 pontos e nao um score: nenhum limiar absoluto sobreviveu ao teste. Um
RFC humano cheio de lista marcou 79% de IA, e texto passado pela humanize marcou
0,2%, que e MENOS que humano de verdade (7% a 12%). Score isolado nao decide
nada. O que decide e a posicao relativa entre tres textos do mesmo assunto,
medidos no mesmo run, com o mesmo instrumento.

  humano   -> onde fica o chao
  antes    -> onde o texto estava
  depois   -> para onde a humanize levou

Uso:
    python regua.py --antes a.txt --depois b.txt --humano ref.txt
    python regua.py --antes a.txt --depois b.txt --tema "analise de citacoes" --lang pt
    python regua.py --depois b.txt --tema "..." --json

Codigo de saida: 0 aprovado, 1 reescrever, 2 erro.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

# Limiares. Vieram de um corpus de 15 textos, ou seja sao heuristica de
# diagnostico e nao constante universal. Estao aqui em cima justamente para
# poderem ser recalibrados quando o corpus crescer.
P_ALARME = 0.50        # acusacao absoluta do model card
MARGEM_HUMANO = 0.25   # quanto o texto pode passar do humano sem virar problema
BURST_PLANO = 8.0      # dp do tamanho de frase
BURST_CV = 0.60


def rhythm(text: str) -> dict:
    body = "\n".join(l for l in text.splitlines() if not l.strip().startswith(("#", "|", ">")))
    body = re.sub(r"`[^`\n]+`", " ", body)
    lens = [len(s.split()) for s in re.split(r"(?<=[.!?])\s+", body) if len(s.split()) > 1]
    if len(lens) < 5:
        return {"sd": 0.0, "cv": 0.0, "med": 0, "flat": False, "na": True}
    avg = sum(lens) / len(lens)
    sd = math.sqrt(sum((x - avg) ** 2 for x in lens) / len(lens))
    cv = sd / avg if avg else 0.0
    med = sorted(lens)[len(lens) // 2]
    na = med < 8                       # lista, nao prosa: a regra nao se aplica
    return {"sd": sd, "cv": cv, "med": med, "flat": (not na) and sd < BURST_PLANO and cv < BURST_CV, "na": na}


def fetch_human(tema: str, lang: str) -> str | None:
    out = os.path.join(tempfile.gettempdir(), "regua_humano.txt")
    r = subprocess.run([sys.executable, os.path.join(HERE, "human_ref.py"), tema,
                        "--lang", lang, "-o", out], capture_output=True, text=True)
    sys.stderr.write(r.stderr)
    return open(out, encoding="utf-8").read() if r.returncode == 0 and os.path.exists(out) else None


def main() -> int:
    ap = argparse.ArgumentParser(description="Regua de 3 pontos para texto de IA.")
    ap.add_argument("--depois", required=True, help="texto final, depois da humanize")
    ap.add_argument("--antes", help="texto antes da humanize (opcional, mede o ganho)")
    ap.add_argument("--humano", help="arquivo de referencia humana")
    ap.add_argument("--tema", help="assunto, para buscar a referencia na Wikipedia pre-2021")
    ap.add_argument("--lang", default="pt", choices=["pt", "en"])
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    def rd(p):
        return open(p, encoding="utf-8-sig", errors="replace").read().strip()

    depois = rd(args.depois)
    antes = rd(args.antes) if args.antes else None
    humano = rd(args.humano) if args.humano else (fetch_human(args.tema, args.lang) if args.tema else None)

    from detect_ai import looks_english, score
    ingles = looks_english(depois)

    pontos = {}
    if humano:
        pontos["humano"] = score(humano)
    if antes:
        pontos["antes"] = score(antes)
    pontos["depois"] = score(depois)

    r_dep = rhythm(depois)
    r_hum = rhythm(humano) if humano else None

    # --- decisao ---
    motivos, avisos = [], []
    p_dep = pontos["depois"]
    p_hum = pontos.get("humano")

    # O detector so entra na decisao se ele provar que funciona NESTE run, e a
    # prova e acertar o controle humano. Medido no ZeroGPT em 2026-09-14: uma
    # revisao de Wikipedia de maio de 2021 (mais de um ano antes do ChatGPT)
    # levou 73% em ingles e 100% em portugues. Em portugues a ordem inverteu por
    # completo, com o humano acusado MAIS que os dois textos de maquina. Um
    # detector nesse estado reprovaria texto bom indefinidamente, e o laco
    # reescreveria ate destruir a escrita.
    detector_vale = ingles
    if not ingles:
        avisos.append("texto nao parece ingles: o detector NAO tem validade aqui. "
                      "A decisao usa so o ritmo (agnostico de lingua).")
    if p_hum is not None and p_hum >= P_ALARME:
        detector_vale = False
        avisos.append(
            f"DETECTOR DESCARTADO NESTE RUN: a referencia HUMANA marcou {p_hum*100:.1f}%. "
            "Texto humano comprovadamente anterior aos LLMs sendo acusado significa que o "
            "instrumento esta errando neste assunto ou nesta lingua, e nao que o seu texto "
            "e ruim. A decisao cai para o ritmo.")
    if p_hum is not None and p_dep < p_hum and p_hum >= P_ALARME:
        avisos.append(f"para registro: o texto final ({p_dep*100:.1f}%) marcou MENOS que o "
                      f"humano de referencia ({p_hum*100:.1f}%), o que confirma a inversao.")

    if detector_vale:
        if p_dep >= P_ALARME:
            motivos.append(f"detector acusa o texto final ({p_dep*100:.1f}%)")
        if p_hum is not None and p_dep > p_hum + MARGEM_HUMANO:
            motivos.append(f"texto final ({p_dep*100:.1f}%) bem acima da referencia humana ({p_hum*100:.1f}%)")

    if r_dep["flat"]:
        motivos.append(f"ritmo plano (dp {r_dep['sd']:.1f}, cv {r_dep['cv']:.2f}) -- padrao 37 da humanize")

    aprovado = not motivos

    if args.json:
        print(json.dumps({"pontos": {k: round(v, 4) for k, v in pontos.items()},
                          "ritmo_depois": r_dep, "ingles": ingles,
                          "aprovado": aprovado, "motivos": motivos, "avisos": avisos},
                         ensure_ascii=False, indent=2))
        return 0 if aprovado else 1

    print("\n" + "=" * 66)
    print("REGUA DE 3 PONTOS")
    print("=" * 66)
    ordem = [("humano", "humano de referencia"), ("antes", "antes da humanize"), ("depois", "DEPOIS da humanize")]
    for k, rot in ordem:
        if k in pontos:
            print(f"  {rot:<24} {pontos[k]*100:>6.1f}% de IA")
    if "antes" in pontos:
        d = pontos["depois"] - pontos["antes"]
        print(f"\n  ganho da humanize: {d*100:+.1f} pontos percentuais")
    print(f"\n  ritmo do final: dp {r_dep['sd']:.1f}  cv {r_dep['cv']:.2f}  "
          f"{'LISTA (regra nao se aplica)' if r_dep['na'] else ('PLANO' if r_dep['flat'] else 'ok')}")
    if r_hum:
        print(f"  ritmo do humano: dp {r_hum['sd']:.1f}  cv {r_hum['cv']:.2f}")

    for a in avisos:
        print(f"\n  [aviso] {a}")

    print("\n" + "-" * 66)
    if aprovado:
        print("  APROVADO")
    else:
        print("  REESCREVER. Motivos:")
        for m in motivos:
            print(f"    - {m}")
        print("\n  Reescreva aplicando os padroes da humanize que couberem, NAO")
        print("  mexendo no texto para baixar o numero. Se depois de 2 passadas")
        print("  continuar reprovado, PARE e relate: insistir estraga o texto.")
    print("-" * 66)
    print("  Lembre: 0,2% nao e atestado de humanidade. Texto pos-humanize marca")
    print("  menos IA que humano real, o que e deslocamento de distribuicao e nao")
    print("  prova. A regua diz posicao relativa, nunca probabilidade de origem.")
    return 0 if aprovado else 1


if __name__ == "__main__":
    sys.exit(main())
