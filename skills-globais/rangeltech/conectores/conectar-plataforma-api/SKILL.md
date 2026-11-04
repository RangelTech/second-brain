---
name: conectar-plataforma-api
description: |
  Método geral para conectar o agente a qualquer plataforma por API (Instagram/Meta, Google, YouTube, Notion, Slack,
  Mercado Livre, ERPs, planilhas, e-mail...): escolher o tipo de autenticação, pedir só as credenciais necessárias, guardá-las
  com segurança, testar com uma chamada de leitura e só então agir. Use quando o usuário disser "conecta no meu ...",
  "integra com ...", "puxa os dados de ..." ou "posta/atualiza em ..." e não houver uma skill específica da plataforma.
---

# Conectar uma plataforma por API

## 1. Descubra o que o usuário quer de fato
- Ler dados (relatório, planilha), escrever (postar, atualizar) ou receber eventos (webhook)?
- Em qual conta? Dele ou de terceiro? Se for de terceiro, peça a autorização do dono.

## 2. Escolha a autenticação (do mais simples ao mais complexo)
1. **Chave de API / token pessoal**: a plataforma gera uma chave no painel do usuário. Mais simples; use quando existir.
2. **OAuth** (login com a conta): quando a plataforma exige (Google, Meta, TikTok). Guie a criação do app de desenvolvedor,
   do redirecionamento e dos escopos mínimos. Prefira o "device flow" quando não houver site para receber o retorno.
3. **Conta de serviço / webhook**: para automação sem pessoa presente.
Peça sempre o **menor escopo** que resolve (só leitura se for só ler).

## 3. Segredos
- Peça a chave no momento em que for usar e guarde nos segredos do app, nunca em arquivos de texto soltos, em
  repositórios ou na conversa. Não repita o valor depois de recebido (mostre só os 4 últimos caracteres).
- Avise o usuário para **revogar** a chave se ela tiver aparecido num chat ou print.

## 4. Teste antes de agir
- Faça uma chamada **de leitura** inofensiva (ex.: "quem sou eu", listar 1 item) e mostre o resultado ao usuário.
- Só depois faça escrita. Na primeira escrita real, mostre exatamente o que será enviado e peça confirmação.

## 5. Limites e erros
- Respeite limites de requisição (faça pausas, trate 429 com espera crescente).
- 401/403: credencial vencida ou sem permissão; peça renovação, não tente adivinhar.
- Registre o que foi feito (o quê, quando, em qual conta) num arquivo na pasta de trabalho, para auditoria.

## 6. Plataformas que costumam pedir um pouco mais
- **Meta (Instagram/Facebook/WhatsApp oficial)**: precisa de conta Business, app no Meta for Developers e, para postar em
  produção, revisão do app.
- **Google (Drive, Planilhas, YouTube, Gmail)**: projeto no Google Cloud, tela de consentimento e escopos; credencial
  OAuth ou conta de serviço.
- **WhatsApp por QR code**: veja a skill `whatsapp-evolution-api`. **TikTok**: skill `tiktok-api`.
- Se a plataforma **não tem API oficial**, diga com franqueza e ofereça alternativas (exportar CSV, automação do navegador
  com o usuário presente) em vez de burlar o termo de uso.
