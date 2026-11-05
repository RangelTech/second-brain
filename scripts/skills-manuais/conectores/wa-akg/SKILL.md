---
name: wa-akg
description: |
  Ponte de WhatsApp (multi-sessão) com painel e API. Use quando o cliente disser: "enviar mensagem no WhatsApp pelo sistema"; "automatizar atendimento no WhatsApp"; "conectar meu WhatsApp a um painel".
---

# WA-AKG

> **Validada no benchmark.**

## Quando usar
Conectar um número de WhatsApp a um painel/API própria.

## Quando NÃO usar
Quando a Evolution API ou a API oficial atendem.

## Passo a passo
Comandos e exemplos do README oficial:

```
# Clone and install
git clone https://github.com/mrifqidaffaaditya/WA-AKG.git
cd WA-AKG
npm install
# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL, AUTH_SECRET, PORT, etc.
# Push schema and generate Prisma Client
npm run db:push
# Create SuperAdmin account
npm run make-admin admin@example.com password123
```

```
   pm2 start ecosystem.config.js
```

## O que o benchmark mediu
Rodou em sandbox de CPU: 35.6s, pico de memória 1067 MB

## Requisitos
Node; um número para parear por QR; Linux sem root. Sem GPU.

## Combina com
`evolution-api`, `whatsmeow`.
