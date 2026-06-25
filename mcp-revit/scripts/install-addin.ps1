$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$project = Join-Path $projectRoot 'src\McpRevit.Addin\McpRevit.Addin.csproj'
$buildConfig = if ($env:MCP_REVIT_BUILD_CONFIG) { $env:MCP_REVIT_BUILD_CONFIG } else { 'Release' }
$targetFramework = 'net10.0-windows'
$buildOutput = Join-Path $projectRoot "src\McpRevit.Addin\bin\$buildConfig\$targetFramework"
$installDir = Join-Path $env:APPDATA 'McpRevit\addin'
$addinDir = Join-Path $env:APPDATA 'Autodesk\Revit\Addins\2027'
$addinPath = Join-Path $addinDir 'McpRevit.addin'
$workspaceDotnet = Join-Path (Split-Path -Parent $projectRoot) '.dotnet\dotnet.exe'
$dotnet = if (Test-Path -LiteralPath $workspaceDotnet) { $workspaceDotnet } else { 'dotnet' }

& $dotnet build $project -c $buildConfig -v:minimal

New-Item -ItemType Directory -Force -Path $installDir | Out-Null
New-Item -ItemType Directory -Force -Path $addinDir | Out-Null

Copy-Item -LiteralPath (Join-Path $buildOutput 'McpRevit.Addin.dll') -Destination $installDir -Force
Copy-Item -LiteralPath (Join-Path $buildOutput 'McpRevit.Addin.deps.json') -Destination $installDir -Force -ErrorAction SilentlyContinue
Copy-Item -LiteralPath (Join-Path $buildOutput 'McpRevit.Addin.pdb') -Destination $installDir -Force -ErrorAction SilentlyContinue

$assemblyPath = Join-Path $installDir 'McpRevit.Addin.dll'
$manifest = @"
<?xml version="1.0" encoding="utf-8"?>
<RevitAddIns>
  <AddIn Type="Application">
    <Name>MCP Revit</Name>
    <Assembly>$assemblyPath</Assembly>
    <ClientId>3E6169D8-27D7-4F2D-A56B-5EE3BB09C8B8</ClientId>
    <FullClassName>McpRevit.Addin.App</FullClassName>
    <VendorId>BCL</VendorId>
    <VendorDescription>MCP Revit GPT bridge panel</VendorDescription>
  </AddIn>
</RevitAddIns>
"@

Set-Content -LiteralPath $addinPath -Value $manifest -Encoding UTF8

[pscustomobject]@{
  Installed = $true
  Assembly = $assemblyPath
  Manifest = $addinPath
} | ConvertTo-Json -Depth 3
