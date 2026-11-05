---
name: onvif-zeep
description: |
  Cliente Python para câmeras ONVIF (descoberta, perfis, URL de stream RTSP, PTZ). Use no KI Vision para cadastrar câmeras IP e obter o endereço do stream.
  Use quando o cliente disser: "cadastrar câmera IP"; "descobrir o endereço RTSP da câmera"; "controlar câmera ONVIF".
---

# onvif-zeep

> **Validada na bancada (parcial):** biblioteca instala e importa; não havia câmera ONVIF para testar a conexão (conexão a um endereço sem câmera devolve `ONVIFError`).

## Quando usar
Cadastrar uma câmera IP com ONVIF (informar IP, usuário e senha) e descobrir o RTSP e os perfis de vídeo.

## Quando NÃO usar
Câmeras sem ONVIF. Nunca acessar câmeras que não são do cliente.

## Combina com
`mediamtx` (servidor RTSP), `bytetrack`/`bot-sort`, `vision`.

## Receita validada na bancada (parcial)
```bash
python -m venv v && v/bin/pip install onvif-zeep        # 6 s, sem root
```
```python
from onvif import ONVIFCamera
cam = ONVIFCamera('192.168.0.10', 80, 'usuario', 'senha')
media = cam.create_media_service()
perfil = media.GetProfiles()[0]
uri = media.GetStreamUri({'StreamSetup': {'Stream': 'RTP-Unicast', 'Transport': {'Protocol': 'RTSP'}}, 'ProfileToken': perfil.token}).Uri
```
Teste: `import onvif` ok (zeep 4.3.3) e a conexão a um host sem câmera falhou com `ONVIFError` como esperado.

## Armadilhas
- Não validado com câmera real.
- Algumas câmeras exigem hora sincronizada para autenticar.
- Use as credenciais da câmera do cliente e só na rede dele.

## Tempo e recursos medidos
pip install 6 s.
