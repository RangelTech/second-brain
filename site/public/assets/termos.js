// Termos de uso: converte o texto (markdown simples) em HTML e carrega a versão vigente do servidor.
// Usado na caixa de aceite (definir senha, teste grátis, checkout) e, no Node, pelo gerar-termos.js.
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica()
  else raiz.BrainTermos = fabrica()
})(typeof self !== 'undefined' ? self : this, function () {
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
  function inline(s) { return esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>') }
  function renderMd(md) {
    var out = [], lista = false
    String(md).replace(/\r/g, '').split('\n').forEach(function (l) {
      var t = l.trim()
      if (/^[a-z]\) /.test(t)) { if (!lista) { out.push('<ul class="termos-lista">'); lista = true } out.push('<li>' + inline(t) + '</li>'); return }
      if (lista) { out.push('</ul>'); lista = false }
      if (!t) return
      if (t.indexOf('# ') === 0) out.push('<h1>' + inline(t.slice(2)) + '</h1>')
      else if (t.indexOf('## ') === 0) out.push('<h2>' + inline(t.slice(3)) + '</h2>')
      else out.push('<p>' + inline(t) + '</p>')
    })
    if (lista) out.push('</ul>')
    return out.join('\n')
  }
  // busca a versão vigente no servidor e põe na caixa; devolve uma promessa com { versao, sha256 }
  function carregar(api, caixa) {
    return fetch((api || '') + '/v1/termos').then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json() }).then(function (j) {
      if (caixa) caixa.innerHTML = renderMd(j.texto)
      return { versao: j.versao, sha256: j.sha256 }
    })
  }
  return { renderMd: renderMd, carregar: carregar }
})
