// E2E do site (termos, cupom, /assinar) contra um llm-access local, num Chrome real. Nada de produção.
const { spawn } = require('child_process')
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http')
const { lancar, aba, sleep } = require('./cdp.js')

const ACCESS = 'C:/Users/lucas.rangel/Desktop/Codex/qwen-abliterated-api/access'
const SITE = 'C:/Users/lucas.rangel/Desktop/new_ragente/repos/segundo_cerebro_site/public'
const API_PORT = 8791, SITE_PORT = 9711
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-site-'))
const siteTmp = path.join(tmp, 'site')
fs.cpSync(SITE, siteTmp, { recursive: true })
let cfg = fs.readFileSync(path.join(siteTmp, 'assets/config.js'), 'utf8')
cfg = cfg.replace(/https:\/\/qwen\.rangeltech\.net/g, `http://127.0.0.1:${API_PORT}`).replace(/https:\/\/pay\.cakto\.com\.br\//g, `http://127.0.0.1:${SITE_PORT}/pagar/`)
fs.writeFileSync(path.join(siteTmp, 'assets/config.js'), cfg)
fs.mkdirSync(path.join(siteTmp, 'pagar'), { recursive: true })
fs.writeFileSync(path.join(siteTmp, 'pagar/index.html'), '<h1 id="x">PAGAMENTO FALSO</h1>')

const falhas = []
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) falhas.push(m) }
const post = (porta, p, body, h = {}) => new Promise((res, rej) => { const d = JSON.stringify(body); const r = http.request({ host: '127.0.0.1', port: porta, path: p, method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(d), ...h } }, (x) => { let b = ''; x.on('data', (c) => (b += c)); x.on('end', () => res({ s: x.statusCode, j: (() => { try { return JSON.parse(b) } catch { return b } })(), h: x.headers })) }); r.on('error', rej); r.end(d) })

;(async () => {
  const procs = []
  const api = spawn('python', ['-m', 'uvicorn', 'app.main:create_app', '--factory', '--port', String(API_PORT)], { cwd: path.join(ACCESS, '..', 'access'), env: { ...process.env, PYTHONPATH: ACCESS, ACCESS_DB_PATH: path.join(tmp, 'a.db'), ADMIN_PASSWORD: 'adm-12345678', SESSION_SECRET: 'x'.repeat(32), SITE_ORIGINS: `http://127.0.0.1:${SITE_PORT}`, CAKTO_WEBHOOK_SECRET: 'seg', UPSTREAM_URL: 'http://127.0.0.1:1', UPSTREAM_KEY: 'k', UPSTREAM_ADMIN_KEY: 'k', ACCESS_QA_MODE: '0' }, stdio: 'ignore' })
  procs.push(api)
  const site = spawn('python', ['-m', 'http.server', String(SITE_PORT), '--directory', siteTmp, '--bind', '127.0.0.1'], { stdio: 'ignore' }); procs.push(site)
  let chrome
  try {
    for (let i = 0; i < 60; i++) { try { await new Promise((r, j) => http.get(`http://127.0.0.1:${API_PORT}/health`, (x) => (x.statusCode === 200 ? r() : j())).on('error', j)); break } catch { await sleep(500) } }
    const login = await post(API_PORT, '/admin/api/login', { password: 'adm-12345678' })
    const cookie = (login.h['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ')
    ok(login.s === 200, 'login do admin local')
    const afil = await post(API_PORT, '/admin/api/afiliados', { nome: 'Maria Influencer', cupom: 'MARIA10', links: [{ produto: 'max_mensal', url: 'https://127.0.0.1:1/pay/ofmax?affiliate=af9', preco: '447,30' }, { produto: 'max_anual', url: 'https://127.0.0.1:1/pay/ofmaxa?affiliate=af9', preco: '4473' }] }, { cookie })
    ok(afil.s === 200, 'afiliado criado pelo painel (API): ' + afil.s)

    chrome = await lancar({ porta: 9341 })
    const p = await aba(chrome.porta, 'about:blank')

    // 1. cupom pela URL na home
    await p.ir(`http://127.0.0.1:${SITE_PORT}/?cupom=maria10`)
    await p.espera(() => 'document.querySelector("#cupom-msg") && !document.querySelector("#cupom-msg").hidden', 10000)
    ok((await p.js('document.querySelector("#cupom-msg").textContent')).includes('Maria Influencer'), 'home: faixa do cupom com o nome do afiliado')
    ok((await p.js('document.querySelector("#cupom-msg").textContent')).includes('10%'), 'home: percentual de desconto calculado (10%)')
    await p.js('document.querySelector(\'.alterna button[data-ciclo="mensal"]\').click()')
    await sleep(300)
    const cards = await p.js('Array.from(document.querySelectorAll("#planos .plano")).map(c=>({t:(c.querySelector("h3")||{}).textContent,l:(c.querySelector(".cupom-linha")||{}).textContent||"",href:(c.querySelector("[data-plano]")||{}).href||""}))')
    const max = cards.find((c) => c.t === 'Max'), lite = cards.find((c) => c.t === 'Lite')
    ok(max && /447,30/.test(max.l) && /-10%/.test(max.l), 'card Max mostra o preço do cupom: ' + (max && max.l.replace(/\s+/g, ' ')))
    ok(lite && /não vale para este plano/.test(lite.l), 'card Lite diz que o cupom não vale')
    ok(max && /\/assinar\/\?produto=max_mensal&cupom=MARIA10/.test(max.href), 'botão do Max vai para /assinar com produto e cupom: ' + (max && max.href))
    ok(lite && /produto=lite_mensal/.test(lite.href), 'botão do Lite vai para /assinar do Lite (o cupom acompanha; o servidor ignora onde não vale)')

    // cupom inexistente
    await p.ir(`http://127.0.0.1:${SITE_PORT}/`)
    await p.js('localStorage.removeItem("cupom")')
    await p.js('document.querySelector("#cupom-abrir").click(); document.querySelector("#cupom-campo").value="NAOEXISTE"; document.querySelector("#cupom-form").requestSubmit()')
    await p.espera(() => 'document.querySelector("#cupom-msg").textContent.includes("não encontrado")', 8000)
    ok(true, 'home: cupom inexistente mostra erro')

    // 2. página /assinar
    await p.ir(`http://127.0.0.1:${SITE_PORT}/assinar/?produto=max_mensal&cupom=MARIA10`)
    await p.espera(() => 'document.querySelector("#r-cupom") && !document.querySelector("#r-cupom").hidden', 8000)
    ok(/447,30/.test(await p.js('document.querySelector("#r-preco").textContent')), '/assinar: resumo com o preço do afiliado')
    await p.js('document.querySelector("#email").value="cli@exemplo.com"; document.querySelector("#nome").value="Cli Teste"')
    await p.js('document.querySelector("#f").requestSubmit()')
    ok(/aceita os Termos/.test(await p.js('document.querySelector("#m").textContent')), '/assinar: sem aceitar os termos não segue')
    await p.espera(() => '!document.querySelector("#caixa").textContent.includes("Carregando")', 8000)
    ok((await p.js('document.querySelector("#caixa").textContent')).includes('Usos proibidos'), '/assinar: texto dos termos carregado do servidor')
    await p.js('document.querySelector("#aceite").click(); document.querySelector("#f").requestSubmit()')
    await p.espera(() => '!document.querySelector("#pag-quadro").hidden', 10000)
    const src = await p.js('document.querySelector("#quadro").src')
    ok(/127\.0\.0\.1:1\/pay\/ofmax\?/.test(src) && /affiliate=af9/.test(src) && /callback=/.test(src) && /email=cli%40exemplo.com/.test(src), 'iframe aponta para o link do afiliado com callback e e-mail: ' + src)
    const token = new URL(src).searchParams.get('callback')
    const est1 = await new Promise((r) => http.get(`http://127.0.0.1:${API_PORT}/v1/checkout/${token}`, (x) => { let b = ''; x.on('data', (c) => (b += c)); x.on('end', () => r(JSON.parse(b))) }))
    ok(est1.estado === 'aberto', 'sessão aberta no servidor')
    // aceite gravado
    const acc = await new Promise((r) => http.get({ host: '127.0.0.1', port: API_PORT, path: '/admin/api/termos/aceites?email=cli@exemplo.com', headers: { cookie } }, (x) => { let b = ''; x.on('data', (c) => (b += c)); x.on('end', () => r(JSON.parse(b))) }))
    ok(acc.aceites.length === 1 && acc.aceites[0].canal === 'checkout', 'aceite dos termos gravado com canal checkout')
    // 3. webhook de aprovação -> a página muda sozinha
    const wh = await post(API_PORT, '/v1/billing/cakto', { event: 'purchase_approved', event_id: 'ev-e2e', data: { id: 'ev-e2e', customer: { email: 'cli@exemplo.com', name: 'Cli' }, product: { name: 'Cérebro Pro Max' }, amount: 447.3, callback: token, subscription: { id: 's1' } } }, { 'x-webhook-secret': 'seg' })
    ok(wh.s === 200, 'webhook aprovado recebido')
    await p.espera(() => '!document.querySelector("#pag-ok").hidden', 12000)
    ok(true, '/assinar: a página mostrou "Pagamento aprovado" sozinha')
    const vendas = await new Promise((r) => http.get({ host: '127.0.0.1', port: API_PORT, path: '/admin/api/afiliados', headers: { cookie } }, (x) => { let b = ''; x.on('data', (c) => (b += c)); x.on('end', () => r(JSON.parse(b))) }))
    ok(vendas.afiliados[0].vendas === 1, 'venda atribuída ao afiliado no painel')

    // 4. definir-senha exige o aceite
    const setup = await post(API_PORT, '/admin/api/subscribers/1/password-link', {}, { cookie })
    const tok = String(setup.j.setup_link || '').split('token=')[1]
    await p.ir(`http://127.0.0.1:${SITE_PORT}/definir-senha/?token=${tok}`)
    await p.espera(() => '!document.querySelector("#aceite").disabled', 8000)
    await p.js('document.querySelector("#s1").value="senha-forte-123"; document.querySelector("#s2").value="senha-forte-123"; document.querySelector("#f").requestSubmit()')
    ok(/aceita os Termos/.test(await p.js('document.querySelector("#m").textContent')), 'definir-senha: sem a caixa marcada não salva')
    await p.js('document.querySelector("#aceite").click(); document.querySelector("#f").requestSubmit()')
    await p.espera(() => '!document.querySelector("#fim").hidden', 10000)
    ok(true, 'definir-senha: com o aceite a senha é salva')
    // 5. verificar comprovante
    const acc2 = await new Promise((r) => http.get({ host: '127.0.0.1', port: API_PORT, path: '/admin/api/termos/aceites?limit=10', headers: { cookie } }, (x) => { let b = ''; x.on('data', (c) => (b += c)); x.on('end', () => r(JSON.parse(b))) }))
    const cod = acc2.aceites[0].codigo
    await p.ir(`http://127.0.0.1:${SITE_PORT}/termos-de-uso/verificar/?codigo=${cod}`)
    await p.espera(() => '!document.querySelector("#res").hidden', 8000)
    ok(/Aceite válido/.test(await p.js('document.querySelector("#res").textContent')), 'página de verificação confirma o comprovante')
    const integ = await new Promise((r) => http.get({ host: '127.0.0.1', port: API_PORT, path: '/admin/api/termos/integridade', headers: { cookie } }, (x) => { let b = ''; x.on('data', (c) => (b += c)); x.on('end', () => r(JSON.parse(b))) }))
    ok(integ.ok && integ.registros >= 1, 'integridade da corrente: ' + JSON.stringify(integ))
    // /termos-de-uso estático
    await p.ir(`http://127.0.0.1:${SITE_PORT}/termos-de-uso/`)
    ok((await p.js('document.body.innerText')).includes('Tolerância zero'), 'página /termos-de-uso/ traz o texto completo')
  } catch (e) {
    console.log('ERRO', e.message); falhas.push(e.message)
  } finally {
    try { chrome && chrome.fechar() } catch {}
    procs.forEach((p) => { try { p.kill() } catch {} })
  }
  console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTUDO CERTO')
  process.exit(falhas.length ? 1 : 0)
})()
