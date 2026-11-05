# Demo: conflito de dois agentes no mesmo arquivo (reserva/overlap)

Reproduz a coordenação central do Concord: dois agentes (A e B) declaram o mesmo
escopo (`expected_files: ["teste.txt"]`) em `start_work`; a segunda chamada retorna o
overlap ("same file(s)") **antes** de qualquer edição. Como o servidor MCP é stdio,
um driver fino fala JSON-RPC linha a linha direto, sem nenhum harness.

## Arquivos deste skill

- `scripts/mcp_stdio_client.mjs` — cliente MCP stdio genérico (qualquer servidor
  JSON-RPC linha a linha). Uso: `new McpClient(cmd, args, env)`, `start()` (volta o child),
  `request(method, params)`, `notify(method, params)`.
- `scripts/run_scenario.mjs` — driver de cenário: `node run_scenario.mjs <caminho-da-scen.json>`.
  Lê `{cmd, args, env?, repoRoot?, steps: [{method, params}]}`, faz handshake
  (`initialize` + `notifications/initialized`), roda cada passo e imprime ARGS e
  resultado (texto + structuredContent). Trata `tools/list` especialmente: lista
  catálogo + schema de entrada de cada tool (útil para descoberta).

## Cenário de referência

```json
{
  "cmd": "node",
  "args": ["$(npm root -g)/@concord-ai/concord-mcp/dist/index.js"],
  "repoRoot": "<caminho-absoluto>/demo-repo",
  "steps": [
    { "method": "tools/call", "params": { "name": "start_work", "arguments": {
        "task_id": "TASK-A", "title": "Agente A edita teste.txt", "kind": "agent-a",
        "agent_id": "agent-a", "summary": "Agente A quer editar teste.txt",
        "expected_files": ["teste.txt"] } } },
    { "method": "tools/call", "params": { "name": "start_work", "arguments": {
        "task_id": "TASK-B", "title": "Agente B edita teste.txt", "kind": "agent-b",
        "agent_id": "agent-b", "summary": "Agente B quer editar teste.txt",
        "expected_files": ["teste.txt"] } } },
    { "method": "tools/call", "params": { "name": "inspect_work", "arguments": {} } }
  ]
}
```

`repoRoot` vira `CONCORD_REPO_ROOT` (o driver injeta) — aponta o servidor ao repo
certo independente do cwd. `demo-repo/` só precisa conter o `teste.txt` (conteúdo
irrelevante: a disputa é de escopo, o arquivo não muda).

## Marcos de verificação (saídas esperadas)

1. `start_work` TASK-A → texto `Started TASK-A; status active, version 1, 0 overlap(s).`
2. `start_work` TASK-B → texto `Started TASK-B; ... 1 overlap(s).`; structuredContent
   traz `overlaps: [{ task_id: "TASK-A", reasons: ["same file(s): teste.txt"] }]`
   ← prova da reserva: o primeiro claim vira o dono apontado pelo segundo.
3. `inspect_work` → texto `2 active task(s), 1 overlap(s)`; structuredContent traz
   `overlaps: [{ a: "TASK-A", b: "TASK-B", reasons: ["same file(s): teste.txt"] }]`,
   `stale_claims: []`, `review_ready: []`.

## Persistência (verificar após rodar)

Repo alvo ganha `.concord/`:
- `concord.db` — SQLite, fonte de verdade local;
- `events.jsonl` — trilha de eventos;
- `WORK_STATE.json` — snapshot legível do estado.

## Equivalências CLI (inspeção humana)

```bash
concord status             # presença, tarefas ativas, overlaps potenciais, stale claims
concord who                  # quem está presente
concord check teste.txt     # gate de pré-edição: "collide with N active task(s)"
```

`concord check` é a forma hook/CI da mesma verificação que a segunda
`start_work` devolve via MCP — use-a para travar edições sobre escopo
estrangeiro (exit não-zero quando há overlap).

## Armadilhas e regras

- **Windows: spawn do `.cmd` do npm.** `spawn("concord-mcp")` dá ENOENT (bin
global do npm fora do PATH do filho); caminho absoluto do shim sem
`shell: true` dá EINVAL. Regra: **chamar sempre `node <rodo>/dist/index.js`**
— zero ambiguidade de PATH/shell e pipe stdio limpo.

- **Simulação in-process ≠ harnesses separados.** Dois `tools/call`
num processo stdio único validam a mecânica de reserva/overlap
(o cálculo roda inteiro no servidor), mas as duas chamadas
compilam presença sob o MESMO `agent_id` derivado da sessão
(Clause Code visível) — o `agent_id` nos parâmetros só vinga quando
Concord NÃO enxerga a sessão. Para **entrega ao vivo** entre harnesses
distintos: `concord setup` + `concord adapters install` + sessões
separadas (`concord inbox watch --agent <id> --provider <harness>`).

- **Advisory do adapter no stderr.** Ao subir, o servidor imprime
aviso do adapter do claude-code (pedindo `adapters install` /
`inbox watch`). Inofensivo no uso stdio puro — filtrar ao interpretar
saída (`grep -v "adapter needs attention"`, por exemplo).

- **Identidades na simulação.** Usar `task_id`, `kind` e `agent_id` distintos
por agente em cada `start_work`; overlap é calculado entre tarefas ativas
independentemente do agente declarante — a divergência de identidade é
opcional para a demo de conflito, relevante só para mensagens A↔B.
