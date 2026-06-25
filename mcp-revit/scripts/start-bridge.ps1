$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$bridgeDir = Join-Path $projectRoot 'bridge'

Push-Location $bridgeDir
try {
  node server.js
}
finally {
  Pop-Location
}
