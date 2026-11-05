---
name: opentelemetry-python
description: OpenTelemetry (python) (ADOTAR). Observabilidade/traces. Apache-2.0.
---

# OpenTelemetry (python)

**Veredito da campanha (26 a 28/10/2026):** ADOTAR. **Classe do dado:** medido.

## Para que serve
Observabilidade/traces. Apache-2.0.

> OpenTelemetry Python API and SDK

## O que foi medido
- sandbox CPU: OK, executou, 7.0s, pico RSS 59 MB; spans_per_s=37939

## Hardware
Roda sem GPU dedicada.

## Licença
Apache-2.0 (permissiva). Confira a licença do código e a dos pesos antes de usar em produto.

## Instalação e uso

### Receita testada (Windows, Python 3.14, opentelemetry 1.45.2, 05/11/2026)

Tarefa: 3 pedidos simulados, cada um com um span pai e dois filhos (atributos `pedido.id`, `valor`, etc.), exportados no console e em `traces.json`. Funcionou em 5 min (incluindo escrever o script).

```
python -m venv .venv
.venv/Scripts/pip install opentelemetry-api opentelemetry-sdk
```

- **Não fixe versão do `opentelemetry-semantic-conventions`.** Ele tem versionamento próprio (0.x, por exemplo 0.66b2); fixar `1.45.1` nele quebra a instalação. Instale `api` e `sdk` sem pin e deixe o pip resolver.
- Esqueleto mínimo:

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor, ConsoleSpanExporter
from opentelemetry.sdk.resources import Resource

provider = TracerProvider(resource=Resource.create({"service.name": "pedido-demo"}))
provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))
trace.set_tracer_provider(provider)
tracer = trace.get_tracer(__name__)

with tracer.start_as_current_span("pedido") as pai:
    pai.set_attribute("pedido.id", 1)
    with tracer.start_as_current_span("validar_estoque"):
        ...
    with tracer.start_as_current_span("cobrar"):
        ...
provider.shutdown()   # sem isto o último lote pode não sair
```

- Para gravar em arquivo, escreva um `SpanExporter` próprio que acumula os spans e grava o JSON no `shutdown()` (o `ConsoleSpanExporter` só imprime). Cada span traz `trace_id`, `span_id`, `parent_id`, nome, início e fim em nanossegundos e os atributos.
- A duração do pai inclui a dos filhos (são aninhados); a diferença é o trabalho próprio do pai.
- `SimpleSpanProcessor` exporta na hora (bom para demonstração); em produção use `BatchSpanProcessor` com um exportador OTLP para um coletor.

## Fonte
Fonte: campanha de benchmark de ferramentas (out/2026). Números que mudam com o tempo (preço de GPU) valem na data da medição: confira o preço do dia.
