---
name: youpi-pg
description: |
  Gateway de pagamento UPI (Índia) que lê SMS bancário. Use quando o cliente disser: "gateway de pagamento UPI"; "receber pagamento na Índia".
---

# YOUPI PG v2

> **Baseada na documentação oficial (fora da bateria do benchmark).**

## Quando usar
Apenas UPI da Índia.

## Quando NÃO usar
Pix: use Cakto ou Mercado Pago, ou `pix-brcode`.

## Passo a passo
```bash
git clone https://github.com/youpi-pg/YouPI-PG.git youpi-pg
```

## O que o benchmark mediu
Não entrou na bateria de medição do benchmark; skill baseada na documentação oficial.

## Requisitos
Android com acesso a SMS. Sem GPU.

## Combina com
`pix-brcode`.
