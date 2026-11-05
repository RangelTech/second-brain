---
name: concord-mcp
description: Concord MCP (TESTAR). Faz agentes de harnesses diferentes (Claude Code, Codex) coordenarem e evitarem edicao sobreposta nos mesmos repos.
---

# Concord MCP

**Veredito da campanha (26 a 28/10/2026):** TESTAR. **Classe do dado:** medido.

## Para que serve
Faz agentes de harnesses diferentes (Claude Code, Codex) coordenarem e evitarem edicao sobreposta nos mesmos repos.

> Live messaging for coding agents

## O que foi medido
- sandbox CPU: OK, executou, 10.0s, pico RSS 219 MB

## Hardware
Roda sem GPU dedicada.

## Licença
MIT (permissiva). Confira a licença do código e a dos pesos antes de usar em produto.

## Instalação e uso

### Receita testada (Windows, Concord 0.19.0, Node 24, 05/11/2026)

Tarefa: dois agentes (A e B) querem editar o mesmo `teste.txt`; mostrar como o Concord evita o conflito. Resultado: o Concord **detecta e sinaliza a sobreposição** antes da edição; ele não impede à força. O agente A abre a tarefa com `start_work` (`expected_files: ["teste.txt"]`) e recebe "0 overlap(s)"; o agente B abre outra tarefa para o mesmo arquivo e recebe "1 overlap(s)", sabendo que A já reservou. Quem chega depois cede o arquivo, combina por `update_work`/`transfer_work` ou muda de escopo.

Instalação e uso:

```
npm install -g @concord-ai/concord-mcp      # instala o comando `concord`
concord --version
concord check teste.txt                      # porta antes de editar: há sobreposição?
```

O servidor MCP (stdio) expõe 5 ferramentas: `start_work`, `inspect_work`, `update_work`, `transfer_work` e `finish_work`. Os dados ficam numa pasta `.concord/` do repositório (`concord.db`, `events.jsonl`, `WORK_STATE.json`).

### Armadilhas

- **A telemetria vem ligada por padrão** (envia dados para getconcord.ai). Antes de usar com código de cliente, defina `CONCORD_TELEMETRY_DISABLED=1`.
- **No Windows, o comando `concord` é um atalho `.cmd`**: ao chamar por `child_process.spawn` use `shell: true` (ou o caminho absoluto), senão dá "spawn ENOENT".
- **Dois agentes de verdade** (por exemplo Claude Code e Codex em processos diferentes) exigem `concord setup` e o monitoramento da caixa de entrada nos dois lados. O teste acima simulou os dois como duas chamadas no mesmo processo: a mecânica de reserva e sobreposição é a real, mas a troca ao vivo entre dois clientes não foi testada.
- Para teste rápido, fale JSON-RPC 2.0 por stdio (`initialize`, `tools/list`, `tools/call`) com um cliente mínimo em vez de montar um harness.
- O agente gastou 838 mil tokens em 9 min, sobretudo explorando o pacote; com esta receita vá direto à instalação e ao cenário.

Ainda não testado: `concord setup` com dois harnesses reais.

## Fonte
Fonte: campanha de benchmark de ferramentas (out/2026). Números que mudam com o tempo (preço de GPU) valem na data da medição: confira o preço do dia.
