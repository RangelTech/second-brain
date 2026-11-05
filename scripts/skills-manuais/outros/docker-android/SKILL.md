---
name: docker-android
description: |
  Emulador Android dentro de Docker, com acesso por navegador. Use quando o cliente disser: "testar meu app Android"; "emulador de Android no servidor"; "rodar Android no navegador".
---

# docker-android

> **Validada no benchmark (clone e inspeção).**

## Quando usar
Teste de app Android próprio.

## Quando NÃO usar
Máquina sem Docker/KVM.

## Passo a passo
Seguir o README de `budtmo/docker-android` (imagem Docker com porta do emulador web).

## O que o benchmark mediu
Clonado e inspecionado em sandbox de CPU (não executado): 2.0s, pico de memória 33 MB

## Requisitos
Docker, virtualização KVM; Linux. Sem GPU.

## Combina com
`playwright`.
