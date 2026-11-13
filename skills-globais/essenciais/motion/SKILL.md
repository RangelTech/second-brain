---
name: motion
description: |
  Edição e animação de vídeo sem custo (Motion), no computador do usuário: animação desenhada com React/HTML (motion graphics de verdade: tipografia cinética, números subindo, gráficos, partículas, chamadas para ação) renderizada em MP4 pela ferramenta motion_animar; reel ou vinheta com título; cortar, juntar, tirar silêncio, mudar para 9:16, pôr música ou logo, acelerar. Use quando a skill escolher-motion-ou-estudio indicar Motion ou o pedido for "faça uma animação", "motion", "vídeo com texto animado", "reel com texto", "vinheta", "legenda", "corta", "junta", "vertical".
---

# Motion (edição, sem custo)

Tudo roda com o FFmpeg que vem com o Segundo Cérebro. **Não instale nada** (nem Pillow, nem Node): use os comandos abaixo.

## 0. Animação desenhada (o jeito bonito, padrão para "faça uma animação")
Ferramentas do servidor `motion`: `motion_previa` (tira quadros PNG para você olhar) e `motion_animar` (gera o MP4). Rodam no computador do usuário com o navegador embutido do app: **nada para instalar, sem custo**.

Você escreve UMA página HTML do tamanho exato do vídeo. Já vêm carregados:
- **React + ReactDOM** e ``html`...` `` (JSX sem compilar, via htm), por exemplo: ``html`<div class="x" style=${{opacity: a}}>${texto}</div>` ``
- **SB** (ajudante): `SB.prog(t, inicio, duracao, 'out'|'inOut'|'outExpo'|'outBack')` dá 0 a 1 com easing; `SB.spring(t, inicio)` pula e assenta; `SB.stagger(i, inicio, passo)` cascata; `SB.mix(a, b, p)` números e cores; `SB.noise(x)` tremido suave; `SB.split(el)` letra a letra.
- O tempo é controlado: defina `window.sbFrame = (t) => {...}` (t em segundos) e desenhe o quadro daquele instante. Com React: ``const root = ReactDOM.createRoot(el); window.sbFrame = (t) => ReactDOM.flushSync(() => root.render(html`<${Cena} t=${t} />`)) ``. Animações CSS `@keyframes` e Web Animations também funcionam sozinhas.
- Imagens e vídeos usados na página: coloque na MESMA pasta do vídeo de saída (ou numa subpasta dela) e use caminho relativo, ex.: `url('foto.jpg')`. Não converta imagem para base64.
- Vídeo do usuário dentro da animação: `<video src="arquivo.mp4" data-inicio="1.5" data-corte="0">` (caminho relativo à pasta do vídeo de saída). Ele é posicionado quadro a quadro.

**Modelo pronto:** `modelos/reel-promo-react.html` (reel 9:16 de 6 s: selo, título palavra por palavra com mola, barra, número subindo, subtítulo, botão pulsando, fundo com luz e partículas). Copie, troque textos, cores e tempos. Não comece do zero.

**Roteiro (sempre):**
1. Combine em uma frase: formato (9:16 reel/story, 1:1, 16:9), duração, textos e cores (as da marca do usuário, se ele tiver).
2. Escreva o HTML a partir do modelo. Salve também o `.html` ao lado do vídeo (o usuário pode pedir ajuste depois).
3. `motion_previa` com 4 a 6 tempos (começo, cada entrada, final) e **olhe cada quadro** com `vision_analyze`. Corrija antes de renderizar.
4. `motion_animar` (duração e trilha, se houver: `audio`). **Acerte de primeira:** antes de renderizar, confira na prévia TODOS os itens do padrão de qualidade abaixo e corrija tudo de uma vez (uma correção por item, não uma por renderização). Depois de renderizar, olhe 3 quadros do MP4; se algo ainda não estiver perfeito, corrija e renderize de novo até ficar. Leva cerca de 6 s de trabalho por segundo de vídeo em 1080x1920.
5. Entregue o caminho do MP4 numa linha própria e ofereça: ajustar, versão 1:1, ou abrir no Editor para mexer junto.

**Padrão de qualidade (confira na prévia):**
- Área segura do reel: nada importante a menos de 160 px do topo nem 260 px de baixo (a interface do Instagram cobre). Margens laterais de 80 px.
- Tipografia grande e firme: título 110 a 150 px com peso 800, no máximo 3 linhas, sem palavra cortada. Corpo 44 a 56 px.
- Contraste alto (texto claro em fundo escuro ou o contrário). No máximo 2 cores de destaque.
- Movimento com intenção: cada elemento entra com easing (nunca linear), em cascata de 0,1 a 0,2 s; nada pisca; uma coisa de cada vez para o olho acompanhar. Segure o quadro final por 1 s antes de sair.
- Sempre algo vivo no fundo (luz que anda, grade que desliza, partículas lentas), sem roubar a atenção do texto.
- Nada sobreposto sem querer: confira título x barra x número na prévia.

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
Quando o usuário pede para editar um vídeo, ofereça as duas opções: "eu edito e te entrego" ou "abrimos o editor e editamos juntos" (`editor_abrir_janela`; ele também abre pelo botão **Editor** no topo do app). Para ajustes finos que o usuário quer ver (arrastar cortes, trocar ordem), o Editor é o melhor caminho.

## Regras
- Sem custo e sem orçamento: não chame `midia_orcar` para Motion.
- Não escreva um gerador de vídeo do zero: use `motion_animar` com o modelo, o script e as receitas. Se um pedido não couber, combine.
- Tudo aqui roda no computador do usuário, de graça. Se o pedido precisar de algo que não existe nos arquivos dele (pessoa, cena, voz nova), aí é o Estúdio, em créditos, com o preço antes.
- Entregue sempre o **caminho completo** do arquivo numa linha própria (ex.: `C:\Users\...\Videos\promo.mp4`; o app mostra o vídeo tocando no chat), a duração real e uma frase sobre o resultado. Não diga "IA", "FFmpeg" nem "script" ao usuário: diga "editei" e "criei".
