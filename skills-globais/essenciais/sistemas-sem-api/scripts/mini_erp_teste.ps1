# "Mini ERP" de teste (janela Windows clássica, como um sistema Delphi/VB antigo): campos Cliente e Valor, botão Lançar, grava em CSV.
# Serve para treinar e testar macros da skill sistemas-sem-api sem mexer em nenhum programa do usuário. Fecha sozinho depois de 10 minutos.
# Uso: powershell -ExecutionPolicy Bypass -File mini_erp_teste.ps1 -Banco "C:\...\lancamentos.csv"
param([string]$Banco = "$env:TEMP\mini-erp-lancamentos.csv")
Add-Type -AssemblyName System.Windows.Forms
$f = New-Object Windows.Forms.Form
$f.Text = "Mini ERP - Lançamento de Notas"
$f.Size = New-Object Drawing.Size(420, 260)
$f.StartPosition = "CenterScreen"
function Rotulo($t, $y) { $l = New-Object Windows.Forms.Label; $l.Text = $t; $l.Location = New-Object Drawing.Point(20, $y); $l.AutoSize = $true; $f.Controls.Add($l) }
function Campo($nome, $y) { $c = New-Object Windows.Forms.TextBox; $c.Name = $nome; $c.AccessibleName = $nome; $c.Location = New-Object Drawing.Point(120, $y); $c.Width = 250; $f.Controls.Add($c); $c }
Rotulo "Cliente" 30; $cli = Campo "Cliente" 27
Rotulo "Valor (R$)" 70; $val = Campo "Valor" 67
$st = New-Object Windows.Forms.Label; $st.Name = "Status"; $st.Location = New-Object Drawing.Point(20, 160); $st.Width = 360; $st.Text = "Pronto"; $f.Controls.Add($st)
$b = New-Object Windows.Forms.Button; $b.Text = "Lançar"; $b.Name = "Lancar"; $b.AccessibleName = "Lançar"; $b.Location = New-Object Drawing.Point(120, 110); $f.Controls.Add($b)
$b.Add_Click({
  if (-not $cli.Text -or -not ($val.Text -as [decimal])) { $st.Text = "Erro: preencha cliente e valor"; return }
  if (-not (Test-Path $Banco)) { "numero;cliente;valor;em" | Out-File -FilePath $Banco -Encoding utf8 }
  $n = (Get-Content $Banco | Measure-Object).Count
  "$n;$($cli.Text);$($val.Text);$(Get-Date -Format s)" | Out-File -FilePath $Banco -Append -Encoding utf8
  $st.Text = "Nota $n lançada"
  $cli.Text = ""; $val.Text = ""
})
$t = New-Object Windows.Forms.Timer; $t.Interval = 600000; $t.Add_Tick({ $f.Close() }); $t.Start()
[void]$f.ShowDialog()
