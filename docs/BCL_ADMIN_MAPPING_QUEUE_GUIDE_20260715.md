# BCL Admin Mapping Queue - Panduan Operasional

Tanggal implementasi: 15 Juli 2026
Konteks: sinkronisasi Pusat Belajar dan Jalur Belajar

## 1. Status implementasi

Admin Mapping Queue telah dibangun sebagai staging workflow yang terpisah dari Jalur Belajar published.

- 337 canonical content telah masuk queue.
- 21 item berstatus `needs_review`.
- 0 item di-auto-approve.
- Publish tetap terkunci.
- `learning_paths`, path versions, final module mappings, equivalence groups, dan unified progress belum diisi.
- Enam path legacy dan Training Batch tidak berubah.

Queue menyimpan keputusan review dan audit trail. Queue tidak langsung membuat materi muncul di Jalur Belajar.

## 2. Cara membuka

1. Restart backend agar route baru dimuat.
2. Login melalui Panel Admin existing.
3. Pilih menu **Mapping Materi**.
4. Alternatif URL langsung:

```text
/pages/sub/adminbcl.html#learning-mapping
```

Seluruh API queue memerlukan session/JWT admin. Request tanpa admin menghasilkan `401` atau `403`.

## 3. Urutan kerja admin

### Prioritas 1 - Needs review

Gunakan filter **Needs review**. Untuk setiap item:

1. Klik materi pada daftar kiri.
2. Klik **Muat preview**.
3. Periksa isi, bukan hanya filename.
4. Koreksi judul tampilan, kategori, atau BIM level bila dibutuhkan.
5. Pilih keputusan final.
6. Isi catatan pemeriksaan.
7. Simpan draft atau approve.

Item dengan keputusan `needs_review` tidak dapat di-approve. Ubah dahulu ke keputusan yang dapat dipertanggungjawabkan.

### Prioritas 2 - Required dan alternate

Untuk `required`, `elective`, dan `alternate`, target berikut wajib diisi:

- Jalur Belajar;
- module;
- urutan kandidat jika sudah diketahui.

`Required` harus diverifikasi lebih ketat karena nantinya dapat menjadi syarat penyelesaian module. `Alternate` belum mengaktifkan equivalence group; keputusan tersebut tetap menunggu duplicate/coverage review.

### Prioritas 3 - Library only dan retired

- `library_only`: tetap tersedia di Pusat Belajar, tidak masuk Jalur Belajar.
- `retired`: tidak direkomendasikan untuk pemakaian baru, tetapi file tidak dihapus.

## 4. Tombol dan status

| Tindakan | Efek |
|---|---|
| Simpan draft | Menyimpan keputusan tanpa final approval |
| Approve review | Mencatat reviewer dan waktu approval; tetap belum publish |
| Reject | Menolak kandidat mapping dengan catatan wajib |
| Refresh | Mengambil revision terbaru dan menghindari overwrite reviewer lain |

Queue memakai optimistic revision. Jika dua admin membuka item yang sama, penyimpanan dari revision lama ditolak dengan `409`; admin harus refresh dan mengecek perubahan terbaru.

## 5. Audit trail

Setiap item memiliki audit trail append-only yang mencatat:

- tindakan;
- actor admin;
- waktu;
- state sebelum perubahan;
- state setelah perubahan.

Seed awal juga dicatat sebagai event, sehingga asal kandidat Phase 0 tetap dapat ditelusuri.

## 6. API admin

```text
GET /api/admin/learning-mapping/summary
GET /api/admin/learning-mapping/options
GET /api/admin/learning-mapping/queue
GET /api/admin/learning-mapping/queue/:contentId/events
PUT /api/admin/learning-mapping/queue/:contentId
```

Filter queue:

```text
query, reviewStatus, decision, sourceType, pathId, limit, offset
```

Tidak tersedia endpoint publish pada tahap ini.

## 7. Database dan migration

Tabel staging:

- `learning_mapping_review_queue`
- `learning_mapping_review_events`

Perintah:

```powershell
npm run migrate:learning-mapping-queue:dry-run
npm run migrate:learning-mapping-queue
npm run seed:learning-mapping-queue:dry-run
npm run seed:learning-mapping-queue
npm run smoke:learning-mapping-queue
npm run check:unified-learning-schema
```

Seed aman dijalankan ulang: payload kandidat diperbarui, tetapi keputusan admin existing tidak ditimpa dan tidak di-auto-approve.

## 8. Guardrail

Admin tidak boleh:

- menganggap approval queue sama dengan publish path;
- menyetujui materi hanya berdasarkan judul;
- mengaktifkan alternate completion tanpa pemeriksaan checksum/coverage;
- menghapus atau memindahkan source file dari queue;
- mengubah Training Batch agar menunjuk draft taxonomy;
- mengaktifkan DB path read atau progress dual-write pada tahap ini.

## 9. Langkah berikutnya

Setelah review cukup matang:

1. import enam path legacy sebagai versi draft dengan ID tetap;
2. buat dua path baru sebagai draft;
3. konversi hanya queue `approved` menjadi `module_content_mappings` draft;
4. buat equivalence group dari duplicate/alternate yang benar-benar terverifikasi;
5. preview parity dan publish readiness;
6. implementasikan publish workflow dengan confirmation dan audit terpisah.

Sampai langkah tersebut selesai, consumer Pusat Belajar dan Jalur Belajar existing tetap menggunakan mekanisme lama.
