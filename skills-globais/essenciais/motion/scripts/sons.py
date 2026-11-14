"""Efeitos sonoros e trilha para vídeo, GERADOS no computador do usuário (FFmpeg do app): sem baixar nada, sem direito autoral.
Skill motion (usado também por edicao-profissional, cortes-de-video e reel-narrado).

    python sons.py lista                                  -> efeitos disponíveis (gera e guarda em ~/.segundo-cerebro/sons)
    python sons.py trilha --estilo calma|energia|suspense --duracao 60 --saida trilha.wav
    python sons.py mixar --audio fala.wav --sons sons.json [--musica trilha.wav --volume-musica 0.14] --saida final.wav
        sons.json = [{"t": 3.2, "som": "whoosh", "vol": 0.8}, ...]   (t em segundos do vídeo final)
        A música abaixa sozinha quando há fala (ducking) e sobe nas pausas.

Quando usar cada efeito (regra de bom gosto: pouco e no lugar certo; nada em cima de palavra importante):
  whoosh  entrada de título, troca de cena, imagem entrando
  pop     palavra-chave/destaque aparecendo, item de lista
  click   item de lista, número trocando
  ding    acerto, número final, "isso!"
  riser   antes de uma revelação (1,5 s antes)
  boom    revelação/impacto (logo depois do riser)
  tchan   momento dramático/surpresa (comédia)
  boing   zoeira: tropeço, piada, cara de espanto
  buzina  zoeira: "errou!", vergonha alheia
  apito   zoeira: algo subindo, ideia "genial" irônica
  erro    resposta errada, "não faça isso"
"""
import argparse
import glob
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

PASTA = Path(os.environ.get("SB_SONS_DIR") or Path.home() / ".segundo-cerebro" / "sons")
SR = 48000
# expressões do aevalsrc (t em segundos); todas terminam em silêncio e ficam abaixo de 0 dBFS
EFEITOS = {
    "whoosh": ("anoisesrc=d=0.7:c=pink:r=48000:a=0.9,highpass=f=500,lowpass=f=6000,afade=t=in:d=0.32:curve=qsin,afade=t=out:st=0.32:d=0.38:curve=qsin,volume=4", 0.7),
    "pop": ("aevalsrc='0.8*sin(2*PI*t*(1100-5200*t))*exp(-28*t)':d=0.14:s=48000", 0.14),
    "click": ("aevalsrc='0.7*(random(0)*2-1)*exp(-260*t)+0.4*sin(2*PI*2200*t)*exp(-120*t)':d=0.05:s=48000", 0.05),
    "ding": ("aevalsrc='0.45*sin(2*PI*1318*t)*exp(-3.5*t)+0.25*sin(2*PI*2637*t)*exp(-5*t)+0.12*sin(2*PI*3956*t)*exp(-7*t)':d=1.4:s=48000", 1.4),
    "riser": ("aevalsrc='0.35*sin(2*PI*t*(180+500*t*t))*(t/1.6)+0.15*(random(0)*2-1)*(t/1.6)^2':d=1.6:s=48000,highpass=f=120", 1.6),
    "boom": ("aevalsrc='0.9*sin(2*PI*t*(70-30*t))*exp(-3.2*t)+0.35*(random(0)*2-1)*exp(-9*t)':d=1.3:s=48000,lowpass=f=900", 1.3),
    "tchan": ("aevalsrc='0.22*(sin(2*PI*196*t)+sin(2*PI*233*t)+sin(2*PI*277*t)+0.5*sin(2*PI*392*t))*exp(-2.2*t)*(1-exp(-60*t))':d=1.6:s=48000", 1.6),
    "boing": ("aevalsrc='0.6*sin(2*PI*t*(230+160*sin(2*PI*11*t)*exp(-3*t)))*exp(-2.6*t)':d=0.9:s=48000", 0.9),
    "buzina": ("aevalsrc='0.35*(sgn(sin(2*PI*392*t))+sgn(sin(2*PI*494*t)))*0.5*(1-exp(-40*t))*lt(t,0.32)+0.35*(sgn(sin(2*PI*330*t))+sgn(sin(2*PI*415*t)))*0.5*gte(t,0.36)*lt(t,0.75)':d=0.8:s=48000,lowpass=f=2500", 0.8),
    "apito": ("aevalsrc='0.4*sin(2*PI*(600*t+900*t*t))*(1-exp(-30*t))*exp(-0.6*t)':d=0.9:s=48000", 0.9),
    "erro": ("aevalsrc='0.3*sgn(sin(2*PI*140*t))*lt(t,0.25)+0.3*sgn(sin(2*PI*110*t))*gte(t,0.28)*lt(t,0.7)':d=0.75:s=48000,lowpass=f=1800", 0.75),
}


def sair(erro):
    print(json.dumps({"ok": False, "erro": erro}, ensure_ascii=False))
    sys.exit(1)


def ffmpeg():
    exe = "ffmpeg.exe" if os.name == "nt" else "ffmpeg"
    cands = [shutil.which("ffmpeg")]
    for b in (os.environ.get("APPDATA", ""), str(Path.home() / ".config"), str(Path.home() / "Library" / "Application Support")):
        for nome in ("SegundoCerebro", "Segundo Cérebro", "segundo-cerebro"):
            cands += sorted(glob.glob(os.path.join(b, nome, "hermes*", "tools", "ffmpeg-*", "bin", exe)), reverse=True)
    c = next((c for c in cands if c and os.path.isfile(c)), None)
    if not c:
        sair("não achei o ffmpeg (vem com o Segundo Cérebro)")
    return c


def efeito(nome):
    if nome not in EFEITOS:
        sair(f"efeito desconhecido: {nome} (use: {', '.join(EFEITOS)})")
    PASTA.mkdir(parents=True, exist_ok=True)
    arq = PASTA / f"{nome}.wav"
    if not arq.exists():
        expr, _ = EFEITOS[nome]
        subprocess.run([ffmpeg(), "-y", "-loglevel", "error", "-f", "lavfi", "-i", expr, "-ac", "2", "-ar", str(SR), "-af", "alimiter=limit=0.9", str(arq)], check=True)
    return arq


def trilha(estilo, duracao, saida):
    """Trilha simples e discreta para ficar BAIXO por baixo da fala. calma: acordes suaves; energia: acordes + batida; suspense: grave pulsando."""
    d = float(duracao)
    acordes = {  # progressões em Hz (4 acordes, 2 compassos cada)
        "calma": [(261.6, 329.6, 392.0), (220.0, 261.6, 329.6), (174.6, 220.0, 261.6), (196.0, 246.9, 293.7)],
        "energia": [(220.0, 277.2, 329.6), (185.0, 233.1, 277.2), (146.8, 185.0, 220.0), (164.8, 207.7, 246.9)],
        "suspense": [(110.0, 130.8, 164.8), (103.8, 130.8, 155.6), (110.0, 130.8, 164.8), (98.0, 123.5, 146.8)],
    }[estilo]
    bpm = {"calma": 80, "energia": 118, "suspense": 70}[estilo]
    barra = 4 * 60 / bpm  # duração de um compasso
    seg = 2 * barra
    partes = []
    for i, ac in enumerate(acordes):
        s0 = i * seg
        nota = "+".join(f"sin(2*PI*{f}*t)+0.3*sin(2*PI*{2 * f}*t)" for f in ac)
        partes.append(f"between(mod(t\\,{4 * seg})\\,{s0}\\,{s0 + seg})*({nota})")
    pad = "0.07*(" + "+".join(partes) + ")*(0.8+0.2*sin(2*PI*0.25*t))"
    expr = pad
    if estilo == "energia":
        beat = 60 / bpm
        kick = f"0.5*sin(2*PI*(55+90*exp(-25*mod(t\\,{beat})))*mod(t\\,{beat}))*exp(-9*mod(t\\,{beat}))"
        hat = f"0.06*(random(0)*2-1)*exp(-60*mod(t+{beat / 2}\\,{beat}))"
        expr = f"{pad}+{kick}+{hat}"
    elif estilo == "suspense":
        expr = f"{pad}*(0.6+0.4*abs(sin(PI*t*{bpm / 60})))"
    saida = Path(saida).resolve()
    saida.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([ffmpeg(), "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"aevalsrc='{expr}':d={d}:s={SR}",
                    "-af", f"lowpass=f=4500,afade=t=in:d=1.5,afade=t=out:st={max(0, d - 2.5)}:d=2.5,loudnorm=I=-22:TP=-3,alimiter=limit=0.8",
                    "-ac", "2", "-ar", str(SR), str(saida)], check=True)
    return saida


def mixar(audio, sons, musica, vol_musica, saida):
    """Fala + efeitos nos tempos certos + música com ducking (abaixa quando tem fala)."""
    lista = json.loads(Path(sons).read_text(encoding="utf-8")) if sons else []
    entradas = ["-i", str(audio)]
    filtros = ["[0:a]aresample=48000,aformat=channel_layouts=stereo,asplit=2[voz][chave]"]
    mix = ["[voz]"]
    k = 1
    for s in lista:
        arq = efeito(s["som"])
        entradas += ["-i", str(arq)]
        atraso = int(max(0, float(s["t"])) * 1000)
        filtros.append(f"[{k}:a]volume={float(s.get('vol', 0.7))},adelay={atraso}|{atraso}[e{k}]")
        mix.append(f"[e{k}]")
        k += 1
    if musica:
        entradas += ["-stream_loop", "-1", "-i", str(musica)]
        filtros.append(f"[{k}:a]aresample=48000,aformat=channel_layouts=stereo,volume={vol_musica}[m0]")
        # ducking: a música cai ~10 dB quando a fala está ativa
        filtros.append("[m0][chave]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=350[mus]")
        mix.append("[mus]")
    else:
        filtros.append("[chave]anullsink")
    filtros.append(f"{''.join(mix)}amix=inputs={len(mix)}:normalize=0:duration=first,alimiter=limit=0.95[saida]")
    saida = Path(saida).resolve()
    subprocess.run([ffmpeg(), "-y", "-loglevel", "error", *entradas, "-filter_complex", ";".join(filtros), "-map", "[saida]", "-ac", "2", "-ar", "48000", str(saida)], check=True)
    return saida


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("lista")
    t = sub.add_parser("trilha")
    t.add_argument("--estilo", choices=["calma", "energia", "suspense"], default="calma")
    t.add_argument("--duracao", type=float, required=True)
    t.add_argument("--saida", required=True)
    m = sub.add_parser("mixar")
    m.add_argument("--audio", required=True)
    m.add_argument("--sons")
    m.add_argument("--musica")
    m.add_argument("--volume-musica", type=float, default=0.14)
    m.add_argument("--saida", required=True)
    a = ap.parse_args()
    if a.cmd == "lista":
        print(json.dumps({"ok": True, "efeitos": {n: str(efeito(n)) for n in EFEITOS}}, ensure_ascii=False))
    elif a.cmd == "trilha":
        print(json.dumps({"ok": True, "arquivo": str(trilha(a.estilo, a.duracao, a.saida))}, ensure_ascii=False))
    else:
        print(json.dumps({"ok": True, "arquivo": str(mixar(a.audio, a.sons, a.musica, a.volume_musica, a.saida))}, ensure_ascii=False))
