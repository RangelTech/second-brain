# Fase 0 — ponte única no gateway do Hermes (spec 34)

Medido em 13/11/2026 ~00h, PC do Lucas (Windows 11), Hermes instalado pelo app 0.6.67, gateway já de pé (aberto pelo app), modelo Qwen da conta do Lucas.
Comando: `node prototipo/gateway/bench-gateway.js 5`.

| Medida | Hoje (`hermes-acp` por conversa) | Ponte única no gateway |
|---|---|---|
| Processo pronto | `initialize` 3,1 s | **0,33 s** (conectar no gateway 0,16 s) |
| Criar conversa | `session/new` 5,5 s | **0,19 s** (gateway quente) / 0,93 s (1ª da ponte) |
| 1º texto, conversa nova, gateway quente | 4,8 a 12,1 s antes do modelo + modelo | **1,5 s** total |
| 1º texto, 1ª conversa da vida do gateway | idem | 16 s (montagem inicial do agente no gateway; acontece 1 vez por partida) |
| 5 conversas ao mesmo tempo | 5 processos Python (~5 × 300 MB), reservas e aquecimento | 1 processo; as 5 terminam em **6,3 s** (1º texto 2,7 a 5,1 s) |

Conclusões:
1. A ponte única elimina a reserva e o aquecimento: criar conversa custa 0,2 s e não gasta modelo.
2. O único custo grande (16 s) é a 1ª montagem do agente depois que o gateway sobe. Mitigação: o app sobe o gateway e cria 1 sessão descartável na abertura (sem prompt: só `session.create`); conferir na fase 1 se `session.create` sozinho já monta o agente ou se só o 1º `prompt.submit` monta.
3. Protocolo: o tíquete do WebSocket é emitido pelo canal privado do gateway (no Windows, pipe nomeado); por isso a ponte usa o próprio cliente do Hermes (`hermes_cli.gateway_client.connect_gateway`) em Python, com o venv do mesmo ambiente do workspace. O app fala com a ponte por linhas JSON (stdin/stdout).
4. Eventos recebidos: `message.delta`, `message.complete`, `tool.start`, `tool.complete`, `approval.request`, `clarify.request`, `session.info/usage/updated`. Envelope `{type, payload, session_id, admission_id}`.
5. Windows: `connect_read_pipe` no stdin falha (IOCP); a ponte lê o stdin em thread.

Próximo (fase 1, 0.7.0 atrás de `cfg.motorGateway`): `gateway-cliente.js` no app falando com esta ponte, traduzindo eventos para o que a tela já desenha (texto, cartões de ferramenta, permissão), com o mesmo marcador de conversa `<!--sb:id-->` para a ponte LLM.
