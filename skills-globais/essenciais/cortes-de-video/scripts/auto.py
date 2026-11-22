"""Cortes AUTOMÁTICOS: a mecânica inteira do Viralizaí rodando no computador do usuário (sem servidor nosso, sem créditos).
A IA usada (juiz e tradução) é a MESMA do app, pela ponte local; a parte pesada (sons, transcrição, rosto) roda no
processador do usuário num ambiente próprio (~/.segundo-cerebro/cortes), montado sozinho na 1ª vez.

    python auto.py auto (--url URL | --arquivo VIDEO) --pasta P [--objetivo viral|reels|tiktok] [--quantos 3] [--arroba @canal]
        FAZ TUDO, como o Viralizaí: sinais -> candidatos -> juiz (IA) -> tradução se não for português -> render.
        Devolve os MP4 prontos, com gancho, legenda do post e hashtags. É o comando padrão.

    python auto.py candidatos (--url URL | --arquivo VIDEO) --pasta P [--objetivo ...] [--quantos 3]
    python auto.py julgar --pasta P [--quantos 3]                 (juiz pela IA do app; grava escolhas.json)
    python auto.py render --pasta P --escolhas escolhas.json [--arroba @canal] [--cor "#ff3d6e"] [--layout auto|rosto|centro|inteiro|cheio]
        [--rede tiktok|instagram|youtube]
        Passos separados, para quando você quer escolher/ajustar à mão. escolhas.json = [{"id": 2, "gancho": "...",
        "legenda_post": "...", "ajuste_inicio": 0, "ajuste_fim": 0, "traducao": ["frase em português", ...]}]

Sinais (Viralizaí 47c): legenda com tempo por palavra (ou Whisper nas janelas candidatas, se não houver), chat da live
(volume, pessoas, risada, choque, Super Chat), mapa de "mais vistos", comentários que citam um tempo, volume e eventos
sonoros (YAMNet: risada, grito, tiro, explosão, sirene, batida), palavras-gatilho e velocidade da fala.
Tudo imprime uma linha JSON no fim."""
import argparse
import glob
import hashlib
import json
import math
import os
import platform
import re
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import cortes as C  # noqa: E402  (yt-dlp e ffmpeg do app, legenda json3)

AQUI = Path(__file__).resolve().parent
FONTE = AQUI.parent / "fontes" / "Montserrat-ExtraBold.ttf"
PESADO = AQUI / "pesado.py"
RAIZ = Path(os.environ.get("SB_CORTES_DIR") or Path.home() / ".segundo-cerebro" / "cortes")
VENV = RAIZ / "venv"
PY_VENV = VENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
PACOTES = ["numpy==2.2.6", "opencv-python-headless==4.12.0.88", "faster-whisper==1.2.1", "onnxruntime==1.22.1"]
OBJETIVOS = {  # (mínimo, máximo, alvo, fração ANTES do clímax)
    "viral": (20, 40, 30, 0.45),
    "reels": (30, 60, 45, 0.60),
    "tiktok": (61, 90, 72, 0.70),
}
OBJETIVO_TXT = {"tiktok": "ganhar no TikTok (61 a 90 s, precisa prender até o fim)", "viral": "viralizar rápido (20 a 40 s)",
                "reels": "Reels/Shorts (até 60 s)"}
RISADA = re.compile(r"(k{3,}|K{3,}|rs(rs)+|(ha){2,}|(he){3,}|lul|kekw|omegalul|😂|🤣|:face_with_tears_of_joy:|:rolling_on_the_floor_laughing:)", re.I)
CHOQUE = re.compile(r"(\?{2,}|wtf|mano+|n[aã]o acredito|clipa|clip it|pog|pogchamp|🔥|😱|:fire:|:scream:|caraca|meu deus|slk|vish|eita)", re.I)
PESOS = {  # Viralizaí 47c §3.2 (sinal ausente = peso redistribuído)
    "gameplay": {"chat": .25, "publico": .25, "voz": .15, "jogo": .15, "imagem": .15, "texto": .05},
    "podcast": {"chat": .25, "publico": .25, "voz": .20, "jogo": 0.0, "imagem": .05, "texto": .25},
    "react": {"chat": .25, "publico": .25, "voz": .25, "jogo": .05, "imagem": .15, "texto": .05},
}
GATILHOS = {
    "gameplay": r"pol[ií]cia|estrela|fugi|explodiu|morri|matei|preso|perseguiç|bati|capotou|roubei|assalto|tiro|banid|treta",
    "podcast": r"pol[eê]mic|nunca contei|verdade|segredo|absurdo|dinheiro|milh|briga|chorei|traiç",
    "react": r"n[aã]o acredito|olha isso|caraca|meu deus|absurdo|que isso",
}
_TEMPO = re.compile(r"(?<![\d:])(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?![\d:])")
W, H = 1080, 1920
REDES = {  # margens em pixels de 1280 de altura (o ASS escala para 1920)
    "tiktok": {"leg_mv": 430, "gancho_mv": 175, "marca_mv": 112, "margem_d": 150, "margem_e": 40},
    "instagram": {"leg_mv": 360, "gancho_mv": 165, "marca_mv": 104, "margem_d": 90, "margem_e": 40},
    "youtube": {"leg_mv": 380, "gancho_mv": 165, "marca_mv": 104, "margem_d": 110, "margem_e": 40},
}
COR_PADRAO = "#ff3d6e"


def log(m):
    print(m, file=sys.stderr, flush=True)


# ---------------------------------------------------------------- ambiente da parte pesada (uma vez por computador)
def _uv():
    exe = "uv.exe" if os.name == "nt" else "uv"
    cands = [os.environ.get("SB_UV"), shutil.which("uv")]
    for b in (os.environ.get("APPDATA", ""), str(Path.home() / ".config"), str(Path.home() / "Library" / "Application Support")):
        for nome in ("SegundoCerebro", "Segundo Cérebro", "segundo-cerebro", "Cérebro Pro"):
            cands += sorted(glob.glob(os.path.join(b, nome, "hermes*", "tools", "uv-*", exe)), reverse=True)
    return next((c for c in cands if c and os.path.isfile(c)), None)


NOSSA = "https://github.com/RangelTech/segundo-cerebro-artefatos/releases/download/cortes-v1/"
RODAS = {
    "win_amd64": ("2f67020f23384bedfdb799705ba413d176c9bf48f0bd395637e6d0b8ad4d2cfa", "cortes-rodas-win_amd64-cp312.zip"),
    "linux_x86_64": ("87ce6463df7d73ffd7d52a00df1af411375279e8807fb94b3eaff018eacbeadf", "cortes-rodas-linux_x86_64-cp312.zip"),
    "macos_arm64": ("754013095e70000101597cf9bfb6cde2782b0dbfd5a6aae0399c69f9132baaaf", "cortes-rodas-macos_arm64-cp312.zip"),
}
WHISPER = ("a59c9d007457a10d6b5f10d9befb7880f8cdcb1afd7eddd6a0680a43d544e28c", "faster-whisper-small.tgz")


def _sistema():
    m = platform.machine().lower()
    if os.name == "nt" and m in ("amd64", "x86_64"):
        return "win_amd64"
    if sys.platform.startswith("linux") and m in ("x86_64", "amd64"):
        return "linux_x86_64"
    if sys.platform == "darwin" and m in ("arm64", "aarch64"):
        return "macos_arm64"
    return sys.platform + "_" + m


def _baixar_conferido(url, destino, sha):
    C._baixar(url, destino)
    h = hashlib.sha256()
    with open(destino, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    if h.hexdigest() != sha:
        Path(destino).unlink(missing_ok=True)
        raise RuntimeError("sha256 não confere")


def modelo_whisper():
    """faster-whisper small (int8) da NOSSA release, uma vez por computador; sem ela o pesado.py baixa da origem (Hugging Face)."""
    alvo = RAIZ / "modelos" / "faster-whisper-small"
    if (alvo / "model.bin").exists():
        return
    tgz = RAIZ / "modelos" / WHISPER[1]
    try:
        alvo.parent.mkdir(parents=True, exist_ok=True)
        log("baixando o modelo de transcrição (só na 1ª vez, ~450 MB)...")
        _baixar_conferido(NOSSA + WHISPER[1], tgz, WHISPER[0])
        with tarfile.open(tgz) as t:
            t.extractall(alvo.parent)
    except Exception as e:  # noqa: BLE001
        log(f"modelo nosso falhou ({e}); vai da origem")
    finally:
        tgz.unlink(missing_ok=True)


_AMBIENTE = {}


def ambiente():
    """Python do ambiente pesado (numpy, OpenCV, faster-whisper, onnxruntime) ou None se não deu para montar (aí o motor
    segue só com o que não precisa dele: volume pelo ffmpeg, sem eventos sonoros, sem Whisper, sem rosto)."""
    if "py" in _AMBIENTE:
        return _AMBIENTE["py"]
    env = dict(os.environ, SB_FFMPEG=C.ffmpeg())
    ok = lambda: PY_VENV.exists() and subprocess.run([str(PY_VENV), str(PESADO), "conferir"], capture_output=True, env=env).returncode == 0  # noqa: E731
    if not ok():
        try:
            log("preparando o motor de cortes neste computador (só na 1ª vez, ~2 min)...")
            RAIZ.mkdir(parents=True, exist_ok=True)
            uv = _uv()
            if not PY_VENV.exists():
                if uv:
                    subprocess.run([uv, "venv", "--python", "3.12", "--seed", str(VENV)], check=True, stdout=sys.stderr, stderr=sys.stderr)
                else:
                    subprocess.run([sys.executable, "-m", "venv", str(VENV)], check=True, stdout=sys.stderr, stderr=sys.stderr)
            pip = [uv, "pip", "install", "--python", str(PY_VENV)] if uv else [str(PY_VENV), "-m", "pip", "install", "-q"]
            feito = False
            sha, nome = RODAS.get(_sistema(), ("", ""))
            if sha:  # pacote NOSSO (release cortes-v1, sha256 conferido); a internet (PyPI) é só a reserva
                zipf = RAIZ / nome
                try:
                    log(f"baixando {nome} (pacote nosso)...")
                    _baixar_conferido(NOSSA + nome, zipf, sha)
                    pasta = RAIZ / "rodas"
                    shutil.rmtree(pasta, ignore_errors=True)
                    with zipfile.ZipFile(zipf) as z:
                        z.extractall(pasta)
                    subprocess.run(pip + ["--no-index", "--find-links", str(pasta), "-r", str(pasta / "requisitos.txt")], check=True,
                                   stdout=sys.stderr, stderr=sys.stderr)
                    shutil.rmtree(pasta, ignore_errors=True)
                    feito = True
                except Exception as e:  # noqa: BLE001
                    log(f"pacote nosso falhou ({e}); usando a internet")
                finally:
                    zipf.unlink(missing_ok=True)
            if not feito:
                subprocess.run(pip + PACOTES, check=True, stdout=sys.stderr, stderr=sys.stderr)
        except Exception as e:  # noqa: BLE001
            log(f"não consegui montar o motor pesado ({e}); sigo sem eventos sonoros, Whisper e rosto")
    _AMBIENTE["py"] = str(PY_VENV) if ok() else None
    return _AMBIENTE["py"]


def pesado(*args, timeout=7200):
    py = ambiente()
    if not py:
        raise RuntimeError("motor pesado indisponível")
    r = subprocess.run([py, str(PESADO), *map(str, args)], capture_output=True, text=True, encoding="utf-8", errors="replace",
                       timeout=timeout, env=dict(os.environ, SB_FFMPEG=C.ffmpeg()))
    if r.returncode:
        raise RuntimeError(r.stderr[-400:])
    linha = [x for x in r.stdout.splitlines() if x.strip().startswith("{")][-1]
    j = json.loads(linha)
    if j.get("json"):
        return json.loads(Path(j["json"]).read_text(encoding="utf-8"))
    return j


# ---------------------------------------------------------------- a IA do app (mesma do chat), pela ponte local
def _ponte():
    cands = [os.environ.get("SB_PONTE_ARQ")]
    for b in (os.environ.get("SB_DATA_DIR"), os.path.join(os.environ.get("APPDATA", ""), "SegundoCerebro"),
              str(Path.home() / "Library" / "Application Support" / "SegundoCerebro"), str(Path.home() / ".config" / "SegundoCerebro")):
        if b:
            cands.append(os.path.join(b, "ponte-app.json"))
    for c in cands:
        if c and os.path.isfile(c):
            return json.loads(Path(c).read_text(encoding="utf-8"))
    raise RuntimeError("o Cérebro Pro precisa estar aberto (pode ser só na bandeja)")


def ia(prompt, max_tokens=6000, json_=True, limite=300):
    p = _ponte()
    corpo = json.dumps({"nome": "llm_texto", "args": {"prompt": prompt, "max_tokens": max_tokens, "json": json_, "limite_s": limite}}).encode()
    req = urllib.request.Request(p["url"], data=corpo, method="POST", headers={"Content-Type": "application/json", "Authorization": "Bearer " + p["token"]})
    with urllib.request.urlopen(req, timeout=limite + 30) as r:
        j = json.loads(r.read())
    if not j.get("ok"):
        raise RuntimeError(j.get("erro") or "a IA não respondeu")
    return j.get("texto") or ""


def ler_json(txt):
    """JSON da resposta da IA, com reparo leve (Viralizaí juiz._json)."""
    txt = re.sub(r"<think>.*?</think>", "", txt or "", flags=re.S)
    m = re.search(r"\{.*\}", txt, re.S)
    if not m:
        raise ValueError("sem JSON")
    bruto = m.group(0)
    try:
        return json.loads(bruto)
    except ValueError:
        pass
    s = re.sub(r",\s*([}\]])", r"\1", bruto).replace("“", "'").replace("”", "'")
    try:
        return json.loads(s, strict=False)
    except ValueError:
        itens = []
        for o in re.findall(r"\{[^{}]*\}", bruto):
            try:
                itens.append(json.loads(o, strict=False))
            except ValueError:
                continue
        if not itens:
            raise
        return {"cortes": itens}


# ---------------------------------------------------------------- séries (Python puro: roda com qualquer Python)
def mediana(v):
    s = sorted(v)
    n = len(s)
    return 0.0 if not n else (s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2)


def pct(v, p):
    s = sorted(v)
    if not s:
        return 0.0
    k = (len(s) - 1) * p / 100
    a, b = int(math.floor(k)), int(math.ceil(k))
    return s[a] + (s[b] - s[a]) * (k - a)


def robusto(x):
    if not x or not any(x):
        return [0.0] * len(x)
    med = mediana(x)
    mad = mediana([abs(v - med) for v in x]) * 1.4826
    if mad < 1e-6:
        m = sum(x) / len(x)
        mad = math.sqrt(sum((v - m) ** 2 for v in x) / len(x)) or 1.0
    return [min(6.0, max(0.0, (v - med) / mad)) for v in x]


def suavizar(x, j=5):
    n = len(x)
    if n < j:
        return list(x)
    acc = [0.0]
    for v in x:
        acc.append(acc[-1] + v)
    h = j // 2
    return [(acc[min(n, i + h + 1)] - acc[max(0, i - h)]) / j for i in range(n)]


def soma(*vs):
    return [sum(t) for t in zip(*vs)]


def esc(k, v):
    return [k * x for x in v]


def ajustar(v, dur, enche=0.0):
    return (list(v) + [enche] * dur)[:dur]


# ---------------------------------------------------------------- coleta
def tipo_do_video(ctx):
    txt = " ".join([ctx.get("titulo", ""), " ".join(ctx.get("categorias") or []), " ".join(ctx.get("tags") or [])]).lower()
    if re.search(r"\breact|reagindo|rea[cç][aã]o|reagi\b", txt):
        return "react"
    if "gaming" in txt or re.search(r"gta|rp\b|minecraft|fortnite|free fire|cs2|valorant|gameplay|jogando|live", txt):
        return "gameplay"
    return "podcast"


def contexto(i):
    return {"titulo": i.get("title") or "vídeo", "canal": i.get("uploader") or i.get("channel") or "", "duracao": float(i.get("duration") or 0),
            "views": int(i.get("view_count") or 0), "categorias": i.get("categories") or [], "tags": (i.get("tags") or [])[:30],
            "ao_vivo": bool(i.get("is_live")), "url": i.get("webpage_url") or i.get("original_url") or "", "lingua": i.get("language"),
            "heatmap": [{"a": float(h["start_time"]), "b": float(h["end_time"]), "v": float(h["value"])} for h in i.get("heatmap") or []],
            "capitulos": [{"a": float(c["start_time"]), "b": float(c["end_time"])} for c in i.get("chapters") or []],
            "tem_chat": "live_chat" in (i.get("subtitles") or {})}


def ler_chat(pasta, url):
    C.yt(["--skip-download", "--write-subs", "--sub-langs", "live_chat", "-o", str(pasta / "chat.%(ext)s"), url], timeout=2400)
    arq = next(iter(pasta.glob("chat*.live_chat.json")), None)
    out = []
    if not arq:
        return out
    for linha in arq.read_text(encoding="utf-8", errors="replace").splitlines():
        try:
            a = json.loads(linha)["replayChatItemAction"]
            t = int(a.get("videoOffsetTimeMsec", 0)) / 1000
            for ac in a.get("actions", []):
                it = (ac.get("addChatItemAction") or {}).get("item", {})
                pago = "liveChatPaidMessageRenderer" in it
                r = it.get("liveChatTextMessageRenderer") or it.get("liveChatPaidMessageRenderer")
                if r:
                    txt = "".join(x.get("text", "") or (x.get("emoji", {}).get("shortcuts") or [""])[0] for x in r.get("message", {}).get("runs", []))
                    out.append({"t": t, "texto": txt, "autor": r.get("authorExternalChannelId") or (r.get("authorName") or {}).get("simpleText"), "pago": pago})
        except Exception:  # noqa: BLE001
            continue
    return out


def ler_comentarios(url, dur, maximo=300):
    """Comentários mais curtidos que apontam um momento ("12:34 kkkk"). Peso = curtidas + 1."""
    p = C.yt(["-J", "--skip-download", "--write-comments", "--extractor-args", f"youtube:max_comments={maximo},all,0;comment_sort=top", url], timeout=600)
    if p.returncode:
        return []
    out = []
    for c in json.loads(p.stdout).get("comments") or []:
        txt = c.get("text") or ""
        for m in _TEMPO.finditer(txt):
            h, mi, s = int(m.group(1) or 0), int(m.group(2)), int(m.group(3))
            if s >= 60 or (m.group(1) and mi >= 60):
                continue
            t = h * 3600 + mi * 60 + s
            if 0 < t < dur:
                out.append({"t": float(t), "peso": 1 + int(c.get("like_count") or 0)})
    return out


def baixar_audio(pasta, url):
    C.yt(["-f", "worstaudio[abr>=40]/worstaudio/bestaudio", "-o", str(pasta / "audio.%(ext)s"), url], timeout=2400)
    arq = next((p for p in pasta.glob("audio.*") if p.suffix not in (".part", ".ytdl", ".txt", ".json")), None)
    if not arq:
        raise RuntimeError("o áudio não baixou")
    return arq


def audio_simples(arq, pasta):
    """Sem o motor pesado: volume por segundo e silêncios pelo próprio ffmpeg."""
    r = subprocess.run([C.ffmpeg(), "-v", "info", "-nostats", "-i", str(arq), "-vn", "-af",
                        "aresample=8000,asetnsamples=n=8000:p=0,astats=metadata=1:reset=1,"
                        "ametadata=print:key=lavfi.astats.Overall.RMS_level:file=audio-rms.txt,silencedetect=n=-45dB:d=0.25",
                        "-f", "null", "-"], cwd=str(pasta), capture_output=True, text=True, encoding="utf-8", errors="replace")
    db = []
    rms = pasta / "audio-rms.txt"
    for linha in rms.read_text(encoding="utf-8", errors="replace").splitlines() if rms.exists() else []:
        if "RMS_level=" in linha:
            v = linha.split("=", 1)[1].strip()
            db.append(-90.0 if v in ("-inf", "inf", "nan") else max(-90.0, float(v)))
    sil, a = [], None
    for linha in r.stderr.splitlines():
        m = re.search(r"silence_start: ([\d.]+)", linha)
        if m:
            a = float(m.group(1))
        m = re.search(r"silence_end: ([\d.]+)", linha)
        if m and a is not None:
            sil.append((a, float(m.group(1))))
            a = None
    if not db:
        raise RuntimeError("não consegui medir o áudio")
    return {"db": db, "eventos": {}, "silencios": sil}


def analisar_audio(arq, pasta):
    try:
        return pesado("audio", "--arquivo", arq, "--json", pasta / "audio-sinais.json")
    except Exception as e:  # noqa: BLE001
        log(f"análise completa do áudio falhou ({str(e)[:160]}); uso só o volume")
        return audio_simples(arq, pasta)


def palavras_legenda(pasta):
    leg = C.achar_legenda(pasta)
    if not leg:
        return [], None
    ws = C.palavras_json3(leg)
    out = []
    for i, w in enumerate(ws):
        prox = ws[i + 1]["t"] if i + 1 < len(ws) else w["t"] + 0.5
        out.append({"start": w["t"], "end": round(min(prox, w["t"] + 0.8), 2), "word": w["w"]})
    m = re.search(r"\.([a-zA-Z]{2})[a-zA-Z-]*\.json3$", leg.name)
    return out, (m.group(1).lower() if m else None)


def frases(ws, pausa=0.7, max_s=12.0):
    out, atual = [], []
    for i, w in enumerate(ws):
        atual.append(w)
        prox = ws[i + 1] if i + 1 < len(ws) else None
        if not prox or prox["start"] - w["end"] > pausa or re.search(r"[.?!…]\"?$", w["word"]) or w["end"] - atual[0]["start"] > max_s:
            out.append({"start": atual[0]["start"], "end": atual[-1]["end"], "text": " ".join(x["word"] for x in atual)})
            atual = []
    return out


# ---------------------------------------------------------------- nota por segundo (Viralizaí sinais.py)
def linha_do_tempo(ctx, dur, ws, chat, coment, aud):
    tipo = tipo_do_video(ctx)
    pesos = dict(PESOS[tipo])
    comp, ch = {}, None
    if chat:
        vol, ris, cho, pago = ([0.0] * dur for _ in range(4))
        autores = {}
        for m in chat:
            t = int(max(0, m["t"] - 6))  # o chat reage DEPOIS: desloca para trás
            if t >= dur:
                continue
            vol[t] += 1
            autores.setdefault(t, set()).add(m.get("autor"))
            ris[t] += 1 if RISADA.search(m["texto"]) else 0
            cho[t] += 1 if CHOQUE.search(m["texto"]) else 0
            pago[t] += 1 if m.get("pago") else 0
        unicos = [0.0] * dur
        for t, s in autores.items():
            unicos[t] = len(s)
        ch = {"vol": vol, "risada": ris, "choque": cho, "pago": pago}
        if sum(vol) >= max(30, dur / 120):
            comp["chat"] = suavizar(soma(robusto(unicos), esc(1.5, robusto(ris)), esc(1.5, robusto(cho)), [2 * min(p, 2) for p in pago]), 5)
    s, tem = [0.0] * dur, False
    abertura = 120 if dur > 600 else 0  # o começo sempre "é revisto"
    for h in ctx.get("heatmap") or []:
        a, b = max(int(h["a"]), abertura), min(dur, int(h["b"]) + 1)
        for i in range(a, b):
            s[i] = max(s[i], h["v"])
            tem = True
    if coment:
        c = [0.0] * dur
        for x in coment:
            t = int(x["t"])
            for i in range(max(0, t - 5), min(dur, t + 15)):  # quem cita o tempo aponta o começo do momento
                c[i] += math.log1p(x["peso"])
        mc = max(c) or 1
        s = [a + b / mc for a, b in zip(s, c)]
        tem = True
    if tem:
        comp["publico"] = suavizar(s, 5)
    if aud and aud.get("db"):
        db = ajustar(aud["db"], dur, min(aud["db"]))
        ev = {g: ajustar(v, dur) for g, v in (aud.get("eventos") or {}).items()}
        voz = robusto(db)
        if ev.get("risada"):
            voz = soma(voz, esc(3, robusto(ev["risada"])), esc(3, robusto(ev["grito"])))
        comp["voz"] = suavizar(voz, 3)
        if ev.get("tiro") and pesos["jogo"]:
            comp["jogo"] = suavizar(soma(robusto(ev["tiro"]), robusto(ev["explosao"]), esc(0.6, robusto(ev["sirene"])), robusto(ev["batida"])), 5)
    if ws:
        gat, vel = [0.0] * dur, [0.0] * dur
        rx = re.compile(GATILHOS[tipo], re.I)
        for w in ws:
            t = int(w["start"])
            if t < dur:
                vel[t] += 1
                gat[t] += 1 if rx.search(w["word"]) else 0
        comp["texto"] = suavizar(soma(esc(2, gat), robusto(suavizar(vel, 5))), 5)
    usados = {k: pesos[k] for k in comp if pesos.get(k)}
    total = sum(usados.values()) or 1
    nota = [0.0] * dur
    for k, w in usados.items():
        v = comp[k]
        m = pct(v, 99.5) or 1
        nota = [n + (w / total) * min(1.0, max(0.0, x / m)) for n, x in zip(nota, v)]
    return {"tipo": tipo, "nota": suavizar(nota, 3), "comp": comp, "pesos": usados, "chat": ch, "aud": aud}


def resumo_sinais(lt, a, b):
    ia_, ib = int(a), int(b)
    partes = []
    ch = lt.get("chat")
    if ch and "chat" in lt["comp"] and ib > ia_:
        base = max(0.05, sum(ch["vol"]) / len(ch["vol"]))
        pico = sum(ch["vol"][ia_:ib]) / (ib - ia_)
        if pico / base >= 1.8:
            partes.append(f"chat {pico / base:.0f}x o normal")
        r = int(sum(ch["risada"][ia_:ib]))
        if r >= 3:
            partes.append(f"{r} risadas no chat")
        c = int(sum(ch["choque"][ia_:ib]))
        if c >= 3:
            partes.append(f"{c} reações de choque no chat")
        if sum(ch["pago"][ia_:ib]):
            partes.append("doação/Super Chat no trecho")
    v = lt["comp"].get("publico")
    if v and ib > ia_ and max(v[ia_:ib]) >= pct(v, 90):
        partes.append("o público reviu muito esse trecho")
    ev = (lt.get("aud") or {}).get("eventos") or {}
    nomes = {"risada": "risada alta", "grito": "grito", "tiro": "tiros", "explosao": "explosão", "sirene": "sirene de polícia", "batida": "batida/derrapagem"}
    for g, nome in nomes.items():
        vv = ev.get(g)
        if vv and ib > ia_:
            trecho = vv[ia_:ib]
            if trecho and max(trecho) >= 0.35:
                partes.append(f"{nome} aos {trecho.index(max(trecho))}s")
    v = lt["comp"].get("voz")
    if v and ib > ia_ and max(v[ia_:ib]) >= pct(v, 97):
        partes.append("voz bem empolgada")
    return ", ".join(partes[:6]) or "fala contínua"


# ---------------------------------------------------------------- candidatos (Viralizaí candidatos.py)
def picos(nota, n, raio, minimo_pct=75):
    if not nota:
        return []
    piso = pct(nota, minimo_pct)
    v = list(nota)
    out = []
    while len(out) < n:
        i = max(range(len(v)), key=v.__getitem__)
        if v[i] <= piso or v[i] <= 0:
            break
        out.append(i)
        for k in range(max(0, i - raio), min(len(v), i + raio)):
            v[k] = -1
    return out


def fim_da_reacao(nota, p, limite):
    med = mediana(nota)
    base = med + 0.25 * (nota[p] - med)
    calmo = 0
    for t in range(p + 1, min(len(nota), p + limite)):
        calmo = calmo + 1 if nota[t] <= base else 0
        if calmo >= 3:
            return t
    return min(len(nota) - 1, p + limite)


def no_silencio(t, sil, folga):
    perto = [(a, b) for a, b in sil if abs((a + b) / 2 - t) <= folga]
    if not perto:
        return t
    a, b = min(perto, key=lambda x: abs((x[0] + x[1]) / 2 - t))
    return (a + b) / 2


def encaixar_inicio(t, segs, sil, folga=6.0):
    if not segs:
        return no_silencio(t, sil, folga)
    opcoes = [k for k, s in enumerate(segs) if t - folga <= s["start"] <= t + 1.5]
    if not opcoes:
        antes = [s for s in segs if s["start"] <= t]
        return antes[-1]["start"] if antes else segs[0]["start"]
    pausa = lambda k: segs[k]["start"] - segs[k - 1]["end"] if k else 9.0  # noqa: E731
    k = max(opcoes, key=lambda k: (min(pausa(k), 2.0), -abs(segs[k]["start"] - t)))
    return max(0.0, segs[k]["start"] - 0.15)


def encaixar_fim(t, segs, sil, folga=8.0):
    if not segs:
        return no_silencio(t, sil, folga)
    opcoes = [k for k, s in enumerate(segs) if t - 1.5 <= s["end"] <= t + folga]
    if not opcoes:
        depois = [s for s in segs if s["end"] >= t]
        return depois[0]["end"] if depois else segs[-1]["end"]
    pausa = lambda k: segs[k + 1]["start"] - segs[k]["end"] if k + 1 < len(segs) else 9.0  # noqa: E731
    k = max(opcoes, key=lambda k: (min(pausa(k), 2.0), -abs(segs[k]["end"] - t)))
    return segs[k]["end"] + 0.25


def gerar(nota, segs, sil, quantos, objetivo, capitulos=None):
    mn, mx, alvo, antes = OBJETIVOS[objetivo]
    dur = len(nota)
    out = []
    for p in picos(nota, max(3, quantos * 3), raio=int(mx * 0.8)):
        fim = fim_da_reacao(nota, p, int(mx * 0.45)) + 2
        ini = min(fim - alvo, p - alvo * antes * 0.6)
        if capitulos:
            cap = next((c for c in capitulos if c["a"] <= p < c["b"]), None)
            if cap and ini < cap["a"] and p - cap["a"] >= mn * 0.5:
                ini = cap["a"]
        ini = encaixar_inicio(max(0.0, ini), segs, sil)
        fim = encaixar_fim(max(fim, ini + mn), segs, sil)
        if fim - ini > mx:
            ini = encaixar_inicio(fim - mx + 4, segs, sil, folga=3)
            if fim - ini > mx:
                ini = fim - mx
        if fim - ini < mn:
            fim = encaixar_fim(ini + mn, segs, sil)
        fim = min(fim, dur)
        if fim - ini < mn * 0.85:
            continue
        if any(not (fim <= o["inicio"] or ini >= o["fim"]) for o in out):
            continue
        out.append({"inicio": round(ini, 2), "fim": round(fim, 2), "pico": p, "nota_sinal": round(nota[p], 3)})
    return out


def mmss(t):
    t = int(t)
    return f"{t // 3600}:{t % 3600 // 60:02d}:{t % 60:02d}" if t >= 3600 else f"{t // 60}:{t % 60:02d}"


def duracao_arquivo(arq):
    j = probe(arq, "format=duration")
    return float((j.get("format") or {}).get("duration") or 0)


def candidatos(pasta, objetivo, quantos, url=None, arquivo=None, imprimir=True):
    t0 = time.time()
    pasta = Path(pasta).resolve()
    pasta.mkdir(parents=True, exist_ok=True)
    if arquivo:
        arquivo = str(Path(arquivo).resolve())
        if not os.path.isfile(arquivo):
            C.sair(f"arquivo não encontrado: {arquivo}")
        ctx = {"titulo": Path(arquivo).stem, "canal": "", "duracao": duracao_arquivo(arquivo), "views": 0, "categorias": [], "tags": [],
               "ao_vivo": False, "url": "", "heatmap": [], "capitulos": [], "tem_chat": False, "lingua": None}
    else:
        log("lendo as informações do vídeo...")
        p = C.yt(["-J", "--skip-download", url])
        if p.returncode:
            C.sair("não consegui ler o vídeo: " + p.stderr[-400:])
        ctx = contexto(json.loads(p.stdout))
        if ctx["ao_vivo"]:
            C.sair("essa live está acontecendo agora: mande o link quando ela terminar")
    dur = int(ctx["duracao"]) + 1
    mn = OBJETIVOS[objetivo][0]
    if dur < mn * 1.5:
        C.sair(f"vídeo curto demais para corte de {mn} s ou mais (tem {dur} s)")
    res, erros = {}, {}

    def legenda():
        if url:
            C.yt(["--skip-download", "--write-auto-subs", "--write-subs", "--sub-langs", "pt-orig,pt,pt-BR,en-orig,en,es-orig", "--sub-format", "json3",
                  "-o", str(pasta / "dados.%(ext)s"), url])
            res["palavras"], res["lingua"] = palavras_legenda(pasta)

    def chat():
        res["chat"] = ler_chat(pasta, url) if url and ctx["tem_chat"] else []

    def coments():
        res["coment"] = ler_comentarios(url, dur) if url and ctx["views"] >= 5000 and dur >= 300 else []

    def som():
        arq = arquivo or str(baixar_audio(pasta, url))
        res["arq_audio"] = arq
        res["audio"] = analisar_audio(arq, pasta)

    log("ouvindo o vídeo, lendo a legenda, o chat e os comentários (sem baixar o vídeo)...")
    ambiente()  # monta antes das threads (1ª vez)
    with ThreadPoolExecutor(4) as ex:
        fut = {"legenda": ex.submit(legenda), "chat": ex.submit(chat), "comentarios": ex.submit(coments), "audio": ex.submit(som)}
        for nome, f in fut.items():
            try:
                f.result()
            except Exception as e:  # noqa: BLE001  sinal com problema é pulado
                erros[nome] = str(e)[:200]
    ws, chat_, coment, aud = res.get("palavras") or [], res.get("chat") or [], res.get("coment") or [], res.get("audio")
    if not ws and not aud and not ctx["heatmap"]:
        C.sair("não consegui nem a legenda nem o áudio: " + json.dumps(erros, ensure_ascii=False))
    lingua = res.get("lingua") or (ctx.get("lingua") or "")[:2].lower() or None
    sil = (aud or {}).get("silencios") or []
    segs = frases(ws)
    lt = linha_do_tempo(ctx, dur, ws, chat_, coment, aud)
    n_cand = max(6, min(15, quantos * 3))
    cands = gerar(lt["nota"], segs, sil, n_cand, objetivo, ctx["capitulos"])[:n_cand]
    if not ws and cands and res.get("arq_audio"):  # sem legenda: Whisper SÓ nas janelas candidatas (Viralizaí)
        log("transcrevendo os melhores momentos neste computador...")
        try:
            modelo_whisper()
            janelas = [[max(0, c["inicio"] - 15), c["fim"] + 15] for c in cands]
            (pasta / "janelas.json").write_text(json.dumps(janelas))
            tr = pesado("transcrever", "--arquivo", res["arq_audio"], "--janelas", pasta / "janelas.json", "--json", pasta / "whisper.json",
                        *(["--lingua", lingua] if lingua else []))
            ws, lingua = tr["palavras"], lingua or tr.get("lingua")
            segs = frases(ws)
            lt = linha_do_tempo(ctx, dur, ws, chat_, coment, aud)
            cands = gerar(lt["nota"], segs, sil, n_cand, objetivo, ctx["capitulos"])[:n_cand]
        except Exception as e:  # noqa: BLE001
            erros["whisper"] = str(e)[:200]
    if not cands:
        C.sair("não achei momentos fortes nesse vídeo; tente outro vídeo ou uma live mais longa")
    lingua = (lingua or "pt")[:2].lower()
    for k, c in enumerate(cands, 1):
        c["id"] = k
        c["sinais"] = resumo_sinais(lt, c["inicio"], c["fim"])
        fs = [s for s in segs if s["end"] > c["inicio"] and s["start"] < c["fim"]]
        c["fala"] = " ".join(s["text"] for s in fs)[:900] or "(sem fala)"
    base = {"url": url, "arquivo": arquivo, "objetivo": objetivo, "lingua": lingua, "tipo": lt["tipo"], "duracao": dur,
            "titulo": ctx["titulo"], "canal": ctx["canal"], "silencios": sil, "frases": segs, "palavras": ws, "candidatos": cands,
            "sinais_usados": sorted(lt["pesos"]), "erros": erros}
    (pasta / "candidatos.json").write_text(json.dumps(base, ensure_ascii=False), encoding="utf-8")
    resumo = {"ok": True, "titulo": ctx["titulo"], "canal": ctx["canal"], "tipo": lt["tipo"], "lingua": lingua, "sinais_usados": sorted(lt["pesos"]),
              "eventos_sonoros": bool((aud or {}).get("eventos")), "mensagens_chat": len(chat_), "comentarios_com_tempo": len(coment),
              "palavras": len(ws), "erros": erros, "segundos": round(time.time() - t0),
              "candidatos": [{k: c[k] for k in ("id", "inicio", "fim", "sinais", "fala")} for c in cands]}
    if imprimir:
        print(json.dumps(resumo | {"proximo": "auto.py julgar --pasta P (ou escreva escolhas.json) e depois auto.py render"}, ensure_ascii=False))
    return base, resumo


# ---------------------------------------------------------------- juiz (Viralizaí juiz.py): UMA chamada à IA do app
PROMPT_JUIZ = """Você é o editor-chefe de um canal de cortes virais (TikTok, Reels, Shorts) em português do Brasil.
Vídeo: "{titulo}" ({canal}). Tipo: {tipo}. Objetivo dos cortes: {objetivo}.

Abaixo vêm {n} trechos candidatos. Para cada um: o tempo, o que os SINAIS mostram (chat, público, áudio) e a fala transcrita
(legenda automática, pode ter erros e não tem pontuação).

Dê a cada candidato:
- "nota" de 0 a 100: potencial de viralizar (gancho forte, história que se entende sozinha, reação, humor, ação, polêmica).
  Seja exigente: abertura de live, conversa morta, "fala galera", pedido de inscrito e trecho confuso ficam abaixo de 40.
- "porque": explicação curta para o cliente (até 90 letras), citando o sinal mais forte. Ex.: "chat explodiu + risada alta na fuga da polícia".
- "sozinho": true se dá para entender sem ver o resto do vídeo.
- "ajuste_inicio" e "ajuste_fim": segundos para mexer nas bordas (negativo = antes), entre -10 e 10; 0 se estiver bom.
- "gancho": texto do topo do vídeo, até 8 palavras, MAIÚSCULAS, que faça a pessoa parar de rolar (sem mentir sobre o trecho).
- "titulo": até 60 letras. Sem emoji em gancho, titulo e porque.
- "legenda": legenda do post, até 150 letras, com chamada para comentar e crédito ao canal original ({canal}).
- "hashtags": 4.
- "assunto": 2 a 4 palavras do assunto (para não escolher dois cortes iguais).

Responda SÓ com JSON: {{"cortes": [{{"id": 1, "nota": 0, "porque": "", "sozinho": true, "ajuste_inicio": 0, "ajuste_fim": 0,
"gancho": "", "titulo": "", "legenda": "", "hashtags": [], "assunto": ""}}]}}

Candidatos:
{candidatos}"""


def _lim(v):
    try:
        return max(-10.0, min(10.0, float(v or 0)))
    except (TypeError, ValueError):
        return 0.0


def julgar(base, quantos):
    cands = base["candidatos"]
    segs = base["frases"]
    linhas = []
    for c in cands:
        fala = " ".join(s["text"] for s in segs if s["end"] > c["inicio"] and s["start"] < c["fim"])
        fala = fala[:900] + ("…" if len(fala) > 900 else "")
        linhas.append(f"#{c['id']} [{mmss(c['inicio'])} a {mmss(c['fim'])}, {c['fim'] - c['inicio']:.0f}s] SINAIS: {c['sinais']}\nFALA: {fala or '(sem fala)'}")
    prompt = PROMPT_JUIZ.format(titulo=base["titulo"], canal=base["canal"] or "canal original", tipo=base["tipo"],
                                objetivo=OBJETIVO_TXT.get(base["objetivo"], base["objetivo"]), n=len(cands), candidatos="\n\n".join(linhas))
    respostas = {}
    for _ in range(2):
        try:
            j = ler_json(ia(prompt, 6000))
            for k, x in enumerate(j.get("cortes") or [], 1):
                if isinstance(x, dict):
                    m = re.search(r"\d+", str(x.get("id") or ""))
                    respostas[int(m.group(0)) if m else k] = x
            if respostas:
                break
        except Exception as e:  # noqa: BLE001
            log(f"juiz falhou: {str(e)[:200]}")
    out = []
    for c in cands:
        x = respostas.get(c["id"])
        if x:
            try:
                nota = max(0, min(100, int(float(x.get("nota") or 0))))
            except (TypeError, ValueError):
                nota = 50
            tags = x.get("hashtags") or []
            if isinstance(tags, str):
                tags = re.findall(r"#?\w+", tags)
            d = {"nota": nota, "porque": str(x.get("porque") or c["sinais"])[:120], "sozinho": bool(x.get("sozinho", True)),
                 "ajuste_inicio": _lim(x.get("ajuste_inicio")), "ajuste_fim": _lim(x.get("ajuste_fim")),
                 "gancho": str(x.get("gancho") or "").upper()[:60], "titulo": str(x.get("titulo") or "")[:80],
                 "legenda": str(x.get("legenda") or "")[:600], "assunto": str(x.get("assunto") or "")[:40],
                 "hashtags": [("#" + str(t).lstrip("#"))[:30] for t in tags][:6], "juiz": True}
        else:  # sem IA: nota pelos sinais, textos neutros (o pedido nunca cai por causa do juiz)
            d = {"nota": int(40 + 50 * min(1.0, c.get("nota_sinal", 0))), "porque": c["sinais"][:120], "sozinho": True, "ajuste_inicio": 0,
                 "ajuste_fim": 0, "gancho": "", "titulo": base["titulo"][:60], "assunto": "", "legenda": f"Créditos: {base['canal']}",
                 "hashtags": [], "juiz": False}
        if not d["sozinho"]:
            d["nota"] = max(0, d["nota"] - 15)
        out.append({"id": c["id"], **d})
    out.sort(key=lambda c: -c["nota"])
    escolhidos, assuntos = [], set()  # os melhores sem repetir assunto
    for c in out:
        a = re.sub(r"\W+", " ", c.get("assunto", "").lower()).strip()
        if a and a in assuntos:
            continue
        escolhidos.append(c)
        if a:
            assuntos.add(a)
        if len(escolhidos) >= quantos:
            break
    if len(escolhidos) < quantos:
        escolhidos += [c for c in out if c not in escolhidos][:quantos - len(escolhidos)]
    for c in escolhidos:
        c["legenda_post"] = (c["legenda"] + " " + " ".join(c["hashtags"])).strip()
    return escolhidos


# ---------------------------------------------------------------- tradução (Viralizaí traduz.py)
def frases_curtas(ws):
    out, atual = [], []
    for k, w in enumerate(ws):
        if not str(w["word"]).strip():
            continue
        atual.append(w)
        prox = ws[k + 1] if k + 1 < len(ws) else None
        if re.search(r"[.!?]$", str(w["word"]).strip()) or len(atual) >= 12 or not prox or prox["start"] - w["end"] > 0.6:
            out.append(atual)
            atual = []
    if atual:
        out.append(atual)
    return out


def _pedir_traducao(textos, lingua):
    prompt = ("Traduza cada frase abaixo (fala de vídeo em '" + lingua + "') para português do Brasil, do jeito que um brasileiro falaria, "
              "curto, natural, mantendo gíria e emoção. Não explique nada. Responda só JSON {\"t\": [...]} com EXATAMENTE "
              f"{len(textos)} frases, na mesma ordem.\n\n" + "\n".join(f"{i + 1}. {t}" for i, t in enumerate(textos)))
    for _ in range(2):
        try:
            t = ler_json(ia(prompt, 4000)).get("t") or []
        except Exception:  # noqa: BLE001
            t = []
        if len(t) == len(textos):
            return [str(x).strip() for x in t]
    raise RuntimeError("tradução veio incompleta")


def para_pt(ws, lingua):
    if not ws or (lingua or "pt").startswith("pt"):
        return ws
    grupos = frases_curtas(ws)
    textos = [" ".join(str(w["word"]).strip() for w in g) for g in grupos]
    try:
        trad = []
        for i in range(0, len(textos), 15):  # lotes de 15; lote que volta errado vai frase a frase
            lote = textos[i:i + 15]
            try:
                trad += _pedir_traducao(lote, lingua)
            except Exception:  # noqa: BLE001
                trad += [(_pedir_traducao([x], lingua) or [x])[0] for x in lote]
    except Exception as e:  # noqa: BLE001
        log(f"tradução falhou ({e}); legenda fica no original")
        return ws
    out = []
    for g, t in zip(grupos, trad):
        ps = t.split()
        if not ps:
            continue
        a, b = g[0]["start"], g[-1]["end"]
        pesos = [len(p) + 2 for p in ps]
        tot, acc = sum(pesos), 0.0
        for p, pe in zip(ps, pesos):
            ini = a + (b - a) * acc / tot
            acc += pe
            out.append({"start": round(ini, 2), "end": round(a + (b - a) * acc / tot, 2), "word": p})
    return out


# ---------------------------------------------------------------- legenda ASS (Viralizaí estilo.py)
def cor_ass(hexa, alfa="00"):
    m = re.fullmatch(r"#?([0-9a-fA-F]{6})", hexa or "")
    h = (m.group(1) if m else COR_PADRAO[1:]).lower()
    return f"&H{alfa}{h[4:6]}{h[2:4]}{h[0:2]}".upper()


def tempo_ass(t):
    t = max(0.0, t)
    hh, r = divmod(t, 3600)
    mm, ss = divmod(r, 60)
    return f"{int(hh)}:{int(mm):02d}:{ss:05.2f}"


def _txt(t):
    return str(t).replace("\\", "").replace("{", "(").replace("}", ")").replace("\n", " ")


def ass(ws, dur, gancho, rede, arroba, cor):
    r = REDES.get(rede) or REDES["tiktok"]
    c = cor_ass(cor)
    pw, ph = 720, 1280  # o libass escala para 1080x1920
    cab = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {pw}
PlayResY: {ph}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Leg,Montserrat ExtraBold,58,&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,5,2,2,{r['margem_e']},{r['margem_d']},{r['leg_mv']},1
Style: Gancho,Montserrat ExtraBold,54,&H00FFFFFF,&H00FFFFFF,{c},{c},1,0,0,0,100,100,0,0,3,14,0,8,{r['margem_e'] + 20},{r['margem_d']},{r['gancho_mv']},1
Style: Marca,Montserrat ExtraBold,28,&H30FFFFFF,&H30FFFFFF,&H90000000,&H00000000,1,0,0,0,100,100,0,0,1,2,0,8,{r['margem_e']},{r['margem_d']},{r['marca_mv']},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ms = int(dur * 1000)
    linhas = [f"Dialogue: 3,{tempo_ass(0)},{tempo_ass(dur)},Marca,,0,0,0,,{{\\an7\\pos(0,0)\\p1\\bord0\\shad0\\1c{c}\\1a&H00&\\fscx0\\t(0,{ms},\\fscx100)}}"
              f"m 0 0 l {pw} 0 {pw} 7 0 7{{\\p0}}"]
    if arroba:
        linhas.append(f"Dialogue: 2,{tempo_ass(0)},{tempo_ass(dur)},Marca,,0,0,0,,{_txt('@' + arroba.lstrip('@'))}")
    if gancho:
        anim = "{\\fad(160,0)\\fscx72\\fscy72\\t(0,200,\\fscx107\\fscy107)\\t(200,320,\\fscx100\\fscy100)}"
        linhas.append(f"Dialogue: 1,{tempo_ass(0)},{tempo_ass(dur)},Gancho,,0,0,0,,{anim}{_txt(gancho.upper())}")
    destaque = "&H0000E6FF" if cor == COR_PADRAO else c
    dentro = sorted([w for w in ws if w["end"] > 0 and w["start"] < dur and str(w["word"]).strip()], key=lambda w: w["start"])
    grupo, ultimo_fim = [], 0.0
    for k, w in enumerate(dentro):
        grupo.append(w)
        prox = dentro[k + 1] if k + 1 < len(dentro) else None
        if len(grupo) >= 3 or re.search(r"[.!?,;:]$", w["word"]) or not prox or prox["start"] - w["end"] > 0.6 or sum(len(x["word"]) for x in grupo) > 16:
            fim_g = prox["start"] if prox and prox["start"] - grupo[-1]["end"] < 0.6 else grupo[-1]["end"]
            pal = [re.sub(r"[.,;:]+$", "", str(x["word"]).strip().upper()) for x in grupo]
            for j, x in enumerate(grupo):
                a = max(0.0, x["start"] if j else grupo[0]["start"], ultimo_fim)
                b = grupo[j + 1]["start"] if j + 1 < len(grupo) else fim_g
                b = min(dur, max(b, a + 0.12))
                ultimo_fim = b
                partes = [(f"{{\\1c{destaque}\\fscx112\\fscy112}}{_txt(p)}{{\\r}}" if i == j else _txt(p)) for i, p in enumerate(pal)]
                entrada = "{\\fscx88\\fscy88\\t(0,90,\\fscx100\\fscy100)}" if j == 0 else ""
                linhas.append(f"Dialogue: 0,{tempo_ass(a)},{tempo_ass(b)},Leg,,0,0,0,,{entrada}{' '.join(partes)}")
            grupo = []
    return cab + "\n".join(linhas) + "\n"


def espalhar(ws):
    """Palavras com o MESMO início (bloco de legenda sem tempo por palavra) viram sequência proporcional ao tamanho."""
    out, i = [], 0
    while i < len(ws):
        j = i
        while j + 1 < len(ws) and abs(ws[j + 1]["start"] - ws[i]["start"]) < 0.02:
            j += 1
        grupo = ws[i:j + 1]
        if len(grupo) == 1:
            out.append(dict(grupo[0]))
        else:
            a0 = grupo[0]["start"]
            prox = ws[j + 1]["start"] if j + 1 < len(ws) else max(w["end"] for w in grupo)
            b0 = max(prox, a0 + 0.22 * len(grupo))
            pesos = [len(str(w["word"])) + 2 for w in grupo]
            tot, acc = sum(pesos), 0.0
            for w, peso in zip(grupo, pesos):
                ini = a0 + (b0 - a0) * acc / tot
                acc += peso
                out.append({"start": round(ini, 2), "end": round(a0 + (b0 - a0) * acc / tot, 2), "word": w["word"]})
        i = j + 1
    return out


def palavras_do_corte(base, ini, fim, traducao=None):
    if traducao:  # tradução escrita pelo agente: uma frase traduzida por frase original
        fs = [s for s in base["frases"] if s["end"] > ini and s["start"] < fim]
        out = []
        for s, t in zip(fs, traducao):
            ps = str(t).split()
            if not ps:
                continue
            a0, b0 = max(s["start"], ini) - ini, min(s["end"], fim) - ini
            pesos = [len(p) + 2 for p in ps]
            tot, acc = sum(pesos), 0.0
            for p, pe in zip(ps, pesos):
                a = a0 + (b0 - a0) * acc / tot
                acc += pe
                out.append({"start": round(a, 2), "end": round(a0 + (b0 - a0) * acc / tot, 2), "word": p})
        return out
    ws = [w for w in base["palavras"] if w["end"] > ini and w["start"] < fim and not re.fullmatch(r"[>\-–—]+", str(w["word"]).strip())]
    ws = para_pt(ws, base.get("lingua"))  # legenda sempre em português (Viralizaí)
    return espalhar([{"start": round(w["start"] - ini, 2), "end": round(w["end"] - ini, 2), "word": w["word"]} for w in ws])


# ---------------------------------------------------------------- trecho, enquadramento e render
FORMATO = "bv*[height<=1080][vcodec^=avc1]+ba[ext=m4a]/bv*[height<=1080]+ba/b[height<=1080]/b"


def probe(arq, campos):
    ff = C.ffmpeg()
    fp = str(Path(ff).with_name("ffprobe" + Path(ff).suffix))
    r = subprocess.run([fp, "-v", "error", "-count_packets", "-show_entries", campos, "-of", "json", str(arq)], capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except ValueError:
        return {}


def baixar_trecho(base, a, b, destino):
    """Só o pedaço [a, b] (com margem), sem reencodar. -copyts guarda o tempo ORIGINAL: o start_time do arquivo diz em que
    segundo do vídeo ele começa (o ffmpeg volta até o quadro-chave anterior a `a`). -t vai na ENTRADA (na saída corta tudo)."""
    if destino.exists() and destino.stat().st_size > 10000:
        return
    ff = C.ffmpeg()
    tmp = destino.with_suffix(".baixando.mp4")
    if base.get("arquivo"):
        urls = [base["arquivo"]]
    else:
        p = C.yt(["-g", "-f", FORMATO, base["url"]])
        urls = [u for u in p.stdout.split() if u.startswith("http")]
    if urls:
        cmd = [ff, "-y", "-v", "error"]
        for u in urls:
            cmd += ["-ss", f"{a:.2f}", "-t", f"{b - a:.2f}", "-i", u]
        cmd += ["-map", "0:v:0", "-map", "1:a:0" if len(urls) > 1 else "0:a:0?", "-c", "copy", "-copyts", "-avoid_negative_ts", "disabled",
                "-f", "mp4", str(tmp)]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
        if r.returncode == 0 and tmp.exists() and tmp.stat().st_size > 10000:
            tmp.replace(destino)
            return
        log("trecho direto falhou (" + r.stderr[-200:] + ")")
        if base.get("arquivo"):
            raise RuntimeError("não consegui cortar o arquivo: " + r.stderr[-300:])
    tmp.unlink(missing_ok=True)
    p = C.yt(["--download-sections", f"*{a:.2f}-{b:.2f}", "--force-keyframes-at-cuts", "-f", FORMATO, "--merge-output-format", "mp4",
              "-o", str(tmp), base["url"]], timeout=1800)
    if p.returncode or not tmp.exists() or tmp.stat().st_size < 10000:
        raise RuntimeError("não consegui baixar o trecho: " + p.stderr[-300:])
    tmp.replace(destino)
    destino.with_suffix(".zero").write_text(f"{a}")


def inicio_do_arquivo(arq):
    z = arq.with_suffix(".zero")
    if z.exists():
        return float(z.read_text())
    j = probe(arq, "format=start_time")
    return float((j.get("format") or {}).get("start_time") or 0)


def expressao_x(pos, largura_video, largura_recorte):
    xs = [max(0, min(largura_video - largura_recorte, int(c * largura_video - largura_recorte / 2))) for _, c in pos]
    expr = str(xs[-1])
    for (t, _), x in reversed(list(zip(pos[1:], xs[:-1]))):
        expr = f"if(lt(t,{t:.2f}),{x},{expr})"
    return expr


def filtro_vertical(w, h, layout, pos=None):
    if h >= w:
        return f"[0:v]fps=30,scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1[v0]"
    if layout == "rosto" and pos:  # segue o rosto cena a cena (corte seco entre cenas, parado dentro da cena)
        cw = int(h * 9 / 16) // 2 * 2
        return f"[0:v]fps=30,crop={cw}:{h}:'{expressao_x(pos, w, cw)}':0,scale={W}:{H},setsar=1[v0]"
    fundo = f"[a]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=8:1,scale={W}:{H},eq=brightness=-0.14[fundo]"
    if layout == "cheio":
        return f"[0:v]fps=30,scale=-2:{H},crop={W}:{H},setsar=1[v0]"
    if layout in ("inteiro", "rosto"):
        return f"[0:v]fps=30,split[a][b];{fundo};[b]scale={W}:-2[frente];[fundo][frente]overlay=(W-w)/2:(H-h)/2-60,setsar=1[v0]"
    return (f"[0:v]fps=30,split[a][b];{fundo};[b]crop='min(iw,ih*3/4)':ih,scale={W}:{int(W * 4 / 3)}[frente];"
            f"[fundo][frente]overlay=(W-w)/2:(H-h)/2-70,setsar=1[v0]")


def render_um(base, c, e, pasta, arroba, cor, layout, rede, n):
    mn, mx = OBJETIVOS[base["objetivo"]][:2]
    segs, sil = base["frases"], [tuple(x) for x in base["silencios"]]
    ini, fim = float(e.get("inicio", c["inicio"])), float(e.get("fim", c["fim"]))
    if e.get("ajuste_inicio") or e.get("ajuste_fim"):
        a2 = encaixar_inicio(ini + float(e.get("ajuste_inicio") or 0), segs, sil, 3)
        b2 = encaixar_fim(fim + float(e.get("ajuste_fim") or 0), segs, sil, 3)
        if mn * 0.85 <= b2 - a2 <= mx + 5:
            ini, fim = round(a2, 2), round(b2, 2)
    dur = round(fim - ini, 2)
    nome = f"corte-{n:02d}"
    trecho = pasta / f"{nome}-trecho.mp4"
    t0 = time.time()
    baixar_trecho(base, max(0.0, ini - 3), fim + 3, trecho)
    t_baixar = time.time() - t0
    s0 = inicio_do_arquivo(trecho)
    v = next((s for s in probe(trecho, "stream=codec_type,width,height").get("streams", []) if s.get("codec_type") == "video"), {})
    vw, vh = int(v.get("width") or 1920), int(v.get("height") or 1080)
    lay, pos = layout, None
    if lay == "auto":
        lay = "centro" if base.get("tipo") == "gameplay" else "rosto"
    if lay == "rosto" and vw > vh:
        try:
            cw = int(vh * 9 / 16) // 2 * 2
            pos = pesado("rosto", "--arquivo", trecho, "--inicio", f"{ini - s0:.2f}", "--fim", f"{fim - s0:.2f}", "--largura-rel", f"{cw / vw:.4f}",
                         timeout=600).get("pos")
        except Exception as ex:  # noqa: BLE001
            log(f"rastreio de rosto falhou: {str(ex)[:160]}")
        if not pos:
            lay = "inteiro"  # sem rosto na maior parte das cenas: quadro inteiro com fundo desfocado
    ws = palavras_do_corte(base, ini, fim, e.get("traducao"))
    (pasta / f"{nome}.ass").write_text(ass(ws, dur, e.get("gancho") or "", rede, arroba, cor), encoding="utf-8")
    saida = pasta / f"{nome}.mp4"
    fc = filtro_vertical(vw, vh, lay, pos)
    fc = fc[:-len("[v0]")] + f",subtitles={nome}.ass:fontsdir=fontes[v0]"
    ff = C.ffmpeg()
    r = subprocess.run([ff, "-y", "-v", "error", "-ss", f"{max(0.0, ini - s0):.3f}", "-t", f"{dur:.3f}", "-i", trecho.name, "-filter_complex", fc,
                        "-map", "[v0]", "-map", "0:a?", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
                        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-movflags", "+faststart", saida.name],
                       cwd=str(pasta), capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        raise RuntimeError("ffmpeg: " + r.stderr[-400:])
    capa = pasta / f"{nome}-capa.jpg"
    subprocess.run([ff, "-y", "-v", "error", "-ss", f"{min(dur * 0.4, dur - 0.5):.2f}", "-i", saida.name, "-frames:v", "1", "-q:v", "3", capa.name], cwd=str(pasta))
    j = probe(saida, "stream=codec_type,nb_read_packets:format=duration")
    sts = j.get("streams", [])
    quadros = int(next((s.get("nb_read_packets") or 0 for s in sts if s.get("codec_type") == "video"), 0))
    real = float((j.get("format") or {}).get("duration") or 0)
    problemas = []
    if not any(s.get("codec_type") == "audio" for s in sts):
        problemas.append("sem áudio")
    if quadros < dur * 30 * 0.9:
        problemas.append(f"vídeo curto ou congelado: {quadros} quadros para {dur:.0f} s")
    return {"corte": n, "id": c["id"], "video": str(saida), "capa": str(capa), "inicio": ini, "fim": fim, "duracao": round(real, 1),
            "enquadramento": lay, "gancho": e.get("gancho") or "", "legenda_post": e.get("legenda_post") or "", "porque": e.get("porque") or "",
            "nota": e.get("nota"), "palavras_legenda": len(ws), "segundos_baixar": round(t_baixar), "segundos_total": round(time.time() - t0),
            "ok": not problemas, "problemas": problemas}


def render(pasta, escolhas, arroba, cor, layout, rede, base=None):
    pasta = Path(pasta).resolve()
    base = base or json.loads((pasta / "candidatos.json").read_text(encoding="utf-8"))
    if isinstance(escolhas, (str, Path)):
        escolhas = json.loads(Path(escolhas).read_text(encoding="utf-8"))
    if isinstance(escolhas, dict):
        escolhas = escolhas.get("escolhas") or escolhas.get("cortes") or []
    por_id = {c["id"]: c for c in base["candidatos"]}
    (pasta / "fontes").mkdir(exist_ok=True)
    if not (pasta / "fontes" / FONTE.name).exists():
        shutil.copy(FONTE, pasta / "fontes" / FONTE.name)
    trabalhos = []
    for n, e in enumerate(escolhas, 1):
        c = por_id.get(int(e.get("id", 0) or 0))
        if not c and "inicio" in e and "fim" in e:
            c = {"id": 0, "inicio": float(e["inicio"]), "fim": float(e["fim"])}
        if not c:
            C.sair(f"escolha {n}: id {e.get('id')} não existe em candidatos.json")
        trabalhos.append((c, e, n))
    t0 = time.time()
    saidas = []
    with ThreadPoolExecutor(2) as ex:  # baixa o próximo enquanto renderiza o atual
        futs = [ex.submit(render_um, base, c, e, pasta, arroba, cor, layout, rede, n) for c, e, n in trabalhos]
        for f in futs:
            try:
                saidas.append(f.result())
            except Exception as e:  # noqa: BLE001
                saidas.append({"ok": False, "erro": str(e)[:400]})
    return {"ok": all(s.get("ok") for s in saidas), "segundos": round(time.time() - t0), "cortes": saidas}


def tudo(x):
    t0 = time.time()
    base, resumo = candidatos(x.pasta, x.objetivo, x.quantos, x.url, x.arquivo, imprimir=False)
    log("escolhendo os melhores cortes (IA)...")
    esc_ = julgar(base, x.quantos)
    pasta = Path(x.pasta).resolve()
    (pasta / "escolhas.json").write_text(json.dumps(esc_, ensure_ascii=False, indent=1), encoding="utf-8")
    log("montando os vídeos...")
    r = render(pasta, esc_, x.arroba, x.cor, x.layout, x.rede, base)
    print(json.dumps({"ok": r["ok"], "titulo": base["titulo"], "tipo": base["tipo"], "lingua": base["lingua"], "sinais_usados": resumo["sinais_usados"],
                      "juiz_ia": any(e.get("juiz") for e in esc_), "segundos_analise": resumo["segundos"], "segundos_total": round(time.time() - t0),
                      "cortes": r["cortes"], "proximo": "olhe as capas com vision_analyze e entregue: caminho do MP4, gancho e legenda do post"},
                     ensure_ascii=False))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    def fonte_args(p):
        g = p.add_mutually_exclusive_group(required=True)
        g.add_argument("--url")
        g.add_argument("--arquivo")
        p.add_argument("--pasta", required=True)
        p.add_argument("--objetivo", choices=list(OBJETIVOS), default="viral")
        p.add_argument("--quantos", type=int, default=3)

    def render_args(p):
        p.add_argument("--arroba", default="")
        p.add_argument("--cor", default=COR_PADRAO)
        p.add_argument("--layout", choices=["auto", "rosto", "centro", "inteiro", "cheio"], default="auto")
        p.add_argument("--rede", choices=list(REDES), default="tiktok")

    a0 = sub.add_parser("auto")
    fonte_args(a0)
    render_args(a0)
    a1 = sub.add_parser("candidatos")
    fonte_args(a1)
    aj = sub.add_parser("julgar")
    aj.add_argument("--pasta", required=True)
    aj.add_argument("--quantos", type=int, default=3)
    a2 = sub.add_parser("render")
    a2.add_argument("--pasta", required=True)
    a2.add_argument("--escolhas", required=True)
    render_args(a2)
    sub.add_parser("preparar")
    x = ap.parse_args()
    if x.cmd == "auto":
        tudo(x)
    elif x.cmd == "candidatos":
        candidatos(x.pasta, x.objetivo, x.quantos, x.url, x.arquivo)
    elif x.cmd == "julgar":
        p = Path(x.pasta).resolve()
        esc_ = julgar(json.loads((p / "candidatos.json").read_text(encoding="utf-8")), x.quantos)
        (p / "escolhas.json").write_text(json.dumps(esc_, ensure_ascii=False, indent=1), encoding="utf-8")
        print(json.dumps({"ok": True, "escolhas": str(p / "escolhas.json"), "cortes": esc_}, ensure_ascii=False))
    elif x.cmd == "render":
        print(json.dumps(render(x.pasta, x.escolhas, x.arroba, x.cor, x.layout, x.rede) | {"proximo": "olhe as capas com vision_analyze"}, ensure_ascii=False))
    else:
        print(json.dumps({"ok": bool(ambiente()), "python": _AMBIENTE.get("py")}, ensure_ascii=False))
