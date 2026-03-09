window.onload = function () {
    let spinner = document.getElementById("spinner");
    if (spinner) {
        spinner.classList.remove("show"); // Hapus class Bootstrap yang membuatnya tetap muncul
        setTimeout(() => { spinner.style.display = "none"; }, 500); // Sembunyikan setelah 500ms
    }
};



document.addEventListener("DOMContentLoaded", () => {
    fetchPDFs();
});

function fetchPDFs() {
    let spinner = document.getElementById("spinner");
    //spinner.style.display = "block"; // Tampilkan spinner saat mulai fetch

    fetch("${window.location.origin}/api/pdf") // Pastikan API ini berjalan
        .then(response => response.json())
        .then(pdfs => {
            spinner.style.display = "none"; // Sembunyikan spinner setelah data diambil
            console.log("📄 Data PDF dari API:", pdfs);

            const container = document.getElementById("pdfContainer");
            const searchResults = document.getElementById("searchResults"); // Ambil elemen jumlah hasil di sini

            if (!container) {
                console.error("❌ Elemen pdfContainer tidak ditemukan!");
                return;
            }

            container.innerHTML = ""; // Bersihkan sebelum menampilkan

            if (!pdfs || pdfs.length === 0) {
                container.innerHTML = "<p>Tidak ada dokumen PDF tersedia.</p>";
                searchResults.textContent = "Hasil ditemukan: 0"; // Perbarui jumlah hasil lagi
                return;
            }

            pdfs.forEach(pdf => {
                let fileUrl = pdf.path; // Gunakan path lengkap dari backend

                console.log("🔗 Path PDF yang dikirim:", fileUrl); // Debugging   

                let card = document.createElement("div");
                card.className = "pdf-card";
                
                card.innerHTML = `
                    <div class="card-content">
                        <img src="../img/icons/pdf-icon.png" alt="PDF" class="pdf-thumbnail" onclick="previewPDF('${pdf.path}')">
                        <div class="pdf-info">
                            <p class="pdf-title">${pdf.name}</p>
                            <p class="pdf-size">Size: ${pdf.size}</p>
                        </div>
                    </div>
                `;
                container.appendChild(card);
                console.log("Card berhasil ditambahkan:", card);
            });
            // **Perbarui jumlah hasil yang ditemukan**
            searchResults.textContent = `Hasil ditemukan: ${pdfs.length}`;
        })
        .catch(error => {
            //spinner.style.display = "none"; // Sembunyikan meskipun fetch gagal
            console.error("❌ Gagal mengambil daftar PDF:", error);
    });
}

function previewPDF(pdfPath) {
    console.log("📄 Memunculkan preview untuk PDF:", pdfPath);
    previewFile(pdfPath); // Pakai preview, bukan buka tab baru
}


function searchFiles() {
    const searchInput = document.getElementById("searchInput").value.toLowerCase();
    console.log("🔍 Mencari PDF dengan kata kunci:", searchInput); // Debugging

    const pdfCards = document.querySelectorAll(".pdf-card");
    let count = 0;

    pdfCards.forEach(card => {
        const title = card.querySelector(".pdf-title").textContent.toLowerCase();
        if (title.includes(searchInput)) {
            card.style.display = "block"; // Tampilkan jika cocok
            count++;
        } else {
            card.style.display = "none"; // Sembunyikan jika tidak cocok
        }
    });

    document.getElementById("searchResults").textContent = `Hasil ditemukan: ${count}`;
}



function sortPDF() {
    const sortOption = document.getElementById("sortFilter").value;
    console.log("📌 Mengurutkan berdasarkan:", sortOption); // Debugging

    const container = document.getElementById("pdfContainer");
    let pdfCards = Array.from(document.querySelectorAll(".pdf-card"));

    pdfCards.sort((a, b) => {
        const nameA = a.querySelector(".pdf-title").textContent.toLowerCase();
        const nameB = b.querySelector(".pdf-title").textContent.toLowerCase();
        const sizeA = parseFloat(a.querySelector(".pdf-size").textContent.replace("Size: ", "").replace(" MB", ""));
        const sizeB = parseFloat(b.querySelector(".pdf-size").textContent.replace("Size: ", "").replace(" MB", ""));

        if (sortOption === "name-asc") return nameA.localeCompare(nameB);
        if (sortOption === "name-desc") return nameB.localeCompare(nameA);
        if (sortOption === "size-asc") return sizeA - sizeB;
        if (sortOption === "size-desc") return sizeB - sizeA;
    });

    container.innerHTML = ""; // Hapus daftar lama
    pdfCards.forEach(card => container.appendChild(card)); // Tambahkan yang sudah diurutkan
}
