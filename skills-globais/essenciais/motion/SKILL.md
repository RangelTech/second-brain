---
name: motion
description: |
  Edição de vídeo sem custo (Motion), no computador do usuário: reel ou vinheta com título animado e legenda palavra por palavra, cortar, juntar, tirar silêncio, mudar para 9:16, pôr música ou logo, acelerar. Use quando a skill escolher-motion-ou-estudio indicar Motion ou o pedido for "faça um vídeo com o título...", "reel com texto", "legenda", "corta", "junta", "vertical".
---

# Motion (edição, sem custo)

Tudo roda com o FFmpeg que vem com o Segundo Cérebro. **Não instale nada** (nem Pillow, nem Node): use os comandos abaixo.

## Onde está o FFmpeg
- Windows: `%APPDATA%\SegundoCerebro\hermes\tools\ffmpeg-*\bin\ffmpeg.exe`
- Linux (VM): `~/.config/SegundoCerebro/hermes/tools/ffmpeg-*/bin/ffmpeg`
- O script abaixo já procura sozinho.

## 1. Reel, story ou vinheta com título (pronto em segundos)
Script desta skill: `scripts/titulo.py` (só Python padrão + FFmpeg).
```
python "<pasta desta skill>/scripts/titulo.py" --titulo "PROMO DE NATAL" --subtitulo "Só até sexta" \
  --legenda "Descontos de verdade em toda a loja" --duracao 6 --formato 9x16 \
  --cor1 "#6b0f17" --cor2 "#1a0406" --destaque "#ffd166" --saida "Videos/promo-natal.mp4"
```
- Formatos: `9x16` (reel/story), `16x9`, `1x1`, `4x5`. Duração 2 a 60 s.
- Opcionais: `--logo caminho.png`, `--musica caminho.mp3`, `--texto "#ffffff"`, `--fonte caminho.ttf`.
- Cores: escolha pelo pedido (Natal: vermelho escuro + dourado; Black Friday: preto + amarelo; loja do cliente: as cores da marca).
- Salve em `Videos/` da pasta de trabalho. O script imprime caminho, duração e tamanho: repita isso ao usuário.
- Confira 2 quadros antes de entregar: `ffmpeg -ss 1.5 -i video.mp4 -frames:v 1 q.png` e olhe a imagem.

## 2. Receitas rápidas (FFmpeg)
| Pedido | Comando |
|---|---|
| Cortar de 00:05 a 00:20 | `ffmpeg -ss 5 -to 20 -i in.mp4 -c copy corte.mp4` |
| Juntar vídeos | arquivo `lista.txt` com `file 'a.mp4'` por linha → `ffmpeg -f concat -safe 0 -i lista.txt -c copy junto.mp4` (se der erro, refaça com `-c:v libx264 -c:a aac`) |
| Vertical 9:16 sem cortar o rosto | `ffmpeg -i in.mp4 -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" -c:a copy vertical.mp4` |
| Vertical com fundo desfocado | `ffmpeg -i in.mp4 -filter_complex "[0]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20[f];[0]scale=1080:-2[v];[f][v]overlay=(W-w)/2:(H-h)/2" -c:a copy vertical.mp4` |
| Música de fundo baixa | `ffmpeg -i in.mp4 -i musica.mp3 -filter_complex "[1]volume=0.15[m];[0:a][m]amix=inputs=2:duration=first" -c:v copy final.mp4` |
| Acelerar 2x | `ffmpeg -i in.mp4 -filter_complex "[0:v]setpts=0.5*PTS[v];[0:a]atempo=2[a]" -map "[v]" -map "[a]" rapido.mp4` |
| Logo no canto | `ffmpeg -i in.mp4 -i logo.png -filter_complex "[1]scale=180:-1[l];[0][l]overlay=W-w-40:40" -c:a copy marca.mp4` |
| Tirar silêncio | ferramenta `cortar_silencio` do Editor (se disponível) ou `silenceremove` |
| Legenda da fala | transcreva com o ditado/Whisper, gere `.srt` e queime: `ffmpeg -i in.mp4 -vf subtitles=leg.srt final.mp4` |

## 3. Editor
Para ajustes finos que o usuário quer ver (arrastar cortes, trocar ordem), ofereça abrir no Editor (`editor_abrir_janela`), quando estiver ligado.

## Regras
- Sem custo e sem orçamento: não chame `midia_orcar` para Motion.
- Não escreva um gerador de vídeo do zero: use o script e as receitas. Se um pedido não couber, combine receitas.
- Entregue sempre o caminho do arquivo, a duração real e uma frase sobre o resultado. Não diga "IA", "FFmpeg" nem "script" ao usuário: diga "editei" e "criei".
