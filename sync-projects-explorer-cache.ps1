param(
    [switch]$Clean
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$cacheRoot = Join-Path $root 'data\projects-explorer-cache'
$yearsUrl = 'http://127.0.0.1:5052/api/years'
$pcBim02SyncScript = Join-Path $root 'scripts\sync-pcbim02-cache.js'

function Sync-PcBim02Mirror([string]$sourcePath, [string]$destinationPath) {
    if (!(Test-Path -LiteralPath $sourcePath)) {
        Write-Warning "PC-BIM02 source path not reachable: $sourcePath"
        return
    }

    if (!(Test-Path -LiteralPath $pcBim02SyncScript)) {
        Write-Warning "PC-BIM02 sync script not found: $pcBim02SyncScript"
        return
    }

    New-Item -ItemType Directory -Force -Path $destinationPath | Out-Null

    Write-Output "Syncing PC-BIM02 mirror: $sourcePath -> $destinationPath"
    & node $pcBim02SyncScript "--src=$sourcePath" "--dst=$destinationPath"
    if ($LASTEXITCODE -ne 0) {
        throw "PC-BIM02 mirror sync failed for $sourcePath"
    }
}

if ($Clean -and (Test-Path $cacheRoot)) {
    Remove-Item -LiteralPath $cacheRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $cacheRoot | Out-Null

Sync-PcBim02Mirror '\\pc-bim02\PROJECT BIM 2025' (Join-Path $root 'data\pc-bim02-cache\PROJECT BIM 2025')
Sync-PcBim02Mirror '\\pc-bim02\PROJECT BIM 2026' (Join-Path $root 'data\pc-bim02-cache\PROJECT BIM 2026')

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
