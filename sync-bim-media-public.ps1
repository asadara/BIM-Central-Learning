param(
    [switch]$Clean
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$tagsFile = Join-Path $root 'backend\bim-media-tags.json'
$publishRoot = Join-Path $root 'data\bim-media-public\pc-bim02'

if (!(Test-Path $tagsFile)) {
    throw "Tags file not found: $tagsFile"
}

if ($Clean -and (Test-Path $publishRoot)) {
    Remove-Item -LiteralPath $publishRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $publishRoot | Out-Null

$json = Get-Content $tagsFile -Raw | ConvertFrom-Json
$copied = 0
$skipped = 0

foreach ($entry in $json.media.PSObject.Properties) {
    $sourcePath = [string]$entry.Name
    if ($sourcePath -notlike '\\pc-bim02\*') {
        $skipped++
        continue
    }

    if (!(Test-Path -LiteralPath $sourcePath)) {
        Write-Warning "Missing source file: $sourcePath"
        $skipped++
        continue
    }

    $relativePath = $sourcePath -replace '^\\\\pc-bim02\\', ''
    $destinationPath = Join-Path $publishRoot $relativePath
    $destinationDir = Split-Path -Parent $destinationPath

    New-Item -ItemType Directory -Force -Path $destinationDir | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
    $copied++
}

Write-Output "Published cache updated. Copied: $copied, skipped: $skipped"
