# Image Mapping Tool for DOCX to Quiz Questions

Tool untuk mengekstrak gambar dari file DOCX dan memetakannya ke pertanyaan quiz secara otomatis.

## 🎯 Fitur Utama

- ✅ **Auto Extract Images** dari file DOCX
- ✅ **Smart Mapping** gambar ke pertanyaan
- ✅ **Random-safe** - gambar tetap sesuai meski soal diacak
- ✅ **Batch Processing** untuk multiple DOCX files
- ✅ **Report Generation** hasil mapping

## 📋 Prerequisites

```bash
# Install dependencies
npm install

# Atau install global packages jika diperlukan
npm install -g jszip xmldom
```

## 🚀 Cara Penggunaan

### 1. Persiapan File DOCX

Letakkan file DOCX yang berisi soal dan gambar di folder:
```
BC-Learning-Main/elearning-assets/test/
```

**Pastikan folder sudah dibuat** - script akan otomatis membuat folder jika belum ada.

### 2. Jalankan Script

```bash
# Dari direktori scripts
cd BC-Learning-Main/elearning-assets/scripts/

# Install dependencies
npm install

# Jalankan tool
npm start
# atau
node image-mapping-tool.js
```

### 3. Output Files

Script akan menghasilkan beberapa file:

```
BC-Learning-Main/elearning-assets/
├── images/questions/           # Gambar yang diekstrak
│   ├── BIM-Modeller-1_1234567890_abc123.png
│   └── Coordinator-Guide_1234567891_def456.jpg
├── data/
│   ├── image-mappings.json     # Mapping detail
│   └── image-mapping-report.json # Report lengkap
└── js/
    └── enhanced-practice-questions-updated.js # Data soal + gambar
```

## 📊 Proses Kerja

1. **Extract Images**: Membaca file DOCX dan mengekstrak gambar embedded
2. **Generate Unique Names**: Memberi nama unik untuk setiap gambar
3. **Create Mapping**: Memetakan gambar ke pertanyaan berdasarkan ID
4. **Update Questions**: Menambahkan `imageUrl` ke data pertanyaan
5. **Generate Report**: Membuat laporan hasil mapping

## 🔧 Mapping Strategy

### Index-based Mapping (Default)
- Gambar pertama → Pertanyaan pertama
- Gambar kedua → Pertanyaan kedua
- Dan seterusnya

### Advanced Mapping (Future)
- Content similarity matching
- Position-based mapping
- Manual override options

## 📝 File Structure Mapping

```
DOCX File: BIM-Modeller.docx
├── Image 1: diagram1.png → Question ID: bim-mod-001
├── Image 2: flowchart1.jpg → Question ID: bim-mod-002
└── Image 3: interface1.png → Question ID: bim-mod-003

Result:
{
  "questionId": "bim-mod-001",
  "imageUrl": "/elearning-assets/images/questions/BIM-Modeller_1234567890_abc123.png",
  "confidence": "index-based"
}
```

## 🎮 Testing Quiz dengan Gambar

Setelah script selesai:

1. **Replace Questions File**:
   ```bash
   cp enhanced-practice-questions-updated.js enhanced-practice-questions.js
   ```

2. **Test di Browser**:
   - Buka: `http://localhost:5051/BC-Learning-Main/elearning-assets/practice.html`
   - Pilih quiz yang ada gambarnya
   - Gambar akan muncul di atas pertanyaan

## 🛠️ Troubleshooting

### Error: "Cannot find module 'jszip'"
```bash
npm install jszip xmldom
```

### Error: "No DOCX files found"
- Pastikan file DOCX ada di folder `test/`
- Cek permission folder

### Error: "Questions data not found"
- Pastikan file `enhanced-practice-questions.js` ada
- Cek format data di file tersebut

## 📊 Sample Output

```
🎨 Image Mapping Tool for DOCX to Quiz Questions
================================================

🚀 Starting batch image extraction and mapping...
📂 Input directory: BC-Learning-Main/elearning-assets/test
📂 Output directory: BC-Learning-Main/elearning-assets/images/questions

📋 Found 2 DOCX files to process

🔄 Processing DOCX: BIM-Modeller.docx
✅ Extracted 5 images from BIM-Modeller.docx

🔄 Processing DOCX: BIM-Coordinator.docx
✅ Extracted 3 images from BIM-Coordinator.docx

🔍 Mapping 5 images to 30 questions for BIM-Modeller.docx
🔍 Mapping 3 images to 25 questions for BIM-Coordinator.docx

✅ Saved 8 image mappings to image-mappings.json
✅ Generated updated questions file: enhanced-practice-questions-updated.js
📊 Updated 8 questions with images

🎉 Batch processing completed successfully!
```

## 🔄 Integration dengan Quiz System

Quiz system sudah mendukung gambar:

```javascript
// Di enhanced-practice-questions.js
{
  question: "Pertanyaan dengan gambar...",
  imageUrl: "/elearning-assets/images/questions/diagram.png",
  options: ["A", "B", "C", "D"],
  correct: 0
}
```

```javascript
// Di loadCurrentQuestion() - sudah ada
if (question.imageUrl || question.image) {
    questionImage.src = imageUrl;
    questionImageContainer.style.display = 'block';
}
```

## 📈 Performance Tips

- **Image Optimization**: Compress gambar sebelum upload
- **Lazy Loading**: Gambar dimuat saat pertanyaan ditampilkan
- **CDN**: Pertimbangkan CDN untuk gambar besar
- **Format**: Gunakan WebP untuk performa lebih baik

## 🤝 Contributing

Untuk improve mapping accuracy:
- Tambahkan content-based matching
- Implement OCR untuk text extraction
- Add manual mapping interface

---

**Created by:** BCL Learning System Image Mapping Tool v1.0.0
