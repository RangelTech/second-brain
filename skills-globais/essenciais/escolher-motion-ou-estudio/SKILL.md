---
name: escolher-motion-ou-estudio
description: |
  Decide, antes de qualquer pedido de vídeo, áudio ou imagem, se é EDIÇÃO (Motion: cortar, legendar, juntar, título animado, animação de texto, sem custo) ou CRIAÇÃO com modelo de IA (Estúdio: pessoa nova no vídeo, trocar carro, roupa ou rosto, foto que fala, voz clonada, cena nova, com preço). Use sempre que o usuário pedir "faça um vídeo", "edite", "legenda", "me coloca", "troca", "dubla", "narração", "animação", "reel".
---

# Motion ou Estúdio?

Responda às 3 perguntas, nesta ordem:

1. **O resultado precisa de algo que NÃO existe nos arquivos do usuário?** (uma pessoa, um carro, uma roupa, um rosto, uma cena, uma voz que fala um texto novo) → **Estúdio**.
2. **É só mexer no que já existe?** (cortar, juntar, acelerar, legendar, pôr título, trilha, logo, texto animado, transição, formato 9:16, tirar silêncio) → **Motion**.
3. **Ficou em dúvida?** Pergunte com 2 opções curtas:
   - "Editar o que você já tem (sem custo)"
   - "Criar com o Estúdio (tem um preço, mostro antes)"

## Motion (edição, sem custo)
- Título, legenda palavra por palavra, vinheta, reel com texto: skill `video-motion` (caminho curto `titulo_animado.py`).
- Cortar, juntar, tirar silêncio, ajustar no tempo: abra o Editor (`editor_abrir_janela`, `cortar_silencio`).
- Entregue o arquivo e ofereça "Abrir no Editor" para ajustes.

## Estúdio (criação com IA, com preço)
- Sempre: `midia_orcar` → mostre o preço em reais → espere o SIM → crie (`midia_estudio`, `midia_gerar_video`, `midia_trocar_personagem`, `midia_clonar_voz`).
- Detalhes dos efeitos e do roteiro: skill `estudio`.
- Imagem comum (post, banner, ilustração): `midia_gerar_imagem`, incluída no plano, sem orçamento.

## Exemplos
| Pedido | Caminho |
|---|---|
| "faça um vídeo com meu nome aparecendo" | Motion (título animado) |
| "legenda esse vídeo" | Motion |
| "corta os silêncios e deixa em 9:16" | Motion (Editor) |
| "junta esses 3 vídeos com uma música" | Motion (Editor) |
| "um reel com as ofertas da semana em texto" | Motion |
| "uma vinheta com o logo da loja" | Motion |
| "acelera essa parte e põe uma seta apontando" | Motion |
| "transforma esse áudio em vídeo com a forma de onda" | Motion |
| "me coloca dançando nesse vídeo" | Estúdio: trocar-personagem |
| "troca esse gol velho por um Mustang" | Estúdio: editar-video |
| "coloca um terno chique em mim no vídeo" | Estúdio: editar-video (foto do terno como referência) |
| "troca a pessoa do vídeo por essa modelo" | Estúdio: trocar-personagem |
| "põe óculos escuros em mim" | Estúdio: editar-video |
| "quero essa foto falando esse texto" | Estúdio: avatar-foto |
| "faz a boca acompanhar esse áudio novo" | Estúdio: sincronia-labial |
| "narra esse texto com a minha voz" | Estúdio: voz (com amostra) |
| "um vídeo de um carro correndo na praia ao pôr do sol" | Estúdio: video-ponta |
| "um vídeo de cinema de um astronauta" | Estúdio: video-premium |
| "dubla em inglês" | Estúdio: voz no idioma + sincronia-labial (2 passos, orce os dois) |
| "uma imagem para o post de hoje" | `midia_gerar_imagem` (plano) |

Nunca diga "IA", "modelo", "GPU" ou nomes de fornecedor ao usuário. Diga "Estúdio" e "editar".
