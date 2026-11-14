---
name: sites-cinematograficos
description: |
  Criar landing pages e sites de venda com cara de cinema (fundo escuro, vídeo no topo, cartões de vídeo verticais, faixa correndo, botão pulsando, oferta com contagem regressiva, depoimentos, perguntas frequentes), no nível das páginas de lançamento que vendem bem. Inclui como fazer os VÍDEOS de graça a partir de fotos (Motion, câmera cinematográfica) ou com o Estúdio (créditos). Use quando o usuário pedir "faz um site", "landing page", "página de vendas", "página do meu produto/curso/imóvel", "site com vídeo", "site bonito/moderno/cinematográfico".
---

# Sites cinematográficos

O que faz um site desses impressionar: **vídeo de verdade** (topo e cartões), **contraste** (fundo quase preto, uma cor quente de destaque), **tipografia grande**, **movimento discreto** (faixa correndo, entrada suave ao rolar, botão que pulsa) e **estrutura de venda** (promessa, prova, passos, depoimentos, oferta com prazo, garantia, dúvidas). Tudo isso já está no modelo.

## Modelos desta skill (use, não comece do zero)
- `modelos/landing-cinema.html`: a página inteira, um arquivo só, sem dependências, responsiva (celular com botão fixo embaixo). Troque os `{{CAMPOS}}`, as cores em `:root` e os vídeos em `videos/`.
- `modelos/camera-cinema.html`: transforma **uma foto** em vídeo de cinema (câmera lenta com zoom e deslize, luz passando, poeira no ar, barras de cinema, texto entrando). Renderize com `motion_animar` (Motion, de graça, no computador do usuário). Troque `FOTO`, `TITULO`, `SUBTITULO` e a duração `D`.

### Rolagem quadro a quadro (estilo Apple) — `modelos/rolagem-quadros.html` + `scripts/quadros.py`
O produto gira, a câmera entra no carro, o prédio se monta CONFORME a pessoa rola. É o efeito que mais impressiona e vende (agências cobram caro).
1. **Vídeo de origem** com UM movimento contínuo (órbita do produto, aproximação, peças se juntando), 3 a 6 s, sem cortes, fundo limpo:
   - feito no Motion/Blender (grátis) quando dá para desenhar; ou gerado por IA de vídeo no Estúdio (créditos) a partir de uma foto: prompt de câmera do tipo "Arc Right: camera orbits the product, product stays still, smooth, visible parallax" ou "Dolly In".
2. `python scripts/quadros.py --video origem.mp4 --pasta "Sites/<nome>/quadros" --quadros 120 --largura 1600` (80 a 150 quadros; site leve).
3. Copie o modelo para `Sites/<nome>/index.html`, troque os textos das `.frase` (cada uma aparece entre `data-de` e `data-ate`, de 0 a 1 da rolagem), as cores e a chamada final. `alturaVh` (400 a 700) controla quanto rola.
4. Teste com servidor local (o modelo lê `quadros/quadros.json`): `python -m http.server` na pasta e abra no navegador integrado; role e confira os textos legíveis sobre o vídeo.

## Ritmo (importante)
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
6. Entregue: caminho da pasta, um print, e ofereça publicar.

## Publicar
- Rápido e grátis: o usuário arrasta a pasta em app.netlify.com/drop (gera um link na hora).
- Com domínio próprio: Cloudflare Pages, Vercel ou a hospedagem dele. Faça junto com ele, pelo navegador integrado.

## Regras de qualidade
- Depoimentos e números só reais. Se o usuário não tiver, use textos de exemplo marcados e avise para trocar antes de publicar.
- Um destaque de cor só (o laranja/âmbar do modelo ou a cor da marca). Nada de arco-íris.
- Vídeo de fundo sempre `muted autoplay loop playsinline` e com `poster` (imagem enquanto carrega).
- Acessível: contraste alto, botão grande, funciona sem animação (`prefers-reduced-motion`).
