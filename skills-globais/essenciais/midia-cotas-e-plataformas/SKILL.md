---
name: midia-cotas-e-plataformas
description: |
  Explicar ao cliente, quando ele perguntar, como funcionam os limites mensais de imagem, vídeo e áudio do plano, e ajudá-lo a usar plataformas externas de IA (Higgsfield, Runway, ElevenLabs, fal.ai, Replicate etc.) conectando-as ao Cérebro Pro por MCP: como conectar, como escolher, quanto custa. Use quando o usuário perguntar "quantas imagens/vídeos posso gerar", "meu limite acabou", "como uso o Higgsfield/Runway/ElevenLabs", "qual plataforma é melhor/mais barata", "conectar um MCP", ou quando o pedido pedir algo que a mídia do plano não cobre.
---

# Cotas de mídia e plataformas externas

## 1. Limites do plano (explique só quando perguntarem)
O plano inclui um número de gerações por mês. **Não mencione isso por conta própria**: a cota é invisível enquanto sobra. Se o usuário perguntar ou o limite acabar, explique em linguagem simples, sem falar de servidor, fila ou GPU.

Os números de cada plano (Lite, Max, Ultra) mudam com o tempo e podem ser ajustados por pessoa: **não os cite de memória**. Veja a página de planos em rangeltech.net (imagens por mês) ou, para vídeo e áudio, diga que o limite depende do plano e que o suporte confirma o valor exato. Regra geral: planos maiores têm bem mais gerações que o Lite.

Como se conta:
- **Vídeo** conta em clipes de 5 segundos. Um clipe em qualidade padrão (480p) vale 1. Um clipe em alta qualidade (720p) vale 3. Vídeo de 10 s em 480p vale 2; em alta, 6.
- **Áudio** vale 1 por clonagem de voz ou troca de voz. **Dublagem** vale 1 vídeo. **Troca de rosto** vale 1 vídeo por 5 s.
- **Imagem** vale 1 por imagem.
- A cota renova no dia 1 de cada mês. Geração que falha não gasta cota.
- Se o plano do usuário foi ajustado pela Rangel Tech, o número dele pode ser diferente do padrão do plano. Quando o limite acabar, a mensagem de erro já diz quanto foi usado e quando renova: repasse essa mensagem com as próprias palavras, sem culpar o usuário.
- Para economizar cota de vídeo: gere primeiro uma imagem e aprove (custa 1 imagem), depois anime; use qualidade padrão (480p) para testar e alta só na versão final; prefira clipes curtos.
- Quando acabar, ofereça: (a) esperar a renovação, (b) mudar de plano em rangeltech.net, (c) usar uma plataforma externa (seção 2), que o usuário paga direto a ela.

## 2. Plataformas externas por MCP
O usuário pode conectar serviços de IA de terceiros ao Cérebro Pro, como se faz no Claude Code. Isso é separado do plano: cada serviço tem conta e cobrança próprias, e o usuário usa o próprio login. Você nunca deve pedir nem guardar senha de ninguém: use login por navegador (OAuth) ou uma chave de API que o próprio usuário cola.

Quando usar uma externa em vez da mídia do plano: o usuário quer um modelo específico (Kling, Veo, Sora, Seedance, Midjourney-like), vídeo mais longo ou em 1080p, voz profissional de estúdio, ou acabou a cota do mês.

### Como conectar (o app lê o arquivo `mcp-externos.json`)
O app guarda os servidores MCP do usuário no arquivo `mcp-externos.json`, na pasta de dados do Segundo Cérebro (Windows: `%APPDATA%\SegundoCerebro`; Linux: `~/.config/SegundoCerebro`; macOS: `~/Library/Application Support/SegundoCerebro`). Para conectar:
1. Confirme com o usuário qual serviço e que ele já tem (ou vai criar) a conta.
2. Leia o arquivo se existir (não apague o que já está lá), acrescente a entrada e salve.
3. Diga que a conexão vale a partir de uma **nova conversa** e peça para abrir uma.
4. Na nova conversa, liste as ferramentas novas e faça um teste barato antes de gastar créditos.

Formato do arquivo (um objeto com um servidor por nome; nomes `memoria`, `midia` e `navegador` são reservados):
```json
{
  "higgsfield": { "command": "npx", "args": ["-y", "mcp-remote", "https://mcp.higgsfield.ai/mcp"] },
  "fal": { "url": "https://mcp.fal.ai/mcp", "headers": { "Authorization": "Key SUA_CHAVE_FAL" } },
  "elevenlabs": { "command": "uvx", "args": ["elevenlabs-mcp"], "env": { "ELEVENLABS_API_KEY": "SUA_CHAVE" } }
}
```
- Servidor com login por navegador (OAuth), como o Higgsfield: use `npx -y mcp-remote <url>`; na primeira chamada abre uma janela do navegador para o usuário entrar. Precisa de Node.js (`npx`); se faltar, instale (você tem permissão para instalar pacotes) e avise.
- Servidor com chave de API: ponha a chave em `env` ou `headers`. Nunca escreva a chave de um usuário em outro lugar, nem repita a chave no chat.
- Servidor em Python (`uvx`): precisa do `uv`; instale se faltar.

### Panorama (referência de nov/2026)
Preços mudam toda semana e as fontes encontradas divergem. **Antes de dar qualquer número ao usuário, confirme na página oficial** (`WebSearch` ou o navegador do app) e diga a data. Os valores abaixo são só ordem de grandeza.

| Serviço | Para quê | Como conectar | Como cobra (ordem de grandeza) |
|---|---|---|---|
| **Higgsfield** | imagem e vídeo de vários modelos num lugar só (efeitos de câmera, personagens) | MCP oficial `https://mcp.higgsfield.ai/mcp`, login por navegador | Assinatura por créditos (planos de entrada na casa de US$ 15 a 19/mês; recarga em pacotes). O MCP gasta créditos do plano; os modelos "ilimitados" do site não valem no MCP. |
| **Runway** | vídeo (Gen-4, Gen-4.5), edição de vídeo | API própria (chave em dev.runwayml.com); procure um MCP da comunidade | API a US$ 0,01 por crédito: Gen-4 Turbo ~5 créditos/s (~US$ 0,05/s), Gen-4.5 ~12 créditos/s (~US$ 0,12/s) |
| **ElevenLabs** | voz: texto para fala, clonagem profissional, dublagem | MCP oficial `elevenlabs-mcp` com chave de API | Plano grátis (~10 mil créditos/mês) e planos pagos a partir de poucos dólares; clonagem instantânea nos planos pagos |
| **fal.ai** | catálogo grande de modelos de imagem e vídeo (Wan, Kling, Flux, Seedream...) pagando só o que usa | MCP oficial `https://mcp.fal.ai/mcp`, chave de API; a ferramenta `get_pricing` mostra o preço antes de rodar | Por uso: vídeo por segundo (de ~US$ 0,05 a 0,30/s conforme modelo e resolução), imagem por unidade (centavos) |
| **Replicate** | modelos abertos rodando sob demanda | MCP em `mcp.replicate.com`, chave de API | Por tempo de GPU ou por saída, conforme o modelo |

Como aconselhar:
- **Testar barato**: fal.ai e Replicate (paga por geração, sem mensalidade) são os melhores para experimentar vários modelos.
- **Uso constante de vídeo/imagem de uma família de modelos**: assinatura (Higgsfield, Runway) costuma compensar se o usuário gera todo dia.
- **Voz profissional**: ElevenLabs. A clonagem do próprio plano (áudio) é boa para a maioria dos casos e já está incluída.
- Compare sempre com a mídia do plano: se ainda há cota, ela não custa nada extra.
- Antes de gastar na plataforma externa, estime o custo do pedido (segundos × preço por segundo) e diga ao usuário. Acima de uns US$ 5 num pedido só, peça confirmação.
- Respeite as regras de cada serviço (idade, direitos de uso, conteúdo permitido). Essas regras são entre o usuário e o serviço.

## 3. Se algo não funcionar
- Servidor não aparece na nova conversa: confira o JSON (aspas, vírgulas) e o nome (letras, números, `-`, `_`).
- Login por navegador não abre: mostre o link que o `mcp-remote` imprimir.
- Erro de crédito/saldo na plataforma: é a conta do usuário nela; indique a página de cobrança do serviço.
- Falha repetida (duas tentativas): pare, explique em português simples e ofereça usar a mídia do plano.
