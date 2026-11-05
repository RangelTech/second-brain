---
name: drawdb
description: |
  Editor de diagrama ER e gerador de SQL no navegador, 100% estático (sem backend). Use para o cliente desenhar o banco de dados e exportar SQL, hospedado como site na máquina virtual.
  Use quando o cliente disser: "quero desenhar o banco de dados"; "diagrama de tabelas e relações"; "gerar o SQL a partir de um diagrama".
---

# drawDB

> **Validada na bancada (parcial):** build ok (11 s) e servido estático com HTTP 200; editor não aberto em navegador

## Quando usar
Cliente quer desenhar tabelas e relações visualmente e exportar SQL (MySQL, PostgreSQL, SQLite, MariaDB, SQL Server, Oracle) ou importar um script e ver o diagrama.

## Quando NÃO usar
Para consultar dados reais (é só desenho). Para diagramas de arquitetura/fluxo use `diagram-design`.

## Combina com
`site-na-maquina-virtual` (servir o `dist` em `nome.sc.rangeltech.net`), `diagram-design` (outros diagramas).

## Receita validada na bancada (parcial)
```bash
git clone --depth 1 https://github.com/drawdb-io/drawdb && cd drawdb
npm ci            # 75 s, 1ª vez
npm run build     # 11 s, gera dist/ (19 MB, estático)
cd dist && python -m http.server 3921   # qualquer servidor estático serve; abre em http://127.0.0.1:3921
```
Teste: build ok, `index.html` HTTP 200, título "drawDB | Online database diagram editor and SQL generator". Sem Docker e sem root: basta Node e um servidor estático (ou o Caddy da VM apontando para `dist`). Os dados do diagrama ficam no navegador do usuário.

## Armadilhas
- Não testei o editor em navegador (só build e HTTP 200); abrir com o Playwright e tirar print confirma.
- O Docker do repositório não serve na VM (sem Docker): use o `dist`.
- O build mostra avisos do rolldown; são inofensivos.
- Compartilhamento do diagrama por link usa um serviço externo (opcional, não habilitado por padrão).

## Tempo e recursos medidos
`npm ci` 75 s, build 11 s, dist 19 MB, serviço estático sem uso de CPU relevante.
