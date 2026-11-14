---
name: gods-eye-view
description: |
  Globo 3D no navegador com dados públicos ao vivo (aviões, navios, satélites, terremotos, câmeras públicas). Use só como app de demonstração que o cliente sobe na máquina virtual.
  Use quando o cliente disser: "quero um globo 3D com aviões e satélites ao vivo"; "painel de mapa com dados públicos"; "demonstração de monitoramento global".
---

# God's Eye View

> **Validada na bancada (parcial):** build testado; servidor de dados e globo em navegador não foram executados.

## Quando usar
Cliente quer um painel/globo de monitoramento de sinais públicos para demonstração ou estudo (ideia de produto, apresentação).

## Quando NÃO usar
Não é infraestrutura do Cérebro Pro. Pede navegador com WebGL (GPU do usuário); não use em máquina sem tela.

## Combina com
`site-na-maquina-virtual` (publicar o `dist`), `playwright` (conferir a página).

## Receita validada na bancada (parcial)
```bash
git clone --depth 1 https://github.com/bilawalsidhu/gods-eye-view && cd gods-eye-view
npm ci            # 99 s
npm run build     # 39 s, dist/ com 74 MB
npm run doctor    # checa o ambiente
npm run dev       # desenvolvimento (vite)
```
Teste: `npm ci` e `npm run build` terminaram sem erro. A pasta `server/` serve os dados; o README diz que começa sem chaves de API (chaves opcionais ampliam as fontes).

## Armadilhas
- Não abri o globo nem o servidor: falta confirmar dados ao vivo e uso de CPU.
- Aviso de chunks grandes no build (inofensivo). `dist` de 74 MB pesa para servir.
- Controle por voz usa IA em tempo real com chave opcional (não habilitar sem ordem do cliente).

## Tempo e recursos medidos
clone ok, `npm ci` 99 s, build 39 s, `dist` 74 MB.
