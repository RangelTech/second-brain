---
name: atendimento-automatico
description: |
  Responder sozinho as mensagens do WhatsApp e do Direct do Instagram (atendente automático, robô de atendimento, "responde meus clientes", "quando chegar mensagem, responda..."). O app confere a cada 10 segundos se chegou mensagem nova e a IA responde do jeito que o usuário mandar. Também: "workflow que fica checando o WhatsApp/Instagram", "auto-resposta", "fora do horário responda X". Use em vez de criar um workflow por horário (cron), que não serve para responder rápido.
---

# Atendimento automático (WhatsApp e Instagram Direct)

## Como funciona
- O app confere o WhatsApp Web / o Direct a cada N segundos (padrão 10) SEM gastar IA: só olha se tem conversa não lida.
- Chegou mensagem: abre a conversa, lê as últimas 15 mensagens, pede a resposta para a IA com as instruções do usuário e envia. A resposta sai em 1 a 5 segundos.
- Roda numa janela própria escondida (o navegador continua livre). Fica ligado enquanto o app estiver aberto (com a opção "continuar em segundo plano", mesmo com a janela fechada). Na VM do cliente, roda 24 h.
- Tudo fica registrado: Configurações > Workflows mostra as últimas respostas e o tempo de cada uma.

## Ligar (pela conversa)
1. Confira a conexão: `navegador_whatsapp_estado` (WhatsApp) ou abra instagram.com/direct (precisa estar logado no navegador do app). Desconectado: peça o QR / o login.
2. Monte as INSTRUÇÕES com o usuário em UMA mensagem (dê um exemplo pronto para ele só ajustar):
   - quem é o negócio e o que vende; tom (formal, descontraído, emojis?);
   - informações que a IA pode dar: preços, endereço, horário, entrega, link de pagamento/agenda;
   - o que fazer quando não souber ("diga que vou verificar e retorno");
   - quem NÃO responder (família, grupos, fornecedor) e quando não responder (ex.: "ok", figurinha);
   - se deve passar para humano ("se pedirem para falar com o Lucas, diga que ele responde em instantes").
3. Ligue: `navegador_whatsapp_atendimento` com `ativo=true`, `instrucoes`, e se quiser `intervalo`, `ignorar` ("Mãe, Chefe"), `so` (só estes contatos), `grupos=false`. Instagram: `navegador_instagram_atendimento` com os mesmos campos.
4. Teste com o usuário: peça para alguém mandar uma mensagem (ou ele mesmo, de outro número) e mostre a resposta no histórico (`..._atendimento` sem argumentos).
5. Para testar SEM enviar nada: `simular=true` (a IA responde só no histórico). Depois `simular=false`.

## Desligar / ajustar
`..._atendimento` com `ativo=false`. Para mudar as instruções, mande só `instrucoes` (o resto continua).

## Cuidados (diga ao usuário)
- A IA responde em nome dele: comece com instruções conservadoras e acompanhe o histórico no 1º dia.
- WhatsApp Web precisa do celular com internet. Se o WhatsApp desconectar, o atendimento avisa "desconectado" e volta sozinho quando conectar.
- Uso muito agressivo (centenas de respostas por hora, mensagens em massa) pode levar o WhatsApp/Instagram a restringir a conta. Para volume alto, o caminho é a API oficial (WhatsApp Business API / Meta).
