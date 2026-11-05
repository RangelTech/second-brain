---
name: pixelrag
description: |
  Ferramenta e recuperador LangChain para busca visual (capturas de tela) via servidor PixelRAG. Use quando o cliente disser: "pesquise nesses PDFs pela aparência"; "busca em tabelas e gráficos de relatórios"; "RAG visual com screenshots"; "encontrar página pelo layout".
---

# PixelRAG (pixelrag-langchain)

> **Validada no benchmark.**

## Quando usar
Documentos em que tabelas e gráficos importam.

## Quando NÃO usar
Texto simples.

## Passo a passo
Comandos e exemplos do README oficial:

```
pip install pixelrag-langchain
```

```
from pixelrag_langchain import PixelRAGRetriever, PixelRAGConfig
retriever = PixelRAGRetriever(config=PixelRAGConfig.hosted())
docs = retriever.invoke("What is the capital of France?")
for doc in docs:
    print(doc.metadata["score"], doc.metadata["source"])
    print(doc.metadata["image_url"])  # fetchable PNG URL
```

## O que o benchmark mediu
Rodou em sandbox de CPU: 25.6s, pico de memória 123 MB

## Requisitos
Python; servidor `pixelrag-serve` separado (modelo visual). Precisa de GPU: Opcional.

## Combina com
`playwright` (captura), `crawl4ai`, `headroom`.
