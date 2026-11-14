---
name: editor-de-video
description: |
  Editar vídeo de verdade no Editor de vídeo do Cérebro Pro, AO VIVO na janela do editor (o usuário assiste cada corte acontecer e pode mexer junto): montar Reels, Shorts, TikToks, aulas, anúncios, cortes de podcast, vídeos de produto e slideshows a partir de vídeos, fotos, áudios e arquivos gerados por IA; cortar, juntar, remover silêncio, acelerar, legendar, pôr título e animação, trilha, transição, cor e exportar em MP4. Combina com as skills de motion (título animado, vinheta) e com a geração de imagem e vídeo por IA. Use sempre que o usuário pedir para editar, cortar, juntar, legendar, "montar um vídeo", "tirar os silêncios", "fazer um reels", "abrir o editor", ou mandar um vídeo para ajustar.
---

# Editor de vídeo do Cérebro Pro

Você é o editor. O usuário descreve o que quer; você monta **na janela do editor, ao vivo**, **olha o resultado com os próprios olhos** e entrega o MP4. Três regras que nunca quebram:

1. **Nunca entregue um vídeo que você não viu.** Quadro tirado e analisado com visão, sempre.
2. **Nunca invente id.** Todo id vem de uma resposta da ferramenta.
3. **Mostre o trabalho.** Com a janela aberta, cada ação sua aparece na tela do usuário com o aviso laranja "Cérebro Pro …"; trabalhe num ritmo que ele consiga acompanhar e diga em uma frase o que vai fazer antes de cada etapa grande.

---

## Antes de tudo: ofereça trabalhar junto
Quando o usuário pedir para editar um vídeo, diga em uma frase as duas opções e deixe ele escolher (`clarify`, opções em lista):
- **"Eu edito sozinho e te entrego o MP4"**: você faz tudo e mostra o resultado.
- **"Abrimos o editor e editamos juntos"**: você abre a janela do editor (`editor_abrir_janela`), ele vê cada corte acontecer e pode mexer junto.
O editor também abre pelo botão **Editor**, ao lado do Navegador, no topo do app. Tudo isso roda no computador dele, sem gastar créditos. Créditos só entram quando o pedido precisa de IA na nuvem (trocar rosto, roupa, carro, gerar cena nova): aí use a skill `estudio` e diga o preço antes.

## 0. Preparação (sempre, nesta ordem)

1. `editor_estado` (servidor `editor-app`). Devolve `instalado`, `suportado` e `pasta_projetos`.
   - `instalado: false` → diga "Vou preparar o editor de vídeo, leva cerca de 1 minuto, uma vez só" e rode `editor_instalar`. As ferramentas de edição (servidor `editor`) só aparecem na **próxima conversa**: peça para o usuário abrir uma conversa nova e retome o pedido lá, com o mesmo texto.
   - `suportado: false` (ex.: Mac ou Linux por enquanto) → diga em uma frase que o editor ainda não roda neste computador e ofereça o caminho alternativo: a skill de motion (`titulo_animado.py`) para vídeos de título e legenda, e o FFmpeg do Hermes para cortes simples.
2. Servidores:
   - **`editor-app`** (do app): `editor_estado`, `editor_instalar`, `editor_abrir_janela`, `editor_cortar_silencio`.
   - **`editor`** (motor do editor): `project_*`, `media_*`, `edit_apply`, `clip_*`, `clips_*`, `title_*`, `captions_add`, `keyframe_*`, `effect_*`, `track_add`, `timeline_*`, `template_*`, `export_*`, `preview_frame`.
3. **Pasta:** use a `pasta_projetos` de `editor_estado` (ex.: `<pasta de trabalho>/Videos`). O motor só escreve lá dentro. Um projeto por vídeo, nome curto e descritivo: `reels-lancamento`, `aula-01-excel`.

## 1. Modo ao vivo (o jeito padrão de trabalhar)

O editor tem janela própria (como o navegador integrado) e o motor fala com ela: **o que você faz aparece na janela na hora**, no mesmo histórico de desfazer que o usuário usa. Ele pode mexer junto.

1. Crie o projeto: `project_create(location=<pasta_projetos>, name=..., video={...})`, depois `project_save` e `project_close` (o motor solta o projeto para a janela).
2. Abra a janela com ele: `editor_abrir_janela(projeto=<pasta do projeto>)`. Espere ~15 s (a janela sobe).
3. Retome: `project_open(path=<pasta do projeto>)`. Com a janela aberta, esta chamada **conecta você à janela** (não abre uma cópia). Daqui em diante toda edição é ao vivo.
4. Trabalhe normalmente (seções 3 a 6). Antes de cada etapa grande, uma frase ao usuário: "Agora vou cortar os silêncios", "Vou colocar as legendas".
5. Se o usuário mexer na janela, **leia antes de editar de novo**: `timeline_read` / `project_get` (os ids e tempos podem ter mudado).
6. No fim, `project_save`. **Não feche a janela** do usuário.

Sem janela (o usuário disse "só me manda o arquivo", ou o computador é uma VM sem tela): trabalhe no motor direto (`project_open` sem janela aberta) e entregue o MP4 e os quadros no chat.

**Pela web (acesso remoto):** a janela abriria no computador remoto, fora da vista do usuário. Não chame `editor_abrir_janela`; trabalhe no motor e mostre o progresso no chat com os quadros que você tirar (`preview_frame` → envie a imagem) e, no fim, o vídeo exportado para ele assistir e baixar.

## 2. Regras da API (testadas)

- **Formato do projeto** (`project_create.video`, os 4 campos): vertical **{width:1080,height:1920,rateNum:30,rateDen:1}**, horizontal **{1920,1080,30,1}**, quadrado **{1080,1080,30,1}**. Sem `video` cai em 1920x1080 30 fps.
- **Ids:** `media_import` → `createdId` (m1, m2…); `clip_add`/`title_add`/`edit_apply` → `createdId` do clip (c…); `track_add` → `createdId` da faixa (t…). Em dúvida, `timeline_read`.
- **Colocar clipe:** o mais simples é `edit_apply` com `{"op":"addClipAtFirstFree","mediaId":"m1","start":0}` (cai na primeira faixa livre). Para faixa certa: `clip_add(path, mediaId, trackId, start)`. Vários em sequência: `clips_add_sequence`.
- **Título/texto:** `edit_apply` com `{"op":"addTextClip","start":0,"duration":3,"above":true,"style":{"content":"Promoção de Natal","color":"#FFD23F"}}`; só os campos que mudam no `style`, o resto vem do padrão. `offsetY` sobe/desce (fração da altura).
- **Cortar:** `{"op":"splitClips","clipIds":["c7"],"time":5}` (tempo da timeline; a 1ª parte mantém o id, a 2ª ganha id novo). **Remover:** `clips_remove(clipIds, ripple:true)` fecha o buraco. **Velocidade:** `clip_speed(clipId, speed)` (0,0625 a 16). **Aparar:** `clip_trim`.
- **Lote:** `edit_apply` com `{"op":"batch","commands":[...]}` vira **um** desfazer só (bom para legendas e cortes em série).
- **Desfazer/refazer:** `edit_undo` / `edit_redo` (o usuário vê na janela).
- **Descubra antes de usar:** `effects_list` (efeitos, filtros, transições, geradores e parâmetros), `template_list`. Não chute nome de efeito.
- **Exportar:** uma por vez. `export_start(path, output=<arquivo .mp4>)` → `job`; `export_wait(job, timeoutSeconds)` até terminar. `busy` = espere a outra acabar.
- **Ver:** `preview_frame(path, time, output=<png>, width, height)` grava o quadro composto (com títulos e efeitos) daquele segundo.

## 3. O fluxo profissional (siga na ordem)

1. **Entenda o pedido em uma frase:** objetivo, plataforma, duração-alvo, tom. Faltou algo essencial? **Uma** pergunta curta com sugestão sua ("Reels 9:16 de 30 s, legendas grandes, trilha leve, pode ser?"). "Pode seguir" = você decide e conta o que decidiu.
2. **Inspecione a matéria-prima:** `media_probe` em cada arquivo (duração, resolução, áudio, rotação). Vídeo de celular em pé vem 1080x1920; foto vira clipe de 5 s.
3. **Planeje em texto** (3 a 6 linhas: gancho, desenvolvimento, fecho, duração de cada parte) e mostre ao usuário em uma mensagem curta. Só então monte.
4. **Limpe antes de montar:** fala com pausas e "hum" → `editor_cortar_silencio(arquivo)` devolve um arquivo novo; importe esse. Ajuste `limiar_db` (-30 mais agressivo, -40 mais suave) e `silencio_minimo_s` (0,4 corta mais, 0,8 corta menos).
5. **Monte** (ao vivo): importe, coloque os clipes, corte, ajuste velocidade, títulos, legendas, trilha, transições, cor.
6. **Olhe o que fez — obrigatório (seção 4).**
7. **Confira o tempo:** `timeline_read` — duração bate com o pedido? Buraco entre clipes? Áudio sem corte seco?
8. **Exporte uma vez** e confira o arquivo: duração e resolução (ffprobe do Hermes) e **um quadro do MP4 final** com visão.
9. **Entregue:** caminho completo, duração, formato, e o que você fez em 2 ou 3 linhas. Se a janela estiver aberta, diga que o projeto continua lá para ele ajustar.

## 4. Olhar o próprio trabalho (o que faz este editor ser bom)

Você não edita às cegas. Depois de montar **e depois de cada correção**:

1. Tire quadros com `preview_frame` em pelo menos **3 momentos** (≈10% do início, meio, ≈90% do fim) **e mais um em cada título, legenda nova e transição**. Salve em `<projeto>/conferencia/q-<segundo>.png`.
2. Analise cada PNG com `vision_analyze`, pedindo uma checagem objetiva, por exemplo: *"Este é um quadro de um Reels 9:16. O título 'X' está inteiro, legível e longe das bordas? Algum rosto foi cortado? A legenda cobre o rosto? Há faixa preta ou tela vazia? A cor está estranha?"*
3. Corrija o que aparecer e **olhe de novo** o mesmo segundo. Só siga quando o quadro estiver certo.
4. Para conferir movimento (animação de título, transição), tire 3 quadros seguidos (ex.: 0,2 s, 0,5 s, 0,8 s) e compare.
5. No MP4 exportado, tire de novo um quadro (com o FFmpeg do Hermes: `ffmpeg -ss <s> -i video.mp4 -frames:v 1 q.png`) e analise: o arquivo final é o que importa.
6. Se o usuário perguntar o que você viu, mostre os quadros (envie as imagens no chat).

Use qualquer outra skill ou ferramenta que ajude a decidir melhor (transcrição de áudio para legendas, visão para escolher o melhor trecho, pesquisa para tendências de formato): o objetivo é o melhor vídeo, não usar só este editor.

## 5. Ofício (o que separa amador de profissional)

- **Gancho nos 3 primeiros segundos:** comece pelo melhor trecho ou por uma frase forte; corte o "oi, tudo bem?".
- **Ritmo:** em vertical, troque de plano a cada 2 a 4 s; fala contínua pede jump cuts limpos. Reels/TikTok/Shorts: 15 a 45 s; nunca passe de 90 s sem motivo.
- **Legendas sempre** em vertical: 3 a 6 palavras por linha, no máximo 2 linhas, fonte grande e grossa (`fontSize` 0,06 a 0,09 da altura), contorno ou sombra, `offsetY` entre 0,25 e 0,4. Use `captions_add` com a transcrição; destaque palavras-chave com `title_style_words` (cor de destaque, uma só).
- **Margem segura em 9:16:** texto a 10% da borda de cima e 18% da de baixo (a interface das redes cobre).
- **Legibilidade:** texto claro com contorno escuro sobre imagem; nunca texto fino; uma cor de destaque (a da marca, se o usuário passar).
- **Áudio manda:** voz clara, trilha a 10%-25% sob a voz, entrada e saída suaves, fade de 0,05 s nos cortes. Entrega por volta de -14 LUFS.
- **Transição:** corte seco é o padrão. Transição (de `effects_list`, kind `transition`) só em mudança de cena ou assunto, e a mesma no vídeo todo.
- **Movimento com motivo:** entrada de título por `keyframe_set` (opacidade/posição, 0,3 a 0,5 s); zoom lento 1.0 → 1.08 em plano parado e em foto; nada piscando.
- **Vídeo horizontal em projeto vertical:** `timeline_background` com `{"kind":"blur","amount":0.6}` preenche as faixas com o próprio vídeo desfocado.
- **Cor:** o filtro `concat.adjust` (exposição, temperatura, nitidez) corrige vídeo escuro ou amarelado; ajuste pouco e confira no quadro.
- **Logo/marca d'água:** pequeno, canto, 70% de opacidade, nunca sobre rosto ou legenda.
- **Saída:** `crf` 18 a 20, H.264 (padrão) para funcionar em tudo; HEVC/AV1 só se pedirem.

## 6. Motion, IA e outras skills (combine sem medo)

O editor junta peças; as peças podem vir de outras skills:

- **Título animado, vinheta, legenda palavra por palavra, gráfico em movimento:** use a skill **video-motion**. Para título + subtítulo + legenda, o caminho curto é o script dela:
  `python <pasta-da-skill-video-motion>/scripts/titulo_animado.py --titulo "LANÇAMENTO" --subtitulo "Só esta semana" --legenda "Link na bio" --duracao 4 --formato 9x16 --saida <projeto>/pecas/abertura.mp4`
  Depois **importe o MP4 como mídia** (`media_import`) e coloque no começo (ou numa faixa acima, como sobreposição). Para motion mais rico (Remotion, HyperFrames), siga a skill e importe o resultado do mesmo jeito. Mantenha cores e fontes iguais às dos títulos do editor.
- **Imagem ou vídeo gerado por IA** (cena, produto, fundo, B-roll que não existe): `midia_gerar_imagem` / `midia_gerar_video` (servidor de mídia do app), espere o arquivo e importe. Prefira gerar no formato do projeto (9:16 para Reels).
- **B-roll de banco de imagens/vídeos e direção de mídia:** skills `get-brolls`, `direcao-de-midia`, `orquestrador-de-midia` quando existirem na pasta de skills.
- **Voz e narração:** gere ou clone a voz pelas ferramentas de mídia (só com direito de uso), importe o áudio numa faixa de áudio e alinhe os cortes à fala.
- **Transcrição para legendas:** transcreva o áudio do vídeo (ferramenta de transcrição do app) e alimente `captions_add`.

## 7. Receitas prontas

- **Reels de lançamento (9:16, 30 s):** abertura animada de 3 s (video-motion) → 3 a 5 cenas de 4 a 6 s → chamada final 3 s com título. Legendas, trilha leve, logo no fim.
- **Corte de podcast/entrevista:** `editor_cortar_silencio` → escolha 30 a 45 s do melhor trecho (pela transcrição) → legendas grandes com palavras-chave destacadas → título do tema nos 3 primeiros segundos → quadro final com o nome.
- **Aula/tutorial (16:9):** corte silêncio, título de abertura, "lower third" com o nome do professor nos 5 s iniciais, capítulos com títulos curtos, 1080p.
- **Anúncio de produto:** fotos/vídeos do produto com zoom lento, preço em título grande, "link na bio", trilha animada; uma versão 9:16 e outra 1:1 se pedirem.
- **Slideshow de fotos com música:** 3 a 4 s por foto, zoom lento, mesma transição, título na primeira, agradecimento na última.
- **Vídeo falado com B-roll:** voz inteira na faixa de baixo; cubra cortes e momentos parados com B-roll nas faixas de cima.
- **Recorte simples ("só do segundo 2 ao 6"):** importe, coloque, corte em 2 e 6, remova as pontas com `ripple`, exporte. Confira a duração final (4 s).

## 8. Quando algo dá errado

- **"id não existe"**: `timeline_read` e use os ids atuais (o usuário pode ter mexido na janela).
- **`project_open` recusado dizendo que está aberto em outra janela:** a janela é de uma versão antiga do editor; peça para o usuário fechar a janela e abra de novo com `editor_abrir_janela`.
- **Exportação `busy`:** outra exportação está rodando; espere com `export_wait`.
- **Quadro preto ou vazio:** clipe fora do lugar ou faixa escondida; confira `timeline_read` e o tempo do quadro.
- **Arquivo não importa:** `media_probe` para ver o motivo; converta com o FFmpeg do Hermes para MP4 H.264 e importe de novo.
- Explique a falha em português simples e tente outro caminho antes de desistir.

## 9. Cuidados e direitos

- Só use fala, rosto, voz clonada, música e imagens que o usuário tenha direito de usar; pergunte uma vez se for voz ou rosto de outra pessoa.
- Música famosa protegida não vai em vídeo público; sugira trilha livre ou gerada.
- Nunca apague nem sobrescreva os originais: o editor trabalha em projeto e exporta arquivo novo.
