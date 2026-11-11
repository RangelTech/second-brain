# Monta o agente (Hermes) que vai DENTRO do instalador do Windows, para a instalacao nao depender de baixar nada na maquina do cliente.
# Roda no CI (windows-latest) antes de empacotar o instalador. O Hermes grava o caminho absoluto do ambiente dele, entao ele e instalado no
# MESMO caminho fixo em que o app vai descompacta-lo no cliente (C:\SegundoCerebro\hermes) e depois compactado em 7z (LZMA2).
# Saida: build\hermes-runtime\hermes-win32-x64.7z e 7za.exe (o extrator que o app usa ao instalar).
$ErrorActionPreference = 'Stop'
$raizPai = 'C:\SegundoCerebro'
$raiz = Join-Path $raizPai 'hermes'
$ref = if ($env:SB_HERMES_REF) { $env:SB_HERMES_REF } else { 'main' }
$saida = Join-Path (Get-Location) 'build\hermes-runtime'
$sete = Join-Path (Get-Location) 'node_modules\7zip-bin\win\x64\7za.exe'
if (-not (Test-Path $sete)) { throw "7za.exe nao encontrado em $sete" }

Remove-Item -Recurse -Force $raizPai -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $raiz | Out-Null
New-Item -ItemType Directory -Force $saida | Out-Null
Remove-Item -Force (Join-Path $saida '*') -ErrorAction SilentlyContinue

$script = Join-Path $env:TEMP 'sb-hermes-install.ps1'
$url = "https://raw.githubusercontent.com/NousResearch/hermes-agent/$ref/scripts/install.ps1"
for ($i = 1; $i -le 3; $i++) {
    try { Invoke-WebRequest -Uri $url -OutFile $script -UseBasicParsing; break } catch { if ($i -eq 3) { throw }; Start-Sleep -Seconds (10 * $i) }
}

$env:HERMES_HOME = $raiz
$t0 = Get-Date
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script -NonInteractive -SkipBrowser -SkipComputerUse -HermesHome $raiz
"instalador oficial terminou (codigo $LASTEXITCODE) em $([int]((Get-Date) - $t0).TotalMinutes) min"
if (-not (Test-Path (Join-Path $raiz 'bin\hermes-acp.exe'))) { throw 'o Hermes nao foi instalado (sem bin\hermes-acp.exe)' }

# Enxuga o pacote: o cliente descompacta cada arquivo (e o antivirus confere um por um). Medido em 11/11/2026: o codigo do Hermes tem ~24 mil
# arquivos e ~15 mil sao so de desenvolvimento (testes, site, app de desktop proprio do Hermes, lista de contribuidores). O app usa so o ACP.
$agente = Join-Path $raiz 'hermes-agent'
$antes = (Get-ChildItem $agente -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object).Count
# node_modules do proprio Hermes: so ferramentas de desenvolvimento e o build das interfaces web/terminal (o app usa so o ACP). Eram ~27 mil arquivos
# (quase metade do pacote) e o cliente descompacta cada um. O node/npm que o agente usa para rodar MCP ficam em tools\, fora daqui.
foreach ($d in 'tests', 'contributors', 'website', 'evals', 'docker', 'apps\desktop', 'node_modules', 'web\node_modules', 'ui-tui\node_modules') {
    Remove-Item -Recurse -Force (Join-Path $agente $d) -ErrorAction SilentlyContinue
}
$depois = (Get-ChildItem $agente -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object).Count
"codigo do Hermes enxugado: $antes -> $depois arquivos"
# atalhos (junction/symlink) do pnpm que apontavam para o que saiu ficam quebrados e o 7za reclama: remove os que nao levam a lugar nenhum
Get-ChildItem $agente -Recurse -Force -Attributes ReparsePoint -ErrorAction SilentlyContinue | Where-Object { $_.Target -and -not (Test-Path (Join-Path (Split-Path $_.FullName) ([string]$_.Target)) -ErrorAction SilentlyContinue) -and -not (Test-Path ([string]$_.Target) -ErrorAction SilentlyContinue) } | ForEach-Object { "atalho quebrado removido: $($_.FullName)"; Remove-Item $_.FullName -Force -Recurse -ErrorAction SilentlyContinue }

# o Hermes precisa subir no caminho fixo. O --version AQUI pode falhar porque o ambiente de dependencias so e montado no passo "Ambiente PRONTO" (abaixo):
# so avisa; quem prova que o agente sobe e o montar-ambiente.js (ACP initialize) e o teste de instalacao do CI.
$env:HERMES_HOME = Join-Path $env:TEMP 'sb-hermes-home-teste'
New-Item -ItemType Directory -Force $env:HERMES_HOME | Out-Null
& (Join-Path $raiz 'bin\hermes.exe') --version
if ($LASTEXITCODE -ne 0) { Write-Warning "hermes --version falhou (codigo $LASTEXITCODE): esperado ate o ambiente ser montado" }

# tira o que e estado/cache de quem montou; o app do cliente usa o proprio HERMES_HOME (hermes-home) e nao este
foreach ($d in 'cache', 'logs', 'sessions', 'memories', 'backups', 'image_cache', 'audio_cache', 'telemetry', 'pairing', 'cron') {
    Remove-Item -Recurse -Force (Join-Path $raiz $d) -ErrorAction SilentlyContinue
}
"tamanho em disco: {0} MB" -f [int]((Get-ChildItem $raiz -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum / 1MB)

$arq = Join-Path $saida 'hermes-win32-x64.7z'
Push-Location $raiz
& $sete a -t7z -m0=lzma2 -mx=5 -mmt=on -bso0 -bsp0 $arq '*'
if ($LASTEXITCODE -gt 1) { throw "7za falhou (codigo $LASTEXITCODE)" } # 1 = so avisos (ex.: atalho quebrado); o pacote sai inteiro
Pop-Location
Copy-Item $sete (Join-Path $saida '7za.exe') -Force
"pacote: {0} MB" -f [int]((Get-Item $arq).Length / 1MB)

# Ambiente PRONTO (2o pacote): monta o ambiente Python/Node do Hermes na pasta de dados FIXA (C:\SegundoCerebro\d, a mesma que o app usa no cliente) e compacta so
# o que e do ambiente (installs, environments, bin, install_id). No PC do cliente isso e descompactado e o agente ja nasce pronto, sem baixar nada (instalacao em
# poucos minutos). Qualquer falha aqui NAO derruba o instalador: ele so deixa de levar o ambiente (o app monta pela internet, como antes).
try {
    $casa = 'C:\SegundoCerebro\d'
    Remove-Item -Recurse -Force $casa -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force $casa | Out-Null
    $t1 = Get-Date
    & node (Join-Path (Get-Location) 'scripts\montar-ambiente.js') (Join-Path $raiz 'bin\hermes-acp.exe') $casa 40
    if ($LASTEXITCODE -ne 0) { throw "montar-ambiente falhou (codigo $LASTEXITCODE)" }
    "ambiente montado em $([int]((Get-Date) - $t1).TotalMinutes) min"
    foreach ($d in 'cache', 'logs', 'sessions', 'memories', 'backups', 'image_cache', 'audio_cache', 'telemetry', 'pairing', 'cron', 'kanban', 'state', 'runtime', 'platforms', 'plugins', 'hooks', 'gateway', 'skills', 'source-checks', 'pending_messages', 'plugin-update-checks', '.curator_backups') {
        Remove-Item -Recurse -Force (Join-Path $casa $d) -ErrorAction SilentlyContinue
    }
    Get-ChildItem $casa -File -Force | Where-Object { $_.Name -ne 'install_id' } | Remove-Item -Force -ErrorAction SilentlyContinue
    "ambiente em disco: {0} MB" -f [int]((Get-ChildItem $casa -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum / 1MB)
    $arqHome = Join-Path $saida 'home-win32-x64.7z'
    Push-Location $casa
    & $sete a -t7z -m0=lzma2 -mx=5 -mmt=on -bso0 -bsp0 $arqHome '*'
    if ($LASTEXITCODE -ne 0) { throw "7za do ambiente falhou (codigo $LASTEXITCODE)" }
    Pop-Location
    "ambiente compactado: {0} MB" -f [int]((Get-Item $arqHome).Length / 1MB)
} catch {
    Write-Warning "sem ambiente pronto no instalador: $_"
    Remove-Item -Force (Join-Path $saida 'home-win32-x64.7z') -ErrorAction SilentlyContinue
    try { Pop-Location } catch {}
}
# o pacote do ambiente e opcional: uma falha acima ja virou aviso, e o codigo de saida de um comando nativo nao pode derrubar o build
exit 0
