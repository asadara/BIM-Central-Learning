$ErrorActionPreference = 'Stop'

$addinPath = Join-Path $env:APPDATA 'Autodesk\Revit\Addins\2027\McpRevit.addin'
$installDir = Join-Path $env:APPDATA 'McpRevit\addin'

if (Test-Path -LiteralPath $addinPath) {
  Remove-Item -LiteralPath $addinPath -Force
}

if (Test-Path -LiteralPath $installDir) {
  Remove-Item -LiteralPath $installDir -Recurse -Force
}

[pscustomobject]@{
  RemovedManifest = $addinPath
  RemovedInstallDir = $installDir
} | ConvertTo-Json -Depth 3
