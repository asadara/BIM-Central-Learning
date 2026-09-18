# P0-1 — Security & Canonical Identity Foundation

Tanggal: 17 September 2026. Dasar: [architecture contract](BCL_Online_Architecture_Roadmap_Codex.md) dan audit P0 read-only pada sesi ini.

**Status review 18 September: P0-1 — Security & Canonical Identity Foundation: CLOSED.** Acceptance criteria source, schema, integration test dan runtime dinyatakan lulus oleh user. Dua warning Learning/PDF diterima non-blocking dan dicatat pada [technical debt / module health](BCL_Technical_Debt_Module_Health.md).

**Status implementasi 17 September:** source dan migration schema selesai; 28/28 skenario integrasi lulus. Migration database operasional sudah committed; pada saat laporan awal dibuat backend belum direstart.

**Pembaruan 18 September:** backend sudah direstart melalui prosedur operasional normal. Hasil aktivasi, smoke test runtime, integritas data dan keputusan CLOSED dicatat terpisah dalam [Runtime Activation & Exit Validation](P0_1_Runtime_Activation_Exit_Validation.md). Batas pengujian di bawah menggambarkan pengujian implementasi pada 17 September, bukan status runtime terbaru.

Istilah **fakta** berarti hasil pemeriksaan source/schema atau pengujian yang dilakukan. **Kesimpulan teknis** menjelaskan dampaknya. **Rekomendasi/deferred** belum merupakan implementasi. Laporan ini membatasi implementasi pada P0-1; pekerjaan P0-2 yang kemudian diotorisasi dilaporkan secara terpisah. P0-3, G0 dan BCL Online belum dimulai.

## Changes Made

1. **Pisahkan jabatan dari privilege.** `positionLabel`, `position_label`, `jobRole`, `job_role`, metadata `isAdmin`, dan status verifikasi jabatan tidak lagi mempromosikan `system_role`. Inisialisasi schema hanya menormalkan nilai role yang kosong/tidak valid menjadi `employee`. Admin login dan bridge memeriksa `system_role` PostgreSQL secara eksplisit. Helper/admin server controls tidak menerima substring `admin`/`super`, `jobRole`, maupun flag JWT `isAdmin` sebagai pengganti role sistem. Session admin yang baru dibuat memuat marker `systemRole: system_admin`.
2. **Seragamkan credential.** Helper bersama menggunakan bcrypt cost 10; seluruh pembuatan akun aktif—signup lokal, Google, admin create dan bootstrap admin—melewati hashing. Admin create selalu membuat `employee`; jabatan berisi “Administrator” tetap hanya atribut profil. Jalur reset dan perubahan password memakai validasi yang sama. Password baru minimal 8 unit panjang string JavaScript dan maksimal 72 byte UTF-8; spasi di awal/akhir dipertahankan. Verifikasi hash existing tidak memaksakan kebijakan panjang baru dan tidak melakukan rehash/reset otomatis.
3. **Pertahankan canonical ID.** Tetap memakai integer serial `public.users.id`, bukan UUID atau sistem ID kedua. Mutation profil, foto, pemulihan credential dan user management menargetkan ID, tanpa alternatif pencocokan email. Field ID, role sistem, metadata, provider identifier dan hash/password mentah yang tidak sesuai operasi ditolak atau dikecualikan dari allowlist. Trigger database menolak perubahan nilai `users.id`.
4. **Tegakkan batas identity setelah autentikasi.** Helper menerima ID PostgreSQL numerik yang valid dari carrier claim existing; claim ID yang saling bertentangan atau identifier email/nama/synthetic ditolak. Format JWT terbitan tetap memakai `userId`, `email`, `role`, `iat`, `exp`; ini bukan unifikasi JWT/session. Query akses Workspace/kompetensi/organisasi, approval akses, serta kepemilikan aktivitas, quiz/practice dan sertifikat yang terdampak menggunakan ID. Email/nama tetap boleh menjadi atribut display/snapshot.
5. **Batasi fallback.** PostgreSQL unavailable tidak memicu pembuatan, autentikasi, mutasi, reset password atau pemberian privilege terhadap akun JSON. Entry point kompatibilitas tetap ada tetapi gagal tertutup. Shared admin token yang menghasilkan identitas synthetic tanpa mapping tidak lagi diterima. Import user JSON dan restore akun JSON ke storage aktif dinonaktifkan sampai ada mapping yang direview; file arsip tidak dihapus.
6. **Perbaiki konsistensi source yang memblokir auth.** Parameter SQL jabatan yang dipakai bersama oleh kolom `varchar` dan `text` diberi cast eksplisit. Constraint level diselaraskan hanya untuk menerima NULL dan `BIM Specialist` yang sudah didukung source. Tidak ada perubahan level user existing.
7. **Frontend mempertahankan identity hasil server.** Handler login lokal/Google menyimpan `id` dari response; normalisasi user dan update profil mempertahankannya. Pengambilan ID untuk courses/certifications/dashboard yang disentuh tidak lagi memilih email/nama. Tampilan kontrol admin tidak lagi memakai substring jabatan sebagai penentu admin.
8. **Temuan tambahan: mass-assignment Level Request.** Update sebelumnya menyalin seluruh `req.body`. Sekarang hanya field isi permohonan yang boleh diubah; pemilik tidak dapat mengganti `userId`, ID request, status persetujuan, atau reviewer. Penyimpanan JSON Level Request tetap dipertahankan.

Jalur penetapan `system_admin` yang tetap ada adalah bootstrap operator melalui konfigurasi admin eksplisit, serta administrasi PostgreSQL yang sah di luar self-service. P0-1 tidak menambah endpoint publik untuk menaikkan role sistem dan tidak mengubah role akun existing.

## Files Changed

Inventaris berikut hanya berisi file implementasi/dokumentasi P0-1. Architecture contract yang sudah ada tidak diubah.

47 file P0-1: 38 file existing diubah dan 9 file baru.

| File | Perubahan utama |
|---|---|
| [BC-Learning-Main/components/navbar.html](../../BC-Learning-Main/components/navbar.html) | Identity frontend, credential atau tampilan privilege |
| [BC-Learning-Main/elearning-assets/js/auth-guard.js](../../BC-Learning-Main/elearning-assets/js/auth-guard.js) | Identity frontend, credential atau tampilan privilege |
| [BC-Learning-Main/elearning-assets/js/certifications.js](../../BC-Learning-Main/elearning-assets/js/certifications.js) | Identity frontend, credential atau tampilan privilege |
| [BC-Learning-Main/elearning-assets/js/component-loader.js](../../BC-Learning-Main/elearning-assets/js/component-loader.js) | Identity frontend, credential atau tampilan privilege |
| [BC-Learning-Main/elearning-assets/js/courses.js](../../BC-Learning-Main/elearning-assets/js/courses.js) | Identity frontend, credential atau tampilan privilege |
| [BC-Learning-Main/elearning-assets/js/dashboard.js](../../BC-Learning-Main/elearning-assets/js/dashboard.js) | Identity frontend, credential atau tampilan privilege |
| [BC-Learning-Main/elearning-assets/js/user.js](../../BC-Learning-Main/elearning-assets/js/user.js) | Identity frontend, credential atau tampilan privilege |
| [BC-Learning-Main/elearning-assets/update.html](../../BC-Learning-Main/elearning-assets/update.html) | Identity frontend, credential atau tampilan privilege |
| [BC-Learning-Main/js/admin/admin-panel.js](../../BC-Learning-Main/js/admin/admin-panel.js) | Identity frontend, credential atau tampilan privilege |
| [BC-Learning-Main/js/bim-methode.js](../../BC-Learning-Main/js/bim-methode.js) | Identity frontend, credential atau tampilan privilege |
| [BC-Learning-Main/js/loadComponents.js](../../BC-Learning-Main/js/loadComponents.js) | Identity frontend, credential atau tampilan privilege |
| [BC-Learning-Main/js/tutorials.js](../../BC-Learning-Main/js/tutorials.js) | Identity frontend, credential atau tampilan privilege |
| [BC-Learning-Main/js/user.js](../../BC-Learning-Main/js/user.js) | Identity frontend, credential atau tampilan privilege |
| [BC-Learning-Main/js/userindex.js](../../BC-Learning-Main/js/userindex.js) | Identity frontend, credential atau tampilan privilege |
| [BC-Learning-Main/pages/login.html](../../BC-Learning-Main/pages/login.html) | Identity frontend, credential atau tampilan privilege |
| [BC-Learning-Main/pages/signup.html](../../BC-Learning-Main/pages/signup.html) | Identity frontend, credential atau tampilan privilege |
| [BC-Learning-Main/pages/sub/adminbcl.js](../../BC-Learning-Main/pages/sub/adminbcl.js) | Identity frontend, credential atau tampilan privilege |
| [BC-Learning-Main/pages/sub/mapping-kompetensi.html](../../BC-Learning-Main/pages/sub/mapping-kompetensi.html) | Identity frontend, credential atau tampilan privilege |
| [backend/elearning/controllers/certificateController.js](../../backend/elearning/controllers/certificateController.js) | Credential, authorization, canonical ownership atau kontrol fallback |
| [backend/elearning/controllers/quizController.js](../../backend/elearning/controllers/quizController.js) | Credential, authorization, canonical ownership atau kontrol fallback |
| [backend/elearning/routes/activityRoutes.js](../../backend/elearning/routes/activityRoutes.js) | Credential, authorization, canonical ownership atau kontrol fallback |
| [backend/elearning/routes/progressRoutes.js](../../backend/elearning/routes/progressRoutes.js) | Credential, authorization, canonical ownership atau kontrol fallback |
| [backend/routes/accessRequests.js](../../backend/routes/accessRequests.js) | Credential, authorization, canonical ownership atau kontrol fallback |
| [backend/routes/adminRoutes.js](../../backend/routes/adminRoutes.js) | Credential, authorization, canonical ownership atau kontrol fallback |
| [backend/routes/adminSessionRoutes.js](../../backend/routes/adminSessionRoutes.js) | Credential, authorization, canonical ownership atau kontrol fallback |
| [backend/routes/bimWorkspaceRoutes.js](../../backend/routes/bimWorkspaceRoutes.js) | Credential, authorization, canonical ownership atau kontrol fallback |
| [backend/routes/competencyRoutes.js](../../backend/routes/competencyRoutes.js) | Credential, authorization, canonical ownership atau kontrol fallback |
| [backend/routes/levelRequestsPublic.js](../../backend/routes/levelRequestsPublic.js) | Credential, authorization, canonical ownership atau kontrol fallback |
| [backend/routes/organizations.js](../../backend/routes/organizations.js) | Credential, authorization, canonical ownership atau kontrol fallback |
| [backend/routes/serverManagementRoutes.js](../../backend/routes/serverManagementRoutes.js) | Credential, authorization, canonical ownership atau kontrol fallback |
| [backend/routes/userAuthRoutes.js](../../backend/routes/userAuthRoutes.js) | Credential, authorization, canonical ownership atau kontrol fallback |
| [backend/routes/users.js](../../backend/routes/users.js) | Credential, authorization, canonical ownership atau kontrol fallback |
| [backend/scripts/p0-1-security-rollback.sql](../../backend/scripts/p0-1-security-rollback.sql) | Migration dan preflight/recovery |
| [backend/scripts/p0-1-security.sql](../../backend/scripts/p0-1-security.sql) | Migration dan preflight/recovery |
| [backend/scripts/run-p0-security-migration.js](../../backend/scripts/run-p0-security-migration.js) | Migration dan preflight/recovery |
| [backend/scripts/test-p0-security.js](../../backend/scripts/test-p0-security.js) | Regresi terisolasi |
| [backend/server.js](../../backend/server.js) | Credential, authorization, canonical ownership atau kontrol fallback |
| [backend/services/userAuthService.js](../../backend/services/userAuthService.js) | Credential, authorization, canonical ownership atau kontrol fallback |
| [backend/tests/p0-1-security.test.js](../../backend/tests/p0-1-security.test.js) | Regresi terisolasi |
| [backend/utils/auth.js](../../backend/utils/auth.js) | Credential, authorization, canonical ownership atau kontrol fallback |
| [backend/utils/canonicalIdentity.js](../../backend/utils/canonicalIdentity.js) | Credential, authorization, canonical ownership atau kontrol fallback |
| [backend/utils/credentials.js](../../backend/utils/credentials.js) | Credential, authorization, canonical ownership atau kontrol fallback |
| [backend/utils/userAccess.js](../../backend/utils/userAccess.js) | Credential, authorization, canonical ownership atau kontrol fallback |
| [backend/utils/userProfileSchema.js](../../backend/utils/userProfileSchema.js) | Credential, authorization, canonical ownership atau kontrol fallback |
| [docs/architecture/P0_1_Migration_Runbook.md](../../docs/architecture/P0_1_Migration_Runbook.md) | Laporan dan recovery plan |
| [docs/architecture/P0_1_Security_Canonical_Identity_Report.md](../../docs/architecture/P0_1_Security_Canonical_Identity_Report.md) | Laporan dan recovery plan |
| [import-json-to-postgres.js](../../import-json-to-postgres.js) | Blokir import user tanpa mapping |

## Database / Migration Changes

**Fakta database operasional:** `bcl_database.public.users`, 16 user, 1 `system_admin`, 15 `employee`, dan 14 foreign key yang mengacu ke users. Preflight menemukan nol hash di luar format yang didukung, nol nilai level yang tidak didukung source, serta nol kelompok duplikasi email/username setelah normalisasi.

Migration `20260917_p0_1_security_identity` committed pada **17 September 2026, 16:05:24 WIB**. Perubahannya:

- `bcl_users_immutable_id` menolak UPDATE yang mengubah ID, melalui fungsi `bcl_preserve_canonical_user_id`.
- `users_password_bcrypt_check` memvalidasi format bcrypt; seluruh record existing lolos validasi.
- `users_email_normalized_key` dan `users_username_normalized_key` menjaga keunikan masing-masing namespace dengan `lower(btrim(...))`.
- `bim_level` menjadi nullable dan check menerima empat nilai yang sudah dikenal source. Tidak ada backfill level.
- Ledger `bcl_schema_migrations` menyimpan marker penerapan.

Transaksi memakai lock timeout 3 detik dan statement timeout 30 detik. Digest seluruh kolom user dan state sequence dibandingkan sebelum/sesudah migration **di dalam transaksi**; hasilnya identik. Tidak ada insert/update/delete user, pengubahan hash, merge, renumber, atau perubahan sequence. Pemeriksaan sesudah commit mengonfirmasi jumlah role dan 14 foreign key tetap sama.

Forward plan, kondisi abort, reverse SQL dan recovery terdapat pada [Migration Runbook](P0_1_Migration_Runbook.md). Rollback menolak kondisi ketika akun baru sudah memakai NULL/`BIM Specialist`; tidak akan mengganti level atau menghapus user agar rollback berhasil. Fresh installation harus menjalankan migration ini setelah base schema.

## Tests Run

| Pemeriksaan | Lingkungan/metode | Hasil |
|---|---|---|
| `node backend/scripts/test-p0-security.js` | Cluster PostgreSQL 15 sementara di loopback; Express route/service aktual; akun fixture | 28/28 lulus |
| Validasi sintaks | `vm.Script` untuk source JS baru/berubah dan inline script HTML yang berubah | 44 script lulus |
| `git diff --check` | Working tree | Lulus |
| CLI migration tanpa `--apply` | Transaksi read-only pada database operasional | Lulus |
| CLI migration dengan `--apply` | Transaksi schema dengan snapshot user/sequence | Committed; data identik |
| Verifikasi pasca-migration | Query read-only schema, ledger, index, trigger, count dan FK | Lulus |

Runner tidak menghubungkan pool tes ke database operasional. Cluster sementara dihentikan/dibersihkan setelah selesai. Percobaan awal menemui kendala restricted token/pipe proses Windows dan beberapa kegagalan regresi; runner serta query terkait diperbaiki sebelum hasil akhir di atas. Log “database unavailable” pada skenario negatif merupakan simulasi yang disengaja.

## Test Results

| Bukti yang diminta / tambahan | Hasil faktual |
|---|---|
| User biasa mengubah jabatan menjadi Administrator | Profil tetap ID yang sama, role tetap employee, JWT employee, admin login/bridge dan admin create ditolak |
| Helper/schema tidak mempromosikan privilege | Inisialisasi ulang dengan job title Administrator, metadata `isAdmin:true`, dan jabatan verified tetap employee |
| Admin create dan signup lokal | Hash diperiksa dengan bcrypt compare; akun dapat login dengan password fixture yang benar |
| Local login existing | Fixture hash bcrypt lama dengan password 6 karakter tetap dapat login melalui email dan username; hash tidak berubah |
| Spasi password | Password raw dapat signup/login/change/reset; versi yang di-trim ditolak; ketiga handler login frontend mempertahankan spasi |
| Validasi credential | Password terlalu pendek, >72 byte, dan tipe non-string ditolak pada kedua jalur create |
| Immutability | Profile service/route mempertahankan ID; SQL langsung yang mencoba mengubah ID ditolak trigger |
| Storage credential | SQL INSERT/UPDATE plaintext ditolak constraint; service menolak plaintext yang disamarkan sebagai hash |
| Mass-assignment | Field ID, role, metadata, provider ID dan password mentah pada operasi yang tidak sesuai ditolak; Level Request tidak dapat dipindahkan atau diset approved oleh pemilik |
| Stale email / konflik claim | ID tetap menentukan akun; email milik orang lain tidak mengalihkan profil, foto, privilege, atau kepemilikan; claim ID yang bertentangan ditolak |
| Admin legitimate | Session admin eksplisit, password change, reset dan bootstrap PostgreSQL berjalan pada fixture |
| Google existing | Response mengembalikan ID PostgreSQL yang sama, tanpa tambahan row atau perubahan password lokal; job title tidak menaikkan privilege |
| Google signup/token validation | Akun baru menyimpan bcrypt; audience salah dan email belum verified ditolak |
| Database outage / legacy | Login, create, bridge dan update gagal tertutup; nol pemanggilan writer JSON; restore dan shared JSON writer ditolak |
| Directory fallback | Row diagnostik memiliki `id:null`, `legacyId`, `canonicalIdentityResolved:false`, dan tidak membawa izin akses |
| Kepemilikan learning | Data milik orang lain atau tanpa ID tidak terbaca/terhitung hanya karena email/nama sama; history, stats, certificate, dan dedup aktivitas diuji |
| Migration/recovery | Apply, repeat apply, transaction rollback dan reverse SQL diuji pada database sementara; seluruh field user dan sequence dipertahankan |

**Batas bukti:** Google tokeninfo diuji melalui endpoint fixture lokal dengan service verifikasi dan route aktual; belum melakukan interaksi langsung dengan akun Google/live consent. Browser penuh tidak dijalankan; handler frontend aktual dieksekusi dalam VM dengan DOM/fetch fixture. Tidak memakai password user operasional, mengirim email recovery nyata, atau memanggil restart server. Seluruh workflow KPI/task/worklog/meeting/issues tidak diuji end-to-end pada tahap ini.

## Security Issues Closed

Pada source yang telah diperbaiki dan diuji:

- Promosi admin dari jabatan, status verifikasi jabatan, metadata dan flag/label role yang tidak sah.
- Penyimpanan plaintext oleh admin create dan jalur writer/restore/import identity JSON yang belum memiliki mapping.
- Ketidakkonsistenan trim dan validasi credential pada jalur yang disentuh.
- Perubahan canonical ID melalui API/service dan UPDATE database.
- Mutasi akun salah akibat query ID-or-email, serta perluasan pembacaan evidence melalui email/nama pada query yang diperbaiki.
- Authority identity/privilege dari fallback JSON dan shared admin identity synthetic.
- Reassignment pemilik atau self-approval melalui mass-assignment Level Request.

Proteksi schema sudah aktif di database. Aktivasi route/helper melalui restart dilakukan pada task runtime 18 September; bukti dan batas validasinya terdapat pada [laporan runtime](P0_1_Runtime_Activation_Exit_Validation.md).

## Residual Risks

1. **Exit validation runtime.** Restart terkontrol dilakukan pada 18 September. Status smoke test login lokal/Google dan temuan startup mengacu ke laporan runtime. Hasil fixture tetap tidak dianggap sebagai verifikasi runtime produksi.
2. **Google linking belum diselesaikan.** Lookup Google existing masih berbasis email melalui lookup login yang menerima email/username; provider `sub` belum menjadi relasi provider yang persisten. Collision antar-namespace, auto-link/pre-hijacking dan perubahan email/provider memerlukan P0-2. Tidak ada auto-merge pada tahap ini.
3. **JWT/session masih model existing.** Masa berlaku JWT 7 hari, claim yang belum unified, revocation, sesi admin terpisah, stale role dalam token, cookie/store dan prioritas bearer/session belum didesain ulang. P0-1 menghapus sumber promosi yang ditemukan, tetapi tidak membuktikan bahwa setiap token lama sudah dicabut. Tidak dilakukan rotasi secret atau pemutusan seluruh sesi.
4. **Throttling/recovery belum lengkap.** Signup memakai limiter auth existing, tetapi desain limiter persisten/distribusi, throttling seluruh endpoint admin, dan lifecycle recovery lengkap memerlukan P0-2. Token reset legacy JSON tidak diterima. Konsumsi token reset dan update password existing belum diubah menjadi transaksi tunggal; kegagalan sesudah konsumsi memerlukan link baru.
5. **Historical role provenance.** Satu role admin existing dipertahankan. Audit/test tidak membuktikan riwayat siapa yang memberi setiap role/token sebelum P0-1; tidak ada demosi otomatis berdasarkan dugaan.
6. **Data legacy tetap unresolved.** ID 15 dan 20 tidak digabung; ID 23 tidak dibuat/dialihkan; attendee berbasis nama dan synthetic/alias tidak dipetakan. Record tanpa canonical ID tidak otomatis dimunculkan sebagai milik user pada evidence query yang dikunci.
7. **Kelengkapan modul.** Cache frontend lama, reviewer/log yang menyimpan label email/nama, logical references yang belum memiliki FK, dan seluruh workflow operasional membutuhkan audit/migration P0-3. Metadata display tidak dianggap bukti ownership. Penghapusan akun administratif dan konsekuensi referensi existing tidak didesain ulang di P0-1.
8. **Runtime schema initialization masih ada.** Helper existing tetap memiliki DDL/backfill atribut profil; perubahan hanya menghapus inferensi privilege. Pemindahan keseluruhan runtime DDL ke migration eksplisit di luar tahap ini.

Fallback yang dipertahankan atau dibatasi:

| Jalur | Keadaan P0-1 | Risiko/compatibility |
|---|---|---|
| `userAuthService` JSON lookup/update dan `server.writeUsers` | Entry point tetap ada; tidak mengautentikasi/menulis akun | PostgreSQL wajib tersedia untuk identity authority |
| Local/Google signup/login, admin bridge/create/bootstrap, password change/reset | Tidak berpindah ke akun JSON | Outage menyebabkan penolakan, bukan ID baru |
| `users/get-all`, `users/stats` | Fallback diagnostik tetap dibaca; ID legacy dipisahkan dan permissions pada row directory false | Bukan daftar akun canonical yang dapat diedit/diassign saat database down |
| `userAccess`, competency dan organization access | JSON tidak memberi permission | Legacy flags memerlukan mapping/review manual |
| Access requests JSON | Arsip/lifecycle permohonan tetap kompatibel; grant hanya ke ID PostgreSQL aktif | File bukan authority identity; persistence workflow belum diunifikasi |
| Level Request JSON | Tetap dipakai; request baru mengambil ID dari autentikasi; update dibatasi | Data lama, progress legacy dan reviewer labels tetap perlu P0-3 |
| Backup user JSON | Listing/inspection/archive dipertahankan; restore ke user storage aktif ditolak | Arsip dapat mengandung credential lama; jangan diaktifkan/import tanpa review |
| `import-json-to-postgres.js` | Import user dinonaktifkan; bagian import konten tidak diubah | Belum ada mapping user legacy yang disetujui |
| Static legacy admin secrets | Tidak menghasilkan principal synthetic | Integrasi yang masih memakainya harus beralih melalui rencana identity yang direview |

## Compatibility Notes

- ID PostgreSQL, PK, sequence dan semua record user existing dipertahankan. Tidak ada UUID/provider table baru, merge, renumber atau reassignment.
- Login lokal masih menerima email atau username sebelum autentikasi. Setelah autentikasi, ID menjadi acuan akun. Lookup ambigu ditolak.
- Password existing yang memiliki hash valid tetap diverifikasi tanpa memaksa kebijakan password baru. Semua pembuatan/perubahan password baru menerapkan kebijakan bersama dan mempertahankan spasi.
- Frontend/cache sesi lama yang belum menyimpan ID perlu re-login atau hydrate dari `/api/profile`. Session admin lama tanpa marker role eksplisit perlu re-login. Jabatan tetap tampil sebagai atribut profil.
- JSON-only users tidak dapat login/mengubah akun selama belum ada mapping yang sah. Row directory legacy tidak boleh dipakai sebagai canonical user selector.
- Google linking, format JWT terbitan, masa berlaku token dan mekanisme session existing dipertahankan sebatas perubahan guard keamanan yang dijelaskan.
- Google/config, database credential, deployment/network dan konfigurasi Online tidak diubah. Tidak ada pengiriman data keluar BCL Internal.

## Items Deferred to P0-2

**Authentication & Session Unification**, hanya setelah review: model provider/account linking berbasis identifier Google yang stabil; kebijakan verifikasi kepemilikan local+Google; namespace/collision dan perubahan email; kontrak claim identity, issuer/audience dan validasi seragam; lifecycle/revocation token dan sesi; admin-session authority/store/cookie; throttling/recovery yang konsisten; live Google regression dengan akun uji yang disetujui.

## Items Deferred to P0-3

Verifikasi manual kandidat 15/20, orphan 23, attendee berbasis nama dan seluruh synthetic/alias; inventaris dan mapping historical references; migration/cache/frontend identity yang belum tercakup; konsistensi FK/evidence dan ownership di Profile, My Training, Level Request, Divisi BIM Workspace, KPI/task/worklog/meeting/issues, serta admin/user-management archive. Setiap mapping harus berbukti, dapat direview, dan mempunyai recovery plan; tidak ada data tersebut yang diperbaiki otomatis di P0-1.

**Batas P0-1:** selesai dan CLOSED setelah review user. P0-2 kemudian diotorisasi secara terpisah; perkembangannya ada pada [laporan P0-2](P0_2_Authentication_Session_Unification_Report.md). P0-3, G0 Technology Selection dan implementasi BCL Online tetap belum dimulai.
