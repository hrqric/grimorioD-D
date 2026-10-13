$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
npm run check
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

