---
name: whatsapp
description: |
  Ajudar o usuário com o WhatsApp dele pelo WhatsApp Web no navegador integrado: conectar (QR code), resumir as conversas não lidas, ler uma conversa, responder, mandar mensagem para um contato ou para uma lista de clientes, mandar arquivo, e agendar envios (bom dia, lembrete, cobrança) com workflows. Use sempre que o pedido citar WhatsApp, "zap", "wpp", mensagem para cliente, lista de transmissão, "manda no whats", "responde fulano", "o que chegou no WhatsApp".
---

# WhatsApp do usuário

Você usa o WhatsApp Web **com a conta do usuário**, no navegador integrado (ferramentas `navegador_*`). A sessão fica salva só no computador dele. A receita técnica completa (seletores, URLs, leitura em lote) está na skill `redes-sociais-no-navegador`, seção WhatsApp Web. Esta skill diz **como ajudar**.

## 1. Conectar (primeira vez ou sessão caiu)
1. `navegador_abrir` em `https://web.whatsapp.com/`, espere 4 s e leia.
2. Se aparecer o QR code ("Escaneie para entrar"), diga em 3 passos curtos:
   - "Abra o WhatsApp no celular."
   - "Toque em **Aparelhos conectados** e depois em **Conectar um aparelho**." (no iPhone fica em Configurações; no Android, nos três pontinhos)
   - "Aponte a câmera para o QR code que está no painel do navegador, aqui ao lado."
   Alternativa sem câmera: "Conectar com número de telefone" mostra um código de 8 letras para digitar no celular.
3. Espere a lista de conversas aparecer (pode levar até 1 minuto em contas grandes: "Carregando suas conversas"). Confirme: "Pronto, conectado."
4. O usuário também conecta pela aba **Configurações > Conexões**, botão Conectar do WhatsApp.

## Atalho testado: nomes das conversas da lista
`navegador_js` com `return [...document.querySelectorAll('#pane-side [data-testid="cell-frame-title"]')].map(e => e.innerText).filter(t => t !== 'Arquivadas').slice(0, 15)` (a primeira linha da lista é a pasta "Arquivadas"). Se voltar vazio, a página ainda está carregando: espere 3 s e repita, ou use `navegador_print`.

## 2. O que mais pedem (e como entregar)
- **"O que chegou?" / resumo das não lidas:** filtro "Não lidas", leia as conversas (no máximo 15), e entregue um resumo por pessoa em lista: quem, o que quer, se precisa de resposta. Termine oferecendo responder.
- **Ler uma conversa:** abra pela busca (nome) ou pelo link `send?phone=`. Resuma em 3 a 5 linhas; cite trechos só quando importar.
- **Responder:** escreva a resposta no tom do usuário (curto, natural, sem "Prezado"). **Mostre o texto e espere o "pode mandar"** antes de enviar, a não ser que ele já tenha dito exatamente o que mandar.
- **Mandar para um número novo:** `https://web.whatsapp.com/send?phone=55DDDNUMERO&text=...` (só dígitos, com 55). Confira o nome do contato no cabeçalho antes de enviar.
- **Arquivo, foto ou PDF:** clipe, Documento ou Fotos. Se o seletor de arquivos do sistema não puder ser automatizado, diga em uma frase o que ele precisa clicar.

## 3. Mensagem para vários clientes (lista)
1. Pegue a lista: nomes e números (planilha, CSV, texto colado ou contatos que ele indicar). Normalize os números (55 + DDD + número).
2. Escreva a mensagem com `{nome}` para personalizar. Mostre a mensagem final e a quantidade de contatos. **Só envie depois do "pode mandar".**
3. Envie uma por vez, com 20 a 40 segundos entre elas (varie o intervalo). No máximo 50 por dia para contatos que não salvaram o número dele.
4. Ao final, entregue o relatório: enviadas, falharam (número inválido, sem WhatsApp) e por quê.
5. Avise uma vez, sem sermão: mandar muito para quem não conhece o número pode fazer o WhatsApp bloquear a conta; para volume alto o caminho certo é a API oficial do WhatsApp Business.

## 4. Agendar (workflow)
"Todo dia às 8h manda bom dia para os clientes", "toda segunda cobra quem está devendo": use a skill `workflows`. O prompt do workflow precisa conter a lista de contatos (ou onde ela está), o texto exato, o intervalo entre envios e o que fazer se a sessão do WhatsApp tiver caído (avisar no resultado, não insistir).

## 5. Problemas comuns
- **QR code de novo / "sessão encerrada":** o celular desconectou o aparelho. Peça para escanear de novo (seção 1).
- **"Usar aqui":** o WhatsApp Web está aberto em outro lugar. Clique em "Usar aqui".
- **Celular sem internet:** algumas mensagens não carregam; avise e tente de novo depois.
- **Não acha o contato:** busque pelo número, ou use o link `send?phone=`.

## Regras
- Nunca envie nada que o usuário não aprovou, salvo quando ele pediu o texto exato ou criou um workflow para isso.
- Não leia conversas que ele não pediu. Não copie conversas para fora do computador.
- Nada de spam: o usuário é responsável pelo que envia; você ajuda a fazer do jeito certo (intervalo, personalização, quem quer receber).
