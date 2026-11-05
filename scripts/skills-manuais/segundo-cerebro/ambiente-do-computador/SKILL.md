---
name: ambiente-do-computador
description: |
  O que existe de verdade no computador (ou na máquina virtual) onde o Segundo Cérebro roda e como usar sem pedir ajuda: Node, npm, Python, uv, FFmpeg, Chromium e ripgrep embutidos no Hermes, pasta de trabalho, limites de uma VM sem root e sem Docker. Use antes de instalar qualquer coisa, ao receber "instale", "rode", "converta vídeo", "abra um navegador", "suba um servidor" ou ao ver `command not found`.
---

# Ambiente do computador: o que já existe e o que não existe

Antes de instalar algo ou perguntar ao usuário, confira esta lista. O Hermes traz as ferramentas abaixo na pasta `hermes/tools/` dos dados do app, mesmo quando o sistema não as tem no PATH.

## Ferramentas embutidas (verificadas na VM Linux de cliente, 05/11/2026)

| Ferramenta | Caminho (Linux) | Observação |
|---|---|---|
| Node.js 26 | `<dados>/hermes/tools/node-26.12.1-linux-x64/bin/node` | o `npm` vem em `.../npm-12.0.2-linux-x64/` |
| Python 3.14 | `<dados>/hermes/tools/python-3.14.9+*/bin/python3` | o `/usr/bin/python3` do sistema é 3.12 e **sem pip** |
| uv 0.13 | `<dados>/hermes/tools/uv-0.13.5-linux-x64/uv` | cria venv, instala pacotes e baixa outros Pythons (3.10, por exemplo) |
| FFmpeg 9 | `<dados>/hermes/tools/ffmpeg-9.0.1-linux-x64/bin/ffmpeg` | não está no PATH |
| Chromium | `<dados>/hermes/tools/chromium-*/` | navegador para Playwright e renderização |
| ripgrep | `<dados>/hermes/tools/ripgrep-*/` | |

`<dados>` é `/var/lib/segundo-cerebro` na VM e `%APPDATA%/SegundoCerebro` no Windows (no Windows, o Hermes também pode estar em `~/hermes/tools/`). Do sistema já existem `git`, `gcc`, `make` e `curl` na VM.

Use sempre o caminho completo da ferramenta, ou acrescente a pasta `bin` dela ao PATH no começo do comando, em vez de tentar instalar de novo.

## Pasta de trabalho

Arquivos do usuário vão na pasta de trabalho do app (`Documentos/Segundo Cérebro` no computador; `/var/lib/segundo-cerebro/Segundo Cerebro/` na VM). Imagens geradas ficam em `Imagens/` e vídeos em `Videos/`. Código e ambientes temporários vão em `hermes-home/cache/scratch/`, não dentro da pasta do usuário.

## Máquina virtual do cliente (Linux)

- Ubuntu 24.04, 4 vCPU, 8 GB de RAM, cerca de 90 GB de disco, **sem GPU**.
- O agente roda como o usuário `segundocerebro`, **sem root**: não há `sudo` nem `apt install`. O que precisar de pacote do sistema não instala.
- **Não há Docker nem Podman.** Serviços que só têm instalação por Docker (Evolution API, Metabase, etc.) precisam de compilação na pasta do usuário ou de uma VPS própria com Docker.
- Não há PostgreSQL nem Redis instalados.
- Sem pip no Python do sistema: use `uv venv` e `uv pip install`, ou o Python 3.14 do Hermes (`python -m venv`).
- Imagem gerada, vídeo gerado e LLM vão para a GPU do servidor pelas ferramentas do app (`midia_gerar_imagem`, etc.). Voz e visão computacional pesadas rodariam só em CPU, bem mais devagar.

## Cuidados com memória

Com 8 GB, um render pesado pode derrubar o app (o agente estimou 7,8 GB para um render de 150 quadros no Chromium em modo software). Rode um processo pesado por vez, evite abrir vários navegadores, e confira `free -m` antes de começar.

## Antes de dizer que não dá

1. Procure a ferramenta em `hermes/tools/`.
2. Tente `uv` para Python e `npm` local (`npm install <pacote> --ignore-scripts` evita compilações que exigem Visual Studio no Windows).
3. Só então diga o que bloqueou, com o comando exato e a mensagem de erro.
