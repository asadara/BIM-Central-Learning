param(
    [switch]$Clean
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$cacheRoot = Join-Path $root 'data\projects-explorer-cache'
$yearsUrl = 'http://127.0.0.1:5052/api/years'

if ($Clean -and (Test-Path $cacheRoot)) {
    Remove-Item -LiteralPath $cacheRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $cacheRoot | Out-Null

$yearsResponse = Invoke-WebRequest -UseBasicParsing $yearsUrl -TimeoutSec 180
$yearsJson = $yearsResponse.Content
$yearsFile = Join-Path $cacheRoot 'years.json'
Set-Content -LiteralPath $yearsFile -Value $yearsJson

$yearsData = $yearsJson | ConvertFrom-Json
foreach ($year in @($yearsData.years)) {
    $projectsUrl = "http://127.0.0.1:5052/api/projects/$year"
    $projectsResponse = Invoke-WebRequest -UseBasicParsing $projectsUrl -TimeoutSec 300
    $projectsFile = Join-Path $cacheRoot ("projects-{0}.json" -f $year)
    Set-Content -LiteralPath $projectsFile -Value $projectsResponse.Content
}

powershell -ExecutionPolicy Bypass -File (Join-Path $root 'sync-project-media-cache.ps1')

Write-Output 'Projects explorer cache refreshed.'
