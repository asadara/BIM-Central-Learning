# MCP Revit

Fallback Revit 2027 add-in and configuration helper for connecting Revit MCP workflows to GPT models.

Primary target:

```text
Revit 2027 -> Autodesk Revit Public MCP Server -> MCP-compatible GPT bridge -> OpenAI gpt-5.5 / gpt-5
```

Fallback target:

```text
Revit 2027 -> MCP Revit add-in -> Dockable panel -> local GPT/MCP bridge
```

## Current Status

- Revit 2027 is installed.
- Autodesk Assistant is installed.
- Autodesk Revit Public MCP Server executable is not currently detected at the documented default path:
  `C:\Program Files\Autodesk\Revit 2027 MCP Server Technical Preview\RevitMCPServer.exe`

## Build

```powershell
..\.dotnet\dotnet.exe build .\src\McpRevit.Addin\McpRevit.Addin.csproj -c Release
```

The project targets `net10.0-windows` because Revit 2027 runs on .NET 10. A local SDK can be installed at `C:\BCL\.dotnet`; the installer script uses that SDK automatically when present.

## Install

```powershell
.\scripts\install-addin.ps1
```

This installs the add-in manifest to:

`%APPDATA%\Autodesk\Revit\Addins\2027\McpRevit.addin`

and copies the built add-in to:

`%APPDATA%\McpRevit\addin`
