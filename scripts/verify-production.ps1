param(
  [string]$SiteUrl = 'https://resonance.xn--n8jl2g.xn--q9jyb4c',
  [string]$ApiUrl = 'https://resonance-api.meiteya.workers.dev'
)

$ErrorActionPreference = 'Stop'
$site = Invoke-WebRequest -UseBasicParsing "$SiteUrl/"
$healthResponse = Invoke-WebRequest -UseBasicParsing "$ApiUrl/api/health"
$health = $healthResponse.Content | ConvertFrom-Json
$config = Invoke-RestMethod "$ApiUrl/api/config"

if ($site.StatusCode -ne 200 -or $healthResponse.StatusCode -ne 200 -or $health.ok -ne $true) { throw 'Production endpoint verification failed.' }
if ($healthResponse.Headers['Cache-Control'] -notmatch 'max-age=30') { throw 'Health endpoint cache policy is missing.' }

[pscustomobject]@{
  siteStatus = $site.StatusCode
  apiHealthy = $health.ok
  healthCacheControl = $healthResponse.Headers['Cache-Control']
  renderer = $health.renderer
  githubConfigured = $config.githubConfigured
  githubNextAction = $config.nextAction
  engineCommit = $config.engineCommit
  rendererVersion = $config.rendererVersion
} | ConvertTo-Json -Compress
