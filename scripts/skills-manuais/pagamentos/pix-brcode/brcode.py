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
