# Exportador para arquivo JSON (padrão reutilizável)

Subclassifica `SpanExporter`: buffer em memória com lock, `export()` appenda e imprime no console, `shutdown()` serializa tudo num único arquivo `.json`. Útil para demos locais sem collector (Jaeger/Collana) no ar.

## Código

```python
import json
import threading
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult


class FileWriterSpanExporter(SpanExporter):
    def __init__(self, filepath: str = "traces.json"):
        self.filepath = filepath
        self.spans = []
        self.lock = threading.Lock()

    def export(self, spans):
        with self.lock:
            self.spans.extend(spans)
        for s in spans:  # feedback em tempo real
            print(f"  [SPAN] {s.name}  ({s.context.span_id:016x})")
        return SpanExportResult.SUCCESS

    def shutdown(self):
        with self.lock:
            data = [self._ser(span) for span in self.spans]
        with open(self.filepath, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
        print(f"\n✔ {len(data)} spans gravados em: {self.filepath}")

    def force_flush(self, timeout_millis: int = 0):
        return True

    @staticmethod
    def _ser(span) -> dict:
        """ReadapadSpan -> dict legível. Cobre: parent-child, dur_ms, attrs."""
        return {
            "name": span.name,
            "span_id": span.context.span_id,
            "trace_id": span.context.trace_id,
            "parent_id": (span.parent.span_id if span.parent else None),
            "start_ns": span.start_time,
            "end_ns": span.end_time,
            "duration_ms": round((span.end_time - span.start_time) / 1e6, 3),
            "attributes": {str(k): str(v) for k, v in (span.attributes or {}).items()},
        }
```

## Uso no pipeline

```python
provider.add_span_processor(SimpleSpanProcessor(FileWriterSpanExporter("traces.json")))
# ... no final:
provider.force_flush(timeout_millis=10000)
# exporter.shutdown() é chamado pelo provider.shutdown() — OU chame manualmente p/ garantir a escrita
```

## Pitfalls

- **`SimpleSpanProcessor` vs `BatchSpanProcessor`:** o `Simple` exporta CADA span ao fim (ótimo p/ demo local, baixa perda). `Batch` agrupa e exporta periodicamente (alto volume, produção, coleta collector OTLP). Não inverta.
- **Flush antes de escrever:** se o `shutdown()` do exporter não for chamado (crash), `self.spans` some. Chame `provider.force_flush()` + `exporter.shutdown()` explicitamente no caminho normal.
- **Atributos binários/complexos:** OTel aceita strings, números, bools, listas homógeneas. Se o seu app setar objetos Python crus, o SDK serializa para `repr()`. No `_ser()`, o cast `{str(k): str(v)}` é defensivo p/ JSON (números viram "120.5" — se precisar número, refine: `type(v) in (int, float)`).

## Saída esperada

```json
[
  {
    "name": "processar_pedido",
    "span_id": "0xda27e735845af8d3",
    "trace_id": "0x72d08fb8ec1430f4c2f0c2771c114007",
    "parent_id": null,
    "duration_ms": 51.362,
    "attributes": {"pedido.id": "1001", "pedido.valor": "120.5", "pedido.status": "confirmado"}
  },
  {
    "name": "confirmar_pagamento",
    "span_id": "0xc031f8c53990eebc",
    "trace_id": "0x72d08fb8ec1430f4c2f0c2771c114007",
    "parent_id": "0xda27e735845af8d3",
    "duration_ms": 30.32,
    "attributes": {"pedido.id": "1001", "pagamento.metodo": "cartao_credito", "pagamento.valor": "120.5", "pagamento.status": "aprovado"}
  },
  {"name": "reservar_estoque", "parent_id": "0xda27e735845af8d3", "duration_ms": 20.171, "attributes": {"estoque.quantidade_itens": "1", "estoque.status": "reservado"}}
]
```

Árvore hierárquica confirmada: `parent_id=null` só no raiz; filhos apontam pro raiz; `duration_ms` do pai **maior que** a soma dos filhos (o gap é o trabalho próprio do pai entre/início-fim dos filhos).
