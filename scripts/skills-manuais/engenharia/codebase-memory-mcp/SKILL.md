---
name: codebase-memory-mcp
description: |
  Indexa um repositório em grafo de conhecimento (funções, chamadas, rotas) e responde perguntas de arquitetura e busca de código sem ler arquivo por arquivo. Binário único, sem root.
  Use quando o cliente disser: "me explique a arquitetura deste repositório"; "quem chama essa função"; "encontre onde está implementado isso no código".
---

# codebase-memory-mcp

> **Validada na bancada.**

## Quando usar
Entender ou revisar um repositório grande sem estourar o contexto: arquitetura, quem chama quem, busca de função, rotas.

## Quando NÃO usar
Repositório minúsculo (leia direto). Não substitui executar os testes.

## Combina com
`code-review`, `mindmap`, `tdd`, `headroom`.

## Receita validada na bancada
Binário pronto (Windows, Linux, macOS), sem root. Linux: `codebase-memory-mcp-linux-amd64-portable.tar.gz` da release no GitHub `DeusData/codebase-memory-mcp` (v0.12.1, 48 MB).
```bash
./codebase-memory-mcp cli --quiet --json index_repository '{"repo_path":"/caminho/do/repo"}'      # 8,5 s (42 arquivos)
./codebase-memory-mcp cli --quiet --json get_architecture '{"project":"<nome-devolvido-pelo-index>"}'
./codebase-memory-mcp cli --quiet --json search_graph '{"project":"<nome>","name_pattern":".*minha_funcao.*"}'
```
Teste no repositório da fila (llm-queue): **732 nós e 3.090 arestas** em 8,5 s, 219 funções, 213 métodos, 12 rotas; busca de `approx_chat_tokens` devolveu arquivo e linhas (`app/main.py 48-69`, 5 chamadores, 2 chamados). Também roda como servidor MCP (`codebase-memory-mcp` sem argumentos) para o agente.

## Armadilhas
- No Windows, o primeiro teste em pasta com caminho muito longo falhou com `secure CLI coordination could not be created (cache-resolve)`; copie o executável para uma pasta curta (ex.: `C:\cmm`).
- Trocar `HOME` para uma pasta nova quebra a configuração (`could not load saved runtime settings`): use o perfil real.
- O nome do projeto vem da resposta do `index_repository`: use-o nas consultas seguintes.

## Tempo e recursos medidos
download 10 s; indexar 8,5 s; consultas em menos de 1 s.
