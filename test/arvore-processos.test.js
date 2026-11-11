const test = require('node:test')
const assert = require('node:assert')
const { spawn, spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { descendentes, matarArvorePoupandoGateway } = require('../agent')

// Usa Python (como o Hermes): no Windows, filhos de processos Node morrem com o pai (job object do libuv) e não representam o caso real.
const PY = ['python', 'python3'].find((p) => { try { return spawnSync(p, ['--version']).status === 0 } catch { return false } })
const vivo = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

// pai -> filho -> neto (o "neto" faz o papel do gateway: filho do primeiro agente que o iniciou, mas serve todos os chats)
function criarArvore() {
  const neto = 'import time;time.sleep(600)'
  const filho = `import subprocess,sys,time;n=subprocess.Popen([sys.executable,'-c',${JSON.stringify(neto)}]);print(n.pid,flush=True);time.sleep(600)`
  const pai = `import subprocess,sys,time;f=subprocess.Popen([sys.executable,'-c',${JSON.stringify(filho)}],stdout=subprocess.PIPE);print(f.pid,flush=True);print(f.stdout.readline().decode().strip(),flush=True);time.sleep(600)`
  return new Promise((resolve) => {
    const p = spawn(PY, ['-c', pai], { stdio: ['ignore', 'pipe', 'ignore'] })
    const pids = []
    p.stdout.on('data', (d) => { for (const l of d.toString().split('\n')) if (l.trim()) pids.push(+l.trim()); if (pids.length >= 2) resolve({ pai: p.pid, filho: pids[0], neto: pids[1] }) })
  })
}
const limpar = (...pids) => { for (const p of pids) try { process.kill(p, 'SIGKILL') } catch {} }

test('descendentes acha filho e neto', { skip: !PY }, async () => {
  const { pai, filho, neto } = await criarArvore()
  try {
    const d = descendentes(pai)
    assert.ok(d.includes(filho) && d.includes(neto), JSON.stringify(d))
  } finally { limpar(neto, filho, pai) }
})

test('encerrar a sessao poupa o gateway (neto) e mata o resto', { skip: !PY }, async () => {
  const { pai, filho, neto } = await criarArvore()
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hh-'))
  fs.writeFileSync(path.join(home, 'gateway.pid'), JSON.stringify({ pid: neto, kind: 'hermes-gateway' }))
  try {
    await matarArvorePoupandoGateway(pai, home)
    await esperar(1500)
    assert.strictEqual(vivo(pai), false, 'pai deveria ter caido')
    assert.strictEqual(vivo(filho), false, 'filho deveria ter caido')
    assert.strictEqual(vivo(neto), true, 'o gateway (neto) tinha que continuar vivo')
  } finally { limpar(neto, filho, pai) }
})

test('sem gateway registrado, a arvore inteira cai', { skip: !PY }, async () => {
  const { pai, filho, neto } = await criarArvore()
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hh-'))
  try {
    await matarArvorePoupandoGateway(pai, home)
    await esperar(1500)
    assert.deepStrictEqual([vivo(pai), vivo(filho), vivo(neto)], [false, false, false])
  } finally { limpar(neto, filho, pai) }
})
