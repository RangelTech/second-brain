---
name: tiktok-api
description: |
  Conectar o TikTok do usuário por API oficial: criar o app no TikTok for Developers, autorizar a conta (OAuth) e publicar
  ou enviar vídeo como rascunho (Content Posting API), além do que cada tipo de conta permite. Use quando pedirem
  "posta no meu TikTok", "agenda vídeo no TikTok", "conecta meu TikTok" ou "automatizar TikTok".
---

# TikTok por API oficial

Prefira sempre a API oficial. Automatizar o app com login falso, emulador ou raspagem viola os termos e derruba a conta.

## O que existe
- **Login Kit + Content Posting API** (TikTok for Developers): o usuário autoriza o app dele e o agente envia vídeos.
- **TikTok Business / Marketing API**: anúncios e métricas de conta de anunciante (outra credencial, outro painel).
- Não existe API pública para "curtir, seguir, comentar em massa". Se pedirem, explique que não é permitido.

## Pré-requisitos (o usuário faz uma vez)
1. Criar conta em `developers.tiktok.com` e um **app**. Registrar nome, ícone, descrição, termos e política de privacidade
   (URLs públicas).
2. Adicionar os produtos **Login Kit** e **Content Posting API** e pedir os escopos `user.info.basic` e `video.upload`
   (rascunho na caixa de entrada) ou `video.publish` (postagem direta).
3. Cadastrar a **URL de redirecionamento** do app. Anotar **Client Key** e **Client Secret** (guardar nos segredos do app;
   nunca repetir na conversa).
4. **Auditoria:** enquanto o app não for auditado pelo TikTok, só publica com visibilidade privada (somente o próprio
   usuário). Para postar público é preciso passar pela análise. Avise isso antes de prometer o resultado.

## Fluxo técnico (confirme caminhos e campos na documentação atual)
1. **Autorizar**: abrir `https://www.tiktok.com/v2/auth/authorize/` com `client_key`, `scope`, `response_type=code`,
   `redirect_uri` e `state`. O usuário aprova e volta com um `code`.
2. **Trocar o code por token**: `POST https://open.tiktokapis.com/v2/oauth/token/` (form) com `client_key`,
   `client_secret`, `code`, `grant_type=authorization_code`, `redirect_uri`. Guardar `access_token` (vale ~24 h) e
   `refresh_token` (renovar com `grant_type=refresh_token`).
3. **Publicar vídeo**: `POST https://open.tiktokapis.com/v2/post/publish/video/init/` com `post_info` (título/legenda,
   `privacy_level`) e `source_info` (`FILE_UPLOAD` com tamanho em partes, ou `PULL_FROM_URL` de domínio verificado).
   Depois enviar os bytes para a URL de upload devolvida e acompanhar com `.../publish/status/fetch/`.
4. Vídeo no formato aceito: MP4 (H.264), vertical 9:16 (1080×1920), áudio AAC. Para fazer o vídeo, use a skill
   **video-motion**.

## Cuidados
- Legenda e hashtags: escreva com o usuário; mostre antes de publicar. Nunca publique sem confirmação.
- Respeite direitos autorais de música e imagem; use só material do usuário ou licenciado.
- Se a conta for de terceiros (cliente do usuário), exija autorização do dono da conta.
