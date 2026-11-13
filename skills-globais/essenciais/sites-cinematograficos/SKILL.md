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

## Ritmo (importante)
O usuário está esperando. Faça na ordem, sem refazer à toa: 1 imagem por cena, 1 prévia, no máximo 1 correção, 1 renderização por vídeo; escreva o `index.html` **logo depois do primeiro vídeo pronto** (dá para trocar o vídeo depois). Meta: página pronta em até 15 minutos.

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
