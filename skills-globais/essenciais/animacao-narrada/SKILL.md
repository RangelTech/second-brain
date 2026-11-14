---
name: animacao-narrada
description: |
  Vídeo ANIMADO com NARRADOR, do tema ao MP4 pronto para postar, sem editar e sem aparecer (canal dark / faceless): o usuário diz um tema numa frase e você pesquisa, escreve o roteiro, narra (voz padrão, voz clonada ou a voz dele) e monta as cenas com objetos 3D animados, título, legenda palavra por palavra, @ do perfil e chamada final. Seis estilos visuais (escuro 3D, neon, quadro-negro, pixel art, quadrinhos, papel). Use quando pedirem "vídeo animado", "animação com narração", "canal dark", "vídeo de curiosidade", "explicar X em vídeo", "reels sem aparecer", "vídeo 3D", "mesmo vídeo em vários estilos", ou quando alguém mostrar um reel desse formato e quiser igual.
---

# Animação narrada (canal dark)

Formato visto na biblioteca do usuário (grupo Salvar, nov/2026): objetos 3D simples sobre fundo escuro, cor de destaque, título grande em cima, legenda embaixo e um narrador; e "o mesmo reel em 10 estilos". Vendem isso como curso/skill por R$ 37 a 97. Aqui sai de graça, no computador do usuário.

## O que você entrega
Um MP4 vertical 1080x1920 (Reels/TikTok/Shorts), a capa, a legenda do post com hashtags e, se pedirem, o mesmo vídeo em outros estilos.

## Passo a passo (faça tudo; só pergunte o que falta)
1. **Pergunte em UMA mensagem** (com sugestões prontas): tema, @ do perfil, estilo (mostre os 6), voz (padrão, clonada de um áudio, ou a do usuário), duração (30 s para crescer; MAIS de 60 s se a ideia é monetizar no TikTok).
2. **Pesquise** o tema na internet. Todo número ou fato vai em DUAS fontes; se não bater, não use. Anote as fontes para a legenda.
3. **Roteiro** em `Videos/<projeto>/roteiro.json` (formato abaixo):
   - cena 1 = GANCHO em até 2 s (pergunta, contradição, número que choca);
   - 1 ideia por cena, fala de 1 a 2 frases curtas (≈ 2 a 6 s);
   - cada cena com 1 a 4 objetos da lista;
   - última cena = chamada (siga, comente PALAVRA, link).
   - Números por extenso na fala não precisam: o gerador já converte.
4. **Monte** (narra cada cena, mede o tempo e escreve a animação):
   `python <skills>/reel-narrado/scripts/montar_reel.py --roteiro roteiro.json --pasta "Videos/<projeto>" --modelo <skills>/animacao-narrada/modelos/animacao.html`
   Voz clonada: no roteiro, `"voz": {"amostra": "C:/.../voz.wav", "motor": "xtts"}` (amostra limpa de 10 a 60 s; veja a skill voz-local).
5. **Confira ANTES de renderizar:** `motion_previa` com o html, a duração e os tempos de `previa_sugerida`. OLHE cada quadro: objeto inteiro na tela, nada em cima da legenda, título sem cortar. Corrija o roteiro e rode o passo 4 de novo (as falas que não mudaram ficam em cache).
6. **Renderize:** `motion_animar` com `arquivo`=animacao.html, `audio`=narracao.wav, `duracao`, `saida`=Videos/<projeto>/<nome>.mp4. Rode em primeiro plano e espere terminar (30 s de vídeo ≈ 2 a 4 min).
7. **Valide o MP4:** duração, áudio presente, 3 quadros (início, meio, fim). Entregue com a legenda do post.

## roteiro.json
```json
{
  "estilo": "escuro",
  "arroba": "@seuperfil",
  "cores": {"d1": "#ff7a1a"},
  "cenas": [
    {"tipo": "objeto", "objetos": ["pizza"], "titulo": "A pizza é *redonda.*", "fala": "A pizza é redonda."},
    {"tipo": "numero", "numero": "1 folha", "rotulo": "de papelão, sem cola", "objetos": ["papel"], "fala": "..."},
    {"tipo": "lista", "titulo": "Você não precisa:", "marca": "✕", "itens": ["saber editar", "pagar editor"], "fala": "..."},
    {"tipo": "cta", "botao": "Quero o kit →", "sub": "comece *hoje.*", "fala": "..."}
  ]
}
```
- `*palavra*` no título = cor de destaque.
- `tipo`: `objeto` (padrão), `numero`, `lista` (marca ✕ ou ✓), `cta`. Qualquer cena aceita `texto` (frase de apoio).
- **Objetos prontos** (1 a 4 por cena; 4 viram grade 2x2): pizza, balao (de fala), lupa, microfone, papel, caixa, celular, carro, moeda, foguete, coracao, estrela, trofeu, lampada, grafico (barras que sobem), dinheiro, globo, relogio, cerebro, cubo, esfera. Precisa de outro? Escreva a função no objeto `OBJ` do modelo, montando com primitivas do Three.js (caixa, cilindro, esfera, cone, toro, forma extrudada). Teste com motion_previa.

## Estilos (`"estilo"`)
| estilo | visual | bom para |
|---|---|---|
| escuro | 3D com sombra, fundo preto, laranja | curiosidade, negócio, padrão |
| neon | contornos brilhantes ciano/rosa, grade | tecnologia, mistério |
| quadro-negro | giz em lousa verde | explicação, aula, história |
| pixel | pixel art, céu roxo/laranja | games, nostalgia |
| quadrinhos | contorno preto, pontilhado amarelo, balões | humor, notícia leve |
| papel | fundo claro, cores pastel | finanças, saúde, público geral |
"O mesmo vídeo em vários estilos" = mude só `estilo` e rode montar + render de novo (a narração fica em cache).

## Narrador
- **Padrão (grátis, rápido):** sem `voz` no roteiro, sai a voz local (Piper + OpenVoice). Fica natural para canal dark.
- **Voz clonada:** amostra de 10 a 60 s de fala limpa da pessoa (só com autorização dela). Motor xtts. Mais lenta (≈ 5 a 8x o tempo do áudio num notebook).
- **Estilo de narrador** (tipo "Todo Mundo Odeia o Chris"): é o TEXTO que faz o estilo. Escreva em 1ª pessoa, com ironia, frases curtas e pausa antes da piada. Não imite a voz de ator famoso.
- Música/efeitos: `skills/motion/scripts/sons.py` (trilha calma/energia/suspense + whoosh, pop, ding, boing) mixados baixo sob a voz.

## Máquina do usuário
- Roda em qualquer notebook (o 3D é leve, feito no navegador interno). Render de 30 s ≈ 2 a 4 min.
- Voz clonada (xtts) precisa de ≈ 8 GB de RAM livre. Se a máquina for fraca, diga: "Seu computador não tem memória para a voz clonada; uso a voz padrão agora ou a voz em nuvem (créditos do Estúdio)."
- Vídeo realista (pessoa, lugar, câmera de cinema) não sai daqui: é IA de vídeo paga (Estúdio). Ofereça só se o usuário quiser.

## Legenda do post (entregue junto)
1ª linha = o gancho de novo; 3 a 5 linhas curtas com o fato; as fontes ("Fonte: ..."); chamada; 3 a 5 hashtags do nicho.
