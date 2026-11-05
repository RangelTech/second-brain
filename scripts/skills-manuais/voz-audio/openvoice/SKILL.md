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
2. Prepare: converta para WAV mono e corte silêncio longo (`ffmpeg -i entrada.webm -ac 1 -ar 22050 -af silenceremove=1:0:-50dB saida.wav`). O FFmpeg do Hermes fica em `<dados>/hermes/tools/ffmpeg-*/bin/` (veja a skill `video-motion`).
3. Instale uma vez, com o script desta pasta (Python 3.10 isolado, sem tocar no Python do sistema):
   `python <pasta-da-skill>/instalar_openvoice.py --destino <dados>/hermes-home/cache/scratch/openvoice`
   Ele cria o venv, instala torch CPU + `requirements-cpu.txt`, instala o OpenVoice sem dependências e baixa os pesos do conversor do Hugging Face.
4. Rode: `<destino>/venv/Scripts/python <pasta-da-skill>/converter_voz.py --origem origem.wav --referencia referencia.wav --saida convertido.wav --checkpoints <destino>/checkpoints_v2` (no Linux, `venv/bin/python`).
5. Entregue o áudio no chat (o app mostra o player) e salve na pasta de trabalho. Informe o tempo gasto e se rodou em CPU ou GPU.

## Receita testada (Windows, CPU, 05/11/2026)

Pedido: converter um texto falado em português por uma voz feminina (Microsoft Maria, 17,7 s) para o timbre de uma voz masculina em inglês (Microsoft David, 18,3 s). Resultado conferido por medição: tom médio (F0) da origem 182 Hz, da referência 88 Hz e do convertido **92 Hz**, mesma duração da origem. Ou seja, a saída assumiu o timbre da referência e manteve o conteúdo.

- **Tempo:** a conversão levou 45 s em CPU (17,7 s de áudio, RTF perto de 2,5), mais 10 s para iniciar o conversor. O que demora é a primeira instalação: cerca de 900 MB de pesos e pacotes e mais de 30 min do agente até acertar o ambiente. Com o instalador a tarefa é de uma passada só.
- **Python 3.10, não o 3.14.** O OpenVoice tem dependências sem wheel para versões novas do Python. Use venv 3.10.
- **Não instale `requirements.txt` do projeto.** Ele trava `numpy==1.22` e outros que não existem para as plataformas atuais. Instale o pacote com `--no-deps` e a lista curada `requirements-cpu.txt`.
- **O link oficial dos pesos (S3 da MyShell) saiu do ar.** Use `https://huggingface.co/myshell-ai/OpenVoiceV2/resolve/main/converter/checkpoint.pth` (131.320.490 bytes) e `config.json`. Confira o tamanho depois de baixar.
- **O modelo de detecção de fala (silero-vad) é baixado do GitHub por `torch.hub`.** Em rede com inspeção de certificado a carga falha. Contorno: baixar o zip do repositório `snakers4/silero-vad` para `~/.cache/torch/hub/snakers4_silero-vad_master` (a pasta precisa ficar com `hubconf.py` na raiz, sem uma pasta extra no meio).
- **Caminhos no Windows com shell estilo Unix** (`/c/Users/...`) viram erro dentro do Python. Passe caminhos nativos (`C:/Users/...`) ao script. Um erro de digitação no caminho gerou um laço de tentativas: confira o caminho antes de repetir.
- **O que é clonado é o timbre**, não o sotaque nem a emoção: o português continua com a prosódia da origem. Avise o usuário.
- A conversão cega ao conteúdo: se a origem tiver ruído, o resultado também terá.

Ainda não testado: Linux sem root, GPU, e a síntese direta com MeloTTS (texto para voz com a voz de referência).

## Armadilhas
- Referência com ruído ou música estraga o timbre: use 10 a 30 s de fala limpa.
- Primeira execução baixa modelos (alguns minutos).
- Não prometa qualidade de estúdio: avise que é um modelo aberto e ofereça comparar com a saída original.
