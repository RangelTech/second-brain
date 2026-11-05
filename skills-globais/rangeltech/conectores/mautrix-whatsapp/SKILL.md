---
name: mautrix-whatsapp
description: |
  Ponte (bridge) entre WhatsApp e Matrix. Use quando o cliente disser: "ligar WhatsApp ao Matrix"; "ponte de WhatsApp para o Element"; "centralizar mensagens do WhatsApp".
---

# mautrix-whatsapp

> **Validada no benchmark.**

## Quando usar
Centralizar conversas do WhatsApp num servidor Matrix.

## Quando NÃO usar
Quando a Evolution API ou a API oficial atendem.

## Passo a passo
Instalar o bridge (`mautrix/whatsapp`), registrar no Synapse e parear o número por QR conforme a documentação do projeto.

## O que o benchmark mediu
Rodou em sandbox de CPU: 103.3s, pico de memória 587 MB

## Requisitos
Servidor Matrix (Synapse), Go ou Docker; Linux. Sem GPU.

## Combina com
`whatsmeow`, `evolution-api`.
