$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
if (-not (Test-Path -LiteralPath (Join-Path $root ".env"))) {
  Copy-Item -LiteralPath (Join-Path $root ".env.example") -Destination (Join-Path $root ".env")
  Write-Host "Created .env from .env.example — add your OPENAI_API_KEY and Google credentials if needed."
}
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-Command",
  "Set-Location -LiteralPath '$root'; Write-Host 'AutoSpend backend (close this window to stop the server)'; python .\backend\server.py"
)
Start-Sleep -Seconds 2
Start-Process "http://127.0.0.1:8787/"
