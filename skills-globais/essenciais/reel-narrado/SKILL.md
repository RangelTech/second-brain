---
name: reel-narrado
description: |
  Vídeo NARRADO com voz (a do usuário, a de alguém que autorizou ou uma voz padrão) + animação + edição, tudo no computador do usuário e sem créditos. Cobre: (1) reel/story/vídeo de até 3 minutos com roteiro escrito por você, narração na voz clonada e animação de motion sincronizada com a fala, legenda palavra por palavra; (2) "pega a minha voz e fala este texto"; (3) "troca a voz deste áudio/vídeo pela minha" (mesmas palavras e ritmo, outro timbre); (4) "dubla este vídeo com a minha voz" (mesmo texto ou texto novo); (5) levar o resultado para o Editor de vídeo para ajustar junto com o usuário. Use quando pedirem reel narrado, vídeo com a minha voz, locução, dublagem, trocar a voz, "faz um reels de 1 minuto com a minha voz", vídeo explicativo, anúncio narrado.
---

# Reel narrado (voz + motion + editor)

Tudo aqui roda no computador do usuário, **de graça**, com o que já vem no Segundo Cérebro:
- **Voz:** skill `voz-local` (`scripts/voz_local.py`): clona a voz de uma amostra (OpenVoice ou XTTS), troca o timbre de uma fala e mantém um servidor com o modelo na memória (as falas seguintes saem rápido).
- **Animação:** ferramentas `motion_previa` e `motion_animar` (HTML/React vira MP4), skill `motion`.
- **Montagem pronta:** `scripts/montar_reel.py` desta skill + o modelo `modelos/reel-narrado.html`.
- **Editor de vídeo:** botão **Editor** do app ou `editor_abrir_janela` (skill `editor-de-video`), para ajustes finos junto com o usuário.

Não instale nada: rode os scripts com o Python que houver (ou o do app, `SB_PYTHON`). Se `voz_local.py estado` disser que falta algo, rode `voz_local.py instalar --motor ambos` UMA vez (alguns minutos) e espere terminar.

**Autorização:** só clone a voz do próprio usuário ou de quem autorizou. Se não estiver claro de quem é a voz, pergunte uma vez.

---

## Qual pedido é qual

| O usuário diz | O que fazer | Seção |
|---|---|---|
| "faz um reels de 1 minuto com a minha voz sobre X" | roteiro + narração + animação + legenda | **A** |
| "fala este texto com a minha voz" / "narra isso" | `voz_local.py falar` | **B** |
| "troca a voz deste áudio/vídeo pela minha" | `voz_local.py trocar` (mesma fala, outro timbre) | **C** |
| "dubla este vídeo com a minha voz" (mesmo texto) | `voz_local.py redublar` (faz tudo: separa música, frase por frase no tempo) | **D** |
| "pega este vídeo e coloca uma narração minha por cima" | B + mixar por cima do áudio original baixo | **D** |
| "quero mexer junto" / ajustes finos | abrir no Editor | **E** |

### Escolher o motor da voz
- **XTTS** (`--motor xtts`): mais parecido com a pessoa e mais natural. Mais lento em CPU (neste tipo de notebook, ~7 s de processamento por segundo de fala com o servidor quente). Licença só para uso NÃO comercial: diga isso em uma frase se o vídeo for para vender algo, e deixe o usuário escolher.
- **OpenVoice** (`--motor openvoice`, padrão do voz_local): rápido (~1 s por segundo de fala com o servidor quente), uso comercial liberado; sotaque um pouco mais "de locutor".
- Pedido "rápido" ou teste: OpenVoice. Pedido "fica igual a mim" e sem fim comercial: XTTS.

### Amostra da voz (vale para todas as seções)
- 20 s a 2 min de fala limpa, uma pessoa só, sem música. Mais que isso não melhora.
- Voz do usuário: peça para gravar um áudio (o app grava pelo microfone do chat) ou use um áudio que ele mandou.
- Voz de um contato do WhatsApp: `navegador_whatsapp_baixar` com `contato`, `tipo="audio"`, `de="contato"`, `limite=5`.
- Junte e limpe com o ffmpeg do app (skill motion diz onde fica):
  `ffmpeg -i a1.ogg -i a2.ogg -i a3.ogg -filter_complex "concat=n=3:v=0:a=1,highpass=f=80,loudnorm" -ac 1 -ar 22050 amostra.wav`
- Guarde a amostra na pasta do projeto (`Videos/<projeto>/amostra.wav`) e reutilize: o servidor guarda a "impressão" da voz por amostra.

---

## A. Reel narrado de 30 s a 3 min (roteiro + voz + animação)

### A1. Combine em UMA mensagem (se faltar algo)
Tema e objetivo (vender, ensinar, divulgar), formato (9:16 reel é o padrão), duração (1 min ≈ 140 a 160 palavras faladas), voz (dele, de quem, ou padrão), cores da marca, chamada final (comentar, link na bio, WhatsApp). Dê sugestões entre parênteses e aceite "pode seguir".

### A2. Escreva o roteiro como JSON (`Videos/<projeto>/roteiro.json`)
Formato completo no topo de `scripts/montar_reel.py`. Regras de roteiro que funcionam:
- **6 a 9 cenas** para 1 minuto; **cada cena = uma ideia = 1 ou 2 frases faladas** (5 a 10 s).
- **Gancho nos 3 primeiros segundos** (pergunta ou promessa: "Você ainda faz tudo na mão?").
- Fala escrita para o OUVIDO: frases curtas, palavras simples, números por extenso quando forem falados ("cinco minutos"), pontuação certa (vírgula e ponto mudam a entonação), sem siglas soletradas, sem emoji.
- Texto da TELA é diferente da fala: título curto (até ~6 palavras), um destaque com `*asteriscos*`, texto de apoio de uma linha. Nunca cole a fala inteira na tela (a legenda já mostra).
- Tipos de cena do modelo: `gancho` (selo + título), `dica` (número grande 01, 02… + título + texto), `numero` (número que sobe + rótulo), `lista` (até 4 itens entrando no ritmo da fala), `frase` (título forte), `cta` (título + botão pulsando). Termine SEMPRE com `cta`.
- Cores: `fundo` escuro + duas de destaque (`d1`, `d2`) com bom contraste; use as da marca se houver.
- Música (opcional): `"musica": {"arquivo": "...", "volume": 0.12}` só com arquivo do usuário ou livre de direitos.

### A3. Gere fala + linha do tempo + animação
```
python "<pasta desta skill>/scripts/montar_reel.py" --roteiro "Videos/<projeto>/roteiro.json" --pasta "Videos/<projeto>"
```
O script fala cena por cena com a voz escolhida, **mede** cada fala, tira os silêncios das pontas, monta `narracao.wav` (com pausas de 0,35 s e volume de rede social) e escreve `reel.html` com cada cena entrando e saindo exatamente no tempo da fala, barra de progresso no topo e legenda palavra por palavra. Imprime JSON com `html`, `audio`, `duracao`, `previa_sugerida` e o tempo de cada cena.
- Avise antes: "vou gravar a narração com a sua voz, leva uns minutos". Uma fala de 1 minuto com XTTS em CPU leva ~5 a 8 min; com OpenVoice ~1 min.
- Rodar de novo só regrava as cenas cujo texto mudou (as outras ficam em cache). Para trocar um texto de tela, edite só o `titulo`/`texto` no JSON e rode de novo: sai na hora, sem regravar voz.
- Duração final longe do pedido? Encurte ou alongue as FALAS (não acelere a voz).

### A4. Confira antes de renderizar (obrigatório)
`motion_previa` com `arquivo` = o `html` impresso, `duracao`, e `quadros` = `previa_sugerida` (até 8 tempos). **Olhe cada quadro** com `vision_analyze` e confira: título inteiro e dentro da área segura (nada nos 160 px de cima nem nos 300 px de baixo além da legenda), legenda legível sem cobrir o título, destaque em uma ou duas palavras, número/lista visíveis, botão inteiro. Corrija tudo de uma vez no JSON (textos menores, menos palavras) e rode `montar_reel.py` de novo.

### A5. Renderize e confira
`motion_animar` com `arquivo` = html, `audio` = narracao.wav, `duracao` = a impressa, `saida` = `Videos/<projeto>/<nome>.mp4`. Leva ~6 s de trabalho por segundo de vídeo em 1080x1920 (1 min ≈ 6 min; avise).
Depois: extraia 3 quadros do MP4 (`ffmpeg -ss <t> -i video.mp4 -frames:v 1 q.png`) e olhe; confira com `ffprobe` que tem vídeo e áudio e a duração bate.

### A6. Entregue
Caminho completo do MP4 numa linha própria, a duração, e ofereça em uma linha: "quer mudar algum texto, a ordem das cenas, ou abrir no editor para mexermos juntos?".

---

## B. "Fala este texto com a minha voz"
1. Amostra (ver acima). 2. Texto num `.txt` (pontuação caprichada).
3. `python "<voz-local>/scripts/voz_local.py" falar --texto-arquivo fala.txt --amostra amostra.wav --saida "Audios/fala.wav" [--motor xtts]`
4. MP3 para WhatsApp: `ffmpeg -i fala.wav -b:a 128k fala.mp3`. Entregue o caminho (o app toca no chat).
Texto longo: pode mandar inteiro; o script divide em frases sozinho.

## C. "Troca a voz deste áudio/vídeo pela minha" (mesmas palavras, outro timbre)
`python "<voz-local>/scripts/voz_local.py" trocar --entrada "arquivo.mp4|.ogg|.wav" --amostra amostra.wav --saida "Videos/trocado.mp4"`
- Entrada em vídeo e saída `.mp4`: devolve o vídeo com o áudio trocado (imagem intacta). Saída `.wav`: só o áudio.
- Mantém o ritmo, as pausas e a entonação de quem falou; muda só o timbre. Rápido (15 s de vídeo em ~20 s).
- Funciona melhor com fala limpa. Se o original tiver música alta, avise que a música também passa pelo conversor; nesse caso prefira a seção D (narração nova por cima da música baixa).

## D. "Dubla este vídeo com a minha voz"
**Caminho padrão:** `voz_local.py redublar --video v.mp4 --amostra a1 --amostra a2 ... --saida Videos/dublado.mp4` (skill voz-local). Os passos abaixo são o que ele faz por dentro; use-os só para texto NOVO ou outro idioma.
1. Baixe/ache o vídeo (link: `yt-dlp`; Instagram logado: navegador integrado).
2. Áudio para transcrever: `ffmpeg -i video.mp4 -vn -ac 1 -ar 16000 fala16k.wav`; transcreva com a ferramenta de transcrição do app (ou faster-whisper local). Revise a pontuação. Se o usuário quer outro idioma, traduza o texto.
3. Duas formas:
   - **Mesmo texto, mesmo ritmo** (mais fiel ao tempo): seção C direto no vídeo (`trocar`). É o caminho mais rápido.
   - **Texto novo ou outro idioma:** gere a fala (seção B, XTTS) e encaixe: compare durações com `ffprobe`; ajuste com `atempo` entre 0,85 e 1,15 (fora disso, reescreva o texto mais curto/longo); troque o áudio: `ffmpeg -i video.mp4 -i nova.wav -map 0:v -map 1:a -c:v copy -c:a aac -shortest Videos/dublado.mp4`. Para manter a trilha original baixinho por baixo: `-filter_complex "[0:a]volume=0.12[o];[1:a][o]amix=inputs=2:duration=first[a]" -map 0:v -map "[a]"`.
   - Vídeo longo (mais de 1 min): divida por frases da transcrição com os tempos (cada frase gerada e posicionada com `adelay` no tempo original) para a fala não "escorregar" do que aparece na tela.
4. Diga com honestidade: sem sincronia labial (boca acompanhando só no Estúdio, em créditos, com preço antes).

## E. Levar para o Editor (ajuste junto com o usuário)
Depois de qualquer seção acima, ofereça abrir no Editor: o botão "Abrir no editor" aparece em todo vídeo do chat, ou use `editor_abrir_janela`. No editor dá para trocar a ordem das cenas, cortar, pôr a narração numa trilha separada, música, logo e exportar. Dica: entregue também `narracao.wav` e as falas de cada cena (`falas/cena-XX-limpa.wav`) para o usuário arrastar no editor.

---

## Problemas conhecidos (já resolvidos no script; não tente "consertar" de outro jeito)
- Não instale spaCy, torch, coqui nem outra versão de nada: o `voz_local.py` divide frases sozinho e o ambiente vem travado do pacote nosso. Instalar por fora QUEBRA a voz (aconteceu em teste).
- A primeira fala de cada sessão demora (carrega o modelo, 20 s a 1 min); as seguintes são rápidas. Gere todas as cenas em sequência, sem parar o servidor.
- Se a fala sair com um pedaço estranho numa cena, mude a pontuação dessa cena e rode `montar_reel.py` de novo (só ela é regravada).
- Duração da animação vem da fala medida: não chute duração no `motion_animar`, use a impressa.
- Legenda é aproximada por palavra (proporcional ao tamanho); fica natural em fala corrida. Para legenda exata de vídeo existente, use a transcrição com tempos.
