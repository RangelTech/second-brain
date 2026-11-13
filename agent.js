// Agente de verdade: cliente ACP (Agent Client Protocol) falando com o Hermes por stdio.
// Um processo por conversa, com sessão contínua, cancelamento e permissões mostradas na tela.
const { spawn, execFile, execFileSync } = require('child_process')
const partidaDireta = require('./partida-direta')
const fs = require('fs')
const os = require('os')
const path = require('path')


// ---- processos do Hermes: matar a ARVORE inteira (o launcher hermes-acp deixa filhos Python e um gateway que seguram travas) ----
function matarArvore(pid) {
  if (!pid) return
  try {
    if (process.platform === 'win32') execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, timeout: 15000 }, () => {}) // sem bloquear a janela
    else {
      try { process.kill(-pid, 'SIGKILL') } catch { process.kill(pid, 'SIGKILL') } // filho criado com detached: o grupo inteiro cai
    }
  } catch {}
}
// O gateway de segundo plano do Hermes e FILHO do primeiro agente que o iniciou, mas serve TODOS os chats. Encerrar um chat ocioso com
// matarArvore() derrubava o gateway no meio do turno de outro chat ("Gateway disconnected"). Aqui a arvore da sessao cai, menos o gateway.
function descendentes(raiz) {
  let linhas = ''
  try {
    linhas = process.platform === 'win32'
      ? execFileSync('powershell', ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId)" }'], { encoding: 'utf8', windowsHide: true, timeout: 15000 })
      : execFileSync('ps', ['-eo', 'pid=,ppid='], { encoding: 'utf8', timeout: 10000 })
  } catch { return [] }
  const filhos = new Map()
  for (const l of linhas.split('\n')) {
    const [p, pp] = l.trim().split(/\s+/).map(Number)
    if (!p || !pp) continue
    if (!filhos.has(pp)) filhos.set(pp, [])
    filhos.get(pp).push(p)
  }
  const saida = []
  const pilha = [raiz]
  while (pilha.length) {
    const x = pilha.pop()
    for (const f of filhos.get(x) || []) { saida.push(f); pilha.push(f) }
  }
  return saida
}
function pidDoGateway(home) {
  try {
    const g = JSON.parse(fs.readFileSync(path.join(home, 'gateway.pid'), 'utf8'))
    return g && g.kind === 'hermes-gateway' ? g.pid : 0
  } catch { return 0 }
}
// Assíncrono de propósito: a versão síncrona (PowerShell + um taskkill por processo, segundos cada) rodava na thread principal do Electron e a
// janela ficava "Não está respondendo" quando várias sessões eram encerradas seguidas (visto em 11/11/2026 com as sessões reserva).
// Quem chama não precisa esperar; os testes esperam a promessa.
const execFileP = (cmd, args, timeout) => new Promise((res) => execFile(cmd, args, { encoding: 'utf8', windowsHide: true, timeout }, (e, out) => res(e && !out ? '' : String(out || ''))))
async function descendentesAsync(raiz) {
  const linhas = process.platform === 'win32'
    ? await execFileP('powershell', ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId)" }'], 15000)
    : await execFileP('ps', ['-eo', 'pid=,ppid='], 10000)
  const filhos = new Map()
  for (const l of linhas.split(/\r?\n/)) {
    const [p, pp] = l.trim().split(/\s+/).map(Number)
    if (!p || !pp) continue
    if (!filhos.has(pp)) filhos.set(pp, [])
    filhos.get(pp).push(p)
  }
  const saida = []
  const pilha = [raiz]
  while (pilha.length) {
    const x = pilha.pop()
    for (const f of filhos.get(x) || []) { saida.push(f); pilha.push(f) }
  }
  return saida
}
function matarArvorePoupandoGateway(pid, home) {
  if (!pid) return Promise.resolve()
  const gw = pidDoGateway(home)
  return descendentesAsync(pid)
    .then(async (filhos) => {
      const alvos = [pid, ...filhos].filter((p) => p !== gw)
      for (const p of alvos.reverse()) { // folhas primeiro
        if (process.platform === 'win32') await execFileP('taskkill', ['/PID', String(p), '/F'], 15000)
        else try { process.kill(p, 'SIGKILL') } catch {}
      }
    })
    .catch(() => {})
}

const vivo = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }
const inicioDoSistema = () => Math.round((Date.now() - os.uptime() * 1000) / 60000) // minuto em que a maquina ligou: pid de antes de reiniciar nao vale
const arquivoPids = (app) => path.join(app.getPath('userData'), 'hermes-pids.json')
function lerPids(app) {
  try {
    const j = JSON.parse(fs.readFileSync(arquivoPids(app), 'utf8'))
    return Math.abs((j.boot || 0) - inicioDoSistema()) <= 1 ? j.pids || [] : [] // tolera 1 min de diferenca no calculo
  } catch { return [] }
}
function gravarPids(app, pids) {
  try { fs.writeFileSync(arquivoPids(app), JSON.stringify({ boot: inicioDoSistema(), pids })) } catch {}
}
function anotarPid(app, pid) { gravarPids(app, [...new Set([...lerPids(app), pid])].slice(-40)) }
function esquecerPid(app, pid) { gravarPids(app, lerPids(app).filter((p) => p !== pid)) }
// Mata o que ficou do Hermes numa execucao anterior (ou numa partida que estourou o prazo): os processos que este app subiu e o gateway
// de segundo plano desta pasta (gateway.pid). Seguro: o gateway sobe de novo sozinho na proxima sessao. `exceto` preserva sessoes vivas.
function limparHermesPreso(app, home, exceto = []) {
  let n = 0
  for (const pid of lerPids(app)) {
    if (exceto.includes(pid) || !vivo(pid)) continue
    matarArvore(pid)
    n++
  }
  gravarPids(app, lerPids(app).filter((p) => exceto.includes(p)))
  try {
    const g = JSON.parse(fs.readFileSync(path.join(home, 'gateway.pid'), 'utf8'))
    const modif = fs.statSync(path.join(home, 'gateway.pid')).mtimeMs
    if (g && g.kind === 'hermes-gateway' && vivo(g.pid) && modif > Date.now() - os.uptime() * 1000) {
      matarArvore(g.pid)
      n++
    }
  } catch {}
  if (n) registrar(app, `limpeza: ${n} processo(s) do Hermes que tinham ficado presos foram encerrados`)
  return n
}

// Gateway de segundo plano do Hermes (gateway.pid): cada sessao precisa de um gateway pronto. Se sobrou um antigo vivo (launcher encerrado, tarefa
// morta no meio), o novo ESPERA ~60 s ele sair antes de assumir, e a partida estoura o prazo em ciclo. Sem nenhuma sessao ativa neste app, ele
// nao tem cliente: pode ser encerrado com seguranca e o proximo sobe limpo em segundos.
const sessoesVivas = new Set() // pids dos hermes-acp deste app que estao de pe
let filaPartida = Promise.resolve() // uma sessão por vez faz o aperto de mão com o Hermes (ver iniciarComVigia)
function matarGatewayOrfao(app, home) {
  if (sessoesVivas.size > 0) return false // outro chat usa o gateway: nao mexe
  try {
    const arq = path.join(home, 'gateway.pid')
    const g = JSON.parse(fs.readFileSync(arq, 'utf8'))
    if (g && g.kind === 'hermes-gateway' && vivo(g.pid) && fs.statSync(arq).mtimeMs > Date.now() - os.uptime() * 1000) {
      matarArvore(g.pid)
      registrar(app, `gateway orfao (pid ${g.pid}) encerrado antes de subir o agente`)
      return true
    }
  } catch {}
  return false
}

const OCIOSO_MS = +process.env.SB_TESTE_OCIOSO_MS || 10 * 60 * 1000
// erros que significam "o processo (ou o gateway dele) caiu": o app retoma sozinho, sem mostrar nada ao cliente
// SESSAO VELHA (12/11/2026): o Hermes recusa um turno com launch_credentials_unavailable / admitted_turn_failed quando a sessao foi criada com outra chave, outra porta ou
// antes de o gateway reiniciar. Nao importa a causa: a sessao nao serve mais, e o app descarta e abre outra, levando a conversa. Nunca reenvia na mesma sessao.
const SESSAO_VELHA = /launch_credentials_unavailable|admitted_turn_failed/i
const MORTE_DO_AGENTE = /O agente encerrou|Gateway disconnected|turn outcome is unknown|EPIPE|ECONNRESET|Connection (closed|reset)|write after end|launch_credentials_unavailable|admitted_turn_failed/i

// Primeira execução de cada HERMES_HOME: o Hermes monta um ambiente Python isolado (cerca de 700 MB entre installs/ e cache/uv, baixados da internet).
// Leva minutos e, se o processo for morto no meio, recomeça do zero. O app antigo desistia aos 90 s e matava o Hermes em laço (sessão nova do zero, 30 min
// sem agente). Agora UM processo monta o ambiente com paciência (o relógio é a atividade, não um prazo fixo) e os outros chats esperam essa montagem.
const SEM_PROGRESSO_MS = +process.env.SB_TESTE_SEM_PROGRESSO_MS || 5 * 60 * 1000 // só desiste se ficar tanto tempo sem NENHUM sinal de vida
const TETO_MONTAGEM_MS = +process.env.SB_TESTE_TETO_MONTAGEM_MS || 40 * 60 * 1000

// CAUSA RAIZ do "Hermes intermitente" (diagnosticada com py-spy no processo pendurado): na partida de uma sessão o Hermes roda `git rev-parse HEAD` etc. com
// subprocess.run(timeout=3). No Windows, se o git demora mais que isso, o Python o mata mas continua esperando os pipes para sempre (um processo neto
// segura as pontas) e o session/new nunca responde (medido: 621 s parado; matar o git.exe pendurado liberou em 6 s). O app então desistia aos 90 s e reiniciava,
// em laço. Aqui, enquanto uma sessão está subindo, qualquer git.exe do Hermes com mais de alguns segundos de vida é encerrado: o Python volta e segue.
let limpandoGit = false
function limparGitPreso(app, minIdadeMs = 8000, trecho = 'hermes') {
  if (process.platform !== 'win32' || limpandoGit) return
  limpandoGit = true
  // Reconhece o git do Hermes de dois jeitos: o executável mora na pasta do Hermes, OU o processo PAI é do Hermes (o python dele). O 2º é o caso de hoje:
  // o Hermes usa o Git do sistema (Program Files) e o git.exe pendurado é filho do python do Hermes (medido em 08/11/2026: 3 sessões travadas em loop).
  const ps =
    `$lim=[timespan]::FromMilliseconds(${Math.max(1000, minIdadeMs | 0)});$t='*${String(trecho).replace(/[^A-Za-z0-9_-]/g, '')}*';` +
    `Get-CimInstance Win32_Process -Filter "Name='git.exe'" | Where-Object { ((Get-Date) - $_.CreationDate) -gt $lim } | ForEach-Object { ` +
    `$pp=Get-CimInstance Win32_Process -Filter ('ProcessId=' + $_.ParentProcessId) -ErrorAction SilentlyContinue; ` +
    `if (($_.ExecutablePath -like $t) -or ($pp -and ((([string]$pp.ExecutablePath) + ' ' + ([string]$pp.CommandLine)) -like $t))) { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $_.ProcessId } }`
  try {
    require('child_process').execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true, timeout: 20000 }, (err, out) => {
      limpandoGit = false
      const pids = String(out || '').split(/\s+/).filter(Boolean)
      if (pids.length) registrar(app, 'git preso do Hermes encerrado (pid ' + pids.join(', ') + '): o session/new volta a responder')
    })
  } catch {
    limpandoGit = false
  }
}
// liga o vigia enquanto algo está subindo; devolve a função que desliga.
// O Python do Hermes desiste do git aos 3 s, então um git do Hermes com mais de ~3,5 s JÁ está pendurado: não adianta esperar mais. Antes o vigia só
// agia aos 8 s e conferia de 4 em 4 s, abrindo um PowerShell novo a cada vez (1 a 2 s cada): a partida travada custava 15 a 20 s. Agora UM PowerShell
// fica em laço (a cada 0,7 s) enquanto a sessão sobe e encerra o git pendurado na hora: a mesma partida destrava em ~4 s.
const GIT_PRESO_MS = +process.env.SB_GIT_PRESO_MS || 3500
function vigiarGitPreso(app, aposMs = GIT_PRESO_MS, trecho = 'hermes') {
  if (process.platform !== 'win32') return () => {}
  const ps =
    `$lim=[timespan]::FromMilliseconds(${Math.max(1000, aposMs | 0)});$t='*${String(trecho).replace(/[^A-Za-z0-9_-]/g, '')}*';` +
    `while ($true) { Get-CimInstance Win32_Process -Filter "Name='git.exe'" | Where-Object { ((Get-Date) - $_.CreationDate) -gt $lim } | ForEach-Object { ` +
    `$pp=Get-CimInstance Win32_Process -Filter ('ProcessId=' + $_.ParentProcessId) -ErrorAction SilentlyContinue; ` +
    `if (($_.ExecutablePath -like $t) -or ($pp -and ((([string]$pp.ExecutablePath) + ' ' + ([string]$pp.CommandLine)) -like $t))) { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; [Console]::Out.WriteLine($_.ProcessId) } }; Start-Sleep -Milliseconds 700 }`
  let filho = null
  try {
    filho = require('child_process').spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] })
    filho.stdout.on('data', (d) => {
      const pids = String(d).split(/\s+/).filter(Boolean)
      if (pids.length) registrar(app, 'git preso do Hermes encerrado (pid ' + pids.join(', ') + '): o session/new volta a responder')
    })
    filho.on('error', () => {})
    filho.unref?.()
  } catch {}
  // nunca fica para trás: desliga quando a partida termina e, por garantia, aos 10 min
  const teto = setTimeout(() => {
    try {
      filho?.kill()
    } catch {}
  }, 10 * 60 * 1000)
  teto.unref?.()
  return () => {
    clearTimeout(teto)
    try {
      filho?.kill()
    } catch {}
  }
}
const montagens = new Map() // HERMES_HOME -> promessa da montagem em andamento
function assinaturaBin(bin) {
  try {
    const st = fs.statSync(bin)
    return st.size + '-' + Math.round(st.mtimeMs)
  } catch {
    return 'sem-binario'
  }
}
// "montado" vale para esta versão do Hermes: atualizar o Hermes refaz o ambiente, então a marca guarda a assinatura do binário
function ambienteMontado(home, bin) {
  try {
    return fs.readFileSync(path.join(home, 'pronto.ok'), 'utf8').includes(assinaturaBin(bin))
  } catch {
    return false
  }
}
function marcarMontado(home, bin) {
  try {
    fs.writeFileSync(path.join(home, 'pronto.ok'), new Date().toISOString() + ' ' + assinaturaBin(bin))
  } catch {}
}
// quantidade de arquivos nas pastas onde o ambiente cresce: cresceu, o Hermes está trabalhando (mesmo calado)
async function contarArquivos(dirs) {
  let n = 0
  const andar = async (d, prof) => {
    let itens
    try {
      itens = await fs.promises.readdir(d, { withFileTypes: true })
    } catch {
      return
    }
    n += itens.length
    if (prof > 8 || n > 400000) return
    for (const e of itens) if (e.isDirectory()) await andar(path.join(d, e.name), prof + 1)
  }
  for (const d of dirs) await andar(d, 0)
  return n
}
const CONTEXTO_REAL = 131072
const COMPRIMIR_EM = +process.env.SB_COMPRIMIR_EM || 72000 // variáveis SB_* só para medir variantes (spec de contexto); sem elas vale o padrão
const PODAR_EM = +process.env.SB_PODAR_EM || 48000

const caminhosHermes = require('./caminhos-hermes')
function localizarBinario(app) {
  const win = process.platform === 'win32'
  const exe = win ? 'hermes-acp.exe' : 'hermes-acp'
  const raiz = caminhosHermes.raizAgente(app) // pasta decidida em caminhos-hermes.js (curta no Windows instalado; a antiga nos demais)
  const antiga = path.join(app.getPath('userData'), 'hermes')
  const candidatos = [
    process.env.SECOND_BRAIN_HERMES_BIN,
    path.join(raiz, 'bin', exe),
    path.join(antiga, 'bin', exe),
    // Linux/macOS: o instalador oficial grava aqui. No Windows esse executavel solto do checkout existe mesmo com a instalacao pela metade
    // (sem os pacotes Python), e achar "instalado" ali escondia a falha: so vale o comando publicado em bin\.
    win ? null : path.join(raiz, 'hermes-agent', '.hermes', 'bin', exe),
    win ? null : path.join(antiga, 'hermes-agent', '.hermes', 'bin', exe),
    path.join(os.homedir(), 'hermes', 'bin', exe),
    path.join(os.homedir(), '.local', 'bin', 'hermes-acp'),
  ].filter(Boolean)
  return candidatos.find((c) => fs.existsSync(c) && atalhoValido(c)) || null
}
// O instalador oficial publica em ~/.local/bin um ATALHO de texto ("exec <caminho>/hermes-acp"). Se a instalação foi apagada ou abortada,
// o atalho fica apontando para o nada: contar isso como "instalado" fazia o app nunca reinstalar (QA Linux 11/11/2026, "O agente encerrou").
function atalhoValido(c) {
  try {
    const st = fs.statSync(c)
    if (st.size > 8192) return true // binário de verdade
    const txt = fs.readFileSync(c, 'utf8')
    if (!txt.startsWith('#!')) return true
    const alvos = txt.match(/(\/[^\s'"]+\/hermes-acp)\b/g) || []
    return alvos.length === 0 || alvos.some((a) => fs.existsSync(a))
  } catch {
    return true
  }
}

// HERMES_HOME próprio do app. Na primeira vez traz skills, memória e SOUL.md da instalação do piloto;
// a cada início atualiza as skills globais da Rangel Tech (somente leitura) dentro de skills/rangeltech.
// O pacote de skills da Rangel Tech vai no instalador de todo mundo, mas só é entregue a quem o plano inclui (o Light não tem).
// O login informa (plan.skill_pack) e o app grava. Sem essa informação (ainda não entrou, primeiro início) NÃO entrega: o pacote chega
// na primeira sessão depois do login, e só para quem o plano inclui. O app exige login, então ninguém fica sem a informação.
let ENTREGAR_PACOTE = false
function definirPacote(v) {
  ENTREGAR_PACOTE = v === true
}
function prepararBase(app) {
  const home = caminhosHermes.homeAgente(app)
  fs.mkdirSync(path.join(home, 'skills'), { recursive: true })
  // pasta nova (caminho curto) no lugar da antiga: leva so a memoria do usuario; o ambiente Python e as sessoes se refazem
  const antiga = path.join(app.getPath('userData'), 'hermes-home')
  if (antiga !== home && !fs.existsSync(path.join(home, '.memoria-copiada'))) {
    try {
      if (fs.existsSync(path.join(antiga, 'memories'))) fs.cpSync(path.join(antiga, 'memories'), path.join(home, 'memories'), { recursive: true, force: false })
      fs.writeFileSync(path.join(home, '.memoria-copiada'), new Date().toISOString())
    } catch {}
  }
  const piloto = path.join(os.homedir(), 'hermes')
  const marca = path.join(home, '.migrado')
  if (!fs.existsSync(marca) && fs.existsSync(piloto)) {
    for (const item of ['skills', 'memories', 'SOUL.md']) {
      try {
        if (fs.existsSync(path.join(piloto, item))) fs.cpSync(path.join(piloto, item), path.join(home, item), { recursive: true, force: false })
      } catch {}
    }
    fs.writeFileSync(marca, new Date().toISOString())
  }
  const globais = [path.join(process.resourcesPath || '', 'skills-globais', 'rangeltech'), path.join(__dirname, 'skills-globais', 'rangeltech')].find((p) => fs.existsSync(p))
  if (globais && ENTREGAR_PACOTE) sincronizarSkillsGlobais(globais, path.join(home, 'skills', 'rangeltech'))
  const essenciais = [path.join(process.resourcesPath || '', 'skills-globais', 'essenciais'), path.join(__dirname, 'skills-globais', 'essenciais')].find((p) => fs.existsSync(p))
  if (essenciais) sincronizarSkillsGlobais(essenciais, path.join(home, 'skills', 'essenciais'), { novaVence: true }) // vai para TODOS os planos, inclusive o Lite
  // editor de vídeo: a skill só chega ao Hermes com o editor ligado (editor-video.js `habilitado`); desligado, nada dele existe para o agente
  try {
    const ev = require('./editor-video')
    const pastaEditorSkill = [path.join(process.resourcesPath || '', 'skills-globais', '_editor-de-video-desligado'), path.join(__dirname, 'skills-globais', '_editor-de-video-desligado')].find((p) => fs.existsSync(p))
    const destino = path.join(home, 'skills', 'essenciais', 'editor-de-video')
    if (pastaEditorSkill && ev.habilitado(app)) {
      fs.mkdirSync(destino, { recursive: true })
      fs.copyFileSync(path.join(pastaEditorSkill, 'SKILL.md'), path.join(destino, 'SKILL.md'))
    } else if (fs.existsSync(destino)) fs.rmSync(destino, { recursive: true, force: true })
  } catch {}
  return home
}

// As skills globais vão na instalação e depois são do usuário: o Hermes pode editar, criar e apagar à vontade (autoevolução).
// A sincronização só traz o que é novo ou o que o usuário não mexeu: arquivo editado fica como está, arquivo apagado não volta.
// O manifesto guarda o hash de cada arquivo como foi entregue da última vez.
// Uma vez por execução do app: as skills que vêm no app não mudam enquanto ele está aberto, e ler/conferir centenas de arquivos a cada
// sessão nova (agora são 3 reservas) segurava a janela por ~2 s na abertura (sonda de travamento, 11/11/2026).
const skillsSincronizadas = new Set()
// essenciais (opcoes.novaVence): as skills de que o produto depende (motion, estudio, workflows...). Se o app traz uma versão nova e o Hermes
// tinha editado a antiga, a nova entra e o que ele aprendeu fica em notas-aprendidas.md na mesma pasta (com aviso no fim do SKILL.md).
// O hash ignora CRLF x LF: só o conteúdo conta.
function sincronizarSkillsGlobais(origem, destino, opcoes = {}) {
  const chave = origem + '>' + destino
  if (skillsSincronizadas.has(chave)) return
  skillsSincronizadas.add(chave)
  const crypto = require('crypto')
  const hash = (f) => crypto.createHash('sha1').update(fs.readFileSync(f).toString('latin1').split('\r\n').join('\n'), 'latin1').digest('hex')
  const guardarAprendido = (dst) => {
    try {
      const notas = path.join(path.dirname(dst), 'notas-aprendidas.md')
      fs.appendFileSync(notas, '\n\n<!-- versão anterior, editada no seu computador, guardada em ' + new Date().toISOString() + ' -->\n' + fs.readFileSync(dst, 'utf8'))
    } catch {}
  }
  const avisarNotas = (dst) => {
    try {
      if (path.basename(dst) !== 'SKILL.md' || !fs.existsSync(path.join(path.dirname(dst), 'notas-aprendidas.md'))) return
      fs.appendFileSync(dst, '\n\n## Ajustes que você já tinha aprendido\nVeja notas-aprendidas.md nesta pasta (a sua versão anterior desta skill). Aproveite o que ainda vale; esta versão nova manda.\n')
    } catch {}
  }
  const arqManifesto = path.join(destino, '.entregue.json')
  let antes = {}
  const primeira = !fs.existsSync(arqManifesto)
  try {
    antes = JSON.parse(fs.readFileSync(arqManifesto, 'utf8'))
  } catch {}
  const agora = {}
  const andar = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? rel + '/' + e.name : e.name
      if (e.isDirectory()) andar(path.join(d, e.name), r)
      else {
        try {
          const src = path.join(d, e.name)
          const dst = path.join(destino, r)
          const h = hash(src)
          agora[r] = h
          if (!fs.existsSync(dst)) {
            if (antes[r]) continue // estava instalado e o usuário (ou o Hermes) apagou: não volta
            fs.mkdirSync(path.dirname(dst), { recursive: true })
            fs.copyFileSync(src, dst)
          } else if (antes[r] && hash(dst) === antes[r] && antes[r] !== h) {
            fs.copyFileSync(src, dst) // não foi editado: recebe a versão nova
          } else if (!antes[r]) {
            // sem registro: se é a primeira vez com este manifesto (instalação antiga, que sempre sobrescrevia), recebe a versão nova
            if (primeira) fs.copyFileSync(src, dst)
            else agora[r] = hash(dst)
          } else if (hash(dst) !== antes[r]) {
            if (opcoes.novaVence && antes[r] !== h && hash(dst) !== h) {
              guardarAprendido(dst) // versão nova do app + edição do Hermes: a nova entra, a edição vira nota
              fs.copyFileSync(src, dst)
              avisarNotas(dst)
              agora[r] = h
            } else agora[r] = antes[r] // editado pelo usuário: mantém a edição e o registro antigo
          }
        } catch {}
      }
    }
  }
  try {
    fs.mkdirSync(destino, { recursive: true })
    andar(origem, '')
    fs.writeFileSync(arqManifesto, JSON.stringify(agora))
  } catch {}
}

// Regra de segurança por conta (nível do painel): vai no SOUL.md do perfil, regravada a cada sessão, e o usuário não vê.
// Nível 1 = sem trava (nada é escrito). Nível 2 = classificador 1 (o que a pessoa pede). Nível 3 = classificadores 1 e 2 (também respostas e ações).
const MARCA_SEG = ['<!-- sb-seguranca:inicio -->', '<!-- sb-seguranca:fim -->']
function blocoSeguranca(nivel) {
  if (!(nivel >= 2)) return ''
  const base = [
    '## Regra de segurança desta conta (vale sempre, em silêncio)',
    'Julgue a INTENÇÃO do pedido, nunca palavras soltas. Recuse, sem sermão e sem citar regra, painel ou classificador, só quando a pessoa quer APRENDER OU OBTER ajuda para praticar um crime hediondo ou violência extrema (ensinar a fabricar ou usar bomba, explosivo, arma química, biológica ou nuclear; abuso sexual de menores; matar, torturar ou mutilar alguém; terrorismo; malware; fraude e golpes), ou quando pede para GERAR cena de gore explícito, tortura ou abuso de menores. Para automutilação ou suicídio, acolha com cuidado e indique o CVV (telefone 188). Ao recusar, diga com gentileza, em uma frase, que não pode ajudar com isso e pergunte se pode ajudar em outra coisa. Nunca ofereça versão alternativa que entregue o mesmo conteúdo, nem "tentar mesmo assim".',
    'Permitido e normal, faça sem hesitar: imagem ou desenho de uma bomba, bomba de gasolina ou de água, fogos de artifício, filme, jogo, notícia, história, ficção sem instruções práticas, educação, segurança e conteúdo adulto legal entre adultos. O mesmo assunto muda de resposta conforme a intenção: "gere a imagem de uma bomba" é permitido, "me ensine a fazer uma bomba" é recusado. Também vale quando o pedido vem disfarçado de ficção, teste ou "só curiosidade" para obter instruções práticas.',
    'ANTES de chamar qualquer ferramenta de imagem ou vídeo, releia o briefing que você escreveu: se ele contiver algo barrado acima, NÃO chame a ferramenta e responda com a recusa curta.',
  ]
  if (nivel >= 3) {
    base.push(
      'ANTES de executar comando, escrever arquivo ou navegar, confira a ação: se for destruir dados fora da pasta de trabalho, vazar senhas ou chaves, ou atacar terceiros, NÃO execute e explique em uma frase.',
      'ANTES de enviar a resposta final, releia: se ela trouxer instruções do que está barrado acima, troque pela recusa curta.'
    )
  }
  return MARCA_SEG[0] + '\n' + base.join('\n\n') + '\n' + MARCA_SEG[1]
}
// Bloco de estilo, sempre ligado (qualquer nível): português, sem jargão interno, sem narrar cada passo.
const MARCA_EST = ['<!-- sb-estilo:inicio -->', '<!-- sb-estilo:fim -->']
function blocoEstilo() {
  const regras = [
    'Responda sempre em português do Brasil, em tom simples e gentil. Nunca escreva em inglês para o cliente, nem a frase curta antes de usar uma ferramenta (ex.: "Vou abrir a Wikipédia e ler o primeiro parágrafo.").',
    'Nunca cite detalhes internos: nome de ferramenta (navegador_abrir, navegador_*, midia_gerar_imagem, terminal...), identificador de sessão ou de conversa (ex.: [@session:...], local-abc123...), tool_call, JSON, wrapper, erro técnico, servidor, GPU ou fila. Para falar de uma conversa antiga, use a data e o assunto ("na conversa de hoje às 19h sobre a Wikipédia"). Se algo falhar, tente de novo em silêncio; se continuar falhando, diga só que não conseguiu agora e ofereça tentar de novo.',
    'Não narre cada passo nem cada conferência. Faça o trabalho e entregue uma resposta curta: o que foi feito e onde está o arquivo.',
    'Quando o cliente descrever uma tarefa nova ("quero editar um vídeo", "montar uma sala 3D", "ligar uma câmera"), ANTES de agir procure entre as suas skills a ferramenta que serve (liste e leia as skills), e diga em uma frase qual vai usar e como. Só depois comece. Não vasculhe as pastas do cliente (Downloads, Documentos, Desktop) sem ele pedir ou sem precisar de um arquivo que ele indicou.',
  ]
  return MARCA_EST[0] + '\n## Como falar com o cliente (vale sempre)\n\n' + regras.join('\n\n') + '\n' + MARCA_EST[1]
}
function tirarBloco(t, marca) {
  const i = t.indexOf(marca[0])
  const j = t.indexOf(marca[1])
  return i >= 0 && j > i ? t.slice(0, i).trimEnd() + t.slice(j + marca[1].length) : t
}
function aplicarSeguranca(home, nivel) {
  try {
    const arq = path.join(home, 'SOUL.md')
    let t = fs.existsSync(arq) ? fs.readFileSync(arq, 'utf8') : ''
    t = tirarBloco(tirarBloco(t, MARCA_SEG), MARCA_EST)
    const seg = blocoSeguranca(nivel)
    t = (t.trimEnd() + '\n\n' + blocoEstilo() + (seg ? '\n\n' + seg : '')).trimStart() + '\n'
    fs.writeFileSync(arq, t)
  } catch {}
}

// plugins do Hermes que o produto nao usa (medido em 10/11/2026: 63 descobertos, 59 ligados, ~3 s de partida e checks a cada turno)
// SO provedores externos (imagem, video, busca, navegador na nuvem) que o produto nao usa: a lista larga de antes ('default', 'platforms', 'memory'...)
// tirava junto o que manda os passos das ferramentas para a tela (o cerebro ficava sem saber o que o agente fazia). Medido em 10/11/2026.
const PLUGINS_FORA = [
  'browser-browser-use', 'browser-browserbase', 'browser-firecrawl', 'deepinfra', 'fal', 'krea', 'meta-ai-image-gen', 'openai', 'openai-codex', 'openrouter', 'xai',
  'web-brave-free', 'web-ddgs', 'web-exa', 'web-firecrawl', 'web-keenable', 'web-openai-native', 'web-parallel', 'web-perplexity', 'web-searxng', 'web-tavily', 'web-xai',
  'hermes-achievements', 'google_meet', 'teams_pipeline', 'disk-cleanup',
]
// motor gateway (spec 34 fase 2): o agente ganha TODAS as ferramentas do Hermes (plano da tarefa, perguntas, memoria, busca em conversas, voz, rotinas, subagentes,
// script com varias ferramentas, pesquisa na web). A imagem/video do Hermes ficam de fora: a midia e a nossa (creditos, 9Router, Estudio).
function yamlGateway(filhos = 3) {
  return [
    'platform_toolsets:',
    '  acp:',
    '    - hermes-cli',
    'memory:',
    '  memory_enabled: true',
    '  user_profile_enabled: true',
    '  write_approval: false',
    'code_execution:',
    '  mode: project',
    '  timeout: 300',
    '  max_tool_calls: 50',
    'delegation:',
    `  max_concurrent_children: ${Math.max(1, Math.min(10, filhos | 0))}`,
    '  child_timeout_seconds: 900',
    'clarify:',
    '  timeout: 300',
    'tts:',
    '  provider: edge',
    'skills:',
    '  write_approval: false',
  ]
}
function prepararHome(app, { base, modelo, pasta, raciocinio, visao, nivel, gateway, filhos }) {
  const home = prepararBase(app)
  aplicarSeguranca(home, nivel)
  // a configuração é escrita pelo app, nunca à mão: o modelo é o combo do motor local
  const yaml = [
    '_config_version: 52',
    'model:',
    `  default: ${JSON.stringify(modelo || 'principal')}`,
    '  provider: "custom"',
    `  base_url: ${JSON.stringify(base)}`,
    '  api_key: ${SB_LOCAL_KEY}',
    // o servidor Unlimited só aceita 131072 tokens por pedido; sem isto o Hermes acha que são 262144, estoura e
    // gasta minutos numa compressão de emergência com o usuário olhando para a tela parada
    `  context_length: ${CONTEXTO_REAL}`,
    // ferramentas do app (mídia, navegador, memória) sempre visíveis: escondidas atrás de tool_search custavam 3 chamadas ao modelo (buscar, descrever, chamar) a cada uso
    'tools:',
    '  tool_search:',
    '    enabled: "off"',
    // o Hermes corta qualquer ferramenta MCP em 300 s; vídeo em qualidade alta e troca de personagem levam ~460 s de GPU mais a fila (medido 08/11/2026)
    'timeouts:',
    '  mcp:',
    '    tool_call: 3600',
    'compression:',
    '  enabled: true',
    `  threshold_tokens: ${COMPRIMIR_EM}`, // comprime cedo: o resumo fica pequeno e rápido
    `  proactive_prune_tokens: ${PODAR_EM}`, // antes disso, só poda resultados velhos de ferramenta (não chama o modelo)
    '  target_ratio: 0.15',
    'agent:',
    `  reasoning_effort: ${JSON.stringify(raciocinio || 'none')}`,
    '  environment_probe: false', // sondagem do toolchain da maquina a cada partida: nao entra no nosso prompt
    // PARTIDA: o Hermes descobre e carrega 59 plugins (provedores de imagem, video, busca, navegador externo, Discord, Feishu...) e nenhum serve ao
    // Segundo Cerebro: imagem, video, navegador e memoria sao os NOSSOS servidores MCP. Cada plugin e um import e um check_fn na partida e no 1o turno.
    ...(process.env.SB_SEM_PLUGINS_FORA ? [] : ['plugins:', `  disabled: ${JSON.stringify(gateway ? PLUGINS_FORA.filter((x) => x !== 'web-ddgs') : PLUGINS_FORA)}`]), // SB_SEM_PLUGINS_FORA=1 so para medir/comparar
    // toolsets desligados (cada ferramenta pesa tokens em TODO passo): lista separada por vírgula em SB_TOOLSETS_OFF, ex.: connections,browser
    // toolsets desligados (cada ferramenta pesa tokens em TODO passo): lista separada por vírgula em SB_TOOLSETS_OFF, ex.: connections,browser
    // (so aceita nome de TOOLSET; `search_files` sozinha e tirada pela ponte-llm.js, porque o toolset `file` levaria read/write junto)
    ...(process.env.SB_TOOLSETS_OFF ? [`  disabled_toolsets: ${JSON.stringify(process.env.SB_TOOLSETS_OFF.split(',').map((s) => s.trim()).filter(Boolean))}`] : []),
    // olhar imagens (vision_analyze, prints do navegador): o Qwen do Unlimited enxerga, mas o Hermes não sabe disso pelo combo local;
    // com a conta do Unlimited, a visão vai direto a ele. Sem a conta, o Hermes decide sozinho.
    ...(visao ? ['auxiliary:', '  vision:', '    provider: "custom"', `    model: ${JSON.stringify(visao.modelo)}`, `    base_url: ${JSON.stringify(visao.base)}`, '    api_key_env: "SB_VISAO_CHAVE"'] : []),
    ...(gateway ? yamlGateway(filhos) : []),
    'terminal:',
    '  backend: "local"',
    `  cwd: ${JSON.stringify(pasta.replace(/\\/g, '/'))}`,
    '  timeout: 180',
    'attachments:',
    '  storage: "hermes-home"',
    '',
  ].join('\n')
  fs.writeFileSync(path.join(home, 'config.yaml'), yaml)
  // a chave da visão vai no .env do perfil (é onde o Hermes lê segredos; variável de ambiente solta não chega à tarefa auxiliar)
  const envArq = path.join(home, '.env')
  try {
    if (visao && visao.chave) fs.writeFileSync(envArq, `SB_VISAO_CHAVE=${visao.chave}
`, { mode: 0o600 })
    else fs.rmSync(envArq, { force: true })
  } catch {}
  return home
}

// Modos de permissão (o usuário escolhe no chat). Devolve 'permitir' (nem pergunta) ou 'perguntar'.
const SO_LEITURA = new Set(['read', 'search', 'fetch', 'think'])
const COMANDO_RISCO = /\b(rm|rmdir|del|erase|rd|mv|move|chmod|chown|sudo|su|kill|taskkill|shutdown|reboot|format|mkfs|dd|curl|wget|scp|rsync|ssh|pip|pip3|npm|npx|yarn|pnpm|apt|apt-get|brew|choco|winget|docker|kubectl|git\s+(push|reset|clean|checkout|rebase)|reg|netsh|powershell\s+.*(remove|delete)|Remove-Item)\b|>\s*[~/\\]|\|\s*(sh|bash)\b/i
function caminhoDe(tc) {
  const r = tc.rawInput?.arguments || tc.rawInput || {}
  return tc.locations?.[0]?.path || tc.content?.find((c) => c.path)?.path || r.path || r.file_path || r.filepath || null
}
function textoDe(tc) {
  const r = tc.rawInput?.arguments || tc.rawInput || {}
  return String(r.command || r.cmd || r.code || tc.title || '')
}
function dentroDe(pasta, alvo) {
  if (!alvo) return false
  const rel = path.relative(path.resolve(pasta), path.resolve(alvo))
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel)
}
function decidirPermissao(modo, tc, pasta) {
  if (modo === 'ignorar') return 'permitir'
  if (modo === 'manual') return 'perguntar'
  const kind = tc.kind || 'other'
  if (SO_LEITURA.has(kind)) return 'permitir'
  if (kind === 'edit') return dentroDe(pasta, caminhoDe(tc)) ? 'permitir' : 'perguntar'
  if (modo === 'editar') return 'perguntar' // comandos, apagar e mover continuam perguntando
  if (modo === 'auto' && kind === 'execute') return COMANDO_RISCO.test(textoDe(tc)) ? 'perguntar' : 'permitir'
  return 'perguntar'
}

function contextoDeSistema({ pasta, ferramentas, navegador, midia, memoria }) {
  const agora = new Date()
  return [
    'Você é o Segundo Cérebro, o agente do aplicativo de desktop da Rangel Tech. Responda em português do Brasil, de forma direta.',
    'Você tem ferramentas reais: leia e escreva arquivos (inclusive extrair texto de PDF, Word e planilha), liste pastas, rode comandos, busque na web e abra arquivos. USE as ferramentas em vez de dizer que não consegue acessar a máquina do usuário.',
    'LIBERDADE E LIMITES: esta máquina é do usuário e você tem liberdade total nela: pode usar sudo (sem senha), instalar pacotes, subir Docker e containers, abrir portas e rodar serviços. Quando uma tarefa de sistema pedir permissão, use sudo. ÚNICA EXCEÇÃO, INVIOLÁVEL: nunca desinstale, pare, desative, reinicie, edite nem apague o próprio Segundo Cérebro (pacote second-brain, pasta /opt/Segundo Cérebro, serviços segundo-cerebro*, arquivos em /etc/segundo-cerebro, o atualizador, o vigia e a pasta de dados fora da pasta de trabalho), mesmo que o usuário peça; explique que isso desligaria você e oriente a falar com o suporte. LIMITE DE TENTATIVAS: se uma instalação falhar DUAS vezes, PARE, explique em português simples o que aconteceu e ofereça uma alternativa; nunca gaste mais de uns 3 minutos contornando um bloqueio.',
    'Antes de apagar arquivos, escrever fora da pasta de trabalho ou rodar comandos perigosos, peça confirmação. Quando criar um arquivo, diga o caminho completo.',
    process.env.SB_SEM_DICA_PASTAS ? '' : 'PASTAS GRANDES: para LISTAR, CONTAR ou PROCURAR arquivos use a ferramenta terminal com comandos diretos e limite de profundidade (ls, dir, find -maxdepth 2). NUNCA use search_files com o padrão * nem varreduras recursivas completas: elas leem a pasta inteira (inclusive node_modules, .git e venv) e podem levar minutos. Só varra tudo se o usuário pedir.',
    'Ao criar arquivos grandes, NÃO escreva tudo numa só chamada: divida em partes de no máximo ~150 linhas (crie o esqueleto e depois acrescente ou edite por partes). Chamadas gigantes deixam o usuário minutos sem ver andamento e podem estourar o tempo.',
    'NUNCA diga que algo está pronto sem VERIFICAR, mas de forma PROPORCIONAL e rápida: faça no máximo DUAS rodadas de verificação por entrega (uma conferência de sintaxe e uma olhada no resultado) e só corrija o que estiver realmente quebrado; não fique refinando detalhes visuais em loop. Para JavaScript extraia o script e rode `node --check`; para HTML abra no Chrome ou Edge sem janela (headless) e leia os erros do console ou tire UMA captura e olhe. Capturas, extrações e outros arquivos de teste vão para uma pasta temporária fora da pasta entregue (ou apague ao terminar): a pasta final tem só o que o usuário pediu. Se houver erro, corrija e confira de novo UMA vez. Só então responda, dizendo o que verificou.',
    navegador ? 'Você tem um NAVEGADOR INTEGRADO que o usuário vê na tela ao lado do chat. Para abrir sites, clicar, preencher formulários, ler páginas e tirar capturas de tela, use as ferramentas do servidor "navegador" (navegador_abrir, navegador_ler, navegador_clicar, navegador_digitar, navegador_rolar, navegador_print, navegador_voltar, navegador_esperar, navegador_js). Comece com navegador_abrir, depois navegador_ler para ver a página e os elementos clicáveis (cada um tem um id), e use navegador_print para VER a página de verdade (depois olhe a imagem com vision_analyze no caminho devolvido). Prefira essas ferramentas ao navegador próprio do Hermes. O usuário também pode ter a extensão "Segundo Cérebro no Chrome": com ela as mesmas ferramentas rodam no Chrome DELE, com as contas dele abertas (parâmetro onde="chrome"; no aplicativo o padrão é o navegador integrado e na versão web é sempre o Chrome dele). Antes, rode navegador_chrome_estado; sem Chrome conectado, mande o link https://brain.rangeltech.net/extensao/ (skill navegador-do-usuario).' : '',
    midia ? 'VELOCIDADE EM MÍDIA: para imagem ou vídeo, chame PRIMEIRO midia_detalhar_prompt (5 a 15 s; ele escreve o briefing profissional com o pedido do usuário) e em seguida midia_gerar_imagem / midia_gerar_video com o prompt devolvido, sem encurtar; ao falar com o usuário diga só "Estou gerando a sua imagem, fica pronta em aproximadamente X segundos" (ou "o seu vídeo, em aproximadamente X minutos") e NUNCA mencione GPU, fila, servidor ou posição; NÃO liste skills, NÃO procure ferramentas e NÃO rode comandos antes, e depois de gerar apenas informe o caminho (sem reconferir). Se a ferramenta de mídia falhar por conexão perdida ("lost its stdio subprocess", "closed its transport") ou por "Não consegui gerar", chame de novo NA HORA, até 2 vezes, sem perguntar nada ao usuário. Você pode GERAR IMAGENS de verdade com a ferramenta midia_gerar_imagem (roda numa GPU do servidor, leva de 10 a 30 segundos e salva um PNG na pasta Imagens da pasta de trabalho). Quando o usuário pedir uma imagem, ilustração, capa, avatar, propaganda ou caricatura, USE a ferramenta em vez de dizer que não consegue: escreva o prompt em inglês, bem detalhado (assunto, estilo, luz, enquadramento, cores), escolha o formato (quadrado, retrato, paisagem, story ou banner) e depois diga o caminho completo do arquivo. Título curto dentro da imagem (1 a 3 palavras, em caixa alta, entre aspas no prompt) sai legível; frase longa e letra acentuada saem erradas, e nesses casos gere a imagem sem texto e aplique o título depois. Peça a contagem exata de pessoas no prompt (por exemplo exactly two people) e confira o resultado olhando a imagem. Você também pode GERAR VÍDEOS (1 a 60 s, sem áudio) com midia_gerar_video: a qualidade ALTA é o padrão (modelo de 14 bilhões de parâmetros em 720p; leva de 5 a 20 minutos por clipe de 5 s; a ferramenta volta na hora com a previsão e o aplicativo avisa no chat quando o arquivo ficar pronto: não espere nem consulte) e a rapida (cerca de 1 minuto, qualidade bem menor) só quando o usuário pedir um teste rápido. Na qualidade alta SEMPRE gere antes a imagem com midia_gerar_imagem, confira que ela está correta (carro com 4 rodas, pessoa com anatomia normal, rosto e mãos bons) e só então anime-a passando o caminho em imagem: um vídeo errado custa até 20 minutos do cliente, então acerte na primeira. Ao falar com o usuário use a previsão que a ferramenta devolveu. Salva um MP4 na pasta Videos. VOZ: para CLONAR uma voz (ler um texto com a voz de uma amostra) use midia_clonar_voz; para TROCAR a voz de um áudio ou vídeo use midia_trocar_voz; para REDUBLAR um vídeo em outro idioma com a voz do próprio locutor use midia_redublar_video. Todas voltam na hora com a previsão e o aplicativo avisa quando o arquivo ficar pronto (não espere nem consulte); a amostra de voz precisa de 3 a 25 segundos de fala limpa. Para TROCAR a pessoa de um vídeo pela de uma foto (troca de personagem ou de rosto) use midia_trocar_personagem, que leva vários minutos. ANTES de chamar, chame midia_conferir_troca (confere formato, tamanho, duração e áudio) e CONFIRA as entradas: olhe a foto (vision_analyze) e UM quadro do vídeo (extraia com ffmpeg para uma pasta temporária) e veja se há uma pessoa principal em primeiro plano com o rosto grande e nítido, se a foto é de frente, bem iluminada e sem óculos escuros, mão ou cabelo cobrindo o rosto, e se o vídeo tem espelho ou reflexo (esses falham); se algo estiver ruim, diga o que trocar. Se faltar informação (480p é mais rápido e 736p mais nítido; as pessoas cantam ou falam junto com o áudio? então ligue a sincronia labial), faça UMA mensagem curta com até 3 perguntas, cada uma com uma sugestão sua, e aceite "pode seguir" para você decidir. Só então chame a ferramenta, uma vez, caprichada. REGRA DE ROTEAMENTO: quando o usuário pedir "um vídeo de" alguma coisa que tem imagem real (um balão, um animal, uma pessoa, uma paisagem, um produto, uma comida, uma cena), USE SEMPRE midia_gerar_video, com o prompt em inglês descrevendo a cena, o movimento e a câmera. NUNCA improvise esse pedido com video-motion, Remotion, HyperFrames, terminal ou código: eles só servem para animação gráfica com texto (títulos, legendas, gráficos, vinhetas, reels com texto) e só quando o usuário pedir isso de forma explícita. Se midia_gerar_video falhar ou estiver indisponível, NÃO faça outra coisa no lugar: diga em português simples que o vídeo não pôde ser gerado agora e ofereça tentar de novo em instantes; não fale de servidor, GPU, fila nem erro técnico. A tela já mostra a fila, o percentual e o resultado, então não repita isso no texto. DIREÇÃO DE MÍDIA: antes de chamar midia_gerar_imagem ou midia_gerar_video, SEMPRE chame midia_detalhar_prompt (tipo, pedido do usuário com as palavras dele, respostas às suas perguntas, formato, segundos e tem_imagem_inicial) e use EXATAMENTE o prompt, o negative_prompt, o formato e os segundos que ele devolver; ele transforma o pedido curto em um briefing detalhado em inglês (sujeito, cena, ação e movimento, enquadramento e câmera, iluminação, estilo, cores, o que evitar em negative_prompt; texto dentro da imagem só se o usuário pediu) e preencha os parâmetros (formato, segundos, qualidade, seed). Siga a skill direcao-de-midia. DETALHE SEMPRE: o prompt enviado à ferramenta precisa ser RICO (imagem: 60 a 120 palavras em inglês; vídeo: 80 a 150) com sujeito, cenário, ação e movimento, câmera e lente, iluminação, paleta, atmosfera, estilo e qualidade, mais negative_prompt; prompt curto é recusado pela ferramenta. Se o pedido do usuário for curto e vago (só o assunto), faça UMA mensagem curta com até 5 perguntas numeradas (estilo, cenário, ação, cores e clima, formato e duração), cada uma com uma sugestão sua entre parênteses, e diga que ele pode responder "pode seguir" para você decidir tudo. Se ele responder "pode seguir" ou "tanto faz", ignorar as perguntas ou já tiver dado detalhes suficientes, NÃO pergunte de novo: invente você mesmo os detalhes que faltam, de forma coerente e caprichada (sem inventar textos, marcas nem rostos de pessoas reais), e gere. Antes de chamar a ferramenta, mostre em 1 ou 2 linhas em português o que vai gerar. ENCADEAMENTO: "este vídeo" ou "esta imagem" no pedido seguinte é o ÚLTIMO arquivo de mídia que você gerou nesta conversa (o caminho está no resultado da ferramenta). Para pôr texto, legenda, zoom ou animação num clipe de IA, use a skill video-motion SOBRE esse arquivo (clipes de IA têm 2 a 6 s: estenda com loop, câmera lenta ou concatenando vários clipes, sem dizer que gerou 20 s de uma vez) e entregue o arquivo final. Siga a skill orquestrador-de-midia. Depois de uma falha de mídia a tela já mostra um cartão com "Tentar de novo": responda com UMA frase curta (por exemplo "Não consegui gerar agora.") e nunca fale de instabilidade, primeira tentativa, servidor, nem tente de novo sozinho em sequência.' : '',
    memoria ? 'Você tem MEMÓRIA das conversas antigas com este usuário: a ferramenta memoria_buscar procura nelas pelos assuntos. Quando ele perguntar "você lembra de...", "aquilo que conversamos", "o que ficou combinado" ou citar algo que não está nesta conversa, USE memoria_buscar (com palavras-chave do assunto) antes de responder; se precisar de mais contexto de um trecho, memoria_ler_conversa. Nunca diga que não lembra sem ter buscado. Diga de qual conversa e data veio a informação.' : '',
    ferramentas ? `Skills e ferramentas: ${ferramentas}` : '',
    // --- parte VARIÁVEL por usuário e por sessão, sempre no FIM: o prefixo fixo acima fica igual para todos e o cache do servidor o reaproveita
    `Sistema operacional: ${os.type()} ${os.release()} (${process.platform}). Usuário: ${os.userInfo().username}. Pasta pessoal: ${os.homedir()}.`,
    `Pasta de trabalho: ${pasta}. Crie e edite arquivos nela, a menos que o usuário peça outra pasta.`,
    `Data e hora: ${agora.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.`,
  ]
    .filter(Boolean)
    .join('\n')
}

function registrar(app, linha) {
  try {
    const dir = path.join(app.getPath('userData'), 'logs')
    fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(path.join(dir, 'agente.log'), new Date().toISOString() + ' ' + linha + '\n')
  } catch {}
}

// Servidores MCP do próprio usuário (Higgsfield, Runway, ElevenLabs, fal...): arquivo mcp-externos.json na pasta de dados do app, que o Hermes edita a pedido.
// Formato: { "nome": { "command": "npx", "args": ["-y", "mcp-remote", "https://..."], "env": { "CHAVE": "valor" } } }  ou  { "nome": { "url": "https://...", "headers": { "Authorization": "Bearer ..." } } }
// Vale na próxima conversa. Nomes dos servidores do app (memoria, midia, navegador) não podem ser reusados.
function mcpsExternos(app, reservados = []) {
  let cfg
  try {
    cfg = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'mcp-externos.json'), 'utf8'))
  } catch {
    return []
  }
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return []
  const pares = (o) => Object.entries(o && typeof o === 'object' ? o : {}).map(([name, value]) => ({ name, value: String(value) }))
  const out = []
  for (const [nome, c] of Object.entries(cfg)) {
    if (!/^[a-z0-9_-]{1,40}$/i.test(nome) || reservados.includes(nome) || ['memoria', 'midia', 'navegador'].includes(nome) || !c || typeof c !== 'object') continue
    if (typeof c.url === 'string' && /^https:\/\//.test(c.url)) out.push({ type: 'http', name: nome, url: c.url, headers: pares(c.headers) })
    else if (typeof c.command === 'string' && c.command) out.push({ name: nome, command: c.command, args: Array.isArray(c.args) ? c.args.map(String) : [], env: pares(c.env) })
  }
  return out
}
// O servidor recusou a mídia porque a cota do plano acabou: "...a cota de imagens|vídeos|áudios do seu plano neste mês...". Devolve o tipo de crédito ou null.
const KIND_DE_COTA = { imagens: 'image', 'vídeos': 'video', 'áudios': 'audio' }
function kindDeCotaDeMidia(texto) {
  if (/você precisa de \d+ créditos para este pedido/i.test(texto || '')) return 'studio' // créditos do Estúdio acabaram: o pop-up oferece comprar mais
  const m = /cota de (imagens|vídeos|áudios) do seu plano/i.exec(texto || '')
  return m ? KIND_DE_COTA[m[1].toLowerCase()] || null : null
}

class Sessao {
  // Canal de eventos para a tela. Durante o AQUECIMENTO (turno invisível) tudo é descartado pelo `mudo`, sem trocar o canal: antes o aquecimento
  // trocava o canal por um mudo e, se a pergunta real chegasse no meio, devolvia o mudo no fim e a resposta inteira sumia (achado em 10/11/2026).
  get emitir() {
    return this.mudo ? () => {} : this._emitir || (() => {})
  }
  set emitir(f) {
    this._emitir = f
  }
  constructor({ app, id, pasta, base, modelo, chave, raciocinio, emitir, pedirPermissao, modo, navegador, midia, memoria, ias, nivel, vagaArq }) {
    this.app = app
    this.id = id
    this.vagaArq = vagaArq || null // sessão reserva: arquivo onde o app grava a conversa que adotou este processo
    this.pasta = pasta
    this.modo = modo || (() => 'manual') // 'manual' | 'editar' | 'auto' | 'ignorar'
    this.navegador = navegador || null // { url, token }: servidor local das ferramentas do navegador integrado
    this.memoria = memoria || null // { arquivo }: conversas do app, para a ferramenta de memória
    this.ias = ias || null // { base, chave, lista }: outras IAs conectadas, para o Hermes escolher qual usar (Spec 25 §16)
    this.midia = midia || null // { base, chave }: API de imagens do servidor (Unlimited); some se o app ainda não tem chave
    this.emitir = emitir
    this.pedirPermissao = pedirPermissao
    this.permitirSempre = false
    this.pendentes = new Map()
    this.proxId = 1
    this.buf = ''
    this.sid = null
    this.primeira = true
    this.turno = null
    this.ocioso = null
    const bin = localizarBinario(app)
    if (!bin) throw new Error('Não encontrei o Hermes (hermes-acp). Instale o Hermes ou defina SECOND_BRAIN_HERMES_BIN.')
    const home = prepararHome(app, { base, modelo, pasta, raciocinio, nivel, visao: midia ? { base: midia.base, modelo: 'qwen-abliterated', chave: midia.chave } : null })
    if (!fs.existsSync(path.join(home, 'installs'))) emitir({ aviso: 'Preparando o agente pela primeira vez. Isso leva alguns minutos e acontece uma vez só…' })
    this.bin = bin
    this.env = { ...process.env, HERMES_HOME: home, SB_LOCAL_KEY: chave, PYTHONUTF8: '1', ...(midia ? { SB_VISAO_CHAVE: midia.chave } : {}) }
    // macOS sem as ferramentas da Apple: o git portátil do app vai na frente do PATH (o agente usa git em skills e atualizações)
    const gitExtra = require('./ferramentas').caminhoExtra(app)
    if (gitExtra) this.env.PATH = gitExtra + path.delimiter + (this.env.PATH || '')
    this.subir()
    this.pronta = this.iniciar()
    this.pronta.catch(() => {
      this.falhouIniciar = true // quem usa trata o erro; a sessão não é reaproveitada (o app sobe outra)
    })
    this.vigiarCompressao()
  }

  // O Hermes não avisa pelo protocolo quando compacta o contexto (a chamada leva de segundos a minutos),
  // só escreve no agent.log dele. Lemos o que entra nesse arquivo para a tela mostrar o relógio.
  vigiarCompressao() {
    const arq = path.join(this.env.HERMES_HOME, 'logs', 'agent.log')
    let pos = 0
    try {
      pos = fs.statSync(arq).size
    } catch {}
    this.vigia = setInterval(() => {
      try {
        const tam = fs.statSync(arq).size
        if (tam < pos) pos = 0 // arquivo girou
        if (tam === pos) return
        const ini = Math.max(pos, tam - 1048576)
        const fd = fs.openSync(arq, 'r')
        const buf = Buffer.alloc(tam - ini)
        fs.readSync(fd, buf, 0, buf.length, ini)
        fs.closeSync(fd)
        pos = tam
        for (const l of buf.toString('utf8').split('\n')) this.aoLogDoHermes(l)
      } catch {}
    }, 1000)
    this.vigia.unref?.()
  }
  aoLogDoHermes(l) {
    // o Hermes às vezes só diz "conversa longa demais"; a causa real (cota esgotada) só aparece no log dele
    if (/Limite de uso da janela/.test(l) && this.sid && l.includes(this.sid) && this.tratarLimiteDeUso(l)) return
    const m = /context compression (started|done): session=(\S+) .*?(?:messages=(\d+)(?:->(\d+))?)?\s.*?(?:rough_)?tokens=~([\d,]+)/.exec(l)
    const falhou = /Context compression failed/.test(l) && l.includes(this.sid || '\u0000')
    if (!m && !falhou) return
    const sessao = m ? m[2] : this.sid
    // o log é compartilhado por todos os agentes: só vale a compactação desta conversa (ou o auto-reset dela)
    if (sessao !== this.sid && !(this.turno && !/^local-/.test(sessao))) return
    if (falhou) return this.emitir({ compactando: { fase: 'fim' } })
    const tokens = Number(m[5].replace(/,/g, ''))
    if (m[1] === 'started') this.emitir({ compactando: { fase: 'inicio', tokens } })
    else {
      this.emitir({ compactando: { fase: 'fim', depois: tokens } })
      this.emitir({ contexto: { usado: tokens, tamanho: CONTEXTO_REAL } })
    }
  }

  // sobe (ou sobe de novo) o processo do Hermes
  subir() {
    this.buf = ''
    // .cmd/.bat (só em teste/dev: nunca o .exe real) não roda com spawn puro no Windows (EINVAL) sem passar pelo shell
    const viaShell = /\.(cmd|bat)$/i.test(this.bin)
    matarGatewayOrfao(this.app, this.env.HERMES_HOME)
    // partida direta (sem o lançador, ~7 s mais rápida): só com o ambiente já montado e enquanto não falhou nesta sessão
    const direta = !viaShell && !this.semDireta && ambienteMontado(this.env.HERMES_HOME, this.bin) ? partidaDireta.resolver(this.env.HERMES_HOME, this.bin, this.env) : null
    this.direta = !!direta
    const filho = direta
      ? spawn(direta.cmd, direta.args, { cwd: this.pasta, env: direta.env, windowsHide: true, detached: process.platform !== 'win32' })
      : spawn(this.bin, [], { cwd: this.pasta, env: this.env, windowsHide: true, shell: viaShell, detached: process.platform !== 'win32' })
    this.filho = filho
    this.morto = false
    if (filho.pid) anotarPid(this.app, filho.pid)
    if (filho.pid) sessoesVivas.add(filho.pid)
    filho.stdout.on('data', (d) => this.aoDados(d))
    filho.stderr.on('data', (d) => registrar(this.app, 'stderr ' + d.toString('utf8').trim().slice(0, 300)))
    filho.on('error', (e) => registrar(this.app, 'erro ao abrir o agente: ' + e.message + ' (' + this.bin + ')'))
    filho.on('exit', (codigo, sinal) => {
      registrar(this.app, 'agente saiu codigo=' + codigo + ' sinal=' + sinal + ' bin=' + this.bin)
      esquecerPid(this.app, filho.pid)
      sessoesVivas.delete(filho.pid)
      if (this.filho !== filho) return // foi substituído de propósito
      for (const p of this.pendentes.values()) p.rej(new Error('O agente encerrou.'))
      this.pendentes.clear()
      this.morto = true
    })
  }

  enviar(o) {
    registrar(this.app, '> ' + JSON.stringify(o).slice(0, 300))
    this.filho.stdin.write(JSON.stringify(o) + '\n')
  }
  chamar(method, params) {
    const id = this.proxId++
    return new Promise((res, rej) => {
      this.pendentes.set(id, { res, rej })
      this.enviar({ jsonrpc: '2.0', id, method, params })
    })
  }
  aoDados(d) {
    this.buf += d.toString('utf8')
    let i
    while ((i = this.buf.indexOf('\n')) >= 0) {
      const l = this.buf.slice(0, i).trim()
      this.buf = this.buf.slice(i + 1)
      if (!l) continue
      let j
      try {
        j = JSON.parse(l)
      } catch {
        continue
      }
      registrar(this.app, '< ' + l.slice(0, j.method === 'session/request_permission' ? 2000 : 300))
      this.tratar(j)
    }
  }
  async tratar(j) {
    if (j.id !== undefined && !j.method) {
      const p = this.pendentes.get(j.id)
      if (!p) return
      this.pendentes.delete(j.id)
      return j.error ? p.rej(new Error(j.error.data?.details || j.error.message)) : p.res(j.result)
    }
    if (j.method === 'session/update') return this.aoAtualizacao(j.params?.update || {})
    if (j.method === 'session/request_permission') {
      const op = j.params.options || []
      const escolha = async () => {
        const permitir = op.find((o) => o.kind === 'allow_always') || op.find((o) => o.kind === 'allow_once') || op[0]
        if (this.permitirSempre) return permitir.optionId
        // o modo de permissão escolhido pelo usuário decide se a pergunta nem chega a aparecer
        if (decidirPermissao(this.modo(), j.params.toolCall || {}, this.pasta) === 'permitir') return (op.find((o) => o.kind === 'allow_once') || permitir).optionId
        const r = await this.pedirPermissao({ chat: this.id, titulo: j.params.toolCall?.title || 'Ação do agente', tipo: j.params.toolCall?.kind, opcoes: op })
        if (r === 'sempre') {
          this.permitirSempre = true
          return permitir.optionId
        }
        if (r === 'permitir') return (op.find((o) => o.kind === 'allow_once') || permitir).optionId
        return (op.find((o) => o.kind === 'reject_once') || op.find((o) => /reject/.test(o.kind)) || op[op.length - 1]).optionId
      }
      const optionId = await escolha()
      return this.enviar({ jsonrpc: '2.0', id: j.id, result: { outcome: { outcome: 'selected', optionId } } })
    }
    // pedidos do agente que o app não implementa: resposta vazia de erro para não travar
    if (j.id !== undefined && j.method) this.enviar({ jsonrpc: '2.0', id: j.id, error: { code: -32601, message: 'não suportado' } })
  }
  // O servidor recusou por limite de uso; mostra a causa real (janela e quando renova). Devolve true se tratou.
  tratarLimiteDeUso(t) {
    const lim = /Limite de uso da janela (\w+) \((\d+) tokens\)[^"]*?(?:reabre em|renova em|A janela reabre em)\s*([0-9T:\-Z.]+)?/i.exec(t)
    if (lim || /Limite de uso da janela/i.test(t)) {
      this.limiteUso = true
      const dataRenova = lim && lim[3] ? new Date(lim[3]) : null
      const quando = dataRenova && !isNaN(dataRenova) ? ` Renova em ${dataRenova.toLocaleString('pt-BR')}.` : '' // data ausente ou ilegível: não mostra "Invalid Date"
      if (!this.avisouLimite) {
        this.avisouLimite = true
        this.emitir({ creditos: { kind: 'tokens' } }) // pop-up de comprar crédito ou assinar o próximo plano (Spec 24)
        this.emitir({ texto: `⛔ O limite de uso do Unlimited acabou nesta janela${lim ? ` (${Number(lim[2]).toLocaleString('pt-BR')} tokens)` : ''}.${quando} Peça ao suporte para liberar mais ou aguarde a renovação. Nada foi perdido: assim que voltar, é só pedir de novo.` })
      }
      return true
    }
    return false
  }
  aoAtualizacao(u) {
    const tipo = u.sessionUpdate
    if (tipo === 'agent_message_chunk' && u.content?.text) {
      const t = u.content.text
      // confirmação em inglês do Hermes para a mensagem enviada no meio do turno: a tela mostra a sua própria
      if (this.direcionando && /^s*(Redirected the active turn|Queued for the next turn|⏩ Steer queued)/i.test(t)) return
      // O servidor recusou por limite de uso, mas o Hermes só diz "conversa longa demais" ou "provedor indisponível".
      // Mostramos a causa real, com o que o servidor informou (janela e quando renova).
      if (this.tratarLimiteDeUso(t)) return
      if (this.limiteUso && /grown too long|auto-?reset|compress/i.test(t)) return // eco enganoso do mesmo problema
      this.emitir({ texto: t })
    }
    else if (tipo === 'agent_thought_chunk' && u.content?.text) this.emitir({ raciocinio: u.content.text })
    else if (tipo === 'usage_update' && u.used >= 0) this.emitir({ contexto: { usado: u.used, tamanho: u.size || CONTEXTO_REAL } })
    else if (tipo === 'tool_call' || tipo === 'tool_call_update') {
      const conteudo = (u.content || [])
        .map((c) => c.content?.text || c.text || (c.type === 'diff' ? `${c.path}\n${c.newText || ''}` : ''))
        .filter(Boolean)
        .join('\n')
      const cota = kindDeCotaDeMidia(conteudo)
      if (cota && !this.cotasAvisadas?.has(cota)) (this.cotasAvisadas ||= new Set()).add(cota), this.emitir({ creditos: { kind: cota } })
      this.emitir({
        ferramenta: {
          id: u.toolCallId,
          titulo: u.title,
          tipo: u.kind,
          status: u.status,
          conteudo: conteudo.slice(0, 4000),
          caminho: u.locations?.[0]?.path || null,
          entrada: u.rawInput ? JSON.stringify(u.rawInput).slice(0, 600) : null,
        },
      })
    }
  }
  // Na primeira vez o Hermes monta o ambiente e às vezes o session/new não responde: se passar do prazo,
  // reinicia o processo (o ambiente já está pronto) e tenta de novo, até 3 vezes.
  comPrazo(promessa, ms) {
    return Promise.race([promessa, new Promise((_, rej) => setTimeout(() => rej(new Error('prazo')), ms))])
  }
  // Idempotente: o construtor já dispara a partida e quem usa a Sessao pode chamar iniciar() de novo (o teste de instalação faz isso). Chamadas
  // simultâneas compartilham a MESMA partida; sem isso a segunda se achava "outro chat" e matava o processo da primeira.
  iniciar() {
    if (this.iniciandoAgora) return this.iniciandoAgora
    const p = this.iniciarVigiado().finally(() => {
      if (this.iniciandoAgora === p) this.iniciandoAgora = null
    })
    this.iniciandoAgora = p
    return p
  }
  async iniciarVigiado() {
    // ambiente já montado: o normal é responder em segundos, então tentativas curtas (reinicia o processo e tenta de novo)
    // "montado" só vale depois de uma sessão já ter respondido nesta pasta; antes disso a 1ª subida leva minutos (prazo longo)
    const desligarVigia = vigiarGitPreso(this.app)
    try {
      await this.iniciarComVigia()
    } finally {
      desligarVigia()
    }
  }
  async iniciarComVigia() {
    if (!ambienteMontado(this.env.HERMES_HOME, this.bin)) await this.aguardarMontagem()
    // FILA DE PARTIDA (QA macOS 11/11/2026): reserva + conversa aberta + aquecimento subiam juntos; numa máquina lenta o gateway do Hermes
    // estourava o prazo de partida ("Gateway starting: deadline"), as sessões eram mortas e a pergunta virava "Não consegui responder agora".
    // Uma sessão faz o aperto de mão por vez; a seguinte espera no máximo 2 min e então segue mesmo assim (nunca trava).
    const anterior = filaPartida
    let liberar
    filaPartida = new Promise((r) => (liberar = r))
    await Promise.race([anterior, new Promise((r) => setTimeout(r, 120000))])
    try {
      await this.handshakeComTentativas()
    } finally {
      liberar()
    }
  }
  async handshakeComTentativas() {
    let ultimo
    const montado = ambienteMontado(this.env.HERMES_HOME, this.bin)
    const TENTATIVAS = montado ? 5 : 3
    for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
      try {
        const prazo = process.env.SB_TESTE_PRAZO ? +process.env.SB_TESTE_PRAZO : montado ? (tentativa === 1 ? 90000 : 60000) : tentativa === 1 ? 240000 : 90000
        const t0 = Date.now()
        await this.comPrazo(this.chamar('initialize', { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } } }), prazo)
        const r = await this.comPrazo(this.chamar('session/new', { cwd: this.pasta, mcpServers: this.servidoresMcp() }), prazo)
        this.sid = r.sessionId
        registrar(this.app, `agente pronto em ${((Date.now() - t0) / 1000).toFixed(1)} s (tentativa ${tentativa}${this.direta ? ', partida direta' : ''})`)
        marcarMontado(this.env.HERMES_HOME, this.bin)
        if (!this.direta && !this.semDireta) partidaDireta.preparar(this.env.HERMES_HOME, this.bin, this.env, (l) => registrar(this.app, l)).catch(() => {})
        // sessão aquecida e ainda sem uso: não fica de pé para sempre (perguntar() cancela este timer ao começar um turno)
        clearTimeout(this.ocioso)
        this.agendarOcioso()
        return
      } catch (e) {
        ultimo = e
        registrar(this.app, `iniciar falhou (tentativa ${tentativa}): ${e.message}`)
        if (this.direta) {
          // a partida direta falhou: volta ao lançador nesta sessão e descarta o atalho (ele é refeito depois de uma partida boa)
          registrar(this.app, 'partida direta falhou; voltando ao lançador')
          this.semDireta = true
          partidaDireta.invalidar(this.env.HERMES_HOME)
          const antigoD = this.filho
          this.pendentes.clear()
          try {
            matarArvorePoupandoGateway(antigoD.pid, this.env.HERMES_HOME)
          } catch {}
          sessoesVivas.delete(antigoD.pid)
          this.subir()
          continue
        }
        // "Gateway starting: deadline": o gateway compartilhado ainda está subindo; é igual a estourar o prazo (tenta de novo)
        if (e.message !== 'prazo' && !/gateway starting/i.test(e.message)) throw e
        if (/gateway starting/i.test(e.message)) await new Promise((r) => setTimeout(r, 3000))
        if (tentativa < TENTATIVAS) this.emitir({ aviso: 'Preparando o agente… só um instante.' })
        const antigo = this.filho
        this.pendentes.clear()
        matarArvorePoupandoGateway(antigo.pid, this.env.HERMES_HOME) // arvore da PROPRIA sessao; o gateway compartilhado nao cai
        sessoesVivas.delete(antigo.pid)
        this.subir()
      }
    }
    throw new Error('O agente não respondeu ao iniciar: ' + (ultimo?.message || 'sem detalhe'))
  }
  // Primeira montagem do ambiente: o primeiro chat monta (com o próprio processo); os outros saem do caminho e esperam, para não montarem em paralelo.
  // Quando termina, cada um sobe o seu processo de novo, agora com o ambiente pronto (partida de segundos).
  async aguardarMontagem() {
    const home = this.env.HERMES_HOME
    let m = montagens.get(home)
    let dono = false
    if (!m) {
      dono = true
      m = this.montarAmbiente()
      montagens.set(home, m)
      m.then(() => {}, () => {}).then(() => montagens.delete(home))
    } else {
      this.emitir({ aviso: 'Preparando o agente pela primeira vez. Isso leva alguns minutos e acontece uma vez só…' })
      const antigo = this.filho
      sessoesVivas.delete(antigo.pid)
      matarArvorePoupandoGateway(antigo.pid, home) // este processo não monta em paralelo
    }
    try {
      await m
    } catch (e) {
      registrar(this.app, 'montagem do ambiente falhou: ' + e.message + (dono ? '' : ' (outro chat montava)'))
      // não derruba o chat: segue para as tentativas normais abaixo (que reiniciam o processo e tentam de novo)
    }
    // o processo que montou foi encerrado ao fim da montagem; todos sobem um novo para a sessão de verdade
    if (this.filho !== null && !this.filho.killed && dono) {
      const antigo = this.filho
      sessoesVivas.delete(antigo.pid)
      matarArvorePoupandoGateway(antigo.pid, home)
    }
    this.pendentes.clear()
    this.subir()
    this.morto = false
  }
  async montarAmbiente() {
    const home = this.env.HERMES_HOME
    const t0 = Date.now()
    let sinal = Date.now()
    const vivo = () => (sinal = Date.now())
    this.filho.stdout.on('data', vivo)
    this.filho.stderr.on('data', vivo)
    const dirs = [path.join(home, 'installs'), path.join(home, 'cache')]
    let ultimaContagem = -1
    let contando = false
    const sonda = setInterval(async () => {
      if (contando) return
      contando = true
      try {
        const n = await contarArquivos(dirs)
        if (n !== ultimaContagem) {
          ultimaContagem = n
          vivo()
        }
      } finally {
        contando = false
      }
    }, 10000)
    const aviso = setInterval(() => {
      const min = Math.floor((Date.now() - t0) / 60000)
      this.emitir({ aviso: 'Preparando o agente pela primeira vez' + (min ? ` (${min} min)` : '') + '. Isso leva alguns minutos e acontece uma vez só…' })
    }, 30000)
    this.emitir({ aviso: 'Preparando o agente pela primeira vez. Isso leva alguns minutos e acontece uma vez só…' })
    registrar(this.app, 'montando o ambiente do Hermes (primeira execução deste HERMES_HOME)')
    const desligarVigia = vigiarGitPreso(this.app)
    const esperar = (promessa) =>
      new Promise((res, rej) => {
        const vigia = setInterval(() => {
          if (Date.now() - sinal > SEM_PROGRESSO_MS) (clearInterval(vigia), rej(new Error('prazo (sem sinal de vida)')))
          else if (Date.now() - t0 > TETO_MONTAGEM_MS) (clearInterval(vigia), rej(new Error('prazo (teto da montagem)')))
        }, 5000)
        promessa.then(
          (v) => (clearInterval(vigia), res(v)),
          (e) => (clearInterval(vigia), rej(e))
        )
      })
    try {
      await esperar(this.chamar('initialize', { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } } }))
      await esperar(this.chamar('session/new', { cwd: this.pasta, mcpServers: [] }))
      marcarMontado(home, this.bin)
      registrar(this.app, `ambiente do Hermes montado em ${((Date.now() - t0) / 1000).toFixed(0)} s`)
    } finally {
      clearInterval(sonda)
      clearInterval(aviso)
      desligarVigia()
      this.filho.stdout.off('data', vivo)
      this.filho.stderr.off('data', vivo)
    }
  }
  // ferramentas do navegador integrado: um servidor MCP (stdio) que repassa as chamadas ao app
  servidoresMcp() {
    const lista = []
    if (this.ias && this.ias.lista && this.ias.lista.length) {
      const shimIas = [path.join(process.resourcesPath || '', 'mcp-ias.js'), path.join(__dirname, 'mcp-ias.js')].find((p) => fs.existsSync(p)) || path.join(__dirname, 'mcp-ias.js')
      lista.push({
        name: 'ias',
        command: process.execPath,
        args: [shimIas],
        env: [
          { name: 'ELECTRON_RUN_AS_NODE', value: '1' },
          { name: 'SB_IAS_BASE', value: this.ias.base },
          { name: 'SB_IAS_CHAVE', value: this.ias.chave || '' },
          { name: 'SB_IAS_LISTA', value: JSON.stringify(this.ias.lista.slice(0, 60)) },
        ],
      })
    }
    if (this.memoria) {
      const shimMem = [path.join(process.resourcesPath || '', 'mcp-memoria.js'), path.join(__dirname, 'mcp-memoria.js')].find((p) => fs.existsSync(p)) || path.join(__dirname, 'mcp-memoria.js')
      lista.push({
        name: 'memoria',
        command: process.execPath,
        args: [shimMem],
        env: [
          { name: 'ELECTRON_RUN_AS_NODE', value: '1' },
          { name: 'SB_MEMORIA_ARQ', value: this.memoria.arquivo },
          { name: 'SB_MEMORIA_CHAT', value: this.id }, ...(this.vagaArq ? [{ name: 'SB_VAGA_ARQ', value: this.vagaArq }] : []),
        ],
      })
    }
    if (this.midia) {
      const shimM = [path.join(process.resourcesPath || '', 'mcp-midia.js'), path.join(__dirname, 'mcp-midia.js')].find((p) => fs.existsSync(p)) || path.join(__dirname, 'mcp-midia.js')
      lista.push({
        name: 'midia',
        command: process.execPath,
        args: [shimM],
        env: [
          { name: 'ELECTRON_RUN_AS_NODE', value: '1' },
          { name: 'SB_MIDIA_BASE', value: this.midia.base },
          { name: 'SB_MIDIA_CHAVE', value: this.midia.chave },
          { name: 'SB_MIDIA_PASTA', value: this.pasta },
          { name: 'SB_MIDIA_PREFS', value: JSON.stringify(this.midia.prefs || {}) },
          { name: 'SB_MIDIA_CHAT', value: this.id }, ...(this.vagaArq ? [{ name: 'SB_VAGA_ARQ', value: this.vagaArq }] : []),
          ...['SB_MIDIA_MOCK', 'SB_MIDIA_MOCK_ARQ', 'SB_MIDIA_MOCK_IMG'].filter((k) => process.env[k]).map((k) => ({ name: k, value: process.env[k] })), // simulação para desenvolver a tela
        ],
      })
    }
    lista.push(...mcpsExternos(this.app, lista.map((x) => x.name)))
    // editor de vídeo: o motor (quando instalado) e as ferramentas do app (instalar, abrir janela, cortar silêncio)
    try {
      const ev = require('./editor-video')
      const motor = ev.mcp(this.app, this.pasta)
      if (motor) lista.push(motor)
      if (this.navegador && ev.suportado() && ev.habilitado(this.app)) {
        const shimEd = [path.join(process.resourcesPath || '', 'mcp-editor.js'), path.join(__dirname, 'mcp-editor.js')].find((p) => fs.existsSync(p)) || path.join(__dirname, 'mcp-editor.js')
        lista.push({ name: 'editor-app', command: process.execPath, args: [shimEd], env: [{ name: 'ELECTRON_RUN_AS_NODE', value: '1' }, { name: 'SB_NAV_URL', value: this.navegador.url }, { name: 'SB_NAV_TOKEN', value: this.navegador.token }] })
      }
    } catch {}
    if (!this.navegador) return lista
    const shim = [path.join(process.resourcesPath || '', 'mcp-navegador.js'), path.join(__dirname, 'mcp-navegador.js')].find((p) => fs.existsSync(p)) || path.join(__dirname, 'mcp-navegador.js')
    const shimMotion = [path.join(process.resourcesPath || '', 'mcp-motion.js'), path.join(__dirname, 'mcp-motion.js')].find((p) => fs.existsSync(p)) || path.join(__dirname, 'mcp-motion.js')
    return [
      ...lista,
      { name: 'motion', command: process.execPath, args: [shimMotion], env: [{ name: 'ELECTRON_RUN_AS_NODE', value: '1' }, { name: 'SB_NAV_URL', value: this.navegador.url }, { name: 'SB_NAV_TOKEN', value: this.navegador.token }] },
      {
        name: 'navegador',
        command: process.execPath,
        args: [shim],
        env: [
          { name: 'ELECTRON_RUN_AS_NODE', value: '1' },
          { name: 'SB_NAV_URL', value: this.navegador.url },
          { name: 'SB_NAV_TOKEN', value: this.navegador.token },
        ],
      },
    ]
  }
  // O Hermes não pode desistir de uma tarefa por ter caído: se o processo morrer com um turno em voo, relança sozinho e
  // reenvia o mesmo pedido, sem limite de tentativas nem de tempo total — só um pedido explícito de parar (cancelar())
  // interrompe o laço. Falha de UMA ferramenta dentro de uma sessão viva (ex.: comando sem um pacote) não entra aqui:
  // isso o próprio modelo já resolve normalmente, com o processo de pé; isto só cobre o processo inteiro caindo.
  // AQUECIMENTO REAL: o session/new do Hermes NAO constroi o agente nem abre os servidores MCP; isso so acontece no 1o session/prompt
  // (medido: 36 s entre o prompt e a 1a chamada ao modelo numa sessao "pronta"). Um turno minimo, sem tela, paga esse custo antes da pessoa
  // perguntar. O prompt de sistema vai junto, entao o cache de prefixo do servidor tambem esquenta. O historico do chat entra do mesmo jeito.
  async aquecer() {
    if (this.aquecendo) return this.aquecendo
    this.aquecendo = (async () => {
      await this.pronta
      if (!this.primeira || this.turno || this.morto) return
      this.mudo = true
      const t0 = Date.now()
      try {
        this.ativo = true
        await this._perguntar('[aquecimento] Diga em uma frase curta que está pronto para ajudar.', [])
        registrar(this.app, `agente aquecido (1o turno) em ${((Date.now() - t0) / 1000).toFixed(1)} s`)
      } catch (e) {
        this.aquecimentoFalhou = true // sessão reserva com isto não é entregue a nenhuma conversa (é trocada por outra)
        registrar(this.app, 'aquecimento falhou: ' + (e.message || e))
      } finally {
        this.ativo = false
        this.mudo = false
      }
    })().finally(() => (this.aquecendo = null))
    return this.aquecendo
  }
  async perguntar(texto, anexos = []) {
    if (this.aquecendo) await this.aquecendo // a pergunta real espera o aquecimento terminar (ele e curto) em vez de enfileirar atras dele
    this.ativo = true
    clearTimeout(this.ocioso)
    try {
      return await this._perguntar(texto, anexos)
    } finally {
      this.ativo = false
    }
  }
  async _perguntar(texto, anexos = []) {
    clearTimeout(this.ocioso)
    this.limiteUso = false
    this.avisouLimite = false
    this.cotasAvisadas = null
    this.pedidoParar = false
    await this.pronta
    if (this.pedidoParar) throw new Error('Interrompido.') // o usuário parou enquanto o agente ainda subia (ex.: 1ª montagem do ambiente)
    let corpo = texto
    if (anexos.length) corpo += '\n\nArquivos anexados (use as ferramentas para ler):\n' + anexos.map((a) => `- ${a}`).join('\n')
    const corpoPuro = corpo
    if (!this.primeira && this.historicoPendente && !texto.startsWith('[aquecimento]')) {
      // sessão reserva adotada por uma conversa que já tinha mensagens: o resumo entra na primeira pergunta real
      const nl = String.fromCharCode(10)
      corpo = 'Conversa até aqui (continue dela):' + nl + this.historicoPendente + nl + nl + '---' + nl + corpo
      this.historicoPendente = null
    }
    if (this.primeira) {
      const nl = String.fromCharCode(10)
      const hist = this.historico ? nl + nl + 'Conversa até aqui (continue dela):' + nl + this.historico : ''
      corpo = contextoDeSistema({ pasta: this.pasta, navegador: !!this.navegador, midia: !!this.midia, memoria: !!this.memoria }) + hist + nl + nl + '---' + nl + corpo
      this.primeira = false
    }
    // o que já aconteceu NESTE turno (texto escrito e ferramentas concluídas): se o processo cair, a retomada conta isso ao agente novo
    const feitos = []
    let parcial = ''
    const emitirOriginal = this._emitir || (() => {})
    const embrulho = (e) => {
      if (e && e.texto && /^\s*gateway\.errors\./.test(e.texto)) return // texto interno do Hermes sobre sessao velha: nunca aparece pro cliente
      if (e && e.texto) parcial += e.texto
      if (e && e.ferramenta && e.ferramenta.status === 'completed' && e.ferramenta.titulo) feitos.push(String(e.ferramenta.titulo).slice(0, 120) + (e.ferramenta.conteudo ? ' -> ' + String(e.ferramenta.conteudo).replace(/\s+/g, ' ').slice(0, 200) : ''))
      emitirOriginal(e)
    }
    this.emitir = embrulho
    const aquecimento = texto.startsWith('[aquecimento]')
    const guardarTurno = () => {
      if (aquecimento) return
      this.turnosVivos = ((this.turnosVivos || '') + '\nUsuário: ' + texto.slice(0, 2000) + '\nAssistente: ' + parcial.slice(0, 2000)).slice(-12000)
    }
    let tentativa = 0
    let velhas = 0
    let erroTurno = ''
    try {
      while (true) {
        tentativa++
        this.turno = this.chamar('session/prompt', { sessionId: this.sid, prompt: [{ type: 'text', text: corpo + (this.chatMarca ? String.fromCharCode(10) + '<!--sb:' + this.chatMarca + '-->' : '') }] })
        try {
          const r = await this.turno
          this.turno = null
          if (this.pendenteDirecionar && !this.pedidoParar) {
            // a pessoa falou no meio: este turno foi cancelado de propósito; o próximo prompt leva a correção (o Hermes reanexa o pedido interrompido)
            corpo = this.pendenteDirecionar
            this.pendenteDirecionar = null
            this.cancelandoDirecionar = false
            registrar(this.app, 'retomando com a mensagem acrescentada pela pessoa')
            continue
          }
          guardarTurno()
          this.agendarOcioso()
          return r
        } catch (e) {
          this.turno = null
          erroTurno = String(e.message)
          if (this.pedidoParar || !MORTE_DO_AGENTE.test(String(e.message))) {
            this.agendarOcioso()
            throw e
          }
        }
        if (SESSAO_VELHA.test(erroTurno) && ++velhas > 2) throw new Error('Não consegui responder agora. Tente enviar de novo em instantes.')
        registrar(this.app, `turno interrompido pela morte do agente (tentativa ${tentativa}), retomando sozinho`)
        this.emitir({ novoCard: true })
        // o processo pode estar de pé mas sem gateway: derruba a árvore DESTA sessão (o gateway compartilhado não cai) e sobe outro
        const antigo = this.filho
        this.pendentes.clear()
        try {
          sessoesVivas.delete(antigo.pid)
          matarArvorePoupandoGateway(antigo.pid, this.env.HERMES_HOME)
          // sessao velha: o gateway guarda a configuracao e a memoria privada de quando subiu; reiniciar so a sessao nao basta. Ele sobe de novo sozinho
          // e as outras conversas se recuperam pelo mesmo caminho.
          if (SESSAO_VELHA.test(erroTurno)) {
            const g = JSON.parse(fs.readFileSync(path.join(this.env.HERMES_HOME, 'gateway.pid'), 'utf8'))
            if (g && g.kind === 'hermes-gateway' && vivo(g.pid)) (matarArvore(g.pid), registrar(this.app, 'gateway reiniciado: sessao velha (' + erroTurno + ')'))
          }
        } catch {}
        // a sessão nova não tem a memória da anterior: leva o contexto, a conversa até aqui e o que este turno já fez
        const nl = String.fromCharCode(10)
        const hist = [this.historico, this.turnosVivos].filter(Boolean).join(nl)
        corpo =
          contextoDeSistema({ pasta: this.pasta, navegador: !!this.navegador, midia: !!this.midia, memoria: !!this.memoria }) +
          (hist ? nl + nl + 'Conversa até aqui (continue dela):' + nl + hist : '') +
          nl + nl + '---' + nl + corpoPuro +
          nl + nl + '[Retomada automática] O processo caiu no meio desta tarefa, sem culpa do usuário. ' +
          (feitos.length ? 'Já foi feito neste pedido:' + nl + feitos.map((f) => '- ' + f).join(nl) + nl : '') +
          (parcial ? 'Texto que você já tinha escrito: ' + parcial.slice(-1500) + nl : '') +
          'Continue de onde parou, sem refazer o que já foi entregue (arquivos e imagens já gerados estão na pasta de trabalho) e SEM mencionar a queda nem pedir desculpas.'
        // só avança pro reenvio quando subir()+iniciar() confirmarem um processo novo de pé (com sessão nova)
        while (!this.pedidoParar) {
          await new Promise((res) => setTimeout(res, Math.min(10000, 1000 * tentativa)))
          if (this.pedidoParar) break
          try {
            this.subir()
            this.morto = false
            await this.iniciar()
            break
          } catch (e2) {
            registrar(this.app, `relançamento falhou (tentativa ${tentativa}): ${e2.message}`)
            tentativa++
          }
        }
        if (this.pedidoParar) {
          this.agendarOcioso()
          throw new Error('Interrompido.')
        }
      }
    } finally {
      if (this._emitir === embrulho) this.emitir = emitirOriginal // se a tela trocou o canal no meio (nova pergunta), fica o novo
      this.pendenteDirecionar = null
      this.cancelandoDirecionar = false
    }
  }
  // Mensagem do usuário no MEIO do turno. O Hermes (ACP) trata prompts em fila, um por vez: um 2º session/prompt só rodaria depois do fim do turno.
  // Em vez disso o app cancela SÓ o turno em andamento (session/cancel) e reenvia logo em seguida a mensagem; o Hermes reanexa o pedido interrompido
  // e a correção sozinho (_rewrite_prompt_for_interrupt). Para a tela é o mesmo card: o trabalho continua incorporando o que a pessoa acrescentou.
  async direcionar(texto) {
    if (!this.turno || this.morto || !this.sid || this.pedidoParar) return false
    this.pendenteDirecionar = (this.pendenteDirecionar ? this.pendenteDirecionar + String.fromCharCode(10, 10) : '') + texto
    if (!this.cancelandoDirecionar) {
      this.cancelandoDirecionar = true
      try {
        this.enviar({ jsonrpc: '2.0', method: 'session/cancel', params: { sessionId: this.sid } })
      } catch {
        this.cancelandoDirecionar = false
        this.pendenteDirecionar = null
        return false
      }
    }
    registrar(this.app, 'mensagem do usuário recebida no meio do turno: cancelando a etapa e reenviando com a correção')
    return true
  }
  cancelar() {
    this.pedidoParar = true // interrompe também o laço de relançamento de perguntar(), se estiver nele
    if (this.sid && !this.morto && this.filho) {
      try {
        this.enviar({ jsonrpc: '2.0', method: 'session/cancel', params: { sessionId: this.sid } })
      } catch {}
    }
  }
  // Sessão ociosa por muito tempo (aquecida e sem uso) encerra para não deixar processo à toa. NUNCA derruba uma sessão com trabalho em andamento:
  // se há turno (ou retomada) em curso, só adia. Antes disso o cronômetro era rearmado ao relançar o agente no meio de uma tarefa e matava o Hermes
  // no meio do trabalho (taskkill /F sai com código 1: era o "agente saiu codigo=1" a cada ~10 min em tarefas longas).
  // o chat está aberto na tela: a sessão continua quente (o cronômetro de ociosa recomeça)
  tocar() {
    if (!this.morto && this.ocioso) this.agendarOcioso()
  }
  agendarOcioso() {
    clearTimeout(this.ocioso)
    if (this.fixa) return // sessão-âncora: fica de pé enquanto o app estiver aberto (mantém o gateway do Hermes vivo)
    this.ocioso = setTimeout(() => {
      if (this.ativo || this.turno) {
        registrar(this.app, 'sessão ociosa NÃO encerrada: há turno em andamento (adiada)')
        return this.agendarOcioso()
      }
      registrar(this.app, 'sessão ociosa encerrada (' + Math.round(OCIOSO_MS / 60000) + ' min sem uso)')
      this.encerrar()
    }, OCIOSO_MS)
    this.ocioso.unref?.()
  }
  encerrar() {
    clearTimeout(this.ocioso)
    clearInterval(this.vigia)
    try {
      sessoesVivas.delete(this.filho.pid)
      matarArvorePoupandoGateway(this.filho.pid, this.env.HERMES_HOME)
    } catch {}
  }
}

module.exports = { prepararHome, contextoDeSistema, decidirPermissao, vigiarGitPreso, caminhosHermes, MORTE_DO_AGENTE, kindDeCotaDeMidia, Sessao,ambienteMontado, limparGitPreso, localizarBinario, atalhoValido, prepararBase, definirPacote, mcpsExternos, registrar, matarArvore, matarArvorePoupandoGateway, descendentes, limparHermesPreso, matarGatewayOrfao, sessoesVivas, sincronizarSkillsGlobais }
