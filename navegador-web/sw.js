// Guarda o motor do navegador (arquivos versionados em /motor/<versão>/) no Cache Storage deste navegador: baixa uma vez só.
// O cache HTTP do Chrome não guarda o .wasm (passa do limite por entrada). Versões antigas são apagadas ao ativar uma nova.
const CACHE = 'motor-v2'
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k)
  await self.clients.claim()
})()))
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url)
  if (u.origin !== location.origin || !u.pathname.startsWith('/motor/') || e.request.method !== 'GET') return
  e.respondWith((async () => {
    const c = await caches.open(CACHE)
    const achou = await c.match(u.pathname)
    if (achou) return achou
    const r = await fetch(e.request)
    // repassa em streaming (o navegador já compila enquanto baixa) e guarda a cópia em paralelo
    if (r.ok) e.waitUntil(c.put(u.pathname, r.clone()).catch(() => {}))
    return r
  })())
})
