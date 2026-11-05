---
name: baocut
description: |
  Editor de vídeo conduzido por agente. Use quando o cliente disser: "edite meu vídeo com agente"; "cortar vídeo automaticamente"; "editor de vídeo por IA".
---

# BaoCut

> **Validada no benchmark.**

## Quando usar
Edição de vídeo assistida por agente na agência.

## Quando NÃO usar
Título simples (use `video-motion`).

## Passo a passo
Comandos e exemplos do README oficial:

```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
. "$HOME/.cargo/env"
rustup default stable
rustup target add wasm32-unknown-unknown
```

```
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
xcrun --find metal
# If Metal is missing from the selected Xcode:
xcodebuild -downloadComponent MetalToolchain
```

## O que o benchmark mediu
Rodou em sandbox de CPU: 10.5s, pico de memória 93 MB

## Requisitos
Aplicativo de desktop com Rust; Windows/macOS/Linux. Sem GPU.

## Combina com
`video-motion`, `get-brolls`.
