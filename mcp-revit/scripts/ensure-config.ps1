$ErrorActionPreference = 'Stop'

$configDir = Join-Path $env:APPDATA 'McpRevit'
$configPath = Join-Path $configDir 'mcp-revit.json'

New-Item -ItemType Directory -Force -Path $configDir | Out-Null

if (-not (Test-Path -LiteralPath $configPath)) {
  $config = @'
{
  "mcpServers": {
    "revit": {
      "command": "C:\\Program Files\\Autodesk\\Revit 2027 MCP Server Technical Preview\\RevitMCPServer.exe"
    }
  },
  "openai": {
    "model": "gpt-5.5",
    "fallbackModel": "gpt-5"
  },
  "bridge": {
    "endpoint": "http://127.0.0.1:17827"
  }
}
'@
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($configPath, $config, $utf8NoBom)
}

[pscustomobject]@{
  ConfigPath = $configPath
  Exists = Test-Path -LiteralPath $configPath
} | ConvertTo-Json -Depth 3
