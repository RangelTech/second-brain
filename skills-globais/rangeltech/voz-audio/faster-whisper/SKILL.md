---
name: faster-whisper
description: faster-whisper (ADOTAR). STT. Quebra no ambiente CUDA13 (falha medida); usar o Whisper do vLLM.
---

# faster-whisper

**Veredito da campanha (26 a 28/10/2026):** ADOTAR. **Classe do dado:** medido.

## Para que serve
STT. Quebra no ambiente CUDA13 (falha medida); usar o Whisper do vLLM.

> Faster Whisper transcription with CTranslate2

## O que foi medido
- GPU (libs cu12 pre-carregadas): 4090 RTF 0,02; 3090 large-v3-turbo RTF 0,055 WER 0; GB10 (ARM64): FALHA, CTranslate2 sem CUDA; CPU sandbox: falhou por versao do av (rodar no trilho local)
- sandbox CPU: FALHOU (exit_1) em 5.5s / sandbox CPU: OK, executou, 122.3s, pico RSS 3951 MB; small_rtf=0.0721; small_wer=0.023; audio_s=66; large_v3_turbo_rtf=0.0547

## Hardware
Precisa de GPU. Siga a skill `gpu-barata` para escolher e alugar (ligar, usar e desligar para não pagar parado).

## Licença
MIT (permissiva). Confira a licença do código e a dos pesos antes de usar em produto.

## Instalação e uso
Siga o README do repositório: https://github.com/SYSTRAN/faster-whisper
A campanha não padroniza comandos para esta ferramenta. Antes de rodar algo caro, faça um teste curto e confira a saída.


## Fonte
Skill `projetos` (campanha de benchmark da Rangel Tech). Números que mudam com o tempo (preço de GPU) valem na data da medição: confira o preço do dia.
