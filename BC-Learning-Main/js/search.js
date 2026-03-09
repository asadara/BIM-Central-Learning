
// ✅ Fixed: Better search functionality for BCL application

//✅ Fixed: Combined and improved search functions
async function fetchFiles(query) {
    // Get query from parameter if not provided
    if (!query) {
        const urlParams = new URLSearchParams(window.location.search);
        query = urlParams.get('q');
    }

    if (!query || query.trim() === '') {
        console.warn("⚠️ Query pencarian kosong, tidak mengirim request ke backend.");
        showNoResults("Masukkan kata kunci pencarian.");
        return;
    }

    console.log("🔍 Searching for:", query);

    try {
        // Add loading state
        showLoadingState();

        const response = await fetch(`http://${window.location.hostname}:5151/api/search?q=${encodeURIComponent(query)}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token") || ''}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("✅ Search results:", data);
        displaySearchResults(data);

    } catch (error) {
        console.error("❌ Search failed:", error);
        showErrorState(error.message);
    }
}

// ✅ New helper functions for better UX
function showLoadingState() {
    const resultContainer = document.getElementById("searchResults");
    if (resultContainer) {
        resultContainer.innerHTML = `
            <div class="text-center p-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="sr-only">Loading...</span>
                </div>
                <p class="mt-2">Mencari files...</p>
            </div>
        `;
    }
}

function showNoResults(message) {
    const resultContainer = document.getElementById("searchResults");
    if (resultContainer) {
        resultContainer.innerHTML = `<p class='text-center text-warning'>${message}</p>`;
    }
}

function showErrorState(errorMessage) {
    const resultContainer = document.getElementById("searchResults");
    if (resultContainer) {
        resultContainer.innerHTML = `
            <div class="alert alert-danger text-center" role="alert">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Error:</strong> ${errorMessage}
                <br><small>Silakan coba lagi atau hubungi administrator.</small>
            </div>
        `;
    }
}

// ✅ Fixed: Proper displaySearchResults function
function displaySearchResults(data) {
    const resultContainer = document.getElementById("searchResults");
    if (!resultContainer) {
        console.error("❌ Element searchResults tidak ditemukan!");
        return;
    }

    // Clear previous results
    resultContainer.innerHTML = "";

    if (!data.files || data.files.length === 0) {
        showNoResults("Tidak ada hasil ditemukan untuk pencarian ini.");
        return;
    }

    console.log(`✅ Displaying ${data.files.length} search results`);

    data.files.forEach(file => {
        const fileCard = `
            <div class="col-lg-3 col-md-4 col-sm-6 mb-3">
                <div class="card shadow-sm h-100">
                    <div class="card-body text-center">
                        <img src="img/icons/file-icon.png" class="img-fluid mb-2" alt="File" style="max-height: 50px;">
                        <h6 class="card-title">${file.name || 'Unknown'}</h6>
                        <p class="card-text text-muted small">${file.path || ''}</p>
                        <button class="btn btn-primary btn-sm open-file" data-path="${file.fullPath}" data-filename="${file.name}">
                            <i class="fas fa-folder-open"></i> Buka
                        </button>
                    </div>
                </div>
            </div>
        `;
        resultContainer.innerHTML += fileCard;
    });

    // Reattach event listeners for new elements
    attachFileOpenListeners();
}

// ✅ Fixed: Separate function for file open listeners
function attachFileOpenListeners() {
    document.querySelectorAll(".open-file").forEach(button => {
        button.removeEventListener("click", handleFileOpen); // Remove existing
        button.addEventListener("click", handleFileOpen);
    });
}

function handleFileOpen(event) {
    event.preventDefault();
    const filePath = event.currentTarget.getAttribute("data-path");
    const fileName = event.currentTarget.getAttribute("data-filename");

    if (filePath) {
        console.log(`📂 Opening file: ${fileName}`);
        const fileUrl = `http://${window.location.hostname}:5151/api/file?path=${encodeURIComponent(filePath)}`;
        window.open(fileUrl, "_blank");
    }
}

// ✅ Fixed: Better initialization
document.addEventListener("DOMContentLoaded", function () {
    //const urlParams = new URLSearchParams(window.location.search);
    const query = new URLSearchParams(window.location.search).get('q');
    if (query) {
        fetchFiles(query);
    }
});


function searchData() {
    const query = document.getElementById("searchInput").value.trim();
    if (!query) return;

    fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            console.log("🔍 Hasil pencarian:", data);

            let resultContainer = document.getElementById("folderGrid"); // Pastikan hasil muncul di grid utama
            resultContainer.innerHTML = ""; // Bersihkan hasil sebelumnya

            if (!data || data.length === 0) {
                resultContainer.innerHTML = "<p class='text-center text-danger'>Tidak ada hasil ditemukan.</p>";
                return;
            }

            data.forEach(item => {
                let fileTypeIcon = item.type === "folder" ? "img/icons/folder-icon.png" : "img/icons/file-icon.png";
                let card = document.createElement("div");
                card.className = "col-lg-3 col-md-4 col-sm-6"; // Ukuran grid responsif

                card.innerHTML = `
                    <div class="content shadow p-3 mb-2 text-center" onclick="previewFile('${item.path}')">
                        <img src="${fileTypeIcon}" class="img-fluid" alt="File">
                        <h5 class="mt-2 text-truncate">${item.name}</h5>
                    </div>
                `;

                resultContainer.appendChild(card);
            });
        })
        .catch(error => console.error("Gagal mengambil data: ", error));
}


// Fungsi untuk menentukan ikon berdasarkan jenis file
function getFileIcon(fileName) {
    const extension = fileName.split('.').pop().toLowerCase();
    if (["pdf"].includes(extension)) return "img/icons/pdf-icon.png";
    if (["mp4", "avi", "mov"].includes(extension)) return "img/icons/video-icon.png";
    if (["jpg", "jpeg", "png", "gif"].includes(extension)) return "img/icons/image-icon.png";
    return "img/icons/file-icon.png";
}


function displaySearchResults(files, filter) {
    console.log("Data hasil pencarian:", files); // 🔍 Cek apakah data muncul

    // Ambil kata kunci dan kategori
    const queryInput = document.getElementById("searchInput");
    const categorySelect = document.getElementById("categorySelect");

    const query = queryInput ? queryInput.value : "(tidak ada kata kunci)";
    const category = categorySelect ? categorySelect.value : "(semua kategori)";

    let searchResults = document.getElementById("searchResults");
    searchResults.innerHTML = "";

    // Filter file sesuai kategori
    let filteredFiles = files.filter(file => {
        if (filter === "all") return true;
        if (filter === "pdf" && file.type === "pdf") return true;
        if (filter === "video" && ["mp4", "avi", "wmv"].includes(file.type)) return true;
        if (filter === "text" && file.type === "txt") return true;
        return false;
    });

    // **Tampilkan jumlah file ditemukan di atas tabel**
    let fileCountElement = document.getElementById("fileCount");
    if (fileCountElement) {
        fileCountElement.innerText = `Jumlah file ditemukan dengan kata kunci "${query}" : ${filteredFiles.length} file(s)`;
    }

    // Jika tidak ada hasil, tampilkan pesan di dalam tabel
    if (filteredFiles.length === 0) {
        searchResults.innerHTML = "<tr><td colspan='7' class='text-center'>Tidak ada hasil ditemukan.</td></tr>";
        return;
    }

    // **Tampilkan hasil dalam tabel**
    filteredFiles.forEach((file, index) => {
        let fileUrl = `http://${window.location.hostname}:5151/api/file?path=${encodeURIComponent(file.path)}`;
        console.log("🔗 File URL:", file.name, "➡", fileUrl);

        let fileSize = file.size ? (file.size / (1024 * 1024)).toFixed(2) + " MB" : "-";
        let fileUpdated = file.modified ? new Date(file.modified).toLocaleString("id-ID") : "-";

        let row = document.createElement("tr");
        row.innerHTML = `
            <td>${index + 1}</td> <!-- No -->
            <td>${file.name}</td> <!-- Nama File -->
            <td>${file.type ? file.type.toUpperCase() : "-"}</td> <!-- Jenis -->
            <td>${file.path ? file.path.split('/').slice(-2, -1)[0] : '-'}</td> <!-- Lokasi -->
            <td>${fileSize}</td> <!-- Ukuran -->
            <td>${fileUpdated}</td> <!-- Updated -->
            <td><a href="${fileUrl}" class="open-file" data-filename="${file.name}" target="_blank" rel="noopener noreferrer">Buka</a></td> <!-- Aksi -->
        `;
        searchResults.appendChild(row);
    });
}


// Perbaikan tabel
function updateTable(results) {
    console.log("Fungsi updateTable dipanggil"); // Cek apakah fungsi dipanggil
    console.log("Data sebelum ditampilkan:", results);
    console.log("Data JSON hasil pencarian:", JSON.stringify(results, null, 2));

    let tableBody = document.querySelector("#searchResults");
    tableBody.innerHTML = ""; // Kosongkan tabel sebelum menampilkan hasil baru

    results.forEach(file => {
        console.log("Memproses file:", file);

        let row = document.createElement("tr");
        row.innerHTML = `
            <td>${index + 1}</td> <!-- No -->
            <td>${file.name}</td> <!-- Nama File -->
            <td>${file.type ? file.type.toUpperCase() : "-"}</td> <!-- Jenis -->
            <td>${file.path ? file.path.split('/').slice(-2, -1)[0] : '-'}</td> <!-- Lokasi -->
            <td>${fileSize}</td> <!-- Ukuran -->
            <td>${fileUpdated}</td> <!-- Updated -->
            <td><a href="${fileUrl}" class="open-file" data-filename="${file.name}">Buka</a></td> <!-- Aksi -->
        `;
        searchResults.appendChild(row);


        // Nama File
        let nameCell = document.createElement("td");
        nameCell.innerHTML = `<i class="fa fa-file"></i> ${file.name}`;
        row.appendChild(nameCell);

        // Jenis File
        let typeCell = document.createElement("td");
        typeCell.textContent = file.type ? file.type.toUpperCase() : "Tidak diketahui";
        row.appendChild(typeCell);
        console.log("Jenis File :", file.type); // Debug jenis

        // Lokasi File
        let locationCell = document.createElement("td");
        let folderName = file.path ? file.path.split("/").slice(-2, -1)[0] : "Tidak diketahui";
        locationCell.textContent = folderName;
        row.appendChild(locationCell);
        console.log("Lokasi File :", folderName); // Debug lokasi

        // Aksi (Buka File)
        let actionCell = document.createElement("td");
        actionCell.innerHTML = file.path ? `<a href="${file.path}" target="_blank">Buka</a>` : "-";
        row.appendChild(actionCell);
        console.log("Aksi:", file.path); // Debug aksi

        tableBody.appendChild(row);
    });
    console.log("✅ Table updated successfully");
}

// ✅ Fixed: Proper initialization with error handling
document.addEventListener("DOMContentLoaded", function () {
    console.log("🔄 Search system initializing...");

    try {
        // Check if we're on a search results page
        const query = new URLSearchParams(window.location.search).get('q');
        if (query) {
            console.log(`🔍 Auto-searching for: ${query}`);
            fetchFiles(query);
        }

        // Setup search form if it exists
        const searchForm = document.getElementById('searchForm');
        if (searchForm) {
            searchForm.addEventListener('submit', function (e) {
                e.preventDefault();
                const searchInput = document.getElementById('searchInput');
                if (searchInput && searchInput.value.trim()) {
                    const searchQuery = searchInput.value.trim();
                    window.location.href = `/pages/search-results.html?q=${encodeURIComponent(searchQuery)}`;
                }
            });
        }

        // Initialize file open listeners for existing elements
        attachFileOpenListeners();

        console.log("✅ Search system initialized successfully");

    } catch (error) {
        console.error("❌ Error initializing search system:", error);
    }
});