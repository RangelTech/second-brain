---
name: direcao-de-midia
description: |
  Dirigir pedidos de imagem e vídeo por IA antes de gerar: transformar o pedido curto do usuário em um briefing detalhado (sujeito, cena, movimento, câmera, luz, estilo, cores, proporção, duração, o que evitar) e preencher os parâmetros de midia_gerar_imagem e midia_gerar_video. Use SEMPRE antes de gerar imagem ou vídeo (logo, banner, foto de produto, retrato, paisagem, animação de objeto, cena em movimento).
---

# Direção de mídia

O modelo de imagem e de vídeo só devolve o que o prompt descreve. Pedido curto vira resultado genérico ("nada a ver"). Antes de chamar a ferramenta, monte o briefing em inglês e preencha os parâmetros.

## Ferramenta de detalhamento (sempre, antes de gerar)
Chame `midia_detalhar_prompt` ANTES de `midia_gerar_imagem` e `midia_gerar_video`: ela escreve o briefing profissional em inglês (60 a 150 palavras) com sujeito, ação, câmera, luz, cores, estilo, `negative_prompt`, formato e duração, e devolve também um resumo em português e avisos de risco. Passe `tipo`, o `pedido` com as palavras do usuário, as `respostas` dele às suas perguntas, `formato`/`segundos`/`estilo` se ele disse, e `tem_imagem_inicial: true` quando for animar uma imagem que você já gerou. Depois use EXATAMENTE o `prompt`, o `negative_prompt`, o `formato` e os `segundos` devolvidos (não encurte), mostre o resumo ao usuário em 1 ou 2 linhas e repasse os avisos que importarem. Se o pedido for vago, faça antes as até 5 perguntas abaixo e mande as respostas no campo `respostas`. Para troca de personagem use `midia_conferir_troca` (veja a seção própria).

## Briefing (o que a ferramenta monta; use como critério para conferir)
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
- `segundos` (vídeo): padrão 5. Cada clipe tem até 5 s; acima disso o servidor encadeia clipes e entrega UM MP4 (em 480p, para a entrega caber em ~20 min). Até 5 s sai em 720p.
- `qualidade`: vídeo = **alta (padrão)**: Wan 2.2 de 14 bilhões de parâmetros, 5 a 20 min por clipe de 5 s, o app avisa quando fica pronto; **rapida** só para testar uma ideia (~1 min, qualidade bem menor). Imagem: rapida (padrão) ou alta quando o usuário pedir capricho.
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

## Perguntar ou detalhar? (regra do Lucas: o máximo de detalhe possível)
O prompt que vai para a ferramenta tem que ser RICO. Imagem: 60 a 120 palavras em inglês. Vídeo: 80 a 150 palavras. A ferramenta recusa prompt curto demais.

1. **Pedido já detalhado** (o usuário deu sujeito + cenário + estilo/luz/câmera, ou mandou um briefing): não pergunte. Complete só o que faltar e gere.
2. **Pedido curto ou vago** (só o assunto: "um carro", "um vídeo de um balão", "um logo para minha loja"): faça UMA mensagem curta, em português, com até 5 perguntas numeradas, cada uma com uma sugestão sua entre parênteses, por exemplo:
   1) Estilo (realista, cinematográfico, ilustração?) 2) Cenário e hora do dia 3) Ação ou movimento (vídeo) 4) Cores e clima 5) Formato e, se for vídeo, duração.
   Diga que ele pode responder "pode seguir" e você decide tudo.
3. **Se ele responder "pode seguir", "tanto faz", ignorar as perguntas ou pedir pressa**: NÃO pergunte de novo. Invente você mesmo os detalhes que faltam, de forma coerente e caprichada, sem inventar texto, nomes de marca ou rostos de pessoas reais.
4. **Antes de chamar a ferramenta**, mostre em 1 ou 2 linhas, em português, o que vai gerar (cena, câmera, luz, estilo).
5. **Vídeo de qualidade**: gere antes a imagem (midia_gerar_imagem), CONFIRA (carro com 4 rodas, anatomia, rosto e mãos) e anime-a (`imagem`, qualidade alta). Mantém logo, rosto e detalhe. Um vídeo errado custa até 20 minutos do cliente: acerte o quadro de partida antes.

### O que um prompt rico tem (nesta ordem)
sujeito com número exato e aparência (cor, material, idade, roupa) → cenário e fundo → ação e movimento (vídeo: um movimento principal, ritmo) → enquadramento e lente (close, plano médio, 35mm, 85mm, ângulo baixo) → movimento de câmera (push-in lento, tracking, câmera estática) → iluminação (tipo, direção, hora, temperatura de cor) → paleta de cores → atmosfera e emoção → estilo e referência de linguagem (fotografia editorial, cinema anamórfico, ilustração digital) → qualidade ("ultra detailed, sharp focus, 8k, natural skin texture, high dynamic range") → e o `negative_prompt`.

Exemplo curto -> rico: "um carro correndo" vira "a matte-black sports coupe racing at high speed on a wet coastal highway at blue hour, low tracking shot from the front-left at 24mm, spray of water from the tires, headlights and neon reflections on the asphalt, teal and orange color grade, tense cinematic atmosphere, anamorphic lens flare, ultra detailed paint reflections, sharp focus, 8k". negative: "blurry, deformed, extra wheels, watermark, text, low quality".

## Prompt de vídeo (Wan 2.2)
- **Um sujeito, uma ação principal, uma câmera** por clipe de 5 s. Duas ações brigando viram movimento confuso.
- **Descreva o movimento com verbo e ritmo** ("walks steadily away from camera", "rotates slowly 90 degrees", "clouds drift left to right"), não só a pose.
- **Câmera nomeada uma vez** ("slow push-in", "tracking shot alongside", "static camera", "slow orbit"). Sem mistura de movimentos de câmera.
- **Números e partes exatos** ("a sedan with four wheels", "exactly one woman", "two hands holding the cup") evitam objeto sobrando.
- **Luz e atmosfera** concretas ("golden hour, low sun, long shadows", "soft studio light with gentle reflections").
- Produto: fundo simples, câmera lenta, reflexos suaves. Pessoa: de costas, de perfil ou plano médio mantém mais coerência que close agitado.
- O servidor já soma ao seu `negative_prompt` o negativo oficial do modelo (mãos, rosto, membros, "três pernas"); você só acrescenta o que é específico do pedido.
- Texto na tela e logos em movimento falham: aplique depois (video-motion).

## Troca de personagem (deepfake): confira antes, mande uma vez
`midia_trocar_personagem` troca a pessoa principal de um vídeo pela de uma foto e leva cerca de 9 minutos. Para acertar de primeira, chame antes `midia_conferir_troca` (formato, tamanho, duração, áudio, previsão) e depois:
1. **Olhe a foto** (vision_analyze): rosto de frente, nítido, bem iluminado, sem óculos escuros, mão, cabelo ou máscara cobrindo; uma só pessoa.
2. **Olhe um quadro do vídeo** (ffmpeg para uma pasta temporária): pessoa principal em primeiro plano, rosto grande no quadro, sem espelho ou reflexo (falham), sem muitas pessoas disputando o centro.
3. Se algo estiver ruim, diga ao usuário o que trocar (foto mais nítida, trecho com o rosto maior) antes de gastar a geração.
4. Se faltar decisão, UMA mensagem curta com até 3 perguntas, cada uma com sugestão sua: resolução (480p rápido, 736p mais nítido), se as pessoas cantam ou falam junto com o áudio (liga a sincronia labial), nome do arquivo. Aceite "pode seguir".
5. Mostre em 1 ou 2 linhas o que vai fazer e chame a ferramenta UMA vez. Depois, uma frase com a previsão devolvida.

## Depois de gerar
Olhe o resultado (imagem: vision_analyze; vídeo: um quadro do meio). Se estiver "nada a ver", ajuste o briefing e gere de novo UMA vez, mudando o que falhou. A tela mostra fila, percentual e resultado: responda em uma frase.

## Quando NÃO usar
Animação gráfica com texto, títulos, gráficos: video-motion. Desenho técnico, diagrama: diagram-design. Combina com: orquestrador-de-midia.
