const baseURL = `http://${window.location.hostname}:5151`;

window.currentPath = "";

function updateBreadcrumb() {
    let breadcrumbContainer = document.getElementById("breadcrumb").querySelector(".breadcrumb");
    breadcrumbContainer.innerHTML = `<li class="breadcrumb-item"><a href="#" onclick="fetchFolder('')">Home</a></li>`;

    if (!window.currentPath) return;

    let pathParts = window.currentPath.split("/");
    let currentPath = "";

    pathParts.forEach((part, index) => {
        currentPath += (index > 0 ? "/" : "") + part;
        breadcrumbContainer.innerHTML += `<li class="breadcrumb-item"><a href="#" onclick="fetchFolder('${currentPath}')">${part}</a></li>`;
    });
}


function previewFile(filePath) {
    let previewContainer = document.getElementById("previewContainer");
    let filePreview = document.getElementById("filePreview");

    if (!previewContainer) {
        return;
    }

    if (!filePath || filePath.trim() === "") {
        previewContainer.style.display = "none";
        filePreview.src = "";
        previewContainer.innerHTML = ""; // Hapus isi preview
        return;
    }

    let ext = filePath.split('.').pop().toLowerCase();
    let fileURL = `http://${window.location.hostname}:5151/api/file?path=${encodeURIComponent(filePath)}`;

    // Reset isi preview
    previewContainer.innerHTML = "";

    if (["pdf"].includes(ext)) {
        previewContainer.innerHTML = `<iframe src="${fileURL}" class="preview-frame"></iframe>`;
    } else if (["mp4", "avi", "wmv", "mov"].includes(ext)) {
        previewContainer.innerHTML = `
            <video controls width="100%">
                <source src="${fileURL}" type="video/${ext}">
                Browser Anda tidak mendukung pemutaran video.
            </video>`;
    } else if (["jpg", "jpeg", "png", "gif"].includes(ext)) {
        previewContainer.innerHTML = `<img src="${fileURL}" class="img-fluid" alt="Preview Image"/>`;
    } else if (["txt"].includes(ext)) {
        previewContainer.innerHTML = `<iframe src="${fileURL}" width="100%" height="300px"></iframe>`;
    } else {
        previewContainer.innerHTML = `<p class="text-danger text-center">Preview tidak tersedia untuk file ini.</p>`;
    }

    previewContainer.style.display = "block";
}

function hidePreview() {
    const previewContainer = document.getElementById("previewContainer"); // Sesuaikan ID jika berbeda
    if (previewContainer) {
        previewContainer.style.display = "none";
        previewContainer.innerHTML = ""; // Hapus isi preview
    }
}

// Fungsi untuk mengambil folder & file dalam folder tertentu
function fetchFolder(path = "") {
    let folderGrid = document.getElementById("folderGrid");

    if (!folderGrid) {
        return;
    }

    // ✅ Tambahan validasi sebelum fetch
    if (typeof path !== "string" && path !== "") {
        console.warn("❗ Path tidak valid, fetch dibatalkan");
        return;
    }



    fetch(`http://${window.location.hostname}:5151/api/get-folder?path=${encodeURIComponent(path)}`)
        .then(response => {
            if (!response.ok) throw new Error("Gagal mengambil data folder");
            return response.json();
        })
        .then(data => {

            let backButton = document.getElementById("backButton");
            folderGrid.innerHTML = ""; // Bersihkan daftar sebelumnya
            window.currentPath = path;

            // 🔥 Update breadcrumb setiap kali pindah folder
            updateBreadcrumb();

            // Tampilkan tombol "Kembali" jika tidak berada di root
            backButton.style.display = window.currentPath ? "block" : "none";
            hidePreview(); // 🔥 Sembunyikan preview saat folder berubah

            let row = document.createElement("div");
            row.className = "row";

            // **🔍 Tampilkan folder**
            data.folders.forEach(folder => {
                let col = document.createElement("div");
                col.className = "col-lg-3 col-md-4 col-sm-6";

                col.innerHTML = `
                    <div class="content shadow p-3 mb-2 text-center" 
                         onclick="fetchFolder('${window.currentPath ? window.currentPath + '/' : ''}${folder.name}')">
                        <img src="/img/icons/folder-icon.png" class="img-fluid" alt="Folder">
                        <h5 class="mt-2">${folder.name}</h5>
                    </div>
                `;

                row.appendChild(col);
            });

            // **📌 Filter file hanya dengan ekstensi tertentu**
            const allowedExtensions = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "mp4", "avi", "wmv", "dwg", "rvt", "rfa", "txt", "zip", "jpg", "jpeg"];
            let filteredFiles = data.files.filter(file => {
                let ext = file.name.split(".").pop().toLowerCase();
                return allowedExtensions.includes(ext);
            });

            // **🖼️ Tampilkan file dengan ikon yang sesuai**
            filteredFiles.forEach(file => {
                let col = document.createElement("div");
                col.className = "col-lg-3 col-md-4 col-sm-6";

                let fullFilePath = `${window.currentPath}/${file.name}`
                    .replace(/\/\//g, "/")
                    .trim();


                let fileExt = file.name.split('.').pop().toLowerCase();
                let iconPath = "/img/icons/file-icon.png"; // Default

                if (["pdf"].includes(fileExt)) {
                    iconPath = "/img/icons/pdf-icon.png";
                } else if (["mp4", "avi", "wmv", "mkv", "mov"].includes(fileExt)) {
                    iconPath = "/img/icons/video-icon.png";
                } else if (["jpg", "jpeg", "png", "gif"].includes(fileExt)) {
                    iconPath = "/img/icons/image-icon.png";
                } else if (["doc", "docx"].includes(fileExt)) {
                    iconPath = "/img/icons/doc-icon.png";
                } else if (["xls", "xlsx"].includes(fileExt)) {
                    iconPath = "/img/icons/excel-icon.png";
                } else if (["ppt", "pptx"].includes(fileExt)) {
                    iconPath = "/img/icons/ppt-icon.png";
                } else if (["mpp"].includes(fileExt)) {
                    iconPath = "/img/icons/project-icon.png";
                } else if (["rvt"].includes(fileExt)) {
                    iconPath = "/img/icons/revit-icon.png";
                } else if (["rfa"].includes(fileExt)) {
                    iconPath = "/img/icons/revit-icon.png";
                } else if (["txt"].includes(fileExt)) {
                    iconPath = "/img/icons/txt-icon.png";
                } else if (["dwg"].includes(fileExt)) {
                    iconPath = "/img/icons/dwg-icon.png";
                } else if (["zip"].includes(fileExt)) {
                    iconPath = "/img/icons/zip-icon.png";
                }

                col.innerHTML = `
                    <div class="content shadow p-3 mb-2 text-center" onclick="previewFile('${fullFilePath}')">
                        <img src="${iconPath}" class="img-fluid" alt="File">
                        <h5 class="mt-2">${file.name}</h5>
                    </div>
                `;

                row.appendChild(col);
            });

            // ✅ **Pastikan elemen benar-benar masuk ke folderGrid**
            folderGrid.appendChild(row);
        })
        .catch(error => console.error("❌ Fetch error:", error));
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