---
name: gerar-video-ia
description: |
  Gerar vídeo por IA de uma cena real (um balão subindo no céu, um cachorro correndo, comida, produto, pessoas) com a ferramenta midia_gerar_video. Use SEMPRE que o usuário pedir "um vídeo de" algo com imagem real. Não use video-motion, Remotion nem HyperFrames para isso: eles são só para motion graphics com texto.
---

# Gerar vídeo por IA (midia_gerar_video)

## Regra
- "Um vídeo de um balão", "faz um vídeo de um gato", "vídeo do meu produto girando": chame `midia_gerar_video` com o prompt em inglês (cena, movimento, câmera, luz). Formato paisagem, retrato ou quadrado; 2 a 6 segundos, sem áudio.
- Animação com texto, título, legenda, gráfico, vinheta ou reel com legenda: aí sim, skill video-motion, e só se o usuário pedir isso.
- A tela mostra sozinha a fila, o percentual e o resultado. Não repita isso na resposta; no fim, diga em uma frase onde o arquivo ficou.

## Se não der
Se a ferramenta falhar ou o recurso estiver indisponível, NÃO improvise outro tipo de vídeo. Responda em português simples: "Não consegui gerar o vídeo agora. Quer que eu tente de novo em instantes?". Sem falar de servidor, GPU, fila ou erro técnico.

## Receita de verificação (Receita testada)
1. Peça: "um vídeo de um balão subindo no céu".
2. Confira que o agente chamou `midia_gerar_video` (cartão "Gerando o seu vídeo..." na conversa) e que NÃO abriu video-motion, Remotion, HyperFrames, terminal nem escreveu código.
3. Com o gerador no ar: o MP4 sai em Videos e mostra um balão (abra um quadro do meio e olhe). Com o gerador fora do ar: o agente avisa que não pôde gerar e oferece tentar de novo, sem inventar outro vídeo.
4. Simulação sem servidor: iniciar o app com `SB_MIDIA_MOCK=1` (ou `fail` para o caso de erro) e `SB_MIDIA_MOCK_ARQ=<um mp4>`.
