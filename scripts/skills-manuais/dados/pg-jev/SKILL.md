---
name: pg-jev
description: |
  Extensão do PostgreSQL que filtra e classifica linhas por condição em linguagem natural usando um modelo. Use quando o cliente disser: "filtrar linhas do banco por linguagem natural"; "classificar registros do Postgres com IA"; "busca por significado no banco".
---

# pg-jev

> **Baseada na documentação oficial (fora da bateria do benchmark).**

## Quando usar
Busca semântica dentro do Postgres.

## Quando NÃO usar
Bancos sem acesso de administrador.

## Passo a passo
Instalar a extensão conforme o README de `realZachi/pg-jev` e usar `CREATE EXTENSION`.

## O que o benchmark mediu
Não entrou na bateria de medição do benchmark; skill baseada na documentação oficial.

## Requisitos
PostgreSQL com permissão de instalar extensão (root no servidor). Precisa de GPU: Opcional.

## Combina com
`drawdb`.
