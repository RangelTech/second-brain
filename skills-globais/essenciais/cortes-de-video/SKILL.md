---
name: cortes-de-video
description: |
  Workflow AUTOMÁTICO de cortes (mecânica do Viralizaí no computador do usuário: link do YouTube OU arquivo de vídeo → cortes prontos em poucos minutos, juiz por IA, rosto seguido, legenda karaokê em português, gancho, barra, @). Fazer CORTES de vídeo longo (live, podcast, gameplay, entrevista, aula) para TikTok, Reels e Shorts: achar os melhores momentos (chat da live, mapa de "mais assistidos" do YouTube, transcrição), ler o contexto e cortar a HISTÓRIA COMPLETA (começo, clímax e reação, sem cortar frase no meio), enquadrar o rosto/câmera, legenda palavra por palavra, título-gancho e moldura com o Motion, e entregar o MP4 vertical pronto para postar. Inclui as regras para monetizar no TikTok (vídeo com mais de 1 minuto, conteúdo transformado, autorização do criador). Use quando pedirem "faz cortes", "pega os melhores momentos da live", "clipes para TikTok", "cortes do podcast", "transforma esse vídeo em vários shorts".
---

# Cortes de vídeo (lives, podcasts, gameplay)

## MODO AUTOMÁTICO (padrão para qualquer pedido de cortes: link OU arquivo do usuário)
A mecânica inteira do Viralizaí rodando no computador do usuário, num comando só: sinais (legenda, chat, "mais vistos",
comentários com tempo, volume e sons como risada/grito/tiro via YAMNet), candidatos com a história inteira, juiz pela
MESMA IA do app (nota, porquê, gancho, legenda do post, hashtags), tradução para português se a fala for de outra língua,
Whisper no processador quando não há legenda (arquivo do usuário, vídeo sem legenda), enquadramento seguindo o ROSTO cena a
cena e render num passe de FFmpeg (legenda karaokê, gancho em caixa, barra de progresso, @). Sem créditos, sem Motion.
Medido em 22/11/2026: link de podcast de 2h40 → 3 cortes prontos em 4 min; arquivo local de 12 min → 2 cortes em 6 min.
Na 1ª vez no computador ele monta o motor sozinho (~2 min + 450 MB do modelo de transcrição); avise que a 1ª demora mais.

1. **Rodar** (1 chamada; não pergunte nada antes, link/arquivo + "faz cortes" já basta):
   `python "<skill>/scripts/auto.py" auto --url "<link>" --pasta "Videos/cortes-<nome>" --quantos 3 [--arroba "@canal-do-usuario"]`
   Arquivo do usuário: `--arquivo "<caminho do vídeo>"` no lugar de `--url`.
   `--objetivo`: `viral` (20-40 s, alcance, PADRÃO), `reels` (30-60 s, se ele pedir reels/shorts), `tiktok` (61-90 s, só se falar
   em monetizar). `--layout auto` (padrão: conversa = segue o rosto; jogo = centro ampliado); `inteiro` (quadro todo com
   fundo desfocado), `cheio`, `centro`. `--rede` tiktok/instagram/youtube (margens seguras), `--cor "#rrggbb"` (cor do gancho).
2. **Conferir**: olhe as capas (`capa` de cada corte) com `vision_analyze` numa chamada só. Rosto cortado ou gente fora do
   quadro → `auto.py render --pasta P --escolhas P/escolhas.json --layout inteiro` (refaz só a montagem). Se `ok` for false,
   leia `problemas`/`erro`.
3. **Entregar**: caminho de cada MP4 numa linha, duração, gancho, o porquê e a legenda do post (já vem pronta). Uma linha sobre
   direitos (crédito ao canal original, ideal ter autorização). Ofereça a versão de mais de 1 min se ele quiser monetizar.

Quer escolher à mão? `auto.py candidatos ...` (lista com sinais e fala) → escreva `escolhas.json`
(`[{"id": 2, "gancho": "...", "legenda_post": "...", "ajuste_inicio": 0, "ajuste_fim": 0}]`) ou `auto.py julgar --pasta P` →
`auto.py render --pasta P --escolhas P/escolhas.json`.
Vídeo sem fala (trailer, clipe): o motor usa o mapa de "mais vistos", o volume e os sons; confira o gancho olhando a capa.

## Modo manual (layout especial)
Tudo no computador do usuário e sem créditos. Ferramentas:
- `scripts/cortes.py` desta skill (`analisar`, `ler`, `cortar`, `montar`). O yt-dlp ele baixa sozinho (oficial, atualizado a cada 3 dias; snapshot nosso de reserva). Não instale nada.
- Motion: `motion_previa` e `motion_animar` (renderiza o HTML de cada corte em MP4).
- Modelo: `modelos/corte-tiktok.html` (vídeo no meio com fundo desfocado, moldura com cantos, título-gancho em caixa branca, legenda de 3 palavras com a palavra falada destacada, barra de progresso, @ do canal).

## Regra de ouro: corte é HISTÓRIA, não um pedaço de 20 segundos
O pico (chat explodiu, risada) é só onde a história **termina**. O corte bom:
1. **Começa no início do assunto**: a pergunta do chat, a provocação, a situação ("O cara mandou: você não fala da notícia porque a Sony te paga?").
2. **Passa pelo desenvolvimento** (o porquê, a explicação, a treta).
3. **Termina logo depois do clímax + a reação** (a frase de efeito, a risada, o "fala como você quiser"). Corte na fala seguinte que muda de assunto, não antes.
4. **Nunca começa nem termina no meio de uma frase.** O `cortar` já encaixa nas bordas das frases; mesmo assim escolha início e fim LENDO as frases com `ler`.
5. Se o assunto começa muito antes do pico, prefira o corte mais longo e completo a um curto que não se entende sozinho. Quem não viu a live tem que entender sem contexto.

## Duração (depende do objetivo; pergunte uma vez se não estiver claro)
| Objetivo | Duração | Por quê |
|---|---|---|
| **Monetizar no TikTok** (Programa de Recompensas para Criadores) | **61 a 90 s** | só vídeos com MAIS de 1 minuto entram no programa |
| Alcance / seguidores (TikTok, Reels, Shorts) | 20 a 45 s | taxa de conclusão alta = mais distribuição |
| YouTube Shorts | até 60 s (até 3 min é aceito, mas 60 s rende mais) | |
Para monetizar, junte a história inteira (setup + desenvolvimento + clímax); se o momento é curto, escolha outro momento que tenha história de 1 minuto, em vez de esticar com enrolação.

**Pedido simples ("um corte disso", "o melhor momento pra reels/shorts/tiktok") sem falar em monetizar: NÃO pergunte e NÃO faça
a versão de 1 minuto.** Faça UM corte de alcance (20 a 45 s) e ofereça a versão de monetização no fim, em uma linha. Meta de tempo:
o corte pronto em 5 a 8 minutos. (22/11/2026: um "corte pra reels" de um trailer virou versão de 65 s e levou mais de 25 min.)

**Vídeo sem fala** (trailer, clipe musical, gameplay sem narração): pule transcrição e legenda; escolha o momento pelo mapa de
"mais assistidos" + olhando 4 a 6 quadros do trecho; corte de 15 a 30 s no ritmo das cenas; título-gancho curto. Música/clipe:
corte no começo de um compasso e termine no fim da frase musical.

## Monetização: diga ao usuário com honestidade (em 2 ou 3 linhas, uma vez)
- O TikTok paga por vídeo **original**. Repostar trecho de outra pessoa sem transformação é "conteúdo não original": não monetiza e pode derrubar o alcance da conta. O que conta como transformação: edição de verdade (enquadramento, legenda, título-gancho, cortes de ritmo), e o ideal é ter comentário/narração própria ou ser corte de canal **autorizado**.
- **Autorização do criador:** muitos streamers liberam canais de cortes (às vezes com regras: marcar o canal, dividir receita). Sem autorização, há risco de remoção por direitos autorais. Sugira ao usuário pedir/conferir a autorização do dono da live; para o próprio conteúdo dele, não há problema.
- Requisitos do programa mudam (idade, número mínimo de seguidores e de visualizações): diga para ele conferir as regras atuais no app do TikTok antes de contar com a receita.
- Coloque sempre o crédito: "@ do criador" na legenda do post (e o `--arroba` do canal de cortes no vídeo).

## Passo a passo
### 1. Analisar (sem baixar o vídeo)
`python "<skill>/scripts/cortes.py" analisar --url "<link>" --pasta "Videos/cortes-<nome>" --quantos 8`
Lê informações, transcrição automática (português ou inglês) e, se for live, o **chat inteiro** (live de 2 h ≈ 1 min). Dá nota a cada trecho: volume e empolgação do chat (kkkk, !!!, 😂🔥, "que isso"), mapa de "mais assistidos" do YouTube quando existe, fala empolgada. Grava `momentos.json` com os candidatos (início, nota, fala do trecho, mensagens do chat).
- Vídeo sem chat e sem mapa (podcast, vídeo comum): a nota vem da fala; aí leia mais candidatos.
- Sem transcrição automática (raro): baixe só o áudio (`yt-dlp -x`) e transcreva com a ferramenta de transcrição do app.

### 2. Ler o contexto de cada candidato e decidir a história
Para cada candidato bom: `python cortes.py ler --pasta P --inicio <cand-90> --fim <cand+40>`. Mostra frase por frase com o tempo. Encontre onde o assunto **começa** e onde a reação **termina**. Descarte candidatos que são só leitura de doação, "salve fulano", silêncio, ou que precisam de contexto que não está no trecho.
Escolha os 3 a 6 melhores; para cada um defina: início, fim, título-gancho, e se é versão alcance ou monetização.

### 2b. VER o vídeo antes de escolher (obrigatório em jogo, filme, anime)
`python cortes.py mapa --pasta P` → folhas de miniaturas da live/vídeo INTEIRO (uma a cada ~30 s, com o horário escrito em amarelo), sem baixar o vídeo (usa as miniaturas do YouTube). Olhe com visão e anote onde aparece o que interessa: jogo/cutscene em tela cheia, câmera do streamer, cena do filme.
Detalhe de um trecho: `python cortes.py mapa --pasta P --inicio 4300 --fim 4500` (miniaturas maiores a cada ~10 s): mostra os CORTES DE CENA (onde a cena começa e termina).
Live de "conversa" sem jogo na tela NÃO serve para corte de jogo: procure outra (reação a trailer, gameplay).

### 3. Olhar o quadro e enquadrar
**Medir com precisão:** depois de cortar uma vez, `python cortes.py quadro --pasta P --nome corte-01 --t 10` gera o quadro em alta com uma GRADE de 5 em 5 % (amarelo = x, azul = y): leia as frações direto na imagem.
Tire um quadro do momento para ver o layout: `cortar` uma vez sem `--recorte`, e olhe com `vision_analyze` um quadro de `<nome>-base.mp4` (`ffmpeg -ss 5 -i base.mp4 -frames:v 1 q.png`). Live com câmera pequena num canto e chat na tela: corte SÓ a câmera para o rosto ficar grande, com `--recorte x:y:largura:altura` em frações do quadro original (ex.: câmera à direita em cima `0.46:0.03:0.43:0.63`). Gameplay/cutscene em tela cheia: sem recorte (o jogo inteiro no meio) ou recorte central `0.2:0:0.6:1` se a ação está no centro.

**Layouts:**
| Conteúdo | Layout | Como |
|---|---|---|
| Live só de conversa | rosto grande | `--recorte` só na câmera |
| **Jogo/cutscene com câmera do streamer** | **jogo em cima, câmera embaixo** (o foco é o JOGO) | `--recorte` = área do jogo SEM a câmera (ex.: `0:0:0.83:1` se a câmera fica na direita) + `--recorte-camera` = a câmera (ex.: `0.842:0.188:0.142:0.285`) |
| Jogo sem câmera, filme, anime, série | tela única | sem recorte (16:9 inteiro) ou `0.12:0:0.76:1` para aproximar se a ação é no centro (confira que ninguém fica cortado) |
Cutscene ou filme que JÁ tem legenda na imagem: use `--sem-legenda` no `cortar` e no `montar` (não duplica; a câmera sobe para perto do jogo).

### 4. Cortar
`python cortes.py cortar --url "<link>" --pasta P --inicio <s> --fim <s> --nome corte-01 [--recorte x:y:l:a]`
Baixa SÓ aquele trecho (até 1080p), encaixa início e fim nas frases, monta a base vertical 1080x1920 (vídeo no meio, fundo desfocado do próprio vídeo) e a legenda com tempo por palavra (sem "[ __ ]" e anotações). Imprime início/fim/duração reais.

### 5. Título-gancho e montagem
Título: 4 a 8 palavras, MAIÚSCULAS, curiosidade ou conflito ("JASON OU *JAZON?* A TRETA DO GTA 6", "\"A SONY TE PAGA?\" *ELE RESPONDEU*"); `*palavra*` sai na cor de destaque. Não minta no título (clickbait que não se cumpre derruba a retenção).
`python cortes.py montar --pasta P --nome corte-01 --titulo "..." --arroba "@canal" [--cor "#ff2d55"]`
Vídeo em outro idioma para público brasileiro: traduza as falas para um JSON `[{"t": 0.0, "texto": "frase traduzida"}, ...]` (tempos de `ler`, relativos ao início do corte) e passe `--legenda-traduzida trad.json`.

### 6. Prévia, render e conferência
`motion_previa` com o `html`, a `duracao` e os tempos de `previa_sugerida`; olhe cada quadro: título inteiro, moldura sem encostar no título, rosto inteiro e grande, legenda legível e com espaços, nada nos 260 px de baixo além do @. Corrija e monte de novo.
`motion_animar` com `arquivo`=html, `audio`=o `-audio.wav`, `duracao`, `saida`=`saida_sugerida`. ~6 s de trabalho por segundo de vídeo (1 min ≈ 6 min). Depois olhe 2 quadros do MP4 e confira com `ffprobe` que tem áudio.

### 7. Entregar
Para cada corte: caminho do MP4 numa linha própria, duração, e uma sugestão de legenda do post (1 linha + 3 a 5 hashtags do nicho + crédito "@criador"). Diga qual é para monetizar (mais de 1 min) e qual é para alcance.

## Vídeo longo de melhores momentos (YouTube, onde mais paga)
Depois dos cortes, ofereça juntar os melhores (5 a 15 cortes, na ordem da live) num vídeo 16:9 de 8 a 20 min para o YouTube: cada corte com uma vinheta de 1 s de título (Motion) e transição curta. Monetização do YouTube paga por visualização em vídeo longo (vídeo acima de 8 min permite anúncios no meio). Use `editar.py` (skill edicao-profissional) com formato 16x9 ou junte com FFmpeg concat.

## Filmes, animes e séries ("melhores momentos")
- Fonte: vídeos de "melhores momentos/cenas engraçadas" no YouTube (têm mapa de "mais assistidos" e transcrição). Não há chat: a nota vem do mapa + fala.
- O corte é a CENA inteira: comece no corte de câmera em que a cena começa (veja no `mapa` detalhe) e termine na piada + reação, antes do corte para a próxima cena. Anime: a transcrição automática vem sem pontuação; decida pelas imagens.
- Embaixo vai o NOME DA OBRA (`--arroba "Corra que a Polícia Vem Aí! (1988)"`); título em cima é o gancho da cena.
- Direitos: trechos de filme/anime/série têm dono. Para monetizar, transforme (narração/comentário próprio, edição) e saiba que pode haver reivindicação de direitos; diga isso ao usuário uma vez.

## Narrador, sons e acabamento
- Narrador estilo série de comédia ("esse foi o dia em que..."): escreva 2 ou 3 falas curtas e engraçadas, gere com `voz-local` (voz do usuário ou padrão; nunca clone a voz de dublador/ator famoso) e mixe nas pausas com `motion/scripts/sons.py mixar`.
- Efeitos: `motion/scripts/sons.py` (boing, buzina, tchan, erro para zoeira; woosh/pop para destaque). Passe a lista em `sons.json` e misture no áudio do corte antes do `motion_animar`.

## Erros conhecidos (já resolvidos; não contorne de outro jeito)
- Vídeo preto no Motion: era a captura invisível que não fotografa `<video>`; o app copia o quadro para um canvas. Se aparecer preto, o arquivo base não existe ou o nome está errado.
- Transcrição do YouTube traz "[ __ ]" (palavrão censurado) e "[música]": o script tira.
- Live muito recente pode não ter chat gravado nem mapa de "mais assistidos"; use a fala.
- O yt-dlp para de funcionar quando o YouTube muda: o script atualiza sozinho a cada 3 dias. Erro de "Sign in to confirm" = o YouTube pediu login para aquele IP; tente de novo mais tarde ou use outro vídeo.

## Do acervo Salvar
- **Copiar a estrutura de um vídeo que viralizou**: quebre o vídeo plano a plano (como o rea-video faz): duração de cada plano, se foi
  filmado/gerado/código, como é a legenda, onde estão os cortes e o áudio; depois refaça a mesma estrutura com o conteúdo do cliente.
- **Trend-jacking**: lançamentos culturais (ex.: um jogo muito esperado) rendem cortes "onde você estava em 2013 x hoje"; a janela é de dias.
- Fontes: skill `acervo-salvar`.

## Pós-produção padrão (o que o Viralizaí faz em todo corte, 19/11/2026)
- **Legenda sempre em português**, palavra por palavra (karaokê: 2-3 palavras por vez, a palavra falada em amarelo e 12% maior).
  Corte de vídeo gringo é bem-vindo: traduza **frase a frase** (pausa > 0,6 s ou pontuação quebra a frase), lotes de até 15 frases,
  e distribua as palavras traduzidas no tempo da frase original, proporcional ao tamanho de cada palavra. Se a IA devolver número
  errado de frases, traduza frase a frase. (Viralizaí: `app/motor/traduz.py`.)
- **Título-gancho grande em caixa** (cor de destaque, fonte grossa, maiúsculas) **o vídeo todo**, no topo, com entrada em "pulo"
  (escala 72% → 107% → 100% em 0,3 s).
- **Barra de progresso** fina no topo, na cor de destaque, enchendo até o fim (segura a pessoa até o final).
- **@ do canal**: só na versão de quem vai postar. Corte que será reaproveitado por várias pessoas (vitrine, banco de cortes) sai SEM @.
- Margens seguras por rede: TikTok cobre mais embaixo e à direita (legenda a ~430 px do fundo em 1280 de altura; título a ~175 px do topo).
- Tudo num passe só de ffmpeg com legenda ASS (`subtitles=...:fontsdir=...`), Montserrat ExtraBold.
