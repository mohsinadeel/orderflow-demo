[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $Confirmation
)

$requiredConfirmation = 'RESET-ORDERFLOW-LOCAL-DATA'
if ($Confirmation -cne $requiredConfirmation) {
    throw "Reset refused. Pass -Confirmation '$requiredConfirmation' exactly."
}

$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repository

Write-Host 'Removing OrderFlow containers and both project-owned database volumes.'
docker compose --profile experiment down --volumes
if ($LASTEXITCODE -ne 0) {
    throw "Compose reset failed with exit code $LASTEXITCODE."
}

Write-Host 'Rebuilding the default stack with the fresh seeded catalogue.'
docker compose up -d --build --wait
if ($LASTEXITCODE -ne 0) {
    throw "Compose startup failed with exit code $LASTEXITCODE."
}

Write-Host 'OrderFlow local data was reset. The optional inventory experiment remains stopped.'
