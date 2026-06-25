$ErrorActionPreference = 'Stop'

$officialDir = 'C:\Program Files\Autodesk\Revit 2027 MCP Server Read-Tools Technical Preview'
$officialExe = Join-Path $officialDir 'Autodesk.RevitMcpServer.Stdio.exe'
$legacyExpectedExe = 'C:\Program Files\Autodesk\Revit 2027 MCP Server Technical Preview\RevitMCPServer.exe'
$codexConfig = Join-Path (Get-Location) '.codex\config.toml'
$legacyBridgePort = 17827

function New-Check {
  param(
    [string]$Name,
    [bool]$Pass,
    [string]$Detail
  )

  [pscustomobject]@{
    Status = if ($Pass) { 'PASS' } else { 'FAIL' }
    Check = $Name
    Detail = $Detail
  }
}

$checks = @()

$officialExists = Test-Path -LiteralPath $officialExe
$checks += New-Check `
  -Name 'Autodesk Revit MCP STDIO executable' `
  -Pass $officialExists `
  -Detail $officialExe

$legacyExists = Test-Path -LiteralPath $legacyExpectedExe
$checks += New-Check `
  -Name 'Legacy documented RevitMCPServer.exe path' `
  -Pass (-not $legacyExists) `
  -Detail "Expected absent for Read-Tools package: $legacyExpectedExe"

$configExists = Test-Path -LiteralPath $codexConfig
$checks += New-Check `
  -Name 'Project-local Codex config' `
  -Pass $configExists `
  -Detail $codexConfig

if ($configExists) {
  $configText = Get-Content -LiteralPath $codexConfig -Raw
  $checks += New-Check `
    -Name 'Codex config points to verified Autodesk STDIO executable' `
    -Pass ($configText -like "*$($officialExe.Replace('\', '\\'))*") `
    -Detail 'Checks command path in .codex/config.toml'

  $checks += New-Check `
    -Name 'Codex MCP tool approval is prompt' `
    -Pass ($configText -match 'default_tools_approval_mode\s*=\s*"prompt"') `
    -Detail 'Requires Codex approval before MCP tool actions by default'

  $checks += New-Check `
    -Name 'Codex config does not forward OPENAI_API_KEY' `
    -Pass ($configText -notmatch 'OPENAI_API_KEY') `
    -Detail 'New testing path must not depend on OpenAI API key'

  $checks += New-Check `
    -Name 'Codex config does not reference legacy bridge port 17827' `
    -Pass ($configText -notmatch '17827') `
    -Detail 'New testing path must not depend on local HTTP bridge'
}

$revit = Get-Process Revit -ErrorAction SilentlyContinue
$checks += New-Check `
  -Name 'Revit process running' `
  -Pass ([bool]$revit) `
  -Detail ($(if ($revit) { ($revit | Select-Object -First 1 | ForEach-Object { "PID $($_.Id): $($_.Path)" }) } else { 'Revit.exe is not running' }))

$legacyBridge = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $legacyBridgePort -State Listen -ErrorAction SilentlyContinue
$checks += New-Check `
  -Name 'Legacy bridge not required' `
  -Pass $true `
  -Detail ($(if ($legacyBridge) { "Legacy bridge currently listening on 127.0.0.1:$legacyBridgePort, but .codex/config.toml does not depend on it." } else { "No process is listening on 127.0.0.1:$legacyBridgePort." }))

$checks | Format-Table -AutoSize

if ($checks.Status -contains 'FAIL') {
  exit 1
}
