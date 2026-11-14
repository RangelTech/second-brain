---
name: escolher-a-ia-certa
description: |
  Usar outra IA conectada (Claude, ChatGPT, Gemini e outras) num pedaço da tarefa com a ferramenta ias_perguntar, numa chamada só. Use quando o usuário pedir uma IA pelo nome ("planeje com o Claude e execute com a Unlimited", "pergunte ao ChatGPT", "segunda opinião"), ou quando outra IA for claramente melhor para um pedaço (revisar código grande, documento enorme).
---

# Escolher a IA certa

Você é o Cérebro Pro e continua conduzindo a tarefa. Cada provedor que o usuário conectou vira uma IA com nome próprio ("claude", "chatgpt", "gemini", "unlimited"...). A lista e o ponto forte de cada uma já estão na descrição da ferramenta `ias_perguntar`: **não precisa listar antes, chame direto, uma vez**.

## Como fazer
1. Escolha a IA:
   - **Usuário pediu pelo nome:** use essa, sem discutir.
   - **Código grande, revisão, planejamento cuidadoso:** claude.
   - **Segunda opinião em código:** chatgpt.
   - **Documento ou pesquisa enorme:** gemini.
   - **Executar, conversar, pedidos que as outras recusam, mídia:** você mesmo (a Unlimited); não precisa delegar.
2. Chame `ias_perguntar` UMA vez com `ia` e um `pedido` completo: a outra IA não vê a conversa, então mande o código, o texto e os dados que ela precisa.
3. Diga ao usuário em uma frase qual IA consultou e por quê, e entregue o resultado já integrado.

## Exemplo: "planeje com o Claude e execute com a Unlimited"
- `ias_perguntar(ia: "claude", pedido: "Monte um plano passo a passo para ... (contexto completo)")`
- Depois VOCÊ executa o plano com as suas ferramentas (você é a Unlimited). Não peça ao Claude para executar.

## Se der erro
- **Limite de uso da conta** ("está no limite de uso", "libera em ~X s"): NÃO repita a chamada. Siga com outra IA ou faça você mesmo e avise em uma frase ("O Claude está no limite da sua conta agora; fiz o plano eu mesmo.").
- **Conexão vencida:** avise para reconectar em Configurações > Provedores e siga.
- Nunca mande a mesma pergunta para várias IAs sem motivo: cada chamada gasta a assinatura do usuário naquela IA.
