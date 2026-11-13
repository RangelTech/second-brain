"""Vídeo de título animado (reel, story, vinheta) só com FFmpeg: sem Pillow, sem Node, sem GPU. Roda no Python do Hermes.

Exemplo (reel 9:16 de 6 s):
  python titulo.py --titulo "PROMO DE NATAL" --subtitulo "Só até sexta" --legenda "Descontos em toda a loja" \
      --duracao 6 --formato 9x16 --cor1 "#5a0f12" --cor2 "#1a0406" --destaque "#ffd166" --saida promo.mp4

Formatos: 9x16 (1080x1920), 16x9 (1920x1080), 1x1 (1080x1080), 4x5 (1080x1350).
Animação: fundo em degradê que se move devagar, título entra subindo com fade (0,3 s a 1,1 s), subtítulo logo depois,
legenda palavra por palavra na base (a palavra atual em destaque), tudo some suave no último meio segundo.
Opcional: --logo caminho.png (canto superior), --musica caminho.mp3 (corta e faz fade no fim).
Imprime o caminho, a duração real e o tamanho no fim.
"""
import argparse, glob, json, os, shutil, subprocess, sys

FORMATOS = {"9x16": (1080, 1920), "16x9": (1920, 1080), "1x1": (1080, 1080), "4x5": (1080, 1350)}
FONTES = ["C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/segoeuib.ttf",
          "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
          "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"]
FONTES_LEVES = ["C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/segoeui.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf"]


def achar(nome):
    p = shutil.which(nome)
    if p:
        return p
    bases = [os.environ.get("SB_DATA_DIR", ""), os.path.join(os.environ.get("APPDATA", ""), "SegundoCerebro"),
             os.path.expanduser("~/.config/SegundoCerebro"), os.path.expanduser("~")]
    for b in bases:
        for c in sorted(glob.glob(os.path.join(b, "hermes", "tools", "ffmpeg*", "bin", nome + "*"))):
            if os.path.isfile(c):
                return c
    sys.exit(f"{nome} não encontrado (procure em <dados>/hermes/tools/ffmpeg*/bin)")


def fonte(lista, pedida=None):
    for f in ([pedida] if pedida else []) + lista:
        if f and os.path.isfile(f):
            return f
    sys.exit("Nenhuma fonte encontrada; passe --fonte caminho.ttf")


def ff(s):
    """Escapa texto e caminhos para o filtro do FFmpeg (dentro de aspas simples)."""
    return str(s).replace("\\", "/").replace(":", "\\:").replace("'", "\u2019").replace("%", "\\%")


def cor(h):
    h = h.strip().lstrip("#")
    if len(h) != 6:
        sys.exit(f"cor inválida: {h} (use #rrggbb)")
    return "0x" + h


def quebrar(texto, max_chars):
    linhas, atual = [], ""
    for p in texto.split():
        if len(atual) + len(p) + 1 > max_chars and atual:
            linhas.append(atual)
            atual = p
        else:
            atual = (atual + " " + p).strip()
    if atual:
        linhas.append(atual)
    return linhas


def main():
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("--titulo", required=True)
    a.add_argument("--subtitulo", default="")
    a.add_argument("--legenda", default="", help="frase dita palavra por palavra na base")
    a.add_argument("--duracao", type=float, default=6.0)
    a.add_argument("--formato", choices=FORMATOS, default="9x16")
    a.add_argument("--cor1", default="#1b2a4a", help="cor de cima do degradê")
    a.add_argument("--cor2", default="#0b1020", help="cor de baixo do degradê")
    a.add_argument("--texto", default="#ffffff")
    a.add_argument("--destaque", default="#ffd166", help="cor do subtítulo e da palavra atual da legenda")
    a.add_argument("--logo", default="")
    a.add_argument("--musica", default="")
    a.add_argument("--fonte", default="")
    a.add_argument("--fps", type=int, default=30)
    a.add_argument("--saida", required=True)
    o = a.parse_args()

    ffmpeg, ffprobe = achar("ffmpeg"), achar("ffprobe")
    W, H = FORMATOS[o.formato]
    D = max(2.0, min(60.0, o.duracao))
    bold, leve = fonte(FONTES, o.fonte or None), fonte(FONTES_LEVES)
    vertical = H > W
    tam_tit = int(W * (0.115 if vertical else 0.075))
    max_tit = 12 if vertical else 22
    linhas = quebrar(o.titulo, max_tit)
    while len(linhas) > 3 and tam_tit > 40:
        tam_tit = int(tam_tit * 0.85)
        max_tit += 3
        linhas = quebrar(o.titulo, max_tit)
    fim = f"min(1,({D:.2f}-t)/0.5)"  # some no ultimo meio segundo
    alpha_tit = f"if(lt(t,0.3),0,min(1,(t-0.3)/0.8))*{fim}"
    sobe = "max(0,1-(t-0.3)/0.8)"
    filtros = []
    centro = H * (0.42 if vertical else 0.40)
    altura_bloco = len(linhas) * tam_tit * 1.12
    for i, ln in enumerate(linhas):
        y0 = centro - altura_bloco / 2 + i * tam_tit * 1.12
        filtros.append(f"drawtext=fontfile='{ff(bold)}':text='{ff(ln)}':fontsize={tam_tit}:fontcolor={cor(o.texto)}:"
                       f"x=(w-text_w)/2:y='{y0:.0f}+{int(H*0.05)}*{sobe}':alpha='{alpha_tit}':shadowcolor=black@0.45:shadowx=0:shadowy=6")
    if o.subtitulo:
        tam_sub = int(tam_tit * 0.5)
        ys = centro + altura_bloco / 2 + tam_sub * 0.9
        alpha_sub = f"if(lt(t,0.9),0,min(1,(t-0.9)/0.6))*{fim}"
        filtros.append(f"drawtext=fontfile='{ff(bold)}':text='{ff(o.subtitulo)}':fontsize={tam_sub}:fontcolor={cor(o.destaque)}:"
                       f"x=(w-text_w)/2:y={ys:.0f}+{int(H*0.03)}*max(0\\,1-(t-0.9)/0.6):alpha='{alpha_sub}'")
    if o.legenda:
        # legenda palavra por palavra no estilo de reels: uma palavra por vez, centralizada, com fundo em pílula
        palavras = o.legenda.split()
        ini, fim_leg = min(1.6, D * 0.3), D - 0.5
        passo = max(0.22, (fim_leg - ini) / max(1, len(palavras)))
        tam_leg = int(W * (0.075 if vertical else 0.045))
        y_leg = H * (0.78 if vertical else 0.82)
        for k, p in enumerate(palavras):
            t0 = ini + k * passo
            t1 = min(D, t0 + passo)
            if t0 >= D:
                break
            entra = f"min(1,(t-{t0:.2f})/0.08)"
            filtros.append(f"drawtext=fontfile='{ff(bold)}':text='{ff(p.upper())}':fontsize={tam_leg}:fontcolor={cor(o.destaque)}:"
                           f"x=(w-text_w)/2:y={y_leg:.0f}:box=1:boxcolor=black@0.45:boxborderw={int(tam_leg*0.35)}:"
                           f"enable='between(t,{t0:.2f},{t1:.2f})':alpha='{entra}'")
    fundo = (f"gradients=s={W}x{H}:c0={cor(o.cor1)}:c1={cor(o.cor2)}:x0=0:y0=0:x1={W}:y1={H}:speed=0.008:r={o.fps}:d={D:.2f}")
    entradas = ["-f", "lavfi", "-i", fundo]
    grafo = "[0:v]" + ",".join(["format=yuv420p"] + filtros) + "[v0]"
    ultimo = "[v0]"
    if o.logo:
        if not os.path.isfile(o.logo):
            sys.exit("logo não encontrado")
        entradas += ["-i", o.logo]
        lado = int(W * 0.16)
        grafo += f";[1:v]scale={lado}:-1,format=rgba,colorchannelmixer=aa=0.95[lg];{ultimo}[lg]overlay=(W-w)/2:{int(H*0.08)}[v1]"
        ultimo = "[v1]"
    mapa = ["-map", ultimo]
    if o.musica:
        if not os.path.isfile(o.musica):
            sys.exit("música não encontrada")
        idx = 2 if o.logo else 1
        entradas += ["-i", o.musica]
        grafo += f";[{idx}:a]atrim=0:{D:.2f},afade=t=out:st={max(0, D-1):.2f}:d=1[a]"
        mapa += ["-map", "[a]", "-c:a", "aac", "-b:a", "160k"]
    os.makedirs(os.path.dirname(os.path.abspath(o.saida)) or ".", exist_ok=True)
    cmd = [ffmpeg, "-y", "-hide_banner", "-loglevel", "error"] + entradas + ["-filter_complex", grafo] + mapa + \
          ["-t", f"{D:.2f}", "-r", str(o.fps), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", o.saida]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit("FFmpeg falhou: " + r.stderr[-1500:])
    info = json.loads(subprocess.run([ffprobe, "-v", "error", "-show_entries", "format=duration:stream=width,height", "-of", "json", o.saida],
                                     capture_output=True, text=True).stdout or "{}")
    dur = float(info.get("format", {}).get("duration", 0))
    st = (info.get("streams") or [{}])[0]
    print(json.dumps({"arquivo": os.path.abspath(o.saida), "duracao_s": round(dur, 2), "largura": st.get("width"), "altura": st.get("height"),
                      "tamanho_kb": round(os.path.getsize(o.saida) / 1024)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
