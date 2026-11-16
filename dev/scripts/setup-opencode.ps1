param(
  [string]$Repo = "git@github.com:MostafaRastegar/mr-opencode.git",
  [string]$Target = "$env:USERPROFILE\.config\opencode"
)
$ErrorActionPreference = "Stop"
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw "python not found" }
$Script = Join-Path $env:TEMP "opc-sync.py"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/MostafaRastegar/mr-opencode/main/dev/scripts/opc-sync.py" -OutFile $Script
python $Script --repo $Repo --target $Target pull
Write-Host "Done. Run: python $Script --target $Target verify"