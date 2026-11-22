"""Parte pesada do motor do Viralizaí, rodando no computador do usuário (ambiente próprio: numpy, OpenCV, faster-whisper, onnxruntime).
Chamado pelo auto.py; não use direto. Cada comando imprime UMA linha JSON.

    python pesado.py audio  --arquivo A [--json saida.json]
        por segundo: volume (dB) e eventos sonoros (YAMNet: risada, grito, tiro, explosão, sirene, batida, torcida, música, fala)
        + silêncios (resolução de 0,25 s). Lê o áudio em streaming (live de 4 h não entra inteira na memória).
    python pesado.py transcrever --arquivo A --janelas '[[a,b],...]' [--lingua pt] [--json saida.json]
        Whisper small int8 no processador, SÓ nas janelas pedidas; palavras com tempo absoluto.
    python pesado.py rosto --arquivo A --inicio s --fim s --largura-rel 0.316
        segue o rosto maior cena a cena (YuNet do OpenCV; Haar de reserva) e devolve [[t_rel, centro_x], ...] ou null.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import shutil
import statistics
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

AQUI = Path(__file__).resolve().parent
MODELOS = AQUI.parent / "modelos-ia"
SR = 16000
GRUPOS = {  # grupo -> classes do AudioSet (yamnet_class_map.csv), como no Viralizaí
    "risada": ["Laughter", "Giggle", "Belly laugh", "Chuckle, chortle", "Baby laughter", "Snicker"],
    "grito": ["Screaming", "Shout", "Yell", "Battle cry", "Children shouting", "Whoop"],
    "tiro": ["Gunshot, gunfire", "Machine gun", "Fusillade", "Artillery fire", "Cap gun"],
    "explosao": ["Explosion", "Boom", "Burst, pop", "Eruption"],
    "sirene": ["Siren", "Police car (siren)", "Ambulance (siren)", "Fire engine, fire truck (siren)", "Civil defense siren"],
    "batida": ["Skidding", "Tire squeal", "Smash, crash", "Vehicle horn, car horn, honking", "Car alarm", "Glass", "Shatter"],
    "torcida": ["Cheering", "Applause", "Crowd", "Clapping"],
    "musica": ["Music"],
    "fala": ["Speech", "Conversation", "Narration, monologue"],
}


def ffmpeg():
    return os.environ.get("SB_FFMPEG") or shutil.which("ffmpeg") or "ffmpeg"


def log(m):
    print(m, file=sys.stderr, flush=True)


# ---------------------------------------------------------------- áudio (Viralizaí motor/audio.py)
class Yamnet:
    def __init__(self):
        import onnxruntime as ort
        o = ort.SessionOptions()
        o.intra_op_num_threads = 2
        self.s = ort.InferenceSession(str(MODELOS / "yamnet.onnx"), o, providers=["CPUExecutionProvider"])
        self.ent = self.s.get_inputs()[0].name
        self.sai = self.s.get_outputs()[0].name
        nomes = [r["display_name"] for r in csv.DictReader(open(MODELOS / "yamnet_class_map.csv", encoding="utf-8"))]
        self.idx = {g: [nomes.index(n) for n in ns if n in nomes] for g, ns in GRUPOS.items()}

    def __call__(self, x):
        s = self.s.run([self.sai], {self.ent: x[:15600].astype(np.float32)})[0]
        s = s[0] if s.ndim > 1 else s
        return {g: float(s[ix].max()) if ix else 0.0 for g, ix in self.idx.items()}


def audio(arquivo, eventos=True):
    p = subprocess.Popen([ffmpeg(), "-v", "error", "-i", str(arquivo), "-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    yam = None
    if eventos:
        try:
            yam = Yamnet()
        except Exception as e:  # noqa: BLE001  sem o modelo fica só a energia
            log(f"yamnet indisponível: {e}")
    db, ev = [], ({g: [] for g in GRUPOS} if yam else {})
    silencios, sil_ini = [], None
    try:
        while True:
            b = p.stdout.read(SR * 4)
            if not b:
                break
            x = np.frombuffer(b, dtype=np.float32)
            t = len(db)
            db.append(round(float(20 * np.log10(np.sqrt(np.mean(x * x)) + 1e-9)), 2))
            for q in range(4):  # silêncio: quartos de segundo abaixo de -45 dB
                parte = x[q * SR // 4:(q + 1) * SR // 4]
                if not len(parte):
                    continue
                mudo = 20 * np.log10(float(np.sqrt(np.mean(parte * parte)) + 1e-9)) < -45
                tq = t + q / 4
                if mudo and sil_ini is None:
                    sil_ini = tq
                elif not mudo and sil_ini is not None:
                    if tq - sil_ini >= 0.25:
                        silencios.append((round(sil_ini, 2), round(tq, 2)))
                    sil_ini = None
            if yam:
                if len(x) < 15600:
                    x = np.pad(x, (0, 15600 - len(x)))
                for g, v in yam(x).items():
                    ev[g].append(round(v, 3))
    finally:
        p.stdout.close()
        p.wait()
    return {"db": db, "eventos": ev, "silencios": silencios}


# ---------------------------------------------------------------- Whisper (Viralizaí motor/whisper_cpu.py)
def juntar_janelas(janelas, folga=3.0):
    out = []
    for a, b in sorted(janelas):
        if out and a <= out[-1][1] + folga:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return out


def modelo_whisper():
    from faster_whisper import WhisperModel
    local = MODELOS_USUARIO / "faster-whisper-small"
    alvo = str(local) if (local / "model.bin").exists() else "small"
    return WhisperModel(alvo, device="cpu", compute_type="int8", cpu_threads=max(2, (os.cpu_count() or 4) // 2),
                        download_root=str(MODELOS_USUARIO))


MODELOS_USUARIO = Path.home() / ".segundo-cerebro" / "cortes" / "modelos"


def transcrever(arquivo, janelas, lingua=None):
    m = modelo_whisper()
    palavras, lingua_achada = [], None
    for a, b in juntar_janelas(janelas):
        try:
            r = subprocess.run([ffmpeg(), "-v", "error", "-ss", f"{a:.2f}", "-to", f"{b:.2f}", "-i", str(arquivo), "-vn", "-ac", "1", "-ar", "16000",
                                "-f", "f32le", "-"], capture_output=True)
            x = np.frombuffer(r.stdout, dtype=np.float32)
            if len(x) < 16000:
                continue
            segs, info = m.transcribe(x, language=lingua, word_timestamps=True, vad_filter=True, beam_size=1, condition_on_previous_text=False)
            lingua_achada = lingua_achada or getattr(info, "language", None)
            for s in segs:
                for w in s.words or []:
                    t = w.word.strip()
                    if t:
                        palavras.append({"start": round(a + w.start, 2), "end": round(a + w.end, 2), "word": t})
        except Exception as e:  # noqa: BLE001
            log(f"whisper janela {a:.0f}-{b:.0f} falhou: {e}")
    return {"palavras": sorted(palavras, key=lambda w: w["start"]), "lingua": lingua_achada}


# ---------------------------------------------------------------- rosto (Viralizaí enquadrar.py) + trocas de cena
class Detector:
    def __init__(self):
        import cv2
        self.cv2 = cv2
        self.yunet = None
        y = MODELOS / "face_detection_yunet_2023mar.onnx"
        if y.exists() and hasattr(cv2, "FaceDetectorYN"):
            try:
                self.yunet = cv2.FaceDetectorYN.create(str(y), "", (320, 320), 0.6, 0.3, 50)
            except Exception as e:  # noqa: BLE001
                log(f"YuNet indisponível ({e}): uso Haar")
        base = cv2.data.haarcascades
        self.frente = cv2.CascadeClassifier(base + "haarcascade_frontalface_default.xml")
        self.perfil = cv2.CascadeClassifier(base + "haarcascade_profileface.xml")

    def maior(self, img):
        cv2 = self.cv2
        h, w = img.shape[:2]
        if self.yunet is not None:
            self.yunet.setInputSize((w, h))
            _, faces = self.yunet.detect(img)
            if faces is not None and len(faces):
                f = max(faces, key=lambda r: r[2] * r[3])
                return float(f[0]), float(f[1]), float(f[2]), float(f[3])
        cinza = cv2.equalizeHist(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY))
        achados = list(self.frente.detectMultiScale(cinza, scaleFactor=1.15, minNeighbors=6, minSize=(28, 28)))
        achados += list(self.perfil.detectMultiScale(cinza, scaleFactor=1.15, minNeighbors=5, minSize=(28, 28)))
        espelho = cv2.flip(cinza, 1)
        achados += [(w - x - rw, y, rw, rh) for x, y, rw, rh in self.perfil.detectMultiScale(espelho, scaleFactor=1.15, minNeighbors=5, minSize=(28, 28))]
        if not achados:
            return None
        x, y, rw, rh = max(achados, key=lambda q: q[2] * q[3])
        return float(x), float(y), float(rw), float(rh)


def trocas_de_cena(arquivo, ini, fim):
    """Cortes de câmera (tempo absoluto no arquivo): podcast troca de quem fala, cada cena tem o seu enquadramento."""
    r = subprocess.run([ffmpeg(), "-v", "info", "-nostats", "-ss", f"{ini:.2f}", "-to", f"{fim:.2f}", "-i", str(arquivo), "-an",
                        "-vf", "scale=-2:180,select='gt(scene,0.32)',showinfo", "-f", "null", "-"], capture_output=True, text=True, errors="replace")
    return [ini + float(m.group(1)) for m in re.finditer(r"pts_time:([\d.]+)", r.stderr)]


def rosto(arquivo, ini, fim, largura_rel):
    import cv2
    det = Detector()
    trocas = trocas_de_cena(arquivo, ini, fim)
    cenas = [ini] + [t for t in trocas if ini + 0.5 < t < fim - 0.5] + [fim]
    with tempfile.TemporaryDirectory() as tmp:
        r = subprocess.run([ffmpeg(), "-loglevel", "error", "-ss", f"{ini:.2f}", "-to", f"{fim:.2f}", "-i", str(arquivo), "-an",
                            "-vf", "fps=2,scale=-2:360", "-q:v", "5", str(Path(tmp) / "q%05d.jpg")], capture_output=True, text=True)
        quadros = sorted(Path(tmp).glob("q*.jpg"))
        if r.returncode != 0 or not quadros:
            return None
        achados = []
        for i, f in enumerate(quadros):
            img = cv2.imread(str(f))
            if img is None:
                continue
            ro = det.maior(img)
            achados.append((ini + i * 0.5 + 0.25, (ro[0] + ro[2] / 2) / img.shape[1] if ro else None, ro[2] / img.shape[1] if ro else 0))
    out, com_rosto, dentro, total = [], 0, 0.0, 0.0
    meia = largura_rel / 2
    for a, b in zip(cenas, cenas[1:]):
        xs = [(cx, lw) for t, cx, lw in achados if a <= t < b and cx is not None]
        if xs:
            com_rosto += 1
            cx = statistics.median(x for x, _ in xs)
        else:
            cx = out[-1][1] if out else 0.5
        cx = min(1 - meia, max(meia, cx))
        out.append((round(a - ini, 2), round(cx, 4)))
        # 22/11/2026: em cena aberta (várias pessoas) ou com o rosto andando, o recorte parado deixava meio rosto fora da tela.
        # Conta o tempo em que o rosto inteiro (centro +- meia largura do rosto) cabe com folga no recorte desta cena.
        for x, lw in xs:
            total += 1
            dentro += 1 if abs(x - cx) + lw / 2 <= meia * 0.92 else 0
    n = len(cenas) - 1
    if n <= 0 or com_rosto < max(1, n / 2):
        return None
    log(f"rosto dentro do recorte: {100 * dentro / max(1, total):.0f}% dos quadros com rosto")
    if total and dentro / total < 0.8:
        log(f"rosto fora do recorte em {100 - 100 * dentro / total:.0f}% do tempo: melhor o quadro inteiro")
        return None
    junto = [out[0]]
    for p in out[1:]:  # cenas seguidas com o mesmo enquadramento viram uma só
        if abs(p[1] - junto[-1][1]) >= 0.04:
            junto.append(p)
    return junto


def saida(obj, arq):
    if arq:
        Path(arq).write_text(json.dumps(obj, ensure_ascii=False), encoding="utf-8")
        print(json.dumps({"ok": True, "json": arq}))
    else:
        print(json.dumps(obj, ensure_ascii=False))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("audio")
    a.add_argument("--arquivo", required=True)
    a.add_argument("--json")
    a.add_argument("--sem-eventos", action="store_true")
    t = sub.add_parser("transcrever")
    t.add_argument("--arquivo", required=True)
    t.add_argument("--janelas", required=True)
    t.add_argument("--lingua")
    t.add_argument("--json")
    r = sub.add_parser("rosto")
    r.add_argument("--arquivo", required=True)
    r.add_argument("--inicio", type=float, required=True)
    r.add_argument("--fim", type=float, required=True)
    r.add_argument("--largura-rel", type=float, required=True)
    sub.add_parser("conferir")
    x = ap.parse_args()
    if x.cmd == "audio":
        saida(audio(x.arquivo, not x.sem_eventos), x.json)
    elif x.cmd == "transcrever":
        jan = json.loads(Path(x.janelas).read_text(encoding="utf-8")) if os.path.isfile(x.janelas) else json.loads(x.janelas)
        saida(transcrever(x.arquivo, jan, x.lingua), x.json)
    elif x.cmd == "rosto":
        print(json.dumps({"pos": rosto(x.arquivo, x.inicio, x.fim, x.largura_rel)}))
    else:
        import importlib
        for m in ("cv2", "faster_whisper", "onnxruntime"):
            importlib.import_module(m)
        print(json.dumps({"ok": True, "yamnet": (MODELOS / "yamnet.onnx").exists()}))
