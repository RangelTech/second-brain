---
name: edicao-profissional
description: |
  Editar como profissional um vídeo GRAVADO (pessoa falando para a câmera, aula, depoimento, podcast) para Reels, TikTok (inclusive monetizável, mais de 1 min), Shorts e VSL de 3 a 15 min, SEM IA de vídeo: tira silêncios e respiros (jump cut), zoom alternado no rosto, legenda palavra por palavra no rodapé, título-gancho em cima, palavras que saltam, listas, números, imagens (geradas de graça), chamada final, efeitos sonoros e trilha que abaixa na fala; tudo desenhado com React no Motion. Também faz o ACABAMENTO leve de um vídeo pronto (moldura fina, @ do perfil, "digita IA nos comentários"). Use quando pedirem "edita meu vídeo", "deixa profissional", "faz uma VSL", "tira os silêncios", "legenda meu vídeo", "transforma em reels/tiktok", "coloca animação no meu vídeo".
---

# Edição profissional (gravação → Reels, TikTok, VSL)

Tudo no computador do usuário, de graça. Ferramentas:
- `scripts/editar.py` (`preparar`, `cortes`, `montar`, `acabamento`) desta skill.
- Transcrição com tempo por palavra: `voz-local/scripts/voz_local.py transcrever` (faster-whisper local; o `preparar` chama sozinho).
- Sons: `motion/scripts/sons.py` (efeitos e trilha GERADOS no computador, sem direito autoral; o `montar` já mistura).
- Motion: `motion_previa` e `motion_animar` renderizam a página por cima do vídeo.
- Imagens de apoio: gere com a ferramenta de imagem padrão (de graça). Nada de IA de vídeo paga.

## Fluxo
1. **Combine em UMA mensagem** (com sugestões, aceite "pode seguir"): formato (Reels/TikTok 9:16, VSL 16:9, quadrado), duração alvo, público e objetivo, cores da marca, @ e nome para a tela, chamada final, se quer trilha e efeitos (sério: discretos; zoeira: boing/buzina).
2. **Preparar:** `python editar.py preparar --video "<gravação>" --pasta "Videos/edicao-<nome>"`. Transcreve com tempo por palavra (40 s de fala ≈ 20 s; 1ª vez baixa o modelo, uns minutos).
3. **Cortes:** `python editar.py cortes --pasta P [--silencio 0.45] [--inicio s --fim s]`. Tira silêncios e respiros longos e imprime a FALA FINAL frase por frase com o tempo NOVO. Para um Reels/TikTok de um vídeo longo, use `--inicio/--fim` (tempo ORIGINAL) no trecho que é uma história completa (ver skill cortes-de-video: começo do assunto até o fecho; monetizar no TikTok = mais de 61 s).
   - Silêncio: 0,45 s é natural. 0,3 s = ritmo de TikTok (mais agressivo). Nunca abaixo de 0,25 s (come sílabas).
4. **Plano (`plano.json`)**, escrito LENDO a fala final (formato completo no topo de `editar.py`):
   - `titulo` (gancho nos 3 primeiros segundos, 4 a 7 palavras, `*palavra*` em destaque);
   - `nome` (nome e cargo, 1 a 5 s; não use se o vídeo já mostra o nome);
   - `destaques` (2 a 5 palavras-chave que SALTAM no momento exato em que são ditas; com `som`);
   - `listas` (quando a pessoa enumera), `numeros` (só números que a pessoa DISSE; nunca invente), `imagens` (apoio visual do que está sendo dito);
   - `cta` (chamada final), `cores`, `rosto` (onde está o rosto: esquerda/centro/direita), `musica`, `sons`, `trocas` (correções da legenda: nomes, termos técnicos, palavras erradas da transcrição. Releia a fala e corrija SEMPRE os nomes próprios).
5. **Montar:** `python editar.py montar --pasta P --plano plano.json --formato 9x16|16x9|1x1 [--recorte x:y:l:a]`. Corta, alterna zoom a cada corte (esconde o pulo), normaliza o volume, mistura efeitos e trilha e escreve a página. Imprime `html`, `audio`, `duracao`, `previa_sugerida`.
6. **Prévia e correção** (obrigatório): `motion_previa` (com `largura`/`altura` do formato) nos tempos sugeridos + um quadro por destaque/lista; olhe cada um.
7. **Render:** `motion_animar` com `arquivo`, `audio` (o impresso), `duracao`, `largura`, `altura`, `saida`. ~6 s de trabalho por segundo em 1080p (VSL de 5 min ≈ 30 min: avise e acompanhe até o fim, não encerre esperando aviso).
8. **Validar** (sempre, antes de entregar): `ffprobe` (tem vídeo e áudio, duração certa), volume (`ffmpeg -i v.mp4 -af volumedetect -f null -`: média entre -20 e -14 dB), 3 a 5 quadros do MP4 final olhados com visão (legenda certa e legível, nada cobrindo o rosto, título inteiro, chamada no fim). Só então entregue o caminho.

## Regras de layout (o que separa amador de profissional)
- **Legenda no rodapé** (terço de baixo), 2 a 3 palavras por vez, MAIÚSCULA, contorno preto, a palavra falada na cor de destaque. Nunca no meio do rosto.
- **Títulos grandes EM CIMA**, no começo (gancho) e em troca de assunto.
- **Nunca tampar o rosto.** Quadros (lista, imagem, número): no vertical vão na metade de baixo e a legenda some enquanto o quadro está na tela; no horizontal vão do lado oposto ao rosto (`rosto`). Confira na prévia.
- Área segura do Reels/TikTok: nada importante nos 160 px de cima nem nos 300 px de baixo (botões do app).
- **Desenho no fundo dos quadros** (brilho, gradiente, formas suaves): o modelo já faz; não deixe caixa chapada.
- Movimento com intenção: tudo entra com mola/easing, uma coisa por vez, e sai antes da próxima. No máximo 1 elemento grande na tela.
- Destaques: 2 a 5 por minuto. Mais que isso cansa.

## Paleta de cor (escolha uma e mantenha o vídeo inteiro)
| Clima | Fundo | Destaque | Uso |
|---|---|---|---|
| Profissional/negócios | #0b0d14 | #ffcc00 (amarelo) | dicas, VSL, consultoria |
| Tecnologia | #0b0d14 | #22d3a6 (verde-água) + #7c5cff | IA, software |
| Energia/vendas | #111 | #ff2d55 (vermelho-rosa) | ofertas, urgência |
| Saúde/bem-estar | #0f1a17 | #4ade80 (verde) | clínica, nutrição |
| Luxo | #0d0b0a | #d4af37 (dourado) | imóveis, joias |
| Divertido/zoeira | #1a1033 | #ff6a00 (laranja) + #00e5ff | humor, cortes de zoeira |
Regras: 1 cor de destaque (no máximo 2), texto branco ou preto com contraste alto, a marca do cliente manda (pergunte as cores).

## Som
- `sons_auto` (padrão ligado): woosh no título e imagens, pop nos destaques, click nos itens, ding nos números.
- Extras em `sons`: `riser` 1,5 s antes de uma revelação + `boom` nela; zoeira: `boing`, `buzina`, `apito`, `tchan`, `erro` (estilo programa de auditório). Nunca em cima de palavra importante; pouco e no lugar certo.
- Trilha: `"musica": {"estilo": "calma|energia|suspense", "volume": 0.08 a 0.14}` (gerada) ou o arquivo do usuário. Abaixa sozinha quando há fala.

## Narrador (cortes e vídeos de humor)
Pedido de "narrador contando o que acontece" (estilo narrador de série de comédia): escreva falas curtas e engraçadas em terceira pessoa ("Esse foi o dia em que o Fulano descobriu que..."), gere com `voz_local.py falar` (voz do próprio usuário, de quem autorizou ou a voz padrão) e coloque em `sons`/trilha nos momentos de pausa do vídeo. NÃO clone a voz de dublador ou ator famoso: imite o ESTILO (ritmo, ironia), não a voz.

## Acabamento leve (vídeo já pronto: reel redublado, corte, vídeo do cliente)
`python editar.py acabamento --video V.mp4 --pasta P --arroba "@perfil" --cta "Se quiser saber mais|digita *IA* nos comentários"` → moldura fina, @ no topo e chamada final pulsando nos últimos 4,5 s. Depois `motion_animar` com o html/audio impressos.
**Pergunte ao usuário** antes de entregar um vídeo de outra pessoa ou um reel refeito: "Quer que eu coloque o @ dele, uma moldura fina e uma chamada no fim (tipo 'digita IA nos comentários')?". Não é obrigatório, é opção.

## Problemas conhecidos (já resolvidos)
- FFmpeg 9 não aceita `-filter_complex_script` (use `-/filter_complex arquivo`); o script já usa.
- Motion: vídeo dentro da página aparece (é copiado para canvas a cada quadro); duração até 20 min.
- Transcrição automática do YouTube erra nomes e não tem pontuação; a local (faster-whisper) é muito melhor. Mesmo assim, corrija nomes com `trocas`.
