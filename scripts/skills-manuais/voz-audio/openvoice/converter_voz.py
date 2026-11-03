"""Converte o timbre de um áudio de origem para o de um áudio de referência (OpenVoice V2).

Uso:
    python converter_voz.py --origem origem.wav --referencia referencia.wav --saida convertido.wav

Requisitos: OpenVoice instalado e pesos V2 em checkpoints_v2/ (veja SKILL.md).
Só use com voz própria ou com consentimento por escrito de quem fala.
"""
import argparse
import os
import sys
import time


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--origem", required=True)
    ap.add_argument("--referencia", required=True)
    ap.add_argument("--saida", required=True)
    ap.add_argument("--checkpoints", default="checkpoints_v2")
    ap.add_argument("--device", default=None, help="cpu ou cuda:0 (padrão: cuda se houver, senão cpu)")
    args = ap.parse_args()

    for caminho in (args.origem, args.referencia):
        if not os.path.exists(caminho):
            sys.exit(f"Arquivo não encontrado: {caminho}")
    pasta = os.path.join(args.checkpoints, "converter")
    if not os.path.exists(os.path.join(pasta, "checkpoint.pth")):
        sys.exit(f"Pesos não encontrados em {pasta}. Baixe os checkpoints V2 (veja SKILL.md).")

    import torch
    from openvoice import se_extractor
    from openvoice.api import ToneColorConverter

    device = args.device or ("cuda:0" if torch.cuda.is_available() else "cpu")
    t0 = time.time()
    conversor = ToneColorConverter(os.path.join(pasta, "config.json"), device=device)
    conversor.load_ckpt(os.path.join(pasta, "checkpoint.pth"))
    se_origem, _ = se_extractor.get_se(args.origem, conversor, vad=True)
    se_alvo, _ = se_extractor.get_se(args.referencia, conversor, vad=True)
    os.makedirs(os.path.dirname(os.path.abspath(args.saida)), exist_ok=True)
    conversor.convert(audio_src_path=args.origem, src_se=se_origem, tgt_se=se_alvo, output_path=args.saida, message="@RangelTech")
    print(f"ok: {args.saida} ({device}, {time.time() - t0:.1f}s)")


if __name__ == "__main__":
    main()
