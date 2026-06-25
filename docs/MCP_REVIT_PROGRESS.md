# MCP Revit Progress

Tanggal: 2026-06-22

## Status Implementasi

```text
[x] P0 - Baseline API selesai
[ ] P0A - Revit Public MCP Server add-on terpasang
[ ] P0B - MCP server executable ditemukan
[ ] P0C - MCP handshake/list tools berhasil
[x] P1 - GPT bridge skeleton tersedia
[ ] P2 - Revit running instance terbaca dari AI client
[ ] P3 - Query model read-only berhasil
[ ] P4 - Select/zoom/open/export tools berhasil
[x] P5 - Panel fallback dibuat
[ ] P6 - Write tools dengan approval bila Autodesk write server tersedia
[x] P7 - Packaging install/uninstall fallback add-in
```

## Yang Sudah Dibuat

- Project add-in:
  `mcp-revit/src/McpRevit.Addin`
- Target framework:
  `net10.0-windows`
- Local .NET SDK:
  `C:\BCL\.dotnet\dotnet.exe`
- Revit manifest:
  `C:\Users\user\AppData\Roaming\Autodesk\Revit\Addins\2027\McpRevit.addin`
- Installed add-in DLL:
  `C:\Users\user\AppData\Roaming\McpRevit\addin\McpRevit.Addin.dll`
- MCP/GPT config:
  `C:\Users\user\AppData\Roaming\McpRevit\mcp-revit.json`
- Bridge:
  `mcp-revit/bridge/server.js`

## Verifikasi

- Build add-in: berhasil.
- Build output: 0 warning, 0 error.
- Bridge syntax check: berhasil.
- Bridge `/health`: berhasil.
- Autodesk Assistant bawaan: terdeteksi.
- Revit Public MCP Server add-on: belum terdeteksi.

## Kondisi Saat Ini

`RevitMCPServer.exe` belum ditemukan di path resmi:

```text
C:\Program Files\Autodesk\Revit 2027 MCP Server Technical Preview\RevitMCPServer.exe
```

Bridge health terakhir:

```json
{
  "ok": true,
  "service": "mcp-revit-bridge",
  "openai": {
    "apiKeyPresent": false,
    "model": "gpt-5.5",
    "fallbackModel": "gpt-5"
  },
  "revitMcpServer": {
    "exists": false
  }
}
```

## Cara Menjalankan

Build:

```powershell
powershell -ExecutionPolicy Bypass -File .\mcp-revit\scripts\build-addin.ps1
```

Install add-in:

```powershell
powershell -ExecutionPolicy Bypass -File .\mcp-revit\scripts\install-addin.ps1
```

Start bridge:

```powershell
powershell -ExecutionPolicy Bypass -File .\mcp-revit\scripts\start-bridge.ps1
```

Detect environment:

```powershell
powershell -ExecutionPolicy Bypass -File .\mcp-revit\scripts\detect-revit-mcp.ps1
```

## Next Blocker

Install Autodesk Revit Public MCP Server add-on dari Autodesk Account entitlement Revit 2027. Setelah `RevitMCPServer.exe` tersedia, tahap berikutnya adalah implementasi MCP tool handshake/list tools dan mapping hasil tool ke GPT bridge.
