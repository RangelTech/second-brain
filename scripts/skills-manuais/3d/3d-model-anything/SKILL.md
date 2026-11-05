---
name: 3d-model-anything
description: |
  Visualizador Three.js de salas 3D e skill 'scan-to-threejs' que guia o agente a reconstruir um ambiente a partir de captura de iPhone (LiDAR e fotos). Use para gêmeo digital simples de uma sala.
  Use quando o cliente disser: "quero fazer um desenho 3D de uma sala"; "gêmeo digital de um ambiente"; "montar sala 3D editável no navegador".
---

# 3D Model Anything

> **Validada na bancada (parcial):** viewer testado (build e arquivos); o app de iPhone e o fluxo de reconstrução com o agente não foram testados.

## Quando usar
Cliente quer ver ou montar uma sala 3D editável no navegador (gêmeo digital, showroom), a partir de captura do iPhone ou usando a sala de exemplo.

## Quando NÃO usar
Sem iPhone com LiDAR a captura não existe. Não serve para medir com precisão (a precisão do LiDAR não foi medida).

## Combina com
`site-na-maquina-virtual` (publicar o `dist`), `vision` (gêmeo digital do KI Vision).

## Receita validada na bancada (parcial)
```bash
git clone --depth 1 https://github.com/wesbos/3d-model-anything && cd 3d-model-anything
npm ci && npm run build      # 12 s no PC de teste; gera apps/room-viewer/dist (estático)
npm run dev                  # visualizador em http://localhost:5188 (sala de exemplo 'office-v4')
```
A skill do agente fica em `.agents/skills/scan-to-threejs` (copiar para as skills do agente). Exige Node 22.12+.

## Armadilhas
- Capturar a sala exige o app iOS do repositório e um iPhone com LiDAR; não testado.
- `npm run textures` chama `python3` (script de texturas).

## Tempo e recursos medidos
npm ci + build 12 s.
