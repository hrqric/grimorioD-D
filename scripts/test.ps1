param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$RunnerArgs
)

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

if ($RunnerArgs.Count -gt 0) {
    & node --test @RunnerArgs
} else {
    npm test
}

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

