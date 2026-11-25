<!-- readme-padrao -->
# Segundo Cérebro (app)

> O Segundo Cérebro (Cérebro Pro): o harness. App de computador (Windows, Linux e macOS) com o agente Hermes, que roda comandos e ferramentas; também usado pelo navegador e pelo celular (ponte remota). Vai virar o monorepo de tudo do Segundo Cérebro (spec 57, seção 3.3).

![Tela principal](docs/img/principal.webp)


## Componentes deste repositório (monorepo, spec 57 §3.3)

| Pasta | O que é | CI | Release (tag) | Deploy |
|---|---|---|---|---|
| raiz | App Cérebro Pro (Electron, Hermes, instaladores) | `_app.yml` | `v*` (`release.yml`; vira a "latest" que os clientes usam) | auto-atualização pelas releases |
| `extensao/` | Extensão do Chrome (ID `cdhhngjakiihefobehjmpdhlpedlkanp`) | `_extensao.yml` | `extensao-v*` (nunca vira "latest") | zip baixado pelo site |
| `site/` | Site `segundocerebro.pro` | `_site.yml` | `site-v*` (nunca vira "latest") | `vps_rt_infra`: `deploy.yml -f service=brain-site -f version=site-vX` |
| `remoto/` | Ponte web e celular `remoto.rangeltech.net` | `_remoto.yml` | `remoto-v*` (nunca vira "latest") | `vps_rt_infra`: `deploy.yml -f service=segundo-cerebro-remoto -f version=remoto-vX` |

O roteador `ci.yml` roda só o CI da pasta que mudou; mudar a raiz (o app) roda tudo. A verificação obrigatória é o job `ci-ok`.
Commit na `main` não gera release nem deploy. Os repositórios antigos (`segundo_cerebro_site`, `segundo-cerebro-remoto`) estão arquivados, com o histórico e as releases antigas para rollback.

## O que é
O Segundo Cérebro (Cérebro Pro): o harness. App de computador (Windows, Linux e macOS) com o agente Hermes, que roda comandos e ferramentas; também usado pelo navegador e pelo celular (ponte remota). Vai virar o monorepo de tudo do Segundo Cérebro (spec 57, seção 3.3).

Estado: **no ar (clientes se atualizam sozinhos pelas releases)**.

## Onde está no ar
- https://brain.rangeltech.net

## Onde faz o deploy
Tag `v*` → o workflow `release.yml` gera os instaladores (Windows, Linux, macOS) e publica a release; ela só vira "latest" depois dos três instaladores prontos. Os apps dos clientes e as VMs se atualizam sozinhos pela release "latest". Não há deploy na VPS.

## Como funciona por dentro
Resumo acima; os detalhes estão nas notas técnicas (README anterior) abaixo e na spec 57.

## Segredos
Nenhum valor de segredo fica neste repositório. Os segredos dos serviços ficam no Infisical (mapa em `vps_rt_infra/scripts/infisical/mapa_envs.json`) e chegam à VPS gerados no deploy.

## Rodar e testar localmente
Ver as notas técnicas abaixo (cada repositório tem o seu jeito); os testes de QA em produção são por cliques reais, com evidência em `new_ragente/qa/evidencias`.

## Links
- Repositório: https://github.com/RangelTech/second-brain
- Painel único: https://painel.rangeltech.net
- Spec de organização geral: `new_ragente/specs/57_ORGANIZACAO_GERAL_PRODUTOS_E_PAINEL.md`

## Notas técnicas (README anterior)

# Cérebro Pro

Agente de IA para desktop da Rangel Tech. Windows e Linux (macOS em uma segunda etapa).

- **Chat que age de verdade:** o Hermes é o motor do agente. Ele lê arquivos (inclusive PDF, Word e planilha), roda comandos, cria sites e documentos e chama o Claude Code e o Codex quando precisa. Cada ferramenta aparece como um cartão na conversa.
- **Provedores e combos:** conecte contas e chaves (Claude, Codex, Gemini, GitHub, OpenRouter, Groq e dezenas de outros), monte combos (em ordem ou rodízio) e acompanhe **Uso** e **Cota**. O motor por trás é o [9Router](https://github.com/decolua/9router) (MIT), que roda escondido neste computador; as telas são do Cérebro Pro.
- **Unlimited:** a IA da casa. Cole a chave que você recebeu e pronto.
- **Anexos e áudio:** anexe arquivos (clipe ou arrastar e soltar), cole imagens e grave áudio pelo microfone.

## Como usar

1. Abra **Configurações > Provedores** e conecte o **Unlimited** (cole a chave) ou outro provedor.
2. Em **Combos**, crie um combo (ex.: `principal`) e escolha "Usar no chat".
3. Volte ao chat e peça, por exemplo: *"cria um site de portfólio baseado no meu currículo C:\Users\eu\curriculo.pdf"*. O agente lê o PDF, cria o site na **pasta de trabalho** e oferece abrir.

Na primeira conversa o agente prepara o ambiente do Hermes (alguns minutos, uma vez só).

A pasta de trabalho padrão é `Documentos/Cérebro Pro` e muda em **Configurações > Agente**. O agente pergunta antes de rodar comandos, escrever fora da pasta ou apagar arquivos.

## Desenvolvimento

```
npm install
npm run router:build      # baixa o 9Router (versão fixada em scripts/baixar-router.mjs) e compila o motor
npm start
```

- `main.js`: janela, ponte para o motor, sessões do agente.
- `agent.js`: cliente ACP (Agent Client Protocol) do Hermes, um processo por conversa.
- `embed-router.js`: sobe e autentica o motor (`router/`) em 127.0.0.1.
- `renderer/`: chat (`app.js`) e configurações (`config.js`).
- `scripts/gerar-catalogo.mjs`: gera o catálogo de provedores a partir do registro do 9Router.
- `scripts/teste-chat.js`, `scripts/cdp.js`, `scripts/captura.js`: testes pela interface via CDP (`electron . --remote-debugging-port=9477`).

O agente usa o binário do Hermes (`hermes-acp`) encontrado em `SECOND_BRAIN_HERMES_BIN`, na pasta de dados do app ou em `~/hermes/bin`.

## Instaladores

- Windows: `npm run dist` (instalador NSIS e versão portátil). Sem assinatura nesta fase: o SmartScreen mostra um aviso ("Mais informações" > "Executar assim mesmo").
- Linux: `npm run dist:linux` (`.AppImage` e `.deb`).
- Ao criar uma tag `vX.Y.Z`, o workflow `release.yml` compila Windows e Linux e anexa os instaladores à release. O app procura versão nova nas releases ao abrir.

## Privacidade

Nenhuma chave vai para este repositório. As chaves ficam cifradas pelo cofre do sistema (DPAPI no Windows, keyring no Linux) e os dados ficam na pasta do app. Nada é enviado para fora além das chamadas aos provedores que você conectou.

## Licença

MIT. O motor `router/` não é versionado aqui: é baixado do 9Router (MIT, decolua/9router) na versão fixada; o agente usa o Hermes Agent da Nous Research.
