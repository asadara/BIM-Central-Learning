# MCP Revit Blueprint

Tanggal: 2026-06-22

## Goal

Menambahkan panel MCP pada Revit 2027 dengan konteks Autodesk Assistant/Assistance, lalu menghubungkan panel tersebut ke model AI sesuai plan user.

## Target

Target utama adalah membuat AI berbasis GPT masuk ke workflow MCP Revit dengan jalur resmi sebanyak mungkin.

Urutan target:

1. Gunakan Autodesk Revit Public MCP Server resmi jika add-on tersedia.
2. Hubungkan client AI yang mendukung MCP ke server Revit tersebut.
3. Gunakan model minimal GPT-5, dengan default teknis saat ini `gpt-5.5` bila tersedia di API/account.
4. Jika Autodesk Assistant tidak membuka konfigurasi model pihak ketiga di panel bawaannya, buat panel Revit terpisah sebagai fallback yang tetap memakai MCP server resmi.

Alur target primary:

```text
Revit 2027
  -> Autodesk Revit Public MCP Server
      -> MCP-compatible AI client / local GPT bridge
          -> OpenAI API model gpt-5.5 or gpt-5
              -> query model
              -> select/zoom/open/export views
              -> future write tools when Autodesk exposes them
```

Alur target fallback:

```text
Revit 2027
  -> MCP Revit Add-in (.addin + .dll)
      -> Ribbon Panel "MCP Revit" / Dockable Pane "MCP Assistant"
          -> Local MCP Bridge Service
              -> AI Model Provider
              -> Revit Tools Layer
                  -> read model context
                  -> selected elements
                  -> create/update views
                  -> schedules
                  -> parameters
                  -> sheets
                  -> warnings/QC
```

## Referensi Valid

- Autodesk Assistant in Revit 2027 Tech Preview:
  https://help.autodesk.com/view/RVT/2027/ENU/?guid=GUID-620ECD98-53F7-47F1-B700-EEE84F15EBF7
- Autodesk Assistant Tech Preview, What's New in Revit 2027:
  https://help.autodesk.com/view/RVT/2027/ENU/?guid=GUID-68D8FE6D-C5B0-4503-AE27-02C715BAC25B
- Autodesk Revit API Add-In Integration:
  https://help.autodesk.com/cloudhelp/2017/PTB/Revit-API/files/GUID-4BE74935-A15C-4536-BD9C-7778766CE392.htm
- Revit API `CreateRibbonPanel`:
  https://www.revitapidocs.com/2026/5c22d48b-59b3-2599-7c7a-83257cddf0df.htm
- Revit API `RegisterDockablePane`:
  https://www.revitapidocs.com/2025/3c913e04-4444-319e-04bb-61a4784b5d4d.htm
- Autodesk Revit Public MCP Server announcement:
  https://www.autodesk.com/blogs/aec/2026/06/17/revit-public-mcp-server/
- OpenAI latest model guidance:
  https://developers.openai.com/api/docs/guides/latest-model

## Temuan Lokal

- Revit 2027 install path:
  `C:\Program Files\Autodesk\Revit 2027\`
- Revit API tersedia:
  `RevitAPI.dll`, `RevitAPIUI.dll`
- Autodesk Assistant bawaan:
  `C:\Program Files\Autodesk\Revit 2027\AddIns\Assistant\`
- Folder Assistant berisi library MCP:
  `ModelContextProtocol.dll`
  `ModelContextProtocol.Core.dll`
  `ModelContextProtocol.AspNetCore.dll`
- Manifest Assistant bawaan:
  `Autodesk.Assistant.Application.addin`
- Folder user add-in yang aman:
  `C:\Users\user\AppData\Roaming\Autodesk\Revit\Addins\2027\`
- Folder default Autodesk Revit Public MCP Server belum ditemukan pada pengecekan lokal:
  `C:\Program Files\Autodesk\Revit 2027 MCP Server Technical Preview\`
- Executable default belum ditemukan pada pengecekan lokal:
  `RevitMCPServer.exe`

## Klarifikasi Jalur MCP Resmi

Autodesk mengumumkan Revit Public MCP Server sebagai add-on terpisah untuk Revit 2027. Contoh konfigurasi resminya menggunakan command:

```json
{
  "mcpServers": {
    "revit": {
      "command": "C:\\Program Files\\Autodesk\\Revit 2027 MCP Server Technical Preview\\RevitMCPServer.exe"
    }
  }
}
```

Server tersebut berkomunikasi melalui `stdio`, sehingga dapat digunakan oleh client yang mendukung MCP.

Status lokal saat blueprint ini ditulis:

- Revit 2027 terpasang.
- Autodesk Assistant bawaan terpasang.
- Revit Public MCP Server add-on belum terdeteksi di lokasi default.
- Langkah wajib berikutnya adalah mendapatkan/install add-on tersebut dari Autodesk Account entitlement Revit 2027.

## Batasan Teknis

- Tidak patch file Autodesk Assistant bawaan.
- Tidak inject ke DLL Autodesk Assistant.
- Tidak reverse-engineer private API sebagai jalur utama.
- Integrasi dilakukan lewat Revit API resmi.
- Jika Autodesk membuka extension point resmi untuk Assistant, adapter dapat ditambahkan sebagai fase opsional.
- Jika targetnya adalah panel Autodesk Assistant bawaan, batasannya tergantung kemampuan konfigurasi resmi Autodesk Assistant. Jika tidak ada konfigurasi model pihak ketiga, integrasi GPT dilakukan via MCP client/bridge atau panel fallback.

## Arsitektur

### 1. Revit Add-in

Komponen:

- `.addin` manifest.
- Assembly `.dll`.
- `IExternalApplication` untuk startup/shutdown.
- Ribbon panel `MCP Revit`.
- Button `Open MCP Panel`.
- Dockable pane untuk UI chat/control.

### 2. MCP Panel

Fungsi awal:

- Menampilkan status koneksi bridge.
- Input prompt.
- Output respons AI.
- Tombol read context dari Revit.
- Tombol approve/reject untuk aksi yang mengubah model.

### 3. MCP Bridge Service

Service lokal yang menjadi pemisah antara Revit dan provider AI.

Tanggung jawab:

- Health check.
- Routing prompt ke AI model.
- Menyediakan MCP tools untuk Revit.
- Logging request/response.
- Timeout dan error handling.

### 4. Revit Tools Layer

Tool read-only awal:

- Get active document info.
- Get active view info.
- Get selected elements.
- List categories.
- List sheets/views.
- Get warnings/QC summary.

Tool write tahap lanjutan:

- Set parameter.
- Rename view/sheet.
- Create view/sheet.
- Create schedule.
- Place family/type.

Semua tool write wajib:

- Memakai preview.
- Meminta approval user.
- Menggunakan Revit `Transaction`.
- Menyediakan rollback/error result yang jelas.

## Tahapan Implementasi

### Phase 0 - Baseline

Status: pending

Output:

- Struktur project final.
- Target framework final.
- Daftar dependency.
- Keputusan lokasi install.
- Verifikasi entitlement dan installer Revit Public MCP Server.
- Verifikasi apakah `RevitMCPServer.exe` tersedia.

Acceptance criteria:

- Path Revit MCP Server resmi diketahui.
- MCP server bisa dijalankan dari terminal.
- MCP client test dapat melakukan handshake/list tools.

### Phase 0A - Official MCP Server Setup

Status: pending

Output:

- Revit Public MCP Server terpasang.
- Path executable dicatat.
- Config MCP client dibuat untuk server `revit`.

Acceptance criteria:

- `RevitMCPServer.exe` ditemukan.
- MCP server dapat start lewat stdio.
- Tool `get running Revit instances` atau tool sejenis tersedia.

### Phase 0B - GPT MCP Client/Bridge

Status: pending

Output:

- Local bridge/client yang memakai OpenAI model `gpt-5.5` atau `gpt-5`.
- Bridge membaca config MCP server Revit.
- Bridge dapat memanggil tools MCP Revit.

Acceptance criteria:

- Prompt ke GPT dapat memanggil tool MCP Revit.
- Revit instance aktif dapat dikenali.
- Respons model menyertakan hasil tool Revit.

### Phase 1 - Skeleton Add-in

Status: fallback pending

Output:

- Project `McpRevitAddin`.
- Implementasi `IExternalApplication`.
- Manifest `.addin`.
- Ribbon panel `MCP Revit`.
- Button `Open MCP Panel`.

Acceptance criteria:

- Revit startup tanpa add-in error.
- Panel muncul di tab Add-Ins atau tab custom.
- Log tidak menunjukkan exception.

### Phase 2 - Dockable MCP Panel

Status: fallback pending

Output:

- Dockable pane terdaftar.
- UI awal untuk chat/status.
- Button dari ribbon membuka pane.

Acceptance criteria:

- Pane bisa dibuka/tutup.
- UI Revit tidak freeze.
- Status koneksi terlihat.

### Phase 3 - MCP Bridge

Status: pending

Output:

- Service lokal MCP bridge.
- Endpoint health check.
- Endpoint prompt.
- Koneksi dari add-in ke bridge.

Acceptance criteria:

- Add-in dapat melakukan health check.
- Prompt sederhana mendapat respons.
- Error/timeout ditampilkan di panel.

### Phase 4 - Read-only Revit Tools

Status: pending

Output:

- Tool baca document context.
- Tool baca active view.
- Tool baca selected elements.
- Tool baca sheets/views.

Acceptance criteria:

- AI menerima konteks model aktif.
- Tidak ada transaksi model untuk operasi read-only.
- Data sensitif tidak dikirim tanpa kontrol konfigurasi.

### Phase 5 - Write Tools Dengan Approval

Status: pending

Output:

- Tool write pertama, misalnya rename view atau set parameter.
- Preview action.
- Approval user.
- Transaction wrapper.

Acceptance criteria:

- Tidak ada perubahan model tanpa approval eksplisit.
- Transaction commit/rollback tercatat.
- Result ditampilkan di panel.

### Phase 6 - Packaging

Status: pending

Output:

- Script install.
- Script uninstall.
- Build release.
- Dokumentasi runbook.

Acceptance criteria:

- Add-in bisa dipasang ulang.
- Add-in bisa dilepas bersih.
- Tidak menyentuh file vendor Autodesk.

## Monitoring Progress

Checklist:

```text
[ ] P0 - Baseline API selesai
[ ] P0A - Revit Public MCP Server add-on terpasang
[ ] P0B - MCP server executable ditemukan
[ ] P0C - MCP handshake/list tools berhasil
[ ] P1 - GPT-5.5/GPT-5 bridge terkoneksi ke MCP Revit
[ ] P2 - Revit running instance terbaca dari AI client
[ ] P3 - Query model read-only berhasil
[ ] P4 - Select/zoom/open/export tools berhasil
[ ] P5 - Panel fallback dibuat jika Assistant bawaan tidak bisa memakai model eksternal
[ ] P6 - Write tools dengan approval bila Autodesk write server tersedia
[ ] P7 - Packaging install/uninstall fallback add-in
```

Log yang disarankan:

- `logs/mcp-revit-addin.log`
- `logs/mcp-revit-bridge.log`

## Rencana Eksekusi Awal

1. Install/aktifkan Autodesk Revit Public MCP Server dari Autodesk Account jika belum tersedia.
2. Verifikasi executable:
   `C:\Program Files\Autodesk\Revit 2027 MCP Server Technical Preview\RevitMCPServer.exe`
3. Buat konfigurasi MCP untuk server `revit`.
4. Buat local GPT bridge/client dengan model default `gpt-5.5`, fallback `gpt-5`.
5. Test handshake MCP dan list tools.
6. Test dengan Revit aktif dan model terbuka.
7. Jika panel Autodesk Assistant tidak dapat diarahkan ke model GPT, buat fallback add-in:
   - Buat folder proyek add-in di `C:\BCL\mcp-revit\`.
   - Scaffold project C# Revit add-in.
   - Reference:
   - `C:\Program Files\Autodesk\Revit 2027\RevitAPI.dll`
   - `C:\Program Files\Autodesk\Revit 2027\RevitAPIUI.dll`
   - Buat manifest:
     `C:\Users\user\AppData\Roaming\Autodesk\Revit\Addins\2027\McpRevit.addin`
   - Build dan test load di Revit.

## Status

Blueprint direvisi untuk jalur Revit Public MCP Server resmi. Implementasi fase awal sudah berjalan:

- Add-in fallback `MCP Revit` dibuat dan terpasang.
- Dockable panel dibuat.
- GPT bridge skeleton dibuat.
- Config MCP/GPT dibuat.
- Revit Public MCP Server resmi belum terdeteksi dan masih menjadi blocker untuk query model MCP resmi.

Progress detail:

`docs/MCP_REVIT_PROGRESS.md`
