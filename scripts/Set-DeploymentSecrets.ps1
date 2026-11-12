# Run interactively in PowerShell. No credentials belong in this file.
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repository = 'mohsinadeel/orderflow-demo'
$ghPath = (Get-Command gh -ErrorAction Stop).Source

function Set-GitHubSecret([string] $Name, [string] $Value) {
    $info = [System.Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $ghPath
    $info.Arguments = "secret set $Name --repo $repository"
    $info.UseShellExecute = $false
    $info.RedirectStandardInput = $true
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $info
    try {
        [void] $process.Start()
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
        try {
            $process.StandardInput.BaseStream.Write($bytes, 0, $bytes.Length)
            $process.StandardInput.BaseStream.Flush()
        } finally {
            [Array]::Clear($bytes, 0, $bytes.Length)
        }
        $process.StandardInput.Close()
        $process.WaitForExit()
        if ($process.ExitCode -ne 0) { throw "Could not set $Name." }
    } finally {
        $process.Dispose()
    }
}

$savedGithubToken = $env:GITHUB_TOKEN
$savedGhToken = $env:GH_TOKEN
try {
    Remove-Item Env:GITHUB_TOKEN, Env:GH_TOKEN -ErrorAction SilentlyContinue
    & $ghPath auth status --hostname github.com
    if ($LASTEXITCODE -ne 0) { throw 'Run gh auth login --hostname github.com --web first.' }
    & $ghPath repo view $repository --json nameWithOwner --jq .nameWithOwner
    if ($LASTEXITCODE -ne 0) { throw "Cannot access $repository." }

    Write-Host 'This configures the seven existing deployment credentials for OrderFlow.'
    Write-Host 'Values are sent through stdin and are not stored by this script.'
    if ((Read-Host 'Type SETUP to continue') -cne 'SETUP') { return }

    foreach ($secretName in @('OPENVPN_CONFIG', 'VPN_USERNAME', 'VPN_PASSWORD', 'SSH_PRIVATE_KEY', 'SSH_USERNAME', 'SSH_PORT', 'SSH_KNOWN_HOSTS')) {
        $value = $null
        $secureValue = $null
        $pointer = [IntPtr]::Zero
        try {
            if ($secretName -in @('OPENVPN_CONFIG', 'SSH_PRIVATE_KEY', 'SSH_KNOWN_HOSTS')) {
                $sourcePath = (Read-Host "Existing file path for $secretName (without surrounding quotes)").Trim()
                $value = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $sourcePath).ProviderPath)
            } else {
                $secureValue = Read-Host "Value for $secretName" -AsSecureString
                $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
                $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
            }
            if ([string]::IsNullOrWhiteSpace($value)) { throw "$secretName cannot be empty." }
            if ($secretName -eq 'SSH_PORT' -and ($value -notmatch '^\d{1,5}$' -or [int] $value -lt 1 -or [int] $value -gt 65535)) {
                throw 'SSH_PORT must be between 1 and 65535.'
            }
            Set-GitHubSecret $secretName $value
            Write-Host "Configured $secretName."
        } finally {
            if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
            if ($null -ne $secureValue) { $secureValue.Dispose() }
            $value = $null
        }
    }

    & $ghPath variable set SSH_HOST --repo $repository --body '37.27.136.233'
    if ($LASTEXITCODE -ne 0) { throw 'Could not set SSH_HOST.' }
    & $ghPath secret list --repo $repository
    & $ghPath variable list --repo $repository
    Write-Host 'OrderFlow deployment settings are configured. No workflow was dispatched.'
} finally {
    $env:GITHUB_TOKEN = $savedGithubToken
    $env:GH_TOKEN = $savedGhToken
}
