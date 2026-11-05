---
name: litpage
description: |
  Workspace self-hosted de páginas, bancos e IA (Node + SQLite). Use quando o cliente quiser um caderno/wiki/gestor de tarefas próprio rodando na máquina virtual dele.
  Use quando o cliente disser: "quero um caderno ou wiki só meu"; "gerenciar tarefas e páginas no meu servidor"; "workspace próprio tipo Notion".
---

# Litpage

> **Validada na bancada (parcial):** sobe e serve UI (HTTP 200); login pela UI não validado; Node 26 portátil via npx

## Quando usar
Cliente com máquina virtual que quer páginas, bancos de dados e quadro de tarefas próprios, sem SaaS de terceiros. Um processo Node, dados num SQLite.

## Quando NÃO usar
Se o cliente só tem o app no computador (sem VM ligada 24 h). Para documentos Word/PDF use as skills de documentos. Não serve para sites públicos de vendas.

## Combina com
`site-na-maquina-virtual` (publicar em `nome.sc.rangeltech.net`), `headroom` (resumir páginas longas).

## Receita validada na bancada (parcial)
Exige **Node 26+**. Sem root, o Node 26 portátil vem do npm: `npx -y -p node@26 -p pnpm@10.32.1 pnpm install --frozen-lockfile` (26 s) e `... pnpm build` (8 s). Subir (Linux/VM): `cd apps/server && NODE_ENV=production NC_DATA_DIR=$HOME/litpage-data NC_BOOTSTRAP_EMAIL=voce@exemplo.com NC_BOOTSTRAP_PASSWORD='senha-forte' PORT=3917 HOST=127.0.0.1 npx -y -p node@26 node src/main.ts`. Resposta: `listening on http://127.0.0.1:3917`, home HTTP 200, conta de bootstrap criada. O login pela tela usa "Continue with a password".

## Armadilhas
- `pnpm start` falha no Windows (`NODE_ENV=` no script); no Linux funciona. Rodar o node direto vale nos dois.
- Node 24 não serve (exige 26).
- Não validei o login pela interface nem o editor de blocos; só servidor e build.
- Interface em inglês e coreano.
- Docker é o caminho oficial, mas a VM do cliente não tem Docker: use o caminho acima.

## Tempo e recursos medidos
Instalar 26 s, build 8 s, subir em menos de 10 s no PC de teste (Windows). Dados em `NC_DATA_DIR`.
