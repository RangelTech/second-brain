---
name: frigate
description: |
  NVR (gravador de câmeras) com detecção de objetos em tempo real em câmeras IP. Use quando o cliente disser: "monitorar minhas câmeras"; "gravar câmeras e detectar pessoas"; "detecção de objetos nas câmeras IP"; "NVR com alerta de movimento"; "ver câmera de segurança no computador".
---

# Frigate

> **Validada no benchmark (clone e inspeção).**

## Quando usar
Cliente com câmeras RTSP/ONVIF que quer gravação, detecção e eventos.

## Quando NÃO usar
Câmeras sem rede (precisa de RTSP).

## Passo a passo
Executar com Docker Compose conforme a documentação do Frigate (`blakeblackshear/frigate`): montar a pasta de gravações, escrever `config.yml` com as câmeras (RTSP) e o detector, e abrir a interface na porta 5000.

## O que o benchmark mediu
Clonado e inspecionado em sandbox de CPU (não executado): 4.0s, pico de memória 34 MB

## Requisitos
Docker (Linux); acelerador de detecção recomendado (Coral ou GPU); sem root não roda por Docker. Precisa de GPU: Opcional.

## Combina com
`mediamtx`, `onvif-zeep`, `bytetrack`, `vision`.
