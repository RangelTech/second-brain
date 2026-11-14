---
name: ferramentas-do-app
description: |
  Quais ferramentas o próprio Cérebro Pro oferece ao agente e quando usar cada uma: gerar imagem na GPU
  (midia_gerar_imagem), memória das conversas antigas (memoria_buscar, memoria_ler_conversa), navegador integrado
  (navegador_abrir, ler, clicar, digitar, rolar, esperar, js, print) e vídeo (skill video-motion, no computador).
  Use ao receber pedidos como "crie uma imagem/arte/banner", "você lembra do que combinamos?", "abra o site e
  veja/clique/preencha", "tire um print da página", "faça um vídeo/animação".
---

# Ferramentas do app

Estas ferramentas existem só aqui, dentro do Cérebro Pro. Prefira-as ao improvisar com comandos soltos.

## Gerar imagem (`midia_gerar_imagem`)
- Roda numa GPU do servidor (cerca de 10 a 30 s). Salva um PNG na pasta `Imagens` da pasta de trabalho e devolve o caminho.
- Escreva o prompt em **inglês**, detalhado: assunto, estilo, luz, enquadramento, cores.
- Formatos: `quadrado`, `retrato`, `paisagem`, `story` (9:16), `banner`. Escolha pelo destino (feed, story, capa).
- **Texto dentro da imagem:** títulos curtos (1 a 3 palavras, em caixa alta, entre aspas no prompt) saem legíveis. Frases longas e letras acentuadas saem erradas ou sem acento. Se o texto for longo ou precisar de acento (ÃO, É, Ç), gere a arte sem texto e coloque o título depois (slides, relatório ou página HTML com o navegador integrado).
- Para variar o resultado, mude a `seed`; para repetir um resultado, reutilize a mesma.

### Receita testada (imagens, 05/11/2026)

Medido numa VM Linux de cliente: 4 imagens seguidas em cerca de 1,5 min (15 a 20 s cada). Arquivo salvo em `Imagens/<nome>-<data>.png`.

| Pedido | Formato | Prompt que funcionou |
|---|---|---|
| Logo | `quadrado` | `flat vector logo symbol, minimal, navy blue and gold, centered on a plain white background, no text, no letters` |
| Banner com título | `banner` ou `paisagem` | descreva a cena e termine com `bold white sans-serif headline text "FEIRAO JUCA" at the top, large and sharp` |
| Foto realista de pessoas | `quadrado` ou `retrato` | `photorealistic, natural light, 85mm lens` e diga a contagem exata: `exactly two people: one man and one woman` |
| Story | `story` | cena, horário e cor do céu (`black sedan on a curved road at sunset, orange and pink sky`) |

Armadilhas vistas no teste:
- **Contagem de pessoas errada.** Pedido "casal" gerou três pessoas. Escreva `exactly two people` no prompt e confira com `vision_analyze` perguntando de forma objetiva ("quantas pessoas aparecem?"), não "descreva a imagem", que aprova qualquer coisa.
- **A conferência por visão não vê acento.** O agente disse que o banner tinha "FEIRÃO" e a imagem trazia "FEIRAO". Para texto com acento, não confie na descrição: gere sem texto e sobreponha.
- **Fundo do logo.** Peça fundo branco liso, senão vem com cenário. Logo com texto sai com letras inventadas: só símbolo.
- Placas de carro e logotipos de marca saem ilegíveis ou inventados. Avise o cliente em vez de prometer.
- Se uma imagem falhar na conferência, gere de novo mudando a `seed` e corrigindo o prompt, no máximo 2 vezes, e diga ao usuário o que ainda ficou errado.

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
