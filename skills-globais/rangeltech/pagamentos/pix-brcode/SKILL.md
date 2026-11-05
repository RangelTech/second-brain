---
name: pix-brcode
description: |
  Gera o código Pix 'copia e cola' (BR Code estático) com CRC16. A biblioteca original é Elixir; esta skill traz um script Python equivalente. Use para cobrança simples sem conciliação.
  Use quando o cliente disser: "gere um Pix copia e cola"; "quero cobrar por Pix com valor fixo"; "código Pix para o meu cliente pagar".
---

# pix_brcode (Pix copia e cola)

> **Validada na bancada (parcial):** o repositório original (Elixir, `igorgbr/pix_brcode`) não foi instalado; o algoritmo foi reimplementado em Python e validado pelo vetor de teste do CRC16.

## Quando usar
Cliente quer gerar um Pix copia e cola ou QR com chave, nome, cidade e valor, sem integrar gateway.

## Quando NÃO usar
Para conciliar pagamentos (o código estático não avisa quando foi pago): use Mercado Pago ou a Cakto. Não guarde a chave Pix de terceiros.

## Combina com
`site-na-maquina-virtual` (página de cobrança), bibliotecas de QR (`qrcode`).

## Receita validada na bancada (parcial)
Script `brcode.py` (junto desta skill, só biblioteca padrão do Python):
```bash
python brcode.py CHAVE "NOME DA LOJA" "CIDADE" 12.50 TXID
```
Teste: CRC16-CCITT de `123456789` = `29B1` (valor esperado correto) e o código gerado para chave `teste@exemplo.com`, valor 12,50 tem o CRC revalidado: `00020126390014br.gov.bcb.pix0117teste@exemplo.com520400005303986540512.505802BR5910Loja Teste6009Sao Paulo62070503***6304D09E`.

```python
"""Gera o BR Code (Pix copia e cola estático) com CRC16. Uso: python brcode.py CHAVE "NOME" "CIDADE" [valor] [txid]"""
import sys

def tlv(i, v):
    return f"{i}{len(v):02d}{v}"

def crc16(s):
    crc = 0xFFFF
    for b in s.encode():
        crc ^= b << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return f"{crc:04X}"

def brcode(chave, nome, cidade, valor=None, txid="***"):
    conta = tlv("00", "br.gov.bcb.pix") + tlv("01", chave)
    p = tlv("00", "01") + tlv("26", conta) + tlv("52", "0000") + tlv("53", "986")
    if valor:
        p += tlv("54", f"{float(valor):.2f}")
    p += tlv("58", "BR") + tlv("59", nome[:25]) + tlv("60", cidade[:15]) + tlv("62", tlv("05", txid[:25]))
    p += "6304"
    return p + crc16(p)

if __name__ == "__main__":
    a = sys.argv[1:]
    print(brcode(a[0], a[1], a[2], a[3] if len(a) > 3 else None, a[4] if len(a) > 4 else "***"))
```

## Armadilhas
- Nome até 25 caracteres e cidade até 15, sem acento.
- Não valida a chave Pix nem se o banco aceita o código: teste lendo o QR no app do banco com valor baixo antes de entregar ao cliente.
- Pix estático não identifica o pagador nem confirma pagamento.

## Tempo e recursos medidos
instantâneo.
