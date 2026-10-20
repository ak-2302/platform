param(
  [string]$OutputPath = (Join-Path (Get-Location) 'dist\resonance-pi-renderer.zip')
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$source = Join-Path $root 'pi-renderer'
$output = [System.IO.Path]::GetFullPath($OutputPath)
$outputDir = Split-Path -Parent $output
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
if (Test-Path -LiteralPath $output) { Remove-Item -LiteralPath $output -Force }

$files = @(
  (Join-Path $source 'server.mjs'),
  (Join-Path $source 'install.sh'),
  (Join-Path $source 'resonance-renderer.service.example'),
  (Join-Path $source 'cloudflared.service.example'),
  (Join-Path $source 'cloudflared-config.yml.example'),
  (Join-Path $source '.env.example'),
  (Join-Path $source 'README.md')
)
Compress-Archive -LiteralPath $files -DestinationPath $output -CompressionLevel Optimal
Write-Output "Created $output"
