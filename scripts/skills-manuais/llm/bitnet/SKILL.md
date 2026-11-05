---
name: bitnet
description: |
  Inferência de modelos de 1 bit em CPU (modelo b1.58 de 2B, cerca de 1,2 GB). Use quando o cliente disser: "rodar IA no meu computador sem placa de vídeo"; "modelo pequeno em CPU"; "IA local barata".
---

# BitNet (bitnet.cpp)

> **Validada no benchmark.**

## Quando usar
Modelo pequeno em CPU barata para tarefas simples.

## Quando NÃO usar
Substituir o Qwen 27B.

## Passo a passo
Comandos e exemplos do README oficial:

```
# Run inference with the quantized model
python run_inference.py -m models/BitNet-b1.58-2B-4T/ggml-model-i2_s.gguf -p "You are a helpful assistant" -cnv
```

```
'clang' is not recognized as an internal or external command, operable program or batch file.
```

## O que o benchmark mediu
Rodou em sandbox de CPU: 81.2s, pico de memória 288 MB

## Requisitos
Compilar C++ com CMake e Clang; Linux/Windows; sem GPU. Sem GPU.

## Combina com
`llm-servir-modelo` (comparar).
