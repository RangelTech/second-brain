# Segundo Cérebro no Chrome

Extensão (Manifest V3) que deixa o Hermes usar o Chrome do usuário, com as sessões dele. Sem tela de login: a conta vem do app (mensageria nativa)
ou do site do remoto (cookie da página). Ferramentas: `abrir`, `ler`, `clicar`, `digitar`, `rolar`, `voltar`, `js`, `print` e `oauth_capturar`
(login de provedor: pega o retorno `localhost:8080/callback`).

- `background.js`: WebSocket com a ponte (`/ws/extensao`), ferramentas, depurador (solto após 20 s sem uso), grupo de abas "Segundo Cérebro".
- `content-remoto.js`: roda só em `remoto.rangeltech.net`; pareia pela sessão da página ou por `#sbp=<token>` (entregue pelo app).
- `popup.*`: estado, pausar, desconectar, entrar. `nucleo.js`: lógica pura.
- ID fixo pela chave pública em `chave.json` (a privada `chave-privada.pem` fica no cofre e fora do git).

```
node scripts/montar.js            # dist/ (o que vai para o cliente)
node scripts/montar.js --teste    # dist-teste/ (também vale em 127.0.0.1; só para testes)
```
Teste e2e (Chrome for Testing + ponte local + app simulado): `segundo-cerebro-remoto/test/e2e-extensao.js`.
Distribuição: o zip fica em `segundo_cerebro_site/public/extensao/`; ao mudar a versão rode `montar.js`, gere o zip de `dist/` e copie para lá com `versao.json`.
