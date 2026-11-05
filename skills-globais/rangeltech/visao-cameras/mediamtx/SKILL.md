---
name: mediamtx
description: MediaMTX (ADOTAR). Servidor/proxy RTSP para ingest. MIT.
---

# MediaMTX

**Veredito da campanha (26 a 28/10/2026):** ADOTAR. **Classe do dado:** medido.

## Para que serve
Servidor/proxy RTSP para ingest. MIT.

> Ready-to-use Media-over-QUIC / SRT / WebRTC / RTSP / RTMP / LL-HLS / MPEG-TS / RTP live media server and media proxy that allows to read, pu

## O que foi medido
- sandbox CPU: OK, executou, 15.6s, pico RSS 135 MB; probe_ms=5328

## Hardware
Roda sem GPU dedicada.

## Licença
MIT (permissiva). Confira a licença do código e a dos pesos antes de usar em produto.

## Instalação e uso

### Receita testada (VM Linux sem root, MediaMTX v1.21.3, 05/11/2026)

Tarefa: subir um servidor RTSP local, publicar um vídeo de teste de 10 s em `rtsp://localhost:8554/teste` e ler de volta com o `ffprobe`. **Funcionou** em 4 min 18 s: o `ffprobe` devolveu `h264`, vídeo, 640x480, 25 fps, formato `rtsp`. Sem root.

1. Baixe o binário da release do MediaMTX (`mediamtx_v1.21.3_linux_amd64.tar.gz`, cerca de 28 MB). O tar extrai direto o binário `mediamtx` e um `mediamtx.yml`, sem pasta versionada. Binário único, sem dependências.
2. Inicie em segundo plano na pasta com o `mediamtx.yml`: `./mediamtx mediamtx.yml &`. Portas confirmadas escutando: **8554 (RTSP)** e 8888; confira as demais (HLS, WebRTC, API) no `mediamtx.yml`.
3. Gere o vídeo de teste com o FFmpeg (padrão `testsrc`, 10 s, 640x480, H.264) e publique em tempo real:

```
ffmpeg -re -i teste_src.mp4 -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -an   -f rtsp -rtsp_transport tcp rtsp://localhost:8554/teste
```

4. Prove que funciona lendo de volta (com o publicador ainda rodando):

```
ffprobe -v error -rtsp_transport tcp -show_entries stream=codec_name,codec_type,width,height,avg_frame_rate rtsp://localhost:8554/teste
```

### Armadilhas

- **Só precisa de root para portas abaixo de 1024** (por exemplo o RTSP clássico 554). Em contas comuns use 8554.
- `duration=N/A` no `ffprobe` é normal em RTSP ao vivo.
- Rode o publicador e a leitura num script (o agente teve problema com `&` embutido em um comando único) e derrube o servidor ao terminar.
- Câmeras reais (ONVIF) e o consumo do stream por detecção (YOLO) não foram testados aqui.
- O FFmpeg não está no PATH da VM: veja a skill `ambiente-do-computador`.

## Fonte
Fonte: campanha de benchmark de ferramentas (out/2026). Números que mudam com o tempo (preço de GPU) valem na data da medição: confira o preço do dia.
