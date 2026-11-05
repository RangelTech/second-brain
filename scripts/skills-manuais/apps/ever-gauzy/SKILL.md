---
name: ever-gauzy
description: |
  Plataforma de gestão de negócios (ERP, CRM, RH, recrutamento, projetos). Use quando o cliente disser: "quero um ERP completo"; "preciso de CRM e RH num sistema só"; "gerenciar projetos, horas e equipe"; "sistema de gestão open source".
---

# Ever Gauzy

> **Validada no benchmark.**

## Quando usar
Cliente quer um sistema de gestão completo, com módulos de vendas, RH, tempo e projetos, ou um exemplo de ERP para estudar.

## Quando NÃO usar
Gestão simples (use `litpage`).

## Passo a passo
Instalação: seguir o guia do repositório oficial `ever-co/ever-gauzy` (monorepo com API e web; há opção por Docker Compose).

## O que o benchmark mediu
Rodou em sandbox de CPU: 8.5s, pico de memória 80 MB

## Requisitos
Linux ou Windows com Node e banco de dados (PostgreSQL); pesado. Sem GPU. Em VM de cliente sem Docker/root, rodar só a parte web a partir do código. Sem GPU.

## Combina com
`drawdb` (modelar o banco), `erp`.
