"""Cortes de vídeo longo (live, podcast, gameplay) para TikTok/Reels/Shorts (skill cortes-de-video).

    python cortes.py analisar --url URL --pasta "Videos/cortes-x" [--duracao 20] [--quantos 8]
        baixa SÓ os dados (sem o vídeo): informações, transcrição automática e, se for live, o chat; dá nota a cada trecho
        e grava momentos.json com os melhores (nota, fala do trecho, mensagens do chat). Você lê e escolhe.
    python cortes.py cortar --url URL --pasta P --inicio 3725.5 [--duracao 20] --nome corte-01
        baixa SÓ aquele trecho em até 1080p, monta a base vertical 1080x1920 (vídeo no meio, fundo desfocado) e a legenda
        com tempo por palavra (legenda-corte-01.json).
    python cortes.py montar --pasta P --nome corte-01 --titulo "TEXTO DO GANCHO" [--arroba @canal] [--cor "#ff2d55"] [--legenda-traduzida trad.json]
        escreve corte-01.html (moldura, título, legenda palavra por palavra, barra de tempo) e o áudio; imprime o que passar
        para motion_animar.
Tudo imprime uma linha JSON no fim. O yt-dlp é baixado sozinho (ferramenta oficial; snapshot nosso de reserva)."""
import argparse
import glob
import json
import os
import re
import shutil
import statistics
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

AQUI = Path(__file__).resolve().parent
MODELO = AQUI.parent / "modelos" / "corte-tiktok.html"
FERR = Path.home() / ".segundo-cerebro" / "ferramentas"
YTDLP_OFICIAL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/"
YTDLP_NOSSO = "https://github.com/RangelTech/segundo-cerebro-artefatos/releases/download/ferramentas-v1/"
EMPOLGA = re.compile(r"(k{3,}|K{3,}|haha|hahah|rs{2,}|!{2,}|\?{3,}|caralh|meu deus|nossa|que isso|insano|absurd|lol|lmao|omg|wtf|pog|😂|🤣|🔥|😱|😳|💀|❤️|👏)", re.I)


def sair(erro):
    print(json.dumps({"ok": False, "erro": erro}, ensure_ascii=False))
    sys.exit(1)


def log(m):
    print(m, file=sys.stderr, flush=True)


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


def _baixar(url, destino):
    try:
        urllib.request.urlretrieve(url, destino)
    except Exception as e:  # noqa: BLE001
        curl = shutil.which("curl") or shutil.which("curl.exe")
        if not curl:
            raise
        log(f"download pelo Python falhou ({e}); usando o curl do sistema")
        subprocess.run([curl, "-fsSL", "--retry", "3", "-o", str(destino), url], check=True)


def ytdlp():
    """yt-dlp numa pasta nossa. Atualiza a cada 3 dias (o YouTube muda e versão velha para de funcionar)."""
    nome = {"nt": "yt-dlp.exe"}.get(os.name) or ("yt-dlp_macos" if sys.platform == "darwin" else "yt-dlp_linux")
    FERR.mkdir(parents=True, exist_ok=True)
    exe = FERR / ("yt-dlp.exe" if os.name == "nt" else "yt-dlp")
    velho = exe.exists() and time.time() - exe.stat().st_mtime > 3 * 86400
    if not exe.exists() or velho:
        tmp = exe.with_suffix(".novo")
        for base in (YTDLP_OFICIAL, YTDLP_NOSSO):
            try:
                log(f"baixando o yt-dlp de {base.split('/')[3]}...")
                _baixar(base + nome, tmp)
                if tmp.stat().st_size > 1_000_000:
                    os.chmod(tmp, 0o755)
                    tmp.replace(exe)
                    break
            except Exception as e:  # noqa: BLE001
                log(f"  falhou: {e}")
        if not exe.exists():
            sair("não consegui baixar o yt-dlp (confira a internet)")
    return str(exe)


def yt(args, **kw):
    base = [ytdlp(), "--no-warnings", "--ffmpeg-location", str(Path(ffmpeg()).parent)]
    return subprocess.run(base + args, capture_output=True, text=True, encoding="utf-8", errors="replace", **kw)


# ---------------------------------------------------------------- legenda (json3 do YouTube: tem tempo por palavra)
def palavras_json3(arq):
    j = json.loads(Path(arq).read_text(encoding="utf-8"))
    out = []
    for ev in j.get("events", []):
        t0 = ev.get("tStartMs", 0) / 1000
        for s in ev.get("segs") or []:
            w = (s.get("utf8") or "").strip()
            if not w or w == "\n":
                continue
            for i, parte in enumerate(w.split()):
                out.append({"t": round(t0 + s.get("tOffsetMs", 0) / 1000 + i * 0.15, 2), "w": parte})
    out.sort(key=lambda x: x["t"])
    # tira o que não é fala: "[ __ ]" (palavrão censurado pelo YouTube) e anotações entre colchetes ("[música]", "[limpando a garganta]")
    limpo, dentro = [], False
    for x in out:
        w = x["w"]
        if w.startswith("["):
            dentro = True
        if not dentro and w.strip("_>") != "":
            limpo.append({"t": x["t"], "w": w.lstrip(">")})
        if w.endswith("]"):
            dentro = False
    return [x for x in limpo if x["w"]]


def frases(pal):
    """Agrupa palavras em frases: quebra em . ? ! ou numa pausa maior que 0,7 s."""
    out, atual = [], []
    for i, x in enumerate(pal):
        atual.append(x)
        prox = pal[i + 1]["t"] if i + 1 < len(pal) else x["t"] + 1
        if re.search(r"[.?!…]\"?$", x["w"]) or prox - x["t"] > 0.7:
            out.append({"ini": atual[0]["t"], "fim": round(min(prox, x["t"] + 0.6), 2), "texto": " ".join(w["w"] for w in atual)})
            atual = []
    return out


def achar_legenda(pasta):
    arqs = sorted(Path(pasta).glob("dados*.json3"))
    for pref in (".pt-orig.", ".en-orig.", ".pt.", ".pt-BR.", ".en.", ".es."):
        for a in arqs:
            if pref in a.name:
                return a
    return arqs[0] if arqs else None


# ---------------------------------------------------------------- analisar
def analisar(url, pasta, dur, quantos):
    pasta = Path(pasta).resolve()
    pasta.mkdir(parents=True, exist_ok=True)
    log("lendo as informações do vídeo...")
    p = yt(["-J", "--skip-download", url])
    if p.returncode:
        sair("não consegui ler o vídeo: " + p.stderr[-400:])
    info = json.loads(p.stdout)
    (pasta / "info.json").write_text(json.dumps({k: info.get(k) for k in ("id", "title", "duration", "channel", "was_live", "language", "heatmap", "chapters", "webpage_url")}, ensure_ascii=False), encoding="utf-8")
    sb = {f["format_id"]: {k: f.get(k) for k in ("rows", "columns", "width", "height", "fragments")} for f in info.get("formats", []) if str(f.get("format_id", "")).startswith("sb")}
    (pasta / "storyboard.json").write_text(json.dumps(sb), encoding="utf-8")
    total = float(info.get("duration") or 0)
    if total < dur * 2:
        sair("vídeo curto demais para cortes")
    log("baixando a transcrição automática...")
    yt(["--skip-download", "--write-auto-subs", "--write-subs", "--sub-langs", "pt-orig,pt,pt-BR,en-orig,en", "--sub-format", "json3", "-o", str(pasta / "dados.%(ext)s"), url])
    leg = achar_legenda(pasta)
    falas = palavras_json3(leg) if leg else []
    chat = []
    if "live_chat" in (info.get("subtitles") or {}):
        log("baixando o chat da live (pode levar alguns minutos em live longa)...")
        yt(["--skip-download", "--write-subs", "--sub-langs", "live_chat", "-o", str(pasta / "chat.%(ext)s"), url], timeout=1800)
        arq = next(iter(pasta.glob("chat*.live_chat.json")), None)
        if arq:
            for linha in arq.read_text(encoding="utf-8", errors="replace").splitlines():
                try:
                    a = json.loads(linha)["replayChatItemAction"]
                    ms = int(a.get("videoOffsetTimeMsec", 0))
                    for ac in a.get("actions", []):
                        it = (ac.get("addChatItemAction") or {}).get("item", {})
                        r = it.get("liveChatTextMessageRenderer") or it.get("liveChatPaidMessageRenderer")
                        if r:
                            txt = "".join(x.get("text", "") or (x.get("emoji", {}).get("shortcuts") or [""])[0] for x in r.get("message", {}).get("runs", []))
                            chat.append((ms / 1000, txt))
                except Exception:  # noqa: BLE001
                    continue
    # notas por segundo: chat (volume + empolgação, com atraso de reação de ~8 s), mapa de "mais assistidos", fala empolgada
    n = int(total) + 1
    nota_chat = [0.0] * n
    for t, txt in chat:
        i = int(max(0, t - 8))  # o chat reage depois do momento
        if i < n:
            nota_chat[i] += 1 + 2 * len(EMPOLGA.findall(txt))
    nota_heat = [0.0] * n
    for h in info.get("heatmap") or []:
        for i in range(int(h["start_time"]), min(n, int(h["end_time"]) + 1)):
            nota_heat[i] = max(nota_heat[i], float(h["value"]))
    nota_fala = [0.0] * n
    for x in falas:
        if EMPOLGA.search(x["w"]) and int(x["t"]) < n:
            nota_fala[int(x["t"])] += 1

    def norm(v):
        m = max(v) or 1
        return [x / m for x in v]

    nc, nh, nf = norm(nota_chat), norm(nota_heat), norm(nota_fala)
    peso_c, peso_h, peso_f = (1.0 if chat else 0), (1.2 if info.get("heatmap") else 0), 0.4
    if not chat and not info.get("heatmap"):
        peso_f = 1.0  # só a fala: densidade de fala + empolgação
        for x in falas:
            if int(x["t"]) < n:
                nf[int(x["t"])] += 0.05
    seg = [peso_c * a + peso_h * b + peso_f * c for a, b, c in zip(nc, nh, nf)]
    janela = int(dur)
    soma = [sum(seg[i:i + janela]) for i in range(0, max(1, n - janela), 2)]
    ordem = sorted(range(len(soma)), key=lambda k: -soma[k])
    escolhidos = []
    for k in ordem:
        ini = k * 2
        if ini < 30 or ini > total - dur - 5:  # pula abertura e encerramento da live
            continue
        if all(abs(ini - e) > 90 for e in escolhidos):
            escolhidos.append(ini)
        if len(escolhidos) >= quantos * 2:
            break
    media = statistics.mean(soma) if soma else 0
    momentos = []
    for ini in escolhidos[: quantos * 2]:
        ini_c = max(0, ini - 2)  # 2 s de contexto antes
        fala = " ".join(x["w"] for x in falas if ini_c <= x["t"] < ini_c + dur)
        msgs = [m for t, m in chat if ini_c + 4 <= t <= ini_c + dur + 12][:12]
        momentos.append({"inicio": ini_c, "fim": ini_c + dur, "minuto": f"{int(ini_c // 3600)}:{int(ini_c % 3600 // 60):02d}:{int(ini_c % 60):02d}",
                         "nota": round(soma[ini // 2] / (media or 1), 2), "fala": fala[:600], "chat": msgs})
    (pasta / "momentos.json").write_text(json.dumps(momentos, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({"ok": True, "titulo": info.get("title"), "duracao_min": round(total / 60), "transcricao": leg.name if leg else None,
                      "mensagens_chat": len(chat), "mapa_mais_vistos": bool(info.get("heatmap")), "momentos": str(pasta / "momentos.json"),
                      "candidatos": len(momentos)}, ensure_ascii=False))


# ---------------------------------------------------------------- mapa (VER o vídeo pelas miniaturas do YouTube, sem baixar)
MAPA_PY = """
import json, sys, io, urllib.request
from PIL import Image, ImageDraw, ImageFont
cfg = json.loads(sys.argv[1])
try:
    fonte = ImageFont.truetype(cfg["fonte"], 20) if cfg.get("fonte") else ImageFont.load_default()
except Exception:
    fonte = ImageFont.load_default()
tiles = []
for fr in cfg["fragmentos"]:
    try:
        req = urllib.request.Request(fr["url"], headers={"User-Agent": "Mozilla/5.0"})
        g = Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=60).read())).convert("RGB")
    except Exception:
        continue
    for k in range(cfg["rows"] * cfg["cols"]):
        t = fr["ini"] + k * cfg["passo_tile"]
        if t >= fr["fim"] or t < cfg["de"] or t > cfg["ate"]:
            continue
        r, c = divmod(k, cfg["cols"])
        tiles.append((t, g.crop((c * cfg["w"], r * cfg["h"], (c + 1) * cfg["w"], (r + 1) * cfg["h"]))))
tiles.sort(key=lambda x: x[0])
sel, ult = [], -1e9
for t, im in tiles:
    if t - ult >= cfg["passo"] - 0.01:
        sel.append((t, im))
        ult = t
W, H, COL, LIN = cfg["w"], cfg["h"], cfg["colunas"], cfg["linhas"]
saidas = []
for f in range(0, len(sel), COL * LIN):
    bloco = sel[f:f + COL * LIN]
    folha = Image.new("RGB", (COL * W, LIN * (H + 26)), (20, 20, 20))
    d = ImageDraw.Draw(folha)
    for i, (t, im) in enumerate(bloco):
        r, c = divmod(i, COL)
        folha.paste(im, (c * W, r * (H + 26) + 26))
        rot = "%d:%02d:%02d" % (t // 3600, t % 3600 // 60, t % 60)
        d.text((c * W + 4, r * (H + 26) + 3), rot, fill=(255, 220, 0), font=fonte)
    arq = cfg["saida"] % (len(saidas) + 1)
    folha.save(arq, quality=88)
    saidas.append({"arquivo": arq, "de": bloco[0][0], "ate": bloco[-1][0]})
print(json.dumps(saidas))
"""


def python_com_pillow():
    try:
        import PIL  # noqa: F401
        return sys.executable
    except Exception:  # noqa: BLE001
        pass
    docs = AQUI.parent.parent / "documentos-e-planilhas" / "scripts" / "ambiente_docs.py"
    p = subprocess.run([sys.executable, str(docs), "preparar"], capture_output=True, text=True, encoding="utf-8")
    try:
        return json.loads(p.stdout.strip().splitlines()[-1])["python"]
    except Exception:  # noqa: BLE001
        sair("não consegui preparar o ambiente de imagens (skill documentos-e-planilhas)")


def mapa(pasta, inicio=None, fim=None, passo=None):
    """Folhas de miniaturas com o horário escrito em cada uma. Sem --inicio/--fim: o vídeo inteiro, uma a cada 30 s.
    Com --inicio/--fim: o trecho em detalhe (miniaturas maiores, a cada ~10 s)."""
    pasta = Path(pasta).resolve()
    try:
        sb = json.loads((pasta / "storyboard.json").read_text(encoding="utf-8"))
        total = float(json.loads((pasta / "info.json").read_text(encoding="utf-8"))["duration"])
    except Exception:  # noqa: BLE001
        sair("rode analisar antes (ele guarda o índice das miniaturas)")
    detalhe = inicio is not None and fim is not None
    fmt = sb.get("sb0" if detalhe else "sb1") or sb.get("sb1") or sb.get("sb0")
    if not fmt or not fmt.get("fragments"):
        sair("este vídeo não tem miniaturas do YouTube; corte um trecho e olhe quadros com ffmpeg")
    frs, t = [], 0.0
    for fr in fmt["fragments"]:
        d = float(fr.get("duration") or 0)
        frs.append({"url": fr["url"], "ini": t, "fim": t + d})
        t += d
    n = fmt["rows"] * fmt["columns"]
    passo_tile = (frs[0]["fim"] - frs[0]["ini"]) / n if frs else 10
    de, ate = (inicio, fim) if detalhe else (0, total)
    frs = [f for f in frs if f["fim"] >= de and f["ini"] <= ate]
    pasta_m = pasta / "mapa"
    pasta_m.mkdir(exist_ok=True)
    nome = f"detalhe-{int(de)}-{int(ate)}" if detalhe else "geral"
    fonte = next((f for f in ("C:/Windows/Fonts/arialbd.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf") if os.path.isfile(f)), "")
    cfg = {"fragmentos": frs, "rows": fmt["rows"], "cols": fmt["columns"], "w": fmt["width"], "h": fmt["height"], "passo_tile": passo_tile,
           "passo": passo or (passo_tile if detalhe else 30), "de": de, "ate": ate, "colunas": 4 if detalhe else 8, "linhas": 4 if detalhe else 6,
           "saida": str(pasta_m / (nome + "-%02d.jpg")), "fonte": fonte}
    p = subprocess.run([python_com_pillow(), "-c", MAPA_PY, json.dumps(cfg)], capture_output=True, text=True, encoding="utf-8")
    if p.returncode:
        sair("falhou ao montar o mapa: " + p.stderr[-400:])
    folhas = json.loads(p.stdout.strip().splitlines()[-1])
    print(json.dumps({"ok": True, "folhas": folhas, "dica": "olhe cada folha com vision_analyze; o horário amarelo de cada miniatura é o tempo no vídeo"}, ensure_ascii=False))


# ---------------------------------------------------------------- quadro com grade (medir recortes com precisão)
QUADRO_PY = """
import json, sys
from PIL import Image, ImageDraw, ImageFont
c = json.loads(sys.argv[1])
im = Image.open(c["png"]).convert("RGB")
W, H = im.size
d = ImageDraw.Draw(im)
try:
    f = ImageFont.truetype(c["fonte"], max(14, W // 70)) if c.get("fonte") else ImageFont.load_default()
except Exception:
    f = ImageFont.load_default()
for k in range(1, 20):
    x = W * k / 20
    y = H * k / 20
    forte = k % 2 == 0
    d.line([(x, 0), (x, H)], fill=(255, 230, 0) if forte else (255, 230, 0, 90), width=2 if forte else 1)
    d.line([(0, y), (W, y)], fill=(0, 230, 255) if forte else (0, 230, 255, 90), width=2 if forte else 1)
    if forte:
        d.text((x + 3, 3), "%.1f" % (k / 20), fill=(255, 230, 0), font=f)
        d.text((3, y + 3), "%.1f" % (k / 20), fill=(0, 230, 255), font=f)
im.save(c["saida"])
print(json.dumps({"ok": True, "arquivo": c["saida"], "largura": W, "altura": H}))
"""


def quadro(pasta, nome, t, url=None):
    """Quadro do trecho baixado (ou do vídeo, com --url) com grade de 5 em 5 %: amarelo = x, azul = y.
    Use para medir --recorte e --recorte-camera (x:y:largura:altura em frações)."""
    pasta = Path(pasta).resolve()
    ff = ffmpeg()
    brutos = sorted(pasta.glob(f"{nome}-bruto-*.mp4"))
    if not brutos:
        sair(f"baixe o trecho antes (cortar --nome {nome}) ou use outro nome")
    png = pasta / f"{nome}-quadro-{t:g}.png"
    subprocess.run([ff, "-y", "-loglevel", "error", "-ss", str(t), "-i", str(brutos[-1]), "-frames:v", "1", str(png)], check=True)
    fonte = next((f for f in ("C:/Windows/Fonts/arialbd.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf") if os.path.isfile(f)), "")
    saida = pasta / f"{nome}-grade-{t:g}.png"
    p = subprocess.run([python_com_pillow(), "-c", QUADRO_PY, json.dumps({"png": str(png), "saida": str(saida), "fonte": fonte})], capture_output=True, text=True, encoding="utf-8")
    if p.returncode:
        sair("falhou a grade: " + p.stderr[-300:])
    print(p.stdout.strip().splitlines()[-1])


# ---------------------------------------------------------------- ler (contexto em volta do momento)
def ler(pasta, inicio, fim):
    leg = achar_legenda(pasta)
    if not leg:
        sair("sem transcrição: rode analisar antes")
    fs = [f for f in frases(palavras_json3(leg)) if f["fim"] >= inicio and f["ini"] <= fim]
    for f in fs:
        print(f"[{int(f['ini'] // 60)}:{f['ini'] % 60:05.2f}] ({f['ini']:.1f}-{f['fim']:.1f}) {f['texto']}")
    print(json.dumps({"ok": True, "frases": len(fs)}, ensure_ascii=False))


def ajustar(pasta, inicio, fim):
    """Começo no INÍCIO da frase em que o corte cai; fim no FIM da frase em que ele cai (nunca no meio de uma frase)."""
    leg = achar_legenda(pasta)
    if not leg:
        return inicio, fim
    fs = frases(palavras_json3(leg))
    for f in fs:
        if f["ini"] <= inicio < f["fim"]:
            inicio = f["ini"] - 0.15
            break
    for f in fs:
        if f["ini"] < fim <= f["fim"] + 0.3:
            fim = f["fim"] + 0.4
            break
    return round(max(0, inicio), 2), round(fim, 2)


# ---------------------------------------------------------------- cortar
def cortar(url, pasta, inicio, dur, nome, fim=None, sem_ajuste=False, recorte=None, recorte_camera=None, sem_legenda=False):
    pasta = Path(pasta).resolve()
    pasta.mkdir(parents=True, exist_ok=True)
    fim = fim if fim else inicio + dur
    if not sem_ajuste:
        inicio, fim = ajustar(pasta, inicio, fim)
    dur = round(fim - inicio, 2)
    ff = ffmpeg()
    bruto = pasta / f"{nome}-bruto-{int(inicio * 10)}-{int(fim * 10)}.mp4"
    if not bruto.exists():
        log(f"baixando só o trecho {inicio:.1f}s a {inicio + dur:.1f}s...")
        p = yt(["--download-sections", f"*{inicio}-{inicio + dur}", "--force-keyframes-at-cuts",
                "-f", "bv*[height<=1080][vcodec^=avc1]+ba[ext=m4a]/bv*[height<=1080]+ba/b[height<=1080]/b",
                "--merge-output-format", "mp4", "-o", str(bruto), url])
        if p.returncode or not bruto.exists():
            sair("não consegui baixar o trecho: " + p.stderr[-400:])
    # base vertical 1080x1920: fundo = o próprio vídeo ampliado e desfocado. Dois layouts:
    #  - tela (padrão): o quadro inteiro (ou --recorte) no meio, largura 1080.
    #  - jogo + câmera (--recorte-camera): o JOGO grande em cima (quadro inteiro ou --recorte) e o rosto do streamer
    #    recortado embaixo, com a legenda entre os dois. É o formato de corte de gameplay/reação.
    base = pasta / f"{nome}-base.mp4"
    pr = subprocess.run([str(Path(ff).with_name("ffprobe" + Path(ff).suffix)), "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", str(bruto)], capture_output=True, text=True).stdout.strip().split(",")
    try:
        sw0, sh0 = float(pr[0]), float(pr[1])
    except Exception:  # noqa: BLE001
        sw0, sh0 = 1920.0, 1080.0

    def frac(r):
        x, y, l, a = [float(v) for v in r.split(":")]
        return x, y, l, a

    def crop(r):
        if not r:
            return "", sw0, sh0
        x, y, l, a = frac(r)
        return f"crop=iw*{l}:ih*{a}:iw*{x}:ih*{y},", sw0 * l, sh0 * a

    cj, gw, gh = crop(recorte)
    fundo = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=28:2,eq=brightness=-0.18[f];"
    meta = {"inicio": inicio, "fim": fim, "url": url}
    if recorte_camera:
        vh = min(760, round(1080 * gh / gw))  # jogo
        vw = round(min(1080, 760 * gw / gh))
        vtop = 470
        cc, cw, ch = crop(recorte_camera)
        cam_h = 400
        cam_w = min(900, round(cam_h * cw / ch))
        cam_top = vtop + vh + (50 if sem_legenda else 190)  # espaço da legenda entre jogo e câmera
        filtro = (fundo + f"[0:v]{cj}scale={vw}:{vh}[g];[0:v]{cc}scale={cam_w}:{cam_h}[c];"
                  f"[f][g]overlay=(W-w)/2:{vtop}[t];[t][c]overlay=(W-w)/2:{cam_top},fps=30,format=yuv420p[out]")
        meta.update({"vw": vw, "vh": vh, "vtop": vtop, "cam": {"top": cam_top, "h": cam_h, "w": cam_w}})
    else:
        vh = min(1000, round(1080 * gh / gw))
        vw = round(1080 if 1080 * gh / gw <= 1000 else 1000 * gw / gh)
        vtop = max(480, round((1920 - vh) / 2 - 60))
        filtro = fundo + f"[0:v]{cj}scale={vw}:{vh}[v];[f][v]overlay=(W-w)/2:{vtop},fps=30,format=yuv420p[out]"
        meta.update({"vw": vw, "vh": vh, "vtop": vtop})
    subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(bruto), "-filter_complex", filtro, "-map", "[out]", "-map", "0:a?",
                    "-t", str(dur), "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "aac", "-b:a", "192k", str(base)], check=True)
    (pasta / f"{nome}-meta.json").write_text(json.dumps(meta), encoding="utf-8")
    audio = pasta / f"{nome}-audio.wav"
    subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(base), "-vn", "-ac", "2", "-ar", "48000", "-af", "loudnorm=I=-14:TP=-1.5", str(audio)], check=True)
    leg = achar_legenda(pasta)
    pal = [{"t": round(x["t"] - inicio, 2), "w": x["w"]} for x in (palavras_json3(leg) if leg else []) if inicio <= x["t"] < inicio + dur]
    (pasta / f"legenda-{nome}.json").write_text(json.dumps(pal, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"ok": True, "inicio": inicio, "fim": fim, "duracao": dur, "base": str(base), "audio": str(audio), "legenda": str(pasta / f"legenda-{nome}.json"), "palavras": len(pal),
                      "fala": " ".join(x["w"] for x in pal)[:400]}, ensure_ascii=False))


# ---------------------------------------------------------------- montar (HTML do Motion)
def montar(pasta, nome, titulo, arroba, cor, traduzida, dur, sem_legenda=False):
    pasta = Path(pasta).resolve()
    base = pasta / f"{nome}-base.mp4"
    if not base.exists():
        sair(f"rode 'cortar' antes: {base} não existe")
    try:  # duração real do corte (o cortar encaixa nas frases, então não é sempre 20 s)
        dur = float(subprocess.run([str(Path(ffmpeg()).with_name("ffprobe" + Path(ffmpeg()).suffix)), "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(base)], capture_output=True, text=True).stdout.strip() or dur)
    except Exception:  # noqa: BLE001
        pass
    if traduzida:
        # [{"t": 0.0, "texto": "frase traduzida"}, ...] -> palavras espalhadas no tempo de cada frase
        frases = json.loads(Path(traduzida).read_text(encoding="utf-8"))
        pal = []
        for i, f in enumerate(frases):
            fim = frases[i + 1]["t"] if i + 1 < len(frases) else dur
            ws = f["texto"].split()
            for k, w in enumerate(ws):
                pal.append({"t": round(f["t"] + (fim - f["t"]) * k / max(1, len(ws)), 2), "w": w})
    else:
        pal = json.loads((pasta / f"legenda-{nome}.json").read_text(encoding="utf-8"))
    try:
        meta = json.loads((pasta / f"{nome}-meta.json").read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        meta = {"vw": 1080, "vh": 608}
    if sem_legenda:  # o vídeo já tem legenda própria (cutscene, filme legendado): não duplica
        pal = []
    dados = {"video": base.name, "dur": dur, "vw": meta["vw"], "vh": meta["vh"], "vtop": meta.get("vtop"), "cam": meta.get("cam"), "titulo": titulo, "arroba": arroba or "", "cor": cor or "#ff2d55", "palavras": pal}
    html = MODELO.read_text(encoding="utf-8")
    a, b = html.index("/*DADOS*/"), html.index("/*FIM*/")
    html = html[: a + len("/*DADOS*/")] + json.dumps(dados, ensure_ascii=False) + html[b:]
    arq = pasta / f"{nome}.html"
    arq.write_text(html, encoding="utf-8")
    print(json.dumps({"ok": True, "html": str(arq), "audio": str(pasta / f"{nome}-audio.wav"), "duracao": dur, "saida_sugerida": str(pasta / f"{nome}-tiktok.mp4"),
                      "previa_sugerida": [0.5, round(dur * 0.35, 1), round(dur * 0.7, 1), round(dur - 0.6, 1)]}, ensure_ascii=False))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    a1 = sub.add_parser("analisar")
    a1.add_argument("--url", required=True)
    a1.add_argument("--pasta", required=True)
    a1.add_argument("--duracao", type=float, default=20)
    a1.add_argument("--quantos", type=int, default=8)
    a2 = sub.add_parser("cortar")
    a2.add_argument("--url", required=True)
    a2.add_argument("--pasta", required=True)
    a2.add_argument("--inicio", type=float, required=True)
    a2.add_argument("--duracao", type=float, default=20)
    a2.add_argument("--fim", type=float, help="fim do corte em segundos (melhor que --duracao: escolha lendo as frases)")
    a2.add_argument("--sem-ajuste", action="store_true", help="não encaixar nas bordas das frases")
    a2.add_argument("--recorte", help="x:y:largura:altura em frações do quadro (0 a 1) do conteúdo principal (jogo, filme, rosto)")
    a2.add_argument("--sem-legenda", action="store_true", help="o vídeo já tem legenda na imagem: a câmera sobe para perto do jogo")
    a2.add_argument("--recorte-camera", help="x:y:largura:altura da câmera do streamer: liga o layout jogo em cima + câmera embaixo")
    a2.add_argument("--nome", required=True)
    a5 = sub.add_parser("mapa")
    a5.add_argument("--pasta", required=True)
    a5.add_argument("--inicio", type=float)
    a5.add_argument("--fim", type=float)
    a5.add_argument("--passo", type=float)
    a6 = sub.add_parser("quadro")
    a6.add_argument("--pasta", required=True)
    a6.add_argument("--nome", required=True)
    a6.add_argument("--t", type=float, default=5)
    a4 = sub.add_parser("ler")
    a4.add_argument("--pasta", required=True)
    a4.add_argument("--inicio", type=float, required=True)
    a4.add_argument("--fim", type=float, required=True)
    a3 = sub.add_parser("montar")
    a3.add_argument("--pasta", required=True)
    a3.add_argument("--nome", required=True)
    a3.add_argument("--titulo", required=True)
    a3.add_argument("--arroba", default="")
    a3.add_argument("--cor", default="#ff2d55")
    a3.add_argument("--legenda-traduzida")
    a3.add_argument("--sem-legenda", action="store_true", help="o vídeo já tem legenda na imagem (cutscene, filme legendado)")
    a3.add_argument("--duracao", type=float, default=20)
    sub.add_parser("ferramenta")
    x = ap.parse_args()
    if x.cmd == "analisar":
        analisar(x.url, x.pasta, x.duracao, x.quantos)
    elif x.cmd == "cortar":
        cortar(x.url, x.pasta, x.inicio, x.duracao, x.nome, x.fim, x.sem_ajuste, x.recorte, x.recorte_camera, x.sem_legenda)
    elif x.cmd == "mapa":
        mapa(x.pasta, x.inicio, x.fim, x.passo)
    elif x.cmd == "quadro":
        quadro(x.pasta, x.nome, x.t)
    elif x.cmd == "ler":
        ler(x.pasta, x.inicio, x.fim)
    elif x.cmd == "montar":
        montar(x.pasta, x.nome, x.titulo, x.arroba, x.cor, x.legenda_traduzida, x.duracao, x.sem_legenda)
    else:
        print(json.dumps({"ok": True, "yt_dlp": ytdlp(), "ffmpeg": ffmpeg()}, ensure_ascii=False))
