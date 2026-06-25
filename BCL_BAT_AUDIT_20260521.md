# BCL BAT Script Audit - 2026-05-21

Tujuan: memastikan script `.bat` yang benar-benar dipakai BCL tidak tertukar dengan script lama, helper, atau retired.

## Status Runtime Saat Audit

- Backend utama hidup di `0.0.0.0:5052` dengan `backend\server.js`.
- Nginx reverse proxy hidup di port `80` dan `443`.
- Port `5051` hidup sebagai compatibility proxy ke `5052`, bukan backend utama.
- PostgreSQL native service `postgresql-x64-15` hidup di port `5432`.
- Domain `bcl.nke.net` resolve ke `10.0.0.90`.

## Entry Point Yang Benar

| Script | Status | Catatan |
|---|---|---|
| `start-bcl-http.bat` | Runtime utama | Script paling lengkap: validasi PostgreSQL, backend `5052`, legacy proxy `5051`, nginx `80/443`, runlock, hidden/manual mode. |
| `start-bcl-fixed.bat` | Wrapper valid | Entry lama yang sekarang hanya delegate ke `start-bcl-http.bat`. Aman dipakai manual. |
| `start-bcl-http-hidden.bat` | Wrapper autostart | Delegate ke `start-bcl-http.bat --hidden --boot --no-error-console`. |
| `start-bcl-http-logon-fallback.bat` | Fallback logon | Dipakai oleh scheduled task yang saat audit masih terpasang: `BCL Auto Start (Logon Hidden Fallback)`. |
| `watchdog-bcl.bat` | Healthcheck/recovery | Cek HTTP, backend `5052`, DB, UNC PC-BIM02; dapat recycle backend dari konteks user bila UNC stale. |
| `start-backend-public.bat` | Backend-only recovery | Menyalakan backend `5052` dan memastikan proxy `5051`; dipanggil watchdog untuk recovery ringan. |
| `start-legacy-5051-proxy.bat` | Compatibility only | Menjalankan `backend\legacy-port-proxy.js` di port `5051` menuju `5052`. |
| `stop-bcl-http.bat` | Stop script | Stop nginx, backend `5052`, proxy `5051`, PostgreSQL, dan runlock. |
| `test-bcl-connection.bat` | Diagnostic | Cek konektivitas. Ada bug kosmetik pada summary, tetapi check endpoint tetap berguna. |

## Script Scheduler / Install

| Script | Status | Catatan |
|---|---|---|
| `install-bcl-hybrid-runtime.bat` | Installer utama | Wrapper Administrator untuk memasang autostart core, logon readiness, watchdog core, dan watchdog user PC-BIM02. |
| `install-bcl-autostart-task.bat` | Installer task | Membuat task `BCL Auto Start (Startup Hidden)` sebagai `SYSTEM` untuk core BCL dan task `BCL Auto Start (Logon Hidden Fallback)` sebagai user untuk readiness PC-BIM02. |
| `install-bcl-watchdog-task.bat` | Installer watchdog | Membuat watchdog core `SYSTEM` dan watchdog user-context `BCL PC-BIM02 Watchdog (User 5m)`. |
| `install-bcl-shutdown-task.bat` | Optional | Membuat shutdown task untuk stop BCL. |
| `uninstall-bcl-autostart-task.bat` | Optional | Menghapus autostart task lama/baru. |
| `uninstall-bcl-watchdog-task.bat` | Optional | Menghapus watchdog task. |
| `uninstall-bcl-shutdown-task.bat` | Optional | Menghapus shutdown task. |

## Maintenance / Setup, Bukan Launcher Harian

| Script | Status | Catatan |
|---|---|---|
| `configure-firewall.bat` | Setup | Membuka firewall `80`, `443`, `5052`. |
| `nginx-setup.bat` | Setup | Download/extract nginx. |
| `install-native-postgres-service.bat` | Setup/migrasi | Restore native PostgreSQL lalu install autostart/watchdog. |
| `install-bcl-lan-rootca.bat` | Setup sertifikat | Delegate ke `BC-Learning-Main\cert.bat`. |
| `create-admin-shortcut.bat` | Shortcut | Membuat shortcut ke `start-bcl-fixed.bat`. |
| `create-shortcut-simple.bat` | Shortcut | Membuat shortcut ke `start-bcl-fixed.bat`. |
| `create_dirs.bat` | Setup folder | Membuat folder dasar lama. |
| `backend\generate-ssl.bat` | Sertifikat lama | Generate SSL dev cert. |
| `backend\trust-certificate.bat` | Sertifikat lama | Trust cert untuk `5052`. |
| `backend\convert-videos-batch.bat` | Utility media | Batch converter video, bukan runtime. |
| `BC-Learning-Main\cert.bat` | Sertifikat client | Install/download LAN root CA untuk browser client. |
| `BC-Learning-Main\bcl-install-cert.bat` | Wrapper cert | Delegate ke `cert.bat`. |
| `BC-Learning-Main\elearning-assets\scripts\run-mapping.bat` | Utility konten | Jalankan image mapping tool. |

## Jangan Dipakai Sebagai Runtime BCL Sekarang

| Script | Alasan |
|---|---|
| `run-server.bat` | Terlalu sederhana: `cd backend && node server.js`; tidak set port `5052`, tidak start nginx, PostgreSQL, atau proxy `5051`. |
| `_retired\2026-03-app-cleanup\backend\start-http.bat` | Sudah di `_retired`; backend-only lama. |
| `_retired\2026-03-app-cleanup\backend\start-backend-autorestart.bat` | Sudah di `_retired`; autorestart lama. |
| `_retired\2026-03-root-cleanup\operator-legacy\BCL_Launcher.bat` | Operator launcher lama, sudah retired. |
| `_retired\2026-03-root-cleanup\operator-legacy\start-backend-only.bat` | Backend-only lama, sudah retired. |
| `_retired\2026-03-root-cleanup\operator-legacy\add-bcl-hosts.bat` | Hosts helper lama. |
| `_retired\2026-03-root-cleanup\operator-legacy\clear-browser-cache.bat` | Browser cache helper lama. |
| `_retired\2026-03-root-cleanup\phase4\start-phase4-enterprise.bat` | Phase 4 startup lama, sudah retired. |
| `_retired\2026-03-root-cleanup\docker-legacy\setup-postgres.bat` | Docker PostgreSQL lama, bukan native runtime sekarang. |

## Temuan 2026-05-21

- Pada pukul sekitar `08:46`, BCL sudah merespons `200`, tetapi uptime backend baru beberapa menit. Ini menunjukkan server sempat belum siap lalu baru hidup lewat autostart/logon.
- Scheduled task aktif untuk autostart masih `BCL Auto Start (Logon Hidden Fallback)` dan menjalankan `start-bcl-http-logon-fallback.bat`.
- Sebelum patch, script installer terbaru `install-bcl-autostart-task.bat` hanya membuat startup `SYSTEM` dan menghapus logon fallback. Setelah patch, installer memasang keduanya.
- API Audit 2026 sempat melaporkan `rootExists=false` walaupun user session bisa membaca `\\pc-bim02\Dokumen Audit 2026`.
- Menjalankan `watchdog-bcl.bat` manual dari user session merecycle backend dan memperbaiki Audit 2026: `rootExists=true`, index membaca `151` files dan `106` folders.

## Skema Hybrid Setelah Patch

- Core BCL boleh hidup saat boot sebagai `SYSTEM`: PostgreSQL, nginx, backend, dan halaman umum.
- Layanan yang bergantung pada PC-BIM02 tidak lagi harus memblokir BCL secara keseluruhan.
- Saat PC-BIM02 belum siap, API Audit 2026 mengembalikan state `waiting_pc_bim02`, `retryAfterSeconds`, dan pesan waiting sederhana.
- Halaman Audit 2026 menampilkan waiting state dan mencoba refresh otomatis sampai share tersedia.
- Saat user login, `start-bcl-http-logon-fallback.bat` tetap menjalankan `watchdog-bcl.bat` meski server sudah hidup, supaya backend yang stale terhadap UNC bisa direcycle dari konteks user.
