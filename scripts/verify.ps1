[CmdletBinding()]
param(
    [switch] $Install,
    [switch] $IncludeBrowser,
    [switch] $IncludeExperiment
)

$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repository

function Invoke-Checked {
    param(
        [Parameter(Mandatory)] [string] $Label,
        [Parameter(Mandatory)] [scriptblock] $Command
    )

    Write-Host "`n==> $Label"
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed with exit code $LASTEXITCODE."
    }
}

$packages = @(
    'apps/api-express',
    'apps/api-nest',
    'apps/web-next'
)

if ($IncludeExperiment) {
    $packages += 'apps/inventory-service'
}

if ($Install) {
    foreach ($package in $packages) {
        Invoke-Checked "Install dependencies: $package" { npm --prefix $package ci }
    }
}

Invoke-Checked 'Build and start the default Compose stack' {
    docker compose up -d --build --wait
}
Invoke-Checked 'Build the Express API' {
    npm --prefix apps/api-express run build
}
Invoke-Checked 'Run the Express behavioural suite' {
    npm --prefix apps/api-express test
}
Invoke-Checked 'Build the NestJS API' {
    npm --prefix apps/api-nest run build
}
Invoke-Checked 'Run the NestJS REST, GraphQL and explorer suite' {
    npm --prefix apps/api-nest test
}

if ($IncludeBrowser) {
    Invoke-Checked 'Run the Brave operator workflow' {
        npm --prefix apps/web-next run test:ui
    }
}

if ($IncludeExperiment) {
    Invoke-Checked 'Build and start the isolated inventory experiment' {
        docker compose --profile experiment up -d --build --wait inventory-service
    }
    Invoke-Checked 'Build the inventory service' {
        npm --prefix apps/inventory-service run build
    }
    Invoke-Checked 'Run the inventory-service behavioural suite' {
        npm --prefix apps/inventory-service test
    }
}

Write-Host "`nVerification completed successfully."
