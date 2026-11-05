"""Gera um vídeo MP4 com título animado, subtítulo e legenda palavra por palavra (Pillow + FFmpeg, sem GPU).

Exemplo (reel vertical de 8 s):
  python titulo_animado.py --titulo "FEIRÃO JUCA" --subtitulo "Ofertas de fim de ano" \
      --legenda "Condições especiais só até dezembro" --duracao 8 --formato 9x16 --saida feirao.mp4

O vídeo é função do número do frame (determinístico). Os quadros seguem direto para o FFmpeg, sem pasta de frames.
FFmpeg é procurado no PATH, na pasta de ferramentas do Hermes e no pacote imageio-ffmpeg.
"""
import argparse, glob, os, shutil, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

FORMATOS = {"9x16": (1080, 1920), "16x9": (1920, 1080), "1x1": (1080, 1080)}
FONTES = [
    "C:/Windows/Fonts/arialbd.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
]


def achar_ffmpeg():
    p = shutil.which("ffmpeg")
    if p:
        return p
    home = os.path.expanduser("~")
    for padrao in (os.path.join(os.environ.get("SB_DATA_DIR", ""), "hermes", "tools", "ffmpeg*", "bin", "ffmpeg*"),
                   os.path.join(home, "hermes", "tools", "ffmpeg*", "bin", "ffmpeg*"),
                   os.path.join(os.environ.get("APPDATA", ""), "SegundoCerebro", "hermes", "tools", "ffmpeg*", "bin", "ffmpeg*")):
        for c in sorted(glob.glob(padrao)):
            if os.path.isfile(c):
                return c
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        raise SystemExit("FFmpeg não encontrado: instale no venv com `pip install imageio-ffmpeg` ou use o de hermes/tools")


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def c01(x):
    return 0.0 if x < 0 else 1.0 if x > 1 else x


def eoc(t):
    return 1.0 - (1.0 - t) ** 3


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--titulo", required=True)
    ap.add_argument("--subtitulo", default="")
    ap.add_argument("--legenda", default="", help="frase mostrada uma palavra por vez")
    ap.add_argument("--duracao", type=float, default=8.0)
    ap.add_argument("--formato", choices=FORMATOS, default="9x16")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--fundo-topo", default="#263a6e")
    ap.add_argument("--fundo-base", default="#0a122c")
    ap.add_argument("--destaque", default="#ffc54d", help="cor da legenda")
    ap.add_argument("--saida", required=True)
    a = ap.parse_args()

    W, H = FORMATOS[a.formato]
    fps, nf = a.fps, int(round(a.duracao * a.fps))
    fonte = next((f for f in FONTES if os.path.exists(f)), None)
    if not fonte:
        raise SystemExit("nenhuma fonte Bold encontrada: ajuste FONTES")
    F = lambda px: ImageFont.truetype(fonte, px)
    topo, base, ouro = hex_rgb(a.fundo_topo), hex_rgb(a.fundo_base), hex_rgb(a.destaque)
    branco, claro = (255, 255, 255), (214, 226, 250)
    s = W / 1080.0  # escala de tamanhos
    cy_t, cy_s, cy_l = int(H * 0.365), int(H * 0.465), int(H * 0.69)
    tam_t, tam_s, tam_l = int(132 * s), int(62 * s), int(108 * s)
    md = ImageDraw.Draw(Image.new("RGB", (W, H)))
    # reduz o título se não couber (95% da largura)
    while md.textbbox((0, 0), a.titulo, font=F(tam_t))[2] > W * 0.92 and tam_t > 20:
        tam_t -= 4
    palavras = a.legenda.split()
    bg = Image.new("RGB", (W, H)); d = ImageDraw.Draw(bg)
    for y in range(H):
        d.line([(0, y), (W, y)], fill=mix(topo, base, y / (H - 1)))
    bg_at = lambda y: mix(topo, base, max(0, min(H - 1, int(y))) / (H - 1))
    t_in, s_in, l_in = 0.0, 0.3 * a.duracao, 0.5 * a.duracao
    por_pal = (a.duracao - l_in) / max(1, len(palavras))

    ff = achar_ffmpeg()
    cmd = [ff, "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(fps), "-vcodec", "png", "-i", "-",
           "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", a.saida]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for n in range(nf):
        t = n / fps
        img = bg.copy(); d = ImageDraw.Draw(img)
        p = eoc(c01((t - t_in) / 1.5))
        if p > 0.004:
            d.text((W // 2, cy_t + (1 - p) * 130 * s), a.titulo, font=F(tam_t), fill=mix(bg_at(cy_t), branco, p), anchor="mm")
        if a.subtitulo:
            p = eoc(c01((t - s_in) / 1.3))
            if p > 0.004:
                d.text((W // 2, cy_s), a.subtitulo, font=F(tam_s), fill=mix(bg_at(cy_s), claro, p), anchor="mm")
        if palavras and t >= l_in:
            k = min(int((t - l_in) / por_pal), len(palavras) - 1)
            loc = (t - l_in) - k * por_pal
            p = eoc(c01(min(loc / 0.33, (por_pal - loc) / 0.27)))
            if p > 0.004:
                d.text((W // 2, cy_l), palavras[k], font=F(tam_l), fill=mix(bg_at(cy_l), ouro, p), anchor="mm")
        img.save(proc.stdin, "PNG")
    proc.stdin.close()
    if proc.wait() != 0:
        raise SystemExit("FFmpeg falhou")
    print(f"OK {a.saida} {W}x{H} {a.duracao}s {fps}fps ({nf} quadros)")


main()
