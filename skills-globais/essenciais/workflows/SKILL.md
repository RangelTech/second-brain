---
name: workflows
description: |
  Workflows do cliente: tarefas que o agente faz sozinho em horário marcado, mesmo com o app fechado (o agente roda como serviço no computador). Use quando o usuário pedir algo recorrente ou agendado ("todo dia às 8h manda mensagem no WhatsApp para os meus clientes", "toda sexta me manda um relatório", "a cada hora confere meu e-mail", "amanhã às 9h me lembra"), quando quiser ver, pausar, retomar, apagar ou EDITAR um workflow, ou quando a aba Workflows abrir um chat pedindo edição.
---

# Workflows do cliente

Um workflow é um job agendado do agente (ferramenta `cronjob_manage`). Ele roda numa sessão nova, sem o histórico do chat, no horário marcado. O resultado aparece na aba **Workflows** (Configurações) e o usuário recebe um aviso.

## Criar
1. Entenda **o que** fazer, **quando** e **para quem**. Se faltar algo essencial (horário, lista de contatos, texto da mensagem), pergunte com `clarify` antes de criar, com opções em lista.
2. Escreva o `prompt` **completo e autossuficiente**: o job não vê esta conversa. Inclua nomes, números, links, o texto da mensagem, onde salvar o resultado e o que fazer se algo falhar. Cite as skills que ele deve usar (ex.: `redes-sociais-no-navegador` para WhatsApp Web).
3. Escolha o `schedule`:
   - todo dia às 8h: `0 8 * * *`
   - dias úteis às 9h: `0 9 * * 1-5`
   - toda sexta às 17h: `0 17 * * 5`
   - a cada hora: `every 1h`; a cada 30 min: `every 30m`
   - uma vez só: data e hora ISO (`2026-11-14T09:00`) ou `30m` (daqui a 30 minutos)
4. Dê um `name` curto em português ("Bom dia para os clientes", "Relatório de sexta").
5. `cronjob_manage` com `action: "create"`, `name`, `schedule`, `prompt` e, se fizer sentido, `skills`.
6. Confirme ao usuário em uma frase: o que vai rodar, quando, e que ele vê e controla tudo na aba **Workflows**.

## Ver, pausar, retomar, apagar
- Listar: `action: "list"`. Mostre nome, quando roda e a próxima execução, em lista.
- Pausar ou retomar: `action: "pause"` ou `"resume"` com `job_id`.
- Apagar: `action: "remove"` com `job_id`. Confirme antes de apagar.
- Rodar agora para testar: `action: "run"` com `job_id`.

## Editar (o caminho principal da aba Workflows)
A aba Workflows tem o botão **Editar no chat**. Ele abre uma conversa com a mensagem "Quero editar o workflow ... (id ...)" e os dados atuais. Então:
1. Leia o workflow atual (`list`) e mostre ao usuário, em 2 ou 3 linhas, o que ele faz e quando roda.
2. Pergunte o que ele quer mudar, se ainda não disse.
3. Aplique com `action: "update"`, `job_id` e só os campos que mudam (`schedule`, `prompt`, `name`, `skills`). Se mudar o pedido, reescreva o `prompt` inteiro, de novo autossuficiente.
4. Ofereça rodar uma vez agora (`run`) para ele ver o resultado.

## Mensagens em nome do usuário (WhatsApp, Instagram, e-mail)
- O workflow usa o navegador integrado, com a sessão que o usuário já entrou. Se a sessão cair, o job avisa no resultado para o usuário entrar de novo no painel Navegador.
- Antes de agendar envios para clientes, mostre a mensagem final e a lista de contatos e peça um "pode mandar".
- Respeite um intervalo entre mensagens (alguns segundos) para não parecer spam.

## Regras
- O agente roda como serviço: o workflow dispara mesmo com a janela fechada, desde que o computador esteja ligado.
- Nada de inventar horário ou contato. Na dúvida, pergunte.
- Workflow que falhou aparece com o selo "Deu erro" na aba. Leia a última saída e proponha a correção.
