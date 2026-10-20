param(
  [string]$SiteUrl = 'https://resonance.xn--n8jl2g.xn--q9jyb4c',
  [string]$ApiUrl = 'https://resonance-api.meiteya.workers.dev'
)

$ErrorActionPreference = 'Stop'
$site = Invoke-WebRequest -UseBasicParsing "$SiteUrl/"
$health = Invoke-RestMethod "$ApiUrl/api/health"
$config = Invoke-RestMethod "$ApiUrl/api/config"

if ($site.StatusCode -ne 200 -or $health.ok -ne $true) { throw 'Production endpoint verification failed.' }

[pscustomobject]@{
  siteStatus = $site.StatusCode
  apiHealthy = $health.ok
  renderer = $health.renderer
  githubConfigured = $config.githubConfigured
  githubNextAction = $config.nextAction
  engineCommit = $config.engineCommit
  rendererVersion = $config.rendererVersion
} | ConvertTo-Json -Compress
