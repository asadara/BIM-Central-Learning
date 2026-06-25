# Migration to Codex Revit MCP

Tanggal: 2026-06-22

## Tujuan

Menguji integrasi AI-Revit melalui Codex di VS Code dan Autodesk Revit Public MCP Server resmi, tanpa memakai OpenAI API key, billing API, bridge lokal, atau panel chat custom.

## Arsitektur Lama

Status: legacy / disabled for Codex MCP testing

```text
Revit Panel custom
  -> local bridge http://127.0.0.1:17827
      -> OPENAI_API_KEY
          -> OpenAI API
              -> Revit MCP Server
```

Arsitektur ini dipertahankan untuk rollback, tetapi tidak menjadi dependency untuk testing Codex MCP.

## Arsitektur Baru

```text
Codex di VS Code
  -> Autodesk Revit Public MCP Server resmi via STDIO
      -> Revit 2027 yang sedang aktif
```

Executable resmi yang diverifikasi:

```text
C:\Program Files\Autodesk\Revit 2027 MCP Server Read-Tools Technical Preview\Autodesk.RevitMcpServer.Stdio.exe
```

Versi terdeteksi:

```text
0.3.0-preview
```

## File yang Dipertahankan

```text
mcp-revit/
C:\Users\user\AppData\Roaming\Autodesk\Revit\Addins\2027\McpRevit.addin
C:\Users\user\AppData\Roaming\McpRevit\mcp-revit.json
```

File tersebut tidak dihapus karena menjadi jalur rollback ke arsitektur lama.

## File/Config yang Dinonaktifkan Sementara

Dinonaktifkan secara operasional untuk Codex MCP testing:

```text
mcp-revit/bridge/server.js
C:\Users\user\AppData\Roaming\McpRevit\mcp-revit.json
http://127.0.0.1:17827
OPENAI_API_KEY
```

Catatan:

- Tidak ada source code/config lama yang dihapus.
- `.codex/config.toml` tidak memakai `OPENAI_API_KEY`.
- `.codex/config.toml` tidak menunjuk ke local bridge port `17827`.
- `.codex/config.toml` hanya menunjuk ke executable STDIO resmi Autodesk.

## Config Codex MCP

Project-local config:

```text
.codex/config.toml
```

Isi:

```toml
approval_policy = "on-request"

[mcp_servers.revit]
command = "C:\\Program Files\\Autodesk\\Revit 2027 MCP Server Read-Tools Technical Preview\\Autodesk.RevitMcpServer.Stdio.exe"
cwd = "C:\\Program Files\\Autodesk\\Revit 2027 MCP Server Read-Tools Technical Preview"
enabled = true
required = true
startup_timeout_sec = 20
tool_timeout_sec = 60
default_tools_approval_mode = "prompt"
```

## Rollback ke Arsitektur Lama

1. Jalankan ulang bridge lama jika diperlukan:

   ```powershell
   $env:OPENAI_API_KEY="..."
   powershell -ExecutionPolicy Bypass -File .\mcp-revit\scripts\start-bridge.ps1
   ```

2. Buka Revit 2027.
3. Gunakan panel custom:

   ```text
   Add-Ins -> MCP Revit -> Open MCP
   ```

4. Config lama tetap tersedia di:

   ```text
   C:\Users\user\AppData\Roaming\McpRevit\mcp-revit.json
   ```

## Langkah Testing Codex

1. Pastikan Revit 2027 sedang berjalan dan model terbuka.
2. Jalankan:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\Test-RevitMcp.ps1
   ```

3. Restart Codex/VS Code jika konfigurasi MCP belum terbaca.
4. Di Codex, minta test read-only:

   ```text
   Gunakan MCP server revit. Deteksi instance Revit aktif, baca nama model aktif, lalu tampilkan ringkasan kategori/elemen tanpa mengubah model.
   ```

## Batasan Fase Pertama

Testing dibatasi pada operasi read-only dan navigasi ringan bila tool resmi mendukung:

- Mendeteksi instance Revit aktif.
- Membaca nama file model.
- Menghitung elemen berdasarkan kategori.
- Membaca data elemen.
- Memilih atau zoom ke elemen hanya bila tool resmi mendukung dan Codex meminta approval.

Tidak boleh membuat, menghapus, atau mengubah elemen model Revit pada fase ini.
