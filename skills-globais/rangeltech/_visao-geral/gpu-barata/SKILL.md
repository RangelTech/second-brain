---
name: gpu-barata
description: Como escolher e usar GPU alugada pelo custo por tarefa: qual GPU para qual modelo, quantização, ligar e desligar para não pagar parado.
---

# Escolher GPU alugada pelo custo por tarefa

Regra principal: **memória decide** (pesos + reserva de ~1 GiB + cache KV precisam caber); depois vem o custo por tarefa, não o preço por hora. Ligue só quando houver trabalho e **desligue ao terminar**; confirme que a instância está parada.

## Matriz modelo por GPU
# Compat modelo x GPU

Cada celula: OK medido (tok/s para 1 usuario e pico), NAO CARREGA (medido, com a causa), ESTIMATIVA (nao medido) ou nao se aplica.

Fonte: `specs/BIBLIOTECAS_ECOSSISTEMA_v6.xlsx`, aba "Compat modelo x GPU". Numeros medidos/calculados em 26 a 28/10/2026; precos de marketplace variam por hora.

| Grupo | Modelo / ferramenta | VRAM aprox. (GB) | RTX 3090 (24 GB) | RTX 4090 (24 GB) | RTX 5090 (32 GB) | L40S (48 GB) | H100 NVL (94 GB) | RTX PRO 6000 (96 GB) | GB10 (121 GB) | Nota |
|---|---|---|---|---|---|---|---|---|---|---|
| LLM | Qwen3.8-27B abliterado NVFP4 (+DFlash2) | 29 | NAO CARREGA (medido): warmup completed in 24.390s (APIServer pid=10498) INFO 10-27 04:52:25 [base.py:261] Readonly multi-modal warmup completed in 2.479s (EngineCore pid=10881) torc | NAO CARREGA (medido): the reference implementation (qwen-vl-utils) applies, so some videos cost far more tokens than they would there. In v5.22 the capped behavior will become the de | NAO CARREGA (OOM; checkpoint 28,2 GiB) | OK: 104.1 tok/s p/ 1 usuario; pico 246 tok/s com 32 usuarios; meta (TTFT<=3s, >=20 tok/s) ate 1 usuarios | ESTIMATIVA: deve caber (nao medido) | OK: 143.1 tok/s p/ 1 usuario; pico 1466 tok/s com 32 usuarios; meta (TTFT<=3s, >=20 tok/s) ate 32 usuarios | OK: 25.5 tok/s p/ 1 usuario; pico 221 tok/s com 32 usuarios; meta (TTFT<=3s, >=20 tok/s) ate 1 usuarios | NVFP4 exige Blackwell (5090/PRO 6000/GB10) |
| LLM | Qwen3.8-27B abliterado FP8 + DFlash2 | 30 | NAO CARREGA (medido): PIServer pid=8616) RuntimeError: Engine core initialization failed. See root cause above. Failed core proc(s): {} (EngineCore pid=9193) torch.OutOfMemoryError: | NAO CARREGA (medido): erver pid=3949) RuntimeError: Engine core initialization failed. See root cause above. Failed core proc(s): {} (EngineCore pid=4402) torch.OutOfMemoryError: CUD | NAO CARREGA (medido): erver pid=3262) RuntimeError: Engine core initialization failed. See root cause above. Failed core proc(s): {} (EngineCore pid=3580) torch.OutOfMemoryError: CUD | OK: 109.7 tok/s p/ 1 usuario; pico 210 tok/s com 32 usuarios; meta (TTFT<=3s, >=20 tok/s) ate 4 usuarios | OK: 118.0 tok/s p/ 1 usuario; pico 1402 tok/s com 32 usuarios; meta (TTFT<=3s, >=20 tok/s) ate 8 usuarios | OK: 173.5 tok/s p/ 1 usuario; pico 1039 tok/s com 32 usuarios; meta (TTFT<=3s, >=20 tok/s) ate 32 usuarios | OK: 26.7 tok/s p/ 1 usuario; pico 215 tok/s com 32 usuarios; meta (TTFT<=3s, >=20 tok/s) ate 1 usuarios |  |
| LLM | Qwen3.8-27B abliterado FP8 (sem DFlash2) | 30 | NAO CARREGA (medido): PIServer pid=7739) RuntimeError: Engine core initialization failed. See root cause above. Failed core proc(s): {} (EngineCore pid=8122) torch.OutOfMemoryError: | NAO CARREGA (medido): erver pid=3116) RuntimeError: Engine core initialization failed. See root cause above. Failed core proc(s): {} (EngineCore pid=3494) torch.OutOfMemoryError: CUD | NAO CARREGA (medido): erver pid=2328) RuntimeError: Engine core initialization failed. See root cause above. Failed core proc(s): {} (EngineCore pid=2576) ValueError: No available me | OK: 21.7 tok/s p/ 1 usuario; pico 338 tok/s com 32 usuarios; meta (TTFT<=3s, >=20 tok/s) ate 4 usuarios | ESTIMATIVA: deve caber (nao medido) | OK: 45.4 tok/s p/ 1 usuario; pico 694 tok/s com 32 usuarios; meta (TTFT<=3s, >=20 tok/s) ate 32 usuarios | OK: 8.0 tok/s p/ 1 usuario; pico 122 tok/s com 32 usuarios; NAO cumpre a meta de latencia | L40S: DFlash2 nao cabe com contexto 32K (faltaram 1,1 GiB de KV) |
| LLM | Qwen3.8-27B abliterado BF16 + DFlash2 | 54 | NAO CARREGA (medido): implementation (qwen-vl-utils) applies, so some videos cost far more tokens than they would there. In v5.22 the capped behavior will become the default and `cap | NAO CARREGA (medido): mplementation (qwen-vl-utils) applies, so some videos cost far more tokens than they would there. In v5.22 the capped behavior will become the default and `cap_ | NAO CARREGA (medido): up completed in 11.391s(APIServer pid=3887) INFO 10-27 06:48:56 [base.py:261] Readonly multi-modal warmup completed in 1.313s (EngineCore pid=4133) torch.OutOfM | NAO CARREGA (medido): the reference implementation (qwen-vl-utils) applies, so some videos cost far more tokens than they would there. In v5.22 the capped behavior will become the d | OK: 87.2 tok/s p/ 1 usuario; pico 748 tok/s com 64 usuarios; NAO cumpre a meta de latencia | OK: 78.7 tok/s p/ 1 usuario; pico 608 tok/s com 16 usuarios; meta (TTFT<=3s, >=20 tok/s) ate 16 usuarios | OK: 13.1 tok/s p/ 1 usuario; pico 125 tok/s com 32 usuarios; NAO cumpre a meta de latencia |  |
| LLM | Qwen3.8-27B AWQ 4-bit (Huihui, 18 GiB) | 19 | OK: 46.7 tok/s p/ 1 usuario; pico 257 tok/s com 16 usuarios; meta (TTFT<=3s, >=20 tok/s) ate 8 usuarios | OK: 53.7 tok/s p/ 1 usuario; pico 296 tok/s com 16 usuarios; meta (TTFT<=3s, >=20 tok/s) ate 8 usuarios | OK: 83.6 tok/s p/ 1 usuario; pico 844 tok/s com 16 usuarios; meta (TTFT<=3s, >=20 tok/s) ate 16 usuarios | OK: 43.2 tok/s p/ 1 usuario; pico 216 tok/s com 8 usuarios; meta (TTFT<=3s, >=20 tok/s) ate 8 usuarios | ESTIMATIVA: deve caber (nao medido) | OK: 76.7 tok/s p/ 1 usuario; pico 693 tok/s com 16 usuarios; meta (TTFT<=3s, >=20 tok/s) ate 16 usuarios | OK: 13.6 tok/s p/ 1 usuario; pico 116 tok/s com 16 usuarios; NAO cumpre a meta de latencia | MTP nao subiu no vLLM 0.30 |
| LLM | Qwen3.5-9B BF16 (18 GiB) | 19 | OK: 48.2 tok/s p/ 1 usuario; pico 544 tok/s com 32 usuarios; meta (TTFT<=3s, >=20 tok/s) ate 16 usuarios | OK: 56.9 tok/s p/ 1 usuario; pico 710 tok/s com 32 usuarios; meta (TTFT<=3s, >=20 tok/s) ate 16 usuarios | OK: 95.5 tok/s p/ 1 usuario; pico 1802 tok/s com 32 usuarios; meta (TTFT<=3s, >=20 tok/s) ate 32 usuarios | OK: 50.5 tok/s p/ 1 usuario; pico 559 tok/s com 32 usuarios; meta (TTFT<=3s, >=20 tok/s) ate 16 usuarios | ESTIMATIVA: deve caber (nao medido) | OK: 84.6 tok/s p/ 1 usuario; pico 967 tok/s com 32 usuarios; meta (TTFT<=3s, >=20 tok/s) ate 16 usuarios | OK: 12.9 tok/s p/ 1 usuario; pico 132 tok/s com 16 usuarios; NAO cumpre a meta de latencia |  |
| Visao | YOLO11 n/m/x (FP16, 640px) | 1.5 | OK: YOLO11m 397 fps (lote 16, so GPU), VRAM 0.89 GB | OK: YOLO11m 734 fps (lote 16, so GPU), VRAM 0.89 GB | OK: YOLO11m 1091 fps (lote 16, so GPU), VRAM 0.89 GB | OK: YOLO11m 693 fps (lote 16, so GPU), VRAM 0.89 GB | OK: YOLO11m 1159 fps (lote 16, so GPU), VRAM 0.89 GB | OK: YOLO11m 1136 fps (lote 16, so GPU), VRAM 0.89 GB | OK: YOLO11m 172 fps (lote 16, so GPU), VRAM 0.89 GB |  |
| Visao | SAM 2 hiera_large | 4 | OK: 69.53 ms/imagem, VRAM 1.67 GB | OK: 54.11 ms/imagem, VRAM 1.67 GB | OK: 21.75 ms/imagem, VRAM 1.7 GB | OK: 63.37 ms/imagem, VRAM 1.67 GB | ESTIMATIVA: deve caber (nao medido) | OK: 505.52 ms/imagem, VRAM 1.7 GB | OK: 92.03 ms/imagem, VRAM 1.69 GB |  |
| Visao | Grounding DINO base | 2 | OK: 108.05 ms/imagem, VRAM 1.06 GB | OK: 149.26 ms/imagem, VRAM 1.06 GB | OK: 45.36 ms/imagem, VRAM 1.08 GB | OK: 74.01 ms/imagem, VRAM 1.06 GB | ESTIMATIVA: deve caber (nao medido) | OK: 62.21 ms/imagem, VRAM 1.08 GB | OK: 168.8 ms/imagem, VRAM 1.08 GB |  |
| Visao | Mask R-CNN R50-FPN (torchvision; Detectron2 nao compila) | 2 | OK: 29.85 ms/imagem | OK: 18.6 ms/imagem | OK: 17.73 ms/imagem | OK: 18.36 ms/imagem | ESTIMATIVA: deve caber (nao medido) | OK: 13.52 ms/imagem | OK: 76.84 ms/imagem | Detectron2: build falhou em cu13; reteste em cu124 na sessao gpu-libs |
| Midia | SDXL-Turbo 512px 4 passos (diffusers) | 10.5 | OK: 0.268 s/imagem (lote 4), VRAM 10.49 GB | OK: 0.2 s/imagem (lote 4), VRAM 10.49 GB | OK: 0.134 s/imagem (lote 4), VRAM 10.51 GB | OK: 0.13 s/imagem (lote 4), VRAM 10.49 GB | OK: 0.091 s/imagem (lote 4), VRAM 10.76 GB | OK: 0.122 s/imagem (lote 4), VRAM 10.51 GB | OK: 0.401 s/imagem (lote 4), VRAM 10.51 GB |  |
| Midia | LTX-Video 512x320 (diffusers) | 16 | OK: 2.4 s de GPU por s de video | OK: 1.1 s de GPU por s de video | OK: 0.8 s de GPU por s de video | OK: 1.1 s de GPU por s de video | ESTIMATIVA: deve caber (nao medido) | OK: 1.0 s de GPU por s de video | OK: 4.5 s de GPU por s de video |  |
| Midia | F5-TTS (clonagem de voz) | 8 | OK: RTF 0.126 | OK: RTF 0.056 | OK: RTF 0.074 | OK: RTF 0.064 | ESTIMATIVA: deve caber (nao medido) | OK: RTF 0.071 | OK: RTF 0.14 |  |
| Midia | FFmpeg NVENC 4K HEVC | 1 | OK: 2.99x tempo real | OK: 3.72x tempo real | OK: 4.57x tempo real | OK: 3.41x tempo real | ESTIMATIVA: deve caber (nao medido) | OK: 3.69x tempo real | OK: 4.04x tempo real |  |
| Midia | AirLLM Qwen3.8-27B BF16 (offload) | 3.6 | AirLLM: { load_s : 465.9,  res : { 8 : { s : 212.8,  tok_s : 0.038},  32 : { s : 831.2,  tok_s : 0.039}},  vram_gb : 3.54} | AirLLM: { load_s : 1010.0,  res : { 8 : { s : 96.5,  tok_s : 0.083},  32 : { s : 361.2,  tok_s : 0.089}},  vram_gb : 3.54} | RODA mas 0,03 tok/s (inviavel p/ interativo); VRAM 3,57 GB | AirLLM: { load_s : 139.1,  res : { 8 : { s : 166.7,  tok_s : 0.048},  32 : { s : 640.7,  tok_s : 0.05}},  vram_gb : 3.54} | NAO SE APLICA: o 27B BF16 (52 GB) cabe nativamente nesta placa; usar vLLM | NAO SE APLICA: o 27B BF16 (52 GB) cabe nativamente nesta placa; usar vLLM | NAO SE APLICA: o 27B BF16 (52 GB) cabe nativamente nesta placa; usar vLLM | so faz sentido onde o modelo nao cabe: 24/32/48 GB; comparar com AWQ nativo |
| Midia | FLUX.3 Klein (CLI oficial, ~26-31 GB) | 26 | FALHA MEDIDA: ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ RuntimeError: torch._scaled_mm is only supported on CUDA devices with compute capability >= 9.0 or 8.9, or ROCm MI300+ | OK: wall=39.094529634s; Loading weights:   0%/          / 0/200 [00:00<?, ?it/s]Loading weight; wall=39.105809566s; Loading weights:   0%/          / 0/200 [00:00<?, ?it/s]Loading weight | OK: wall=23.634383588s; Loading weights:   0%/          / 0/200 [00:00<?, ?it/s]Loading weight; wall=27.434110089s; Loading weights:   0%/          / 0/200 [00:00<?, ?it/s]Loading weight; wall=31.073304333s; Loading weights:   0%/          / 0/200 [00:00<?, ?it/s] | OK: wall=26.767298107s; Loading weights:   0%/          / 0/200 [00:00<?, ?it/s]Loading weight; wall=27.221155399s; Loading weights:   0%/          / 0/200 [00:00<?, ?it/s]Loading weight; wall=27.290703312s; Loading weights:   0%/          / 0/200 [00:00<?, ?it/s] | ESTIMATIVA: deve caber (nao medido) | OK: wall=27.520469223s; Loading weights:   0%/          / 0/200 [00:00<?, ?it/s]Loading weight; wall=27.635068861s; Loading weights:   0%/          / 0/200 [00:00<?, ?it/s]Loading weight; wall=28.312650805s; Loading weights:   0%/          / 0/200 [00:00<?, ?it/s] | OK: wall=101.415518512s; Loading weights:   0%/          / 0/200 [00:00<?, ?it/s]Loading weigh; wall=102.769893566s; Loading weights:   0%/          / 0/200 [00:00<?, ?it/s]Loading weigh; wall=130.907919035s; Loading weights:   0%/          / 0/200 [00:00<?, ?it/s | resultado em out/gated (sessao gated-5090) |
| Midia | NVIDIA PersonaPlex 7B (voz full-duplex) | 18 | OK: audio_s=40.0 wall_s=210.053970789; [Info] Wrote output text to /workspace/eco/out/all/pp_N; audio_s=40.0 wall_s=43.061654350; [Info] Wrote output text to /workspace/eco/out/all/pp_NA | OK: audio_s=40.0 wall_s=211.119713220; [1;34m[Info][0m Wrote output text to /workspace/eco/out; audio_s=40.0 wall_s=36.857096420; [1;34m[Info][0m Wrote output text to /workspace/eco/out/ | OK: audio_s=40.0 wall_s=33.061970587; [1;34m[Info][0m Wrote output text to /workspace/eco/out/; audio_s=40.0 wall_s=640.734981497; [1;34m[Info][0m Wrote output text to /workspace/eco/out | OK: audio_s=40.0 wall_s=239.468663273; [1;34m[Info][0m Wrote output text to /workspace/eco/out; audio_s=40.0 wall_s=32.892590795; [1;34m[Info][0m Wrote output text to /workspace/eco/out/ | ESTIMATIVA: deve caber (nao medido) | OK: audio_s=40.0 wall_s=148.891200790; [1;34m[Info][0m Wrote output text to /workspace/eco/out; audio_s=40.0 wall_s=30.618124340; [1;34m[Info][0m Wrote output text to /workspace/eco/out/ | FALHA MEDIDA: audio_s= wall_s=.019333542; /workspace/g/pp/.venv/bin/python: No module named moshi.offline | resultado em out/gated (sessao gated-5090) |
| Midia | SUPRA-Tex (imagem->3D, testado pelo autor em 3090 24 GB) | 24 | FALHA MEDIDA: es stay in the target environment. Without FlashAttention, inference uses SDPA; FlashAttention-2/3 is faster. Native source pins identify upstream inputs, not verified equivalent binaries. FlexGEMM's | OK: Cleaning mesh:  50%/█████     / 3/6 [00:07<00:07,  2.46s/it]Parameterizing new mesh:  50%/; Cleaning mesh:  50%/█████     / 3/6 [00:08<00:07,  2.57s/it]Parameterizing new mesh:  50%/ | FALHA MEDIDA: ion --no-deps /workspace/g/st/.venv/supra-tex-runtime/sources/CuMeshCommand '['/workspace/g/st/.venv/bin/python', '-I', '-m', 'pip', 'install', '--no-input', '--no-build-isolation', '--no-deps', '/wor | FALHA MEDIDA: File  /workspace/g/st/scripts/run_example.py , line 81, in has_foreground_alpha    from PIL import ImageModuleNotFoundError: No module named 'PIL' | ESTIMATIVA: deve caber (nao medido) | FALHA MEDIDA: ion --no-deps /workspace/g/st/.venv/supra-tex-runtime/sources/CuMeshCommand '['/workspace/g/st/.venv/bin/python', '-I', '-m', 'pip', 'install', '--no-input', '--no-build-isolation', '--no-deps', '/wor | FALHA MEDIDA: s stay in the target environment. Without FlashAttention, inference uses SDPA; FlashAttention-2/3 is faster.Native source pins identify upstream inputs, not verified equivalent binaries. FlexGEMM's in | resultado em out/gated (sessao gated-supra) |


## Regras e vereditos de servir modelo
# Vereditos e como usar (curado; detalhe de cada uma das 106 ferramentas em `bibliotecas.md`)

Aviso de fontes: a planilha v6 (base de `bibliotecas.md`) foi fechada em 27/10 e tem frases de fases anteriores ("SGLang ainda nao medido", "NVFP4 exige Blackwell", "3D Model Anything UNVERIFIED"). Onde os ARTIGOS (28/10) corrigem, vale o artigo. Correcoes conhecidas estao marcadas abaixo com [corrigido].

## Servir LLM

**vLLM: ADOTAR.** Motor de servir. Medido em 7 GPUs. 9B BF16 na 4090: 657 tok/s agregado com 16 usuarios, TTFT 0,16 s. Como usar: servir o modelo com `--gpu-memory-utilization` calculado pela memoria (ver abaixo), `--max-model-len` coerente com o KV cache; ler as linhas de partida (`Available KV cache memory`, `GPU KV cache size`). Relatar sempre a concorrencia ATINGIDA, nao a pedida.
- Regra de memoria que previu todas as falhas: memoria utilizavel - pesos - reserva (grafos, ativacoes, ~0,8 a 1,0 GiB) = cache KV. Se negativo, o servidor nao sobe. O 27B em 28 GiB nao sobe em 24 e nem em 32 GB (RTX 5090); sobe em 45 GB+.
- DFlash2 (decodificacao especulativa): sobe velocidade de 1 usuario, nem sempre o agregado sob carga; no L40S de 48 GB o DFlash2 nao cabe com contexto de 32K (usar FP8 sem DFlash2).
- Excesso de usuarios: um teto de lote nao reportado fez o SGLang enfileirar a 32 usuarios na 5090.

**SGLang: TESTAR, empata com vLLM ate 16 usuarios.** [corrigido: foi medido] Na 5090 com 9B BF16, empatou ate 16 usuarios; a 32 um teto de lote fez uma das duas enfileirar. Quem iniciar deve igualar configuracoes (graficos CUDA, limite de lote) e reportar concorrencia atingida.

**llama.cpp: TESTAR (pool leve, pouca VRAM, CPU).** CUDA na 4090, Qwen3.5-9B: Q4_K_M 146,8 tok/s de geracao e 10.864 tok/s de prompt; Q8_0 97,0 / 11.743. Para servir muitos usuarios, vLLM ganha.

**AirLLM: ESTUDAR, inviavel para interativo.** 27B BF16 por offload: 0,03 a 0,09 tok/s; usa ~3,5 GB de VRAM. So lote offline. Onde o modelo cabe, "nao se aplica". Offload em disco le a ~0,5% da banda da GPU.

**BitNet (bitnet.cpp): TESTAR para pool leve CPU**, modelos pequenos; nao substitui GPU.

## Quantizacao e formatos (27B)

- **AWQ 4-bit**: 17,8 GiB, cabe em 24 GB (~16.384 tokens de KV no 24 GB). Em 24 GB e a rota que realmente cabe. Usuarios no SLA: 3090 8 (224 tok/s), 4090 8 (283), 5090 16 (844), A100 8 (344), PRO 6000 16 (693). Qualidade: GSM8K 95,3%, MMLU 80%, HumanEval 94,5% (n=538 itens pareados, sem perda detectavel).
- **FP8**: 28,06 GiB. **NVFP4**: 27,69 GiB (so 1,3% menor que FP8 e 46% menor que BF16 de 51,1 GiB; mantem parte da rede em precisao maior).
- **NVFP4 nao exige Blackwell, exige memoria** [corrigido]: 5090 (Blackwell) falha com cache KV negativo; L40S (Ada, sem FP4) roda por kernel Marlin weight-only; 3090/4090 falham por OOM no carregamento. Na L40S: 1 usuario 104,1 tok/s contra 109,7 do FP8; 32 usuarios 246,0 contra 210,5 tok/s agregado; US$ 0,86 contra 1,01 por milhao de tokens. Se a carga e um usuario so, use FP8 ou AWQ.
- **BF16**: 51,1 GiB; so em 94+ GB (H100 NVL, PRO 6000, GB10).

## Qual GPU para qual produto

- **Lunar A (LLM permanente, referencia R$ 3.500/mes)**: GB10 propria e a unica abaixo da referencia, mas so 1 usuario na meta (21 a 27 tok/s). **RTX PRO 6000 (NVFP4 + DFlash2)**: ~32 sequencias na meta, 1.263 a 1.466 tok/s, R$ 4,9 a 5,5 mil/mes 24x7, US$ 0,26 a 0,33 por milhao de tokens: ~10x menos por token que o GB10. H100 NVL: pico 1.402 tok/s por R$ 10 mil/mes, pior custo por token que a PRO 6000 aqui. RTX 5090 32 GB: nao carrega o 27B NVFP4 nem FP8; serve 9B e AWQ 27B (844 tok/s a 16 usuarios).
- **Pool leve (9B)**: precisa de GPU de maior banda; no GB10 deu 13 tok/s por usuario (abaixo da meta de 20).
- **ARM GB10**: 121 GB de memoria unificada = cache enorme, decode lento, duas lacunas de software (CTranslate2 sem CUDA; NATTEN/sphn so x86_64), FLUX 133/102 s por imagem.

## Visao (KI Vision)

- **Ultralytics YOLO11: ADOTAR, mas AGPL-3.0** (licenca comercial se embutir; avaliar RT-DETR/YOLOX). YOLO11m lote 16 640 px (fps so modelo): 3090 397, 4090 734, 5090 1.091, L40S 693, PRO 6000 1.136, H100 NVL 1.159, GB10 172; YOLO11n 4.834 fps na 5090 mas **limitado pelo host** (CPU): para modelos pequenos a placa nova pode ser mais lenta por imagem.
- Cameras: velocidade do detector / fps da camera superestima varias vezes; decode NVDEC, tracker, I/O e escrita de NVR definem o limite. Medido na 5090 com 1080p H.264 por RTSP, 12 vCPU: processo-por-camera contra servico em lote (ver artigo 15). 4090/5090: dezenas de cameras so em deteccao (48 a 72 a 15 fps na conta de so-modelo).
- **ByteTrack: ADOTAR** (50 a 62 fps com YOLO11, 4090). **BoT-SORT: TESTAR** (28 a 31 fps). HOTA/IDF1 NOT_TESTED (sem ground truth).
- **SAM 2: ADOTAR (Apache-2.0)**: ms/imagem 5090 22, 4090 54, 3090 70, L40S 63, GB10 92; **PRO 6000 506 ms e um outlier nao explicado** (clocks normais; reexecutar antes de concluir).
- **Grounding DINO: TESTAR**: 5090 45, PRO 6000 62, L40S 74, 3090 108, 4090 149, GB10 169 ms.
- **Detectron2: TESTAR; nao compila em torch 2.8/cu13.** Rodou uma vez na 3090 (build py3.10 + torch cu124): Mask R-CNN 51,1 ms (p95 91), Faster R-CNN 44,5 ms. Proxy: Mask R-CNN do torchvision (13 a 31 ms, em ruido aleatorio).

## Armadilhas já pagas
# O que NAO foi medido e armadilhas ao usar estes dados

## Nao testado (nunca afirmar como feito)

- Disponibilidade/uptime mensal: testes de minutos nao provam SLA; soak so 35 min (RTX 5090). 24/7 e so calculo.
- H100 NVL: 13 celulas da matriz sao estimativa (excluida por custo, ~US$ 8 para fechar); uma sessao de ~US$ 7 a 9 fecharia.
- Whisper no vLLM, clonagem de voz em producao, imagem para video, pipeline misto.
- ComfyUI (so diffusers como proxy; ComfyUI subiu e respondeu).
- COLMAP mapeamento/denso, erro de mensuracao (MAE/RMSE), estoque/volume.
- HOTA/IDF1 de tracking (sem ground truth), NVDEC multi-stream, 1 a 32 cameras RTSP reais com precisao, alarme offline, ONVIF real, VLM espacial.
- Auditoria humana do juiz de comportamento e juiz cruzado.
- Trafego real de assinantes (cache de prefixo, creditos, perfil de contexto): a capacidade da API e calculo.
- 24 GB com o 27B em precisao alta; A800/A100 80 GB (hosts nao subiram); Jetson/edge.
- Qualidade de saida de imagem/video/voz: nenhuma avaliacao de qualidade; so olhar amostras (FLUX bateu o prompt; SDXL-Turbo e LTX com prompt em portugues nao).

## Armadilhas de leitura dos dados

1. **`errors` em testes de contexto curto** costumam ser prompts longos rejeitados (HTTP 400), nao falha do servidor. Use `long_prompt_rejected_http400` e `valid_run`.
2. **Gasto**: credito consumido, nao horas x preco. O ledger itemizado (US$ 27,25) e a campanha reconciliada (US$ 50,79) diferem 1,86x. Leases `running`/`partial` no RUN_SUMMARY custam ~0.
3. **FLUX incluindo carga de pesos**: o tempo por imagem inclui carregar 26 a 31 GB a cada chamada (ferramenta oficial = processo novo). Num servidor residente seria bem menor.
4. **Tempo de uma tabela de bibliotecas nao e tempo de reconstrucao**: `total_s` do COLMAP e o bloco da sessao, nao reconstrucao.
5. **Warm-up esconde**: a primeira chamada da 4090 no LTX levou 6,2 s e a seguinte 2,2 s. Reportar frio e quente separados.
6. **Host decide em modelos pequenos**: 4090 e 3090 alugadas eram hosts lentos; YOLO11n e SDXL-Turbo medem o host.
7. **SAM 2 na PRO 6000 (506 ms)**: outlier nao explicado; nao tirar conclusao de hardware.
8. **Mesmo codigo, mesma seed, placas diferentes**: composicao igual, pixels diferentes (FLUX) e texto diferente (PersonaPlex). Testes de regressao entre maquinas precisam de tolerancia.
9. **Juiz = o proprio modelo** no comportamento: vies de auto-avaliacao; pergunta sim/nao recebe "Sim." e vira `unsafe_compliance`.
10. **Planilha v6 desatualizada em alguns campos** (SGLang "nao medido", NVFP4 "exige Blackwell"): vale o artigo.

## Armadilhas operacionais aprendidas

- Guard de orcamento destroi instancia sem saber quanto falta para terminar: matou a ultima tentativa do SUPRA-Tex (com 3 min de inferencia restantes teria valido esperar; com 30, nao). Lista de arquivos a coletar deve ser escrita DEPOIS de saber o que a ferramenta produz (o GLB do 3D nunca foi trazido).
- Download de pesos antes de iniciar inferencia: a 9a tentativa iniciou a inferencia antes do fim do download e terminou sem saida.
- Hosts com trafego cobrado por TB e boots que nunca terminam: custam sem produzir.
- vLLM: `Available KV cache memory` negativo = falha por memoria; aumentar utilizacao so ganha ~1,9 GiB a cada 6 pontos em 32 GB.
- Antes de tornar publico qualquer coisa deste projeto: varredura de segredos, nenhum IP/host/id de instancia, nenhuma saida de modelo abliterado, nenhum dado de terceiros com termos restritivos.
- Heredoc do bash corrompe barras invertidas e aspas: escrever scripts pelo Write/Edit.
- GPU Vast alugada: nunca deixar ligada; a GB10 propria (instancia 53155573) deve ficar `exited`.

## Seguranca e conta

- Chaves (Vast, SSH, HF, GitHub PAT, Kaggle) ficam no cofre local/`secrets`; nunca em texto, nunca nos repos.
- Chaves antigas do Google Maps em historico de AreaAzul/ParqueDiversoes/Parking: restringir/apagar no Google Cloud. Uma chave OpenAI no historico do agent-llm foi desligada pelo dono.



> Fonte: campanha de benchmark da Rangel Tech (26 a 28/10/2026). Preço de GPU muda: confira o preço do dia.
