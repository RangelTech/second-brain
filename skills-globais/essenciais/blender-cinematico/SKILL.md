---
name: blender-cinematico
description: |
  Criar cenas 3D cinematográficas COM CÓDIGO no Blender (sem abrir a interface, sem baixar modelos): produto girando em estúdio, câmera em órbita com profundidade de campo, luz de cinema, e o vídeo pronto para site (rolagem quadro a quadro), reels ou apresentação. Grátis e local. Use quando pedirem "vídeo 3D do produto", "produto girando", "animação 3D", "cena cinematográfica", "vídeo para a rolagem do site", ou quando a IA de vídeo paga não for necessária.
---

# Blender em código (cenas 3D cinematográficas, grátis)

Referência que inspirou: um curta de 36 s feito pelo Claude Code comandando o Blender em Python, sem modelos baixados (biblioteca do usuário, item 24). Mesmo método aqui.

## O que precisa
- **Blender 5.2 LTS portátil** em `~/.segundo-cerebro/ferramentas/blender-5.2.4-<sistema>/` (o app/a skill baixa do snapshot nosso; não instale pelo instalador do Windows).
- Script pronto: `scripts/cena_produto.py` (pedestal, produto, 4 luzes de estúdio, câmera em órbita com início e fim suaves e foco no produto).
- Roda SEM tela: `blender -b -P cena_produto.py -- <opções>`.

## Passo a passo
1. Teste rápido (sempre): 2 a 3 quadros pequenos e OLHE:
   `blender -b -P cena_produto.py -- --saida "Videos/3d/teste" --quadros 3 --largura 640 --altura 360 --amostras 16`
   A primeira vez leva ~3 min (o Blender compila os shaders); depois ~3 s por quadro pequeno.
2. Ajuste e repita até ficar bom: produto apoiado no pedestal (não flutuando), enquadramento com o produto inteiro em todos os quadros, luz sem estourar.
3. Render final: `--quadros 120 --largura 1280 --altura 720 --amostras 64` (32 deixa granulado no chão) (≈ 5 a 8 s por quadro num notebook; 120 quadros ≈ 10 a 15 min). Rode em primeiro plano e acompanhe até o fim.
4. Vídeo: `ffmpeg -framerate 30 -i "pasta/%04d.png" -c:v libx264 -pix_fmt yuv420p -crf 16 produto.mp4`.
5. Use: rolagem do site (`sites-cinematograficos/scripts/quadros.py` direto da pasta de PNGs ou do MP4), reel (Motion por cima), apresentação.

## Opções do script
`--produto perfume|relogio|tenis` (formas prontas; para outro produto, edite a seção "produto" do script com primitivas: cubo, cilindro, esfera + chanfro + suavização) · `--cor "#7a3e0e"` (cor principal) · `--fundo "#05060a"` · `--volta 300` (graus de órbita) · `--quadros`, `--largura`, `--altura`, `--amostras`.

## Regras de cinema que funcionam
- **Um movimento só e contínuo** de câmera (órbita lenta com subida leve, ou aproximação). Início e fim suaves (ease in/out). Nada de cortes no mesmo vídeo.
- **Luz de estúdio de 3 pontos**: chave (lateral-frente, forte e grande), recorte (atrás, quente), contra/fundo (fria). Fundo escuro com degradê. Pedestal brilhante com verniz (reflexo do produto).
- **Profundidade de campo** com foco no produto (f/2 a f/2.8, lente 50 a 70 mm).
- Cor: a do produto/marca + dourado/metal para detalhe. Visual "AgX Punchy".
- Vidro transparente de verdade no motor rápido (EEVEE) reflete o fundo escuro e sai preto: use vidro laqueado (cor + verniz) ou, se precisar de vidro realista, troque para o Cycles (bem mais lento).

## Limites (diga ao usuário)
- Formas feitas de primitivas: ótimo para produto estilizado, cena abstrata, peças, logo 3D; NÃO é fotorrealista como foto de estúdio.
- Para realismo de foto/vídeo (carro real, pessoa, imóvel real): IA de vídeo no Estúdio (créditos) a partir de uma foto, com prompt de câmera ("Arc Right", "Dolly In").
- Casa/imóvel real navegável a partir de vídeo do corretor: técnica de Gaussian Splatting (precisa GPU NVIDIA; ver skill de tour 3D quando existir).
