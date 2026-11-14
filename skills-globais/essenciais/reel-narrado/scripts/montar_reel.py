"""Monta um reel NARRADO a partir de um roteiro (skill reel-narrado): gera a fala de cada cena com a voz escolhida (voz-local),
MEDE quanto cada fala durou, monta a trilha da narração e escreve a animação (HTML do Motion) com cada cena entrando e saindo
exatamente no tempo da fala, com legenda palavra por palavra. Depois é só chamar motion_animar com o HTML e o áudio que ele imprime.

    python montar_reel.py --roteiro roteiro.json --pasta "Videos/reel-dicas" [--motor xtts|openvoice]

Roteiro (JSON, UTF-8):
{
  "marca": "Loja da Ana",                       # opcional, aparece no topo
  "cores": {"fundo": "#0b0d14", "d1": "#7c5cff", "d2": "#22d3a6", "texto": "#f4f2ff"},   # opcional
  "voz": {"amostra": "C:/.../amostra.wav", "motor": "xtts"},   # sem amostra = voz padrão (Piper, openvoice)
  "musica": {"arquivo": "C:/.../trilha.mp3", "volume": 0.12},  # opcional
  "cenas": [
    {"tipo": "gancho", "fala": "Você ainda faz tudo na mão?", "titulo": "Ainda faz tudo *na mão?*", "selo": "1 minuto"},
    {"tipo": "dica", "fala": "...", "titulo": "Atendimento *24 horas*", "texto": "frase curta de apoio"},
    {"tipo": "numero", "fala": "...", "numero": "3x", "rotulo": "mais vendas", "texto": "..."},
    {"tipo": "lista", "fala": "...", "titulo": "Sai pronto:", "itens": ["Planilha", "Orçamento", "Relatório"]},
    {"tipo": "frase", "fala": "...", "titulo": "Com a *sua voz*"},
    {"tipo": "cta", "fala": "...", "titulo": "Quer *testar?*", "botao": "Comenta EU QUERO"}
  ]
}
Rodar de novo só regera a fala das cenas cujo texto mudou (as outras ficam em cache).
Imprime uma linha JSON: {"ok": true, "html": ..., "audio": ..., "duracao": ..., "cenas": [{"fala": ..., "ini": ..., "dur": ...}]}
"""
import argparse
import glob
import hashlib
import json
import os
import shutil
import subprocess
import sys
import wave
from pathlib import Path

AQUI = Path(__file__).resolve().parent
MODELO = AQUI.parent / "modelos" / "reel-narrado.html"
VOZ = AQUI.parent.parent / "voz-local" / "scripts" / "voz_local.py"
INICIO = 0.35  # respiro antes da primeira fala (a primeira cena já está entrando)
PAUSA = 0.35   # entre uma fala e a próxima
SEGURA_FIM = 1.3  # a última cena (chamada) fica na tela depois que a fala acaba


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


def duracao(wav):
    with wave.open(str(wav), "rb") as w:
        return w.getnframes() / float(w.getframerate())


def palavras(fala, ini, dur):
    """Tempo de cada palavra, proporcional ao tamanho (aproximação boa para a legenda karaokê)."""
    ws = fala.split()
    pesos = [len(w.strip(".,!?;:…")) + 2 for w in ws]
    tot = sum(pesos) or 1
    out, acc = [], 0.0
    for w, p in zip(ws, pesos):
        out.append({"w": w, "ini": round(ini + dur * acc / tot, 3)})
        acc += p
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--roteiro", required=True)
    ap.add_argument("--pasta", required=True, help="pasta do reel (dentro de Videos/): falas, trilha e o HTML ficam aqui")
    ap.add_argument("--motor", choices=["xtts", "openvoice"])
    a = ap.parse_args()
    try:
        r = json.loads(Path(a.roteiro).read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        sair(f"roteiro inválido: {e}")
    cenas = r.get("cenas") or []
    if not cenas or not all(c.get("fala") for c in cenas):
        sair("o roteiro precisa de cenas, cada uma com 'fala'")
    if not VOZ.exists():
        sair(f"skill voz-local não encontrada em {VOZ}")
    voz = r.get("voz") or {}
    amostra = voz.get("amostra")
    motor = a.motor or voz.get("motor") or ("xtts" if amostra else "openvoice")
    if amostra and not os.path.isfile(amostra):
        sair(f"amostra de voz não encontrada: {amostra}")
    pasta = Path(a.pasta).resolve()
    (pasta / "falas").mkdir(parents=True, exist_ok=True)
    ff = ffmpeg()

    # 1) fala de cada cena (cache pelo texto + voz + motor)
    durs = []
    for i, c in enumerate(cenas, 1):
        chave = hashlib.sha256(json.dumps([c["fala"], amostra, motor], ensure_ascii=False).encode()).hexdigest()[:12]
        wav = pasta / "falas" / f"cena-{i:02d}-{chave}.wav"
        if not wav.exists():
            txt = pasta / "falas" / f"cena-{i:02d}.txt"
            txt.write_text(c["fala"], encoding="utf-8")
            cmd = [sys.executable, str(VOZ), "falar", "--texto-arquivo", str(txt), "--saida", str(wav), "--motor", motor] + (["--amostra", amostra] if amostra else [])
            print(f"cena {i}/{len(cenas)}: gerando a fala...", file=sys.stderr, flush=True)
            p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
            if p.returncode != 0 or not wav.exists():
                sair(f"a fala da cena {i} falhou: {(p.stdout or p.stderr)[-400:]}")
        # tira silêncio sobrando no começo e no fim da fala (o tempo da cena fica justo)
        limpo = pasta / "falas" / f"cena-{i:02d}-limpa.wav"
        subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(wav), "-af",
                        "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse",
                        "-ac", "1", "-ar", "48000", str(limpo)], check=True)
        durs.append((limpo, duracao(limpo)))

    # 2) linha do tempo medida
    t = INICIO
    tl = []
    for i, (c, (wav, d)) in enumerate(zip(cenas, durs)):
        ultima = i == len(cenas) - 1
        ini = t
        fala_fim = ini + d
        fim = fala_fim + (SEGURA_FIM if ultima else PAUSA)
        item = {k: v for k, v in c.items() if k != "voz"}
        item.update({"ini": round(ini if i else 0.0, 3), "fim": round(fim, 3), "falaIni": round(ini, 3), "falaFim": round(fala_fim, 3), "palavras": palavras(c["fala"], ini, d)})
        tl.append(item)
        t = fim
    total = round(t, 3)

    # 3) trilha da narração: silêncio inicial + falas com pausas, volume normalizado (e música baixa, se houver)
    narr = pasta / "narracao.wav"
    entradas, filtros, rotulos = [], [], []
    for i, (wav, d) in enumerate(durs):
        entradas += ["-i", str(wav)]
        atraso = int(tl[i]["falaIni"] * 1000)
        filtros.append(f"[{i}:a]adelay={atraso}|{atraso}[f{i}]")
        rotulos.append(f"[f{i}]")
    filtros.append(f"{''.join(rotulos)}amix=inputs={len(durs)}:normalize=0:duration=longest,apad,atrim=0:{total},loudnorm=I=-16:TP=-1.5:LRA=11[voz]")
    saida_rot = "[voz]"
    m = r.get("musica") or {}
    if m.get("arquivo") and os.path.isfile(m["arquivo"]):
        entradas += ["-stream_loop", "-1", "-i", m["arquivo"]]
        k = len(durs)
        vol = float(m.get("volume") or 0.12)
        filtros.append(f"[{k}:a]atrim=0:{total},volume={vol},afade=t=out:st={max(0, total - 1.5)}:d=1.5[mus];[voz][mus]amix=inputs=2:normalize=0:duration=first[mix]")
        saida_rot = "[mix]"
    subprocess.run([ff, "-y", "-loglevel", "error", *entradas, "-filter_complex", ";".join(filtros), "-map", saida_rot, "-ac", "2", "-ar", "48000", str(narr)], check=True)

    # 4) animação: modelo + linha do tempo
    html = MODELO.read_text(encoding="utf-8")
    ini_tl, fim_tl = html.index("/*TL*/"), html.index("/*FIM*/")
    dados = {"total": total, "marca": r.get("marca", ""), "cores": r.get("cores") or {}, "legenda": r.get("legenda", "karaoke"), "cenas": tl}
    html = html[: ini_tl + len("/*TL*/")] + json.dumps(dados, ensure_ascii=False) + html[fim_tl:]
    arq_html = pasta / "reel.html"
    arq_html.write_text(html, encoding="utf-8")
    print(json.dumps({"ok": True, "html": str(arq_html), "audio": str(narr), "duracao": total, "motor": motor,
                      "previa_sugerida": [round(x["falaIni"] + 0.9, 2) for x in tl][:8],
                      "cenas": [{"fala": x["fala"][:60], "ini": x["falaIni"], "dur": round(x["falaFim"] - x["falaIni"], 2)} for x in tl]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
