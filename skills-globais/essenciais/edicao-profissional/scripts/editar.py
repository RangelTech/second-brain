"""Edição profissional de vídeo GRAVADO (pessoa falando para a câmera): Reels, TikTok, Shorts e VSL, sem IA de vídeo.
Skill edicao-profissional. Tudo local: ffmpeg do app + Motion (React desenhado por cima).

    python editar.py preparar --video gravacao.mp4 --pasta "Videos/edicao-x" [--palavras palavras.json | --legenda-youtube arq.json3]
        Extrai o áudio e as palavras com tempo (transcrição local da skill voz-local, ou o arquivo de palavras que você já tem).
    python editar.py cortes --pasta P [--silencio 0.45] [--inicio s --fim s]
        Tira silêncios e respiros longos (jump cut), opcionalmente só um trecho, e imprime a FALA FINAL frase por frase
        com o tempo NOVO: é com esses tempos que você escreve o plano.
    python editar.py montar --pasta P --plano plano.json [--formato 9x16|16x9|1x1] [--recorte x:y:l:a]
        Monta a base (cortes + zoom alternado no rosto) e a página da animação com legenda, títulos, imagens e efeitos
        do plano. Imprime html, audio e duracao para o motion_animar.

Plano (JSON, tempos da fala FINAL, em segundos):
{
  "titulo": {"texto": "3 ERROS QUE *MATAM* SUA VENDA", "ate": 3.0},
  "nome": {"nome": "Ermelino Espíndola", "cargo": "Consultor de varejo", "de": 1.0, "ate": 5.0},
  "destaques": [{"t": 12.4, "texto": "SONDAGEM", "dur": 1.6}],
  "imagens": [{"t": 20.0, "dur": 3.0, "arquivo": "loja.png", "legenda": "loja cheia"}],
  "listas": [{"t": 40.0, "dur": 6.0, "titulo": "Pergunte:", "itens": ["Para quem é?", "Qual ocasião?"]}],
  "numeros": [{"t": 55.0, "dur": 3.0, "valor": "70%", "rotulo": "das vendas vêm da sondagem"}],
  "cta": {"t": 0, "texto": "Comenta SONDAGEM", "sub": "que eu te mando o roteiro"},   # t=0 -> últimos 4 s
  "cores": {"d": "#ffcc00", "fundo": "#0b0d14"},
  "zoom": true,
  "trocas": [["os irlanda", "Olá, eu sou"]],   # corrige a transcrição na legenda (nomes, termos)
  "rosto": "centro",                            # onde fica o rosto no quadro (horizontal): quadros vão para o outro lado
  "sons_auto": true,                            # woosh no título/imagens, pop nos destaques, click nos itens, ding nos números
  "sons": [{"t": 33.0, "som": "boing"}],         # efeitos extras (motion/scripts/sons.py lista)
  "musica": {"estilo": "calma", "volume": 0.12}  # ou {"arquivo": "trilha.mp3"}; abaixa sozinha quando há fala
}
"""
import argparse
import glob
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
MODELO = AQUI.parent / "modelos" / "edicao.html"
FORMATOS = {"9x16": (1080, 1920), "16x9": (1920, 1080), "1x1": (1080, 1080), "4x5": (1080, 1350)}


def sair(erro):
    print(json.dumps({"ok": False, "erro": erro}, ensure_ascii=False))
    sys.exit(1)


def ffmpeg():
    exe = "ffmpeg.exe" if os.name == "nt" else "ffmpeg"
    cands = [shutil.which("ffmpeg")]
    for b in (os.environ.get("APPDATA", ""), str(Path.home() / ".config"), str(Path.home() / "Library" / "Application Support")):
        for nome in ("SegundoCerebro", "Segundo Cérebro", "segundo-cerebro", "Cérebro Pro"):
            cands += sorted(glob.glob(os.path.join(b, nome, "hermes*", "tools", "ffmpeg-*", "bin", exe)), reverse=True)
    c = next((c for c in cands if c and os.path.isfile(c)), None)
    if not c:
        sair("não achei o ffmpeg (vem com o Cérebro Pro)")
    return c


def ffprobe_dur(arq):
    ff = ffmpeg()
    p = subprocess.run([str(Path(ff).with_name("ffprobe" + Path(ff).suffix)), "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(arq)], capture_output=True, text=True)
    return float(p.stdout.strip() or 0)


def dims(arq):
    ff = ffmpeg()
    p = subprocess.run([str(Path(ff).with_name("ffprobe" + Path(ff).suffix)), "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", str(arq)], capture_output=True, text=True)
    w, h = p.stdout.strip().split(",")[:2]
    return int(w), int(h)


def palavras_json3(arq):
    j = json.loads(Path(arq).read_text(encoding="utf-8"))
    out = []
    for ev in j.get("events", []):
        t0 = ev.get("tStartMs", 0) / 1000
        for s in ev.get("segs") or []:
            w = (s.get("utf8") or "").strip()
            if w and w != "\n":
                for i, parte in enumerate(w.split()):
                    out.append({"t": round(t0 + s.get("tOffsetMs", 0) / 1000 + i * 0.15, 2), "w": parte})
    out.sort(key=lambda x: x["t"])
    limpo, dentro = [], False
    for x in out:
        if x["w"].startswith("["):
            dentro = True
        if not dentro and x["w"].strip("_>"):
            limpo.append(x)
        if x["w"].endswith("]"):
            dentro = False
    # fim de cada palavra: começo da próxima (no máximo 0,7 s depois; o resto é pausa)
    for i, x in enumerate(limpo):
        prox = limpo[i + 1]["t"] if i + 1 < len(limpo) else x["t"] + 0.5
        x["f"] = round(min(prox, x["t"] + max(0.18, 0.07 * len(x["w"]) + 0.12), x["t"] + 0.7), 2)
    return limpo


# ---------------------------------------------------------------- preparar
def preparar(video, pasta, palavras=None, legenda_youtube=None):
    pasta = Path(pasta).resolve()
    pasta.mkdir(parents=True, exist_ok=True)
    video = Path(video).resolve()
    if not video.exists():
        sair(f"vídeo não encontrado: {video}")
    ff = ffmpeg()
    audio = pasta / "fala16k.wav"
    subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(video), "-vn", "-ac", "1", "-ar", "16000", str(audio)], check=True)
    if legenda_youtube:
        pal = palavras_json3(legenda_youtube)
    elif palavras:
        pal = json.loads(Path(palavras).read_text(encoding="utf-8"))
    else:
        voz = AQUI.parent.parent / "voz-local" / "scripts" / "voz_local.py"
        saida = pasta / "palavras.json"
        p = subprocess.run([sys.executable, str(voz), "transcrever", "--audio", str(audio), "--saida", str(saida)], capture_output=True, text=True, encoding="utf-8")
        if p.returncode or not saida.exists():
            sair("a transcrição local falhou: " + (p.stdout + p.stderr)[-400:])
        pal = json.loads(saida.read_text(encoding="utf-8"))
    (pasta / "palavras.json").write_text(json.dumps(pal, ensure_ascii=False), encoding="utf-8")
    (pasta / "projeto.json").write_text(json.dumps({"video": str(video), "duracao": ffprobe_dur(video), "dims": dims(video)}), encoding="utf-8")
    print(json.dumps({"ok": True, "palavras": len(pal), "duracao": round(ffprobe_dur(video), 1), "texto": " ".join(x["w"] for x in pal)[:500]}, ensure_ascii=False))


# ---------------------------------------------------------------- cortes (jump cut nos silêncios)
def cortes(pasta, silencio=0.45, inicio=None, fim=None, folga=0.12):
    pasta = Path(pasta).resolve()
    pal = json.loads((pasta / "palavras.json").read_text(encoding="utf-8"))
    proj = json.loads((pasta / "projeto.json").read_text(encoding="utf-8"))
    if inicio is not None:
        pal = [x for x in pal if x["t"] >= inicio and x["t"] < (fim if fim is not None else 1e9)]
    if not pal:
        sair("nenhuma palavra no trecho")
    segs = []
    a, b = pal[0]["t"] - folga, pal[0]["f"] + folga
    for x in pal[1:]:
        if x["t"] - b > silencio:  # pausa longa: corta
            segs.append([max(0, a), b])
            a = x["t"] - folga
        b = x["f"] + folga
    segs.append([max(0, a), min(proj["duracao"], b + 0.25)])
    # mapa tempo original -> tempo final
    novas, acc = [], 0.0
    mapa = []
    for s0, s1 in segs:
        mapa.append({"o0": round(s0, 3), "o1": round(s1, 3), "n0": round(acc, 3)})
        acc += s1 - s0
    def novo(t):
        for m in mapa:
            if m["o0"] - 0.01 <= t <= m["o1"] + 0.01:
                return round(m["n0"] + (t - m["o0"]), 3)
        return None
    for x in pal:
        n = novo(x["t"])
        if n is not None:
            novas.append({"t": n, "f": round(n + (x["f"] - x["t"]), 3), "w": x["w"]})
    (pasta / "cortes.json").write_text(json.dumps({"segmentos": mapa, "duracao": round(acc, 3), "palavras": novas}, ensure_ascii=False), encoding="utf-8")
    # fala final em frases, com o tempo novo
    frase, ini = [], None
    for i, x in enumerate(novas):
        if ini is None:
            ini = x["t"]
        frase.append(x["w"])
        prox = novas[i + 1]["t"] if i + 1 < len(novas) else 1e9
        if re.search(r"[.?!…]$", x["w"]) or prox - x["f"] > 0.35 or len(frase) >= 18:
            print(f"[{ini:6.1f}] {' '.join(frase)}")
            frase, ini = [], None
    tirado = (proj["duracao"] if inicio is None else ((fim or proj["duracao"]) - inicio)) - acc
    print(json.dumps({"ok": True, "duracao_final": round(acc, 1), "cortes": len(mapa), "silencio_tirado_s": round(tirado, 1)}, ensure_ascii=False))


def aplicar_trocas(pal, trocas):
    """Corrige a transcrição na legenda: [["texto errado", "texto certo"], ...]. As palavras certas ocupam o tempo das erradas."""
    norm = lambda w: re.sub(r"[^\w]", "", w.lower())
    for errado, certo in trocas or []:
        alvo = [norm(w) for w in errado.split()]
        novas = certo.split()
        i = 0
        while i <= len(pal) - len(alvo):
            if [norm(x["w"]) for x in pal[i:i + len(alvo)]] == alvo:
                t0, f1 = pal[i]["t"], pal[i + len(alvo) - 1]["f"]
                passo = (f1 - t0) / max(1, len(novas))
                pal[i:i + len(alvo)] = [{"t": round(t0 + k * passo, 3), "f": round(t0 + (k + 1) * passo, 3), "w": w} for k, w in enumerate(novas)]
                i += len(novas)
            else:
                i += 1
    return pal


SONS = AQUI.parent.parent / "motion" / "scripts" / "sons.py"


def mixar_sons(pasta, audio, pl, dur):
    """Efeitos (manuais em plano.sons e/ou automáticos com plano.sons_auto) + trilha (plano.musica) com ducking."""
    lista = list(pl.get("sons") or [])
    if pl.get("sons_auto", True):
        if pl.get("titulo"):
            lista.append({"t": 0.05, "som": "whoosh", "vol": 0.5})
        for d in pl.get("destaques", []):
            lista.append({"t": d["t"], "som": d.get("som", "pop"), "vol": 0.6})
        for im in pl.get("imagens", []):
            lista.append({"t": im["t"], "som": "whoosh", "vol": 0.45})
        for l in pl.get("listas", []):
            n = len(l.get("itens", [])) or 1
            for k in range(n):
                lista.append({"t": l["t"] + 0.3 + k * min(1.2, (l.get("dur", 5) - 1) / n), "som": "click", "vol": 0.5})
        for nu in pl.get("numeros", []):
            lista.append({"t": nu["t"] + min(1.4, nu.get("dur", 3) * 0.5), "som": "ding", "vol": 0.45})
        if pl.get("cta"):
            lista.append({"t": pl["cta"].get("t") or max(0, dur - 4), "som": "pop", "vol": 0.6})
    mus = pl.get("musica")
    if not lista and not mus:
        return audio
    arq_sons = pasta / "sons.json"
    arq_sons.write_text(json.dumps(lista), encoding="utf-8")
    cmd = [sys.executable, str(SONS), "mixar", "--audio", str(audio), "--sons", str(arq_sons), "--saida", str(pasta / "audio-final.wav")]
    if mus:
        trilha = mus.get("arquivo")
        if not trilha:
            trilha = str(pasta / f"trilha-{mus.get('estilo', 'calma')}.wav")
            subprocess.run([sys.executable, str(SONS), "trilha", "--estilo", mus.get("estilo", "calma"), "--duracao", str(dur + 1), "--saida", trilha], check=True, capture_output=True)
        cmd += ["--musica", trilha, "--volume-musica", str(mus.get("volume", 0.14))]
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if p.returncode:
        sair("a mixagem de sons falhou: " + (p.stdout + p.stderr)[-300:])
    return pasta / "audio-final.wav"


# ---------------------------------------------------------------- montar
def montar(pasta, plano, formato="9x16", recorte=None):
    pasta = Path(pasta).resolve()
    proj = json.loads((pasta / "projeto.json").read_text(encoding="utf-8"))
    cj = json.loads((pasta / "cortes.json").read_text(encoding="utf-8"))
    pl = json.loads(Path(plano).read_text(encoding="utf-8")) if plano else {}
    W, H = FORMATOS.get(formato, FORMATOS["9x16"])
    sw, sh = proj["dims"]
    ff = ffmpeg()
    # recorte do rosto/assunto (frações); padrão: centro na proporção do formato
    if recorte:
        x, y, l, a = [float(v) for v in recorte.split(":")]
    else:
        alvo = W / H
        if sw / sh > alvo:
            l, a = (sh * alvo) / sw, 1.0
        else:
            l, a = 1.0, (sw / alvo) / sh
        x, y = (1 - l) / 2, (1 - a) / 2
    zoom = pl.get("zoom", True)
    partes, fil = [], []
    for i, m in enumerate(cj["segmentos"]):
        z = 1.12 if (zoom and i % 2 == 1) else 1.0  # punch-in alternado: cada corte muda o enquadramento (esconde o pulo)
        cw, ch = l / z, a / z
        cx, cy = x + (l - cw) / 2, y + (a - ch) * 0.35  # zoom puxado para cima (rosto)
        fil.append(f"[0:v]trim={m['o0']}:{m['o1']},setpts=PTS-STARTPTS,crop=iw*{cw:.4f}:ih*{ch:.4f}:iw*{cx:.4f}:ih*{cy:.4f},scale={W}:{H},setsar=1,fps=30[v{i}];"
                   f"[0:a]atrim={m['o0']}:{m['o1']},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st={max(0, m['o1'] - m['o0'] - 0.03):.3f}:d=0.03[a{i}];")
        partes.append(f"[v{i}][a{i}]")
    filtro = "".join(fil) + "".join(partes) + f"concat=n={len(partes)}:v=1:a=1[v][a];[a]loudnorm=I=-14:TP=-1.5:LRA=9[an]"
    base = pasta / "base.mp4"
    script = pasta / "filtro.txt"
    script.write_text(filtro, encoding="utf-8")
    subprocess.run([ff, "-y", "-loglevel", "error", "-i", proj["video"], "-/filter_complex", str(script), "-map", "[v]", "-map", "[an]",
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", str(base)], check=True)
    audio = pasta / "audio.wav"
    subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(base), "-vn", "-ac", "2", "-ar", "48000", str(audio)], check=True)
    dur = round(ffprobe_dur(base), 3)
    audio = mixar_sons(pasta, audio, pl, dur)
    # imagens do plano: caminho relativo à pasta do projeto (o Motion carrega da pasta do vídeo)
    for im in pl.get("imagens", []):
        arq = Path(im["arquivo"])
        if arq.is_absolute() and arq.exists() and arq.parent != pasta:
            shutil.copy(arq, pasta / arq.name)
        im["arquivo"] = arq.name
    dados = {"W": W, "H": H, "dur": dur, "video": base.name, "palavras": aplicar_trocas(cj["palavras"], pl.get("trocas")), "plano": pl}
    html = MODELO.read_text(encoding="utf-8")
    a0, b0 = html.index("/*DADOS*/"), html.index("/*FIM*/")
    html = html[: a0 + len("/*DADOS*/")] + json.dumps(dados, ensure_ascii=False) + html[b0:]
    html = html.replace("width:1080px;height:1920px", f"width:{W}px;height:{H}px")
    arq = pasta / f"edicao-{formato}.html"
    arq.write_text(html, encoding="utf-8")
    marcos = sorted({round(min(dur - 0.5, max(0.5, t)), 1) for t in [1.0, dur * 0.3, dur * 0.6, dur - 2] + [d["t"] + 0.6 for d in pl.get("destaques", [])[:2]] + [im["t"] + 1 for im in pl.get("imagens", [])[:2]]})
    print(json.dumps({"ok": True, "html": str(arq), "audio": str(audio), "duracao": dur, "largura": W, "altura": H,
                      "saida_sugerida": str(pasta / f"editado-{formato}.mp4"), "previa_sugerida": list(marcos)[:8]}, ensure_ascii=False))


def acabamento(video, pasta, arroba="", cta="", cta_seg=4.5, cor="#22d3a6", arroba_y=None):
    """Acabamento leve num vídeo pronto: moldura fina, @ do perfil e chamada final ("Se quiser saber mais|digita *IA* nos comentários")."""
    pasta = Path(pasta).resolve()
    pasta.mkdir(parents=True, exist_ok=True)
    video = Path(video).resolve()
    ff = ffmpeg()
    W, H = dims(video)
    base = pasta / ("acab-" + video.name)
    if base != video:
        shutil.copy(video, base)
    audio = pasta / ("acab-" + video.stem + ".wav")
    subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(video), "-vn", "-ac", "2", "-ar", "48000", str(audio)], check=True)
    dur = round(ffprobe_dur(video), 3)
    dados = {"W": W, "H": H, "dur": dur, "video": base.name, "arroba": arroba, "cta": cta, "ctaSeg": cta_seg, "cor": cor}
    if arroba_y is not None:
        dados["arrobaY"] = arroba_y
    html = (AQUI.parent / "modelos" / "acabamento.html").read_text(encoding="utf-8")
    a0, b0 = html.index("/*DADOS*/"), html.index("/*FIM*/")
    html = html[: a0 + len("/*DADOS*/")] + json.dumps(dados, ensure_ascii=False) + html[b0:]
    html = html.replace("width:1080px;height:1920px", f"width:{W}px;height:{H}px")
    arq = pasta / ("acab-" + video.stem + ".html")
    arq.write_text(html, encoding="utf-8")
    print(json.dumps({"ok": True, "html": str(arq), "audio": str(audio), "duracao": dur, "largura": W, "altura": H,
                      "saida_sugerida": str(pasta / (video.stem + "-final.mp4")), "previa_sugerida": [1.0, round(dur / 2, 1), round(dur - 1.5, 1)]}, ensure_ascii=False))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    p1 = sub.add_parser("preparar")
    p1.add_argument("--video", required=True)
    p1.add_argument("--pasta", required=True)
    p1.add_argument("--palavras")
    p1.add_argument("--legenda-youtube")
    p2 = sub.add_parser("cortes")
    p2.add_argument("--pasta", required=True)
    p2.add_argument("--silencio", type=float, default=0.45)
    p2.add_argument("--inicio", type=float)
    p2.add_argument("--fim", type=float)
    p3 = sub.add_parser("montar")
    p3.add_argument("--pasta", required=True)
    p3.add_argument("--plano")
    p3.add_argument("--formato", default="9x16", choices=list(FORMATOS))
    p3.add_argument("--recorte")
    p4 = sub.add_parser("acabamento")
    p4.add_argument("--video", required=True)
    p4.add_argument("--pasta", required=True)
    p4.add_argument("--arroba", default="")
    p4.add_argument("--cta", default="", help='duas linhas separadas por |, destaque com *: "Se quiser saber mais|digita *IA* nos comentários"')
    p4.add_argument("--cta-seg", type=float, default=4.5)
    p4.add_argument("--cor", default="#22d3a6")
    p4.add_argument("--arroba-y", type=float, help="altura do @ como fração da tela (0.04 = topo; padrão). Olhe a prévia: o @ não pode encostar em título do vídeo")
    a = ap.parse_args()
    if a.cmd == "preparar":
        preparar(a.video, a.pasta, a.palavras, a.legenda_youtube)
    elif a.cmd == "cortes":
        cortes(a.pasta, a.silencio, a.inicio, a.fim)
    elif a.cmd == "acabamento":
        acabamento(a.video, a.pasta, a.arroba, a.cta, a.cta_seg, a.cor, a.arroba_y)
    else:
        montar(a.pasta, a.plano, a.formato, a.recorte)
