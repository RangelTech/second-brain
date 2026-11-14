"""Voz clonada LOCAL e de graça (sem créditos), dois motores:
  openvoice (padrão): Piper fala o texto em português do Brasil e o OpenVoice v2 troca o timbre pela voz da amostra. MIT: uso comercial permitido.
  xtts: XTTS v2 (Coqui) clona a voz direto em português a partir de ~6 s de amostra; melhor qualidade. Licença CPML: só uso NÃO comercial.

Este arquivo roda com QUALQUER Python 3.8+ (até o do próprio Cérebro Pro): ele monta sozinho um ambiente próprio com Python 3.12
(pelo uv que vem com o app) e instala os pacotes do PACOTE DE RODAS NOSSO (release voz-local-v2), sem depender do PyPI nem do git.

Preparar (uma vez):  python voz_local.py instalar [--motor openvoice|xtts|ambos]
Ver se está pronto:  python voz_local.py estado
Falar com a voz:     python voz_local.py falar --texto "Olá, tudo bem?" --amostra minha_voz.wav --saida saida.wav [--motor xtts]

RÁPIDO: o primeiro "falar" deixa um servidor local com o modelo carregado na memória (fecha sozinho após 20 min parado). As falas
seguintes não recarregam o modelo nem a amostra: só geram. Use --sem-servidor para rodar tudo num processo só.
Tudo fica em VOZ_LOCAL_DIR (padrão: ~/.segundo-cerebro/voz-local). Imprime uma linha JSON no fim: {"ok": true, "arquivo": ..., "segundos": ..., "tempo_s": ...}."""
import argparse
import glob
import hashlib
import json
import os
import platform
import shutil
import subprocess
import sys
import time
import urllib.request
import zipfile
from pathlib import Path

RAIZ = Path(os.environ.get("VOZ_LOCAL_DIR") or Path.home() / ".segundo-cerebro" / "voz-local")
VENV = RAIZ / "venv"
PY = VENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
INFO = RAIZ / "servidor.json"
VOZ_PIPER = "pt_BR-faber-medium"
PYTHON_DO_AMBIENTE = "3.12"
OPENVOICE_GIT = "git+https://github.com/myshell-ai/OpenVoice.git@74a1d147b17a8c3092dd5430504bd83ef6c7eb23"  # commit testado
# snapshot NOSSO; a origem oficial só se a nossa falhar. sha256 conferido sempre.
NOSSA = "https://github.com/RangelTech/segundo-cerebro-artefatos/releases/download/voz-local-v1/"
NOSSA_RODAS = "https://github.com/RangelTech/segundo-cerebro-artefatos/releases/download/voz-local-v2/"
ARQUIVOS = {
    "openvoice-v2-converter-config.json": ("9dfff60350b8c63f2c664efd92a61b2516efb22671466960f0e5dfebd881fa47", "https://huggingface.co/myshell-ai/OpenVoiceV2/resolve/main/converter/config.json"),
    "openvoice-v2-converter-checkpoint.pth": ("9652c27e92b6b2a91632590ac9962ef7ae2b712e5c5b7f4c34ec55ee2b37ab9e", "https://huggingface.co/myshell-ai/OpenVoiceV2/resolve/main/converter/checkpoint.pth"),
    "piper-pt_BR-faber-medium.onnx": ("75e913eb463db0b6ac7ddf68d3e4c9ac19ace36dc3b710a81039b448352b8ffc", "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx"),
    "piper-pt_BR-faber-medium.onnx.json": ("fa8a8fecb01ae198bc416381e368d3206f85bad1449a0f11e1f6a9edf85a32f1", "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx.json"),
}
# XTTS v2 (licença CPML, só uso não comercial; a licença vai junto). Snapshot nosso na voz-local-v2; origem: Hugging Face tts-hub/XTTS-v2
XTTS_HF = "https://huggingface.co/tts-hub/XTTS-v2/resolve/main/"
XTTS_ARQ = {
    "config.json": "d302a22c94a06726f978c1118a9250856c027f061f19b8c0d902794ca49ea2a5",
    "model.pth": "d5822cb1d4bf97c418855e326562a934caa20cef01ebf4c90bf792df0fd5b99e",
    "speakers_xtts.pth": "f0f6137c19a4eab0cbbe4c99b5babacf68b1746e50da90807708c10e645b943b",
    "vocab.json": "928260878a59da8a72a2a5b7687fea29d5106137669d90945430fe17e415304a",
    "mel_stats.pth": "1f69422a8a8f344c4fca2f0c6b8d41d2151d6615b7321e48e6bb15ae949b119c",
    "LICENSE.txt": "fda132099f7fbc6045f64d986e531528436bb62b6325213f45ce2a1f9e9cd58c",
}
XTTS_DIR = RAIZ / "modelos" / "xtts_v2"
# pacote de rodas (wheels) por sistema, Python 3.12: tudo o que os dois motores usam, travado nas versões testadas juntas.
# Dentro do zip: as rodas + requisitos.txt (lista travada). sha256 vazio = pacote ainda não publicado para esse sistema (usa a internet).
RODAS = {
    "win_amd64": ("13177a9f523841ac2b65ec1ee8d3880e28d1453cddec95ba733aae4e0e6aa1fd", "voz-rodas-win_amd64-cp312.zip"),
    "linux_x86_64": ("77c132a34ab0b24a803594b88a273b66c43ac7136ecea66a975d87841bbe4d01", "voz-rodas-linux_x86_64-cp312.zip"),
}
# versões que funcionaram juntas (13/11/2026, Python 3.12, Windows 11 e Ubuntu 24.04)
PIP_BASE = ["piper-tts==1.8.0", "librosa==1.0.1", "soundfile==0.14.0", "numpy==2.5.4", "pydub", "inflect", "unidecode", "eng_to_ipa", "pypinyin", "jieba", "cn2an"]
PIP_TORCH = ["torch==2.11.0", "torchaudio==2.11.1"]
PIP_XTTS = ["coqui-tts[codec]==0.28.0", "torchcodec==0.11.1", "six"]
INDICE_TORCH_CPU = "https://download.pytorch.org/whl/cpu"
OCIOSO_S = 20 * 60


def _log(msg):
    print(msg, file=sys.stderr, flush=True)


def _sh(cmd, **kw):
    _log("+ " + " ".join(str(c) for c in cmd))
    subprocess.run([str(c) for c in cmd], check=True, **kw)


def _sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


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
    """O uv que vem com o Cérebro Pro (ou um do sistema). Ele baixa o Python 3.12 do ambiente e instala rápido."""
    cands = [os.environ.get("SB_UV"), shutil.which("uv")]
    exe = "uv.exe" if os.name == "nt" else "uv"
    bases = [os.environ.get("APPDATA", ""), str(Path.home() / ".config"), str(Path.home() / "Library" / "Application Support")]
    for b in bases:
        for nome in ("SegundoCerebro", "Segundo Cérebro", "segundo-cerebro", "Cérebro Pro"):
            cands += sorted(glob.glob(os.path.join(b, nome, "hermes*", "tools", "uv-*", exe)), reverse=True)
    cands.append(str(Path.home() / ".local" / "bin" / exe))
    for c in cands:
        if c and os.path.isfile(c):
            return c
    return None


def _baixar_url(urls, destino, sha):
    destino = Path(destino)
    if destino.exists() and (not sha or _sha(destino) == sha):
        return True
    for url in urls:
        try:
            _log(f"baixando {destino.name} de {url.split('/')[2]}...")
            tmp = destino.with_suffix(destino.suffix + ".parcial")
            _urlretrieve(url, tmp)
            if not sha or _sha(tmp) == sha:
                tmp.replace(destino)
                return True
            tmp.unlink(missing_ok=True)
            _log(f"  {destino.name}: sha256 não confere, tentando a próxima origem")
        except Exception as e:  # noqa: BLE001
            _log(f"  falhou ({e}), tentando a próxima origem")
    return False


def _baixar(nome, destino):
    sha, origem = ARQUIVOS[nome]
    if not _baixar_url([NOSSA + nome, origem], destino, sha):
        raise SystemExit(json.dumps({"ok": False, "erro": f"não consegui baixar {nome} conferido"}))


def _baixar_xtts():
    XTTS_DIR.mkdir(parents=True, exist_ok=True)
    for nome, sha in XTTS_ARQ.items():
        if not _baixar_url([NOSSA_RODAS + "xtts-v2-" + nome, XTTS_HF + nome], XTTS_DIR / nome, sha):
            raise SystemExit(json.dumps({"ok": False, "erro": f"não consegui baixar o XTTS ({nome}) conferido"}))


def _pacote_de_rodas():
    """Baixa e abre o pacote de rodas nosso deste sistema. Devolve a pasta (com requisitos.txt) ou None se não houver."""
    sha, nome = RODAS.get(_sistema(), ("", ""))
    if not sha or os.environ.get("VOZ_LOCAL_SEM_PACOTE"):
        return None
    pasta = RAIZ / "rodas"
    marca = pasta / ".sha256"
    if marca.exists() and marca.read_text().strip() == sha:
        return pasta
    zipf = RAIZ / nome
    if not _baixar_url([NOSSA_RODAS + nome], zipf, sha):
        _log("pacote de rodas indisponível: instalando pela internet")
        return None
    shutil.rmtree(pasta, ignore_errors=True)
    with zipfile.ZipFile(zipf) as z:
        z.extractall(pasta)
    marca.write_text(sha)
    zipf.unlink(missing_ok=True)
    return pasta


def _criar_ambiente():
    RAIZ.mkdir(parents=True, exist_ok=True)
    uv = _uv()
    if PY.exists():
        v = subprocess.run([str(PY), "-c", "import sys; print('%d.%d' % sys.version_info[:2])"], capture_output=True, text=True).stdout.strip()
        if v == PYTHON_DO_AMBIENTE or not uv:
            return
        _log(f"ambiente com Python {v or '?'} (precisa {PYTHON_DO_AMBIENTE}): refazendo")
        shutil.rmtree(VENV, ignore_errors=True)
        (RAIZ / ".rodas-instaladas").unlink(missing_ok=True)
    if uv:
        _sh([uv, "venv", "--python", PYTHON_DO_AMBIENTE, "--seed", VENV])
    elif sys.version_info >= (3, 11):
        _sh([sys.executable, "-m", "venv", VENV])
    else:
        raise SystemExit(json.dumps({"ok": False, "erro": "preciso do uv (vem com o Cérebro Pro) ou de Python 3.11+ para montar o ambiente da voz"}))


def _pip(*args):
    uv = _uv()
    base = [uv, "pip", "install", "--python", PY] if uv else [PY, "-m", "pip", "install", "-q"]
    _sh(base + list(args))


def instalar(motor="openvoice"):
    t0 = time.time()
    _criar_ambiente()
    sha_pacote = RODAS.get(_sistema(), ("",))[0]
    feito = RAIZ / ".rodas-instaladas"
    ja = bool(sha_pacote) and feito.exists() and feito.read_text().strip() == sha_pacote
    rodas = None if ja else _pacote_de_rodas()
    if ja:
        rodas = True  # o pacote nosso já foi instalado antes: nada a fazer nos pacotes
    elif rodas:
        # tudo travado e sem internet: as duas engines vêm juntas no pacote
        _pip("--no-index", "--find-links", rodas, "--no-deps", "-r", rodas / "requisitos.txt")
        feito.write_text(sha_pacote)
        shutil.rmtree(rodas, ignore_errors=True)  # as rodas já viraram ambiente: não deixa 400 MB parados
    else:
        _pip(*PIP_TORCH, "--index-url", INDICE_TORCH_CPU)
        if motor in ("xtts", "ambos"):
            _pip(*PIP_XTTS, "--extra-index-url", INDICE_TORCH_CPU, "--index-strategy", "unsafe-best-match") if _uv() else _pip(*PIP_XTTS)
        if motor in ("openvoice", "ambos"):
            _pip(*PIP_BASE)
            _pip("--no-deps", OPENVOICE_GIT)  # o pacote do OpenVoice fixa versões antigas de tudo: só o conversor é usado
    if motor in ("openvoice", "ambos") or rodas:
        ck = RAIZ / "checkpoints_v2" / "converter"
        ck.mkdir(parents=True, exist_ok=True)
        _baixar("openvoice-v2-converter-config.json", ck / "config.json")
        _baixar("openvoice-v2-converter-checkpoint.pth", ck / "checkpoint.pth")
        vozes = RAIZ / "piper"
        vozes.mkdir(exist_ok=True)
        _baixar("piper-pt_BR-faber-medium.onnx", vozes / f"{VOZ_PIPER}.onnx")
        _baixar("piper-pt_BR-faber-medium.onnx.json", vozes / f"{VOZ_PIPER}.onnx.json")
    if motor in ("xtts", "ambos"):
        _baixar_xtts()
    r = {"ok": True, "pasta": str(RAIZ), "motor": motor, "pacote_nosso": bool(rodas), "tempo_s": round(time.time() - t0, 1)}
    if motor in ("xtts", "ambos") or rodas:
        r["aviso"] = "XTTS v2: licença CPML, só uso não comercial" + ("" if motor in ("xtts", "ambos") else ". O modelo (~1,8 GB) baixa no primeiro uso do XTTS.")
    print(json.dumps(r, ensure_ascii=False))


def _tem(modulo):
    if not PY.exists():
        return False
    return subprocess.run([str(PY), "-c", f"import {modulo}"], capture_output=True).returncode == 0


def estado():
    srv = _servidor_vivo()
    print(json.dumps({
        "pasta": str(RAIZ), "ambiente": PY.exists(), "openvoice": _tem("openvoice") and (RAIZ / "piper" / f"{VOZ_PIPER}.onnx").exists(),
        "xtts": _tem("TTS"), "modelo_xtts_baixado": (XTTS_DIR / "model.pth").exists(),
        "servidor": bool(srv), "uv": bool(_uv()), "sistema": _sistema(), "pacote_nosso_disponivel": bool(RODAS.get(_sistema(), ("",))[0]),
    }, ensure_ascii=False))


# ------------------------------- geração (roda dentro do ambiente) -------------------------------
_CACHE = {}


def _threads():
    import torch
    n = int(os.environ.get("VOZ_LOCAL_THREADS") or 0) or max(1, (os.cpu_count() or 2) - 1)
    torch.set_num_threads(n)


def _segundos(arq):
    import wave
    with wave.open(str(arq), "rb") as wf:
        return wf.getnframes() / float(wf.getframerate())


def _gravar_wav(arq, amostras, taxa):
    import wave
    import numpy as np
    a = np.asarray(amostras, dtype="float32").reshape(-1)
    a = (np.clip(a, -1.0, 1.0) * 32767).astype("<i2")
    with wave.open(str(arq), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(taxa)
        wf.writeframes(a.tobytes())


def _frases(texto, maximo=200):
    """Quebra em frases de até ~200 caracteres (limite do XTTS em português), sem spaCy."""
    import re
    blocos, atual = [], ""
    for f in re.split(r"(?<=[.!?…;:])\s+", " ".join(str(texto).split())):
        while len(f) > maximo:  # frase enorme: corta na última vírgula ou espaço antes do limite
            corte = max(f.rfind(",", 0, maximo), f.rfind(" ", 0, maximo))
            corte = corte if corte > 40 else maximo
            if atual:
                blocos.append(atual)
                atual = ""
            blocos.append(f[: corte + 1].strip())
            f = f[corte + 1 :].strip()
        if len(atual) + len(f) + 1 <= maximo:
            atual = (atual + " " + f).strip()
        else:
            if atual:
                blocos.append(atual)
            atual = f
    if atual:
        blocos.append(atual)
    return [b for b in blocos if b.strip()]


def _xtts():
    if "xtts" not in _CACHE:
        os.environ.setdefault("COQUI_TOS_AGREED", "1")  # o usuário escolheu o XTTS sabendo da licença não comercial
        if not (XTTS_DIR / "model.pth").exists():
            _baixar_xtts()
        _threads()
        import TTS.tts.models.xtts as modxtts
        from TTS.tts.configs.xtts_config import XttsConfig

        def _ler_audio(caminho, taxa):
            # lê a amostra com soundfile: o padrão (torchaudio -> torchcodec) exige DLLs do FFmpeg no Windows e quebra
            import soundfile as sf
            import torch
            import torchaudio.functional as taf
            a, sr = sf.read(str(caminho), dtype="float32", always_2d=True)
            t = torch.from_numpy(a.T.copy()).mean(0, keepdim=True)
            if sr != taxa:
                t = taf.resample(t, sr, taxa)
            return t.clamp(-1, 1)

        modxtts.load_audio = _ler_audio
        cfg = XttsConfig()
        cfg.load_json(str(XTTS_DIR / "config.json"))
        m = modxtts.Xtts.init_from_config(cfg)
        m.load_checkpoint(cfg, checkpoint_dir=str(XTTS_DIR), use_deepspeed=False)
        m.eval()
        _CACHE["xtts"] = m
    return _CACHE["xtts"]


def _conversor():
    if "conv" not in _CACHE:
        import types
        _threads()
        sys.modules.setdefault("wavmark", types.SimpleNamespace(load_model=lambda: types.SimpleNamespace(to=lambda *_: None)))  # sem marca d'água
        from openvoice.api import ToneColorConverter
        ck = RAIZ / "checkpoints_v2" / "converter"
        conv = ToneColorConverter(str(ck / "config.json"), device="cpu")
        conv.watermark_model = None
        conv.load_ckpt(str(ck / "checkpoint.pth"))
        _CACHE["conv"] = conv
    return _CACHE["conv"]


def _piper():
    if "piper" not in _CACHE:
        from piper import PiperVoice
        _CACHE["piper"] = PiperVoice.load(str(RAIZ / "piper" / f"{VOZ_PIPER}.onnx"))
    return _CACHE["piper"]


def gerar(texto, amostra, saida, motor="openvoice", idioma="pt", temperatura=None, semente=None):
    import wave
    t0 = time.time()
    saida = Path(saida).resolve()
    saida.parent.mkdir(parents=True, exist_ok=True)
    chave_amostra = (motor, _sha(amostra)) if amostra else None
    if motor == "xtts":
        if not amostra:
            return {"ok": False, "erro": "o XTTS precisa de uma amostra da voz (--amostra, 6 a 30 s de fala limpa)"}
        m = _xtts()
        if chave_amostra not in _CACHE:  # a voz da amostra é calculada uma vez só por amostra
            _CACHE[chave_amostra] = m.get_conditioning_latents(audio_path=[str(Path(amostra).resolve())], gpt_cond_len=30, max_ref_length=60)
        gpt, spk = _CACHE[chave_amostra]
        # divide em frases aqui (o enable_text_splitting do coqui exige spaCy, que não vem no pacote) e junta com pausas curtas
        import numpy as np
        partes = []
        if semente is not None:
            import torch
            torch.manual_seed(int(semente))
        extra = {"temperature": float(temperatura)} if temperatura is not None else {}
        for frase in _frases(_por_extenso(texto, idioma)):
            partes.append(np.asarray(m.inference(frase, idioma, gpt, spk, **extra)["wav"], dtype="float32").reshape(-1))
            partes.append(np.zeros(int(24000 * 0.18), dtype="float32"))
        _gravar_wav(saida, np.concatenate(partes[:-1]) if partes else np.zeros(1, dtype="float32"), 24000)
        return {"ok": True, "arquivo": str(saida), "segundos": round(_segundos(saida), 1), "tempo_s": round(time.time() - t0, 1), "motor": "xtts"}
    base = saida.with_name(saida.stem + ".base.wav") if amostra else saida
    with wave.open(str(base), "wb") as wf:
        _piper().synthesize_wav(texto, wf)
    if amostra:
        conv = _conversor()
        if chave_amostra not in _CACHE:
            _CACHE[chave_amostra] = conv.extract_se([str(Path(amostra).resolve())])
        origem = conv.extract_se([str(base)])
        conv.convert(audio_src_path=str(base), src_se=origem, tgt_se=_CACHE[chave_amostra], output_path=str(saida), message="")
        base.unlink(missing_ok=True)
    return {"ok": True, "arquivo": str(saida), "segundos": round(_segundos(saida), 1), "tempo_s": round(time.time() - t0, 1), "motor": "openvoice"}


def trocar_timbre(entrada, amostra, saida):
    """Troca o timbre de uma fala que já existe (OpenVoice): mesmas palavras, ritmo e entonação, com a voz da amostra."""
    t0 = time.time()
    conv = _conversor()
    chave = ("openvoice", _sha(amostra))
    if chave not in _CACHE:
        _CACHE[chave] = conv.extract_se([str(Path(amostra).resolve())])
    origem = conv.extract_se([str(entrada)])
    saida = Path(saida).resolve()
    saida.parent.mkdir(parents=True, exist_ok=True)
    conv.convert(audio_src_path=str(entrada), src_se=origem, tgt_se=_CACHE[chave], output_path=str(saida), message="")
    return {"ok": True, "arquivo": str(saida), "segundos": round(_segundos(saida), 1), "tempo_s": round(time.time() - t0, 1), "motor": "openvoice-troca"}


# ------------------------------- servidor residente (modelo fica na memória) -------------------------------
def servir():
    import threading
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    trava = threading.Lock()
    ultimo = [time.time()]

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def _resp(self, obj, cod=200):
            b = json.dumps(obj, ensure_ascii=False).encode("utf-8")
            self.send_response(cod)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(b)))
            self.end_headers()
            self.wfile.write(b)

        def do_GET(self):
            self._resp({"ok": True, "pid": os.getpid(), "carregados": [k for k in _CACHE if isinstance(k, str)]})

        def do_POST(self):
            try:
                a = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
                with trava:
                    ultimo[0] = time.time()
                    if a.get("acao") == "trocar":
                        r = trocar_timbre(a["entrada"], a["amostra"], a["saida"])
                    else:
                        r = gerar(a["texto"], a.get("amostra"), a["saida"], a.get("motor") or "openvoice", a.get("idioma") or "pt")
                    ultimo[0] = time.time()
                self._resp(r)
            except Exception as e:  # noqa: BLE001
                self._resp({"ok": False, "erro": f"{type(e).__name__}: {e}"}, 500)

    srv = ThreadingHTTPServer(("127.0.0.1", 0), H)  # responde "estou vivo" mesmo gerando (a geração tem trava própria)

    def vigia():
        while True:
            time.sleep(30)
            if time.time() - ultimo[0] > OCIOSO_S and not trava.locked():
                INFO.unlink(missing_ok=True)
                os._exit(0)

    threading.Thread(target=vigia, daemon=True).start()
    INFO.write_text(json.dumps({"porta": srv.server_address[1], "pid": os.getpid()}))
    srv.serve_forever()


def _servidor_vivo():
    try:
        info = json.loads(INFO.read_text())
        with urllib.request.urlopen(f"http://127.0.0.1:{info['porta']}/", timeout=3) as r:
            if json.loads(r.read()).get("ok"):
                return info
    except Exception:  # noqa: BLE001
        pass
    return None


def _subir_servidor():
    INFO.unlink(missing_ok=True)
    log = open(RAIZ / "servidor.log", "ab")
    kw = {"stdout": log, "stderr": log, "stdin": subprocess.DEVNULL, "cwd": str(RAIZ)}
    if os.name == "nt":
        kw["creationflags"] = 0x00000008 | 0x00000200 | 0x08000000  # DETACHED_PROCESS | NEW_PROCESS_GROUP | NO_WINDOW
    else:
        kw["start_new_session"] = True
    subprocess.Popen([str(PY), str(Path(__file__).resolve()), "servir"], **kw)
    fim = time.time() + 120
    while time.time() < fim:
        info = _servidor_vivo()
        if info:
            return info
        time.sleep(0.5)
    return None


def falar(texto, amostra, saida, motor="openvoice", idioma="pt", sem_servidor=False):
    if amostra and not os.path.isfile(amostra):
        sys.exit(json.dumps({"ok": False, "erro": f"amostra não encontrada: {amostra}"}, ensure_ascii=False))
    dentro = Path(sys.prefix).resolve() == VENV.resolve()
    if not dentro and not PY.exists():
        sys.exit(json.dumps({"ok": False, "erro": "voz local não preparada: rode 'voz_local.py instalar' (uma vez)"}, ensure_ascii=False))
    pedido = {"texto": texto, "amostra": str(Path(amostra).resolve()) if amostra else None, "saida": str(Path(saida).resolve()), "motor": motor, "idioma": idioma}
    if not sem_servidor:
        info = _servidor_vivo() or _subir_servidor()
        if info:
            req = urllib.request.Request(f"http://127.0.0.1:{info['porta']}/", data=json.dumps(pedido).encode("utf-8"), headers={"Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=3600) as r:
                    print(r.read().decode("utf-8"))
                    return
            except urllib.error.HTTPError as e:
                print(e.read().decode("utf-8"))
                sys.exit(1)
        _log("servidor da voz não subiu (veja servidor.log); gerando direto")
    if not dentro:
        args = [PY, __file__, "falar", "--sem-servidor", "--motor", motor, "--idioma", idioma, "--texto", texto, "--saida", saida] + (["--amostra", amostra] if amostra else [])
        sys.exit(subprocess.run([str(a) for a in args]).returncode)
    r = gerar(**pedido)
    print(json.dumps(r, ensure_ascii=False))
    sys.exit(0 if r.get("ok") else 1)


PIP_TRANSCRICAO = ["faster-whisper==1.2.1"]
MODELO_TRANSCRICAO = os.environ.get("VOZ_LOCAL_WHISPER", "small")


def _audio16k(arq):
    """Áudio mono 16 kHz em float32 (o faster-whisper recebe o array pronto: não depende do PyAV, que muda de versão)."""
    a, _ = _ler_som(arq, 16000)
    return a.mean(1).astype("float32")


def transcrever_local(audio, saida, idioma="pt"):
    """Transcrição com o tempo de CADA palavra (faster-whisper no processador). Roda dentro do ambiente da voz."""
    from faster_whisper import WhisperModel
    os.environ.setdefault("HF_HOME", str(RAIZ / "modelos" / "hf"))
    t0 = time.time()
    m = WhisperModel(MODELO_TRANSCRICAO, device="cpu", compute_type="int8", cpu_threads=max(1, (os.cpu_count() or 2) - 1))
    segs, info = m.transcribe(_audio16k(audio), language=idioma, word_timestamps=True, vad_filter=True, beam_size=1, condition_on_previous_text=False)
    pal = []
    for sg in segs:
        for w in sg.words or []:
            txt = w.word.strip()
            if txt:
                pal.append({"t": round(w.start, 2), "f": round(w.end, 2), "w": txt})
    Path(saida).write_text(json.dumps(pal, ensure_ascii=False), encoding="utf-8")
    return {"ok": True, "arquivo": str(saida), "palavras": len(pal), "duracao": round(info.duration, 1), "tempo_s": round(time.time() - t0, 1)}


def _ffmpeg():
    exe = "ffmpeg.exe" if os.name == "nt" else "ffmpeg"
    cands = [shutil.which("ffmpeg")]
    for b in (os.environ.get("APPDATA", ""), str(Path.home() / ".config"), str(Path.home() / "Library" / "Application Support")):
        for nome in ("SegundoCerebro", "Segundo Cérebro", "segundo-cerebro", "Cérebro Pro"):
            cands += sorted(glob.glob(os.path.join(b, nome, "hermes*", "tools", "ffmpeg-*", "bin", exe)), reverse=True)
    c = next((c for c in cands if c and os.path.isfile(c)), None)
    if not c:
        sys.exit(json.dumps({"ok": False, "erro": "não achei o ffmpeg (vem com o Cérebro Pro)"}, ensure_ascii=False))
    return c


EH_VIDEO = (".mp4", ".mov", ".mkv", ".webm", ".m4v")


def trocar(entrada, amostra, saida):
    """Áudio ou vídeo com fala -> mesma fala com a voz da amostra. Vídeo na entrada e .mp4 na saída: devolve o vídeo com o áudio trocado."""
    for arq, nome in ((entrada, "entrada"), (amostra, "amostra")):
        if not arq or not os.path.isfile(arq):
            sys.exit(json.dumps({"ok": False, "erro": f"{nome} não encontrada: {arq}"}, ensure_ascii=False))
    if not PY.exists():
        sys.exit(json.dumps({"ok": False, "erro": "voz local não preparada: rode 'voz_local.py instalar' (uma vez)"}, ensure_ascii=False))
    t0 = time.time()
    ff = _ffmpeg()
    tmp = RAIZ / "tmp"
    tmp.mkdir(parents=True, exist_ok=True)
    marca = hashlib.sha256((str(Path(entrada).resolve()) + str(time.time())).encode()).hexdigest()[:10]
    wav_in = tmp / f"trocar-{marca}.wav"
    subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(entrada), "-vn", "-ac", "1", "-ar", "22050", str(wav_in)], check=True)
    quer_video = str(saida).lower().endswith(EH_VIDEO) and str(entrada).lower().endswith(EH_VIDEO)
    wav_out = tmp / f"trocar-{marca}-voz.wav" if quer_video else Path(saida).resolve()
    info = _servidor_vivo() or _subir_servidor()
    if not info:
        sys.exit(json.dumps({"ok": False, "erro": "o servidor da voz não subiu (veja servidor.log)"}, ensure_ascii=False))
    pedido = {"acao": "trocar", "entrada": str(wav_in), "amostra": str(Path(amostra).resolve()), "saida": str(wav_out)}
    req = urllib.request.Request(f"http://127.0.0.1:{info['porta']}/", data=json.dumps(pedido).encode("utf-8"), headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=3600) as r:
            res = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(e.read().decode("utf-8"))
        sys.exit(1)
    if quer_video and res.get("ok"):
        Path(saida).resolve().parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(entrada), "-i", str(wav_out), "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(Path(saida).resolve())], check=True)
        res["arquivo"] = str(Path(saida).resolve())
        wav_out.unlink(missing_ok=True)
    wav_in.unlink(missing_ok=True)
    res["tempo_s"] = round(time.time() - t0, 1)
    print(json.dumps(res, ensure_ascii=False))


PIP_SEPARACAO = ["demucs==4.0.1"]


def _ler_som(arq, taxa=None):
    import soundfile as sf
    import numpy as np
    a, sr = sf.read(str(arq), dtype="float32", always_2d=True)
    if taxa and sr != taxa:
        import torch
        import torchaudio.functional as taf
        a = taf.resample(torch.from_numpy(a.T.copy()), sr, taxa).numpy().T
        sr = taxa
    return a, sr


def separar_voz(wav, pasta):
    """Demucs (htdemucs): separa a voz do resto (música, efeitos). Devolve (voz.wav, fundo.wav)."""
    import numpy as np
    import soundfile as sf
    import torch
    from demucs.apply import apply_model
    from demucs.pretrained import get_model
    _threads()
    os.environ.setdefault("TORCH_HOME", str(RAIZ / "modelos" / "torch"))
    m = _CACHE.get("demucs") or get_model("htdemucs")
    m.eval()
    _CACHE["demucs"] = m
    a, sr = _ler_som(wav, m.samplerate)
    if a.shape[1] == 1:
        a = np.repeat(a, 2, axis=1)
    x = torch.from_numpy(a.T.copy())
    ref = x.mean(0)
    x = (x - ref.mean()) / (ref.std() + 1e-8)
    with torch.no_grad():
        fontes = apply_model(m, x[None], device="cpu", split=True, overlap=0.25, progress=False)[0]
    fontes = fontes * (ref.std() + 1e-8) + ref.mean()
    nomes = list(m.sources)
    voz = fontes[nomes.index("vocals")].numpy().T
    fundo = sum(fontes[i] for i, n in enumerate(nomes) if n != "vocals").numpy().T
    pasta = Path(pasta)
    sf.write(str(pasta / "voz.wav"), voz, m.samplerate)
    sf.write(str(pasta / "fundo.wav"), fundo, m.samplerate)
    return pasta / "voz.wav", pasta / "fundo.wav"


def _por_extenso(texto, idioma="pt"):
    """Números por extenso antes de falar (o XTTS lê algarismos mal: "1,4" saía "um vírgula quatro" ou sumia)."""
    import re
    try:
        from num2words import num2words
    except Exception:  # noqa: BLE001
        return texto
    lang = "pt_BR" if idioma.startswith("pt") else idioma

    def troca(m):
        n = m.group(0)
        try:
            if "," in n or "." in n.strip(".,"):
                inteiro, dec = re.split(r"[,.]", n, 1)
                return num2words(int(inteiro), lang=lang) + " vírgula " + " ".join(num2words(int(d), lang=lang) for d in dec)
            return num2words(int(n), lang=lang)
        except Exception:  # noqa: BLE001
            return n
    return re.sub(r"\d+(?:[,.]\d+)?", troca, texto)


def _semelhanca(a, b):
    import difflib
    import re
    n = lambda x: re.sub(r"[^\w ]", " ", x.lower()).split()
    return difflib.SequenceMatcher(None, n(_por_extenso(a)), n(_por_extenso(b))).ratio()


def _ouvir(arq, idioma="pt"):
    """O que foi realmente dito no áudio (faster-whisper), para conferir a fala gerada."""
    from faster_whisper import WhisperModel
    os.environ.setdefault("HF_HOME", str(RAIZ / "modelos" / "hf"))
    m = _CACHE.get("whisper") or WhisperModel(MODELO_TRANSCRICAO, device="cpu", compute_type="int8", cpu_threads=max(1, (os.cpu_count() or 2) - 1))
    _CACHE["whisper"] = m
    segs, _ = m.transcribe(_audio16k(arq), language=idioma, beam_size=1, vad_filter=False, condition_on_previous_text=False)
    return " ".join(s.text.strip() for s in segs)


def _frases_com_tempo(audio, idioma="pt"):
    """Frases da fala com início e fim (faster-whisper, tempo por palavra)."""
    from faster_whisper import WhisperModel
    os.environ.setdefault("HF_HOME", str(RAIZ / "modelos" / "hf"))
    m = _CACHE.get("whisper") or WhisperModel(MODELO_TRANSCRICAO, device="cpu", compute_type="int8", cpu_threads=max(1, (os.cpu_count() or 2) - 1))
    _CACHE["whisper"] = m
    segs, _ = m.transcribe(_audio16k(audio), language=idioma, word_timestamps=True, vad_filter=True, beam_size=1, condition_on_previous_text=False)
    pal = [w for sg in segs for w in (sg.words or []) if w.word.strip()]
    frases, cur = [], []
    for i, w in enumerate(pal):
        cur.append(w)
        prox = pal[i + 1] if i + 1 < len(pal) else None
        fim_frase = w.word.strip()[-1:] in ".?!…" or (prox and prox.start - w.end > 0.45) or len(cur) >= 22 or not prox
        if fim_frase:
            frases.append({"ini": round(cur[0].start, 2), "fim": round(cur[-1].end, 2), "texto": "".join(x.word for x in cur).strip()})
            cur = []
    return frases


def redublar(video, amostras, saida, motor="xtts", idioma="pt", textos=None, modo="texto", refinar=True):
    """Mesma fala do vídeo (ou o texto corrigido em textos.json) com a voz da amostra, no MESMO tempo de cada frase,
    e a música/efeitos originais por baixo (sem ruído: a voz original sai antes, pela separação)."""
    import numpy as np
    import soundfile as sf
    t0 = time.time()
    trab = RAIZ / "tmp" / ("redub-" + hashlib.sha256(str(Path(video).resolve()).encode()).hexdigest()[:8])
    trab.mkdir(parents=True, exist_ok=True)
    ff = _ffmpeg()
    orig = trab / "original.wav"
    subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(video), "-vn", "-ac", "2", "-ar", "44100", str(orig)], check=True)
    # etapas já feitas numa rodada anterior são reaproveitadas (a pasta de trabalho é por vídeo)
    if (trab / "voz.wav").exists() and (trab / "fundo.wav").exists():
        voz, fundo = trab / "voz.wav", trab / "fundo.wav"
    else:
        _log("1/4 separando a voz da música...")
        voz, fundo = separar_voz(orig, trab)
    _log("2/4 transcrevendo as frases...")
    if textos:
        frases = json.loads(Path(textos).read_text(encoding="utf-8"))
    elif (trab / "frases.json").exists():
        frases = json.loads((trab / "frases.json").read_text(encoding="utf-8"))
    else:
        frases = _frases_com_tempo(voz, idioma)
    (trab / "frases.json").write_text(json.dumps(frases, ensure_ascii=False, indent=1), encoding="utf-8")
    # amostra: junta as amostras, tira música/ruído (separação) e normaliza
    _log("3/4 preparando a amostra da voz...")
    partes = []
    for i, am in enumerate([str(x).strip() for x in amostras]):
        w = trab / f"am{i}.wav"
        subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(am), "-ac", "2", "-ar", "44100", str(w)], check=True)
        partes.append(w)
    junta = trab / "amostra-junta.wav"
    subprocess.run([ff, "-y", "-loglevel", "error", *sum([["-i", str(w)] for w in partes], []), "-filter_complex", f"concat=n={len(partes)}:v=0:a=1", str(junta)], check=True)
    sub = trab / "amostra-sep"
    sub.mkdir(exist_ok=True)
    vz_am, _ = separar_voz(junta, sub)
    # libera Demucs e Whisper antes do XTTS (os três juntos estouram a memória de um notebook)
    import gc
    for k in ("demucs", "whisper"):
        _CACHE.pop(k, None)
    gc.collect()
    amostra = trab / "amostra-limpa.wav"
    subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(vz_am), "-af", "highpass=f=70,silenceremove=stop_periods=-1:stop_duration=0.4:stop_threshold=-40dB,loudnorm=I=-18", "-ac", "1", "-ar", "22050", str(amostra)], check=True)
    if modo == "conversao":
        # MESMO texto: converte a fala original separada (voz.wav) direto para o timbre da amostra. Ritmo, pausas e emoção
        # ficam idênticos ao original e não há frase "robótica" nem fora do tempo. Muito mais rápido que gerar frase por frase.
        _log("4/4 convertendo a fala original para a voz da amostra (conversão)...")
        nova = trab / "voz-nova.wav"
        trocar_timbre(str(voz), str(amostra), str(nova))
        return _mixar_e_salvar(trab, video, nova, fundo, voz, saida, frases, "conversao", t0)
    _log(f"4/4 gerando {len(frases)} frases com a voz clonada ({motor})...")
    taxa = 44100
    tot = int((max(f["fim"] for f in frases) + 3) * taxa) if frases else taxa
    trilha = np.zeros(max(tot, int(sf.info(str(orig)).duration * taxa) + taxa), dtype="float32")
    for i, f in enumerate(frases):
        fw = trab / f"f{i:03d}.wav"
        # gera e CONFERE: transcreve o que saiu e compara com o texto; abaixo de 85% refaz com outra variação (até 3x) e fica com a melhor
        melhor, nota = None, -1.0
        for tentativa, temp in enumerate((0.65, 0.5, 0.8)):
            fx = trab / f"f{i:03d}-t{tentativa}.wav"
            r = gerar(f["texto"], str(amostra), str(fx), motor, idioma, temperatura=temp if motor == "xtts" else None, semente=1234 + tentativa)
            if not r.get("ok"):
                continue
            try:
                ouvido = _ouvir(fx, idioma)
                n = _semelhanca(f["texto"], ouvido)
            except Exception:  # noqa: BLE001
                n = 1.0
            if n > nota:
                melhor, nota = fx, n
            if n >= 0.85:
                break
        if melhor is None:
            continue
        f["conferencia"] = round(nota, 2)
        if refinar and motor == "xtts":
            # o XTTS acerta o texto e a entonação, mas o timbre fica "parecido"; o conversor do OpenVoice puxa para a voz real
            try:
                trocar_timbre(str(melhor), str(amostra), str(fw))
            except Exception as e:  # noqa: BLE001
                _log(f"refino falhou na frase {i}: {e}")
                shutil.copy(melhor, fw)
        else:
            shutil.copy(melhor, fw)
        a, sr = _ler_som(fw, taxa)
        a = a.mean(1)
        # encaixe: a frase nova ocupa o tempo da original (pode avançar até 0,35 s na pausa seguinte)
        prox = frases[i + 1]["ini"] if i + 1 < len(frases) else f["fim"] + 1.0
        alvo = max(0.4, min(prox, f["fim"] + 0.35) - f["ini"])
        fator = (len(a) / taxa) / alvo
        if abs(fator - 1) > 0.03:
            fator = min(1.45, max(0.8, fator))
            fa = trab / f"f{i:03d}-ajust.wav"
            sf.write(str(fa), a, taxa)
            fb = trab / f"f{i:03d}-ok.wav"
            subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(fa), "-af", f"atempo={fator:.4f}", str(fb)], check=True)
            a, _ = _ler_som(fb, taxa)
            a = a.mean(1)
        ini = int(f["ini"] * taxa)
        fim = min(len(trilha), ini + len(a))
        trilha[ini:fim] += a[: fim - ini]
    nova = trab / "voz-nova.wav"
    sf.write(str(nova), trilha, taxa)
    return _mixar_e_salvar(trab, video, nova, fundo, voz, saida, frases, motor, t0)


def _mixar_e_salvar(trab, video, nova, fundo, voz_original, saida, frases, motor, t0):
    """Voz nova + fundo. O fundo passa por um compressor guiado pela VOZ ORIGINAL separada: onde a pessoa falava, o fundo
    abaixa forte, e o resto da voz antiga que a separação deixa na música some (era o "voz antiga batendo com a nova")."""
    ff = _ffmpeg()
    final_audio = trab / "mix.wav"
    filtro = ("[0:a]highpass=f=60,loudnorm=I=-16:TP=-1.5,aformat=channel_layouts=stereo[v];"
              "[2:a]aformat=channel_layouts=stereo,volume=2.5[chave];"
              "[1:a]aformat=channel_layouts=stereo,volume=0.9[m];"
              "[m][chave]sidechaincompress=threshold=0.015:ratio=20:attack=8:release=300:makeup=1[mf];"
              "[v][mf]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.95[o]")
    subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(nova), "-i", str(fundo), "-i", str(voz_original), "-filter_complex", filtro,
                    "-map", "[o]", "-ar", "48000", str(final_audio)], check=True)
    saida = Path(saida).resolve()
    saida.parent.mkdir(parents=True, exist_ok=True)
    if str(saida).lower().endswith(EH_VIDEO):
        subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(video), "-i", str(final_audio), "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(saida)], check=True)
    else:
        shutil.copy(final_audio, saida)
    (trab / "frases.json").write_text(json.dumps(frases, ensure_ascii=False, indent=1), encoding="utf-8")
    notas = [f.get("conferencia", 1.0) for f in frases]
    return {"ok": True, "arquivo": str(saida), "frases": len(frases), "motor": motor, "tempo_s": round(time.time() - t0, 1),
            "conferencia_media": round(sum(notas) / max(1, len(notas)), 2), "frases_abaixo_de_85": sum(1 for x in notas if x < 0.85),
            "textos": str(trab / "frases.json"), "dica": "Para corrigir uma palavra, edite frases.json e rode de novo com --textos (as frases já vêm com o tempo)."}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    i = sub.add_parser("instalar")
    i.add_argument("--motor", choices=["openvoice", "xtts", "ambos"], default="openvoice")
    sub.add_parser("estado")
    sub.add_parser("servir")
    sub.add_parser("parar")
    f = sub.add_parser("falar")
    f.add_argument("--motor", choices=["openvoice", "xtts"], default="openvoice")
    f.add_argument("--texto")
    f.add_argument("--texto-arquivo", help="arquivo .txt com o texto (bom para texto longo ou com aspas)")
    f.add_argument("--idioma", default="pt")
    f.add_argument("--amostra")
    f.add_argument("--saida", required=True)
    f.add_argument("--sem-servidor", action="store_true")
    rd = sub.add_parser("redublar", help="refaz a fala do vídeo com a voz clonada, frase por frase no mesmo tempo, mantendo a música original")
    rd.add_argument("--video", required=True)
    rd.add_argument("--amostra", required=True, action="append", help="pode repetir: vários áudios da mesma pessoa (melhor: 1 a 3 min no total)")
    rd.add_argument("--saida", required=True)
    rd.add_argument("--motor", choices=["xtts", "openvoice"], default="xtts")
    rd.add_argument("--idioma", default="pt")
    rd.add_argument("--textos", help="frases.json corrigido (de uma rodada anterior)")
    rd.add_argument("--modo", choices=["texto", "conversao"], default="texto", help="conversao = mesmo texto do vídeo: converte a fala original (natural, rápido). texto = gera cada frase (texto novo/corrigido)")
    rd.add_argument("--sem-refino", action="store_true", help="não passar as frases do XTTS pelo conversor de timbre")
    tc = sub.add_parser("transcrever", help="transcreve áudio/vídeo com o tempo de cada palavra (para legenda e edição)")
    tc.add_argument("--audio", required=True)
    tc.add_argument("--saida", required=True)
    tc.add_argument("--idioma", default="pt")
    tr = sub.add_parser("trocar", help="troca a voz de um áudio ou vídeo pela voz da amostra (mesmas palavras e ritmo)")
    tr.add_argument("--entrada", required=True)
    tr.add_argument("--amostra", required=True)
    tr.add_argument("--saida", required=True)
    a = ap.parse_args()
    if a.cmd == "redublar":
        dentro = Path(sys.prefix).resolve() == VENV.resolve()
        if not dentro:
            if not PY.exists():
                sys.exit(json.dumps({"ok": False, "erro": "voz local não preparada: rode 'voz_local.py instalar' (uma vez)"}, ensure_ascii=False))
            faltam = [p for m, p in (("faster_whisper", PIP_TRANSCRICAO), ("demucs", PIP_SEPARACAO)) if subprocess.run([str(PY), "-c", f"import {m}"], capture_output=True).returncode != 0]
            for p in faltam:
                _log("preparando " + p[0] + " (uma vez)...")
                _pip(*p)
            args = [str(PY), __file__, "redublar", "--video", str(Path(a.video).resolve()), "--saida", str(Path(a.saida).resolve()), "--motor", a.motor, "--idioma", a.idioma]
            for am in [x.strip() for x in a.amostra]:
                args += ["--amostra", str(Path(am).resolve())]
            if a.textos:
                args += ["--textos", str(Path(a.textos).resolve())]
            sys.exit(subprocess.run(args).returncode)
        print(json.dumps(redublar(a.video, a.amostra, a.saida, a.motor, a.idioma, a.textos, a.modo, not a.sem_refino), ensure_ascii=False))
    elif a.cmd == "transcrever":
        dentro = Path(sys.prefix).resolve() == VENV.resolve()
        if not dentro:
            if not PY.exists():
                sys.exit(json.dumps({"ok": False, "erro": "voz local não preparada: rode 'voz_local.py instalar' (uma vez)"}, ensure_ascii=False))
            if subprocess.run([str(PY), "-c", "import faster_whisper"], capture_output=True).returncode != 0:
                _log("preparando a transcrição local (uma vez)...")
                _pip(*PIP_TRANSCRICAO)
            entrada = Path(a.audio).resolve()
            wav = RAIZ / "tmp" / ("transc-" + str(abs(hash(str(entrada))) % 10**8) + ".wav")
            wav.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run([_ffmpeg(), "-y", "-loglevel", "error", "-i", str(entrada), "-vn", "-ac", "1", "-ar", "16000", str(wav)], check=True)
            r = subprocess.run([str(PY), __file__, "transcrever", "--audio", str(wav), "--saida", str(Path(a.saida).resolve()), "--idioma", a.idioma])
            wav.unlink(missing_ok=True)
            sys.exit(r.returncode)
        print(json.dumps(transcrever_local(a.audio, a.saida, a.idioma), ensure_ascii=False))
    elif a.cmd == "trocar":
        trocar(a.entrada, a.amostra, a.saida)
    elif a.cmd == "instalar":
        instalar(a.motor)
    elif a.cmd == "estado":
        estado()
    elif a.cmd == "servir":
        servir()
    elif a.cmd == "parar":
        info = _servidor_vivo()
        if info:
            try:
                os.kill(info["pid"], 9)
            except Exception:  # noqa: BLE001
                pass
        INFO.unlink(missing_ok=True)
        print(json.dumps({"ok": True}))
    else:
        texto = Path(a.texto_arquivo).read_text(encoding="utf-8") if a.texto_arquivo else a.texto
        if not texto:
            sys.exit(json.dumps({"ok": False, "erro": "passe --texto ou --texto-arquivo"}))
        falar(texto.strip(), a.amostra, a.saida, a.motor, a.idioma, a.sem_servidor)
