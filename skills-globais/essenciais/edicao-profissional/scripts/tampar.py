#!/usr/bin/env python3
"""Tampa um nome, @ ou marca d'água no topo (ou embaixo) de um vídeo com uma faixa bonita, SEM quadrado preto.

A faixa é opaca (nada do nome aparece por baixo), cobre de ponta a ponta e já está lá desde o PRIMEIRO quadro. A cor sai do
próprio vídeo (média da faixa coberta, escurecida em degradê); vem com linha de acento e, se quiser, um título. Só Python padrão
+ FFmpeg. Confere no fim que o vídeo continua andando (mesmo número de quadros do original) e que o áudio ficou.

Uso:
  python tampar.py --video entrada.mp4 --saida saida.mp4 [--posicao topo|baixo] [--altura 0.13] [--titulo "TEXTO"]
     [--cor "#RRGGBB"] [--acento "#RRGGBB"]
--altura: fração da altura do vídeo (0.13 = 13%) ou pixels (ex.: 120). Escolha a menor altura que cobre o nome com folga.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import shutil
import subprocess
import sys


def achar(nome: str) -> str:
    achado = shutil.which(nome)
    if achado:
        return achado
    base = os.environ.get("APPDATA") or os.path.expanduser("~/.config")
    for p in glob.glob(os.path.join(base, "SegundoCerebro", "hermes", "tools", "ffmpeg-*", "bin", nome + (".exe" if os.name == "nt" else ""))):
        return p
    sys.exit(f"não achei o {nome}")


FF, FP = achar("ffmpeg"), achar("ffprobe")


def info(video: str) -> dict:
    j = json.loads(subprocess.run([FP, "-v", "error", "-count_packets", "-show_entries", "stream=codec_type,width,height,nb_read_packets,r_frame_rate",
                                   "-show_entries", "format=duration", "-of", "json", video], capture_output=True, text=True, check=True).stdout)
    v = next(s for s in j["streams"] if s["codec_type"] == "video")
    return {"w": int(v["width"]), "h": int(v["height"]), "quadros": int(v.get("nb_read_packets") or 0),
            "audio": any(s["codec_type"] == "audio" for s in j["streams"]), "dur": float(j["format"].get("duration") or 0)}


def cor_media(video: str, y: int, h: int, w: int, dur: float) -> tuple[int, int, int]:
    t = min(1.0, dur / 2)
    raw = subprocess.run([FF, "-v", "error", "-ss", str(t), "-i", video, "-vf", f"crop={w}:{h}:0:{y},scale=1:1", "-frames:v", "1",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    return (raw[0], raw[1], raw[2]) if len(raw) >= 3 else (40, 40, 60)


def hexa(s: str) -> tuple[int, int, int]:
    s = s.lstrip("#")
    return int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16)


def fonte() -> str:
    for f in ["C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/segoeuib.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"]:
        if os.path.exists(f):
            return f.replace("\\", "/").replace(":", "\\:")
    return ""


def main() -> None:
    a = argparse.ArgumentParser()
    a.add_argument("--video", required=True)
    a.add_argument("--saida", required=True)
    a.add_argument("--posicao", choices=["topo", "baixo"], default="topo")
    a.add_argument("--altura", default="0.13")
    a.add_argument("--titulo", default="")
    a.add_argument("--cor", default="")
    a.add_argument("--acento", default="")
    o = a.parse_args()
    i = info(o.video)
    w, h = i["w"], i["h"]
    alt = float(o.altura)
    fh = int(alt * h) if alt <= 1 else int(alt)
    fh += fh % 2
    y = 0 if o.posicao == "topo" else h - fh
    # a cor vem do vídeo LOGO AO LADO da faixa (não de dentro dela: lá está o nome, com a cor do selo dele)
    amostra_y = fh if o.posicao == "topo" else max(0, y - fh // 2)
    r, g, b = hexa(o.cor) if o.cor else cor_media(o.video, amostra_y, max(2, fh // 2 - fh // 2 % 2), w, i["dur"])
    # cor da faixa: a média do trecho coberto, escurecida para o texto aparecer; acento = a mesma cor bem clara
    k = 0.55
    r, g, b = int(r * k), int(g * k), int(b * k)
    ar, ag, ab = hexa(o.acento) if o.acento else (min(255, r * 2 + 90), min(255, g * 2 + 90), min(255, b * 2 + 90))
    # degradê vertical: mais escuro longe do vídeo, mais claro encostando nele (a faixa "nasce" da imagem)
    lado = "(Y/H)" if o.posicao == "topo" else "(1-Y/H)"
    grad = f"geq=r='r(X,Y)*(0.55+0.45*{lado})':g='g(X,Y)*(0.55+0.45*{lado})':b='b(X,Y)*(0.55+0.45*{lado})'"
    linha_y = f"{fh - 5}" if o.posicao == "topo" else "2"
    partes = [f"color=c=0x{r:02x}{g:02x}{b:02x}:s={w}x{fh}:r=30,format=rgb24,{grad}",
              f"drawbox=x={int(w * 0.08)}:y={linha_y}:w={int(w * 0.84)}:h=3:color=0x{ar:02x}{ag:02x}{ab:02x}:t=fill"]
    if o.titulo:
        tam = max(18, int(fh * 0.38))
        f = fonte()
        txt = o.titulo.replace("\\", "\\\\").replace("'", "\u2019").replace(":", "\\:").replace("%", "\\%")
        ff = ("fontfile='" + f + "':") if f else ""
        partes.append(f"drawtext=text='{txt}':{ff}fontsize={tam}:fontcolor=white:"
                      f"shadowcolor=black@0.55:shadowx=2:shadowy=2:x=(w-tw)/2:y=(h-th)/2-2")
    barra = ",".join(partes)
    fc = f"{barra}[f];[0:v][f]overlay=0:{y}:shortest=1:format=auto,format=yuv420p[v]"
    cmd = [FF, "-y", "-v", "error", "-i", o.video, "-filter_complex", fc, "-map", "[v]", "-map", "0:a?", "-c:v", "libx264", "-crf", "18",
           "-preset", "medium", "-c:a", "copy", "-movflags", "+faststart", o.saida]
    subprocess.run(cmd, check=True)
    s = info(o.saida)
    problemas = []
    if i["quadros"] and s["quadros"] < max(2, int(i["quadros"] * 0.95)):
        problemas.append(f"vídeo congelado ou curto: {s['quadros']} quadros contra {i['quadros']} do original")
    if i["audio"] and not s["audio"]:
        problemas.append("o áudio sumiu")
    print(json.dumps({"saida": os.path.abspath(o.saida), "faixa": {"posicao": o.posicao, "altura_px": fh, "cor": f"#{r:02x}{g:02x}{b:02x}"},
                      "quadros": [i["quadros"], s["quadros"]], "duracao": round(s["dur"], 2), "ok": not problemas, "problemas": problemas}, ensure_ascii=False))
    sys.exit(1 if problemas else 0)


if __name__ == "__main__":
    main()
