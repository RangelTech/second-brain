---
name: desenho-animado
description: |
  DESENHO ANIMADO programado (canal dark/faceless que viraliza): bonequinhos de cabeça branca com traço de tinta VIVENDO uma
  história (terror, comédia, curiosidade, "e se?", explicação), com cenários (quarto à noite, corredor escuro, rua, floresta,
  cemitério, estrada, escola, escritório, cidade, praia, espaço), personagem que anda, corre, se assusta, aponta, segura lanterna;
  câmera viva, luz, chuva, neblina, susto, legenda palavra por palavra e narração. Tudo desenhado em código (canvas 2D) e
  renderizado em MP4, sem IA de vídeo e sem custo. Use quando pedirem "desenho animado", "animação com bonequinho", "stickman",
  "boneco palito", "história de terror animada", "animação de verdade (não foto)", "vídeo animado contando uma história",
  "canal dark de animação", "pixel/cartoon contando história". Também contém as regras de direção que fazem animação viralizar.
---

# Desenho animado programado

O vídeo é uma FUNÇÃO DO TEMPO desenhada em canvas: cada quadro é calculado (nada aleatório). Personagens com rig (rosto com humor,
braços com IK, ciclo de caminhada), cenários prontos, câmera, luz e efeitos já existem no **kit** (`kit/`). Você (ou a IA que escreve
o código) só monta os PLANOS. Produção: Viralizaí formato "Desenho animado" (`viralizai/app/cinema.py`, `motion/cinema/`).

## Fluxo (siga nesta ordem)
1. **Roteiro + plano de cenas** (o diretor). 1 frase narrada por cena (5 a 16 palavras), 6 a 10 cenas para 30-45 s.
   Para cada cena escreva: cenário, ator(es) com ação e humor, objeto(s), efeito, câmera, transição. A cena tem que CASAR com a fala:
   "abriu a porta" mostra a porta abrindo; "três da manhã" mostra o relógio nas 3. Vocabulário fechado em `kit/API.md`.
2. **Narração com tempo por palavra.** Voz (edge-tts no servidor; no Cérebro, a skill de voz) e o tempo de cada palavra → `palavras.json`
   `[{"w":"Toda","s":0.0,"e":0.32},...]`. Cada cena começa quando a fala dela começa; a última segura ~1,2 s depois da voz.
3. **Código dos planos** (`shots.js`): leia `kit/API.md` e copie a estrutura de `kit/exemplo_shots.js`. Um `SHOTS.push({start,end,tr,draw})`
   por cena, com os tempos exatos. Cada `draw` começa com `const cam = camera(...)` e `cenario(...)`, depois objetos/atores, depois efeitos.
4. **Validar** antes de renderizar: `python scripts/montar_pagina.py shots.js filme.html --palavras palavras.json --validar`
   (roda o filme num canvas falso; aponta o plano e o erro). Corrija até dar `ok`.
5. **Olhar**: `motion_previa` com `arquivo=filme.html` em 5-8 tempos (um por cena) e olhar com visão: personagem visível? ação certa?
   texto na faixa da legenda? cena escura demais? Corrigir e olhar de novo.
6. **Renderizar**: `motion_animar` com `arquivo=filme.html`, `duracao` = a impressa pelo script, `audio` = a narração. 1080x1920, 30 fps.
   (No servidor do Viralizaí: composição Remotion `Cinema`, mesmo código.)

## Regras de direção (o que separa animação boa de "foto com efeito")
- **A animação conta a história sem som.** O fato vira objeto e ação (porta abre, celular vibra, vulto aparece). Texto na tela só a
  legenda e, no máximo, um texto curto DENTRO de um objeto (`placa`, tela do `celular`, `lousa`). Nunca cartão de texto, lista, selo,
  título solto: isso é "cara de IA".
- **Um acontecimento por plano, na palavra.** A ação começa no início do plano (lt 0,1-0,4 s), quando a palavra é dita.
- **Uma luz por plano** (abajur, poste, lanterna, vela, celular) em cenário escuro; algo sempre se mexendo (chuva, poeira, neblina).
- **Câmera é pontuação**: um movimento por plano; varie (`empurra`, `pan`, `afasta`, `sobe`); `treme`/`zoom_rapido` só no susto/revelação;
  nunca 3 planos seguidos com o mesmo tipo. Cortes a cada 2,5-4 s (suspense: até 3 s).
- **Gancho**: 1ª frase concreta (hora, lugar, objeto) e escalada visual nos 3 primeiros segundos. **Final** em pergunta ou virada,
  segurando no personagem (sem cartão final).
- **Personagem grande e legível**: `s` 520 no plano geral, 800-1400 no close; mesmo personagem (`quem`) a história inteira; 1 cor por personagem.
- **Som**: efeito no quadro do acontecimento (`whoosh` no chicote, `impacto` no susto, `riser` antes da revelação); música baixa sob a voz.
- **Determinístico**: só `lt`/`t`; nada de `Math.random` (use `rng(seed)`).
- **Coisa que não existe no kit** (bicho, objeto novo): desenhe com formas simples + contorno `INK` 5-6 px + cor chapada (ver o gato do exemplo).
- **Foto real** quando ajuda (lugar famoso, pessoa, produto): dentro de `tv`, `fotoQuadro` ou `celular` (`IMG.img1`), nunca tela cheia.

## Erros comuns (já aconteceram)
- Escala de objeto em pixels (`cama(ctx, x, y, 380)`): o kit corrige acima de 4, mas use escala ~1.
- Código cortado no fim (resposta longa): escreva enxuto (6-18 linhas por plano); se cortar, continue a partir do último plano completo.
- Neblina forte vira faixa branca: `neblina(ctx, t, CHAO, .3-.5)`.
- Personagem em cima da cama/mesa: confira `y` (chão = `CHAO`; deitado na cama ≈ `CHAO - 230`).

## Estilos (próximos)
O kit atual é "bonequinho de cabeça branca" (stick figure com roupa colorida). Outros que viralizam e estão mapeados para portar:
pixel art RPG, papel recortado, giz em lousa, massinha, aquarela, anime 80s, noir âmbar, rubber-hose anos 30, retrô TV, holograma.
Referências estudadas (todas MIT salvo indicação): artemnovitckii/claude-animation-skills (base do kit), deenukhan/story-animator,
deenukhan/animation-styles (39 estilos), deenukhan/stick-figure-shorts, mromidev/claude-animated-shorts, alchaincyf/huashu-art-motion
(modo trilho p/ modelos fracos, 6 jeitos de estragar), kaomei/stickman-video-director (14 estilos, regras de suspense ≤3 s/plano),
czaarDev gist (10 estilos com cena base de caminhada). Estudo completo: spec 47e §6 (new_ragente/specs).

## Arquivos
- `kit/API.md`: referência completa (cenários e opções, ator/ações/humores, câmera, objetos, efeitos, animação no tempo).
- `kit/exemplo_shots.js`: filme de exemplo (terror, 21 s, 6 planos) — o modelo a copiar.
- `kit/*.js`: motor (lib, chars, env vêm do template MIT de claude-animation-skills; cenarios, props, alto, main são nossos).
- `kit/valida.js`: validador sem navegador (Node). `scripts/montar_pagina.py`: monta a página para `motion_previa`/`motion_animar`.
