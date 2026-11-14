---
name: voz-local
description: |
  Voz clonada e narração NO COMPUTADOR DO USUÁRIO, de graça (sem créditos): o usuário manda uma amostra da voz dele (áudio de 10 s a 5 min) e o agente gera falas novas com essa voz, em português do Brasil, para narração, vídeo, mensagem de áudio, dublagem simples. Dois motores: OpenVoice v2 + Piper (livre para uso comercial) e XTTS v2 (mais natural, só uso não comercial). Use quando o usuário pedir "fala isso com a minha voz", "narra com a minha voz", "clona minha voz", "faz um áudio com a minha voz", ou quando a dublagem/voz do Estúdio (créditos) não for necessária.
---

# Voz local (sem créditos)

Tudo roda no computador do usuário. Somos amigos dele: o que dá para fazer aqui, fazemos de graça; o Estúdio (créditos) fica para o que o computador não aguenta ou quando ele quer o resultado de ponta (voz `heygen`/dublagem com sincronia labial).

Script: `scripts/voz_local.py` desta skill. Pacotes e modelos vêm dos snapshots nossos (`RangelTech/segundo-cerebro-artefatos`, releases `voz-local-v1` e `voz-local-v2`), conferidos por sha256; a origem oficial é só plano B.

## Escolher o motor
| Motor | Quando | Licença |
|---|---|---|
| `openvoice` (padrão) | uso livre, inclusive comercial; mais rápido | MIT (OpenVoice v2 + Piper) |
| `xtts` | quando o usuário quer a voz mais natural e o uso é pessoal | CPML: **só uso não comercial**. Diga isso em uma frase e deixe o usuário escolher |

## O que precisa (já vem com o Cérebro Pro)
- **Python para rodar o script:** qualquer um serve. Se o computador não tiver, use o que vem com o app: variável `SB_PYTHON` (no Windows: `& $env:SB_PYTHON voz_local.py ...`; no Linux/mac: `"$SB_PYTHON" voz_local.py ...`). Não instale Python no computador do usuário.
- **Ambiente da voz:** o script monta sozinho um ambiente próprio com Python 3.12 usando o `uv` do app (`SB_UV`) e instala tudo do **pacote nosso** (release `voz-local-v2` em `RangelTech/segundo-cerebro-artefatos`, conferido por sha256). Não precisa de git, PyPI nem compilador. Nunca rode `pip install torch` na mão nem troque versões: as versões travadas no script são as que funcionam juntas.
- **Espaço e tempo:** ~2,5 GB em `~/.segundo-cerebro/voz-local`, de 3 a 10 min uma vez só (depende da internet). O modelo do XTTS (~1,8 GB) baixa no primeiro uso dele.
- **Antes de tudo, confira:** `voz_local.py estado`. Se `ambiente`/`openvoice`/`xtts` vier `false`, rode `voz_local.py instalar --motor ambos` UMA vez e espere terminar (não rode duas instalações ao mesmo tempo). Avise o usuário: "vou preparar a voz no seu computador, leva alguns minutos e é uma vez só".
- Se a instalação falhar, mostre as últimas linhas do erro e pare: não invente outra forma de instalar.

## Passo a passo
1. `voz_local.py estado` (e `instalar` se precisar, ver acima).
2. **Amostra:** áudio limpo da voz (sem música, sem eco). 10 a 30 s já servem; até 2 min melhora. Converta: `ffmpeg -i entrada -ac 1 -ar 22050 amostra.wav`.
3. **Gerar:** `voz_local.py falar --texto "..." --amostra amostra.wav --saida Audios/fala.wav [--motor xtts]`. Texto longo ou com aspas: grave num .txt e use `--texto-arquivo fala.txt` (o próprio motor divide em frases).
4. **Rápido:** a primeira fala sobe um servidor local com o modelo na memória (de 20 s a 1 min); as seguintes só geram, sem recarregar modelo nem amostra. Então gere várias falas em sequência com a MESMA amostra. Ele fecha sozinho depois de 20 min parado (`voz_local.py parar` fecha na hora).
5. **Entregar:** a saída é uma linha JSON (`arquivo`, `segundos`, `tempo_s`). Entregue o caminho completo numa linha própria (o app toca o áudio no chat). MP3: `ffmpeg -i fala.wav -b:a 160k fala.mp3`.

## Trocar a voz de um áudio ou vídeo (mesmas palavras, outro timbre)
`python "<pasta da skill>/scripts/voz_local.py" trocar --entrada arquivo.mp4 --amostra amostra.wav --saida Videos/trocado.mp4`
Vídeo na entrada e `.mp4` na saída: devolve o vídeo com o áudio trocado. Saída `.wav`: só o áudio. Mantém ritmo e entonação, muda só o timbre (OpenVoice, rápido).
Reel narrado com animação, dublagem com texto novo e montagem completa: skill `reel-narrado`.

## Redublar um vídeo com a voz de alguém (sem créditos): use `redublar`
Ex.: "coloca a voz do Fulano neste reel". Só com autorização da pessoa dona da voz.
1. **Vídeo:** link → `yt-dlp` (o `cortes-de-video/scripts/cortes.py ferramenta` baixa o yt-dlp); Instagram logado: navegador integrado.
2. **Amostras:** TODOS os áudios de voz da pessoa que existirem (`navegador_whatsapp_baixar` com `tipo="audio"`, `de="contato"`, `limite=20`). Quanto mais, mais parecido: 30 s funciona, 1 a 3 min fica bem melhor. Se houver pouco áudio, diga ao usuário que pedir mais áudios melhora a semelhança.
3. **Escolha o modo (decide a qualidade):**
   - **O texto é o MESMO do vídeo** (só trocar quem fala): `--modo conversao`. Converte a fala original direto para a voz da amostra: ritmo, pausas e emoção ficam idênticos, sem frase robótica nem fora do tempo, e é muito mais rápido. É o melhor resultado local.
   - **Texto NOVO ou corrigido** (traduzir, mudar o que diz): modo padrão `texto` (abaixo). Cada frase é gerada pelo XTTS e depois passa pelo conversor de timbre (fica mais parecida com a voz real).
   - Nos dois modos a música original volta por baixo, e o fundo ABAIXA sozinho onde a pessoa falava, então o resto da voz antiga que a separação deixa não aparece mais ("voz antiga batendo com a nova", queixa real do usuário em 14/11/2026).
4. **Um comando faz tudo:**
   `python voz_local.py redublar --video original.mp4 --amostra a1.ogg --amostra a2.ogg ... --saida Videos/redublado.mp4 [--modo conversao]`
   - separa a voz da música do vídeo (Demucs) e também limpa as amostras (tira ruído/música);
   - transcreve as frases com o tempo de cada uma (faster-whisper);
   - gera CADA frase com a voz clonada (XTTS, o mais parecido) e encaixa no tempo da frase original;
   - devolve a MÚSICA ORIGINAL por baixo (sem ruído) e troca o áudio do vídeo.
   - Leva alguns minutos (1 min de vídeo ≈ 8 a 15 min em notebook). Rode em primeiro plano e acompanhe até o fim.
   - Palavra errada? Edite o `frases.json` indicado na saída e rode de novo com `--textos frases.json`.
5. **OUÇA antes de entregar:** transcreva o resultado (`transcrever`) e compare com o original; escute 3 trechos (início, meio, fim). Voz pouco parecida = peça mais áudios da pessoa (1 a 3 min limpos) e rode de novo.
6. **Acabamento (ofereça):** "Quer que eu coloque o @ dele, uma moldura fina e uma chamada no fim, tipo 'digita IA nos comentários'?" → skill edicao-profissional, comando `acabamento`.
7. Entregue o MP4 (caminho completo) e diga com honestidade: sem sincronia labial (boca acompanhando só no Estúdio, em créditos).
- `trocar` (OpenVoice) é o atalho rápido: mantém a fala original e só muda o timbre, mas fica MENOS parecido e passa o ruído da música junto. Use só para teste rápido ou áudio sem música.

## Transcrever com tempo por palavra
`python voz_local.py transcrever --audio video.mp4 --saida palavras.json` → `[{"t": início, "f": fim, "w": palavra}]` (local, ~2x mais rápido que a duração). Base da legenda e da edição (skill edicao-profissional).

## Expectativa (diga ao usuário)
- Em CPU, com o servidor já de pé: OpenVoice ~1x o tamanho do áudio, XTTS 2x a 4x. A primeira fala demora mais (carrega o modelo).
- A semelhança depende da amostra: quanto mais limpa e longa, melhor.
- Só clone a voz do próprio usuário ou de quem autorizou.

## Qualidade da voz clonada (OpenVoice é o motor principal)
O OpenVoice V2 é o caminho para a voz ficar igual à da pessoa, aqui no computador e sem custo. O script já faz o que mais melhora a semelhança:
- lê a voz da amostra só nos trechos com fala (sem silêncio nem música), em pedaços de 10 s, e faz a média;
- na troca de timbre (`--modo conversao`), passa duas vezes pelo conversor.
O que ainda depende de você: amostra LIMPA (sem música, sem eco), 1 a 3 min no total, várias falas da mesma pessoa. Amostra ruim = voz menos parecida. Ouça o resultado antes de entregar; se não convencer, peça mais áudios em vez de mudar de motor.

## Quando ir para o Estúdio (créditos)
Dublagem com a boca acompanhando (sincronia labial), voz de altíssima qualidade para comercial, ou computador fraco (menos de 8 GB de RAM livre: o XTTS não carrega). Diga "seu computador não tem potência para isso; posso fazer na nuvem por X créditos". Use `midia_orcar` e mostre o preço antes.
