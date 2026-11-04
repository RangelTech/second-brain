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
