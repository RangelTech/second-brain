# Kit "cinema" — referência para escrever os planos (shots.js)

Mundo 1080x1920 (vertical). `CHAO = 1250` é a linha do chão (pés dos personagens). Legenda fica na faixa y 1340–1460: nada importante ali.
Todo plano: `SHOTS.push({ start, end, tr, draw(ctx, lt, t, dur) { ... } })`. `lt` = segundos dentro do plano, `t` = segundos do filme, `dur` = duração do plano.
`tr` (transição para o próximo) = `'whip'` (chicote rápido, ação), `'cut'` (corte seco) ou `'fade'` (escurece; mudança de tempo/lugar).
Ordem dentro de draw: 1) `const cam = camera(...)`; 2) `cenario(...)`; 3) objetos e atores; 4) efeitos (vinheta, chuva, flash...).

## Câmera
`camera(lt, dur, {tipo, foco:[x,y], zoom, de, para, forca})` → cam. Tipos: `empurra` (aproxima devagar, padrão), `afasta`, `pan` (x de→para),
`sobe`, `desce`, `treme` (impacto/susto, `forca` 20–40), `zoom_rapido` (revelação). Nunca 3 planos seguidos com o mesmo tipo.

## Cenários — `cenario(nome, ctx, t, cam, opcoes)`
- `quarto_noite` {armario: 0..1 (porta do armário abre), olhosArmario: bool, abajur: 0..1, chuva: bool, sombraJanela: 0..1}
- `corredor_escuro` {pisca: bool (luz falhando), portaFundoAberta: bool}
- `rua_noite` {posteX, posteLuz: 0..1, chuva: bool}
- `floresta_noite` {}   · `cemiterio` {nomeLapide}   · `estrada_noite` {farois: 0..1}
- `sala_aula` {lousa: 'texto curto'}   · `escritorio` {quadro, tela: '#cor'}   · `cozinha` {}
- `campo_dia` {}   · `cidade_dia` {}   · `praia` {}   · `espaco` {}   · `palco` {holofoteX, fundo, chao} (genérico p/ explicar)
Depois de `cenario()` a câmera fica aplicada: desenhe atores/objetos em coordenadas do mundo.

## Ator — `ator(ctx, t, lt, {...})`
`quem`: `heroi` · `heroina` · `amigo` · `amiga` · `idoso` · `crianca` · `policial` · `medico` · `chefe` · `pirata` · `marinheiro` (ou objeto `{cols:['#cor','#listra'], hat:'cabelo'|'coque'|'bone'|'careca'|'bandana', cabelo:'#cor'}`)
`x`, `y` (padrão CHAO), `s` (tamanho, padrão 520; perto da câmera 800–1400), `dir` (1 olha p/ direita, -1 esquerda)
`acao`: `parado` · `andar` · `correr` (use `x0`,`x1`,`de`,`ate`) · `assustado` (pula para trás, `de` = quando) · `tremer` · `apontar` · `acenar` ·
`pensar` · `comemorar` · `cair` · `sentado` · `deitado` · `celular` · `falar` · `esconder` · `empurrar` · `segurar`
`humor`: `normal` · `feliz` · `triste` · `medo` · `raiva` · `surpreso` · `desconfiado` · `serio` · `tonto` · `morto`
`segura`: `'lanterna'` (com cone de luz) · `'vela'` · `'celular'` · `'papel'` · `'dinheiro'` · `'faca'`
`silhueta: true` (vulto preto com olhos brancos) · `alpha` · `olhar:[x,y]` (-1..1) · `inclina` (rad)

## Objetos (props)
`porta(ctx,x,y,s,abre0a1,cor,escuroAtras,luzAtras)` · `cama(ctx,x,y,s)` · `mesa(ctx,x,y,larg)` · `cadeira(ctx,x,y,s)` · `vela(ctx,x,y,s,t,acesa)`
`coneLuz(ctx,x,y,ang,alcance,abertura,forca)` · `celular(ctx,x,y,s,corTela,{texto}|{img:IMG.k})` · `tv(ctx,x,y,s,IMG.k|null,ligada,t)`
`fotoQuadro(ctx,x,y,w,h,IMG.k,'polaroide'|'quadro',ang)` · `carro(ctx,x,y,s,cor,t,farol,flip)` · `arvore(ctx,x,y,s,cor)` · `relogio(ctx,x,y,r,h,min)`
`dinheiro(ctx,x,y,maços,s)` · `caixa(ctx,x,y,w,h,cor,rotulo)` · `livro(ctx,x,y,s,cor,aberto)` · `lapide(ctx,x,y,s,cor,texto,inclina)`
`vulto(ctx,x,y,s,alpha,t)` (sombra com olhos vermelhos) · `fantasma(ctx,x,y,s,t,alpha)` · `balao(ctx,x,y,'texto curto',larg,lado)`
`placa(ctx,x,y,'texto',larg)` (texto SÓ dentro de objeto) · `drawBarrel` `drawCrate` `drawCloud(ctx,x,y,s,seed)` `drawSun` `lua(ctx,x,y,r,t)`
Imagens reais buscadas na web ficam em `IMG.img1`, `IMG.img2`... (use em tv/fotoQuadro/celular).

## Efeitos
`vinheta(ctx, forca)` · `chuva(ctx,t,forca)` · `raio(ctx,t,quando)` · `flash(ctx,lt,quando,'255,0,0')` · `poeira(ctx,t,n)` · `neblina(ctx,t,y,forca)`
`escurecer(ctx, 0..1)` · `tinta(ctx,'vermelho'|'azul'|'sepia'|'verde'|'roxo',forca)` · `puff(ctx,x,y,r,t,cor,seed,alpha)` (fumaça/poeira)
`burst(ctx,x,y,r)` (estrela de impacto) · `sparkle(ctx,x,y,r,a)` · `sweat(ctx,x,y,s,a)`

## Animar no tempo
`kf(lt, [[t0,v0],[t1,v1],...])` (keyframes com easing) · `lerp(a,b,k)` · `clamp(v)` · `ease/easeOut/easeIn/backOut(k)` · `shake(t,amp)` · `rng(seed)()`
Desenho livre (canvas 2D): `circle/ellipse/rrect/path(ctx,...)` + `fillStroke(ctx,cor,espessura)` · `line(ctx,x1,y1,x2,y2,esp,cor)` · `text(ctx,s,x,y,tam,cor)`.
Contorno de tinta `INK` (#221c22), espessura 5–6, cores chapadas: desenhe bichos/objetos novos assim (ex.: gato = elipse + círculo + orelhas).

## Regras de direção (o que faz o vídeo ser bom)
1. Um acontecimento por plano, e ele acontece NA palavra (use a fala e os tempos do plano).
2. A animação conta a história sem som: ação, objeto e luz mostram a ideia. Nada de cartão de texto, título solto ou lista na tela.
3. Câmera viva em todo plano; varie o tipo; `treme`/`zoom_rapido` só no susto/revelação.
4. Personagem sempre visível e grande o bastante; cenário combina com o que a fala diz (história de terror = noite, pouca luz, um ponto de luz).
5. Tudo determinístico (só depende de lt/t). Nada de Math.random (use `rng(seed)`).
