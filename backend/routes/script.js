let currentPath = ""; // Menyimpan path folder saat ini
window.currentPath = "";

function previewFile(filePath) {
    console.log("Fetching file:", filePath);

    // Pastikan path tidak ada karakter aneh & hapus karakter tak terlihat
    filePath = filePath.replace(/\x05|\x01/g, "").trim();
    console.log("✅ Setelah membersihkan:", filePath);

    let fileURL = `${window.location.origin}/api/file?path=${encodeURIComponent(filePath)}`;
    console.log("🔗 File URL:", fileURL);

    let ext = filePath.split('.').pop().toLowerCase();
    let previewContainer = document.getElementById("filePreview");

    // Jika container tidak ditemukan, jangan lanjutkan (mencegah error di halaman lain)
    if (!previewContainer) {
        console.warn("⚠️ Tidak ada elemen #filePreview, preview dibatalkan.");
        return;
    }

    let previewHTML = "";

    if (["pdf"].includes(ext)) {
        previewHTML = `<embed src="${fileURL}" type="application/pdf" width="100%" height="500px"/>`;
    } else if (["mp4", "avi", "wmv"].includes(ext)) {
        previewHTML = `<video id="videoPreview" controls width="100%">
            <source src="${fileURL}" type="video/${ext}">
            Browser Anda tidak mendukung pemutaran video.
        </video>`;
    } else if (["jpg", "jpeg", "png", "gif"].includes(ext)) {
        previewHTML = `<img src="${fileURL}" class="img-fluid" alt="Preview Image"/>`;
    } else if (["txt"].includes(ext)) {
        previewHTML = `<iframe src="${fileURL}" width="100%" height="300px"></iframe>`;
    } else {
        previewHTML = `<p class="text-danger text-center">Preview tidak tersedia untuk file ini.</p>`;
    }

    previewContainer.innerHTML = previewHTML;
    previewContainer.style.display = "block";
}


// Fungsi untuk mengambil folder & file dalam folder tertentu
function fetchFolder(path = "") {
    console.log("Fetching folder data for path:", path);

    fetch(`${window.location.origin}/api/get-folder?path=${encodeURIComponent(path)}`)
        .then(response => response.json())
        .then(data => {
            console.log("Data folder dari backend:", data);

            //let folderGrid = document.getElementById("folderGrid").querySelector(".row");
            let backButton = document.getElementById("backButton");

            if (!folderGrid) {
                console.error("Elemen folderGrid tidak ditemukan!");
                return;
            }

            folderGrid.innerHTML = ""; // Bersihkan daftar sebelumnya
            window.currentPath = path;

            // Tampilkan tombol "Kembali" jika tidak berada di root
            backButton.style.display = window.currentPath ? "block" : "none";

            let row = document.createElement("div");
            row.className = "row";

            // **Tampilkan folder (jika ada)**
            data.folders.forEach(folder => {
                let col = document.createElement("div");
                col.className = "col-lg-3 col-md-4 col-sm-6";

                col.innerHTML = `
                    <div class="content shadow p-3 mb-2 text-center" onclick="fetchFolder('${window.currentPath ? window.currentPath + '/' : ''}${folder.name}')">
                        <img src="img/icons/folder-icon.png" class="img-fluid" alt="Folder">
                        <h5 class="mt-2">${folder.name}</h5>
                    </div>
                `;

                row.appendChild(col);
            });

            // **Filter hanya file dengan ekstensi tertentu**
            const allowedExtensions = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "mp4", "avi", "wmv", "dwg", "rvt", "rfa", "txt"];
            let filteredFiles = data.files.filter(file => {
                let ext = file.name.split(".").pop().toLowerCase();
                return allowedExtensions.includes(ext);
            });

            // **Tampilkan file yang sudah difilter**
            filteredFiles.forEach(file => {
                let col = document.createElement("div");
                col.className = "col-lg-3 col-md-4 col-sm-6";

                let fullFilePath = `${window.currentPath}/${file.name}`
                    .replace(/\/\//g, "/")
                    .trim();

                console.log("✅ Cleaned Full File Path:", fullFilePath);

                col.innerHTML = `
                    <div class="content shadow p-3 mb-2 text-center" onclick="previewFile('${fullFilePath}')">
                        <img src="img/icons/file-icon.png" class="img-fluid" alt="File">
                        <h5 class="mt-2">${file.name}</h5>
                    </div>
                `;

                row.appendChild(col);
            });

            folderGrid.appendChild(row);
        })
        .catch(error => console.error("Fetch error:", error));
}


// **Tambahkan fungsi "Kembali"**
function goBack() {
    if (!window.currentPath) return;

    let pathParts = window.currentPath.split("/").filter(p => p);
    pathParts.pop();

    let newPath = pathParts.join("/");
    fetchFolder(newPath);
}

// **Panggil fetchFolder() saat halaman dimuat**
document.addEventListener("DOMContentLoaded", function () {
    fetchFolder();
});

//Fungsi search engine BCL
function searchFiles() {
    let query = document.getElementById("searchInput").value.toLowerCase();
    console.log("Mencari:", query);

    let folderItems = document.querySelectorAll(".content h5"); // Ambil semua nama folder
    let fileItems = document.querySelectorAll(".content h5"); // Ambil semua nama file

    let allItems = [...folderItems, ...fileItems]; // Gabungkan folder & file dalam satu pencarian

    allItems.forEach(item => {
        let text = item.innerText.toLowerCase();
        let card = item.closest(".col-lg-3, .col-md-4, .col-sm-6"); // Ambil elemen card utama

        if (text.includes(query)) {
            card.style.display = "block"; // Tampilkan jika cocok
        } else {
            card.style.display = "none"; // Sembunyikan jika tidak cocok
        }
    });
}



// Menjalankan pencarian otomatis saat pengguna mengetik
document.getElementById("searchInput").addEventListener("input", searchFiles);
