---
name: conectar-provedores
description: |
  Ensinar o usuário a conectar a conta do Claude (Claude Code), do ChatGPT (Codex), do Gemini e de outras IAs ao Cérebro Pro, sem copiar e colar endereço, e a escolher qual IA usar. Use quando o usuário pedir para conectar, entrar, adicionar ou trocar de provedor, perguntar como usar o Claude ou o ChatGPT aqui, ou reclamar de login que não conclui.
---

# Conectar provedores (Claude, ChatGPT, Gemini)

O usuário pode usar a própria assinatura do Claude, do ChatGPT e do Gemini dentro do Cérebro Pro, junto com a nossa IA (Unlimited). Todas passam a ter a mesma memória e as mesmas skills.

## Onde conectar
**Configurações → Provedores → escolher a IA → Entrar com a conta.** Não precisa de chave de API.

## O que a pessoa vê (sem copiar e colar)
- **No aplicativo instalado:** abre uma janela do próprio Cérebro Pro com o login da empresa. A pessoa entra, a janela fecha sozinha e a conta aparece conectada.
- **Na versão web:** se o Chrome dela estiver conectado pela extensão, o login abre numa aba do Chrome (onde ela costuma já estar logada), fecha sozinha e conecta. Sem a extensão, o app pede para colar o endereço de retorno; para nunca mais precisar disso, mande o link da extensão: **https://brain.rangeltech.net/extensao/** (veja a skill `navegador-do-usuario`).
- Se a janela ou aba for fechada antes de terminar, é só tocar de novo em **Entrar com a conta**.
- Aparecer uma página de erro em `localhost:8080` no fim do login é normal. O Cérebro Pro pega o endereço sozinho.

## Depois de conectado
- A IA aparece na lista de modelos e em **Uso por IA** (Configurações → Uso), que mostra quanto cada uma trabalhou.
- O que passa pela conta do Claude ou do ChatGPT conta no limite delas, não no limite da assinatura do Cérebro Pro.
- Para usar uma IA pelo nome numa tarefa, siga a skill `escolher-a-ia-certa` (ferramenta `ias_perguntar`). O usuário pode mandar "use o Claude" a qualquer momento e você obedece.

## Se não conectar
1. O usuário está na conta certa da empresa (assinatura ativa do Claude ou do ChatGPT)? Esse login só funciona com assinatura paga.
2. Tente de novo; se a aba ou janela ficou pendurada, feche e repita.
3. Na web sem extensão, o endereço colado precisa ser o **completo** da barra, começando por `http://localhost:8080/callback?code=`.
4. Ainda assim não foi? Peça para abrir **Configurações → Abrir logs** e mandar ao suporte.
