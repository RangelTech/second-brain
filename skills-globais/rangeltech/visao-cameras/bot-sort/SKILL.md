---
name: bot-sort
description: |
  Rastreador de objetos entre quadros, com movimento de câmera e reidentificação opcional. Use depois de um detector, quando a câmera se mexe ou os objetos se cruzam.
  Use quando o cliente disser: "seguir pessoas com câmera em movimento"; "rastrear objetos que se cruzam"; "reidentificar a mesma pessoa entre quadros".
---

# BoT-SORT

> **Validada na bancada (parcial):** testado pelo pacote `trackers` (reimplementação de BoT-SORT) em caixas sintéticas; o repositório original (NirAharon) não foi instalado.

## Quando usar
Seguir pessoas ou veículos em vídeo de câmera móvel ou com oclusões (KI Vision), depois do detector devolver caixas.

## Quando NÃO usar
Sem detector. Não identifica quem é a pessoa.

## Combina com
`bytetrack` (mais simples), `ultralytics-yolo`, `vision`.

## Receita validada na bancada (parcial)
```bash
python -m venv v && v/bin/pip install supervision trackers
```
```python
import supervision as sv, trackers
tr = trackers.BoTSORTTracker()
saida = tr.update(sv.Detections(xyxy=caixas, confidence=conf, class_id=cls))   # saida.tracker_id
```
Teste sintético (3 objetos, 90 quadros, um some por 10 quadros): ids estáveis [0, 1, 2], cerca de 2.500 quadros/s do rastreador em CPU. O ganho do BoT-SORT sobre o ByteTrack aparece com movimento de câmera e reidentificação visual, que o teste sintético não mede.

## Armadilhas
- Original exige PyTorch/YOLOX; use `trackers` com detector Ultralytics.
- Reidentificação visual pede imagens dos quadros e pesa mais (GPU recomendada).
- Teste com caixas sintéticas: não prova desempenho real.

## Tempo e recursos medidos
rastreador 2.500 quadros/s em CPU (sintético).
