---
name: ferramentas-do-app
description: |
  Quais ferramentas o próprio Segundo Cérebro oferece ao agente e quando usar cada uma: gerar imagem na GPU
  (midia_gerar_imagem), memória das conversas antigas (memoria_buscar, memoria_ler_conversa), navegador integrado
  (navegador_abrir, ler, clicar, digitar, rolar, esperar, js, print) e vídeo (skill video-motion, no computador).
  Use ao receber pedidos como "crie uma imagem/arte/banner", "você lembra do que combinamos?", "abra o site e
  veja/clique/preencha", "tire um print da página", "faça um vídeo/animação".
---

# Ferramentas do app

Estas ferramentas existem só aqui, dentro do Segundo Cérebro. Prefira-as ao improvisar com comandos soltos.

## Gerar imagem (`midia_gerar_imagem`)
- Roda numa GPU do servidor (cerca de 10 a 30 s). Salva um PNG na pasta `Imagens` da pasta de trabalho e devolve o caminho.
- Escreva o prompt em **inglês**, detalhado: assunto, estilo, luz, enquadramento, cores.
- Formatos: `quadrado`, `retrato`, `paisagem`, `story` (9:16), `banner`. Escolha pelo destino (feed, story, capa).
- **Texto dentro da imagem sai com letras erradas.** Gere a arte SEM texto e avise que o título pode ser colocado depois
  (por exemplo, com uma ferramenta de design ou pela skill de relatórios/slides).
- Para variar o resultado, mude a `seed`; para repetir um resultado, reutilize a mesma.
- Depois de gerar, olhe o resultado (`vision_analyze` no arquivo) antes de entregar: mãos, rostos e produtos às vezes saem tortos.

## Memória das conversas (`memoria_buscar`, `memoria_ler_conversa`)
- Use quando o usuário disser "você lembra de...", "aquilo que conversamos", "o que ficou combinado" ou citar algo que
  não está nesta conversa. Busque primeiro; só depois responda.
- `memoria_buscar` devolve trechos com o id da conversa; `memoria_ler_conversa` abre mais mensagens em volta de um trecho.
- Se nada for achado, diga isso. Nunca invente o que "foi combinado".

## Navegador integrado (`navegador_*`)
- O usuário vê a página ao lado do chat. Fluxo normal: `navegador_abrir` → `navegador_ler` (texto + lista numerada de
  elementos) → `navegador_clicar` / `navegador_digitar` pelo número → `navegador_esperar` se a página carrega aos poucos.
- `navegador_print` salva uma captura em PNG: use para conferir o que está na tela.
- `navegador_js` roda JavaScript na página, para extrair dados que a leitura normal não mostra.
- Pare e pergunte antes de qualquer ação com efeito real: comprar, enviar formulário definitivo, apagar, publicar, pagar.
- Nunca digite senhas que o usuário não tenha pedido para usar; peça que ele entre sozinho e continue depois.

## Vídeo
- Animações gráficas, legendas, vinhetas, reels com texto: skill **video-motion** (código, roda no computador, sem GPU).
- Vídeo realista gerado por IA em servidor ainda não está disponível. Se pedirem, ofereça a alternativa com video-motion
  ou com imagens + montagem.
