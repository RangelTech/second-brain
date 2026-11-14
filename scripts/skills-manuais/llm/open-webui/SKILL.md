---
name: open-webui
description: |
  Interface de chat estilo ChatGPT para modelos compatíveis com a API OpenAI. Use como chat de demonstração apontando para a nossa API (qwen.rangeltech.net/v1) ou para o cliente testar modelos na máquina virtual.
  Use quando o cliente disser: "quero um chat estilo ChatGPT na minha máquina"; "tela de chat para a nossa API"; "interface web para meus modelos".
---

# Open WebUI

> **Validada na bancada (parcial):** instala e sobe (health ok, home HTTP 200); a conversa com um modelo real não foi testada.

## Quando usar
Dar ao cliente (ou à equipe) uma tela de chat web simples sobre um endpoint OpenAI-compatível.

## Quando NÃO usar
Como produto principal: já temos o Cérebro Pro.

## Combina com
`site-na-maquina-virtual`, gateway `9router`.

## Receita validada na bancada (parcial)
```bash
python3.12 -m venv v && v/bin/pip install open-webui      # 5 min 15 s, grande (muitos pacotes)
DATA_DIR=$HOME/owui WEBUI_AUTH=False OFFLINE_MODE=True PORT=3941 HOST=127.0.0.1 v/bin/open-webui serve --port 3941
# apontar para a nossa API:  OPENAI_API_BASE_URL=https://qwen.rangeltech.net/v1  OPENAI_API_KEY=<chave do cliente>
```
Teste: `GET /` HTTP 200 e `GET /health` devolveu `{"status":true}` em menos de 60 s. Exige Python 3.11 ou 3.12 (o 3.10 não serve).

## Armadilhas
- `WEBUI_AUTH=False` só para teste local; em produção, exija login.
- Pesado: vários GB de dependências e uso de memória; avaliar antes de pôr na VM de 8 GB.
- Não validei a conversa com a nossa API nem o upload de documentos.
- Baixa modelos de embedding no primeiro uso (`OFFLINE_MODE=True` evita).

## Tempo e recursos medidos
pip install 5 min 15 s; subir cerca de 60 s; venv de vários GB.
