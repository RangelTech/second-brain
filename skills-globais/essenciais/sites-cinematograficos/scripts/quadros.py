"""Vídeo → sequência de quadros para a ROLAGEM QUADRO A QUADRO (estilo Apple: o produto gira/monta conforme a pessoa rola).
Skill sites-cinematograficos, modelo modelos/rolagem-quadros.html.

    python quadros.py --video produto.mp4 --pasta "Sites/MeuSite/quadros" [--inicio 0 --fim 5] [--quadros 120] [--largura 1600]

Gera quadros WEBP numerados (0001.webp ...) e quadros.json ({"total", "largura", "altura", "padrao"}) para o modelo.
Regras: 80 a 150 quadros bastam (rolagem lisa, site leve); vídeo de origem com UM movimento contínuo de câmera ou do produto
(órbita, aproximação, explosão de peças), sem cortes; fundo limpo combina com o site."""
import argparse
import glob
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


def ffmpeg():
    exe = "ffmpeg.exe" if os.name == "nt" else "ffmpeg"
    cands = [shutil.which("ffmpeg")]
    for b in (os.environ.get("APPDATA", ""), str(Path.home() / ".config"), str(Path.home() / "Library" / "Application Support")):
        for nome in ("SegundoCerebro", "Segundo Cérebro", "segundo-cerebro", "Cérebro Pro"):
            cands += sorted(glob.glob(os.path.join(b, nome, "hermes*", "tools", "ffmpeg-*", "bin", exe)), reverse=True)
    c = next((c for c in cands if c and os.path.isfile(c)), None)
    if not c:
        print(json.dumps({"ok": False, "erro": "não achei o ffmpeg (vem com o Cérebro Pro)"}))
        sys.exit(1)
    return c


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--pasta", required=True)
    ap.add_argument("--inicio", type=float, default=0)
    ap.add_argument("--fim", type=float)
    ap.add_argument("--quadros", type=int, default=120)
    ap.add_argument("--largura", type=int, default=1600)
    ap.add_argument("--qualidade", type=int, default=72)
    a = ap.parse_args()
    ff = ffmpeg()
    probe = str(Path(ff).with_name("ffprobe" + Path(ff).suffix))
    dur = float(subprocess.run([probe, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", a.video], capture_output=True, text=True).stdout.strip() or 0)
    fim = min(a.fim or dur, dur)
    trecho = max(0.1, fim - a.inicio)
    fps = a.quadros / trecho
    pasta = Path(a.pasta)
    shutil.rmtree(pasta, ignore_errors=True)
    pasta.mkdir(parents=True)
    subprocess.run([ff, "-y", "-loglevel", "error", "-ss", str(a.inicio), "-t", str(trecho), "-i", a.video,
                    "-vf", f"fps={fps:.4f},scale={a.largura}:-2:flags=lanczos", "-c:v", "libwebp", "-quality", str(a.qualidade),
                    str(pasta / "%04d.webp")], check=True)
    arqs = sorted(pasta.glob("*.webp"))
    w, h = subprocess.run([probe, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", str(arqs[0])],
                          capture_output=True, text=True).stdout.strip().split(",")[:2]
    tam = sum(f.stat().st_size for f in arqs)
    (pasta / "quadros.json").write_text(json.dumps({"total": len(arqs), "largura": int(w), "altura": int(h), "padrao": "%04d.webp"}), encoding="utf-8")
    print(json.dumps({"ok": True, "pasta": str(pasta), "quadros": len(arqs), "tamanho_mb": round(tam / 1e6, 1), "dimensoes": f"{w}x{h}"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
