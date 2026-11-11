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

# o Hermes precisa subir no caminho fixo (o --version confere o ambiente de dependencias)
$env:HERMES_HOME = Join-Path $env:TEMP 'sb-hermes-home-teste'
New-Item -ItemType Directory -Force $env:HERMES_HOME | Out-Null
& (Join-Path $raiz 'bin\hermes.exe') --version
if ($LASTEXITCODE -ne 0) { throw "hermes --version falhou (codigo $LASTEXITCODE)" }

# tira o que e estado/cache de quem montou; o app do cliente usa o proprio HERMES_HOME (hermes-home) e nao este
foreach ($d in 'cache', 'logs', 'sessions', 'memories', 'backups', 'image_cache', 'audio_cache', 'telemetry', 'pairing', 'cron') {
    Remove-Item -Recurse -Force (Join-Path $raiz $d) -ErrorAction SilentlyContinue
}
"tamanho em disco: {0} MB" -f [int]((Get-ChildItem $raiz -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum / 1MB)

$arq = Join-Path $saida 'hermes-win32-x64.7z'
Push-Location $raiz
& $sete a -t7z -m0=lzma2 -mx=5 -mmt=on -bso0 -bsp0 $arq '*'
if ($LASTEXITCODE -ne 0) { throw "7za falhou (codigo $LASTEXITCODE)" }
Pop-Location
Copy-Item $sete (Join-Path $saida '7za.exe') -Force
"pacote: {0} MB" -f [int]((Get-Item $arq).Length / 1MB)
