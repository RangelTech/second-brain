---
name: direcao-de-midia
description: |
  Dirigir pedidos de imagem e vídeo por IA antes de gerar: transformar o pedido curto do usuário em um briefing detalhado (sujeito, cena, movimento, câmera, luz, estilo, cores, proporção, duração, o que evitar) e preencher os parâmetros de midia_gerar_imagem e midia_gerar_video. Use SEMPRE antes de gerar imagem ou vídeo (logo, banner, foto de produto, retrato, paisagem, animação de objeto, cena em movimento).
---

# Direção de mídia

O modelo de imagem e de vídeo só devolve o que o prompt descreve. Pedido curto vira resultado genérico ("nada a ver"). Antes de chamar a ferramenta, monte o briefing em inglês e preencha os parâmetros.

## Briefing (sempre)
1. **Sujeito**: o que aparece, com número exato ("exactly one white sneaker").
2. **Cena e fundo**: onde está, o que tem em volta.
3. **Ação e movimento** (vídeo): o que se move e como; um só movimento principal.
4. **Enquadramento e câmera**: plano (close-up, médio, aberto), ângulo, movimento ("slow push-in", "static camera").
5. **Luz e cor**: tipo de luz, hora do dia, paleta.
6. **Estilo**: fotografia realista ou ilustração limpa (siga a preferência do usuário se houver).
7. **Evitar** (`negative_prompt`): "blurry, deformed, extra limbs, watermark, text, logo, low quality" (tire "text" se o usuário pediu texto).
8. **Texto na imagem**: só se pedido; no máximo 1 a 3 palavras em caixa alta, entre aspas. Frase longa ou acento: gere sem texto e aplique depois (video-motion ou editor).

## Parâmetros
- `formato`: quadrado (1:1), retrato, paisagem (16:9), story (9:16), banner. Vídeo: paisagem, retrato, quadrado.
- `segundos` (vídeo): 2 a 6; padrão 4. Clipe longo = vários clipes montados depois (veja orquestrador-de-midia).
- `qualidade`: rapida (padrão) ou alta quando o usuário pedir capricho.
- `seed`: guarde-a para repetir; para uma variação mude só a seed.
- Preferências do usuário (estilo, proporção, qualidade, negativos, duração) valem como padrão: não pergunte o que ele já configurou.

## Receitas por tipo
- **Foto de produto** ("foto de produto: tênis branco"): "product photography of exactly one white sneaker, centered, seamless light-gray studio background, soft diffused key light with gentle shadow, 3/4 front angle, sharp focus, high detail, e-commerce style". Negativo: "text, logo, hands, extra shoes, clutter, blurry". Formato quadrado.
- **Retrato**: "portrait of [quem], head and shoulders, natural window light, shallow depth of field, 85mm, neutral background". Formato retrato. Negativo: "deformed face, extra fingers".
- **Logo** ("logo para loja de carros"): "minimalist vector logo mark of a [símbolo], flat design, two colors on a white background, centered both horizontally and vertically with generous margins, bold simple shapes, no gradients". Sem texto no desenho (nome entra depois). Formato quadrado. Gere 2 opções com seeds diferentes se o usuário pedir opções.
- **Banner**: composição horizontal com área vazia para texto: "wide banner, [cena], large empty area on the left for text, soft gradient background". Formato banner.
- **Paisagem**: "wide landscape of [lugar], golden hour, layered depth, atmospheric haze". Formato paisagem.
- **Animação de objeto** (vídeo): objeto isolado, câmera parada ou push-in lento, fundo simples: "a single red balloon rising slowly into a clear blue sky, camera static, gentle drift, soft daylight".
- **Cena em movimento** (vídeo): um sujeito, uma ação, uma câmera: "a golden retriever running on a beach at sunset, tracking shot, low angle, warm light".
- **Realista vs ilustração**: realista = "photorealistic, natural lighting, high detail"; ilustração = "clean digital illustration, flat colors, soft shading".

## Perguntar ou gerar?
Gere direto quando der para inferir. Pergunte UMA coisa curta só se for essencial e ambíguo (ex.: "logo de qual nome?" quando o nome é parte do pedido).

## Depois de gerar
Olhe o resultado (imagem: vision_analyze; vídeo: um quadro do meio). Se estiver "nada a ver", ajuste o briefing e gere de novo UMA vez, mudando o que falhou. A tela mostra fila, percentual e resultado: responda em uma frase.

## Quando NÃO usar
Animação gráfica com texto, títulos, gráficos: video-motion. Desenho técnico, diagrama: diagram-design. Combina com: orquestrador-de-midia.
