

## Receita testada: pode subir a Evolution API na máquina do cliente? (05/11/2026)

Pergunta testada: "conecte o WhatsApp da loja a um atendente automático; veja se este computador sobe a Evolution API sem root". O agente verificou de verdade (em 8 min) e respondeu certo. Resultado para a **VM Linux de cliente**: tem Node 26, FFmpeg, gcc, make, git e rede; **não tem Docker, Podman, PostgreSQL nem Redis**, e o usuário não é root. Conclusão: o caminho oficial de um comando (`docker compose up -d`) não existe ali.

Dois caminhos, nesta ordem de preferência:

1. **VPS pequena com Docker (recomendado, cerca de 4 euros por mês):** instalar Docker e subir o `docker-compose` oficial, que já traz Postgres, Redis, a Evolution API e o painel Manager. A VPS tem IP público, que o webhook exige.
2. **Sem Docker, na própria máquina:** compilar Postgres e Redis na pasta do usuário e rodar a API com o Node embutido. Funciona, mas é trabalho longo e frágil; só vale para teste.

Como o fluxo funciona (conferir sempre na documentação da versão em uso):
- Criar a instância: `POST {URL}/instance/create` com `{"instanceName":"<nome>","integration":"WHATSAPP-BAILEYS","qrcode":true}` e cabeçalho `apikey: <chave global>`.
- QR code: a resposta traz a imagem em base64; o dono da loja escaneia em WhatsApp, Aparelhos conectados. O QR expira em cerca de 1 minuto; `connectionState` vira `open` quando conecta.
- Webhook: `POST {URL}/webhook/set/<instância>` com a URL do atendente e o evento `MESSAGES_UPSERT`. A URL precisa ser alcançável de fora (IP público ou túnel de teste), por isso o atendente deve ficar na mesma VPS.
- Enviar texto: `POST {URL}/message/sendText/<instância>` com `{"number":"55...","text":"..."}`.

Avisos que o agente deve repetir ao cliente: a conexão Baileys é não oficial (imita o WhatsApp Web) e o número pode ser banido com spam ou envio em massa; para volume use a WhatsApp Cloud API oficial da Meta. Pergunte o número da loja só na hora de configurar, nunca invente.
