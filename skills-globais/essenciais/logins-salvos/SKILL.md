---
name: logins-salvos
description: |
  Guardar e usar os logins de sites que o usuário passar (endereço, usuário, senha e observações), um arquivo por site, só no computador ou na máquina dele. Use quando o usuário informar usuário e senha, pedir para guardar/lembrar um login, quando um site pedir login e já existir um salvo, ou quando o login mudar.
---

# Logins salvos

Esta skill é a "agenda de logins" do usuário. Cada site tem **um arquivo** dentro da pasta `sites/` desta skill (na pasta de skills do Hermes, em `essenciais/logins-salvos/sites/`). O arquivo fica **só no computador ou na máquina virtual do usuário**; nada disso vai para o servidor da Rangel Tech.

## Guardar
Quando o usuário passar um login ("meu login do site X é fulano, senha Y") ou pedir para guardar:
1. Descubra o endereço do site (`https://...`). Se for ambíguo, pergunte uma vez.
2. Crie ou atualize `sites/<dominio>.md` (ex.: `sites/instagram.com.md`) com este formato:
   ```
   # <Nome do site>
   endereço: https://www.exemplo.com/login
   usuário: fulano@email.com
   senha: <a senha que o usuário passou>
   observações: pede código por SMS; entrar pelo botão "Já tenho conta"
   atualizado em: <data>
   ```
3. Se o sistema permitir, deixe o arquivo só legível pelo usuário (permissão 600; no Windows, a pasta já é do usuário).
4. Confirme em UMA frase ("Guardei o login do <site>.") **sem repetir a senha**.

## Usar
Quando um site pedir login:
1. Primeiro confira se a **sessão já está aberta** (veja a página com `navegador_ler`). Se estiver, siga a tarefa.
2. Se a sessão caiu e existe `sites/<dominio>.md`, leia o arquivo e digite o usuário e a senha no navegador (`navegador_digitar`, uma vez em cada campo, com enter no fim). **Não pergunte de novo.**
3. Pediu código de verificação? Peça o código ao usuário agora e espere; depois digite.
4. Login recusado? O usuário pode ter trocado a senha: diga isso e peça a nova; atualize o arquivo.

## Mudou ou apagar
- Se o usuário passar um login novo para o mesmo site, **atualize** o arquivo (não crie outro).
- Se ele pedir "esqueça o login de X", apague o arquivo daquele site e confirme.
- Se ele pedir "quais logins você tem?", liste só os **sites e usuários**, nunca as senhas.

## Cuidados
- Nunca escreva a senha no chat, em logs ou em outras pastas. Nunca envie a senha a nenhuma ferramenta que não seja o campo do próprio site.
- Use o login só para a tarefa que o usuário pediu, no site a que ele pertence.
- Se o computador não é só do usuário (compartilhado), avise uma vez que a senha fica salva em texto nesta pasta e ofereça não guardar.
