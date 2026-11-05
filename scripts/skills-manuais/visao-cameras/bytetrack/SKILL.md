---
name: bytetrack
description: |
  Rastreamento de objetos entre quadros de vídeo (mantém o mesmo id para cada objeto). Use depois de um detector (YOLO) para contar pessoas/veículos e seguir trajetos.
  Use quando o cliente disser: "contar pessoas que passam na câmera"; "seguir veículos no vídeo"; "manter o mesmo número em cada objeto entre quadros".
---

# ByteTrack

> **Validada na bancada (parcial):** testado com o pacote `trackers` (reimplementação em Python limpo do ByteTrack) em caixas sintéticas; o repositório original (FoundationVision, exige YOLOX/PyTorch) não foi instalado.

## Quando usar
Contagem e seguimento de pessoas ou veículos em câmeras (KI Vision), depois de um detector devolver caixas por quadro.

## Quando NÃO usar
Sem detector (precisa de caixas por quadro). Não identifica quem é a pessoa, só segue o objeto entre quadros.

## Combina com
`ultralytics-yolo` (detector, GPU), `mediamtx`/`onvif-zeep` (entrada de vídeo), `vision`.

## Receita validada na bancada (parcial)
```bash
python -m venv v && v/bin/pip install supervision trackers      # 37 s no PC de teste, sem GPU
```
```python
import supervision as sv, trackers
tr = trackers.ByteTrackTracker()
saida = tr.update(sv.Detections(xyxy=caixas, confidence=conf, class_id=cls))   # saida.tracker_id
```
Teste: 3 objetos em 90 quadros (um some por 10 quadros e volta): ids estáveis [0, 1, 2] e cerca de 2.400 quadros/s só do rastreador, em CPU.

## Armadilhas
- O repositório original exige YOLOX; use `trackers` + detector Ultralytics.
- `supervision.ByteTrack` não existe mais nas versões novas (0.31); a classe é `trackers.ByteTrackTracker`.
- O teste foi com caixas sintéticas: o desempenho real depende do detector.

## Tempo e recursos medidos
instalar 37 s; rastreador 2.400 quadros/s em CPU (sintético).
