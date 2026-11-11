// Lógica pura da extensão (sem APIs do Chrome), para testar em Node: reconhecer o endereço de retorno do login e montar os textos das ferramentas.
// Os mesmos formatos do navegador integrado do app (navegador.js), para o Hermes receber a mesma coisa nos dois.

// (protocolo, host, porta e caminho iguais; localhost e 127.0.0.1 valem o mesmo; barra final tolerada)
export function ehRetorno(url, prefixo) {
  if (!url || typeof url !== 'string') return false
  try {
    const u = new URL(url), p = new URL(prefixo)
    const local = ['localhost', '127.0.0.1']
    const hostIgual = u.hostname === p.hostname || (local.includes(u.hostname) && local.includes(p.hostname))
    return u.protocol === p.protocol && hostIgual && (u.port || '80') === (p.port || '80') && u.pathname.replace(/\/$/, '') === p.pathname.replace(/\/$/, '')
  } catch {
    return false
  }
}

export function lerRetorno(url) {
  const u = new URL(url)
  return { url, code: u.searchParams.get('code'), state: u.searchParams.get('state'), erro: u.searchParams.get('error_description') || u.searchParams.get('error') }
}

// só http e https: nada de chrome://, file:// nem javascript:
export function urlPermitida(u) {
  return /^https?:\/\//i.test(String(u || '').trim())
}

// texto devolvido por `ler` (igual ao do navegador integrado)
export function textoLer(r) {
  const els = r.elementos.map((e) => `[${e.id}] ${e.tipo}${e.texto ? ' "' + e.texto + '"' : ''}${e.href ? ' → ' + e.href : ''}`).join('\n')
  return `Título: ${r.titulo}\nURL: ${r.url}\nRolagem: ${r.rolagem.y}/${r.rolagem.altura} (janela ${r.rolagem.janela})\n\n--- TEXTO DA PÁGINA ---\n${r.texto}\n\n--- ELEMENTOS CLICÁVEIS (use o número em navegador_clicar e navegador_digitar) ---\n${els || '(nenhum)'}`
}

export const MAX_TEXTO = 14000
