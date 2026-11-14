"""MACRO de exemplo no padrão da skill: lança uma nota no "Mini ERP" de teste pela tela e confere no banco (o CSV que o programa grava).
Troque a parte de "abrir" e os nomes dos campos pelos do sistema real do cliente.

    python lancar_nota_exemplo.py --cliente "Ana Souza" --valor 89.90 --banco "C:\...\lancamentos.csv"
"""
import argparse
import json
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from janela import abrir, clicar, fechar, ler, preencher  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--cliente", required=True)
ap.add_argument("--valor", required=True)
ap.add_argument("--banco", required=True)
a = ap.parse_args()
t0 = time.time()
w = None
try:
    erp = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mini_erp_teste.ps1")
    w = abrir("powershell", r"Mini ERP.*", argumentos=["-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", erp, "-Banco", a.banco])
    antes = open(a.banco, encoding="utf-8-sig").read() if os.path.exists(a.banco) else ""
    preencher(w, "Cliente", a.cliente)
    preencher(w, "Valor", a.valor)
    clicar(w, "Lançar")
    status = ler(w, "Status")
    depois = open(a.banco, encoding="utf-8-sig").read() if os.path.exists(a.banco) else ""
    nova = [linha for linha in depois.splitlines() if linha not in antes.splitlines() and a.cliente in linha]
    ok = bool(nova) and "lançada" in status.lower()
    print(json.dumps({"ok": ok, "status_na_tela": status, "linha_no_banco": nova[0] if nova else None, "segundos": round(time.time() - t0, 1)}, ensure_ascii=False))
    sys.exit(0 if ok else 1)
except Exception as e:  # noqa: BLE001
    print(json.dumps({"ok": False, "erro": str(e), "segundos": round(time.time() - t0, 1)}, ensure_ascii=False))
    sys.exit(1)
finally:
    if w is not None:  # SEMPRE fecha o que abriu
        fechar(w)
