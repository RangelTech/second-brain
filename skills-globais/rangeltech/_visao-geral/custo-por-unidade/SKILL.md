---
name: custo-por-unidade
description: Preço medido por imagem, minuto de vídeo, hora de áudio, câmera e token, com a classe do dado (medido, calculado, estimado).
---

# Custo por unidade (medido na campanha)

# Custo por unidade

US$ e R$ por unidade de trabalho (1 milhao de frames, 1000 imagens, 1 minuto de video, 1 hora de audio...) por GPU.

Fonte: `specs/BIBLIOTECAS_ECOSSISTEMA_v6.xlsx`, aba "Custo por unidade". Numeros medidos/calculados em 26 a 28/10/2026; precos de marketplace variam por hora.

| Capacidade | Unidade | GPU | US$/h GPU | US$/unidade | R$/unidade | Base medida | Obs |
|---|---|---|---|---|---|---|---|
| Deteccao de objetos (YOLO11m, so GPU) | 1 milhao de frames | RTX 5090 | 0.55 | 0.14007 | 0.6955 | 1090.7 fps |  |
| Deteccao de objetos (YOLO11m, so GPU) | 1 milhao de frames | RTX 3090 | 0.22 | 0.15401 | 0.7647 | 396.8 fps |  |
| Deteccao de objetos (YOLO11m, so GPU) | 1 milhao de frames | RTX 4090 | 0.43 | 0.16266 | 0.8077 | 734.3 fps |  |
| Deteccao de objetos (YOLO11m, so GPU) | 1 milhao de frames | L40S | 0.8 | 0.32071 | 1.5924 | 692.9 fps |  |
| Deteccao de objetos (YOLO11m, so GPU) | 1 milhao de frames | RTX PRO 6000 | 1.36 | 0.33243 | 1.6506 | 1136.4 fps |  |
| Deteccao de objetos (YOLO11m, so GPU) | 1 milhao de frames | H100 | 2.8 | 0.67131 | 3.3332 | 1158.6 fps |  |
| Deteccao de objetos (YOLO11m, so GPU) | 1 milhao de frames | GB10 | 0.449 | 0.72724 | 3.6109 | 171.5 fps |  |
| Deteccao por texto (Grounding DINO) | 1000 imagens | RTX 3090 | 0.22 | 0.0066 | 0.0328 | 108.05 ms/imagem |  |
| Deteccao por texto (Grounding DINO) | 1000 imagens | RTX 5090 | 0.55 | 0.00693 | 0.0344 | 45.36 ms/imagem |  |
| Deteccao por texto (Grounding DINO) | 1000 imagens | L40S | 0.8 | 0.01645 | 0.0817 | 74.01 ms/imagem |  |
| Deteccao por texto (Grounding DINO) | 1000 imagens | RTX 4090 | 0.43 | 0.01783 | 0.0885 | 149.26 ms/imagem |  |
| Deteccao por texto (Grounding DINO) | 1000 imagens | GB10 | 0.449 | 0.02105 | 0.1045 | 168.8 ms/imagem |  |
| Deteccao por texto (Grounding DINO) | 1000 imagens | RTX PRO 6000 | 1.36 | 0.0235 | 0.1167 | 62.21 ms/imagem |  |
| Imagem 512px (SDXL-Turbo) | 1000 imagens | RTX 3090 | 0.22 | 0.01638 | 0.0813 | 0.268 s/imagem |  |
| Imagem 512px (SDXL-Turbo) | 1000 imagens | RTX 5090 | 0.55 | 0.02047 | 0.1016 | 0.134 s/imagem |  |
| Imagem 512px (SDXL-Turbo) | 1000 imagens | RTX 4090 | 0.43 | 0.02389 | 0.1186 | 0.2 s/imagem |  |
| Imagem 512px (SDXL-Turbo) | 1000 imagens | L40S | 0.8 | 0.02889 | 0.1434 | 0.13 s/imagem |  |
| Imagem 512px (SDXL-Turbo) | 1000 imagens | L40S | 0.8 | 0.03044 | 0.1512 | 0.137 s/imagem |  |
| Imagem 512px (SDXL-Turbo) | 1000 imagens | RTX PRO 6000 | 1.36 | 0.04609 | 0.2288 | 0.122 s/imagem |  |
| Imagem 512px (SDXL-Turbo) | 1000 imagens | GB10 | 0.449 | 0.05001 | 0.2483 | 0.401 s/imagem |  |
| Imagem 512px (SDXL-Turbo) | 1000 imagens | H100 | 2.8 | 0.07078 | 0.3514 | 0.091 s/imagem |  |
| LLM qwen3.5-9b (b9speed) | 1 milhao de tokens de saida | RTX 5090 | 0.55 | 0.08477 | 0.4209 | 1802.3 tok/s agregado com 32 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.5-9b (b9speed) | 1 milhao de tokens de saida | RTX 4090 | 0.43 | 0.16826 | 0.8354 | 709.9 tok/s agregado com 32 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.5-9b (engine_sglang) | 1 milhao de tokens de saida | RTX 4090 | 0.43 | 0.81144 | 4.029 | 147.2 tok/s agregado com 16 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.5-9b (engine_vllm) | 1 milhao de tokens de saida | RTX 4090 | 0.43 | 0.18189 | 0.9031 | 656.7 tok/s agregado com 16 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.5-9b (qwen9b_bf16) | 1 milhao de tokens de saida | RTX 3090 | 0.22 | 0.11232 | 0.5577 | 544.1 tok/s agregado com 32 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.5-9b (qwen9b_bf16) | 1 milhao de tokens de saida | RTX PRO 6000 | 1.36 | 0.39079 | 1.9404 | 966.7 tok/s agregado com 32 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.5-9b (qwen9b_bf16) | 1 milhao de tokens de saida | L40S | 0.8 | 0.39775 | 1.9749 | 558.7 tok/s agregado com 32 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.5-9b (qwen9b_bf16) | 1 milhao de tokens de saida | GB10 | 0.449 | 0.94774 | 4.7057 | 131.6 tok/s agregado com 16 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.8-27b-abliterated (27b_fp8_dflash) | 1 milhao de tokens de saida | GB10 | 0.449 | 0.5801 | 2.8803 | 215.0 tok/s agregado com 32 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.8-27b-abliterated (27b_fp8_plain) | 1 milhao de tokens de saida | GB10 | 0.449 | 1.02231 | 5.076 | 122.0 tok/s agregado com 32 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.8-27b-abliterated (27b_nvfp4_dflash) | 1 milhao de tokens de saida | GB10 | 0.449 | 0.56384 | 2.7996 | 221.2 tok/s agregado com 32 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.8-27b-abliterated (bf16_dflash) | 1 milhao de tokens de saida | RTX PRO 6000 | 1.36 | 0.62186 | 3.0876 | 607.5 tok/s agregado com 16 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.8-27b-abliterated (bf16_dflash) | 1 milhao de tokens de saida | GB10 | 0.449 | 1.00018 | 4.9661 | 124.7 tok/s agregado com 32 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.8-27b-abliterated (bf16_dflash) | 1 milhao de tokens de saida | H100 | 2.8 | 1.04023 | 5.1649 | 747.7 tok/s agregado com 64 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.8-27b-abliterated (fp8_27) | 1 milhao de tokens de saida | L40S | 0.8 | 1.89609 | 9.4145 | 117.2 tok/s agregado com 8 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.8-27b-abliterated (fp8_dflash) | 1 milhao de tokens de saida | RTX PRO 6000 | 1.36 | 0.36363 | 1.8055 | 1038.9 tok/s agregado com 32 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.8-27b-abliterated (fp8_dflash) | 1 milhao de tokens de saida | H100 | 2.8 | 0.55468 | 2.7541 | 1402.2 tok/s agregado com 32 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.8-27b-abliterated (fp8_dflash) | 1 milhao de tokens de saida | L40S | 0.8 | 1.05569 | 5.2417 | 210.5 tok/s agregado com 32 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.8-27b-abliterated (fp8_plain) | 1 milhao de tokens de saida | RTX PRO 6000 | 1.36 | 0.54411 | 2.7016 | 694.3 tok/s agregado com 32 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.8-27b-abliterated (fp8_plain) | 1 milhao de tokens de saida | L40S | 0.8 | 0.65844 | 3.2693 | 337.5 tok/s agregado com 32 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.8-27b-abliterated (nvfp4_dflash) | 1 milhao de tokens de saida | RTX PRO 6000 | 1.36 | 0.25776 | 1.2798 | 1465.6 tok/s agregado com 32 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.8-27b-abliterated (nvfp4_dflash) | 1 milhao de tokens de saida | L40S | 0.8 | 0.90334 | 4.4853 | 246.0 tok/s agregado com 32 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.8-27b-abliterated (plain) | 1 milhao de tokens de saida | RTX 5090 | 0.55 | 0.18093 | 0.8984 | 844.4 tok/s agregado com 16 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.8-27b-abliterated (plain) | 1 milhao de tokens de saida | RTX 3090 | 0.22 | 0.23742 | 1.1788 | 257.4 tok/s agregado com 16 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.8-27b-abliterated (plain) | 1 milhao de tokens de saida | RTX 4090 | 0.43 | 0.40366 | 2.0043 | 295.9 tok/s agregado com 16 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.8-27b-abliterated (plain) | 1 milhao de tokens de saida | A100 PCIE |  | 0.53937 | 2.6781 | 344.1 tok/s agregado com 8 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.8-27b-abliterated (plain) | 1 milhao de tokens de saida | RTX PRO 6000 | 1.36 | 0.54513 | 2.7067 | 693.0 tok/s agregado com 16 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.8-27b-abliterated (plain) | 1 milhao de tokens de saida | L40S | 0.8 | 1.02738 | 5.1011 | 216.3 tok/s agregado com 8 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.8-27b-abliterated (plain) | 1 milhao de tokens de saida | GB10 | 0.449 | 1.07427 | 5.3339 | 116.1 tok/s agregado com 16 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.8-27b-abliterated (q9bf16) | 1 milhao de tokens de saida | A100 PCIE |  | 0.21682 | 1.0765 | 856.0 tok/s agregado com 32 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| LLM qwen3.8-27b-abliterated (q9bf16) | 1 milhao de tokens de saida | L40S | 0.8 | 0.48048 | 2.3857 | 462.5 tok/s agregado com 32 usuarios | GPU saturada; ocupacao baixa encarece proporcionalmente |
| Mask R-CNN (torchvision, proxy Detectron2) | 1000 imagens | RTX 3090 | 0.22 | 0.00182 | 0.0091 | 29.85 ms/imagem |  |
| Mask R-CNN (torchvision, proxy Detectron2) | 1000 imagens | RTX 3090 | 0.22 | 0.00187 | 0.0093 | 30.54 ms/imagem |  |
| Mask R-CNN (torchvision, proxy Detectron2) | 1000 imagens | RTX 4090 | 0.43 | 0.00222 | 0.011 | 18.6 ms/imagem |  |
| Mask R-CNN (torchvision, proxy Detectron2) | 1000 imagens | RTX 5090 | 0.55 | 0.00271 | 0.0134 | 17.73 ms/imagem |  |
| Mask R-CNN (torchvision, proxy Detectron2) | 1000 imagens | L40S | 0.8 | 0.00408 | 0.0203 | 18.36 ms/imagem |  |
| Mask R-CNN (torchvision, proxy Detectron2) | 1000 imagens | RTX PRO 6000 | 1.36 | 0.00511 | 0.0254 | 13.52 ms/imagem |  |
| Mask R-CNN (torchvision, proxy Detectron2) | 1000 imagens | GB10 | 0.449 | 0.00958 | 0.0476 | 76.84 ms/imagem |  |
| Segmentacao (SAM 2 hiera_large) | 1000 imagens | RTX 5090 | 0.55 | 0.00332 | 0.0165 | 21.75 ms/imagem |  |
| Segmentacao (SAM 2 hiera_large) | 1000 imagens | RTX 3090 | 0.22 | 0.00425 | 0.0211 | 69.53 ms/imagem |  |
| Segmentacao (SAM 2 hiera_large) | 1000 imagens | RTX 4090 | 0.43 | 0.00646 | 0.0321 | 54.11 ms/imagem |  |
| Segmentacao (SAM 2 hiera_large) | 1000 imagens | GB10 | 0.449 | 0.01148 | 0.057 | 92.03 ms/imagem |  |
| Segmentacao (SAM 2 hiera_large) | 1000 imagens | L40S | 0.8 | 0.01408 | 0.0699 | 63.37 ms/imagem |  |
| Segmentacao (SAM 2 hiera_large) | 1000 imagens | RTX PRO 6000 | 1.36 | 0.19097 | 0.9482 | 505.52 ms/imagem |  |
| Transcodificacao 4K HEVC (NVENC) | 1 hora de video | RTX 3090 | 0.22 | 0.07358 | 0.3653 | 2.99x tempo real |  |
| Transcodificacao 4K HEVC (NVENC) | 1 hora de video | GB10 | 0.449 | 0.11114 | 0.5518 | 4.04x tempo real |  |
| Transcodificacao 4K HEVC (NVENC) | 1 hora de video | RTX 4090 | 0.43 | 0.11559 | 0.5739 | 3.72x tempo real |  |
| Transcodificacao 4K HEVC (NVENC) | 1 hora de video | RTX 5090 | 0.55 | 0.12035 | 0.5976 | 4.57x tempo real |  |
| Transcodificacao 4K HEVC (NVENC) | 1 hora de video | L40S | 0.8 | 0.2346 | 1.1649 | 3.41x tempo real |  |
| Transcodificacao 4K HEVC (NVENC) | 1 hora de video | RTX PRO 6000 | 1.36 | 0.36856 | 1.83 | 3.69x tempo real |  |
| Transcricao de audio (faster-whisper) | 1 hora de audio | RTX 4090 | 0.43 | 0.0086 | 0.0427 | RTF 0.02 |  |
| Transcricao de audio (faster-whisper) | 1 hora de audio | RTX 4090 | 0.43 | 0.02064 | 0.1025 | RTF 0.048 |  |
| Transcricao de audio (faster-whisper) | 1 hora de audio | RTX 4090 | 0.43 | 0.04429 | 0.2199 | RTF 0.103 |  |
| Video gerado (LTX-Video 512x320) | 1 min de video | RTX 5090 | 0.55 | 0.00733 | 0.0364 | 0.8 s de GPU por s de video |  |
| Video gerado (LTX-Video 512x320) | 1 min de video | RTX 4090 | 0.43 | 0.00788 | 0.0391 | 1.1 s de GPU por s de video |  |
| Video gerado (LTX-Video 512x320) | 1 min de video | RTX 3090 | 0.22 | 0.0088 | 0.0437 | 2.4 s de GPU por s de video |  |
| Video gerado (LTX-Video 512x320) | 1 min de video | L40S | 0.8 | 0.01467 | 0.0728 | 1.1 s de GPU por s de video |  |
| Video gerado (LTX-Video 512x320) | 1 min de video | RTX PRO 6000 | 1.36 | 0.02267 | 0.1125 | 1.0 s de GPU por s de video |  |
| Video gerado (LTX-Video 512x320) | 1 min de video | GB10 | 0.449 | 0.03368 | 0.1672 | 4.5 s de GPU por s de video |  |
| Voz sintetica com clonagem (F5-TTS) | 1 hora de audio | RTX 5090 | 0.55 | 0.0231 | 0.1147 | RTF 0.042 |  |
| Voz sintetica com clonagem (F5-TTS) | 1 hora de audio | RTX 4090 | 0.43 | 0.02408 | 0.1196 | RTF 0.056 |  |
| Voz sintetica com clonagem (F5-TTS) | 1 hora de audio | RTX 3090 | 0.22 | 0.02772 | 0.1376 | RTF 0.126 |  |
| Voz sintetica com clonagem (F5-TTS) | 1 hora de audio | RTX 5090 | 0.55 | 0.0407 | 0.2021 | RTF 0.074 |  |
| Voz sintetica com clonagem (F5-TTS) | 1 hora de audio | L40S | 0.8 | 0.0504 | 0.2502 | RTF 0.063 |  |
| Voz sintetica com clonagem (F5-TTS) | 1 hora de audio | L40S | 0.8 | 0.0512 | 0.2542 | RTF 0.064 |  |
| Voz sintetica com clonagem (F5-TTS) | 1 hora de audio | L40S | 0.8 | 0.0608 | 0.3019 | RTF 0.076 |  |
| Voz sintetica com clonagem (F5-TTS) | 1 hora de audio | GB10 | 0.449 | 0.06286 | 0.3121 | RTF 0.14 |  |
| Voz sintetica com clonagem (F5-TTS) | 1 hora de audio | RTX PRO 6000 | 1.36 | 0.09656 | 0.4794 | RTF 0.071 |  |



> Fonte: campanha de benchmark da Rangel Tech (26 a 28/10/2026). Preço de GPU muda: confira o preço do dia.
