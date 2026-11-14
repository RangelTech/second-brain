"""Ambiente Python PRONTO para gerar Word, Excel e PowerPoint (python-docx, openpyxl, XlsxWriter, python-pptx, Pillow).
Roda com qualquer Python 3.8+ (até o do Cérebro Pro, variável SB_PYTHON). Monta ~/.segundo-cerebro/docs com Python 3.12
pelo uv do app, a partir do pacote NOSSO (release escritorio-v1, sha256 conferido). Sem PyPI, sem compilador.

    python ambiente_docs.py preparar               -> {"ok": true, "python": "<python do ambiente>"}
    python ambiente_docs.py rodar meu_script.py ...  -> roda o seu script com o python do ambiente (prepara antes, se precisar)
"""
import glob
import hashlib
import json
import os
import platform
import shutil
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

RAIZ = Path(os.environ.get("DOCS_DIR") or Path.home() / ".segundo-cerebro" / "docs")
VENV = RAIZ / "venv"
PY = VENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
NOSSA = "https://github.com/RangelTech/segundo-cerebro-artefatos/releases/download/escritorio-v1/"
PACOTES = {
    "win_amd64": ("fb3ee82ce7ec0b27afca669eb26cbefa2ccf7e132e0b28f8aace3640b638fff3", "docs-rodas-win_amd64-cp312.zip"),
    "linux_x86_64": ("3e63642fde4fd756d9b87f208aea7c6d961ced50d2c75bfe5926ede1f4eb404f", "docs-rodas-linux_x86_64-cp312.zip"),
}
FIXOS = ["python-docx==1.2.0", "openpyxl==3.1.5", "XlsxWriter==3.3.1", "python-pptx==1.0.2", "pillow==13.0.0", "lxml==6.1.3"]


def _log(m):
    print(m, file=sys.stderr, flush=True)


def _urlretrieve(url, destino):
    """Baixa com o Python; se o TLS do Python falhar (certificado que só o sistema conhece), usa o curl do sistema."""
    try:
        urllib.request.urlretrieve(url, destino)
    except Exception as e:  # noqa: BLE001
        if "CERTIFICATE" not in str(e).upper() and "SSL" not in str(e).upper():
            raise
        curl = shutil.which("curl") or shutil.which("curl.exe")
        if not curl:
            raise
        subprocess.run([curl, "-fsSL", "--retry", "3", "-o", str(destino), url], check=True)


def _sistema():
    m = platform.machine().lower()
    if os.name == "nt" and m in ("amd64", "x86_64"):
        return "win_amd64"
    if sys.platform.startswith("linux") and m in ("x86_64", "amd64"):
        return "linux_x86_64"
    return sys.platform + "_" + m


def _uv():
    exe = "uv.exe" if os.name == "nt" else "uv"
    cands = [os.environ.get("SB_UV"), shutil.which("uv")]
    for b in (os.environ.get("APPDATA", ""), str(Path.home() / ".config"), str(Path.home() / "Library" / "Application Support")):
        for nome in ("SegundoCerebro", "Segundo Cérebro", "segundo-cerebro", "Cérebro Pro"):
            cands += sorted(glob.glob(os.path.join(b, nome, "hermes*", "tools", "uv-*", exe)), reverse=True)
    return next((c for c in cands if c and os.path.isfile(c)), None)


def _ok():
    return PY.exists() and subprocess.run([str(PY), "-c", "import docx, openpyxl, xlsxwriter, pptx, PIL"], capture_output=True).returncode == 0


def preparar(silencioso=False):
    if _ok():
        return str(PY)
    RAIZ.mkdir(parents=True, exist_ok=True)
    uv = _uv()
    if not PY.exists():
        if uv:
            subprocess.run([uv, "venv", "--python", "3.12", "--seed", str(VENV)], check=True, stdout=sys.stderr)
        else:
            subprocess.run([sys.executable, "-m", "venv", str(VENV)], check=True, stdout=sys.stderr)
    pip = [uv, "pip", "install", "--python", str(PY)] if uv else [str(PY), "-m", "pip", "install", "-q"]
    sha, nome = PACOTES.get(_sistema(), ("", ""))
    feito = False
    if sha:
        zipf = RAIZ / nome
        try:
            _log(f"baixando {nome} (pacote nosso)...")
            _urlretrieve(NOSSA + nome, zipf)
            if hashlib.sha256(zipf.read_bytes()).hexdigest() != sha:
                raise RuntimeError("sha256 não confere")
            pasta = RAIZ / "rodas"
            shutil.rmtree(pasta, ignore_errors=True)
            with zipfile.ZipFile(zipf) as z:
                z.extractall(pasta)
            subprocess.run(pip + ["--no-index", "--find-links", str(pasta), "-r", str(pasta / "requisitos.txt")], check=True, stdout=sys.stderr)
            shutil.rmtree(pasta, ignore_errors=True)
            feito = True
        except Exception as e:  # noqa: BLE001
            _log(f"pacote nosso falhou ({e}); usando a internet")
        finally:
            zipf.unlink(missing_ok=True)
    if not feito:
        subprocess.run(pip + FIXOS, check=True, stdout=sys.stderr)
    if not _ok():
        raise SystemExit(json.dumps({"ok": False, "erro": "o ambiente de documentos não ficou pronto"}))
    return str(PY)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "preparar"
    if cmd == "preparar":
        print(json.dumps({"ok": True, "python": preparar()}, ensure_ascii=False))
    elif cmd == "rodar" and len(sys.argv) > 2:
        py = preparar()
        sys.exit(subprocess.run([py] + sys.argv[2:]).returncode)
    else:
        print(__doc__)
        sys.exit(2)
