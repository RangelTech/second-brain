"""Cortes AUTOMÁTICOS (motor do Viralizaí portado para o computador do usuário, sem créditos e sem Motion).

Dois passos e o agente é só o juiz:

    python auto.py candidatos --url URL --pasta "Videos/cortes-x" [--objetivo viral|reels|tiktok] [--quantos 3]
        lê o vídeo SEM baixá-lo (informações, legenda automática com tempo por palavra, chat da live, mapa de "mais vistos")
        e o ÁUDIO em baixa qualidade (volume por segundo e silêncios). Dá nota a cada segundo, acha os picos e monta cada
        candidato como HISTÓRIA (contexto antes do clímax, reação depois, bordas em começo/fim de frase ou num silêncio).
        Grava candidatos.json e imprime a lista para você julgar (fala + sinais de cada um).

    python auto.py render --pasta P --escolhas escolhas.json [--arroba @canal] [--cor "#ff3d6e"] [--layout auto|centro|inteiro|cheio]
        [--rede tiktok|instagram|youtube]
        escolhas.json = [{"id": 2, "gancho": "ELE NÃO ESPERAVA ISSO", "ajuste_inicio": 0, "ajuste_fim": 0,
                          "traducao": ["frase 1 em português", ...]   (só se o vídeo não for em português)}]
        baixa SÓ o trecho de cada corte, monta o vertical 1080x1920 (fundo desfocado), legenda karaokê palavra por palavra,
        gancho em caixa o vídeo todo, barra de progresso, @ e áudio normalizado, num passe só de ffmpeg. Confere o resultado
        e grava uma capa .jpg de cada corte para você olhar.

Tempo típico: candidatos 30 s a 3 min (live longa: o chat e o áudio demoram mais); render 30 s a 1 min por corte.
Tudo imprime uma linha JSON no fim."""
import argparse
import json
import math
import re
import shutil
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import cortes as C  # noqa: E402  (yt-dlp e ffmpeg do app, legenda json3)

AQUI = Path(__file__).resolve().parent
FONTE = AQUI.parent / "fontes" / "Montserrat-ExtraBold.ttf"
OBJETIVOS = {  # (mínimo, máximo, alvo, fração ANTES do clímax)
    "viral": (20, 40, 30, 0.45),    # alcance: começa perto do clímax
    "reels": (30, 60, 45, 0.60),    # Reels / Shorts
    "tiktok": (61, 90, 72, 0.70),   # monetizar no TikTok: passa de 1 min
}
RISADA = re.compile(r"(k{3,}|K{3,}|rs(rs)+|(ha){2,}|(he){3,}|lul|kekw|omegalul|😂|🤣|:face_with_tears_of_joy:)", re.I)
CHOQUE = re.compile(r"(\?{2,}|wtf|mano+|n[aã]o acredito|clipa|clip it|pog|🔥|😱|:fire:|caraca|meu deus|slk|vish|eita|que isso|insano|absurd)", re.I)
PESOS = {
    "gameplay": {"chat": .25, "publico": .25, "voz": .25, "texto": .10},
    "podcast": {"chat": .25, "publico": .25, "voz": .20, "texto": .25},
    "react": {"chat": .25, "publico": .25, "voz": .25, "texto": .10},
}
GATILHOS = {
    "gameplay": r"pol[ií]cia|estrela|fugi|explodiu|morri|matei|preso|perseguiç|bati|capotou|roubei|assalto|tiro|banid|treta",
    "podcast": r"pol[eê]mic|nunca contei|verdade|segredo|absurdo|dinheiro|milh|briga|chorei|traiç",
    "react": r"n[aã]o acredito|olha isso|caraca|meu deus|absurdo|que isso",
}
W, H = 1080, 1920
REDES = {  # margens em pixels de 1280 de altura (o ASS escala para 1920): o TikTok cobre mais embaixo e à direita
    "tiktok": {"leg_mv": 430, "gancho_mv": 175, "marca_mv": 112, "margem_d": 150, "margem_e": 40},
    "instagram": {"leg_mv": 360, "gancho_mv": 165, "marca_mv": 104, "margem_d": 90, "margem_e": 40},
    "youtube": {"leg_mv": 380, "gancho_mv": 165, "marca_mv": 104, "margem_d": 110, "margem_e": 40},
}
COR_PADRAO = "#ff3d6e"


def log(m):
    print(m, file=sys.stderr, flush=True)


# ---------------------------------------------------------------- séries (Python puro: live de 4 h = 14.400 segundos)
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
    """z-score robusto (mediana/MAD), cortado em [0, 6]: só interessa o que está ACIMA do normal do vídeo."""
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


# ---------------------------------------------------------------- coleta (nada de vídeo: só textos e áudio leve)
def tipo_do_video(info):
    txt = " ".join([info.get("title") or "", " ".join(info.get("categories") or []), " ".join(info.get("tags") or [])]).lower()
    if re.search(r"\breact|reagindo|rea[cç][aã]o|reagi\b", txt):
        return "react"
    if "gaming" in txt or re.search(r"gta|rp\b|minecraft|fortnite|free fire|cs2|valorant|gameplay|jogando|\blive\b", txt):
        return "gameplay"
    return "podcast"


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


def ler_audio(pasta, url, dur):
    """Volume (dB) por segundo e silêncios, do áudio na MENOR qualidade (live de 4 h ~ 60 MB)."""
    C.yt(["-f", "worstaudio[abr>=40]/worstaudio/bestaudio", "-o", str(pasta / "audio.%(ext)s"), url], timeout=2400)
    arq = next((p for p in pasta.glob("audio.*") if p.suffix not in (".part", ".ytdl", ".txt")), None)
    if not arq:
        raise RuntimeError("o áudio não baixou")
    ff = C.ffmpeg()
    rms = pasta / "audio-rms.txt"
    # 1 bloco = 1 s (8000 amostras a 8 kHz); silêncios abaixo de -35 dB por 0,35 s
    r = subprocess.run([ff, "-v", "info", "-nostats", "-i", arq.name, "-vn", "-af",
                        "aresample=8000,asetnsamples=n=8000:p=0,astats=metadata=1:reset=1,"
                        "ametadata=print:key=lavfi.astats.Overall.RMS_level:file=audio-rms.txt,silencedetect=n=-35dB:d=0.35",
                        "-f", "null", "-"], cwd=str(pasta), capture_output=True, text=True, encoding="utf-8", errors="replace")
    db = []
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
        raise RuntimeError("não consegui medir o áudio: " + r.stderr[-300:])
    return {"db": db, "silencios": sil}


def palavras(pasta):
    leg = C.achar_legenda(pasta)
    if not leg:
        return [], None
    ws = C.palavras_json3(leg)
    out = []
    for i, w in enumerate(ws):
        prox = ws[i + 1]["t"] if i + 1 < len(ws) else w["t"] + 0.5
        out.append({"start": w["t"], "end": round(min(prox, w["t"] + 0.8), 2), "word": w["w"]})
    m = re.search(r"\.([a-zA-Z-]+)\.json3$", leg.name)
    return out, (m.group(1) if m else None)


def frases(ws, pausa=0.7, max_s=12.0):
    out, atual = [], []
    for i, w in enumerate(ws):
        atual.append(w)
        prox = ws[i + 1] if i + 1 < len(ws) else None
        if not prox or prox["start"] - w["end"] > pausa or re.search(r"[.?!…]\"?$", w["word"]) or w["end"] - atual[0]["start"] > max_s:
            out.append({"start": atual[0]["start"], "end": atual[-1]["end"], "text": " ".join(x["word"] for x in atual)})
            atual = []
    return out


# ---------------------------------------------------------------- nota por segundo (Viralizaí 47c §3.2, sem o YAMNet)
def linha_do_tempo(info, dur, ws, chat, aud):
    tipo = tipo_do_video(info)
    pesos = dict(PESOS[tipo])
    comp, ch = {}, None
    if chat:
        vol, ris, cho, pago = ([0.0] * dur for _ in range(4))
        autores = {}
        for m in chat:
            t = int(max(0, m["t"] - 6))  # o chat reage DEPOIS do momento
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
        if sum(vol) >= max(30, dur / 120):  # chat de verdade (pelo menos 1 msg a cada 2 min)
            comp["chat"] = suavizar(soma(robusto(unicos), esc(1.5, robusto(ris)), esc(1.5, robusto(cho)), [2 * min(p, 2) for p in pago]), 5)
    if info.get("heatmap"):
        s = [0.0] * dur
        abertura = 120 if dur > 600 else 0  # o começo sempre "é revisto"
        for h in info["heatmap"]:
            a, b = max(int(h["start_time"]), abertura), min(dur, int(h["end_time"]) + 1)
            for i in range(a, b):
                s[i] = max(s[i], float(h["value"]))
        if any(s):
            comp["publico"] = suavizar(s, 5)
    if aud and aud.get("db"):
        db = (aud["db"] + [min(aud["db"])] * dur)[:dur]
        comp["voz"] = suavizar(robusto(db), 3)
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
    return {"tipo": tipo, "nota": suavizar(nota, 3), "comp": comp, "pesos": usados, "chat": ch}


def resumo_sinais(lt, a, b):
    ia, ib = int(a), int(b)
    partes = []
    ch = lt.get("chat")
    if ch and "chat" in lt["comp"] and ib > ia:
        base = max(0.05, sum(ch["vol"]) / len(ch["vol"]))
        pico = sum(ch["vol"][ia:ib]) / (ib - ia)
        if pico / base >= 1.8:
            partes.append(f"chat {pico / base:.0f}x o normal")
        r = int(sum(ch["risada"][ia:ib]))
        if r >= 3:
            partes.append(f"{r} risadas no chat")
        c = int(sum(ch["choque"][ia:ib]))
        if c >= 3:
            partes.append(f"{c} reações de choque no chat")
        if sum(ch["pago"][ia:ib]):
            partes.append("doação/Super Chat no trecho")
    for k, frase in (("publico", "o público reviu muito esse trecho"), ("voz", "voz bem empolgada/alta")):
        v = lt["comp"].get(k)
        if v and ib > ia and max(v[ia:ib]) >= pct(v, 90 if k == "publico" else 97):
            partes.append(frase)
    return ", ".join(partes[:6]) or "fala contínua"


# ---------------------------------------------------------------- candidatos (Viralizaí 47c §3.3)
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
    """Começo de frase em até `folga` s antes de t; prefere frase precedida de pausa (começo de assunto)."""
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
        ini = min(fim - alvo, p - alvo * antes * 0.6)  # contexto antes do clímax
        if capitulos:  # não volta para o capítulo anterior (outro assunto)
            cap = next((c for c in capitulos if c["a"] <= p < c["b"]), None)
            if cap and ini < cap["a"] and p - cap["a"] >= mn * 0.5:
                ini = cap["a"]
        ini = encaixar_inicio(max(0.0, ini), segs, sil)
        fim = encaixar_fim(max(fim, ini + mn), segs, sil)
        if fim - ini > mx:  # longo demais: aperta pelo começo (clímax e reação ficam)
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


def candidatos(url, pasta, objetivo, quantos):
    t0 = time.time()
    pasta = Path(pasta).resolve()
    pasta.mkdir(parents=True, exist_ok=True)
    log("lendo as informações do vídeo...")
    p = C.yt(["-J", "--skip-download", url])
    if p.returncode:
        C.sair("não consegui ler o vídeo: " + p.stderr[-400:])
    info = json.loads(p.stdout)
    if info.get("is_live") or info.get("live_status") == "is_live":
        C.sair("essa live está acontecendo agora: mande o link quando ela terminar")
    dur = int(float(info.get("duration") or 0)) + 1
    mn = OBJETIVOS[objetivo][0]
    if dur < mn * 1.5:
        C.sair(f"vídeo curto demais para corte de {mn} s ou mais (tem {dur} s)")
    (pasta / "info.json").write_text(json.dumps({k: info.get(k) for k in ("id", "title", "duration", "channel", "uploader_id", "language", "webpage_url",
                                                                          "categories", "tags", "heatmap", "chapters")}, ensure_ascii=False), encoding="utf-8")
    res, erros = {}, {}

    def legenda():
        C.yt(["--skip-download", "--write-auto-subs", "--write-subs", "--sub-langs", "pt-orig,pt,pt-BR,en-orig,en,es-orig", "--sub-format", "json3",
              "-o", str(pasta / "dados.%(ext)s"), url])
        res["palavras"], res["lingua"] = palavras(pasta)

    def chat():
        res["chat"] = ler_chat(pasta, url) if "live_chat" in (info.get("subtitles") or {}) else []

    def som():
        res["audio"] = ler_audio(pasta, url, dur)

    log("ouvindo o vídeo, lendo a legenda e o chat (sem baixar o vídeo)...")
    with ThreadPoolExecutor(3) as ex:
        fut = {"legenda": ex.submit(legenda), "chat": ex.submit(chat), "audio": ex.submit(som)}
        for nome, f in fut.items():
            try:
                f.result()
            except Exception as e:  # noqa: BLE001  sinal com problema é pulado
                erros[nome] = str(e)[:200]
    ws, chat_, aud = res.get("palavras") or [], res.get("chat") or [], res.get("audio")
    if not ws and not aud and not info.get("heatmap"):
        C.sair("não consegui nem a legenda nem o áudio: " + json.dumps(erros, ensure_ascii=False))
    lingua = (res.get("lingua") or info.get("language") or "pt")[:2].lower()
    segs = frases(ws)
    sil = (aud or {}).get("silencios") or []
    lt = linha_do_tempo(info, dur, ws, chat_, aud)
    caps = [{"a": float(c["start_time"]), "b": float(c["end_time"])} for c in info.get("chapters") or []]
    n_cand = max(6, min(12, quantos * 3))
    cands = gerar(lt["nota"], segs, sil, n_cand, objetivo, caps)[:n_cand]
    if not cands:
        C.sair("não achei momentos fortes nesse vídeo; tente outro vídeo ou uma live mais longa")
    for k, c in enumerate(cands, 1):
        c["id"] = k
        c["sinais"] = resumo_sinais(lt, c["inicio"], c["fim"])
        fs = [s for s in segs if s["end"] > c["inicio"] and s["start"] < c["fim"]]
        c["fala"] = " ".join(s["text"] for s in fs)[:900] or "(sem fala)"
        if lingua != "pt" and fs:  # o juiz traduz frase a frase (a legenda sai sempre em português)
            c["frases"] = [s["text"] for s in fs]
    (pasta / "candidatos.json").write_text(json.dumps({"url": url, "objetivo": objetivo, "lingua": lingua, "tipo": lt["tipo"], "duracao": dur,
                                                       "titulo": info.get("title"), "canal": info.get("channel") or info.get("uploader_id"),
                                                       "silencios": sil, "frases": segs, "palavras": ws, "candidatos": cands},
                                                      ensure_ascii=False), encoding="utf-8")
    for c in cands:  # para o juiz ler direto
        log(f"\n#{c['id']} [{mmss(c['inicio'])} a {mmss(c['fim'])}, {c['fim'] - c['inicio']:.0f}s] SINAIS: {c['sinais']}\nFALA: {c['fala']}")
    print(json.dumps({"ok": True, "titulo": info.get("title"), "canal": info.get("channel"), "tipo": lt["tipo"], "lingua": lingua,
                      "sinais_usados": sorted(lt["pesos"]), "mensagens_chat": len(chat_), "palavras": len(ws), "erros": erros,
                      "segundos": round(time.time() - t0), "candidatos": [{k: c[k] for k in ("id", "inicio", "fim", "sinais", "fala")}
                                                                       | ({"frases": c["frases"]} if c.get("frases") else {}) for c in cands],
                      "proximo": "julgue e escreva escolhas.json; depois rode: auto.py render --pasta P --escolhas escolhas.json"},
                     ensure_ascii=False))


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
Style: Gancho,Montserrat ExtraBold,52,&H00FFFFFF,&H00FFFFFF,{c},{c},1,0,0,0,100,100,0,0,3,14,0,8,{r['margem_e'] + 20},{r['margem_d']},{r['gancho_mv']},1
Style: Marca,Montserrat ExtraBold,28,&H30FFFFFF,&H30FFFFFF,&H90000000,&H00000000,1,0,0,0,100,100,0,0,1,2,0,8,{r['margem_e']},{r['margem_d']},{r['marca_mv']},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ms = int(dur * 1000)
    linhas = [f"Dialogue: 3,{tempo_ass(0)},{tempo_ass(dur)},Marca,,0,0,0,,{{\\an7\\pos(0,0)\\p1\\bord0\\shad0\\1c{c}\\1a&H00&\\fscx0\\t(0,{ms},\\fscx100)}}"
              f"m 0 0 l {pw} 0 {pw} 7 0 7{{\\p0}}"]  # barra de progresso
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
            for j, x in enumerate(grupo):  # karaokê: a palavra da vez em destaque e maior
                a = max(0.0, x["start"] if j else grupo[0]["start"], ultimo_fim)
                b = grupo[j + 1]["start"] if j + 1 < len(grupo) else fim_g
                b = min(dur, max(b, a + 0.12))
                ultimo_fim = b
                partes = [(f"{{\\1c{destaque}\\fscx112\\fscy112}}{_txt(p)}{{\\r}}" if i == j else _txt(p)) for i, p in enumerate(pal)]
                entrada = "{\\fscx88\\fscy88\\t(0,90,\\fscx100\\fscy100)}" if j == 0 else ""
                linhas.append(f"Dialogue: 0,{tempo_ass(a)},{tempo_ass(b)},Leg,,0,0,0,,{entrada}{' '.join(partes)}")
            grupo = []
    return cab + "\n".join(linhas) + "\n"


def palavras_do_corte(base, ini, fim, traducao):
    """Palavras com tempo relativo ao corte. Com tradução: cada frase traduzida ocupa o tempo da frase original,
    palavra a palavra proporcional ao tamanho (Viralizaí traduz.py)."""
    if traducao:
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
    return [{"start": round(w["start"] - ini, 2), "end": round(w["end"] - ini, 2), "word": w["word"]}
            for w in base["palavras"] if w["end"] > ini and w["start"] < fim and not re.fullmatch(r"[>\-–—]+", str(w["word"]).strip())]


# ---------------------------------------------------------------- trecho e render
FORMATO = "bv*[height<=1080][vcodec^=avc1]+ba[ext=m4a]/bv*[height<=1080]+ba/b[height<=1080]/b"


def probe(arq, campos):
    ff = C.ffmpeg()
    fp = str(Path(ff).with_name("ffprobe" + Path(ff).suffix))
    r = subprocess.run([fp, "-v", "error", "-count_packets", "-show_entries", campos, "-of", "json", str(arq)], capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except ValueError:
        return {}


def baixar_trecho(url, a, b, destino):
    """Só o pedaço [a, b] (com margem), sem reencodar. -copyts guarda o tempo ORIGINAL: o start_time do arquivo diz exatamente
    em que segundo do vídeo ele começa (o ffmpeg volta até o quadro-chave anterior a `a`)."""
    if destino.exists() and destino.stat().st_size > 10000:
        return
    p = C.yt(["-g", "-f", FORMATO, url])
    urls = [u for u in p.stdout.split() if u.startswith("http")]
    ff = C.ffmpeg()
    tmp = destino.with_suffix(".baixando.mp4")
    if urls:
        cmd = [ff, "-y", "-v", "error"]
        for u in urls:
            cmd += ["-ss", f"{a:.2f}", "-t", f"{b - a:.2f}", "-i", u]  # -t na ENTRADA: com -copyts, -t na saída corta tudo
        cmd += ["-map", "0:v:0", "-map", "1:a:0" if len(urls) > 1 else "0:a:0?", "-c", "copy", "-copyts",
                "-avoid_negative_ts", "disabled", "-f", "mp4", str(tmp)]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
        if r.returncode == 0 and tmp.exists() and tmp.stat().st_size > 10000:
            tmp.replace(destino)
            return
        log("trecho direto falhou (" + r.stderr[-200:] + "); tentando pelo yt-dlp")
    tmp.unlink(missing_ok=True)
    p = C.yt(["--download-sections", f"*{a:.2f}-{b:.2f}", "--force-keyframes-at-cuts", "-f", FORMATO, "--merge-output-format", "mp4",
              "-o", str(tmp), url], timeout=1800)
    if p.returncode or not tmp.exists() or tmp.stat().st_size < 10000:
        raise RuntimeError("não consegui baixar o trecho: " + p.stderr[-300:])
    tmp.replace(destino)
    (destino.with_suffix(".zero")).write_text(f"{a}")  # este arquivo começa em `a`, tempo zerado


def inicio_do_arquivo(arq):
    z = arq.with_suffix(".zero")
    if z.exists():
        return float(z.read_text()), True
    j = probe(arq, "format=start_time")
    return float((j.get("format") or {}).get("start_time") or 0), False


def filtro_vertical(w, h, layout):
    if h >= w:  # já vertical
        return f"[0:v]fps=30,scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1[v0]"
    fundo = f"[a]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=8:1,scale={W}:{H},eq=brightness=-0.14[fundo]"
    if layout == "cheio":  # podcast/conversa: o centro do quadro ocupa a tela toda
        return f"[0:v]fps=30,scale=-2:{H},crop={W}:{H},setsar=1[v0]"
    if layout == "inteiro":  # o quadro 16:9 inteiro no meio (nada é cortado)
        return f"[0:v]fps=30,split[a][b];{fundo};[b]scale={W}:-2[frente];[fundo][frente]overlay=(W-w)/2:(H-h)/2-60,setsar=1[v0]"
    # centro (padrão, jogo/gameplay): recorte 3:4 central, maior
    return (f"[0:v]fps=30,split[a][b];{fundo};[b]crop='min(iw,ih*3/4)':ih,scale={W}:{int(W * 4 / 3)}[frente];"
            f"[fundo][frente]overlay=(W-w)/2:(H-h)/2-70,setsar=1[v0]")


def render_um(base, c, esc_, pasta, arroba, cor, layout, rede, n):
    mn, mx = OBJETIVOS[base["objetivo"]][:2]
    segs, sil = base["frases"], [tuple(x) for x in base["silencios"]]
    ini, fim = c["inicio"], c["fim"]
    if "inicio" in esc_ or "fim" in esc_:
        ini, fim = float(esc_.get("inicio", ini)), float(esc_.get("fim", fim))
    if esc_.get("ajuste_inicio") or esc_.get("ajuste_fim"):
        a2 = encaixar_inicio(ini + float(esc_.get("ajuste_inicio") or 0), segs, sil, 3)
        b2 = encaixar_fim(fim + float(esc_.get("ajuste_fim") or 0), segs, sil, 3)
        if mn * 0.85 <= b2 - a2 <= mx + 5:
            ini, fim = round(a2, 2), round(b2, 2)
    dur = round(fim - ini, 2)
    nome = f"corte-{n:02d}"
    trecho = pasta / f"{nome}-trecho.mp4"
    t0 = time.time()
    baixar_trecho(base["url"], max(0.0, ini - 3), fim + 3, trecho)
    t_baixar = time.time() - t0
    s0, _ = inicio_do_arquivo(trecho)
    v = next((s for s in probe(trecho, "stream=codec_type,width,height").get("streams", []) if s.get("codec_type") == "video"), {})
    ws = palavras_do_corte(base, ini, fim, esc_.get("traducao"))
    (pasta / f"{nome}.ass").write_text(ass(ws, dur, esc_.get("gancho") or "", rede, arroba, cor), encoding="utf-8")
    saida = pasta / f"{nome}.mp4"
    if layout == "auto":  # conversa: o quadro inteiro (ninguém some do plano aberto); jogo: o centro maior
        layout = "centro" if base.get("tipo") == "gameplay" else "inteiro"
    fc = filtro_vertical(int(v.get("width") or 1920), int(v.get("height") or 1080), layout)
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
            "gancho": esc_.get("gancho") or "", "legenda_post": esc_.get("legenda_post") or "", "palavras_legenda": len(ws),
            "segundos_baixar": round(t_baixar), "segundos_total": round(time.time() - t0), "ok": not problemas, "problemas": problemas}


def render(pasta, escolhas, arroba, cor, layout, rede):
    pasta = Path(pasta).resolve()
    base = json.loads((pasta / "candidatos.json").read_text(encoding="utf-8"))
    esc_ = json.loads(Path(escolhas).read_text(encoding="utf-8"))
    if isinstance(esc_, dict):
        esc_ = esc_.get("escolhas") or esc_.get("cortes") or []
    por_id = {c["id"]: c for c in base["candidatos"]}
    (pasta / "fontes").mkdir(exist_ok=True)
    if not (pasta / "fontes" / FONTE.name).exists():
        shutil.copy(FONTE, pasta / "fontes" / FONTE.name)
    trabalhos = []
    for n, e in enumerate(esc_, 1):
        c = por_id.get(int(e.get("id", 0)))
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
    print(json.dumps({"ok": all(s.get("ok") for s in saidas), "segundos": round(time.time() - t0), "cortes": saidas,
                      "proximo": "olhe as capas com vision_analyze; se algo estiver feio, ajuste e rode render só com aquele corte"},
                     ensure_ascii=False))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    a1 = sub.add_parser("candidatos")
    a1.add_argument("--url", required=True)
    a1.add_argument("--pasta", required=True)
    a1.add_argument("--objetivo", choices=list(OBJETIVOS), default="viral")
    a1.add_argument("--quantos", type=int, default=3)
    a2 = sub.add_parser("render")
    a2.add_argument("--pasta", required=True)
    a2.add_argument("--escolhas", required=True)
    a2.add_argument("--arroba", default="")
    a2.add_argument("--cor", default=COR_PADRAO)
    a2.add_argument("--layout", choices=["auto", "centro", "inteiro", "cheio"], default="auto")
    a2.add_argument("--rede", choices=list(REDES), default="tiktok")
    x = ap.parse_args()
    if x.cmd == "candidatos":
        candidatos(x.url, x.pasta, x.objetivo, x.quantos)
    else:
        render(x.pasta, x.escolhas, x.arroba, x.cor, x.layout, x.rede)
