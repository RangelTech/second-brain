# Navegador WebAssembly da versão web (spec 60 §8)

Na versão web do Cérebro Pro o painel "Navegador" é um navegador de verdade rodando **dentro da aba do cliente**: o motor Gecko
(Firefox) compilado para WebAssembly ([HeyPuter/firefox-wasm](https://github.com/HeyPuter/firefox-wasm), MPL-2.0, pacote
`gecko.js` da release v0.0.1). A internet do motor sai pelo relay Wisp de São Paulo. O agente (na VM ou no PC) controla o motor
pelas mesmas ferramentas `navegador_*`.

```
aba do cliente (app.segundocerebro.pro, isolada: COOP same-origin + COEP credentialless)
 └─ <iframe allow="cross-origin-isolated"> https://nav.rangeltech.net/?embutido=1&t=<passe>
     └─ motor Gecko (WebAssembly) ──wss──> nav.rangeltech.net/wisp/ (relay) ──TCP──> internet (IP de SP)
agente (VM/PC) ── ponte ── renderer/nav-wasm-web.js ──postMessage──> window.cerebroNav (index.html)
```

## Peças
| Arquivo | Onde roda | O que faz |
|---|---|---|
| `index.html` | `nav.rangeltech.net/` | página do motor: barra própria (some com `?embutido=1`), API `window.cerebroNav` e ponte `postMessage` |
| `sw.js` | idem | guarda `/motor/<versão>/` no Cache Storage (o cache HTTP do Chrome não guarda o `.wasm` de 150 MB) |
| `Caddyfile` | KingHost, contêiner `nav-caddy` | HTTPS automático, COOP/COEP/CORP, `frame-ancestors`, `/wisp/` para o relay, motor pré-compactado |
| `relay/` | KingHost, contêiner `wisp-relay` | relay Wisp; aceita `?t=<WISP_CHAVE>` (teste) ou passe `dados.assinatura` (HMAC com `WISP_SEGREDO`) emitido pela ponte em `POST /api/nav-passe` |
| `../navegador-wasm.js` | app (VM/PC) | registro das abas, pedidos/respostas, sites da pasta de trabalho (`/m/<máquina>/site/<chave>/...`) |
| `../renderer/nav-wasm-web.js` | aba web | monta o quadro, pré-aquece no envio da mensagem, repassa os pedidos do agente |

Segredos: cofre `secrets/nav-wisp-relay.env` (`WISP_CHAVE`, `WISP_SEGREDO`). A ponte precisa de `WISP_SEGREDO` no ambiente.
**Nunca rotacionar.**

## API do motor (`window.cerebroNav`, também por `postMessage {sbNav:1,id,metodo,args}`)
`abrir(url)`, `info()`, `avaliar(expr)` (aceita Promise; devolve JSON), `clicarPonto(x,y)` (mouse de verdade), `inserir(texto)`
(tecla por tecla até 24 caracteres; acima disso `insertText`), `tecla(nome)`, `rolarPonto(dy,x,y)`, `voltar()`, `avancar()`,
`recarregar()`, `printPng()`. No modo embutido o `evalChrome` do gecko.js roda **no contexto da própria página** (não há `Services`).

## Armadilhas medidas (25–26/11/2026)
- Comando ao motor antes de `init()` terminar quebra a fila interna do gecko.js para sempre (`this.mod` nulo). Por isso `motorPronto`.
- `load('about:blank')` nunca termina e trava a fila. Nunca abrir `about:blank`.
- O Chrome recusa `Content-Encoding: zstd` com janela maior que 8 MB (`ERR_ZSTD_WINDOW_SIZE_TOO_BIG`): o `.zst` da release não serve
  como pré-compactado. Recompactar com `windowLog 23` (abaixo).
- O cache HTTP não guarda o `.wasm` (passa do limite por entrada): sem o service worker, cada abertura baixava 35 MB de novo.
- Medido no PC do Lucas: 1ª visita ~8–10 s; depois ~3 s sozinho e ~5 s dentro do app (o pré-aquecimento esconde isso).
- Testes com Chrome headless: fechar as abas (`Target.closeTarget`); cada aba esquecida deixa um motor rodando e tudo fica lento.

## Implantar (KingHost 177.153.38.54, chave `secrets/kinghost-ssh/kinghost_proxy`)
```sh
# motor: baixar gecko.js da release do firefox-wasm, depois no servidor:
cd /opt/nav-web/srv/motor/0.0.1
docker run --rm -v $PWD:/s -w /s node:22-alpine node -e '
const fs=require("fs"),z=require("zlib");const b=z.zstdDecompressSync(fs.readFileSync("gecko.wasm.zst.release"));
fs.writeFileSync("gecko.wasm",b);fs.writeFileSync("gecko.wasm.gz",z.gzipSync(b,{level:9}));
fs.writeFileSync("gecko.wasm.zst",z.zstdCompressSync(b,{params:{[z.constants.ZSTD_c_compressionLevel]:19,[z.constants.ZSTD_c_windowLog]:23}}))'
# página e service worker: /opt/nav-web/srv/{index.html,sw.js}; Caddyfile: /opt/nav-web/Caddyfile
docker exec nav-caddy caddy reload --config /etc/caddy/Caddyfile
# relay: /opt/wisp-relay (Dockerfile, package.json, servidor.mjs, .env com WISP_CHAVE e WISP_SEGREDO, chmod 600)
docker build -t wisp-relay:2 /opt/wisp-relay && docker rm -f wisp-relay && \
  docker run -d --name wisp-relay --restart unless-stopped --network nav --env-file /opt/wisp-relay/.env -p 31443:8080 wisp-relay:2
```
Versão nova do motor = pasta nova `motor/<versão>/` + `index.html` apontando para ela + `CACHE` novo no `sw.js`.
DNS: `nav.rangeltech.net` A 177.153.38.54 (Hostinger, `secrets/api_key_hostinger.json`).
