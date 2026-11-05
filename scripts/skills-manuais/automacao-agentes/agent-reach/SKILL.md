---
name: agent-reach
description: Agent Reach (TESTAR). Da aos agentes acesso a internet (X, sites). Util a pesquisa; revisar seguranca de cookies/credenciais.
---

# Agent Reach

**Veredito da campanha (26 a 28/10/2026):** TESTAR. **Classe do dado:** medido.

## Para que serve
Da aos agentes acesso a internet (X, sites). Util a pesquisa; revisar seguranca de cookies/credenciais.

> Give your AI agent eyes to see the entire internet. Read & search Twitter, Reddit, YouTube, GitHub, Bilibili, XiaoHongShu — one CLI, zero AP

## O que foi medido
- sandbox CPU: OK, executou, 23.1s, pico RSS 113 MB

## Hardware
Roda sem GPU dedicada.

## Licença
MIT (permissiva). Confira a licença do código e a dos pesos antes de usar em produto.

## Instalação e uso

### Receita testada (Windows, Agent Reach 1.6.1, 05/11/2026)

Tarefa: pesquisar o preço médio de um carro seminovo e trazer 3 fontes com link. Funcionou, em 5 min 35 s, mas a busca principal bateu num limite (abaixo) e o agente completou por outro caminho.

1. **Instalador.** O Agent Reach usa o `uv`. Sem `uv` no computador: `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"` (instala em `~/.local/bin`). Depois instale a ferramenta pelo zip da release oficial do GitHub com `uv tool install <zip da release>` e rode `agent-reach setup`. Os comandos exatos estão em `docs/install.md` do repositório `Panniantong/Agent-Reach`: leia lá o endereço atual do zip.
2. **Canais ligados no setup:** GitHub, YouTube, bilibili, V2EX e web. Tudo fica isolado em `~/.agent-reach/`; a skill do agente é copiada para as pastas de skills de outros agentes (Claude Code, Gemini, Copilot).
3. **Uso:** `agent-reach web search "<consulta>"` (busca pelo Exa) e `agent-reach read <url>` (leitura pelo Jina Reader). É só leitura: não posta, não comenta, não faz login por você.

### Armadilhas

- **O Exa gratuito tem limite.** A primeira busca respondeu, a segunda recebeu rate limit com pedido para esperar cerca de 59 minutos. Para uso contínuo, crie a chave gratuita em dashboard.exa.ai e rode `agent-reach configure exa-key`. Sem a chave, use a busca web nativa do agente e o `agent-reach read` só para extrair o texto das páginas.
- **Transcrição de vídeo e podcast** exige chave Groq ou OpenAI: não rode sem avisar o usuário.
- Canais que pedem login (Instagram, LinkedIn, X) não funcionam sem o usuário entrar por conta própria. Diga isso em vez de contornar.
- O agente gastou 550 mil tokens nesta tarefa, a maior parte lendo documentação. Com esta receita, vá direto ao `setup`.

Ainda não testado: Linux sem root, YouTube (legendas) e GitHub.

## Fonte
Fonte: campanha de benchmark de ferramentas (out/2026). Números que mudam com o tempo (preço de GPU) valem na data da medição: confira o preço do dia.
