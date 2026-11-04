---
name: whatsapp-evolution-api
description: |
  Conectar o WhatsApp do usuário ao agente com a Evolution API (código aberto): criar a instância, mostrar o QR code
  para escanear, enviar e receber mensagens, receber eventos por webhook. Use quando o usuário pedir "conecta no meu
  WhatsApp", "manda mensagem para...", "responde meus clientes no WhatsApp", "quero automatizar o WhatsApp" ou
  mencionar Evolution API. Inclui os riscos (API não oficial) e a alternativa oficial (WhatsApp Cloud API).
---

# WhatsApp com a Evolution API

A Evolution API é um servidor (código aberto) que liga um número de WhatsApp comum a uma API HTTP. O usuário escaneia um
QR code, como no WhatsApp Web, e a partir daí o agente consegue enviar e ler mensagens por requisições.

## Antes de tudo: diga o que é e o risco
1. É uma conexão **não oficial** (emula o WhatsApp Web). Funciona bem, mas o WhatsApp pode **banir o número** se houver
   spam, envio em massa para quem não conhece o remetente ou volume anormal. Use número próprio do negócio, aqueça o número
   aos poucos e só escreva para quem tem relação com o usuário.
2. Para uso intenso, campanhas ou empresa grande, a via segura é a **WhatsApp Cloud API oficial** (Meta). Ofereça-a.
3. Só envie mensagem em nome do usuário com autorização clara dele para cada tipo de envio. Mostre o texto antes de enviar
   quando for algo novo.

## O que perguntar
- Ele já tem um servidor Evolution API? Pedir a **URL** (ex.: `https://evo.empresa.com`) e a **chave global** (`apikey`).
  Guarde a chave no cofre/segredos do app; nunca imprima nem repita a chave na conversa.
- Se não tem: ofereça subir um (Docker) na VM dele ou numa VPS barata, e conduza passo a passo.

## Fluxo (Evolution API v2; confirme os campos na documentação da versão instalada)
Todas as chamadas levam o cabeçalho `apikey: <chave>` e `Content-Type: application/json`.

1. **Criar a instância** (uma por número):
   `POST {URL}/instance/create` com `{"instanceName":"minha-empresa","integration":"WHATSAPP-BAILEYS","qrcode":true}`.
2. **Conectar / pegar o QR**: `GET {URL}/instance/connect/minha-empresa`. A resposta traz o QR (base64) e, às vezes, um
   código de pareamento. Salve o QR como PNG na pasta de trabalho e **mostre ao usuário** para escanear em
   WhatsApp > Aparelhos conectados > Conectar aparelho. O QR expira em cerca de 1 minuto: se passar, gere outro.
3. **Conferir o estado**: `GET {URL}/instance/connectionState/minha-empresa` até `"state":"open"`.
4. **Enviar texto**: `POST {URL}/message/sendText/minha-empresa` com `{"number":"5511999999999","text":"Olá!"}`
   (número com DDI e DDD, só dígitos).
5. **Enviar mídia**: `POST {URL}/message/sendMedia/minha-empresa` com `mediatype` (`image`, `video`, `document`),
   `media` (URL pública ou base64), `caption` e `fileName` quando for documento.
6. **Receber mensagens**: configure um **webhook** da instância (`POST {URL}/webhook/set/minha-empresa`) apontando para
   um endereço que receba eventos como `MESSAGES_UPSERT`. Sem endereço público, use consulta periódica de mensagens.
7. **Desconectar / trocar número**: `DELETE {URL}/instance/logout/minha-empresa`.

## Boas práticas
- Teste primeiro enviando uma mensagem para o próprio número do usuário.
- Respeite pausas entre mensagens (alguns segundos) e limites diários baixos no começo.
- Registre o que foi enviado (data, para quem, texto) num arquivo, para o usuário auditar.
- Dados de clientes (nomes, telefones) são pessoais: use só para o fim combinado e não exponha em respostas públicas.
- Se a API devolver erro de autenticação (401), peça a chave de novo; se a instância cair, refaça o QR.
