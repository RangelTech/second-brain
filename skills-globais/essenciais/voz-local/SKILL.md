---
name: voz-local
description: |
  Voz clonada e narração NO COMPUTADOR DO USUÁRIO, de graça (sem créditos): o usuário manda uma amostra da voz dele (áudio de 10 s a 5 min) e o agente gera falas novas com essa voz, em português do Brasil, para narração, vídeo, mensagem de áudio, dublagem simples. Dois motores: OpenVoice v2 + Piper (livre para uso comercial) e XTTS v2 (mais natural, só uso não comercial). Use quando o usuário pedir "fala isso com a minha voz", "narra com a minha voz", "clona minha voz", "faz um áudio com a minha voz", ou quando a dublagem/voz do Estúdio (créditos) não for necessária.
---

# Voz local (sem créditos)

Tudo roda no computador do usuário. Somos amigos dele: o que dá para fazer aqui, fazemos de graça; o Estúdio (créditos) fica para o que o computador não aguenta ou quando ele quer o resultado de ponta (voz `heygen`/dublagem com sincronia labial).

Script: `scripts/voz_local.py` desta skill. Os modelos vêm do snapshot nosso (`RangelTech/segundo-cerebro-artefatos`, release `voz-local-v1`), conferidos por sha256; a origem oficial é só plano B.

## Escolher o motor
| Motor | Quando | Licença |
|---|---|---|
| `openvoice` (padrão) | uso livre, inclusive comercial; mais rápido | MIT (OpenVoice v2 + Piper) |
| `xtts` | quando o usuário quer a voz mais natural e o uso é pessoal | CPML: **só uso não comercial**. Diga isso em uma frase e deixe o usuário escolher |

## Passo a passo
1. **Instalar (uma vez, alguns minutos, ~2 GB; o XTTS baixa mais ~1,8 GB no primeiro uso):**
   `python "<pasta da skill>/scripts/voz_local.py" instalar` (e, se for usar o XTTS, também `instalar --motor xtts`).
   Avise antes: "vou preparar a voz no seu computador, leva alguns minutos e é uma vez só".
2. **Amostra:** peça um áudio limpo da voz do usuário (sem música, sem eco). 10 a 30 s já servem; até 5 min melhora. Se vier em vídeo ou outro formato, converta: `ffmpeg -i entrada -ac 1 -ar 22050 amostra.wav`.
3. **Gerar:**
   `python "<pasta da skill>/scripts/voz_local.py" falar --texto "..." --amostra amostra.wav --saida Audios/fala.wav [--motor xtts]`
   Texto longo: divida em frases ou parágrafos (até ~400 caracteres cada), gere em partes e junte com `ffmpeg -f concat`.
4. **Conferir e entregar:** a saída é uma linha JSON (`arquivo`, `segundos`, `tempo_s`). Entregue o caminho completo numa linha própria (o app toca o áudio no chat). Para MP3: `ffmpeg -i fala.wav -b:a 160k fala.mp3`.

## Expectativa (diga ao usuário)
- Em CPU leva de 1 a 3 vezes o tamanho do áudio (o XTTS é mais lento). Uma narração de 1 minuto pode levar alguns minutos.
- A semelhança depende da amostra: quanto mais limpa e longa, melhor.
- Só clone a voz do próprio usuário ou de quem autorizou.

## Quando ir para o Estúdio (créditos)
Dublagem de vídeo com a boca acompanhando (sincronia labial), voz de altíssima qualidade para comercial, ou computador muito fraco. Use `midia_orcar` e mostre o preço antes.
