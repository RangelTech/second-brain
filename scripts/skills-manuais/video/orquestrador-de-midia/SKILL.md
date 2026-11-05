---
name: orquestrador-de-midia
description: |
  Encadear geração por IA (imagem e vídeo) com edição e motion: pegar o último vídeo ou imagem gerado e sobrepor texto, legenda, zoom ou animação, estender a duração (loop, câmera lenta, concatenar clipes), montar vários clipes, juntar áudio, e exportar em 9:16, 16:9 ou 1:1. Use quando o pedido citar "este vídeo", "esta imagem", "agora escreva", "transforme em vídeo", "anime", ou pedir um vídeo com texto e duração maior que 6 s.
---

# Orquestrador de mídia

## Mapa de roteamento
| Pedido | Caminho |
|---|---|
| "um vídeo de [coisa real]" | `midia_gerar_video` (direcao-de-midia) |
| "uma imagem / logo / foto de ..." | `midia_gerar_imagem` (direcao-de-midia) |
| título, legenda, gráfico, vinheta, reel só com texto | video-motion |
| "escreva X neste vídeo", "coloque legenda" | vídeo de IA -> video-motion (sobrepor) -> exportar |
| "transforme esta imagem em vídeo" | imagem existente -> video-motion (zoom/pan lento, Ken Burns) + texto; ou gerar clipe de IA descrevendo a mesma cena |
| "faça um logo e anime" | `midia_gerar_imagem` -> video-motion (logo entra, escala, brilho) |
| "pesquise N notícias e faça um vídeo de 15 s" | crawl4ai (raspar) -> resumir em frases curtas -> video-motion (um cartão por notícia) |
| voz / narração | openvoice (tom) ou texto na tela; whisper só para transcrever |

## "Este vídeo" / "esta imagem"
É o ÚLTIMO arquivo de mídia que você gerou ou recebeu na conversa: pegue o caminho no resultado da ferramenta (`caminho: ...`). Se houver dúvida entre dois, pergunte qual. Nunca gere de novo só para editar.

## Duração (sem enganar)
- Clipe de IA tem 2 a 6 s. Nunca diga que gerou 10 ou 20 s de uma vez.
- Para 10 s: esticar com loop suave (ida e volta), câmera lenta (`setpts=2.0*PTS`, 0,5x) e/ou concatenar 2 a 3 clipes gerados com seeds diferentes, e diga isso ao usuário em uma frase.
- Texto "aparecendo": defina os tempos (ex.: entra em 1 s, sai em 9 s) no video-motion (HyperFrames/Remotion) ou com ffmpeg `drawtext` e `enable='between(t,1,9)'`.

## Formatos de exportação
9:16 = 1080x1920 (story/reels), 16:9 = 1920x1080, 1:1 = 1080x1080. H.264, `-pix_fmt yuv420p`, `-movflags +faststart`. O clipe de IA (ex.: 768x512) é ESCALADO e recortado para o formato pedido (`scale` + `crop`); nunca esticar sem manter proporção.

## Onde salvar
Pasta Videos (e Imagens) da pasta de trabalho, nome com o assunto e o sufixo do passo (`balao-com-texto.mp4`). O arquivo final é o que vai no último "caminho:" da resposta, para a tela mostrar o cartão de resultado.

## Quando NÃO usar
Pedido de uma imagem ou vídeo só, sem edição: vá direto para direcao-de-midia. Combina com: direcao-de-midia, video-motion, hyperframes, crawl4ai, openvoice, diagram-design.
