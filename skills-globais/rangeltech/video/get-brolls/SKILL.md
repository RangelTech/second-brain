---
name: get-brolls
description: |
Use quando o cliente pedir imagens de apoio para um vídeo.
---

# Get B-Rolls

> **Validada na bancada.**


## Quando usar

## Quando NÃO usar
Para gerar uma cena do zero (use a geração de vídeo por IA).

## Combina com
`video-motion` (legenda e título sobre o b-roll), geração de vídeo por IA para cenas que não existem, FFmpeg do Hermes.

## Receita validada na bancada (parcial)
Exige **Python 3.11+** (o Python 3.10 falha) e FFmpeg, ffprobe, Node 22+, curl, yt-dlp. O Hermes traz Python 3.14, Node e FFmpeg na pasta `tools`.
```bash
git clone --depth 1 https://github.com/engenheirodevideo/get-brolls
# rodar de uma pasta limpa (fora do código baixado):
PYTHONPATH=<clone>/scripts python <clone>/scripts/gb.py doctor        # lista o que falta
PYTHONPATH=<clone>/scripts python <clone>/scripts/gb.py search --project ./proj --provider youtube --query "ocean waves aerial" --limit 3 --dry-run
```
Resultado do teste: 3 candidatos em 3 s (título, canal, duração, link e miniatura em JSON). Etapas seguintes do fluxo: `preview` (GIF/contact sheet), `approve`, `permit`, `fetch`, `verify`.

## Armadilhas
- `python -I` não acha o pacote `getbrolls`; use `PYTHONPATH=<clone>/scripts`.
- `doctor` apontou `playwright-cli` ausente (só para Instagram). YouTube e fontes por API funcionam sem ele.
- Commons falhou no PC de teste com `CERTIFICATE_VERIFY_FAILED` (certificado do ambiente); tente na VM.
- Pexels e Pixabay pedem chave própria (opcional). YouTube não pede.
- Exige `drawtext` do FFmpeg (libfreetype) para o contact sheet numerado.
- Não testei `fetch`/corte (baixaria vídeo de terceiros sem aprovação humana).

## Tempo e recursos medidos
clone 4 MB, nada a instalar além das dependências; busca em 3 s.
