---
name: navegador-e-pesquisa
description: |
  Como abrir sites e redes sociais (Instagram, Facebook, YouTube, TikTok, X, LinkedIn, qualquer página) com o navegador integrado sem errar o endereço. Use sempre que o usuário pedir para entrar, abrir, ver, pesquisar ou pegar algo de um site ou rede social, ou quando uma página não carregar ("não abre", "deu erro", "não achou o site").
---

# Navegador e pesquisa

O seu papel é desenrolar a vida do usuário. Tente de verdade, adapte e vá até o fim do que foi pedido. O navegador integrado é do cliente: ele guarda a sessão (cookies e logins), então o que o usuário já deixou aberto continua aberto para você.

## Regra: nunca invente endereço
Subdomínios e caminhos que você acha que existem muitas vezes não existem. Exemplo real: `pt-br.instagram.com` não existe e o navegador devolve erro de nome. Escrever o endereço de cabeça é o erro mais comum.

- **Sabe o endereço exato?** Use o domínio principal conhecido: `https://www.instagram.com`, `https://www.facebook.com`, `https://www.youtube.com`, `https://www.tiktok.com`, `https://x.com`, `https://www.linkedin.com`, `https://www.google.com`.
- **Não tem certeza da URL?** Pesquise primeiro (ferramenta de busca na web) e abra o endereço que apareceu nos resultados. Para achar uma pessoa ou empresa numa rede social, pesquise "<nome> instagram" (ou a rede que for) e pegue o perfil certo antes de abrir.
- **A página não carregou?** Não repita o mesmo endereço. Troque a estratégia: domínio principal, outro caminho, ou chegue pela busca do próprio site ou do Google.

## Como usar o navegador
1. `navegador_abrir` com o endereço.
2. `navegador_ler` para ver o texto e a lista numerada de links, botões e campos.
3. `navegador_clicar`, `navegador_digitar` (com enter para buscar ou enviar), `navegador_rolar` para carregar mais conteúdo, `navegador_esperar` depois de ações que carregam.
4. `navegador_print` e olhar a imagem quando o texto não bastar.

## Instagram
- Perfil: `https://www.instagram.com/<usuario>/`. Publicação: o link `/p/<codigo>/` que apareceu no perfil.
- Não sabe o @ da pessoa? Pesquise na web, pegue o @ certo e só então abra.
- Role a página para carregar mais publicações antes de concluir que não há mais.

## Chrome do usuário (extensão)
Por padrão o aplicativo usa o navegador integrado; na versão web, o Chrome do usuário. Quando o usuário pedir o Chrome dele, ou o site exigir as contas dele (WhatsApp Web, Instagram, Gmail), use `onde: "chrome"` nas ferramentas `navegador_*`. Sem a extensão conectada, mande o link **https://brain.rangeltech.net/extensao/**. Detalhes e cuidados na skill `navegador-do-usuario`.
