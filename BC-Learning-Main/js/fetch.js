document.addEventListener("DOMContentLoaded", function () {
    fetchFolder(""); // Memuat folder utama saat halaman pertama kali dimuat
});

function fetchFolder(path) {
    // Sembunyikan container awal agar tidak ada duplikasi
    document.getElementById("content").style.display = "none";

    // Hindari duplikasi dengan mengosongkan folderGrid sebelum menampilkan isi baru
    document.getElementById("folderGrid").innerHTML = "";

    fetch(`/api/get-folder?path=${encodeURIComponent(path)}`)
        .then(response => response.json())
        .then(data => {
            const folderGrid = document.getElementById("folderGrid");
            folderGrid.innerHTML = ""; // Mencegah duplikasi
            data.forEach(item => {
                const div = document.createElement("div");
                div.className = "col-md-3";
                div.innerHTML = `
                    <div class="card p-3">
                        <div onclick="${item.isFolder ? `fetchFolder('${item.path}')` : `previewFile('${item.path}')`}">
                            ${item.isFolder ? "📁" : "📄"} ${item.name}
                        </div>
                    </div>`;
                folderGrid.appendChild(div);
            });
        })
        .catch(error => console.error("Gagal mengambil data folder:", error));
}

function previewFile(filePath) {
    document.getElementById("filePreview").src = `/preview?file=${encodeURIComponent(filePath)}`;
    document.getElementById("previewContainer").style.display = "block";
}

function goBack() {
    history.back(); // Kembali ke halaman sebelumnya
}
