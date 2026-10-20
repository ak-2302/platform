param(
    [Parameter(Mandatory = $true)] [string]$PrivateKeyPath,
    [Parameter(Mandatory = $true)] [string]$AppId,
    [Parameter(Mandatory = $true)] [string]$InstallationId,
    [Parameter(Mandatory = $true)] [string]$WebhookSecret
)

$ErrorActionPreference = "Stop"
$platformRoot = Split-Path -Parent $PSScriptRoot
$wrangler = Join-Path $platformRoot "worker\node_modules\wrangler\bin\wrangler.js"
$config = Join-Path $platformRoot "worker\wrangler.toml"

if (-not (Test-Path -LiteralPath $PrivateKeyPath -PathType Leaf)) { throw "Private key file was not found: $PrivateKeyPath" }
if (-not (Test-Path -LiteralPath $wrangler -PathType Leaf)) { throw "Wrangler is not installed. Run npm install first." }

function Put-Secret([string]$Name, [string]$Value) {
    $Value | node $wrangler secret put $Name --name resonance-api --config $config | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Failed to upload $Name" }
}

$privateKey = Get-Content -LiteralPath $PrivateKeyPath -Raw
Put-Secret "GITHUB_APP_ID" $AppId
Put-Secret "GITHUB_INSTALLATION_ID" $InstallationId
Put-Secret "GITHUB_APP_PRIVATE_KEY" $privateKey
Put-Secret "GITHUB_WEBHOOK_SECRET" $WebhookSecret
Write-Host "GitHub App secrets uploaded. Secret values were not printed or saved."
