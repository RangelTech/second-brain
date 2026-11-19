"""Monta a página HTML de um desenho animado (kit + shots.js + legenda) pronta para o motion_animar/motion_previa do Cérebro Pro
(ou qualquer renderizador que chame window.sbFrame(t)). Tudo embutido num arquivo só (fonte em base64), sem dependências.

Uso:
  python montar_pagina.py shots.js saida.html [--palavras palavras.json] [--img img1=foto.jpg ...] [--sem-legenda] [--validar]
  palavras.json = [{"w": "Toda", "s": 0.0, "e": 0.32}, ...]  (tempo de cada palavra da narração, em segundos)
Imprime a duração do filme (use em motion_animar duracao=...).
"""
from __future__ import annotations

import argparse
import base64
import json
import shutil
import subprocess
import sys
from pathlib import Path

KIT = Path(__file__).resolve().parent.parent / "kit"
ORDEM = ["lib.js", "chars.js", "env.js", "cenarios.js", "props.js", "alto.js"]


def codigo_filme(shots_js: str) -> str:
    partes = [(KIT / f).read_text(encoding="utf-8") for f in ORDEM]
    return "\n;\n".join(partes + [shots_js, (KIT / "main.js").read_text(encoding="utf-8")])


def validar(shots_js: str, tmp: Path) -> dict:
    if not shutil.which("node"):
        return {"ok": True, "aviso": "sem node: validação pulada"}
    arq = tmp / "_filme_validar.js"
    arq.write_text(codigo_filme(shots_js), encoding="utf-8")
    r = subprocess.run(["node", str(KIT / "valida.js"), str(arq)], capture_output=True, text=True)
    arq.unlink(missing_ok=True)
    try:
        return json.loads(r.stdout.strip().splitlines()[-1])
    except Exception:  # noqa: BLE001
        return {"ok": False, "erros": [r.stderr[-400:]]}


def pagina(shots_js: str, palavras: list[dict], imagens: dict[str, str], legenda: bool) -> str:
    fonte = base64.b64encode((KIT / "fonts" / "Poppins-Bold.ttf").read_bytes()).decode()
    imgs = {}
    for k, caminho in imagens.items():
        p = Path(caminho)
        tipo = "png" if p.suffix.lower() == ".png" else "jpeg"
        imgs[k] = f"data:image/{tipo};base64," + base64.b64encode(p.read_bytes()).decode()
    return f"""<!doctype html><html><head><meta charset="utf-8">
<style>@font-face{{font-family:Poppins;font-weight:700;src:url(data:font/ttf;base64,{fonte})}}
html,body{{margin:0;background:#000;overflow:hidden}}canvas{{width:100vw;height:100vh;display:block}}</style></head>
<body><canvas id="c" width="1080" height="1920"></canvas><script>
const WORDS = {json.dumps(palavras, ensure_ascii=False)}; const OPCOES = {{legenda: {str(legenda).lower()}}}; const IMG = {{}};
for (const [k, u] of Object.entries({json.dumps(imgs)})) {{ const im = new Image(); im.src = u; IMG[k] = im; }}
{codigo_filme(shots_js)}
const cv = document.getElementById('c'); cv.width = window.innerWidth || 1080; cv.height = window.innerHeight || 1920;
window.FILME = montar(cv);
window.sbFrame = (t) => window.FILME.renderFrame(Math.round(t * 30));
document.fonts.load('700 40px Poppins').then(() => window.sbFrame(0));
</script></body></html>"""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("shots"); ap.add_argument("saida")
    ap.add_argument("--palavras"); ap.add_argument("--img", action="append", default=[])
    ap.add_argument("--sem-legenda", action="store_true"); ap.add_argument("--validar", action="store_true")
    a = ap.parse_args()
    shots = Path(a.shots).read_text(encoding="utf-8")
    saida = Path(a.saida)
    if a.validar:
        v = validar(shots, saida.parent)
        if not v.get("ok"):
            print(json.dumps(v, ensure_ascii=False)); sys.exit(1)
    pal = json.loads(Path(a.palavras).read_text(encoding="utf-8")) if a.palavras else []
    imgs = dict(x.split("=", 1) for x in a.img)
    saida.write_text(pagina(shots, pal, imgs, not a.sem_legenda), encoding="utf-8")
    import re
    ends = [float(x) for x in re.findall(r"end\s*:\s*([\d.]+)", shots)]
    print(json.dumps({"ok": True, "pagina": str(saida), "duracao": max(ends) if ends else None}, ensure_ascii=False))


if __name__ == "__main__":
    main()
