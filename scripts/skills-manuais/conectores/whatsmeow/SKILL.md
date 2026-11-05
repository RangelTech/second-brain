---
name: whatsmeow
description: |
  Biblioteca Go para falar com o WhatsApp Web (multi-dispositivo). Use quando o cliente disser: "enviar mensagem no WhatsApp pelo código"; "robô de WhatsApp em Go"; "conectar meu número de WhatsApp"; "receber mensagens do WhatsApp no meu sistema".
---

# whatsmeow

> **Validada no benchmark.**

## Quando usar
Integrar WhatsApp a um sistema próprio escrito em Go.

## Quando NÃO usar
Quando a API oficial ou a Evolution API atendem.

## Passo a passo
```go
go get go.mau.fi/whatsmeow
```
Fluxo: criar o `Client` com um repositório de sessão SQLite, mostrar o QR para parear na primeira vez, registrar um handler de eventos e enviar com `client.SendMessage`. Exemplos no repositório `tulir/whatsmeow` (pasta `mdtest`).

## O que o benchmark mediu
Rodou em sandbox de CPU: 40.8s, pico de memória 407 MB

## Requisitos
Go; um número de WhatsApp para parear por QR; roda em Linux sem root. Sem GPU.

## Combina com
`evolution-api`, `mautrix-whatsapp`, `wa-akg`.
