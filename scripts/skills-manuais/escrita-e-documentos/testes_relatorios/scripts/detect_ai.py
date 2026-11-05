#!/usr/bin/env python3
"""Detector de texto gerado por IA: desklib/ai-text-detector-v1.01, local.

Lider do RAID benchmark (raid-bench.xyz), DeBERTa-v3-large 0,4B, licenca MIT.
Roda em CPU e o texto NAO sai da maquina, que e o motivo de preferir isto a
qualquer API: relatorio interno nao deve ir para servidor de terceiro.

SO INGLES. Para portugues o modelo nao tem validade; use o sinal de ritmo do
style_audit.py da skill `academico`, que e agnostico de lingua.

Uso:
    python detect_ai.py texto.txt [outro.txt ...]
    python detect_ai.py --stdin  < texto.txt
    python detect_ai.py texto.txt --json

Primeira execucao baixa ~1,7 GB do HuggingFace. Depois fica em cache.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import sys
import warnings

warnings.filterwarnings("ignore")
try:
    import truststore   # proxy corporativo com inspecao TLS: usa o store do Windows
    truststore.inject_into_ssl()
except ImportError:
    pass
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")

MODEL = "desklib/ai-text-detector-v1.01"
MAXLEN = 768
_cached = {}


def _build():
    """O codigo do model card e para transformers 4.x e quebra na 5.x dentro de
    from_pretrained (all_tied_weights_keys). Monto um nn.Module puro e carrego o
    safetensors na mao, o que independe da versao."""
    import torch.nn as nn
    from huggingface_hub import hf_hub_download
    from safetensors.torch import load_file
    from transformers import AutoConfig, AutoModel, AutoTokenizer
    import torch

    class Detector(nn.Module):
        def __init__(self, config):
            super().__init__()
            self.model = AutoModel.from_config(config)
            self.classifier = nn.Linear(config.hidden_size, 1)

        def forward(self, input_ids, attention_mask):
            h = self.model(input_ids, attention_mask=attention_mask)[0]
            m = attention_mask.unsqueeze(-1).expand(h.size()).float()
            pooled = (h * m).sum(1) / m.sum(1).clamp(min=1e-9)
            return self.classifier(pooled)

    tok = AutoTokenizer.from_pretrained(MODEL)
    cfg = AutoConfig.from_pretrained(MODEL)
    mdl = Detector(cfg)
    missing, _ = mdl.load_state_dict(load_file(hf_hub_download(MODEL, "model.safetensors")), strict=False)
    if missing:
        print(f"[aviso] pesos ausentes: {list(missing)[:4]}", file=sys.stderr)
    mdl.eval()
    torch.set_num_threads(max(1, (os.cpu_count() or 4) - 2))
    return tok, mdl, torch


def score(text: str) -> float:
    """P(gerado por maquina), 0 a 1. Trunca em 768 tokens."""
    if "m" not in _cached:
        _cached["t"], _cached["m"], _cached["torch"] = _build()
    tok, mdl, torch = _cached["t"], _cached["m"], _cached["torch"]
    enc = tok(text, padding="max_length", truncation=True, max_length=MAXLEN, return_tensors="pt")
    with torch.no_grad():
        logit = mdl(enc["input_ids"], enc["attention_mask"])
    return float(torch.sigmoid(logit).item())


def looks_english(text: str) -> bool:
    """Heuristica barata para avisar quando o modelo nao vale."""
    pt = sum(text.lower().count(w) for w in
             (" de ", " que ", " nao ", " não ", " uma ", " para ", " com ", " dos ", " ção", " ões"))
    en = sum(text.lower().count(w) for w in
             (" the ", " and ", " that ", " with ", " from ", " this ", " which ", " tion "))
    return en >= pt


def main() -> int:
    ap = argparse.ArgumentParser(description="Detector de texto de IA (desklib, local).")
    ap.add_argument("paths", nargs="*")
    ap.add_argument("--stdin", action="store_true")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    items: list[tuple[str, str]] = []
    if args.stdin:
        items.append(("stdin", sys.stdin.read()))
    for p in args.paths:
        for f in (glob.glob(p) or [p]):
            items.append((f, open(f, encoding="utf-8-sig", errors="replace").read()))
    if not items:
        ap.print_help()
        return 2

    out = []
    for name, text in items:
        text = text.strip()
        if len(text.split()) < 60:
            out.append({"file": name, "error": "curto demais (<60 palavras)"})
            continue
        p = score(text)
        out.append({
            "file": name, "p_ia": round(p, 4),
            "veredito": "IA" if p >= 0.5 else "humano",
            "ingles": looks_english(text),
            "palavras": len(text.split()),
        })

    if args.json:
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 0

    print(f"{'arquivo':<34}{'P(IA)':>9}   veredito")
    print("-" * 62)
    for r in out:
        if "error" in r:
            print(f"{os.path.basename(r['file']):<34}      ---   {r['error']}")
            continue
        warn = "" if r["ingles"] else "   <- NAO parece ingles: resultado sem validade"
        print(f"{os.path.basename(r['file']):<34}{r['p_ia']*100:>8.1f}%   {r['veredito']}{warn}")
    print("\nLimiar 0.5 e do model card, NAO e calibrado para o seu material.")
    print("Use como posicao relativa numa regua de 3 pontos (ver regua.py),")
    print("nunca como veredito absoluto: texto humano cheio de lista ja marcou 79%.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
