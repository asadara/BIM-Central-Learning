$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$project = Join-Path $projectRoot 'src\McpRevit.Addin\McpRevit.Addin.csproj'
$workspaceDotnet = Join-Path (Split-Path -Parent $projectRoot) '.dotnet\dotnet.exe'
$dotnet = if (Test-Path -LiteralPath $workspaceDotnet) { $workspaceDotnet } else { 'dotnet' }

& $dotnet build $project -c Release -v:minimal
