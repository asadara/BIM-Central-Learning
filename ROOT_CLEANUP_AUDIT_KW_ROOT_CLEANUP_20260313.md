# Root Cleanup Audit

Date: 2026-03-13
Keyword: `KW_ROOT_CLEANUP_20260313`
Scope: `C:\BCL` root level only

## Execution Status

- Batch 1 executed on 2026-03-13
- Batch 2 executed on 2026-03-13
- Runtime verification after Batch 1:
  - `https://bcl.nke.net/api/server/status` = `running`
  - `node .\backend\scripts\db-ping.js` = `ok`
- Result:
  - root temp/test/log files in `safe delete` batch were removed
  - `.codex-tmp` removed
  - `.playwright-cli` also gone after verification session ended
- Runtime verification after Batch 2:
  - `https://bcl.nke.net/api/server/status` = `running`
  - `node .\backend\scripts\db-ping.js` = `ok`
- Batch 2 quarantine folder created:
  - `C:\BCL\_retired\2026-03-root-cleanup\`

## Goal

Memilah file root `C:\BCL` menjadi:

- `keep`: masih relevan untuk runtime/operator aktif
- `quarantine first`: jangan langsung dihapus; pindah dulu ke folder karantina lalu verifikasi
- `safe delete`: artefak test/temp/log lama yang tidak layak dipertahankan di root
- `defer`: butuh audit lanjutan karena bernilai operasional atau historis

## Verified Runtime Facts

- Entry point produksi aktif: `start-bcl-http.bat`
- Runtime aktif masih memakai:
  - `stop-bcl-http.bat`
  - `watchdog-bcl.bat`
  - `start-backend-public.bat`
  - `start-legacy-5051-proxy.bat`
- PostgreSQL native aktif; Docker Desktop sudah tidak terpasang
- Scheduled task lama masih ada:
  - `BCL Auto Start (Logon Hidden Fallback)`
  - `BCL Watchdog (5m)`

## Keep

File berikut masih relevan untuk runtime/operator aktif dan tidak disarankan dibersihkan:

- `start-bcl-http.bat`
- `stop-bcl-http.bat`
- `watchdog-bcl.bat`
- `start-backend-public.bat`
- `start-legacy-5051-proxy.bat`
- `install-bcl-autostart-task.bat`
- `install-bcl-watchdog-task.bat`
- `install-bcl-shutdown-task.bat`
- `uninstall-bcl-autostart-task.bat`
- `uninstall-bcl-watchdog-task.bat`
- `uninstall-bcl-shutdown-task.bat`
- `install-native-postgres-service.bat`
- `restore-native-postgres.ps1`
- `sync-bim-media-public.ps1`
- `sync-project-media-cache.ps1`
- `sync-projects-explorer-cache.ps1`
- `start-bcl-fixed.bat`

Catatan:
- `start-bcl-fixed.bat` sekarang hanya alias ke `start-bcl-http.bat`, tetapi masih dirujuk dokumentasi admin dan shortcut helper.

## Quarantine First

File berikut kandidat kuat dipensiunkan, tetapi sebaiknya dipindah dulu ke folder karantina semacam `_retired\2026-03-root-cleanup\`:

- `start-bcl-http-logon-fallback.bat`
Reason: jalur fallback lama; tidak lagi dibuat oleh installer baru, tetapi masih mungkin dipakai scheduled task `BCL Auto Start (Logon Hidden Fallback)`.

- `BCL_Launcher.bat`
Reason: ditandai sebagai development-only di `konteks.md`; bukan entry point produksi.

- `start-backend-only.bat`
Reason: utility manual untuk menjalankan backend langsung; tidak dirujuk runtime aktif.

- `run-bcl.ps1`
Reason: wrapper operator lama; tidak dirujuk runtime aktif.

- `startup-phase4-enterprise.ps1`
- `start-phase4-enterprise.bat`
- `run-phase4.ps1`
- `phase4-dashboard-script.js`
- `_strip_phase4.js`
- `_update_phase4.js`
- `_update_phase4_ready.js`
- `update_phase4.js`
Reason: rangkaian fase lama yang terlihat historis; masih dirujuk markdown lama, tetapi tidak terlihat pada runtime aktif saat ini.

- `backup-bcl-postgres-docker.ps1`
- `docker-compose.postgres.yml`
- `docker-ping.ps1`
- `setup-postgres.bat`
Reason: terkait jalur Docker PostgreSQL lama. Setelah uninstall Docker Desktop, file-file ini sudah tidak operasional untuk server ini. Tetap lebih aman dikarantina dulu karena masih dirujuk dokumentasi migrasi.

- `add-bcl-hosts.bat`
- `add-bcl-hosts.ps1`
- `clear-browser-cache.bat`
Reason: utility operator yang mungkin masih berguna, tetapi bukan kebutuhan runtime inti.

## Safe Delete

File/artefak berikut layak dibersihkan dari root tanpa nilai runtime nyata:

### Temporary and scratch files

- `.new_courses_script.htmlpart`
- `.tmp_courses_script.js`
- `_tmp_adminbcl_live.html`
- `_tmp_write_test.txt`
- `DUMMY_FILE`
- `hosts_temp.txt`

### Root test HTML

- `simple-login-test.html`
- `test-login.html`
- `test-video-display.html`

### Root test BAT/JS

- `run-load-test.bat`
- `test-bcl-access.bat`
- `test-bcl-debug.bat`
- `test-doubleclick.bat`
- `test-nginx-detection.bat`
- `test-api-filtering.js`
- `test-apostrophe-folder.js`
- `test-bim02-data.js`
- `test-count.js`
- `test-direct-pcbim02-scan.js`
- `test-drive-access.js`
- `test-dynamic-ip.js`
- `test-filtering.js`
- `test-media.js`
- `test-mount-access.js`
- `test-mount-status.js`
- `test-pcbim02-fetching.js`
- `test-projects.js`
- `test-video-paths.js`

### Root logs

- `debug_startup.log`
- `backend.log`
- `error.log`
- `server.log`
- `server-output.txt`
- `server-run.log`
- `server-test.log`
- `test_debug.log`

### Tool artifacts

- `.playwright-cli\`
- `.codex-tmp\`

Catatan:
- `output\` tidak masuk batch hapus otomatis root-level ini karena bisa berisi artefak yang masih ingin disimpan. Audit terpisah disarankan untuk `output\playwright\`.

## Defer

Item berikut tidak saya rekomendasikan untuk disentuh pada batch pertama:

- `backup\`
- `backups\`
- `edit-backups\`
- `logs\`
- `data\`
- `public\`
- `postgres\`
- `migrations\`
- `scripts\`
- `node_modules\`
- `nginx\`
- `backend\`
- `BC-Learning-Main\`

Reason:
- butuh audit isi folder, bukan keputusan root-level cepat
- beberapa jelas operasional atau berpotensi menyimpan data/backup penting

## Recommended Execution Order

### Batch 1

Hapus langsung `safe delete`.

Status:

- executed
- root no longer contains the deleted temp/test/log files from this batch

### Batch 2

Pindahkan `quarantine first` ke:

`C:\BCL\_retired\2026-03-root-cleanup\`

Status:

- executed for:
  - `operator-legacy`
  - `phase4`
  - `docker-legacy`
- intentionally skipped:
  - `start-bcl-http-logon-fallback.bat`

Reason skipped:

- scheduled task `BCL Auto Start (Logon Hidden Fallback)` still exists and may still target that file

### Batch 3

Verifikasi:

- `https://bcl.nke.net/`
- `https://bcl.nke.net/api/server/status`
- service `postgresql-x64-15`
- scheduled task BCL

### Batch 4

Jika stabil, hapus permanen isi karantina yang memang tidak ingin disimpan.

## Important Blocker

Sebelum menghapus `start-bcl-http-logon-fallback.bat`, bereskan dulu scheduled task lama:

- `BCL Auto Start (Logon Hidden Fallback)`

Kalau task itu masih aktif sementara file targetnya dihapus, startup logon lama bisa gagal.
