---
name: kev
description: |
  Modelos pequenos de decisão em ONNX sobre bases Qwen (0,8B a 27B). Use quando o cliente disser: "modelo pequeno para decidir sim ou não"; "classificador leve em ONNX"; "decisão rápida com IA pequena".
---

# Kev (modelos de decisão)

> **Validada no benchmark (clone e inspeção).**

## Quando usar
Decisões simples e rápidas no pool leve.

## Quando NÃO usar
Tarefas longas de geração.

## Passo a passo
Comandos e exemplos do README oficial:

```
mkdir kev-onnx && cd kev-onnx
curl -fsSL https://raw.githubusercontent.com/aleskxyz/kev-onnx/main/docker-compose.yml -o docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/aleskxyz/kev-onnx/main/.env.example -o .env
# adjust KEV_MODEL_FILE etc. in .env if needed
docker compose pull
docker compose up -d
# Wait for the model to download and load (~30-60s on first run)
docker compose logs -f
```

```
curl http://localhost:8008/health
# {"status": "ok", "model": "loaded", "threads": 4}
```

## O que o benchmark mediu
Clonado e inspecionado em sandbox de CPU (não executado): 1.0s, pico de memória 28 MB

## Requisitos
ONNX Runtime; CPU ou GPU conforme o tamanho. Precisa de GPU: Opcional.

## Combina com
`llm-servir-modelo`.
