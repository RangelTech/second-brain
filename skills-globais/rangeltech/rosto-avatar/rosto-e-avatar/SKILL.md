---
name: rosto-e-avatar
description: Troca de rosto, reencenação e avatar em vídeo (FaceFusion, LivePortrait, DeepFaceLive) e conversão de voz (RVC, OpenVoice). Só com o rosto e a voz da própria pessoa ou de quem consentiu por escrito.
---

# Rosto e avatar

## Regra de uso (sempre primeiro)
Use **somente** com o rosto e a voz da **própria pessoa** ou de quem deu **consentimento por escrito**. Exemplo legítimo: o dono de uma agência gravando comerciais com o próprio rosto e voz.

**Recuse:** personificar terceiro sem consentimento, conteúdo íntimo, golpes, verificação de identidade falsa e qualquer situação em que a outra ponta não saiba e a decisão dependa de quem está ali. Se não está claro de quem é o rosto ou a voz, pergunte antes de começar.

Ao publicar, use o rótulo de conteúdo sintético/IA que cada plataforma de anúncio exige.

## Ferramentas abertas (nenhuma foi medida na campanha pública de GPU)
- **FaceFusion:** troca de rosto em vídeo e imagem. Boa para gravação offline.
- **LivePortrait:** reencenação (anima uma foto com o movimento de um vídeo).
- **DeepFaceLive:** troca em tempo real; costuma exigir Windows com GPU NVIDIA.
- **RVC** e **OpenVoice:** conversão de voz (skill `openvoice` para o fluxo completo).
- **DeepFace (biblioteca)** só serve para embeddings e similaridade offline; não é o DeepFaceLive.

Como não há medição pública, apresente como "a validar": rode um teste curto num MP4 de 10 s, meça fps e qualidade, e só então decida o motor.

## Princípios que evitam problema
1. **Benchmark antes de escolher o motor** (um arquivo curto, a mesma entrada para todos).
2. **720p antes de 1080p; latência antes de perfeição em chamada ao vivo.** Qualidade máxima é modo de gravação offline.
3. **Fail-closed:** se o rastreamento ou a voz falhar, nunca repasse o rosto ou a voz originais por engano: congele o último quadro bom ou silencie.
4. **Sincronia áudio e vídeo** por timestamps; deriva alvo de 100 a 150 ms.
5. **Dados sensíveis fora do git:** fotos de rosto, modelos de voz e gravações nunca vão para repositório.
6. Onde rodar: na máquina do usuário se houver GPU suficiente; senão, GPU alugada pela skill `gpu-barata` (avise o custo e desligue ao terminar).
