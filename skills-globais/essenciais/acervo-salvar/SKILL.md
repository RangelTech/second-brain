---
name: acervo-salvar
description: |
  Acervo de técnicas que o Lucas manda no grupo "Salvar" do WhatsApp (reels, carrosséis, prints): como fazer animação com IA,
  modelagem e câmera em 3D (Blender) para vídeo de IA, avatar/personagem consistente, cortes e engenharia reversa de vídeo,
  trend-jacking, sites modernos e ferramentas abertas novas. Use quando for criar animação, corte, reel, site de venda ou
  escolher ferramenta de vídeo/imagem, e SEMPRE que o Lucas mandar material novo no Salvar (ler, extrair e acrescentar aqui).
---

# Acervo do grupo Salvar

## Como alimentar este acervo
1. Ler o grupo: ferramenta `whatsapp_ler` com `{"contato": "Salvar", "dias": N}` (o parâmetro `dias` rola a conversa para trás).
2. Links do Instagram: legenda pelas metatags públicas; vídeo com `yt-dlp` (reel público baixa sem login); transcrever o áudio.
3. Para cada post: o que ensina, como aplicar nos nossos produtos (Anima AI, Cortaí, Posta AI, Perfilaí, Atende AI, Rendaí, sites).
4. Técnica reaproveitável vira seção numa skill de tema (animação, Blender, cortes, sites) além de entrar aqui.

## Animação com IA
- **Estilos que viralizam** (reel "10 estilos de animação com o Claude"): pixel art, giz em quadro-negro (chalkboard), massinha (claymation),
  esboço a lápis, quadrinhos (comic art), vetor plano (flat vector), traço mínimo (minimal line), CGI em movimento, estilo LEGO.
  Um estilo bem escolhido + gancho forte já levou vídeo a centenas de milhares de views.
- **Fluxo "sem câmera" com personagens fixos** (theaicreatorcommunity): (1) folha de personagem (character sheet) de cada personagem
  com o modelo de imagem do GPT; (2) mostrar as folhas ao modelo diretor e pedir as cenas no estilo desejado (ex.: filme 35 mm granulado,
  flash duro na câmera, close com olho de peixe); (3) o diretor transforma cada cena num prompt do modelo de vídeo; (4) gerar com as
  folhas como referência **em modo rascunho primeiro** (bem mais barato) e só refazer em qualidade alta as tomadas boas; (5) montar e pôr
  música em alta.
- **Avatar consistente** (fluxo do "Google Studio"): imagem base do personagem → o GPT gera dezenas de ideias de cena → cada ideia vira
  imagem com a imagem base de referência (modelo de edição tipo Nano Banana) → cada imagem vira vídeo curto com a ação descrita → juntar
  e pôr música.
- **Vídeo com voz no mesmo passo** (LTX): modelos abertos já geram vídeo e fala juntos e mantêm o mesmo personagem, luz e voz entre cenas;
  roda local, sem crédito.
- **Fábrica de vídeo curto aberta** (MoneyPrinterTurbo e similares): tema → roteiro → imagens → narração → legenda → música, num fluxo só.
- Regra nossa: o GPT com o melhor modelo **só dirige** (roteiro e guia detalhado no começo); a produção vai pelo pipeline e pelo Qwen.

## 3D para controlar câmera e movimento
- Montar a cena com **formas simples no Blender** (de graça), pedindo ao agente (Claude/ChatGPT via ponte com o Blender) e renderizar um
  vídeo de referência; gerar imagens de referência dos personagens; mandar vídeo de referência + imagens ao modelo de vídeo, informando
  modelo, duração, resolução e proporção. Dá controle de câmera e de personagem que só texto não dá.
- Custo: usar vídeo de referência encarece a geração (a ordem de grandeza observada foi ~+17% na mesma plataforma); construir a cena
  consome pouco da cota do agente.
- Ver a skill `blender-cinematico` para gerar a cena com código.

## Cortes e engenharia reversa de vídeo
- **rea-video**: quebra um vídeo plano a plano e diz se cada plano foi filmado, gerado por IA ou feito em código, como legenda, cortes e
  áudio foram feitos e como refazer. Usar para "copiar a estrutura de um reel que viralizou" no Cortaí e no Anima AI.
- **Raea**: motor de edição/render controlado por IA (TypeScript, render na própria GPU) para vídeo, motion graphics e 3D.
- **Trend-jacking** (exemplo do GTA 6): aproveitar um lançamento cultural com comparação "onde você estava em 2013 x hoje" para marcas e
  perfis pessoais; janela curta (dias). Bom gancho de corte e de post.

## Sites
- Repositório **modern-web-guidance** do time do Chrome: pacote de orientação para agentes de código escreverem web do jeito atual
  (a IA aprendeu muito código antigo). Instalar como skill/regra do agente antes de fazer sites; o próprio time mediu ganho grande de
  acerto. Combinar com `sites-cinematograficos` e `frontend-premium`.

## Ferramentas abertas para ficar de olho
Modelo de imagem aberto que roda em GPU de 8 GB (MiniMax H3-Image), modelo de visão minúsculo (Mirage), clonagem de voz local em dezenas
de idiomas, Uniface (troca de rosto), agente Harvey, NVIDIA Locate, ABot-Recon (reconstrução 3D), coleções de ferramentas de red team.
Antes de usar qualquer uma: licença, custo, roda na nossa GPU (2x3090) ou no fallback.

## Registro de leituras
| Data | Posts | Destaques |
|---|---|---|
| 15/11/2026 | 20 (reels e posts de IA, animação, 3D, vídeo) | estilos de animação, Blender como referência, folhas de personagem + modo rascunho, avatar consistente, LTX, rea-video, modern-web-guidance |
