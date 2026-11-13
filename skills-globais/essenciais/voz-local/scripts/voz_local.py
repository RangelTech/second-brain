"""Voz clonada LOCAL e de graça (sem créditos), dois motores:
  openvoice (padrão): Piper fala o texto em português do Brasil e o OpenVoice v2 troca o timbre pela voz da amostra. MIT: uso comercial permitido.
  xtts: XTTS v2 (Coqui) clona a voz direto em português a partir de ~6 s de amostra; melhor qualidade. Licença CPML: só uso NÃO comercial.
Roda em CPU (lento: ~1x a 3x o tempo do áudio; o XTTS é mais lento).

Instalar uma vez:   python voz_local.py instalar [--motor xtts]
Falar com a voz:    python voz_local.py falar --texto "Olá, tudo bem?" --amostra minha_voz.wav --saida saida.wav [--motor xtts]
Só a voz padrão:    python voz_local.py falar --texto "..." --saida saida.wav           (openvoice sem --amostra: voz do Piper)

Tudo fica em VOZ_LOCAL_DIR (padrão: ~/.segundo-cerebro/voz-local): ambiente Python próprio, modelos e cache.
Imprime uma linha JSON no fim: {"ok": true, "arquivo": "...", "segundos": 4.2, "tempo_s": 9.1}."""
import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request
import zipfile
from pathlib import Path

RAIZ = Path(os.environ.get("VOZ_LOCAL_DIR") or Path.home() / ".segundo-cerebro" / "voz-local")
VENV = RAIZ / "venv"
PY = VENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
VOZ_PIPER = "pt_BR-faber-medium"
OPENVOICE_GIT = "git+https://github.com/myshell-ai/OpenVoice.git"
CONVERSOR_ZIP = "https://myshell-public-repo-host.s3.amazonaws.com/openvoice/checkpoints_v2_0417.zip"


def _sh(cmd, **kw):
    print("+", " ".join(str(c) for c in cmd), file=sys.stderr, flush=True)
    subprocess.run([str(c) for c in cmd], check=True, **kw)


def instalar(motor="openvoice"):
    RAIZ.mkdir(parents=True, exist_ok=True)
    if not PY.exists():
        _sh([sys.executable, "-m", "venv", VENV])
    _sh([PY, "-m", "pip", "install", "-q", "--upgrade", "pip"])
    # torch só de CPU (bem menor), depois as dependências que o conversor do OpenVoice usa de fato
    _sh([PY, "-m", "pip", "install", "-q", "torch", "torchaudio", "--index-url", "https://download.pytorch.org/whl/cpu"])
    if motor == "xtts":
        # coqui-tts: continuação mantida do Coqui TTS (Idiap). O modelo XTTS v2 (~1,8 GB) baixa no primeiro uso
        _sh([PY, "-m", "pip", "install", "-q", "coqui-tts"])
        print(json.dumps({"ok": True, "pasta": str(RAIZ), "motor": "xtts", "aviso": "XTTS v2: licença CPML, só uso não comercial"}))
        return
    _sh([PY, "-m", "pip", "install", "-q", "piper-tts", "librosa", "soundfile", "numpy", "pydub", "inflect", "unidecode", "eng_to_ipa", "pypinyin", "jieba", "cn2an"])
    # o pacote do OpenVoice fixa versões antigas de tudo: instala sem dependências (só o conversor de timbre é usado)
    _sh([PY, "-m", "pip", "install", "-q", "--no-deps", OPENVOICE_GIT])
    ck = RAIZ / "checkpoints_v2"
    if not (ck / "converter" / "checkpoint.pth").exists():
        z = RAIZ / "checkpoints_v2.zip"
        print("baixando o conversor do OpenVoice v2...", file=sys.stderr, flush=True)
        urllib.request.urlretrieve(CONVERSOR_ZIP, z)
        with zipfile.ZipFile(z) as f:
            f.extractall(RAIZ)
        z.unlink()
    vozes = RAIZ / "piper"
    vozes.mkdir(exist_ok=True)
    if not (vozes / f"{VOZ_PIPER}.onnx").exists():
        _sh([PY, "-m", "piper.download_voices", VOZ_PIPER, "--data-dir", vozes])
    print(json.dumps({"ok": True, "pasta": str(RAIZ)}))


def _dentro_do_venv():
    return Path(sys.executable).resolve() == PY.resolve()


def falar(texto, amostra, saida, motor="openvoice"):
    if not _dentro_do_venv():  # roda de novo com o Python do ambiente da voz
        if not PY.exists():
            sys.exit(json.dumps({"ok": False, "erro": "voz local não instalada: rode 'python voz_local.py instalar' (uma vez, ~2 GB)"}))
        args = [PY, __file__, "falar", "--motor", motor, "--texto", texto, "--saida", saida] + (["--amostra", amostra] if amostra else [])
        sys.exit(subprocess.run([str(a) for a in args]).returncode)
    import wave
    t0 = time.time()
    if motor == "xtts":
        if not amostra:
            sys.exit(json.dumps({"ok": False, "erro": "o XTTS precisa de uma amostra da voz (--amostra, 6 a 30 s de fala limpa)"}))
        os.environ.setdefault("COQUI_TOS_AGREED", "1")  # o usuário escolheu o XTTS sabendo da licença não comercial
        os.environ.setdefault("TTS_HOME", str(RAIZ / "modelos"))
        import torch
        torch.set_num_threads(max(1, (os.cpu_count() or 2) - 1))
        from TTS.api import TTS
        tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cpu")
        saida = Path(saida).resolve()
        saida.parent.mkdir(parents=True, exist_ok=True)
        tts.tts_to_file(text=texto, speaker_wav=str(Path(amostra).resolve()), language="pt", file_path=str(saida))
        with wave.open(str(saida), "rb") as wf:
            seg = wf.getnframes() / float(wf.getframerate())
        print(json.dumps({"ok": True, "arquivo": str(saida), "segundos": round(seg, 1), "tempo_s": round(time.time() - t0, 1), "motor": "xtts"}))
        return
    from piper import PiperVoice
    saida = Path(saida).resolve()
    saida.parent.mkdir(parents=True, exist_ok=True)
    base = saida.with_name(saida.stem + ".base.wav") if amostra else saida
    voz = PiperVoice.load(str(RAIZ / "piper" / f"{VOZ_PIPER}.onnx"))
    with wave.open(str(base), "wb") as wf:
        voz.synthesize_wav(texto, wf)
    if amostra:
        import torch
        from openvoice.api import ToneColorConverter
        torch.set_num_threads(max(1, (os.cpu_count() or 2) - 1))
        ck = RAIZ / "checkpoints_v2" / "converter"
        conv = ToneColorConverter(str(ck / "config.json"), device="cpu", enable_watermark=False)
        conv.load_ckpt(str(ck / "checkpoint.pth"))
        alvo = conv.extract_se([str(Path(amostra).resolve())])
        origem = conv.extract_se([str(base)])
        conv.convert(audio_src_path=str(base), src_se=origem, tgt_se=alvo, output_path=str(saida))
        base.unlink(missing_ok=True)
    with wave.open(str(saida), "rb") as wf:
        seg = wf.getnframes() / float(wf.getframerate())
    print(json.dumps({"ok": True, "arquivo": str(saida), "segundos": round(seg, 1), "tempo_s": round(time.time() - t0, 1)}))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    i = sub.add_parser("instalar")
    i.add_argument("--motor", choices=["openvoice", "xtts"], default="openvoice")
    f = sub.add_parser("falar")
    f.add_argument("--motor", choices=["openvoice", "xtts"], default="openvoice")
    f.add_argument("--texto", required=True)
    f.add_argument("--amostra")
    f.add_argument("--saida", required=True)
    a = ap.parse_args()
    instalar(a.motor) if a.cmd == "instalar" else falar(a.texto, a.amostra, a.saida, a.motor)
