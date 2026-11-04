---
name: frontend-premium
description: >
  Gerador de UI/UX premium para frontend (React/Next.js/TypeScript/Tailwind/
  shadcn). Transforma respostas de frontend em nivel Product Designer + Frontend
  Senior, evitando layouts genericos "cara de IA". Cobre stack preferencial
  (React, Next.js, TS, TailwindCSS, shadcn/ui, Framer Motion, Lucide Icons),
  ordem de decisao de componentes (projeto -> shadcn -> Magic UI -> Aceternity
  -> 21st.dev -> manual), regras de design (espacamento em multiplos de 8,
  bordas, sombras suaves, paleta slate/zinc/neutral, tipografia, botoes,
  cards, dashboards estilo Linear/Stripe/Vercel, landing pages, micro
  animacoes, tabelas, UX) e como usar MCPs (21st.dev/Magic, Context7,
  Browser/Playwright, Figma) quando disponiveis. Use sempre que for criar ou
  refatorar QUALQUER tela, componente ou landing page em React/Next.js/
  Tailwind — antes de escrever codigo de UI, carregue esta skill.
---

# Frontend Premium Generator (UI/UX Senior)

## Objetivo

Atuar como desenvolvedor Frontend Senior especializado em interfaces
modernas, evitando completamente layouts genericos. Prioridade: produzir
interfaces comparaveis as de Stripe, Vercel, Linear, Notion, Raycast, Arc
Browser, Supabase, Clerk, Resend, Framer, Airbnb.

**Nunca gerar interfaces com aparencia de template generico ou "cara de IA".**

## Filosofia

A UI deve parecer um produto SaaS de alto padrao. Antes de escrever qualquer
codigo, pensar como um Product Designer Senior. Sempre priorizar:
simplicidade, hierarquia visual, legibilidade, espacamento, consistencia,
micro animacoes, acessibilidade.

## Stack preferencial (nesta ordem)

1. React
2. Next.js
3. TypeScript
4. TailwindCSS
5. shadcn/ui
6. Framer Motion
7. Lucide Icons

Se existirem MCPs disponiveis, consultar antes de criar componentes proprios:
**21st.dev (Magic), Context7, Browser, Playwright, Figma** (ver secao "MCPs
gratuitos" abaixo para setup).

## Bibliotecas recomendadas

- **Obrigatoria**: shadcn/ui
- **Prioridade alta**: Magic UI, Aceternity UI, React Bits
- **Inspiracao**: 21st.dev, Mobbin, Landingfolio, Godly.website

## Ordem de decisao para qualquer componente

1. Existe componente pronto no projeto? **Use. Nunca recrie.**
2. Existe em shadcn? **Instale.**
3. Existe em Magic UI? **Use.**
4. Existe em Aceternity? **Use.**
5. Existe em 21st.dev? **Use.**
6. So entao desenvolver manualmente.

## Regras de design

**Espacamento** — apenas multiplos de 8: `8, 12, 16, 24, 32, 48, 64`. Jamais
espacamentos aleatorios.

**Bordas** — inputs `12px`; cards `16~20px`; dialogs `24px`.

**Sombras** — sempre muito suaves. Nunca sombras pesadas.

**Cores** — priorizar Slate/Zinc/Neutral. Evitar vermelho saturado, azul
muito forte, gradientes exagerados.

**Tipografia** — titulo `font-bold` 36~48px; subtitulo 18~22px; texto
15~16px. Jamais textos pequenos.

**Botoes** — sempre grandes, padding confortavel, hover elegante, transicoes
suaves. Jamais botoes quadrados.

**Cards** — padding generoso, boa hierarquia, icones discretos, muito espaco
em branco.

**Dashboards** — devem lembrar Linear, Stripe Dashboard, Vercel Analytics.
Nunca AdminLTE, Bootstrap, ou Material Dashboard antigo.

**Landing pages** — estrutura preferencial: Hero -> Social Proof -> Features
-> Screenshots -> Pricing -> FAQ -> CTA -> Footer.

**Micro animacoes** — sempre `opacity`, `translateY`, `scale`, `blur`,
duracao 200-350ms. Nunca animacoes exageradas.

**Icones** — sempre Lucide. Nunca misturar bibliotecas de icones.

**Responsividade** — pensar primeiro Desktop, depois Tablet, depois Mobile.
Nunca esconder problemas usando `overflow`.

**Inputs** — labels claras, helper text, estados hover/focus/error/
disabled/loading.

**Tabelas** — evitar tabelas gigantes; preferir Cards, Expandable Rows,
Drawer, Side Panel.

**UX** — sempre perguntar: o usuario entende? esta rapido? existe excesso de
informacao? pode remover algo?

## Nunca fazer

Cards coloridos sem necessidade; muito gradiente; muito brilho; botoes
gigantes fluorescentes; bordas quadradas; Bootstrap classico; Material
antigo; interfaces "de 2018"; menus enormes; 12 cores diferentes; emojis na
interface; texto centralizado sem motivo; tabelas infinitas.

## Critério final

Antes de finalizar qualquer tela, perguntar mentalmente: *"Se essa interface
estivesse na pagina inicial da Vercel ou da Stripe, ela pareceria
deslocada?"* Se sim, **refatore**.

## Objetivo maximo

Gerar interfaces que um usuario jamais suspeitaria terem sido produzidas por
IA — codigo com nivel de uma equipe experiente de Product Design + Frontend
Senior.

---

## MCPs gratuitos para UI (setup passo a passo)

Estes MCPs turbinam a skill: antes de criar um componente do zero, consulte-os.
Todos tem camada gratuita usavel. Configuracao via CLI do Claude Code (o mesmo
padrao vale pra Roo Code, trocando o client).

### 1. Magic UI MCP (`@magicuidesign/mcp`) — biblioteca de componentes prontos

Gera/busca componentes React reais (dashboard, pricing, hero, login, table,
charts, sidebar, navbar, cards) prontos pra colar. **100% gratuito, sem
conta/API key** — roda via `npx`.

1. Sem cadastro necessario.
2. Instalar (Claude Code):
   ```
   claude mcp add magicuidesign-mcp -- npx -y @magicuidesign/mcp@latest
   ```
   Roo Code (`mcp_settings.json` -> `mcpServers`):
   ```json
   "magicuidesign-mcp": {
     "command": "npx",
     "args": ["-y", "@magicuidesign/mcp@latest"],
     "disabled": false,
     "alwaysAllow": []
   }
   ```
3. (Opcional) instalar componentes direto no projeto via CLI:
   ```
   pnpm dlx @magicuidesign/cli@latest install roo-cline
   ```
4. Reiniciar o client. Testar pedindo: "busque um componente de dashboard no
   Magic UI".
5. Regra de uso: **sempre pesquisar antes de criar** — dashboard, pricing,
   hero, login, table, charts, sidebar, navbar, cards.

> Nota: existe tambem o Magic MCP do **21st.dev** (`@21st-dev/magic-mcp`),
> que exige conta + API key gratuita em https://21st.dev — alternativa caso
> precise do catalogo especifico do 21st.dev. Para uso keyless, prefira
> `@magicuidesign/mcp` acima.

### 2. Context7 — documentacao atualizada de libs (evita API inventada)

Puxa docs oficiais atualizadas de qualquer lib (React, Next.js, Tailwind,
shadcn, Framer Motion) direto no contexto, evitando alucinacao de API.

1. Sem conta obrigatoria para uso basico gratuito (rate limit generoso); para
   limites maiores, criar conta em https://context7.com e gerar API key.
2. Instalar:
   ```
   claude mcp add context7 -- npx -y @upstash/context7-mcp
   ```
   Com API key (opcional, mais limite):
   ```
   claude mcp add context7 -- npx -y @upstash/context7-mcp --api-key SUA_CHAVE
   ```
3. Reiniciar o client. Testar: "use context7 para ver a API atual do
   Framer Motion `useScroll`".
4. Regra de uso: **sempre consultar antes de usar biblioteca nova ou API
   pouco comum**. Nunca inventar props/hooks.

### 3. Playwright MCP — navegador real para inspecionar/testar

Abre um browser de verdade controlado por MCP: permite screenshot, inspecionar
DOM/CSS de sites de referencia (Linear, Stripe, Vercel) e rodar testes e2e.

1. Nenhuma conta/API key necessaria — 100% gratuito e local.
2. Instalar:
   ```
   claude mcp add playwright -- npx -y @playwright/mcp@latest
   ```
3. Na primeira execucao, o `npx` baixa os browsers do Playwright
   automaticamente (ou rode `npx playwright install` manualmente se travar).
4. Reiniciar o client. Testar: "abra https://linear.app e descreva o layout
   do hero".
5. Regra de uso: usar para **inspirar-se em referencias reais** (linear.app,
   vercel.com, stripe.com, raycast.com, notion.so) — nunca copiar
   literalmente, so estudar hierarquia/espacamento/animacoes.

### 4. Figma MCP (Dev Mode) — ler specs de design direto do Figma

Le frames/componentes de um arquivo Figma (medidas, cores, tipografia,
assets) direto no contexto, para bater 1:1 com o design.

1. Requer Figma Desktop app + plano com **Dev Mode** habilitado (free tier do
   Figma ja libera Dev Mode em arquivos de times gratuitos com limitacoes;
   verificar disponibilidade na conta).
2. Abrir o arquivo no Figma Desktop, ativar Dev Mode.
3. Instalar o servidor MCP oficial do Figma:
   ```
   claude mcp add figma -- npx -y figma-developer-mcp --figma-api-key=SUA_CHAVE
   ```
   A API key e gerada em Figma -> Settings -> Account -> Personal access
   tokens (gratuito).
4. Reiniciar o client. Testar: "leia o frame selecionado no Figma e gere o
   componente React equivalente".
5. Regra de uso: usar quando houver arquivo Figma do design real do produto —
   fonte de verdade de medidas/cores/tipografia.

### Resumo rapido (ordem de prioridade ao criar UI)

```
1. Componente ja existe no projeto?           -> usar
2. shadcn/ui tem?                              -> instalar
3. Magic UI / Aceternity tem?                  -> usar
4. Magic MCP (21st.dev) encontra pronto?       -> usar
5. API/hook de lib pouco comum?                -> checar no Context7 antes
6. Precisa referencia visual real?             -> Playwright MCP (linear/stripe/vercel)
7. Existe spec de design no Figma?             -> Figma MCP (Dev Mode)
8. Nenhuma opcao acima?                        -> desenvolver manualmente seguindo as regras de design desta skill
```
