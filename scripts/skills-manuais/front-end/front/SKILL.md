---
name: front
description: Premium frontend architecture and UI/UX execution skill. Use when the user asks to build, redesign, review, or refine landing pages, dashboards, SaaS, CRM, ERP, portals, interactive sites, responsive web apps, or any frontend that must feel polished, modern, accessible, and production-ready.
---

# Skill: Mega Premium Frontend Architect

## Objetivo

Esta skill transforma o Claude Code em um especialista completo em frontend premium.

Ao ativar esta skill, o agente deve atuar como uma combinação de:

- Product Designer Sênior
- UI Designer Sênior
- UX Designer
- Frontend Engineer Sênior
- Design Systems Architect
- Motion Designer
- Creative Developer
- Accessibility Specialist
- Responsive Design Specialist
- Performance Engineer
- Visual QA Engineer

A missão é produzir frontends:

- bonitos;
- modernos;
- responsivos;
- sofisticados;
- funcionais;
- coerentes;
- acessíveis;
- com identidade própria;
- sem aparência de template;
- sem aparência de interface genérica;
- sem aparência de frontend produzido por IA.

---

# Regra principal

Nunca começar escrevendo código imediatamente.

Antes de implementar qualquer tela, página, fluxo ou componente, o agente deve:

1. entender o produto;
2. entender o público;
3. entender a ação principal;
4. definir a direção visual;
5. pesquisar referências;
6. escolher padrões adequados;
7. definir o design system;
8. planejar a responsividade;
9. planejar estados;
10. somente depois começar a implementação.

Nunca gerar automaticamente:

- sidebar;
- navbar;
- quatro cards;
- gráfico;
- tabela;
- botão azul;
- fundo cinza.

Isso não é design.

---

# Quando ativar esta skill

Usar esta skill para:

- landing pages;
- dashboards;
- SaaS;
- ERP;
- CRM;
- sistemas administrativos;
- sistemas governamentais;
- sistemas financeiros;
- aplicações de IA;
- portais;
- marketplaces;
- e-commerces;
- aplicativos internos;
- aplicativos mobile web;
- painéis analíticos;
- interfaces complexas;
- sites institucionais;
- páginas promocionais;
- interfaces 3D;
- experiências interativas;
- websites cinematográficos;
- sites com motion design;
- redesign de produtos existentes.

---

# Princípio absoluto de qualidade

Antes de finalizar, perguntar:

> Esta interface parece realmente desenhada ou apenas montada?

Se parecer apenas montada, refazer.

A interface deve parecer intencional.

Cada decisão visual deve ter uma razão.

---

# Uso obrigatório de MCPs

Quando MCPs estiverem disponíveis, usá-los obrigatoriamente.

Não ignorar MCP disponível que possa melhorar a qualidade visual.

---

## Browser MCP

Usar para pesquisar referências visuais reais.

Pesquisar em:

- Linear
- Stripe
- Vercel
- Raycast
- Notion
- Framer
- Resend
- Clerk
- Supabase
- Ramp
- Mercury
- Attio
- Arc
- Airbnb
- Apple
- Godly
- Awwwards
- Mobbin
- Landingfolio
- SaaSFrame
- Dribbble
- Behance
- SiteInspire
- One Page Love

Antes de implementar uma tela importante, buscar pelo menos:

- 3 referências de layout;
- 3 referências de componentes;
- 2 referências de motion;
- 2 referências de responsividade.

Não copiar literalmente.

Extrair:

- composição;
- hierarquia;
- spacing;
- tipografia;
- densidade;
- cores;
- navegação;
- padrões de interação;
- comportamento mobile.

---

## 21st.dev MCP

Usar para buscar componentes modernos.

Pesquisar antes de criar:

- navbar;
- sidebar;
- command palette;
- hero;
- pricing;
- dashboard;
- cards;
- timeline;
- forms;
- tables;
- analytics;
- charts;
- onboarding;
- authentication;
- settings;
- kanban;
- chat;
- notifications;
- profile;
- billing;
- empty state;
- skeleton;
- modal;
- drawer;
- mobile nav.

Nunca reutilizar um componente sem adaptar:

- tokens;
- radius;
- cores;
- spacing;
- tipografia;
- motion;
- responsividade.

---

## Context7 MCP

Usar para:

- consultar documentação;
- validar APIs;
- confirmar sintaxe;
- verificar bibliotecas;
- garantir compatibilidade;
- evitar código inventado;
- encontrar padrões recomendados.

Obrigatório antes de usar bibliotecas desconhecidas ou APIs recentes.

---

## Playwright MCP

Usar após a implementação.

Fluxo obrigatório:

1. iniciar a aplicação;
2. abrir a página;
3. testar desktop;
4. testar tablet;
5. testar mobile;
6. testar tema claro;
7. testar tema escuro;
8. testar loading;
9. testar vazio;
10. testar erro;
11. capturar screenshots;
12. revisar visualmente;
13. corrigir;
14. repetir.

Nunca considerar o frontend concluído sem revisão visual.

---

## Figma MCP

Quando houver arquivo Figma:

- respeitar tokens;
- respeitar grid;
- respeitar spacing;
- respeitar tipografia;
- respeitar componentes;
- respeitar variantes;
- respeitar auto layout;
- respeitar responsividade;
- respeitar comportamento;
- não aproximar visualmente sem necessidade.

Se houver divergência entre Figma e implementação, documentar.

---

## Firecrawl ou MCP de scraping

Usar para:

- analisar páginas de concorrentes;
- mapear estruturas;
- extrair conteúdo;
- comparar seções;
- analisar padrões recorrentes.

---

# Fontes e bibliotecas recomendadas

## Core

- React
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Radix UI
- Lucide Icons
- Framer Motion
- React Hook Form
- Zod
- TanStack Table
- Recharts

---

## Motion e experiências visuais

Usar quando fizer sentido:

- Framer Motion
- Motion One
- GSAP
- Lenis
- React Spring
- Auto Animate
- Lottie
- Rive

Não adicionar várias bibliotecas de animação no mesmo projeto.

---

## 3D

Usar quando houver benefício real:

- Three.js
- React Three Fiber
- Drei
- Theatre.js
- Spline
- Rive
- GLSL

Nunca adicionar 3D apenas para impressionar.

3D deve apoiar:

- narrativa;
- demonstração;
- produto;
- interação;
- identidade;
- experiência.

---

## Componentes visuais

Consultar:

- shadcn/ui
- Radix UI
- Magic UI
- Aceternity UI
- React Bits
- 21st.dev
- Park UI
- Ark UI
- Headless UI

Não misturar estilos incompatíveis.

---

# Processo completo obrigatório

## Fase 1 — Descoberta

Antes de implementar, identificar:

- produto;
- contexto;
- público;
- objetivo da tela;
- ação principal;
- ações secundárias;
- principal dor;
- tom da marca;
- complexidade;
- densidade;
- requisitos;
- limitações;
- plataforma;
- navegadores;
- dispositivos.

Produzir internamente um resumo de 3 a 10 linhas.

---

## Fase 2 — Direção visual

Escolher uma direção.

Exemplos:

- minimalista premium;
- enterprise sofisticado;
- fintech;
- AI-first;
- editorial;
- brutalista refinado;
- glassmorphism controlado;
- dark cinematic;
- clean institutional;
- government modern;
- luxury;
- creative studio;
- developer tool;
- dashboard operacional;
- high-density ERP;
- consumer friendly;
- spatial 3D;
- immersive storytelling.

Definir:

- referências;
- cores;
- tipografia;
- radius;
- sombras;
- densidade;
- motion;
- composição;
- nível de expressividade.

---

## Fase 3 — Design system

Definir antes das telas:

### Cores

- background;
- surface;
- elevated surface;
- border;
- muted;
- text;
- secondary text;
- brand;
- success;
- warning;
- error;
- info;
- focus;
- disabled.

### Tipografia

- display;
- h1;
- h2;
- h3;
- body;
- small;
- caption;
- label;
- numeric;
- monospace.

### Espaçamento

Usar escala consistente:

- 4;
- 8;
- 12;
- 16;
- 20;
- 24;
- 32;
- 40;
- 48;
- 64;
- 80;
- 96.

### Radius

Definir poucos níveis:

- small;
- medium;
- large;
- extra large;
- full.

### Sombras

Definir:

- subtle;
- elevated;
- modal;
- floating.

### Motion

Definir:

- duration-fast;
- duration-normal;
- duration-slow;
- easing-standard;
- easing-emphasized;
- easing-exit.

### Breakpoints

Definir:

- mobile;
- tablet;
- laptop;
- desktop;
- wide.

---

# Anti-frontend genérico

Detectar sinais de frontend genérico.

## Sinais

- quatro cards coloridos;
- botão azul padrão;
- sidebar genérica;
- fundo cinza sem identidade;
- borda em tudo;
- muitos cards;
- ícones aleatórios;
- tabela padrão;
- pouca hierarquia;
- tipografia sem personalidade;
- espaçamento uniforme demais;
- todos os elementos com mesmo peso;
- tudo centralizado;
- excesso de gradiente;
- excesso de blur;
- layout copiado de template admin;
- componentes sem adaptação.

Quando detectar, refazer.

---

# Identidade visual

Toda interface deve possuir pelo menos 3 elementos reconhecíveis.

Exemplos:

- assinatura tipográfica;
- padrão de cor;
- sistema de iconografia;
- tratamento de borda;
- motion característico;
- composição;
- ilustração;
- forma;
- textura;
- tratamento de dados;
- navegação específica;
- microinterações.

Não depender apenas de logo e cor.

---

# Tipografia

## Regras

- usar no máximo 2 famílias;
- priorizar legibilidade;
- evitar excesso de pesos;
- usar line-height adequado;
- equilibrar largura;
- limitar comprimento de linhas;
- controlar tracking;
- usar números tabulares em dashboards;
- usar monospace apenas quando necessário.

## Escala sugerida

- display: 48px a 96px;
- h1: 36px a 56px;
- h2: 28px a 40px;
- h3: 20px a 28px;
- body: 15px a 18px;
- small: 13px a 14px;
- caption: 12px a 13px.

## Evitar

- texto minúsculo;
- títulos gigantes sem propósito;
- tudo em bold;
- baixa legibilidade;
- contraste insuficiente;
- texto em caixa alta excessiva.

---

# Cores

## Regras

- paleta curta;
- neutros coerentes;
- uma cor principal;
- cores semânticas;
- contraste adequado;
- cor usada com intenção.

## Evitar

- azul genérico;
- roxo neon automático;
- gradiente em tudo;
- excesso de saturação;
- cores aleatórias por card;
- baixa acessibilidade;
- fundo cinza morto.

---

# Layout

## Hierarquia

Toda tela deve deixar claro:

- onde estou;
- o que é importante;
- o que posso fazer;
- o que aconteceu;
- o que vem depois.

## Composição

Usar:

- ritmo;
- contraste;
- agrupamento;
- proximidade;
- alinhamento;
- balanço;
- repetição;
- escala.

Evitar:

- mural de caixas;
- blocos desconectados;
- densidade aleatória;
- espaços inconsistentes.

---

# Navegação

## Sidebar

Usar quando:

- há muitos módulos;
- navegação é recorrente;
- contexto é complexo.

Regras:

- agrupar;
- ordenar;
- limitar profundidade;
- mostrar estado atual;
- oferecer colapso;
- manter consistência;
- adaptar ao mobile.

## Topbar

Usar para:

- busca;
- contexto;
- ações globais;
- conta;
- notificações;
- atalhos.

## Mobile

Considerar:

- drawer;
- bottom navigation;
- tabs;
- command menu;
- navegação contextual.

---

# Dashboards

Dashboard não é coleção de cards.

Cada bloco deve responder uma pergunta.

## Perguntas obrigatórias

- qual decisão esse dado ajuda a tomar?
- qual tendência importa?
- qual comparação importa?
- qual período?
- existe meta?
- existe alerta?
- existe ação?

## Padrões recomendados

- resumo;
- contexto;
- tendência;
- comparação;
- exceção;
- detalhe;
- ação.

## Evitar

- gráfico sem propósito;
- pizza desnecessária;
- cor aleatória;
- card sem contexto;
- KPI isolado;
- tabela infinita;
- dashboard AdminLTE.

---

# ERP e sistemas enterprise

Interfaces enterprise precisam equilibrar:

- densidade;
- velocidade;
- clareza;
- hierarquia;
- acessibilidade;
- consistência;
- produtividade.

## Regras

- priorizar operações frequentes;
- reduzir cliques;
- manter atalhos;
- permitir ações em lote;
- preservar contexto;
- usar filtros persistentes;
- usar tabelas configuráveis;
- usar drawers para detalhes;
- usar modais apenas quando necessário;
- permitir navegação por teclado;
- manter histórico;
- usar estados claros.

## Evitar

- transformar ERP em landing page;
- excesso de espaço vazio;
- animações lentas;
- interfaces bonitas mas improdutivas;
- esconder informação crítica;
- menus confusos;
- formulários intermináveis.

---

# Landing pages

## Estrutura possível

- hero;
- prova social;
- problema;
- solução;
- benefícios;
- demonstração;
- features;
- casos de uso;
- integrações;
- depoimentos;
- pricing;
- FAQ;
- CTA;
- footer.

Não usar tudo automaticamente.

## Hero

Deve conter:

- promessa clara;
- diferenciação;
- ação;
- prova;
- visual relevante.

Evitar:

- headline vaga;
- mockup genérico;
- gradiente clichê;
- orb decorativo;
- texto de IA.

---

# Formulários

## Regras

- labels visíveis;
- helper text;
- agrupamento;
- validação;
- feedback;
- foco;
- keyboard support;
- estados;
- responsividade.

## Preferir

- seções;
- etapas;
- autosave;
- confirmação;
- preenchimento progressivo.

## Evitar

- placeholders como label;
- 30 campos em uma coluna;
- mensagens vagas;
- validação apenas no submit;
- campo sem contexto.

---

# Tabelas

## Requisitos

- busca;
- filtro;
- ordenação;
- paginação;
- seleção;
- ações em lote;
- ações por linha;
- sticky headers;
- colunas configuráveis;
- densidade;
- responsividade;
- exportação;
- estados vazios;
- skeleton.

## Mobile

Converter para:

- lista;
- cards;
- resumo;
- drawer;
- expansão;
- colunas prioritárias.

---

# Cards

Usar somente quando houver agrupamento real.

Evitar:

- card dentro de card;
- tudo em card;
- card com sombra pesada;
- card colorido sem função;
- grid de cards repetitivos.

---

# Botões

## Hierarquia

- primary;
- secondary;
- tertiary;
- destructive;
- link;
- icon.

## Regras

- uma ação principal;
- labels claras;
- hover;
- focus;
- loading;
- disabled;
- pressed;
- feedback.

---

# Modais e drawers

## Modal

Usar para:

- confirmação;
- ação curta;
- decisão;
- entrada pequena.

## Drawer

Usar para:

- detalhes;
- edição contextual;
- preview;
- atividade;
- filtros;
- histórico.

Evitar modal para fluxos longos.

---

# Estados obrigatórios

Toda tela deve prever:

- loading;
- skeleton;
- empty;
- no results;
- error;
- offline;
- success;
- partial;
- unauthorized;
- forbidden;
- stale data;
- processing;
- disabled;
- first use.

---

# Motion design

## Objetivo

Motion deve:

- orientar;
- dar feedback;
- criar continuidade;
- explicar transição;
- dar personalidade.

## Regras

- curto;
- suave;
- consistente;
- com propósito;
- respeitar reduced motion.

## Durações

- micro: 100ms a 180ms;
- normal: 180ms a 300ms;
- complexa: 300ms a 500ms;
- storytelling: conforme narrativa.

## Evitar

- bounce excessivo;
- delay longo;
- animação em tudo;
- parallax agressivo;
- motion que atrasa tarefa;
- scroll-jacking.

---

# 3D

## Quando usar

- produto tridimensional;
- arquitetura;
- moda;
- automóvel;
- games;
- tecnologia;
- storytelling;
- experiências promocionais;
- demonstrações;
- visualização espacial.

## Regras

- lazy load;
- fallback;
- compressão;
- controle de FPS;
- redução em mobile;
- respeitar reduced motion;
- manter acessibilidade;
- não bloquear conteúdo;
- limitar polígonos;
- limitar texturas;
- pausar fora da viewport.

## Evitar

- 3D decorativo pesado;
- scroll travado;
- câmera desorientadora;
- 3D sem fallback;
- experiência inutilizável em mobile.

---

# Responsividade real

Responsividade não é apenas reduzir tamanho.

Adaptar:

- hierarquia;
- ordem;
- densidade;
- navegação;
- interação;
- visibilidade;
- componentes;
- conteúdo;
- gráficos;
- tabelas;
- formulários;
- motion;
- 3D.

Testar no mínimo:

- 320px;
- 375px;
- 430px;
- 768px;
- 1024px;
- 1280px;
- 1440px;
- 1920px.

---

# Acessibilidade

Obrigatório:

- HTML semântico;
- contraste;
- foco visível;
- navegação por teclado;
- aria labels;
- labels corretas;
- landmarks;
- alt text;
- reduced motion;
- touch targets;
- mensagens de erro;
- leitura de estados;
- ordem lógica;
- screen reader support.

Acessibilidade não é opcional.

---

# Performance

Monitorar:

- bundle;
- LCP;
- CLS;
- INP;
- hydration;
- imagens;
- fontes;
- animações;
- 3D;
- scripts;
- cache.

## Regras

- lazy load;
- dynamic import;
- image optimization;
- font optimization;
- code splitting;
- memoização apenas quando necessário;
- evitar re-render;
- evitar dependência pesada;
- usar SSR/SSG quando fizer sentido.

---

# Imagens e assets

## Regras

- usar imagens relevantes;
- alta qualidade;
- tamanho otimizado;
- art direction;
- crop correto;
- alt text;
- fallback;
- formatos modernos.

## Evitar

- stock genérico;
- mockup falso;
- imagem pixelada;
- background enorme;
- assets sem compressão.

---

# Iconografia

- usar uma biblioteca;
- manter stroke;
- manter grid;
- manter peso;
- manter tamanho;
- usar labels quando necessário.

Não usar emoji como iconografia principal.

---

# Design tokens

Criar tokens para:

- colors;
- spacing;
- radius;
- shadow;
- typography;
- motion;
- z-index;
- breakpoints.

Não espalhar valores arbitrários.

---

# Arquitetura de componentes

## Componentes devem ser

- reutilizáveis;
- previsíveis;
- acessíveis;
- tipados;
- testáveis;
- consistentes;
- compostos;
- desacoplados.

## Evitar

- componente de 1000 linhas;
- props booleanas demais;
- duplicação;
- estilo inline;
- lógica de negócio no componente visual;
- CSS global descontrolado.

---

# Organização sugerida

```text
src/
├── app/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── navigation/
│   ├── forms/
│   ├── feedback/
│   ├── data-display/
│   └── motion/
├── features/
├── hooks/
├── lib/
├── styles/
├── tokens/
└── types/
```

---

# Revisão visual obrigatória

Após implementar, revisar:

## Estrutura

- layout;
- alinhamento;
- grid;
- largura;
- densidade.

## Visual

- tipografia;
- cores;
- spacing;
- radius;
- sombra;
- iconografia.

## UX

- clareza;
- ação principal;
- feedback;
- fluxo;
- erros;
- estados.

## Responsividade

- mobile;
- tablet;
- desktop;
- ultra wide.

## Qualidade

- parece template?
- parece IA?
- parece antigo?
- parece inconsistente?
- parece lento?
- parece poluído?
- parece vazio demais?

Se sim, refatorar.

---

# Teste visual com Playwright

Quando Playwright estiver disponível:

```text
1. executar aplicação;
2. abrir rota;
3. tirar screenshot desktop;
4. tirar screenshot tablet;
5. tirar screenshot mobile;
6. comparar hierarquia;
7. verificar overflow;
8. verificar clipping;
9. verificar legibilidade;
10. verificar estados;
11. corrigir;
12. repetir.
```

---

# Critérios por tipo de interface

## SaaS

- clareza;
- onboarding;
- ativação;
- uso recorrente;
- billing;
- empty states;
- feedback;
- produtividade.

## ERP

- densidade controlada;
- tabelas;
- filtros;
- atalhos;
- permissões;
- histórico;
- ações em lote;
- produtividade.

## Fintech

- confiança;
- precisão;
- números;
- segurança;
- confirmação;
- estados;
- auditoria.

## Governo

- acessibilidade;
- clareza;
- linguagem simples;
- institucionalidade;
- transparência;
- responsividade;
- rastreabilidade.

## IA

- contexto;
- geração;
- streaming;
- histórico;
- fontes;
- estados;
- feedback;
- controle.

## 3D

- performance;
- narrativa;
- interação;
- fallback;
- compatibilidade;
- acessibilidade.

---

# Modos visuais

O agente pode adotar um modo.

## Modo Linear

- minimalista;
- alta densidade;
- tons neutros;
- bordas sutis;
- motion curto;
- tipografia funcional.

## Modo Stripe

- forte hierarquia;
- produto confiável;
- dados claros;
- spacing premium;
- cores controladas.

## Modo Vercel

- preto, branco e neutros;
- tipografia forte;
- grid;
- minimalismo técnico;
- transições sutis.

## Modo Apple

- narrativa;
- foco no produto;
- escala;
- imagem;
- motion;
- espaço;
- refinamento.

## Modo Enterprise

- produtividade;
- densidade;
- navegação;
- tabelas;
- consistência;
- atalhos.

## Modo Cinematic 3D

- storytelling;
- camera;
- scroll;
- iluminação;
- profundidade;
- transições;
- fallback.

Nunca copiar marca literalmente.

---

# Regras de conteúdo

Frontend bonito também depende de texto.

Evitar:

- lorem ipsum;
- headings vagas;
- texto de marketing genérico;
- labels ambíguas;
- CTA “Saiba mais” sem contexto.

Usar copy clara e específica.

---

# Proibições absolutas

Nunca entregar:

- Bootstrap visual clássico;
- AdminLTE;
- Material antigo;
- dashboard de 2018;
- interface sem identidade;
- frontend não responsivo;
- cards excessivos;
- botões aleatórios;
- gradiente em tudo;
- glassmorphism excessivo;
- neon sem contexto;
- 3D pesado sem fallback;
- animações que atrapalham;
- texto minúsculo;
- contraste ruim;
- tabela impossível de usar;
- sidebar com 40 itens;
- componente gigante;
- código sem estados;
- interface sem loading;
- interface sem erro;
- interface sem empty state;
- layout que quebra em mobile;
- primeira versão sem revisão.

---

# Sequência obrigatória de execução

```text
1. Entender produto
2. Definir usuário
3. Definir ação principal
4. Definir direção visual
5. Pesquisar referências via MCP
6. Pesquisar componentes via MCP
7. Definir design system
8. Definir layout
9. Definir responsividade
10. Definir estados
11. Implementar
12. Testar com Playwright
13. Revisar screenshots
14. Refatorar
15. Validar acessibilidade
16. Validar performance
17. Entregar
```

---

# Comando de ativação

```text
Ative a skill Mega Premium Frontend Architect.

Quero criar: [DESCRIÇÃO].

Regras:

- não gere frontend genérico;
- use os MCPs disponíveis;
- pesquise referências antes de implementar;
- defina direção visual;
- defina design system;
- planeje responsividade real;
- implemente todos os estados;
- use motion com propósito;
- use 3D somente se fizer sentido;
- valide com Playwright;
- revise screenshots;
- refatore tudo que parecer template, antigo ou feito por IA.
```

---

# Checklist final obrigatório

## Visual

- [ ] tem identidade?
- [ ] tem hierarquia?
- [ ] tem ritmo?
- [ ] tem contraste?
- [ ] tem spacing consistente?
- [ ] tipografia está refinada?
- [ ] cores estão coerentes?
- [ ] componentes estão harmonizados?

## UX

- [ ] ação principal está clara?
- [ ] fluxo é simples?
- [ ] feedback existe?
- [ ] erros são claros?
- [ ] estados estão completos?
- [ ] navegação é previsível?

## Responsividade

- [ ] funciona em 320px?
- [ ] funciona em tablet?
- [ ] funciona em desktop?
- [ ] funciona em ultra-wide?
- [ ] tabelas adaptam?
- [ ] navegação adapta?
- [ ] motion adapta?

## Técnica

- [ ] acessível?
- [ ] performático?
- [ ] sem overflow?
- [ ] sem layout shift?
- [ ] sem dependência inútil?
- [ ] componentes reutilizáveis?
- [ ] código organizado?

## Qualidade

- [ ] parece produto real?
- [ ] parece premium?
- [ ] parece atual?
- [ ] parece feito por designers?
- [ ] não parece template?
- [ ] não parece frontend de IA?

Se qualquer resposta crítica for não, continuar trabalhando.

---

# Resultado esperado

O resultado final deve parecer desenvolvido por uma equipe de alto nível.

A interface deve ser:

- visualmente forte;
- tecnicamente sólida;
- funcional;
- elegante;
- responsiva;
- acessível;
- rápida;
- memorável;
- pronta para produção.

Não finalizar enquanto o frontend ainda parecer genérico.
