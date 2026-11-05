---
name: headroom
description: Headroom (ADOTAR). Camada de compressao de contexto (60-95% menos tokens: logs, RAG, historico). Reduz custo de entrada do 27B e das conversas longas do atendimento. Medir perda de qualidade.
---

# Headroom

**Veredito da campanha (26 a 28/10/2026):** ADOTAR. **Classe do dado:** medido.

## Para que serve
Camada de compressao de contexto (60-95% menos tokens: logs, RAG, historico). Reduz custo de entrada do 27B e das conversas longas do atendimento. Medir perda de qualidade.

> Compress tool outputs, logs, files, and RAG chunks before they reach the LLM. 20% fewer tokens for coding agents, 60-95% fewer tokens for JS

## O que foi medido
- sandbox CPU: OK, executou, 34.6s, pico RSS 129 MB; compress_s=2.74

## Hardware
Roda sem GPU dedicada.

## Licença
Apache-2.0 (permissiva). Confira a licença do código e a dos pesos antes de usar em produto.

## Instalação e uso

### Receita testada (Windows, Python 3.14, headroom 0.42.0, 05/11/2026)

Instale do PyPI, em ambiente isolado. **Não clone o repositório**: o `git clone` passa de 2 minutos, estoura o tempo do comando e deixa uma pasta `.git` quebrada (o agente gastou 10 min e 710 mil tokens nisso antes de achar o caminho certo).

```
python -m venv <scratch>/headroom-venv
<scratch>/headroom-venv/Scripts/pip install headroom-ai
```

O pacote se chama `headroom-ai` e o import é `headroom`. Uso mínimo, com mensagens no formato OpenAI (o texto grande vai numa mensagem de ferramenta):

```python
import os
os.environ.setdefault("HEADROOM_OFFLINE", "1")   # sem download de modelo, sem checagem de versão: resultado determinístico
from headroom import compress

messages = [
    {"role": "user", "content": "Analise o log e diga o que falhou."},
    {"role": "assistant", "content": None, "tool_calls": [{"id": "c1", "type": "function",
        "function": {"name": "logs", "arguments": "{}"}}]},
    {"role": "tool", "tool_call_id": "c1", "content": log_gigante},
]
r = compress(messages, model="gpt-4o")
print(r.tokens_before, r.tokens_after)   # métricas
comprimido = r.messages                  # use estas mensagens no lugar das originais
```

Resultado medido: log sintético de 3.000 linhas (237.374 caracteres) caiu para 5.044 caracteres (62 linhas), **98 % menos**, sem o modelo de ML (modo offline usa heurísticas estatísticas e continua funcionando).

### Armadilha séria: linhas WARN somem

Dos 8 erros plantados no log, os 6 de nível `ERROR` sobreviveram byte a byte e os 2 de nível `WARN` **desapareceram**. O roteador de log trata WARN como baixa prioridade. Antes de comprimir um log que importa:

- se um aviso crítico vem como `WARN`, promova-o para `ERROR` no texto antes de comprimir, ou
- use o modo `mode='agent'` (densificação sem perda, com prova de ida e volta, nunca descarta), ou
- reduza a agressividade e **confira por busca** (grep) se cada assinatura importante continua no texto comprimido.

Nunca entregue a compressão de um log sem essa conferência. A redução de 98 % veio de um log propositalmente repetitivo; num log variado espere algo entre 60 % e 90 %.

## Fonte
Fonte: campanha de benchmark de ferramentas (out/2026). Números que mudam com o tempo (preço de GPU) valem na data da medição: confira o preço do dia.
