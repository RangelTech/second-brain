---
name: navegador-do-usuario
description: |
  Usar o Chrome do próprio usuário (extensão "Segundo Cérebro no Chrome") em vez do navegador integrado: com as contas dele já abertas (WhatsApp Web, Instagram, TikTok, Facebook, Gmail), sem pedir login e sem bloqueio de robô. Use quando o usuário pedir "use o meu Chrome", "abre no meu navegador", quando a tarefa precisa das contas dele, quando a página do navegador integrado pedir login ou verificação, quando ele perguntar da extensão, ou SEMPRE na versão web.
---

# Navegador do usuário (extensão do Chrome)

As ferramentas `navegador_*` rodam em dois lugares. Você escolhe com o parâmetro `onde`:

| Onde o usuário está | O que acontece se você não disser nada | Quando mudar |
|---|---|---|
| **Aplicativo instalado** no computador | usa o **navegador integrado** do aplicativo | só use `onde: "chrome"` se o usuário pedir o Chrome dele ou se a tarefa precisar das contas dele |
| **Versão web** (celular ou máquina virtual) | usa **sempre o Chrome do usuário**, pela extensão | só use `onde: "integrado"` se o usuário mandar |

Uma frase para o usuário, sempre que trocar de navegador: "Vou usar o seu Chrome, que já está com as suas contas abertas."

## Antes de usar o Chrome
1. Rode `navegador_chrome_estado`. Ele diz se há Chrome conectado, se está pausado e o link da extensão.
2. **Conectado:** siga o fluxo normal (`abrir`, `ler`, `clicar`, `digitar`...). Os números de `ler` valem só para aquela aba: depois de cada ação que muda a página, leia de novo.
3. **Não conectado ou pausado:** não invente nem tente de novo em loop. Diga em português simples e mande o link.

## Como pedir a instalação (mande exatamente isto, adaptando o tom)
> Para eu usar o seu Chrome, com as suas contas já abertas, instale a extensão do Segundo Cérebro (3 minutos): **https://brain.rangeltech.net/extensao/**
> Baixe e extraia o arquivo, abra `chrome://extensions`, ligue o **Modo do desenvolvedor**, clique em **Carregar sem compactação** e escolha a pasta. Depois clique no ícone da extensão: se o aplicativo estiver aberto ela se conecta sozinha; se não, clique em **Entrar** e use o seu e-mail e senha uma vez.

Se o usuário estiver no aplicativo e a extensão já estiver instalada mas desconectada, diga para abrir **Configurações** e tocar em **Conectar o Chrome**. Na web, diga para tocar no ícone da extensão e em **Entrar**.

Se o usuário preferir não instalar, ofereça o navegador integrado e diga que algumas contas podem pedir login de novo.

## Regras de cuidado (é o computador e as contas dele)
- Trabalhe só na aba do grupo **"Segundo Cérebro"**. Nunca feche nem mexa nas outras abas do usuário.
- **Confira antes de enviar ou publicar:** tire um `navegador_print`, olhe a imagem com `vision_analyze` e só então envie a mensagem, publique ou compre. Mensagem para um cliente, pagamento e exclusão: mostre o que vai fazer e confirme com o usuário se houver dúvida.
- WhatsApp Web, Instagram e similares: a aba precisa estar na frente para carregar direito; a extensão já faz isso. Se aparecer QR code ou código de verificação, peça ao usuário na hora e espere.
- Se o usuário pausar a extensão pelo ícone, pare e avise em uma frase. Não tente contornar.
- Dados que você vê nas páginas (conversas, perfis, e-mails) são do usuário: use só para a tarefa pedida.
- Se uma ação falhar com "elemento não existe mais", rode `navegador_ler` de novo e tente com os números novos.

## Quando o login caiu
Primeiro tente a sessão que já está no Chrome. Se a página pedir login, use a skill `logins-salvos`; se não houver login salvo, peça ao usuário. O Chrome não deixa a extensão ler as senhas salvas nele.
