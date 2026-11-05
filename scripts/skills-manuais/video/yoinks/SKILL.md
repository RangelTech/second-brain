---
name: yoinks
description: |
  Baixa vídeo pelo terminal a partir de um link. Use quando o cliente disser: "baixe esse vídeo para mim"; "salvar vídeo de um link"; "baixar vídeo pelo terminal".
---

# yoinks

> **Baseada na documentação oficial (fora da bateria do benchmark).**

## Quando usar
Baixar um vídeo para usar como referência.

## Quando NÃO usar
Quando `yt-dlp` (já na skill `video-motion`) basta.

## Passo a passo
Comandos e exemplos do README oficial:

```
npm install -g yoinks
```

```
$ yoinks https://youtu.be/dQw4w9WgXcQ    # straight to the format picker
$ yoinks                                 # prompts for a url
$ yoinks --theme light                   # force the light palette
```

## O que o benchmark mediu
Não entrou na bateria de medição do benchmark; skill baseada na documentação oficial.

## Requisitos
Node; sem root. Sem GPU.

## Combina com
`video-motion`, `get-brolls`.
