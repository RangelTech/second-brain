"""Voz clonada LOCAL e de graça (sem créditos), dois motores:
  openvoice (padrão): Piper fala o texto em português do Brasil e o OpenVoice v2 troca o timbre pela voz da amostra. MIT: uso comercial permitido.
  xtts: XTTS v2 (Coqui) clona a voz direto em português a partir de ~6 s de amostra; melhor qualidade. Licença CPML: só uso NÃO comercial.

Este arquivo roda com QUALQUER Python 3.8+ (até o do próprio Segundo Cérebro): ele monta sozinho um ambiente próprio com Python 3.12
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
    "win_amd64": ("6ad8763374b1f93fe903d1323947a4bd74d728b3f62d7d73516d47ea62edfa80", "voz-rodas-win_amd64-cp312.zip"),
    "linux_x86_64": ("b26a93248dd67d8b3645d95a878340a09d83d18c6ea3a0a2fc2257d8116df434", "voz-rodas-linux_x86_64-cp312.zip"),
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


def _sistema():
    m = platform.machine().lower()
    if os.name == "nt" and m in ("amd64", "x86_64"):
        return "win_amd64"
    if sys.platform.startswith("linux") and m in ("x86_64", "amd64"):
        return "linux_x86_64"
    return sys.platform + "_" + m


def _uv():
    """O uv que vem com o Segundo Cérebro (ou um do sistema). Ele baixa o Python 3.12 do ambiente e instala rápido."""
    cands = [os.environ.get("SB_UV"), shutil.which("uv")]
    exe = "uv.exe" if os.name == "nt" else "uv"
    bases = [os.environ.get("APPDATA", ""), str(Path.home() / ".config"), str(Path.home() / "Library" / "Application Support")]
    for b in bases:
        for nome in ("SegundoCerebro", "Segundo Cérebro", "segundo-cerebro"):
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
            urllib.request.urlretrieve(url, tmp)
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
    if PY.exists():
        return
    uv = _uv()
    if uv:
        _sh([uv, "venv", "--python", PYTHON_DO_AMBIENTE, "--seed", VENV])
    elif sys.version_info >= (3, 11):
        _sh([sys.executable, "-m", "venv", VENV])
    else:
        raise SystemExit(json.dumps({"ok": False, "erro": "preciso do uv (vem com o Segundo Cérebro) ou de Python 3.11+ para montar o ambiente da voz"}))


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


def gerar(texto, amostra, saida, motor="openvoice", idioma="pt"):
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
            _CACHE[chave_amostra] = m.get_conditioning_latents(audio_path=[str(Path(amostra).resolve())])
        gpt, spk = _CACHE[chave_amostra]
        out = m.inference(texto, idioma, gpt, spk, enable_text_splitting=True)
        _gravar_wav(saida, out["wav"], 24000)
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


# ------------------------------- servidor residente (modelo fica na memória) -------------------------------
def servir():
    import threading
    from http.server import BaseHTTPRequestHandler, HTTPServer
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
                    r = gerar(a["texto"], a.get("amostra"), a["saida"], a.get("motor") or "openvoice", a.get("idioma") or "pt")
                    ultimo[0] = time.time()
                self._resp(r)
            except Exception as e:  # noqa: BLE001
                self._resp({"ok": False, "erro": f"{type(e).__name__}: {e}"}, 500)

    srv = HTTPServer(("127.0.0.1", 0), H)

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
    a = ap.parse_args()
    if a.cmd == "instalar":
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
