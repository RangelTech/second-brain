---
name: gepa
description: GEPA (ADOTAR). Otimiza prompts/agentes por evolucao reflexiva com metrica. Rodar com nossos modelos para melhorar skills e aproximar o 9B do 27B. MIT.
---

# GEPA

**Veredito da campanha (26 a 28/10/2026):** ADOTAR. **Classe do dado:** medido.

## Para que serve
Otimiza prompts/agentes por evolucao reflexiva com metrica. Rodar com nossos modelos para melhorar skills e aproximar o 9B do 27B. MIT.

> Optimize prompts, code, and more with AI-powered Reflective Optimization

## O que foi medido
- sandbox CPU: OK, so clone/inspecao (nao executou), 4.0s, pico RSS 59 MB

## Hardware
Roda sem GPU dedicada.

## Licença
MIT (permissiva). Confira a licença do código e a dos pesos antes de usar em produto.

## Instalação e uso

### Receita testada (Windows, GEPA 0.1.4, 05/11/2026)

Tarefa: otimizar o prompt de um classificador de mensagens de concessionária ("dúvida de preço" ou "reclamação") com 12 exemplos e métrica de acerto, usando o LLM do próprio servidor como modelo da tarefa e como modelo de reflexão. **Rodou de ponta a ponta** (log de 16 iterações, `resultado_gepa.json` gravado), mas **sem ganho neste brinquedo**: acerto 91,7 % antes e 91,7 % depois, 1 candidato. O prompt de partida já estava bom (11 de 12 certos); o GEPA só tem o que melhorar quando o ponto de partida é fraco. Para uma demonstração honesta, comece com um prompt propositalmente genérico e confirme que o acerto inicial é baixo.

```
python -m venv .venv
.venv/Scripts/pip install gepa           # 0.1.4
```

Esqueleto que funcionou (chat OpenAI-compatível do servidor como `reflection_lm`):

```python
import gepa
from gepa.adapters.default_adapter.default_adapter import DefaultAdapter, EvaluationResult   # NÃO estão no __init__ do pacote

def reflection_chat(prompt: str) -> str:
    ...  # POST no endpoint /v1/chat/completions, devolve o texto da resposta

result = gepa.optimize(
    seed_candidate={"instruction_prompt": SEED},      # o prompt a otimizar
    trainset=TREINO, valset=VALIDACAO,                # listas de dicts com a entrada e a resposta esperada
    # use o adapter OU task_lm, nunca os dois (com adapter, task_lm precisa ser None)
    adapter=meu_adapter,
    reflection_lm=reflection_chat,                    # LLM que lê o feedback e propõe o prompt melhor
    max_metric_calls=30,                              # orçamento de avaliações; cada uma é uma chamada ao LLM
    display_progress_bar=False,                       # veja abaixo
)
melhor = result.best_candidate
```

### Armadilhas

- **Importações:** `EvaluationResult` e `DefaultAdapter` moram em `gepa.adapters.default_adapter.default_adapter` (carregamento preguiçoso), enquanto `EvaluationBatch` está no topo de `gepa`. O agente gastou mais de 20 min descobrindo isso.
- **Barra de progresso:** `display_progress_bar=True` (`tqdm`) bufferiza o stdout e esconde o avanço, e parece que o processo travou. Desligue e rode em segundo plano gravando um log (`python gepa_demo.py > run.log 2>&1`), consultando o arquivo.
- **Custo:** cada avaliação é uma chamada ao LLM. Com 12 exemplos e `max_metric_calls=30` o run levou cerca de 6 min no modelo compartilhado. Reduza o orçamento antes de aumentar os exemplos.
- **Resposta vazia do modelo de reflexão** ("Proposed new text for ..." sem nada) aparece no log; confira se o `reflection_chat` não está cortando por `max_tokens` baixo.
- O mesmo modelo faz o papel da tarefa e da reflexão no teste; para ganho real, use um modelo de reflexão mais forte que o da tarefa.

Ainda não testado: ganho medido com um prompt inicial fraco e com conjunto de validação separado do treino.

## Fonte
Fonte: campanha de benchmark de ferramentas (out/2026). Números que mudam com o tempo (preço de GPU) valem na data da medição: confira o preço do dia.
