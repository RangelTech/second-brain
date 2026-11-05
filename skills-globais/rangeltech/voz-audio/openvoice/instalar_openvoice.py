"""Monta o ambiente do OpenVoice V2 em CPU, numa pasta isolada, e baixa os pesos do conversor.

Uso:  python instalar_openvoice.py --destino <pasta>   (ex.: <dados>/hermes-home/cache/scratch/openvoice)
Cria <destino>/venv (Python 3.10) e <destino>/checkpoints_v2/converter. Leva alguns minutos e baixa cerca de 1 GB.
Depois:  <destino>/venv/Scripts/python converter_voz.py --origem a.wav --referencia b.wav --saida c.wav --checkpoints <destino>/checkpoints_v2
"""
import argparse, glob, os, shutil, subprocess, sys, urllib.request

HF = "https://huggingface.co/myshell-ai/OpenVoiceV2/resolve/main/converter/"
AQUI = os.path.dirname(os.path.abspath(__file__))


def rodar(cmd, **kw):
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True, **kw)


def python310():
    for cand in (["py", "-3.10"], ["python3.10"]):
        try:
            if subprocess.run(cand + ["--version"], capture_output=True, text=True).stdout.strip().startswith("Python 3.10"):
                return cand
        except Exception:
            pass
    return None


def uv():
    p = shutil.which("uv")
    if p:
        return p
    for pad in (os.path.join(os.environ.get("SB_DATA_DIR", ""), "hermes-home", "cache", "uv*"),
                os.path.join(os.environ.get("APPDATA", ""), "SegundoCerebro", "hermes-home", "**", "uv.exe"),
                os.path.join(os.path.expanduser("~"), ".local", "bin", "uv")):
        for c in glob.glob(pad, recursive=True):
            if os.path.isfile(c):
                return c
    return None


def baixar(url, destino):
    if os.path.exists(destino) and os.path.getsize(destino) > 0:
        return
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    print("baixando", url, flush=True)
    urllib.request.urlretrieve(url, destino)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--destino", required=True)
    a = ap.parse_args()
    d = os.path.abspath(a.destino)
    venv = os.path.join(d, "venv")
    py = os.path.join(venv, "Scripts" if os.name == "nt" else "bin", "python")
    os.makedirs(d, exist_ok=True)
    if not os.path.exists(py) and not os.path.exists(py + ".exe"):
        p310 = python310()
        if p310:
            rodar(p310 + ["-m", "venv", venv])
        elif uv():
            rodar([uv(), "venv", "--python", "3.10", venv])
        else:
            sys.exit("Python 3.10 não encontrado e sem uv: instale o uv (pip install uv) e rode de novo")
    # uv venv não traz pip: use `uv pip` se for o caso
    usar_uv = not subprocess.run([py, "-m", "pip", "--version"], capture_output=True).returncode == 0
    pip = [uv(), "pip", "install", "--python", py] if usar_uv else [py, "-m", "pip", "install"]
    rodar(pip + ["torch==2.14.1+cpu", "torchaudio==2.11.1+cpu", "--extra-index-url", "https://download.pytorch.org/whl/cpu"])
    rodar(pip + ["-r", os.path.join(AQUI, "requirements-cpu.txt")])
    rodar(pip + ["--no-deps", "git+https://github.com/myshell-ai/OpenVoice.git"])
    for nome in ("config.json", "checkpoint.pth"):
        baixar(HF + nome, os.path.join(d, "checkpoints_v2", "converter", nome))
    print("OK ambiente em", d)


main()
