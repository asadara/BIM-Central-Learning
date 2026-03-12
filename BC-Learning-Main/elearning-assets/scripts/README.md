# Image Mapping Tool for DOCX to Quiz Questions

Tool untuk mengekstrak gambar dari file DOCX dan memetakan gambar ke pertanyaan quiz secara lebih akurat.

## Fitur Utama

- Auto extract images dari file DOCX.
- Structure-aware mapping dari blok soal DOCX ke bank soal.
- Text matching memakai stem soal dan opsi jawaban.
- Stable filenames berbasis `docx + questionId`.
- Report generation untuk review hasil mapping.

## Prerequisites

```bash
npm install
```

Dependencies utama:

```bash
npm install jszip xmldom
```

## Cara Penggunaan

1. Letakkan file DOCX sumber di:

```text
BC-Learning-Main/elearning-assets/test/
```

2. Jalankan tool dari folder `scripts`:

```bash
cd BC-Learning-Main/elearning-assets/scripts
npm install
node image-mapping-tool.js
```

## Output

Tool akan menghasilkan:

```text
BC-Learning-Main/elearning-assets/
|-- images/questions/
|   |-- soal-basic-intermediate-advance-permodelan__revit-fund-001__1.png
|   `-- soal-post-test-sesi-1-2-revit-basic-bridge__revit-fund-005__1.png
|-- data/
|   |-- image-mapping-report.json
|   `-- image-mappings-template.json
`-- js/
    `-- enhanced-practice-questions-updated.js
```

## Proses Kerja

1. Parse struktur DOCX: paragraf, numbering, dan relasi gambar.
2. Bentuk blok soal dari stem, opsi, dan gambar yang berdekatan.
3. Cocokkan blok DOCX ke `enhanced-practice-questions.js` memakai similarity teks.
4. Ekstrak hanya gambar yang terpakai dengan nama file stabil.
5. Tulis `imageUrl`, `imageUrls`, dan metadata `imageMapping` ke file output.
6. Buat report untuk low-confidence match dan soal bergambar yang belum punya pasangan.

## Skema Mapping

Skema lama:

- `gambar ke-1 -> soal ke-1`
- rentan salah saat DOCX punya gambar tambahan, urutan berubah, atau ada soal tanpa gambar

Skema baru:

- `gambar -> blok soal tempat gambar itu muncul di DOCX`
- `blok soal -> pertanyaan bank soal terdekat berdasarkan similarity teks`
- unresolved cases masuk report untuk review manual

## Review File

`image-mapping-report.json` berisi:

- jumlah soal yang berhasil dicocokkan
- jumlah gambar yang diekstrak
- low-confidence matches
- unresolved image questions

`image-mappings-template.json` berisi:

- daftar saran mapping
- daftar soal yang belum ketemu pasangannya
- data yang bisa dipakai untuk override manual

## Contoh Struktur Data

```javascript
{
  question: "Pertanyaan dengan gambar...",
  imageUrl: "/elearning-assets/images/questions/soal-basic__revit-fund-001__1.png",
  imageUrls: [
    "/elearning-assets/images/questions/soal-basic__revit-fund-001__1.png"
  ],
  imageMapping: {
    sourceDocx: "SOAL BASIC, INTERMEDIATE, ADVANCE PERMODELAN.docx",
    confidence: "high",
    score: 0.97,
    matchedDocxQuestionIndex: 1
  },
  options: ["A", "B", "C", "D"],
  correctAnswer: 0
}
```

## Testing

Setelah file output terbentuk:

1. Review `data/image-mapping-report.json`.
2. Review `data/image-mappings-template.json` untuk kasus unresolved.
3. Jika hasil sudah sesuai, gunakan `enhanced-practice-questions-updated.js` sebagai sumber bank soal.
4. Test di browser pada `practice.html`.

## Troubleshooting

Jika ada soal bergambar yang belum termap:

- cek apakah soal tersebut memang sudah ada di `enhanced-practice-questions.js`
- cek apakah teks soal di bank soal terlalu berbeda dari teks di DOCX
- cek `unresolvedImageQuestions` di report

Jika module tidak ditemukan:

```bash
npm install jszip xmldom
```
