---
name: video-motion
description: |
  Produzir vídeo e motion graphics com código usando Claude Code + Remotion (React) ou
  HyperFrames (HTML/GSAP): animações em função do frame, render determinístico, reel
  vertical com gravação do rosto embaixo + animações sincronizadas com a fala + legenda
  palavra a palavra. Também cobre baixar e assistir reel do Instagram a partir do link
  (yt-dlp + plugin claude-video-vision). Use quando o usuário pedir "animação com o
  Claude", "motion graphics", "reel com legenda animada", "Remotion", "HyperFrames",
  "legenda animada", "plano de cenas", ou mandar link de reel/Instagram para assistir.
---

> **Quando NÃO usar esta skill:** pedido de "vídeo de [cena, objeto, pessoa, animal, produto]" (conteúdo visual real, como "um vídeo de um balão subindo no céu") NÃO é motion graphics.
> Esse pedido vai SEMPRE para a ferramenta de geração de vídeo por IA, `midia_gerar_video` (mcp-midia). Esta skill só serve para animação gráfica com texto, títulos, legendas,
> gráficos e vinhetas, e apenas quando o usuário pedir isso explicitamente. Se a geração de vídeo por IA estiver indisponível, não improvise com esta skill: avise, em português
> simples, que o vídeo não pôde ser gerado agora e ofereça tentar de novo.


# video-motion

Técnica: o vídeo é uma função do número do frame. Sem relógio, sem `Math.random`.
Um Chrome headless busca cada frame, o FFmpeg junta em MP4. O frame 42 sai igual toda vez.

## 0. Assistir vídeo de link do Instagram

O plugin `claude-video-vision` só lê arquivo local ou YouTube. Para Instagram, baixar antes:

```bash
python -m pip install -U yt-dlp          # uma vez (já instalado em 30/10/2026)
python -m yt_dlp -o "<pasta>/%(id)s.%(ext)s" "<link sem query string>"
```

Depois `video_watch` no .mp4 (frames + transcrição Whisper local).

- Reel público baixa sem login. Post privado exige `--cookies-from-browser chrome`: só com autorização do Lucas.
- A saída do `video_watch` estoura o limite (~25k tokens) em vídeo de mais de 1 min: a transcrição vem inteira, os frames vêm cortados. Para ver um trecho, usar `start_time`/`end_time` ou `view_sample`.
- Baixar para o scratchpad da sessão, nunca para dentro do projeto.

## 0.5. Caminho curto sem Node nem Remotion (use primeiro para título, subtítulo e legenda)

Para um vídeo de **título animado + subtítulo + legenda palavra por palavra** (reel, vinheta, story), use o script desta skill, que só precisa de Python com Pillow e FFmpeg. Não precisa de Node, Remotion nem GPU:

```
python <pasta-da-skill>/scripts/titulo_animado.py --titulo "FEIRÃO JUCA" --subtitulo "Ofertas de fim de ano"   --legenda "Condições especiais só até dezembro" --duracao 8 --formato 9x16 --saida video.mp4
```

Formatos: `9x16` (1080x1920), `16x9` (1920x1080), `1x1` (1080x1080). Cores: `--fundo-topo`, `--fundo-base`, `--destaque`. Os quadros vão direto ao FFmpeg (sem pasta de frames). Salve o MP4 em `Videos/` da pasta de trabalho e diga o caminho e a duração real (`ffprobe`).

### Receita testada (VM Linux de cliente, 05/11/2026)

Pedido: reel 9:16, 8 s, fundo azul-marinho com degradê, título "FEIRAO JUCA" com fade e subida, subtítulo e legenda palavra por palavra. O agente entregou certo (H.264, 1080x1920, 30 fps, 8,000 s, 194 KB; conferido por quadros em 0,5 s, 1,5 s, 3 s, 5 s e 7,5 s), mas escrevendo tudo do zero levou **24 min e 550 mil tokens**. O script acima nasceu desse resultado e gera o mesmo vídeo em segundos.

- **Onde está o FFmpeg.** Na VM não há `ffmpeg` no PATH. O Hermes traz um em `<dados>/hermes/tools/ffmpeg-<versão>-linux-x64/bin/ffmpeg` (no Windows, em `%APPDATA%/SegundoCerebro/hermes/tools/`); o script já procura ali. Sem root, não tente `apt install`.
- **Acentos.** O pedido veio "FEIRAO" e o agente grafou "FEIRÃO" (corrigiu para o português certo). Se o cliente exige a grafia exata, siga o pedido literal e avise.
- **Fonte.** Use uma fonte Bold do sistema (Liberation ou DejaVu no Linux, Arial no Windows). Fonte inexistente é o primeiro erro ao renderizar texto com Pillow.
- **Texto que não cabe.** O script reduz o título se passar de 92 % da largura. Em 9:16 mantenha o texto no terço central; a interface do Instagram cobre o topo e a base.
- **Confira de verdade.** Extraia quadros do MP4 final (`ffmpeg -ss 1.5 -i video.mp4 -frames:v 1 q.png`) e olhe; não declare pronto só porque o arquivo existe.
- **Peso do render.** 240 quadros em Pillow no CPU da VM de 4 vCPU gastam alguns minutos no agente escrevendo código, mas segundos de CPU de render.

Ainda não testado: Remotion e HyperFrames na VM (exigem Node e Chrome; o `node` não está no PATH da VM), vídeo com áudio e com a gravação do rosto (receita B).

## 1. Escolha da ferramenta

| | Remotion | HyperFrames (HeyGen) |
|---|---|---|
| Escreve | componentes React | HTML + CSS + GSAP |
| Build | bundler | nenhum |
| Licença | grátis até 3 pessoas; 4+ pessoas/empresa exige licença paga | Apache 2.0 |
| Requisitos | Node | Node 22+ e FFmpeg |

Padrão: Remotion quando houver gravação + legenda + muitas cenas (esse tipo de reel usa isso).
HyperFrames quando for motion puro e simples, ou se a licença do Remotion for problema
(confirmar em remotion.pro/license antes de uso comercial).

### Remotion
```bash
npx create-video --yes --blank meu-video
cd meu-video
npx remotion skills add        # skills oficiais (remotion-best-practices, -captions, -render...)
npm run dev                    # preview, um terminal
claude                         # outro terminal, na mesma pasta
```
Conceitos: `useCurrentFrame()`, `useVideoConfig()`, `<Composition>`, `<Sequence from>`,
`<OffthreadVideo>`, `interpolate`, `spring`. Render: `npx remotion render`.

### HyperFrames
```bash
npx hyperframes init meu-video
npx hyperframes preview
npx hyperframes render
npx skills add heygen-com/hyperframes
```
Clipe = HTML com `data-start`, `data-duration`, `data-track-index`. Timeline GSAP pausada em
`window.__timelines`. Skill `/remotion-to-hyperframes` converte entre os dois.

## 2. Receita A: motion puro (reel 2 do estudo)

1. Sair do chat, abrir o Claude Code numa pasta vazia (quem renderiza é o Claude Code, o chat só mostra prévia).
2. Descrever a cena como diretor: tipografia cinética, transição suave entre formas, 3D, câmera, duração em segundos.
3. Pedir cada elemento como conta em função do frame (determinístico).
4. Render a 60 fps.
5. Ajustar falando ("transição mais suave", "troca a cor", "desacelera esse trecho"). Claude mexe no código.
6. Bônus: pedir versão vertical recompondo cada cena, não cortando o meio.

## 3. Receita B: gravação + animações sincronizadas (reel 1 do estudo)

Layout 1080x1920: animação em cima (50%), gravação embaixo (50%), legenda por cima.
É uma composição só; a gravação vira camada, nada é desenhado "depois".

Fluxo:
1. O usuário grava o vídeo (mp4).
2. Whisper gera JSON com palavra + início + fim (o plugin de vídeo já tem Whisper local).
3. Claude lê a transcrição e os frames e escreve `scenes.json`: trecho da fala, timestamp, descrição visual.
4. **Mostrar o plano e esperar aprovação do usuário antes de gerar código ou renderizar.** Evita gastar token e tempo numa animação descartada.
5. Claude gera um componente React por cena (`interpolate`/`spring` dentro).
6. Render único junta tudo.

Esqueleto:
```tsx
export const Reel = ({ words, scenes, videoSrc }) => (
  <AbsoluteFill style={{ background: "#000" }}>
    <div style={{ height: "50%" }}>
      {scenes.map((s) => (
        <Sequence key={s.id} from={s.startFrame} durationInFrames={s.durFrames}>
          <s.Component />
        </Sequence>
      ))}
    </div>
    <div style={{ position: "absolute", bottom: 0, height: "50%" }}>
      <OffthreadVideo src={videoSrc} />
    </div>
    <Captions words={words} />   {/* destaca a palavra do frame atual */}
  </AbsoluteFill>
);
```
`startFrame = Math.round(segundo * fps)`. O mesmo JSON de palavras alimenta a legenda e o plano de cenas.

Alternativa: renderizar só a animação com alpha (ProRes 4444 ou WebM) e compor no CapCut/Premiere.
Mais simples para quem já edita, mas perde a sincronia automática com a legenda.

## 4. Regras de trabalho

- Plano de cenas aprovado antes de render. Sempre.
- Animação sempre em função do frame; proibido relógio e aleatório sem seed.
- Render de teste curto (poucos segundos) antes do completo.
- Arquivos de projeto de vídeo ficam em pasta própria; vídeo baixado de terceiros só serve de estudo, não republicar.

## 5. Estado e fontes

Só estudado e documentado em 30/10/2026; nenhum projeto de vídeo montado ainda. Próximo passo
combinado: esqueleto Remotion com Whisper, layout 1080x1920, legenda e uma cena de exemplo.

Fontes: remotion.dev/docs/ai/claude-code, remotion.dev/docs/ai/skills, remotion.dev/docs/the-fundamentals,
remotion.pro/license, github.com/heygen-com/hyperframes.
Reels estudados: instagram.com/reel/DeNUYLkRWsz e instagram.com/reel/DeH6c8ik5rL.
