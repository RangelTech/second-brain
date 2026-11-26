---
name: sites-cinematograficos
description: |
  Criar QUALQUER site ou página (institucional, negócio local, restaurante, loja, concessionária, clínica, produto, app, curso, portfólio, landing page, página de vendas) com qualidade de agência: kit de design pronto (kit/), modelos completos (modelos/) e muito vídeo e efeito visual (vídeo no topo, faixa de vídeos estilo Reels, parallax, zoom lento, título palavra por palavra, borda viva, brilho no cursor). Inclui como fazer vídeos de graça a partir de fotos (Motion) ou com o Estúdio, as regras anti-feio e a conferência obrigatória por print. Use sempre que pedirem "faz um site", "cria uma página", "landing page", "página de vendas", "site do meu negócio/produto/curso/imóvel", "site bonito/moderno/cinematográfico".
---

# Sites cinematográficos

**Regra nº 1: você NÃO desenha o site do zero.** Sites feitos do zero saem com cara de amador (fonte padrão, tudo centralizado,
espaço apertado, cor sem contraste). Esta skill traz um **kit de design pronto** e **modelos completos**, feitos no nível de
agência. Seu trabalho é: escolher o modelo, trocar o conteúdo, as fotos/vídeos e as cores, e **conferir por print** até ficar
perfeito. Use e abuse de **vídeo e efeitos visuais**: é isso que faz o cliente dizer "uau".

## 1. O kit (copie a pasta `kit/` inteira para dentro do site)
- `kit/kit.css` + `kit/kit.js`: fontes (Inter, Space Grotesk, Playfair), escala de títulos que se ajusta ao celular, espaços,
  topo com vidro, botões, cartões com brilho no mouse, grade "bento" (estilo Apple), faixa correndo, números que contam,
  depoimentos, preços, perguntas frequentes, chamada final, rodapé, botão fixo no celular e entrada suave ao rolar.
- `kit/efeitos.css` + `kit/efeitos.js`: **efeitos e vídeo**:
  - `.progresso` barra de leitura; `.granulado` textura de cinema; `.hero.letterbox` barras de cinema;
  - `.video-card` (vídeo vertical estilo Reels) e `.faixa-trilho.videos` (faixa de vídeos correndo);
  - `.kenburns` (zoom lento na foto); `data-parallax="0.1"` (camada que se move ao rolar);
  - `.palavras` (título entrando palavra por palavra); `.borda-viva` (borda em degradê girando, use no plano principal);
  - `.inclinar` (cartão inclina em 3D com o mouse); `.holofote` (luz que segue o cursor na seção);
  - `.btn-brilho` e `.pulsar` (botão com brilho passando e pulso).
- Para mudar a cara inteira: só as variáveis no `:root` (`--destaque`, `--destaque-2`, `--fundo`, `--fonte-titulo`). Tema claro:
  `<body class="claro">`.

## 2. Os modelos (comece SEMPRE por um deles)
| Pedido | Modelo |
|---|---|
| Produto, app, SaaS, curso online, serviço digital | `modelos/site-produto.html` (escuro, aurora, bento, vídeos correndo, números, preços, FAQ) |
| Negócio local: restaurante, café, clínica, salão, loja, oficina, **concessionária**, imobiliária | `modelos/site-negocio-local.html` (claro e elegante, foto/vídeo grande, serviços com preço, galeria, avaliações, mapa, WhatsApp) |
| Página de venda/lançamento com contagem regressiva | `modelos/landing-cinema.html` |
| Produto girando conforme rola (efeito Apple) | `modelos/rolagem-quadros.html` (seção abaixo) |
1. Crie `Sites/<nome>/`, copie o modelo como `index.html` e a pasta `kit/`, e crie `videos/` e `imagens/`.
2. Troque **todos** os `{{CAMPOS}}`. No fim, nenhum `{{` pode sobrar (confira com uma busca no arquivo).
3. Ajuste a cor da marca no `:root` do modelo. Remova seções que não fazem sentido, em vez de deixar texto genérico.
4. Pode reordenar e duplicar seções e trocar ícones. **Não** reescreva o CSS das classes do kit nem invente classes novas para o
   que o kit já faz.

## 3. Vídeos e imagens (o que mais pesa no "uau")
- **Topo com vídeo** sempre que der: `<div class="hero-midia"><video src="videos/topo.mp4" poster="imagens/topo.jpg" autoplay muted loop playsinline></video></div>`.
- **Faixa de vídeos verticais** (Reels do cliente, produto em uso, bastidores) com `.video-card`.
- De onde tirar:
  - fotos do cliente viram vídeo de cinema **de graça** com o Motion (`modelos/camera-cinema.html` + `motion_animar`);
  - bancos livres: Pexels (pexels.com/videos) e Mixkit;
  - Estúdio (créditos, `midia_orcar` antes);
  - fotos de banco: Unsplash (`https://images.unsplash.com/<id>?auto=format&fit=crop&w=1600&q=75`).
- Comprima tudo: `ffmpeg -i in.mp4 -vf scale=-2:1080 -c:v libx264 -crf 28 -preset slow -an -movflags +faststart out.mp4`
  (até ~3 MB por vídeo de fundo). Sempre com `poster`. Fotos: no máximo 1600 px de largura.
- Foto parada grande? Coloque `.kenburns` (ganha movimento). Foto secundária? `data-parallax="0.08"`.

## 4. Regras anti-feio (confira uma por uma antes de entregar)
1. Título do topo grande (`t-mega`), curto (até 8 palavras) e com uma parte em destaque (`.t-grad` ou `.t-serif`).
2. Uma cor de destaque só, contra fundo quase preto ou quase branco. Nada de arco-íris, nada de `#000` ou `#fff` puros.
3. Espaço sobrando: cada seção com `.secao`; nunca empilhe textos sem respiro.
4. Nada de emoji como ícone: use os SVG do modelo (estilo Lucide).
5. Texto sobre foto sempre com o escurecido do `.hero-midia` e com contraste alto.
6. Todo botão leva a algum lugar real (WhatsApp, checkout, âncora). No celular, `.fixo-celular` com a ação principal.
7. Imagens e vídeos sem esticar (`object-fit: cover`), sem marca d'água e coerentes com o negócio.
8. Seção nova só se tiver conteúdo de verdade. Depoimentos e números só reais, ou marcados como exemplo para trocar.

## 5. Conferir com os próprios olhos (obrigatório, até ficar perfeito)
1. Abra o `index.html` no navegador integrado (`navegador_abrir` com `file:///...`) ou tire print com o Edge/Chrome sem janela:
   `msedge --headless=new --hide-scrollbars --virtual-time-budget=6000 --window-size=1440,900 --screenshot=desk.png file:///.../index.html`
   e o mesmo com `--window-size=500,950` para o celular.
2. Olhe os prints com visão e dê uma nota de 0 a 10 para cada regra anti-feio. **Abaixo de 9 em qualquer uma, corrija e tire
   novo print.**
3. **Deixe o site aberto no navegador integrado** para a pessoa ver na hora, ao lado do chat: termine sempre com
   `navegador_abrir` no caminho do `index.html` (ex.: `C:\...\meu-site\index.html` ou `/home/.../meu-site/index.html`). Funciona no
   app instalado e na versão web (lá o navegador roda na aba da pessoa e o arquivo da máquina vira um endereço temporário).
   **Não ofereça download** nem mande abrir a pasta: o site já está na frente dela.
4. Entregue: uma frase do que foi feito, o caminho da pasta e a oferta de publicar.

### Rolagem quadro a quadro (estilo Apple) — `modelos/rolagem-quadros.html` + `scripts/quadros.py`
O produto gira, a câmera entra no carro, o prédio se monta CONFORME a pessoa rola. É o efeito que mais impressiona e vende (agências cobram caro).
1. **Vídeo de origem** com UM movimento contínuo (órbita do produto, aproximação, peças se juntando), 3 a 6 s, sem cortes, fundo limpo:
   - feito no Motion/Blender (grátis) quando dá para desenhar; ou gerado por IA de vídeo no Estúdio (créditos) a partir de uma foto: prompt de câmera do tipo "Arc Right: camera orbits the product, product stays still, smooth, visible parallax" ou "Dolly In".
2. `python scripts/quadros.py --video origem.mp4 --pasta "Sites/<nome>/quadros" --quadros 120 --largura 1600` (80 a 150 quadros; site leve).
3. Copie o modelo para `Sites/<nome>/index.html`, troque os textos das `.frase` (cada uma aparece entre `data-de` e `data-ate`, de 0 a 1 da rolagem), as cores e a chamada final. `alturaVh` (400 a 700) controla quanto rola.
4. Teste com servidor local (o modelo lê `quadros/quadros.json`): `python -m http.server` na pasta e abra no navegador integrado; role e confira os textos legíveis sobre o vídeo.

## Ritmo
O resultado tem que ficar perfeito, e o caminho para isso é **acertar de primeira**: planeje antes (textos, cores, cenas), use os modelos sem reinventar, confira a prévia contra o padrão de qualidade e corrija tudo de uma vez. Escreva o `index.html` **logo depois do primeiro vídeo pronto**, para o usuário já ver a página, e continue refinando (vídeos, textos, prints) até ficar perfeito. Diga em uma frase o que está melhorando a cada rodada.

## Roteiro
1. Entenda em 1 pergunta (se faltar): o que vende, para quem, preço e o link de compra (checkout). Peça fotos do produto/imóvel/pessoa, se ele tiver.
2. Crie a pasta `Sites/<nome>/` na pasta de trabalho, com `index.html`, `videos/` e `imagens/`.
3. Escreva o texto (promessa forte, concreta, sem exagero; números reais se o usuário tiver). Preencha o modelo.
4. **Vídeos** (escolha o caminho e diga ao usuário qual):
   - **De graça:** para cada foto, `motion_animar` com `camera-cinema.html` (8 s, 1080x1920 para os cartões; 1920x1080 para o topo). Fica com cara de filme a partir de foto parada.
   - **De graça, banco de vídeos:** vídeos livres do Pexels (pexels.com/videos) ou Mixkit (mixkit.co/free-stock-video). Baixe pelo navegador, confira a licença na página e guarde em `videos/`.
   - **Com créditos (Estúdio):** cena nova gerada por IA (ex.: "drone sobre o condomínio ao pôr do sol"). Sempre `midia_orcar` antes e espere o "sim".
   - Comprima: `ffmpeg -i in.mp4 -vf scale=-2:1080 -c:v libx264 -crf 28 -preset slow -an -movflags +faststart out.mp4` (vídeo de fundo sem áudio, até ~3 MB cada).
5. **Confira com os próprios olhos**: abra o `index.html` no navegador integrado (`navegador_abrir` com `file:///...`), tire print (`navegador_print`) em largura de computador e veja o celular. Corrija sobreposição, texto cortado, contraste.
6. Entregue com o site **aberto no navegador integrado** (`navegador_abrir` no `index.html`, sem oferecer download), o caminho da pasta e a oferta de publicar.

## Publicar
- Rápido e grátis: o usuário arrasta a pasta em app.netlify.com/drop (gera um link na hora).
- Com domínio próprio: Cloudflare Pages, Vercel ou a hospedagem dele. Faça junto com ele, pelo navegador integrado.

## Regras de qualidade
- Depoimentos e números só reais. Se o usuário não tiver, use textos de exemplo marcados e avise para trocar antes de publicar.
- Um destaque de cor só (o laranja/âmbar do modelo ou a cor da marca). Nada de arco-íris.
- Vídeo de fundo sempre `muted autoplay loop playsinline` e com `poster` (imagem enquanto carrega).
- Acessível: contraste alto, botão grande, funciona sem animação (`prefers-reduced-motion`).

## Web moderna (acervo Salvar)
Antes de escrever o site, carregue as orientações do repositório **modern-web-guidance** do time do Chrome (feito para agentes de código
usarem padrões atuais de HTML/CSS/JS em vez de código antigo). Junte com este estilo cinematográfico e com a skill `frontend-premium`.

## Tema "cidade neon de jogo" (Miami à noite) sem copiar marca
Pedido tipo "quero no tema do GTA": faça o CLIMA, nunca a marca. Não use logo, fonte, nome, personagem nem arte oficial de jogo
(direito autoral e marca registrada); diga isso numa frase e entregue a versão original. Receita testada numa landing real (19/11):
- **Fotos de fundo**: edite as fotos do próprio cliente com `midia_gerar_imagem` mandando a foto e pedindo "keep the same person
  identical (face, clothes, pose), change only the environment into a Miami night: hot pink and violet sunset, palm trees, art-deco
  hotels with pink and cyan neon (no readable words), wet asphalt reflecting neon; no logos, no text". Deixe espaço vazio do lado do título.
- **Cores**: fundo roxo quase preto (#0b0614), rosa-choque (#ff2d95), ciano (#19e3ff) e laranja-pôr-do-sol (#ff8a3d); título com
  degradê rosa→laranja→ciano (`background-clip:text`), botões rosa→laranja, faixa correndo rosa→roxo→ciano.
- **Palmeiras ao fundo**: silhueta de palmeira em SVG embutido (`data:image/svg+xml`) como `background` das seções e num
  `::before` do topo, em rosa/ciano com 15–30% de opacidade, nos cantos de baixo; no celular, menores e só duas.
- **Vídeo de exemplo dentro do celular**: `<video autoplay muted loop playsinline poster>` na moldura de celular, com botão
  "toque p/ ouvir" que liga o som e volta ao começo. Comprima antes: `ffmpeg -i in.mp4 -c:v libx264 -crf 26 -vf scale=540:-2 -c:a aac
  -b:a 96k -movflags +faststart out.mp4` (8 s ficam ~1,3 MB).
- Conferir no celular: o Edge/Chrome sem janela não abre menos que ~500 px de largura; print "cortado" em 390 px pode ser só isso.
