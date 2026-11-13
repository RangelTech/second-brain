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
from pathlib import Path

RAIZ = Path(os.environ.get("VOZ_LOCAL_DIR") or Path.home() / ".segundo-cerebro" / "voz-local")
VENV = RAIZ / "venv"
PY = VENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
VOZ_PIPER = "pt_BR-faber-medium"
OPENVOICE_GIT = "git+https://github.com/myshell-ai/OpenVoice.git@74a1d147b17a8c3092dd5430504bd83ef6c7eb23"  # commit testado
# snapshot NOSSO (release voz-local-v1); a origem oficial só se a nossa falhar. sha256 conferido sempre.
NOSSA = "https://github.com/RangelTech/segundo-cerebro-artefatos/releases/download/voz-local-v1/"
ARQUIVOS = {
    "openvoice-v2-converter-config.json": ("9dfff60350b8c63f2c664efd92a61b2516efb22671466960f0e5dfebd881fa47", "https://huggingface.co/myshell-ai/OpenVoiceV2/resolve/main/converter/config.json"),
    "openvoice-v2-converter-checkpoint.pth": ("9652c27e92b6b2a91632590ac9962ef7ae2b712e5c5b7f4c34ec55ee2b37ab9e", "https://huggingface.co/myshell-ai/OpenVoiceV2/resolve/main/converter/checkpoint.pth"),
    "piper-pt_BR-faber-medium.onnx": ("75e913eb463db0b6ac7ddf68d3e4c9ac19ace36dc3b710a81039b448352b8ffc", "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx"),
    "piper-pt_BR-faber-medium.onnx.json": ("fa8a8fecb01ae198bc416381e368d3206f85bad1449a0f11e1f6a9edf85a32f1", "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx.json"),
}
# versões que funcionaram juntas (13/11/2026, Python 3.12)
PIP_BASE = ["piper-tts==1.8.0", "librosa==1.0.1", "soundfile==0.14.0", "numpy==2.5.4", "pydub", "inflect", "unidecode", "eng_to_ipa", "pypinyin", "jieba", "cn2an"]
PIP_TORCH = ["torch==2.15.0", "torchaudio==2.11.1"]
PIP_XTTS = ["coqui-tts[codec]==0.28.0", "six"]
CONVERSOR_HF = "https://huggingface.co/myshell-ai/OpenVoiceV2/resolve/main/converter/"  # fonte oficial (MyShell) do conversor v2


def _baixar(nome, destino):
    """Baixa da nossa release (ou da origem, se a nossa falhar) e confere o sha256; arquivo que não confere é apagado."""
    import hashlib
    sha, origem = ARQUIVOS[nome]
    destino = Path(destino)
    if destino.exists() and hashlib.sha256(destino.read_bytes()).hexdigest() == sha:
        return
    for url in (NOSSA + nome, origem):
        try:
            print(f"baixando {nome} de {url.split('/')[2]}...", file=sys.stderr, flush=True)
            tmp = destino.with_suffix(destino.suffix + ".parcial")
            urllib.request.urlretrieve(url, tmp)
            if hashlib.sha256(tmp.read_bytes()).hexdigest() == sha:
                tmp.replace(destino)
                return
            tmp.unlink(missing_ok=True)
            print(f"  {nome}: sha256 não confere, tentando a próxima origem", file=sys.stderr, flush=True)
        except Exception as e:  # noqa: BLE001
            print(f"  falhou ({e}), tentando a próxima origem", file=sys.stderr, flush=True)
    raise SystemExit(json.dumps({"ok": False, "erro": f"não consegui baixar {nome} conferido"}))


def _sh(cmd, **kw):
    print("+", " ".join(str(c) for c in cmd), file=sys.stderr, flush=True)
    subprocess.run([str(c) for c in cmd], check=True, **kw)


def instalar(motor="openvoice"):
    RAIZ.mkdir(parents=True, exist_ok=True)
    if not PY.exists():
        _sh([sys.executable, "-m", "venv", VENV])
    _sh([PY, "-m", "pip", "install", "-q", "--upgrade", "pip"])
    # torch só de CPU (bem menor), depois as dependências que o conversor do OpenVoice usa de fato
    _sh([PY, "-m", "pip", "install", "-q", *PIP_TORCH, "--index-url", "https://download.pytorch.org/whl/cpu"])
    if motor == "xtts":
        # coqui-tts: continuação mantida do Coqui TTS (Idiap). O modelo XTTS v2 (~1,8 GB) baixa no primeiro uso
        _sh([PY, "-m", "pip", "install", "-q", *PIP_XTTS])
        print(json.dumps({"ok": True, "pasta": str(RAIZ), "motor": "xtts", "aviso": "XTTS v2: licença CPML, só uso não comercial"}))
        return
    _sh([PY, "-m", "pip", "install", "-q", *PIP_BASE])
    # o pacote do OpenVoice fixa versões antigas de tudo: instala sem dependências (só o conversor de timbre é usado)
    _sh([PY, "-m", "pip", "install", "-q", "--no-deps", OPENVOICE_GIT])
    ck = RAIZ / "checkpoints_v2" / "converter"
    ck.mkdir(parents=True, exist_ok=True)
    _baixar("openvoice-v2-converter-config.json", ck / "config.json")
    _baixar("openvoice-v2-converter-checkpoint.pth", ck / "checkpoint.pth")
    vozes = RAIZ / "piper"
    vozes.mkdir(exist_ok=True)
    _baixar("piper-pt_BR-faber-medium.onnx", vozes / f"{VOZ_PIPER}.onnx")
    _baixar("piper-pt_BR-faber-medium.onnx.json", vozes / f"{VOZ_PIPER}.onnx.json")
    print(json.dumps({"ok": True, "pasta": str(RAIZ)}))


def _dentro_do_venv():
    return Path(sys.prefix).resolve() == VENV.resolve()  # no Linux o python do venv é atalho para o do sistema: compara o prefixo


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
        import types
        sys.modules.setdefault("wavmark", types.SimpleNamespace(load_model=lambda: types.SimpleNamespace(to=lambda *_: None)))  # sem marca d'água (e sem o pacote wavmark)
        conv = ToneColorConverter(str(ck / "config.json"), device="cpu")
        conv.watermark_model = None
        conv.load_ckpt(str(ck / "checkpoint.pth"))
        alvo = conv.extract_se([str(Path(amostra).resolve())])
        origem = conv.extract_se([str(base)])
        conv.convert(audio_src_path=str(base), src_se=origem, tgt_se=alvo, output_path=str(saida), message="")
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
