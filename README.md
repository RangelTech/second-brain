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
