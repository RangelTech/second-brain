<!-- readme-padrao -->
# Segundo Cérebro: ponte web e celular

> Ponte que deixa o app do Segundo Cérebro ser usado pelo navegador e pelo celular.

![Tela principal](docs/img/principal.webp)

## O que é
Ponte que deixa o app do Segundo Cérebro ser usado pelo navegador e pelo celular.

Estado: **no ar**.

## Onde está no ar
- https://app.segundocerebro.pro

## Onde faz o deploy
Este repositório **só publica** o artefato (release com imagem e manifesto); **quem implanta é o `vps_rt_infra`**.

- Serviço `segundo-cerebro-remoto`: `gh workflow run deploy.yml --repo RangelTech/vps_rt_infra -f service=segundo-cerebro-remoto` (só validar: `-f dry_run=true`; voltar versão: `-f version=<tag-antiga>`)

Os `.env` desses serviços são gerados do Infisical no momento do deploy (spec 57, seção 0A).

## Como funciona por dentro
Resumo acima; os detalhes estão nas notas técnicas (README anterior) abaixo e na spec 57.

## Segredos
Nenhum valor de segredo fica neste repositório. Os segredos dos serviços ficam no Infisical (mapa em `vps_rt_infra/scripts/infisical/mapa_envs.json`) e chegam à VPS gerados no deploy.

## Rodar e testar localmente
Ver as notas técnicas abaixo (cada repositório tem o seu jeito); os testes de QA em produção são por cliques reais, com evidência em `new_ragente/qa/evidencias`.

## Links
- Repositório: https://github.com/RangelTech/segundo-cerebro-remoto
- Painel único: https://painel.rangeltech.net
- Spec de organização geral: `new_ragente/specs/57_ORGANIZACAO_GERAL_PRODUTOS_E_PAINEL.md`

## Notas técnicas (README anterior)

# segundo-cerebro-remoto

Ponte do acesso web do Cérebro Pro (`https://remoto.rangeltech.net`). O aplicativo desktop ou a máquina virtual do cliente abre um WebSocket de saída até aqui, e o navegador (ou o celular) usa a interface do próprio app através desse túnel.

## Como funciona

1. O host (app ou máquina virtual) conecta em `/ws/maquina` com a chave da conta. A ponte valida a chave no `llm-access` (`/v1/auth/whoami`).
2. O usuário abre o site e entra com e-mail e senha (`/api/entrar`, que chama `/v1/auth/verify` do `llm-access`). A ponte devolve o cookie assinado `sb_web`.
3. `/m/<id>/` serve a interface do app pelo túnel (com cache por máquina, versão e caminho). As chamadas internas viajam em `/ws/web` como mensagens `inv`, `ret` e `ev`.

Limites: resposta acima de 30 MB é recusada, mensagem acima de `MAX_MSG_MB` (40) derruba a conexão, e os canais pesados (modelo de ditado, Whisper) ficam na lista de bloqueados do cliente (`second-brain/remoto.js`).

O que a ponte guarda: só hashes de vínculo em `/data/vinculos.json`. Conversa e arquivo não passam por disco.

## Variáveis

| Variável | Padrão | Função |
|---|---|---|
| `PORT` | 8080 | porta HTTP |
| `ACCESS_URL` | https://qwen.rangeltech.net | endereço do `llm-access` |
| `SESSION_SECRET` | aleatório a cada início | assina o cookie; sem ele as sessões caem a cada reinício |
| `SESSAO_DIAS` | 7 | validade da sessão |
| `MAX_MSG_MB` | 40 | tamanho máximo de mensagem |

## Rodar e testar

```
npm ci && PORT=8787 npm start
npm test
```

## Versão e deploy

`gh workflow run release.yml -f version=vX.Y.Z` publica a imagem e o manifesto. O deploy é só pelo `vps_rt_infra` (`release-intake.yml`, depois `deploy.yml -f service=segundo-cerebro-remoto`). Este repositório não tem credencial da VPS.

Mapa geral do ecossistema: skill `ecossistema_rt` (repositório `personal-skills`) e `MANUAL_ARQUITETURA_RANGELTECH.docx`.
