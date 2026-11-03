---
name: escolher-ferramenta
description: Dado um objetivo (gerar imagem, transcrever, clonar voz, detectar objeto, servir LLM), qual ferramenta usar e qual não.
---

# Escolher a ferramenta pelo objetivo

Pergunte: o que o usuário quer entregar? Depois escolha entre as ferramentas **ADOTAR**; só use as de **TESTAR** com um teste curto antes; **ESTUDAR** é ideia, não produto; **DESCARTAR** não use.

## Adotar
- **ByteTrack** (visao-cameras): Tracker. 50-62 fps (YOLO11 + ByteTrack, 4090). MIT.
- **COLMAP** (3d-fotogrametria): SfM/MVS padrao. pycolmap-cuda12 instala com CUDA; mapeamento NOT_TESTED por falta de dataset. Licenca BSD.
- **Crawl4AI** (automacao-agentes): Crawler que entrega markdown/JSON limpo para LLM, com JS. Base de RAG e scrapers de dados publicos. Apache-2.0.
- **F5-TTS** (voz-audio): TTS com clonagem: RTF 0,04-0,07 na 5090/L40S. Voz propria/consentida.
- **faster-whisper** (voz-audio): STT. Quebra no ambiente CUDA13 (falha medida); usar o Whisper do vLLM.
- **GEPA** (llm-servir-modelo): Otimiza prompts/agentes por evolucao reflexiva com metrica. Rodar com nossos modelos para melhorar skills e aproximar o 9B do 27B. MIT.
- **Headroom** (llm-servir-modelo): Camada de compressao de contexto (60-95% menos tokens: logs, RAG, historico). Reduz custo de entrada do 27B e das conversas longas do atendi
- **mcptoon** (automacao-agentes): CLI que comprime em ~90% o contexto de ferramentas MCP e descobre ferramentas sob demanda. Nosso catalogo rt_* cresce; medir ganho. Apache-2
- **MediaMTX** (visao-cameras): Servidor/proxy RTSP para ingest. MIT.
- **onvif-zeep** (visao-cameras): Descoberta ONVIF de cameras. MIT.
- **OpenTelemetry (python)** (dados): Observabilidade/traces. Apache-2.0.
- **Playwright** (automacao-agentes): Automacao de navegador e testes E2E. Ja usado.
- **SAM 2** (visao-cameras): Segmentacao. 21,8 ms/imagem na 5090. Apache-2.0.
- **Ultralytics YOLO** (visao-cameras): Deteccao e tracking. YOLO11n 4.834 fps na 5090. AGPL: licenca comercial se embutir; alternativa permissiva a avaliar (RT-DETR/YOLOX).
- **vLLM** (llm-servir-modelo): Engine de servir o nosso LLM. Medido em 7 GPUs.

## Testar (promissor, medir antes)
- **3D Model Anything** (3d-fotogrametria): Captura iPhone LiDAR+fotos -> sala Three.js editavel (MIT no codigo; data/ e imagens fora). Candidato ao gemeo digital 2.5D do KI Vision; pr
- **Agent Reach** (automacao-agentes): Da aos agentes acesso a internet (X, sites). Util a pesquisa; revisar seguranca de cookies/credenciais.
- **animate (cth9191)** (video): Skill de animacao procedural em canvas->MP4 com browser headless+ffmpeg. MIT.
- **Awesome Design MD** (automacao-agentes): Colecao de design systems em markdown para o agente seguir. Teste A/B da spec.
- **BitNet (bitnet.cpp)** (llm-servir-modelo): Inferencia 1-bit em CPU. Modelos disponiveis sao pequenos (nao 100B); medir contra o 9B em CPU barata. Pode servir ao pool leve.
- **BoT-SORT** (visao-cameras): Tracker. 28-31 fps. MIT.
- **codebase-memory-mcp** (automacao-agentes): Indexa o repo em grafo de conhecimento consultavel pelo agente. Medir no luar_chatwoot (grande). MIT.
- **ComfyUI** (imagem): Orquestrador de workflows de imagem/video. Medimos diffusers como proxy; ComfyUI nao testado.
- **Concord MCP** (automacao-agentes): Faz agentes de harnesses diferentes (Claude Code, Codex) coordenarem e evitarem edicao sobreposta nos mesmos repos.
- **Design DNA** (imagem): Extrai o sistema de design de um site e aplica em outro. Usar so em sites nossos/autorizados.
- **Design.md** (automacao-agentes): Skill do Google Labs que gera o design.md do projeto. Teste A/B da spec.
- **Detectron2** (visao-cameras): Referencia de deteccao/mascara. Nao compila em torch2.8/CUDA13 (falha medida); usar Mask R-CNN do torchvision como proxy (medido).
- **Diagram Design** (imagem): Skill que gera diagramas claros (fluxos, sistemas). Documentacao do Lunar. Teste A/B previsto na spec.
- **FLUX.3 Klein** (imagem): Imagem/edicao 4K em ~8 GB via ComfyUI. Licenca flux-kommunity: ler antes de uso comercial. Benchmark GPU previsto.
- **get-brolls** (video): Coleta videos de apoio (b-roll) por roteiro. Fluxo de conteudo da agencia.
- **Graft** (automacao-agentes): Mapeia o codigo uma vez para o agente nao reexplorar a cada tarefa. Produtividade nos repos luar_*. MIT.
- **Grounding DINO** (visao-cameras): Deteccao por texto (open vocabulary). 45 ms na 5090. Apache-2.0.
- **HyperFrames** (video): Escreve HTML e renderiza MP4 deterministico (ffmpeg+chrome). Videos do Lunar B sem GPU. Apache-2.0.
- **Impeccable** (automacao-agentes): Skill de design; teste A/B da spec.
- **Litpage** (dados): Workspace self-hosted (paginas, bancos, IA) num processo Node+SQLite. Candidato a 'caderno' do cliente dentro do workspace do tenant; medir 
- **llama.cpp** (llm-servir-modelo): Inferencia com GGUF/CPU/pouca VRAM. Nao medido.
- **motionmaxxing** (video): Skill de video de motion graphics a partir de HTML/ffmpeg. Conteudo; Apache-2.0.
- **Obscura** (visao-cameras): Navegador headless em Rust para agentes/scraping, sem Chromium. Comparar RAM/tempo com Playwright. Cuidado: recurso antidetect pode violar t
- **Open Generative AI** (video): Estudio de imagem/video com 600+ modelos. Muitos via API paga; ver se roda local. O 'clone de Midjourney' da spec.
- **OpenVoice** (voz-audio): Clonagem/estilo de voz. Benchmark GPU previsto.
- **Qwen3.8 27B 4-bit abliterado (post 3090)** (llm-servir-modelo): 27B 4 bits (18,2 GiB) cabe em 24 GB: vale para pool pesado barato. Benchmark em RTX 3090 em andamento.
- **REA (Reverse Engineer Anything)** (automacao-agentes): Skill de engenharia reversa de telas (autorizadas) via Playwright/DOM. Util a migracao de UI; exige revisao de seguranca.
- **SGLang** (llm-servir-modelo): Engine alternativa ao vLLM. Ainda nao medido.
- **SUPRA-Tex** (imagem): Imagem->3D com textura PBR. Geracao, nao medicao: nao serve ao D5. Benchmark GPU previsto.
- **Taste Skill** (imagem): Skill de design; teste A/B da spec.
- **UI/UX Pro Max** (dados): Skill de design; teste A/B da spec.

## Estudar (ideia útil, não adotar direto)
- **AgOpenGPS** (llm-servir-modelo): Piloto automatico de trator (GPS). Fora do escopo. / Reclassificado: pode ser um app que o cliente sobe no workspace para o kernel aprender 
- **AirLLM** (llm-servir-modelo): Roda modelos enormes em GPU pequena com offload em camadas: lento, so lote offline. Nao serve a chat/API interativa.
- **AnyPS5** (llm-servir-modelo): Porta executaveis de PS5. Fora do escopo. / Reclassificado: pode ser um app que o cliente sobe no workspace para o kernel aprender a operar 
- **AutoHedge** (llm-servir-modelo): Agentes de fundo de investimento. Fora do negocio. / Reclassificado: pode ser um app que o cliente sobe no workspace para o kernel aprender 
- **Bugframe** (dados): Reportar bug desenhando na tela com screenshot+contexto. Util ao suporte; repo exato nao confirmado.
- **docker-android** (video): Emulador Android em Docker (QA de app). NAO usar para automatizar WhatsApp (viola termos).
- **drawDB** (dados): Editor de diagrama ER/SQL no navegador. AGPL: ferramenta interna.
- **Farm.js** (llm-servir-modelo): Framework full-stack. Nao precisamos trocar o stack. / Reclassificado: pode ser um app que o cliente sobe no workspace para o kernel aprende
- **Fincept Terminal** (llm-servir-modelo): Terminal financeiro. Fora do negocio. / Reclassificado: pode ser um app que o cliente sobe no workspace para o kernel aprender a operar (mod
- **Frigate** (visao-cameras): NVR com deteccao (comparador da arquitetura do KI Vision). MIT.
- **Getfy** (llm-servir-modelo): Checkout/area de membros (Laravel+Vue), 67 estrelas, sem licenca declarada. / Reclassificado: pode ser um app que o cliente sobe no workspac
- **Ghost** (llm-servir-modelo): CMS de publicacao. Ja temos luar_site. / Reclassificado: pode ser um app que o cliente sobe no workspace para o kernel aprender a operar (mo
- **Gods Eye View** (3d-fotogrametria): Simulador de satelite no navegador. Fora do escopo; licenca nao declarada. / Reclassificado: pode ser um app que o cliente sobe no workspace
- **Gumroad** (llm-servir-modelo): E-commerce pesado (Rails). Nao necessario; ja temos Mercado Pago. / Reclassificado: pode ser um app que o cliente sobe no workspace para o k
- **Kev (modelos de decisao)** (llm-servir-modelo): Modelos pequenos de decisao sobre bases Qwen (0.8B a 27B). Repo nao confirmado; olhar para o pool leve.
- **mautrix-whatsapp** (dados): Bridge WhatsApp para Matrix. AGPL e nao oficial.
- **NautilusTrader** (llm-servir-modelo): Motor de trading. Fora do negocio. / Reclassificado: pode ser um app que o cliente sobe no workspace para o kernel aprender a operar (modelo
- **NVIDIA PersonaPlex** (voz-audio): Voz full-duplex (fala e escuta ao mesmo tempo). So ingles hoje e NVIDIA Open Model License; interessante para atendimento por voz quando hou
- **OBLITERATUS** (llm-servir-modelo): Intervencao de abliteration em modelos. AGPL; so como ferramenta de pesquisa, aprovacao previa.
- **Open WebUI** (llm-servir-modelo): Interface estilo ChatGPT para modelos OpenAI-compativeis. Pode ser o chat de demonstracao da API; licenca propria com clausula de marca.
- **Open-LLM-VTuber** (llm-servir-modelo): Avatar animado com voz, visao e memoria local. Base para atendente com rosto; licenca propria.
- **OpenCodeReview** (dados): Revisao de codigo automatica; repo nao confirmado.
- **OpenCut** (video): Alternativa open source ao CapCut (editor de video). Cliente final poderia usar; pesado de integrar.
- **OSIRIS** (visao-cameras): Painel Next.js com mapa e camadas (voos, cameras, noticias). Referencia de UI do KI Vision; repo exato nao confirmado.
- **Paymenter** (llm-servir-modelo): Cobranca por assinatura/planos (PHP). Candidato a faturamento da API de tokens se nao quisermos construir; precisa gateway BR.
- **pg-jev** (llm-servir-modelo): Extensao Postgres: filtra/classifica linhas por condicao em linguagem natural (modelo System One). Ler repo e licenca antes.
- **PixelRAG** (automacao-agentes): Busca por aparencia de paginas renderizadas (RAG visual). Repo exato nao confirmado; util p/ documentos com tabelas/layout.
- **ReelMimic** (video): Analisa um video de referencia e produz outro no mesmo estilo via agentes. Conteudo da agencia.
- **Taipy** (llm-servir-modelo): Apps de dados Python. Ja usamos Metabase/Power BI. / Reclassificado: pode ser um app que o cliente sobe no workspace para o kernel aprender 
- **Train LLM From Scratch** (llm-servir-modelo): Pretreino+SFT/PPO/DPO/GRPO do zero em PyTorch (didatico, modelos de 13M). Nao serve para producao; serve a artigos.
- **Understand Anything** (dados): Skill que documenta/explica codebases; repo nao localizado.
- **Vibe-Trading** (llm-servir-modelo): Agentes de trading. Fora do negocio. / Reclassificado: pode ser um app que o cliente sobe no workspace para o kernel aprender a operar (mode
- **VoiceStudio** (voz-audio): Estudio de voz/TTS (candidato ao 'clone do ElevenLabs'); licenca a confirmar.
- **WA-AKG** (dados): Bridge WhatsApp nao oficial. Risco de bloqueio.
- **whatsmeow** (dados): Cliente WhatsApp nao oficial (Go). Risco de bloqueio/termos; preferir API oficial.
- **Xiryn** (automacao-agentes): Equipe de agentes, cada um com desktop Linux em Docker e controle por Telegram. Inspiracao para sandbox visual do Hermes; nao adotar.
- **xtool** (llm-servir-modelo): Compila apps iOS em Linux. So se tivermos app iOS. / Reclassificado: pode ser um app que o cliente sobe no workspace para o kernel aprender 
- **YOUPI PG v2** (llm-servir-modelo): Gateway UPI (India) que le SMS bancario. Nao ha equivalente seguro para Pix. / Reclassificado: pode ser um app que o cliente sobe no workspa

## Descartar
- **awesome-opus-5.5-games** (3d-fotogrametria): Lista de jogos feitos por IA.
- **awesome-opus5-5-videos** (video): Colecao de videos/prompts. Inspiracao.
- **brag** (automacao-agentes): Gera posts de divulgacao do projeto. Marketing.
- **Claude Ads** (dados): Auditoria de anuncios para agencia de trafego. Fora do produto.
- **FreeLLMAPI** (llm-servir-modelo): Roteia entre endpoints gratuitos de varios provedores. Nosso gateway ja faz fallback; uso gratuito nao serve a dados de cliente.
- **lemo-opuscar** (dados): Estilos de filme em codigo afinados para Claude Code. Conteudo/marketing, nao infraestrutura.
- **openGym** (visao-cameras): App de academia. Fora do escopo.
- **pix_brcode** (dados): Gera BR Code do Pix (Elixir). E CRC16+TLV simples; o Lunar ja gera cobranca pelo Mercado Pago. Nao concilia pagamento.
- **SwiftUI Pro** (automacao-agentes): Skill de SwiftUI. So se tivermos app iOS.
- **universal-modder** (imagem): Fluxo de agente para modar jogos (engenharia reversa). Fora do escopo.
- **Vorssaint utils** (dados): Utilitarios macOS. Fora do escopo.
- **yoinks** (video): Baixa video pelo terminal. Direitos autorais: nao usar em produto.
- **youtube-automation-agent** (automacao-agentes): Automacao de canal YouTube. Fora do produto.

Cada ferramenta tem a sua skill em `rangeltech/<área>/<ferramenta>` com licença, o que foi medido e o hardware necessário.


> Fonte: campanha de benchmark da Rangel Tech (26 a 28/10/2026). Preço de GPU muda: confira o preço do dia.
