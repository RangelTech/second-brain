---
name: mcptoon
description: mcptoon (ADOTAR). CLI que comprime em ~90% o contexto de ferramentas MCP e descobre ferramentas sob demanda. Nosso catalogo rt_* cresce; medir ganho. Apache-2.0.
---

# mcptoon

**Veredito da campanha (26 a 28/10/2026):** ADOTAR. **Classe do dado:** medido.

## Para que serve
CLI que comprime em ~90% o contexto de ferramentas MCP e descobre ferramentas sob demanda. Nosso catalogo rt_* cresce; medir ganho. Apache-2.0.

> One zero-dependency CLI for every MCP server and agent skill. Token optimization, tool discovery and context compression: 71,929 -> 581 toke

## O que foi medido
- sandbox CPU: OK, executou, 17.1s, pico RSS 73 MB

## Hardware
Roda sem GPU dedicada.

## Licença
Apache-2.0 (permissiva). Confira a licença do código e a dos pesos antes de usar em produto.

## Instalação e uso

### Receita testada (Windows, mcptoon 0.8.34, 05/11/2026)

Tarefa: comprimir o catálogo de um servidor MCP com 10 ferramentas de descrição longa e provar que dá para achar uma ferramenta sob demanda. Resultado: catálogo serializado de **4.901 bytes para 490 bytes (cerca de 90 % menos)**; `search "preço promocional"` achou `consultar_preco_promocional` sem carregar o catálogo; `inspect` devolveu o esquema JSON completo só dessa ferramenta; `call` executou e devolveu os itens reais.

Instale do PyPI, num ambiente isolado (não use `npm`):

```
python -m venv <scratch>/venv-mcptoon
<scratch>/venv-mcptoon/Scripts/pip install mcptoon "mcp<2"
```

O pacote do SDK precisa ser a série 1 (`mcp<2`): a 2.x muda a interface do servidor e quebra os exemplos. Registre os servidores num `servers.json` no formato padrão (`{"mcpServers": {"nome": {"command": "...", "args": ["..."]}}}`), importe no mcptoon e use:

- `mcptoon search "<tarefa>"`: acha as ferramentas relevantes sem carregar o catálogo inteiro (devolve uma pontuação);
- `mcptoon inspect <servidor> <ferramenta>`: esquema completo de uma ferramenta, sob pedido;
- `mcptoon call <servidor> <ferramenta> chave=valor`: executa.

A medição "antes e depois" compara o bloco `tools` bruto do protocolo (o que entra no contexto do modelo) com o manifesto compacto do mcptoon. O manifesto inclui um pequeno banner do CLI, então o ganho real é um pouco maior que 90 %.

### Armadilhas

- **Servidor de demonstração:** se precisar criar um servidor MCP de teste, use **FastMCP** (`from mcp.server.fastmcp import FastMCP`) e leia `references/servidor-demo-fastmcp.md`. O agente perdeu mais de 20 min porque os blocos do arquivo foram concatenados sem quebra de linha (o `}` ficou colado ao `@mcp.tool()` seguinte e só 1 das 10 funções foi registrada) e porque colocou `mcp.run` dentro de um `asyncio.run`.
- Valide o servidor com `ast.parse` contando as funções com decorador, não com `grep`.
- Com um catálogo pequeno (menos de umas 20 ferramentas) o ganho absoluto é pequeno; o valor aparece com muitos servidores.

Ainda não testado: gateway com vários servidores reais e o recurso `mcptoon docs`.

## Fonte
Fonte: campanha de benchmark de ferramentas (out/2026). Números que mudam com o tempo (preço de GPU) valem na data da medição: confira o preço do dia.
