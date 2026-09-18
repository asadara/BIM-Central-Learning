# P0-1 — Runtime Activation & Exit Validation

Tanggal: 18 September 2026 (WIB). Contract: [BCL Online Architecture Roadmap](BCL_Online_Architecture_Roadmap_Codex.md). Implementasi: [P0-1 Security & Canonical Identity](P0_1_Security_Canonical_Identity_Report.md).

**Status setelah review, 18 September 2026: P0-1 — Security & Canonical Identity Foundation: CLOSED.** User menyatakan acceptance criteria source, schema, integration test dan runtime smoke test P0-1 telah lulus. Warning existing `learning_materials` serta transient PDF timeout yang berhasil saat retest diterima sebagai known non-blocking issues; tidak diperbaiki dalam P0-1. Riwayat observasi di bawah tetap dipertahankan.

**Riwayat koreksi:** laporan 14:14 WIB semula mengandalkan konfirmasi operator bahwa Google berhasil pukul 13:57. Konfirmasi itu diralat menjadi tidak ada respons saat klik, sehingga PASS ditarik. Dalam tindak lanjut terbaru, operator mengonfirmasi keberhasilan browser biasa dan menjelaskan bahwa Incognito berhenti pada kebutuhan password Google. HTTP 200 lama tetap merupakan observasi server dan tidak diatribusikan ulang ke percobaan terbaru. Penyebab gejala awal tombol tidak merespons belum terbukti; keberhasilan percobaan berikutnya tidak membuktikan penyebabnya.

## Runtime Activation

**Fakta:** backend lama PID `12992` dihentikan setelah port dan command line diverifikasi. Backend diaktifkan kembali dengan prosedur backend-only normal [`start-backend-public.bat`](../../start-backend-public.bat), sesuai [`BCL_BAT_AUDIT_20260521.md`](../../BCL_BAT_AUDIT_20260521.md). Launcher berjalan pada 13:53:40 WIB; menunggu share PC-BIM02 sesuai prosedur existing. Backend baru PID `23652` melayani port `5052`, dengan startup selesai pada 13:56:25 WIB. PostgreSQL dan nginx tidak direstart oleh langkah ini.

- `GET http://127.0.0.1:5052/ping`: HTTP 200.
- `GET https://bcl.nke.net/api/auth/google/config`: HTTP 200, Google enabled; TLS diverifikasi menggunakan CA chain BCL yang dikonfigurasi, tanpa menonaktifkan pemeriksaan sertifikat.
- Log stdout: `logs/backend-public-5052-20260918-135340-661.log`.
- Log stderr: `logs/backend-public-5052-20260918-135340-661.err.log`.
- Tidak ada migration baru, perubahan source aplikasi, konfigurasi, secret, atau reset credential pada tahap aktivasi ini.

## Exit Tests

Bukti mesin dengan riwayat koreksi: [Runtime Validation Evidence](P0_1_Runtime_Validation_Evidence.json). Status HTTP konfigurasi Google maupun satu request Google HTTP 200 tanpa korelasi browser bukan bukti bahwa operator berhasil masuk. Fixture dari implementasi sebelumnya juga bukan pengganti smoke test runtime.

| Exit criterion | Hasil akhir | Bukti / batas |
|---|---|---|
| Restart backend melalui prosedur normal | PASS | PID berubah; health dan reverse proxy merespons |
| Schema/config P0-1 dan warning runtime | ACCEPTED setelah review | Schema P0-1 valid; warning Learning existing dan transient PDF timeout diterima user sebagai non-blocking |
| Existing local login | PASS | ID 9, HTTP 200; credential existing dimasukkan langsung oleh operator |
| Existing admin login | PASS | ID 9, HTTP 200; pembacaan sesi dengan `connect.sid` memuat `systemRole=system_admin` |
| Admin create dan bcrypt | PASS | HTTP 201, ID 34; hash bcrypt cost 10 dan bcrypt compare valid, bukan plaintext; role employee |
| Password leading/trailing spaces | PASS | Password raw dapat login; versi trim ditolak HTTP 401 |
| Profile update user biasa | PASS | Dua update pada ID 34 menghasilkan HTTP 200; ID tetap dan role employee |
| Jabatan tidak memberikan privilege | PASS | `positionLabel=System Administrator` dan `job_role=super admin` tidak memberi admin; bridge/create/login admin ditolak HTTP 403 |
| ID tetap / mass-assignment ditolak | PASS | ID respons dan PostgreSQL tetap 34; payload `id`/`system_role` terlarang ditolak HTTP 400 |
| Existing Google login setelah restart | PASS pada browser biasa | Konfirmasi terbaru operator dan request Google HTTP 200 pada 14:26:23 WIB, dengan statistik login akun existing dan tanpa row baru/kenaikan sequence. Incognito hanya sampai halaman Google karena password tidak tersedia |
| Cleanup akun uji | PASS | ID 34 dihapus melalui admin API setelah pencocokan ID/email/username |
| 16 user existing / sequence | PASS | Jumlah kembali 16; tidak ada perubahan selain statistik login; sequence 33 menjadi 34, sesuai satu admin create |

Helper [`validate-p0-runtime.js`](../../backend/scripts/validate-p0-runtime.js) hanya bind loopback, memakai URL acak dan validasi Origin/Host. Operator memasukkan credential langsung; password, JWT dan cookie hanya dipakai di memori. Semua mutation test melalui endpoint backend aktif; pool inspeksi PostgreSQL read-only. Tidak ada JWT palsu, mock Google, reset password existing, atau bypass authorization.

Satu akun sementara dengan email `@example.invalid` dibuat pada 14:06:35 WIB dan dihapus melalui admin API pada 14:06:36 WIB. Sebelum penghapusan, helper mencocokkan ID, email dan username dengan akun yang dibuatnya sendiri. Sequence tidak diturunkan setelah cleanup; kenaikan satu akibat create yang sah merupakan perubahan yang diharapkan, bukan renumber atau kerusakan sequence.

Percobaan awal pada 14:03:28 WIB berhasil login lokal dan mendapat sukses admin login, lalu berhenti pada pembacaan sesi. Penyebabnya ada pada helper: respons runtime memuat cookie pelacakan `bcl_client_id` sebelum `connect.sid`, sedangkan parser awal mengambil cookie pertama. Parser helper diperbaiki agar memilih `connect.sid` dari `getSetCookie()`; backend tidak diubah atau direstart lagi. Baseline dan hasil percobaan awal dipertahankan. Log proses helper juga mencatat satu percobaan login lokal HTTP 401 sebelum rangkaian akhir; tidak ada credential yang dicatat atau perubahan akun dari penolakan tersebut. Setelah operator memasukkan credential kembali, seluruh rangkaian lokal lulus pada 14:06:35–36 WIB. Empat kenaikan statistik dari helper sesuai dua login lokal dan dua login admin yang berhasil. Sesi admin percobaan sukses dilogout; sesi percobaan awal tidak dapat dilogout oleh helper yang saat itu memegang cookie pelacakan, sehingga mengikuti expiry sesi existing. Tidak dilakukan pembacaan/rekonstruksi token sesi atau pemutusan sesi pengguna lain untuk cleanup.

Helper dihentikan setelah hasil operator diterima dan snapshot akhir selesai; proses helper keluar dengan exit code 0. Backend BCL tetap aktif. URL loopback sementara tidak lagi melayani form credential.

## Schema and Data Integrity

Baseline read-only direkam sebelum restart: 16 user; sequence `last_value=33`, `is_called=true`. Setiap kolom user dibandingkan melalui digest; credential dan nilai profil tidak ditulis ke laporan.

Pemeriksaan 18 September sesudah restart mengonfirmasi:

- Ledger migration `20260917_p0_1_security_identity` masih tercatat pada 17 September 2026 16:05:24 WIB.
- Trigger `bcl_users_immutable_id` aktif; `users_password_bcrypt_check` tervalidasi.
- Primary key integer dan kedua index normalized email/username tetap ada.
- 14 foreign key tetap merujuk ke `public.users`; jumlah role tetap 1 `system_admin` dan 15 `employee`.
- Preflight migration read-only lulus: nol hash unsupported, nol level unsupported, nol duplikasi email/username per namespace.
- ID 15 dan 20 tetap ada dengan role employee. ID 23 tidak dibuat atau dialihkan. Tidak ada mapping alias, synthetic user, atau attendee berbasis nama.

Perubahan `login_count`, `last_login`, dan `updated_at` akibat login nyata dicatat terpisah dari perubahan profil/credential/ID. Login sebelum restart pada 13:52:49 WIB tidak dihitung sebagai bukti exit test setelah aktivasi.

| User existing | Delta login terhadap baseline | Korelasi faktual |
|---|---|---|
| ID 9 | +5 | Empat dari dua percobaan helper (lokal + admin); satu `POST /api/login` HTTP 200 melalui HTTPS pada 14:07:10 WIB |
| ID 30 | +1 | `last_login` 13:52:49 WIB, cocok dengan Google HTTP 200 sebelum restart |
| ID 31 | +1 | `last_login` 13:57:00 WIB, cocok dengan Google HTTP 200 sesudah restart |
| 13 user lainnya | 0 | Seluruh kolom tetap identik |

Pada snapshot 14:14 WIB, tidak ada field selain tiga statistik di atas yang berubah pada 16 user existing. Korelasi Google ke ID 30/31 disimpulkan dari timestamp PostgreSQL dan akses HTTP, jumlah user serta sequence; token/respons Google pengguna tidak diambil atau disalin oleh helper. Korelasi tersebut tidak membuktikan siapa yang melakukan request atau bahwa browser operator berhasil masuk. Riwayat konfirmasi dan ralat operator dipertahankan terpisah.

Pemeriksaan read-only tindak lanjut pada 14:27:31 WIB masih menemukan 16 user, sequence 34, nol ID baru/hilang dan nol perubahan ID/credential/role/atribut profil. ID 20 memiliki tambahan satu statistik login normal pada 14:26:23 WIB. Ini bukan merge atau reassignment kandidat ID 15/20; data kedua akun tetap terpisah. Setelah buffer akses nginx ditulis, pemeriksaan 14:30:58 WIB menemukan request `POST /api/auth/google` HTTP 200 pada 14:26:23 WIB di `bcl_https_access.log`. Timestamp cocok dengan `last_login` ID 20; hubungan ke ID tersebut merupakan korelasi timestamp dan integritas data, bukan inspeksi token Google atau pembuktian provider-sub mapping.

## Runtime Errors and Warnings

1. **`relation "learning_materials" does not exist` — 29 kemunculan pada log baru sampai 14:14 WIB.** PostgreSQL read-only mengonfirmasi `public.learning_materials` tidak ada. Source `backend/services/learningMaterialsSource.js:205` mencoba sumber PostgreSQL, lalu mencatat warning dan memakai sumber konten lain. Warning yang sama sudah terdapat pada `logs/kpi-ux-backend-20260916.err.log:3`, sebelum implementasi P0-1. Ini mismatch schema konten existing; tidak disebabkan migration identity, tetapi tetap merupakan temuan runtime unresolved. Definisi tabel terdapat di `backend/create-tables.sql:259`; file schema global tersebut tidak dijalankan untuk menyembunyikan temuan.
2. **`Failed to load PDF read counts from PostgreSQL: Connection terminated due to connection timeout`.** Terjadi sekali pada jendela awal runtime. Query read-only terhadap `pdf_material_reads` berhasil. Ulang baca endpoint `GET /api/pdf-display/selected` menghasilkan HTTP 200, success, 23 PDF, tanpa timeout baru; warning `learning_materials` tetap muncul. Penyebab timeout awal belum terbukti; jangan menyimpulkan masalah hilang permanen dari satu retest.
3. **TLS pada alat inspeksi Node.** Trust store default Node tidak mengenali chain lokal (`SELF_SIGNED_CERT_IN_CHAIN`). Pemeriksaan ulang dengan CA BCL yang sudah dikonfigurasi berhasil. Sertifikat/config tidak diganti dan verifikasi TLS tidak dimatikan.
4. **Warning line-ending Git.** `git diff --check` lulus; pemberitahuan LF/CRLF bukan error runtime.

**Kesimpulan teknis:** backend dan koneksi identitas PostgreSQL aktif, tetapi health check tidak membuktikan semua sumber konten siap. Mismatch konten di atas tidak memberi alasan untuk mengubah canonical user ID atau melakukan migration modul lain dalam task ini.

## Changes in This Validation Stage

- Menambahkan helper operator-assisted, evidence sanitasi, dan laporan runtime ini.
- Melakukan restart backend yang diminta dan pemeriksaan read-only schema/data.
- Tidak mengubah implementasi aplikasi, migration, konfigurasi atau architecture contract pada tahap ini.

File deliverable tahap runtime:

- `backend/scripts/validate-p0-runtime.js`: helper runtime sementara, kini tidak berjalan.
- `docs/architecture/P0_1_Runtime_Validation_Evidence.json`: hasil sanitasi, snapshot integritas, observasi HTTP dan keputusan exit criteria.
- `docs/architecture/P0_1_Runtime_Activation_Exit_Validation.md`: laporan ini.
- `docs/architecture/P0_1_Security_Canonical_Identity_Report.md` dan `P0_1_Migration_Runbook.md`: catatan aktivasi aktual dan tautan hasil runtime.

Pemeriksaan tambahan: preflight migration dalam mode read-only lulus; `node --check backend/scripts/validate-p0-runtime.js` lulus. Pengujian integrasi 28/28 dari tahap implementasi tidak dijalankan ulang karena source aplikasi tidak berubah; hasil tersebut tetap dipisahkan dari bukti runtime live.

## Closure and Deferred Work

**Keputusan review: P0-1 — CLOSED.** Keputusan sebelumnya yang menahan closure karena warning konten digantikan instruksi eksplisit user. Dua temuan tetap tercatat, tidak dianggap sudah diperbaiki, dan dialihkan ke [Technical Debt / Module Health](BCL_Technical_Debt_Module_Health.md).

**Batas tindak lanjut Google:** pemeriksaan dilakukan read-only dan tidak memulai redesign account linking atau unifikasi sesi P0-2. Tidak meminta, mengganti, atau mereset password Google. Jika gejala tombol tidak merespons berulang, bukti console/network pada saat kejadian masih diperlukan untuk menetapkan penyebab; HTTP 200 dari waktu lain bukan pengganti bukti tersebut.

Gejala tambahan dari operator: klik tombol tidak menimbulkan respons yang terlihat. Operator memastikan halaman yang diklik adalah `https://bcl.nke.net/pages/login.html`. Pemeriksaan HTTP read-only pada 14:18 WIB menunjukkan halaman login BCL merespons 200 dan mendeklarasikan SDK/callback Google; konfigurasi Google merespons 200 dengan enabled dan client ID tersedia. Ini tidak membuktikan SDK berjalan atau popup berhasil pada browser operator. Belum ada bukti yang cukup untuk menetapkan penyebab; pemeriksaan browser terisolasi dilakukan tanpa credential dan tanpa mengubah aplikasi/config.

**Fakta browser terisolasi:** pada 14:20–14:22 WIB, Playwright CLI dengan Chrome headless dan profil terisolasi membuka halaman BCL melalui HTTPS, menampilkan iframe tombol Google, dan klik pada tombol tersebut membuka jendela Google `accounts.google.com` dengan layar "Sign in", tujuan `nke.net`, serta kolom email. Tidak ada credential yang dimasukkan, callback autentikasi tidak diselesaikan, dan browser uji kemudian ditutup. Gejala operator belum terulang pada browser ini. Hasil ini sendiri hanya membuktikan tahap pembukaan popup. Operator kemudian juga berhasil membuka halaman Google melalui Incognito, namun berhenti karena lupa password; login berhasil dilaporkan melalui browser biasa. Popup blocker/extension/cache tidak ditetapkan sebagai penyebab.

**Rekomendasi schema, belum dijalankan:** review mismatch konten `learning_materials` secara terpisah untuk menentukan sumber data yang memang dikehendaki dan migration/recovery yang sesuai. Telusuri timeout PDF awal jika berulang. Kedua temuan ini tidak menghalangi closure P0-1 yang sudah direview; pemeriksaan berikutnya menjadi checkpoint module health sebelum/saat P0-3 menyentuh Learning. Tidak melakukan create table kosong atau mengubah source fallback konten hanya agar log terlihat bersih.

P0-2 Authentication & Session Unification diizinkan dimulai setelah closure ini. P0-3, G0 dan implementasi BCL Online tetap tidak dimulai. Tidak ada auto-merge/reassignment ID 15/20, orphan 23, attendee nama atau alias/synthetic legacy. Perbaikan schema konten existing memerlukan tindak lanjut terpisah dari validasi identity ini.
