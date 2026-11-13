---
name: estudio
description: |
  Roteiro do Estúdio (criação de vídeo, voz e imagem de ponta, com preço mostrado antes): trocar a pessoa de um vídeo, trocar carro, roupa, óculos ou cenário, foto que fala, sincronia labial, narração com voz clonada, vídeo de cinema. Use depois que a skill escolher-motion-ou-estudio indicar Estúdio.
---

# Estúdio

## Imagem e foto do usuário (não é Estúdio)
Editar ou criar **imagem** ("me veste de terno", "troca o fundo desta foto", "põe meu rosto neste cartaz") usa `midia_gerar_imagem` com `referencias` (caminhos das fotos): não gasta crédito, conta na cota de imagens do plano, e não precisa de orçamento.

## Roteiro fixo (não pule passos)
1. **Entender o pedido** com no máximo 3 perguntas curtas (só o que falta): qual vídeo/foto, o que muda, formato (9:16 para reel).
2. **Conferir os arquivos**: duração do vídeo (`ffprobe`), tamanho (até 40 MB; se passar, reduza com FFmpeg ou o Editor antes). Para trocar pessoa, rode `midia_conferir_troca`.
3. **Orçar**: `midia_orcar` com o efeito e a duração real. Mostre ao usuário numa frase, em **créditos**: "Fica 125 créditos (você tem 300) e leva uns 2 minutos. Posso criar?"
4. **Esperar o SIM.** Sem sim, não crie.
5. **Criar**: `midia_estudio` com `confirmado: true` (ou a ferramenta específica). Diga só: "Estou criando; aviso quando ficar pronto."
6. **Entregar**: quando o app avisar, mostre o arquivo e ofereça "Abrir no Editor" para cortar, legendar ou juntar (Motion, sem custo).

## Efeitos
| Efeito | Quando | O que mandar |
|---|---|---|
| `trocar-personagem` | trocar a pessoa do vídeo pela de uma foto (modelo, avatar, outra pessoa) | `video` + `fotos` (1 por pessoa, da esquerda para a direita) |
| `editar-video` | trocar objeto, carro, roupa, óculos, cabelo, cenário mantendo o movimento | `video` + `prompt` em inglês detalhado + `fotos` de referência (opcional) |
| `avatar-foto` | uma foto que fala | `fotos` (1) + `audio` ou `texto` |
| `sincronia-labial` | a boca acompanhar um áudio novo (barato) | `video` + `audio` |
| `sincronia-labial-pro` | sincronia de estúdio, rosto em close | `video` + `audio` |
| `voz` | narração; com `audio` de 3 a 25 s clona a voz | `texto` (+ `audio`) |
| `voz-hd` | narração premium | `texto` |
| `video-rapido` | vídeo curto de teste, 5 a 15 s | `prompt` (+ `fotos[0]` para animar uma foto) |
| `video-ponta` | vídeo bonito de 4 a 15 s | `prompt` (+ foto) |
| `video-premium` | cinema, comercial | `prompt` (+ fotos/vídeos de referência) |
| `video-google` | vídeo com som ambiente e fala | `prompt` |
| `imagem-ponta` | imagem com qualidade máxima (o comum é `midia_gerar_imagem`) | `prompt` |

## Prompt (para editar-video e vídeos novos)
Em inglês, 40 a 120 palavras: o que trocar e por quê, o que manter ("same camera angle, same motion, same lighting, keep the background"), aparência do novo elemento (marca, cor, ano, material), estilo. Para roupa: "the man now wears a tailored navy blue suit with white shirt and silk tie, keep his face, hair and gestures".

## Vídeo longo
- Modelos que **criam** vídeo fazem até 15 s por vez: para mais, gere partes e junte no Editor.
- `trocar-personagem` e `sincronia-labial` aceitam o vídeo inteiro (o preço cresce com a duração).
- `editar-video` trabalha em partes de até 15 s: orce com a duração total (o orçamento já diz quantas partes), corte o vídeo com FFmpeg em partes iguais de até 15 s (`ffmpeg -i in.mp4 -c copy -f segment -segment_time 15 -reset_timestamps 1 parte-%02d.mp4`), crie cada parte com o mesmo prompt e junte na ordem (`ffmpeg -f concat`) ou no Editor.
- Se o orçamento vier "acima do valor normal", diga isso com clareza e ofereça uma versão menor (480p ou trecho mais curto).

## Regras
- Preço sempre antes, em créditos (o valor em reais é só referência). Nunca diga nome de fornecedor, "IA", "modelo" ou "GPU".
- Faltam créditos: diga quanto falta; o app mostra o botão de comprar. Não insista em criar.
- Se der erro de saldo ou "em breve", diga em uma frase que o Estúdio está indisponível agora e ofereça editar com o Motion.
- Falhou: nada é cobrado. Tente de novo uma vez; na segunda falha, pare e explique.
- Pessoa real em vídeo: o usuário declarou nos termos que tem autorização; não peça de novo, não julgue.
