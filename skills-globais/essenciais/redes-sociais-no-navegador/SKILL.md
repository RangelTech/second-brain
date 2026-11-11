---
name: redes-sociais-no-navegador
description: |
  Guia completo para usar redes sociais e sites grandes no navegador integrado: Instagram, WhatsApp Web, Facebook e Messenger, TikTok, X (Twitter), LinkedIn, YouTube e Google. Onde fica cada coisa, que endereço abrir, como ler perfis, publicações, comentários e conversas, como buscar, curtir, seguir, comentar e enviar mensagem, e como navegar numa página web de forma geral (rolar, esperar, fechar popup, achar botão). Use sempre que o usuário pedir para entrar, ver, ler, procurar, postar ou responder em qualquer rede social, ou para fazer qualquer coisa num site com login.
---

# Redes sociais no navegador integrado

Você tem um navegador de verdade, igual ao Chrome, que o usuário vê ao lado do chat. A sessão dele fica salva (cookies e logins ficam no computador ou na máquina do cliente), então o que ele já entrou continua entrado. O seu trabalho é desenrolar o que ele pediu: tente, adapte, insista e entregue o resultado.

Ferramentas: `navegador_abrir`, `navegador_ler`, `navegador_clicar`, `navegador_digitar`, `navegador_rolar`, `navegador_voltar`, `navegador_esperar`, `navegador_js`, `navegador_print`. Veja também a skill `navegador-e-pesquisa` (nunca invente endereço).

## 1. Como navegar numa página web (vale para todo site)
1. **Abra o endereço exato** com `navegador_abrir` (https, domínio principal; ver os endereços de cada rede abaixo).
2. **Leia a página** com `navegador_ler`: ele devolve o título, o texto visível e uma lista numerada de links, botões e campos. Cada item tem um número (id). Rode `navegador_ler` de novo depois de qualquer ação que mude a página: os números mudam.
3. **Aja pelo número**: `navegador_clicar` com o id do botão; `navegador_digitar` com o id do campo e o texto (use `enter: true` para enviar uma busca ou mensagem).
4. **Espere o que carrega**: depois de abrir ou clicar, use `navegador_esperar` (1500 a 4000 ms) e leia de novo. Sites grandes carregam por partes.
5. **Rolar para carregar mais**: feeds e listas são "infinitos". Use `navegador_rolar` (direção baixo, 800 a 1500 pixels, ou fim) e leia de novo. Repita até ter o que precisa.
6. **Ver de verdade**: quando o texto não explica (ícones sem nome, imagem, captcha, layout estranho), use `navegador_print` e olhe a imagem com `vision_analyze`. Para clicar onde não há id, use `navegador_clicar` com `x` e `y` da imagem.
7. **Extrair dados em lote**: `navegador_js` roda JavaScript na página e devolve o resultado (o código é o corpo de uma função assíncrona, termine com `return`). É a forma mais rápida de pegar listas, contagens e textos.
8. **Popups e banners**: cookies ("Permitir todos os cookies", "Aceitar"), "Agora não" (notificações, salvar login, instalar app), "Fechar" ou o X. Feche e siga. Links que abrem "nova aba" abrem na mesma vista do navegador: use `navegador_voltar` para retornar.
9. **Campo que não aceita texto?** Clique nele primeiro (por id), depois digite. Em editores ricos (WhatsApp, Facebook, X) o campo é uma área editável: clique e digite o texto normalmente.
10. **Não achou o botão?** Role, procure pelo texto com `navegador_js` (`[...document.querySelectorAll('button,[role=button],a')].filter(e=>/texto/i.test(e.innerText||e.ariaLabel))`) ou olhe o print.
11. **Login e verificação**: se a rede pedir login, veja primeiro se a sessão já está salva (muitas vezes já está). Se não estiver, faça o login com os dados que o usuário passar, ou peça que ele entre no painel Navegador (a sessão fica salva para as próximas vezes). Códigos por SMS, e-mail ou app e QR code são digitados ou escaneados pelo usuário no painel.

## 2. Instagram (`https://www.instagram.com`)
**Endereços**
- Perfil: `https://www.instagram.com/<usuario>/` (reels do perfil: `/<usuario>/reels/`, marcações: `/<usuario>/tagged/`)
- Publicação: `/p/<codigo>/`; Reel: `/reel/<codigo>/`; Stories: `/stories/<usuario>/`
- Explorar: `/explore/`; hashtag: `/explore/tags/<hashtag>/`; mensagens (Direct): `/direct/inbox/`
- Login: `/accounts/login/`. Nunca use subdomínios como `pt-br.instagram.com` (não existem).

**Onde fica cada coisa** (menu lateral esquerdo, ou barra de baixo no celular): Página inicial, Pesquisa, Explorar, Reels, Mensagens, Notificações, Criar, Perfil, Mais. No perfil: foto, nome, botões **Seguir/Seguindo** e **Enviar mensagem**, contagens (publicações, seguidores, seguindo), bio, destaques (stories fixados) e a grade de publicações. Em cada publicação: **Curtir** (coração), **Comentar**, **Compartilhar**, **Salvar**.

**Receitas**
- *Achar uma pessoa ou loja*: não sabe o @? Pesquise na web "<nome> instagram", pegue o @ certo e abra o perfil. Ou use a Pesquisa do menu: clique, digite o nome, leia os resultados e clique no certo.
- *Contagem de seguidores* (rápido e confiável), com `navegador_js`: `return document.querySelector('meta[property="og:description"]')?.content` (devolve algo como "268 mi de seguidores, 195 seguindo, N publicações - ...").
- *Últimas publicações do perfil*: role 2 ou 3 vezes e use `navegador_js`: `return [...new Set([...document.querySelectorAll('a[href*="/p/"],a[href*="/reel/"]')].map(a=>a.href))].slice(0,12)`. Abra cada link para ler a legenda, a data e as curtidas.
- *Legenda e comentários de uma publicação*: abra `/p/<codigo>/`, `navegador_ler` e, se precisar, role dentro dos comentários e leia de novo. "Ver mais comentários" é um botão.
- *Seguir, curtir, comentar*: clique no botão pelo id (ou use o print). Para comentar, clique no campo "Adicione um comentário...", digite e clique em **Publicar** (ou Enter).
- *Postar*: menu **Criar**, escolha **Publicação**, anexe a imagem (o seletor de arquivo do navegador abre uma janela; se não conseguir anexar, avise o usuário e siga com o que for possível), escreva a legenda e **Compartilhar**.
- *Mensagens (Direct)*: `/direct/inbox/`; a lista de conversas fica à esquerda, a conversa aberta à direita; o campo "Mensagem..." fica embaixo. Nova mensagem: botão com o lápis ("Enviar mensagem") e busque a pessoa.
- *Stories*: clique no círculo com anel colorido no topo da Página inicial ou no avatar do perfil. As setas avançam. Os stories somem em 24 horas.
- *Muro de login ou "4xx"*: o perfil público às vezes mostra "Entrar / Cadastre-se" e pouco conteúdo. Com a sessão salva do usuário aparece tudo. Se a página falhar, abra o endereço com `www.` e tente de novo antes de mudar de estratégia.

## 3. WhatsApp Web (`https://web.whatsapp.com`)
**Entrar**: a primeira vez mostra um QR code ("Escaneie para entrar"). O usuário escaneia com o celular (WhatsApp > Aparelhos conectados > Conectar um aparelho). Também existe "Conectar com número de telefone", que mostra um código de 8 caracteres para digitar no celular. Depois a sessão fica salva. O celular precisa estar com internet.

**Onde fica cada coisa**: à esquerda a lista de conversas com a busca no topo ("Pesquisar ou começar uma nova conversa") e os filtros (Tudo, Não lidas, Favoritas, Grupos); à direita a conversa aberta, com o cabeçalho (nome do contato), as mensagens, e embaixo o campo "Digite uma mensagem", o clipe (anexar) e o microfone.

**Receitas**
- *Abrir conversa com um número direto* (mais rápido): `https://web.whatsapp.com/send?phone=<DDI+DDD+numero, só dígitos>&text=<mensagem codificada>` (exemplo Brasil: `5562999999999`). A conversa abre com o texto já no campo; falta só enviar.
- *Abrir conversa pela lista ou busca*: clique na busca, digite o nome, clique no resultado.
- *Ler as últimas mensagens* com `navegador_js` (tente assim; se os nomes das classes mudarem, use `navegador_ler` ou o print):
  `return [...document.querySelectorAll('#main div.copyable-text[data-pre-plain-text]')].slice(-25).map(e => e.getAttribute('data-pre-plain-text') + (e.querySelector('span.selectable-text')?.innerText || ''))`
  Cada item vem como "[hora, data] Nome: texto". Para mensagens mais antigas, role a conversa para cima (`navegador_rolar` com direção cima) e leia de novo.
- *Listar conversas e não lidas*: `return [...document.querySelectorAll('#pane-side [role="listitem"], #pane-side [role="row"]')].slice(0,30).map(e => e.innerText.split('\n').join(' | '))`. O número no círculo verde é a quantidade de não lidas. O filtro "Não lidas" mostra só elas.
- *Enviar mensagem*: com a conversa aberta, ache o campo "Digite uma mensagem" em `navegador_ler`, use `navegador_digitar` com `enter: true`. Quebra de linha dentro da mensagem: Shift+Enter (envie em mensagens separadas se for complicado).
- *Anexar arquivo ou imagem*: clipe > Documentos ou Fotos e vídeos. O seletor de arquivo abre uma janela do sistema; se não for possível automatizar, diga ao usuário o que falta.
- *Grupos*: aparecem na mesma lista; abra pelo nome. O nome de quem falou aparece antes do texto nas mensagens de grupo.
- *Áudios*: aparecem como mensagem de voz com botão de reproduzir e a duração; o conteúdo falado não vem como texto.
- *Respostas e menções*: passe o mouse sobre a mensagem e clique na seta que aparece para responder; digitar `@` abre a lista de membros no grupo.

## 4. Facebook e Messenger
**Endereços**
- Início: `https://www.facebook.com`; perfil: `https://www.facebook.com/<usuario>` ou `/profile.php?id=<numero>`; página: `/<nome-da-pagina>`
- Busca: `https://www.facebook.com/search/top?q=<termo>`; pessoas: `/search/people?q=<termo>`; grupos: `/search/groups?q=<termo>`
- Grupo: `/groups/<id-ou-nome>/`; Marketplace: `/marketplace/` e `/marketplace/search?query=<termo>`; eventos: `/events/`
- Mensagens: `https://www.facebook.com/messages/` ou `https://www.messenger.com`

**Onde fica cada coisa**: barra de cima com busca, atalhos (Início, Vídeos, Marketplace, Grupos) e à direita Mensagens, Notificações e o menu da conta; menu esquerdo com perfil e atalhos; o feed no centro; no perfil as abas Publicações, Sobre, Amigos, Fotos, Vídeos.

**Receitas**
- *Ler o feed ou o mural de uma página/grupo*: role e use `navegador_js`: `return [...document.querySelectorAll('[role="article"]')].slice(0,10).map(a => a.innerText.slice(0,500))`.
- *Publicar*: clique na caixa "No que você está pensando?" (em páginas e grupos há uma caixa parecida), escreva o texto, adicione foto se precisar e clique em **Publicar**.
- *Comentar ou reagir*: abaixo de cada publicação ficam **Curtir**, **Comentar**, **Compartilhar**. Para comentar, clique em "Escreva um comentário...", digite e Enter.
- *Marketplace*: busque pelo termo, filtre por localização e preço na barra lateral, abra o anúncio para ver descrição e vendedor; "Enviar mensagem" abre o chat com o vendedor.
- *Mensagens*: lista de conversas à esquerda, conversa à direita, campo "Aa" ou "Mensagem" embaixo.
- Se aparecer "Seu navegador não é compatível" ou tela de verificação, olhe o print e siga os passos da tela.

## 5. TikTok (`https://www.tiktok.com`)
**Endereços**: perfil `https://www.tiktok.com/@<usuario>`; vídeo `/@<usuario>/video/<id>`; busca `/search?q=<termo>`; hashtag `/tag/<hashtag>`; Para você `/foryou`; Seguindo `/following`; mensagens `/messages`; ao vivo `/live`.

**Onde fica cada coisa**: menu esquerdo (Para você, Explorar, Seguindo, Amigos, Ao vivo, Perfil), busca no topo, vídeo no centro com os botões à direita (curtir, comentários, salvar, compartilhar); a seta para baixo/cima passa para o próximo vídeo.

**Receitas**
- *Ver os vídeos de um perfil*: abra `/@usuario`, role e use `navegador_js`: `return [...new Set([...document.querySelectorAll('a[href*="/video/"]')].map(a=>a.href))].slice(0,12)`. Abra cada um para ler a legenda, as curtidas, os comentários e os compartilhamentos.
- *Buscar um assunto*: `/search?q=<termo>` e abas Vídeos, Usuários, Ao vivo.
- *Comentários*: o ícone de balão abre o painel lateral; role dentro dele para carregar mais.
- *Seguir/curtir/comentar*: botões **Seguir** no perfil, coração e balão no vídeo.
- *Verificação por captcha* (arrastar a peça, escolher objetos): olhe o print e resolva clicando e arrastando; se não der certo, peça ao usuário para resolver no painel Navegador e continue em seguida.

## 6. X (Twitter), LinkedIn, YouTube e Google
- **X**: `https://x.com/<usuario>`, busca `https://x.com/search?q=<termo>`, início `/home`, escrever `/compose/post`, mensagens `/messages`. Cada publicação é um `[data-testid="tweet"]`: `return [...document.querySelectorAll('[data-testid="tweet"]')].slice(0,10).map(t=>t.innerText.slice(0,400))`.
- **LinkedIn**: perfil `https://www.linkedin.com/in/<identificador>/`, feed `/feed/`, mensagens `/messaging/`, vagas `/jobs/`, busca de pessoas `https://www.linkedin.com/search/results/people/?keywords=<termo>`. Para conectar, botão **Conectar** no perfil (às vezes dentro de "Mais").
- **YouTube**: busca `https://www.youtube.com/results?search_query=<termo>`, vídeo `/watch?v=<id>`, canal `/@<nome>`, shorts `/shorts/<id>`. Título, canal e visualizações ficam na página do vídeo; a descrição abre em "...mais"; os comentários carregam ao rolar.
- **Google**: `https://www.google.com/search?q=<termo>`. Leia os resultados com `navegador_ler` e abra o link certo. Mapas: `https://www.google.com/maps/search/<termo>`.

## 7. Boas práticas
- Prefira a **URL direta** (perfil, busca, `send?phone=`) a clicar por muitos menus: é mais rápido e erra menos.
- Para **ler muito conteúdo**, use `navegador_js` e devolva só o texto que importa (corte com `.slice`). Para **entender o visual**, use o print.
- Se algo falhar, mude o caminho: outro endereço, a busca do próprio site, a busca do Google, outro seletor. Duas ou três tentativas diferentes antes de dizer que não deu.
- Termine sempre dizendo o que foi feito e mostrando o resultado (os dados lidos, o link da publicação, a mensagem enviada).
- Sites mudam de layout com frequência. Os nomes aqui são pistas: confirme com `navegador_ler` ou o print antes de agir.
