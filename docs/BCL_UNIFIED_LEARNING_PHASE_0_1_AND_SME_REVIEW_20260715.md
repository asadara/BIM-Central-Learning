# BCL Unified Learning - Hasil Phase 0-1 dan Review SME

Tanggal verifikasi: 15 Juli 2026
Blueprint induk: `docs/BCL_PUSAT_BELAJAR_JALUR_BELAJAR_SYNC_BLUEPRINT_20260714.md`

## 1. Tujuan dan batas perubahan

Phase 0-1 menyiapkan fondasi sinkronisasi tanpa mengubah perilaku menu TRAINING yang dipakai user. Pusat Belajar tetap menjadi sumber katalog, sedangkan Jalur Belajar belum dipindahkan ke database dan belum memakai mapping kandidat.

Perubahan ini sengaja tidak:

- mengubah UI Pusat Belajar atau Jalur Belajar;
- mengubah enam ID learning path lama;
- mengimpor learning path sebagai versi draft (itu Phase 2);
- menulis progres ke tabel unified;
- mengubah `training_batches`, `user_progress`, practice, exam, certificate, atau evidence;
- memindahkan, menyalin, mengganti nama, atau menghapus video/PDF;
- mem-publish mapping atau equivalence candidate.

## 2. Hasil inventory canonical

Catalog adapter membaca service existing, bukan membuat sumber konten baru.

| Tipe | Source existing | Canonical count | Format ID |
|---|---|---:|---|
| Video | tutorial catalog | 311 | `video:<source-id>` |
| PDF | learning materials source | 23 | `pdf:<source-id>` |
| Internal reading page | reference pada JSON path legacy | 3 | `page:<slug>` |
| Total adapter | gabungan | 337 | unik dan deterministik |

Baseline SME pada 334 aset Pusat Belajar (video + PDF):

| Keputusan kandidat | Count |
|---|---:|
| Required | 106 |
| Elective | 171 |
| Library only | 32 |
| Alternate | 4 |
| Needs review | 21 |
| Total | 334 |

Tiga internal reading page existing tetap dicatat sebagai `required` candidate pada module legacy masing-masing. Karena itu snapshot unified berisi 109 required dan total 337 keputusan.

Artefak machine-readable berada di `backend/elearning/learning-mapping-candidates.json`. Setiap content ID tepat memiliki satu keputusan utama, `publishable=false`, reviewer kosong, dan tidak ada auto-publish.

## 3. Temuan SME yang harus dibawa ke Phase 2

- 21 item `needs_review` diblokir dari required publish sampai judul/isi diperiksa.
- Terdapat tujuh equivalence/duplicate candidate. Kesamaan judul atau ukuran belum cukup; checksum atau visual review tetap wajib.
- Empat alternate candidate adalah dua rekaman lengkap AutoCAD, satu salinan Revit central-file, dan satu salinan Azure Timeliner.
- AVI tetap dapat menjadi catalog candidate, tetapi tidak boleh dijadikan required published sebelum compatibility playback lulus.
- Mayoritas metadata video belum lengkap: BIM level, description, duration, dan tags perlu enrichment terpisah.

Aturan penting: `required|elective` adalah requirement mapping; `candidate|approved|needs_review|rejected|retired` adalah status review; `mapped|library_only|needs_review|retired` adalah disposisi registry. Alternate tidak menjadi requirement kedua dan nantinya harus dimodelkan lewat equivalence group agar progress tidak double-count.

## 4. Implementasi Phase 1

Schema additive berikut telah dibuat di PostgreSQL lokal:

1. `learning_content_registry`
2. `learning_paths`
3. `learning_path_versions`
4. `learning_path_modules`
5. `module_content_mappings`
6. `content_equivalence_groups`
7. `content_equivalence_members`
8. `user_content_progress`

Migration tercatat sebagai `20260715_unified_learning_phase_1`. Registry telah di-seed sebanyak 337 row tanpa memindahkan source file. Tidak ada FK dari `training_batches.learning_path_id` ke tabel baru karena data legacy juga memuat path non-resmi seperti `SMOKE-PATH`.

Endpoint additive tersedia di namespace `/api/learning` hanya bila `UNIFIED_LEARNING_CATALOG_ENABLED=true`:

- `GET /api/learning/catalog`
- `GET /api/learning/catalog/summary`
- `GET /api/learning/catalog/:contentId`

Flag default tetap `false`; `.env` runtime tidak diubah. Dua flag reservasi berikut juga default mati dan belum dipakai untuk cutover: `UNIFIED_LEARNING_DB_PATHS_ENABLED` dan `UNIFIED_LEARNING_PROGRESS_ENABLED`.

## 5. Verifikasi dan acceptance evidence

- Adapter parity: 311 video, 23 PDF, 3 page; seluruh canonical ID unik.
- Source set video adapter sama dengan tutorial source pada run yang sama.
- Source set PDF adapter sama dengan learning-material source pada run yang sama.
- Type filter, pagination, detail resolution, deterministic IDs, dan non-leak absolute path lulus smoke.
- Delapan tabel unified dan JSONB contract lulus checker read-only.
- `users`, `user_progress`, `training_batches`, dan `learning_activity_events` tetap ada.
- `training_batches` tidak memperoleh FK baru ke unified path.
- Candidate decisions mencakup 100% canonical content dan semuanya tidak publishable.
- Tujuh equivalence candidate tetap berstatus review-only.

Catatan: database lokal tidak memiliki tabel optional `learning_materials`; loader existing memberi warning lalu tetap berhasil memakai source JSON/filesystem/manual-book. Ini adalah perilaku fallback existing dan tidak mengurangi parity 23 PDF.

## 6. Operasional dan rollback

Perintah verifikasi:

```powershell
npm run review:learning-mapping
npm run smoke:unified-learning
npm run check:unified-learning-schema
```

Migration dan registry sync bersifat eksplisit:

```powershell
npm run migrate:unified-learning:dry-run
npm run migrate:unified-learning
npm run sync:unified-learning-registry:dry-run
npm run sync:unified-learning-registry
```

Rollback aplikasi Phase 1 cukup memastikan `UNIFIED_LEARNING_CATALOG_ENABLED=false` dan restart backend. Tabel/registry tidak perlu dihapus karena tidak menjadi consumer existing. Jangan drop tabel sebagai langkah rollback operasional.

## 7. Status dan next safe step

Phase 0 dan Phase 1 selesai. Review SME ini masih berupa keputusan kandidat berbasis inventory/metadata, bukan approval publish per item.

Next safe step adalah Phase 2 dalam perubahan terpisah:

1. review 21 item dan tujuh duplicate groups oleh pemilik domain;
2. gunakan Admin Mapping Queue untuk menyimpan keputusan dan audit review;
3. import enam path legacy ke DB sebagai versi `draft` dengan ID tetap;
4. tambahkan `bim-modeller-core` dan `civil-infrastructure-modelling` sebagai draft;
5. konversi hanya review approved menjadi draft module mapping;
6. preview parity sebelum publish;
7. jangan mengaktifkan DB path read atau progress dual-write sebelum contract Phase 2 lulus.

Dokumen ini adalah guardrail implementasi: fondasi yang ada harus dipakai secara additive, dan consumer existing tidak boleh diarahkan ke schema baru hanya karena tabel dan catalog endpoint sudah tersedia.

## 8. Update Admin Mapping Queue - 15 Juli 2026

Tahap awal Phase 2 telah dilanjutkan dengan Admin Mapping Queue draft-only. Queue menyimpan 337 kandidat dan audit trail tanpa mengisi path version, final module mapping, equivalence group, atau unified progress.

Panduan operasional admin tersedia di `docs/BCL_ADMIN_MAPPING_QUEUE_GUIDE_20260715.md`.

Status setelah implementasi queue:

- 337 queue item;
- 337 initial seed audit event;
- 21 needs-review;
- 0 approved;
- publish tetap disabled;
- path draft import dan publish workflow belum dimulai.
