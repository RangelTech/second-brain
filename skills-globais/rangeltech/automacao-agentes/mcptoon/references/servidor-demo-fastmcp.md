# Servidor demo FastMCP — montagem e armadilhas

Profundidade tópica: como montar o servidor MCP stdio com 10 ferramentas e
descrições longas para a medição de compressão. Só é necessária quando se
constrói um servidor novo (não ao reutilizar um já existente).

## Requisito de versão do SDK
- Instale `mcp<2` (API v1) no venv; a versão 2.x muda a interface `Server` e quebra o padrão de escrita.
- Use **FastMCP** (`from mcp.server.fastmcp import FastMCP`), a API de alto nível recomendada: expõe `@mcp.tool()` como decorator funcional e `mcp.run(transport="stdio")`.
- Por que NÃO a low-level `Server` v1: embora `hasattr(Server,'list_tools')` seja True, o uso de `@app.list_tools()`/`@app.tool()` como decorator não funcionava — o servidor morria no registro das ferramentas e a conexão fechava no `initialize()`. Migrar para FastMCP resolveu.

## Armadilha 1 — concatenação de blocos gerados (1 das N decoradas)
Ao gerar o arquivo em partes e concatenar, garantir **quebra de linha** (idealmente uma linha
em branco) entre o `}` do dict de `return` e o `@mcp.tool()` da função seguinte. Sem isso, o
`}` fica na MESMA linha do `@` e — por ter indentação de bloco — o parser trata o decorator
como órfão dentro do corpo indentado da função anterior. Sintoma: o AST mostra só 1 das N
funções com `mcp.tool()` no `decorator_list` (as outras vazias), mesmo `grep -c` contando N
decoradores. Diagnóstico correto: `ast.parse` + iterar `AsyncFunctionDef` e inspecionar
`decorator_list`, não `grep`. Correção: junta com `"\n\n".join(blocos)` e revalide no AST antes de rodar.

## Armadilha 2 — aninhamento de loops asyncio
`mcp.run(transport="stdio")` abre o próprio loop via `anyio.run`. Colocar isso DENTRO de um
`asyncio.run(_main())` aninha dois loops → `RuntimeError: Already running asyncio in
this thread` (e, pelo lado do cliente, `McpError: Connection closed` no `initialize`).
Correção: rodar `mcp.run(transport="stdio")` DIRETO no top-level `if __name__ == "__main__"`,
sem wrapper `_main` assíncrono.

## Validação (antes de declarar pronto)
- `py_compile` nos dois arquivos (servidor + cliente).
- AST: confirmar as N funções top-level com decorator registrado (pega a Armadilha 1).
- Cliente de teste (`stdio_client` + `ClientSession`): `initialize`, `list_tools` (contar N), medir bytes serializados do bloco `tools`, `call_tool` em uma ferramenta e conferir o retorno real. Só então relatar os números antes × depois.
