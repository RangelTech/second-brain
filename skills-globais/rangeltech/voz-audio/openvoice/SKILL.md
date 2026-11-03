---
name: openvoice
description: OpenVoice (MIT, alternativa aberta ao ElevenLabs): converter uma voz em outra ("transforma esta voz nesta outra") e falar um texto com a voz de um áudio de referência. Só com voz própria ou consentida.
---

# OpenVoice: conversão de voz e fala com voz de referência

## Regra de uso (leia primeiro)
Use somente com a **própria voz** ou a de quem deu **consentimento por escrito** (por exemplo, o dono da agência gravando comerciais com a própria voz). **Recuse** imitar terceiros sem consentimento, golpes e conteúdo íntimo. Se o pedido não deixa claro de quem é a voz, pergunte antes.

## Quando usar
- "Transforma esta voz nesta outra": recebe um áudio de origem e um de referência e devolve o áudio de origem com o timbre da referência.
- "Fala este texto com a voz deste áudio": gera a fala (MeloTTS) e aplica o timbre da referência.

Para outras necessidades de voz, a campanha mediu: **F5-TTS** (síntese com clonagem, RTF 0,04 a 0,07 em GPU), **faster-whisper** (transcrição), **RVC** (conversão). Escolha pelo pedido.

## O que a campanha mediu do OpenVoice (classe: medido)
- CPU local (i7-1355U): MeloTTS RTF 6,46; conversão RTF 0,93; extração da voz de referência 111 s.
- GPU (RTX 3090): a instalação travou no `unidic` do MeloTTS; precisa também de `whisper-timestamped` e `wavmark`. Por isso, na dúvida, rode em **CPU** (funciona, mais lento que o tempo real para síntese) ou valide o ambiente de GPU antes (skill `gpu-barata`).
- Licença: MIT (código). Confira a licença dos pesos baixados.

## Passo a passo
1. Os dois áudios chegam anexados no chat (caminhos entregues pelo app). Confirme com o usuário de quem é cada voz e o consentimento.
2. Prepare: converta para WAV mono 16/22 kHz e corte silêncio longo (`ffmpeg -i entrada.webm -ac 1 -ar 22050 -af silenceremove=1:0:-50dB saida.wav`).
3. Instale uma vez (CPU basta): `pip install git+https://github.com/myshell-ai/OpenVoice.git` e baixe os pesos V2 conforme o README do repositório para `checkpoints_v2/` (https://github.com/myshell-ai/OpenVoice).
4. Rode `python converter_voz.py --origem origem.wav --referencia referencia.wav --saida convertido.wav` (script desta pasta).
5. Entregue o áudio no chat (o app mostra o player) e salve na pasta de trabalho. Informe o tempo gasto e se rodou em CPU ou GPU.

## Armadilhas
- Referência com ruído ou música estraga o timbre: use 10 a 30 s de fala limpa.
- Primeira execução baixa modelos (alguns minutos).
- Não prometa qualidade de estúdio: avise que é um modelo aberto e ofereça comparar com a saída original.
