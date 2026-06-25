$ErrorActionPreference = 'Stop'

$defaultPath = 'C:\Program Files\Autodesk\Revit 2027 MCP Server Technical Preview\RevitMCPServer.exe'
$revitPath = 'C:\Program Files\Autodesk\Revit 2027\Revit.exe'
$assistantPath = 'C:\Program Files\Autodesk\Revit 2027\AddIns\Assistant\Autodesk.Assistant.Application.addin'

[pscustomobject]@{
  Revit2027 = Test-Path -LiteralPath $revitPath
  AutodeskAssistant = Test-Path -LiteralPath $assistantPath
  RevitPublicMcpServer = Test-Path -LiteralPath $defaultPath
  RevitPublicMcpServerPath = $defaultPath
  UserAddinsPath = Join-Path $env:APPDATA 'Autodesk\Revit\Addins\2027'
  McpRevitConfigPath = Join-Path $env:APPDATA 'McpRevit\mcp-revit.json'
} | ConvertTo-Json -Depth 4
