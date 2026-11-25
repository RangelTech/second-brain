// Gera public/termos-de-uso/index.html a partir do texto mais novo em termos/*.md (o mesmo arquivo que o llm-access publica em /v1/termos).
// Uso: node gerar-termos.js   (rode depois de copiar a versão nova do texto para termos/)
const fs = require('fs'), path = require('path')
const { renderMd } = require('./public/assets/termos.js')
const dir = path.join(__dirname, 'termos')
const arq = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort().pop()
const versao = arq.replace(/\.md$/, '')
const corpo = renderMd(fs.readFileSync(path.join(dir, arq), 'utf8'))
const V = '0.1.21'
const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Termos de uso · Segundo Cérebro</title>
<meta name="description" content="Termos de uso do Segundo Cérebro, versão ${versao}.">
<link rel="icon" type="image/png" href="/assets/favicon.png">
<link rel="stylesheet" href="/assets/style.css?v=${V}">
<script>try{var t=localStorage.getItem('tema');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
</head>
<body>
<header class="topo"><div class="wrap"><a class="marca" href="/"><img src="/assets/img/logo.png" alt="" width="34" height="34">Segundo Cérebro</a></div></header>
<main class="wrap pag termos-pag" id="texto">
${corpo}
<p><a href="/termos-de-uso/verificar/">Conferir um comprovante de aceite</a></p>
</main>
<script src="/assets/config.js?v=${V}"></script>
<script src="/assets/termos.js?v=${V}"></script>
<script>
// pedido de uma versão antiga (?versao=AAAA-MM-DD, vinda do e-mail de comprovante): carrega do servidor
(function () {
  var v = new URLSearchParams(location.search).get('versao')
  if (!v || v === '${versao}') return
  fetch((window.BRAIN.api || '') + '/v1/termos/versao/' + encodeURIComponent(v)).then(function (r) { return r.ok ? r.json() : null }).then(function (j) {
    if (j) document.getElementById('texto').innerHTML = window.BrainTermos.renderMd(j.texto)
  })
})()
</script>
</body>
</html>
`
fs.writeFileSync(path.join(__dirname, 'public', 'termos-de-uso', 'index.html'), html)
console.log('termos-de-uso/index.html gerado, versão', versao)
