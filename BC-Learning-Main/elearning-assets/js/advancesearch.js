const baseURL = `http://${window.location.hostname}:5151`;

//Fungsi Pencarian Lanjutan
function startSearch() {
    const query = document.getElementById("searchInput").value.trim();
    const filter = document.getElementById("filterType").value;
    if (!query) {
        alert("Masukkan kata kunci pencarian!");
        return;
    }

    document.getElementById("loading").style.display = "block";
    document.getElementById("searchResults").innerHTML = ""; // Kosongkan tabel
    document.getElementById("fileCount").innerText = ""; // Kosongkan jumlah file

    fetch(`http://${window.location.hostname}:5151/api/search?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            console.log('Search API Response:', data); // Debug log
            displaySearchResults(data.files || [], filter);
        })
        .catch(error => {
            console.error("❌ Error during search:", error);
            showErrorMessage("Gagal mengambil hasil pencarian: " + error.message);
        })
        .finally(() => {
            document.getElementById("loading").style.display = "none";
        });
}

function displaySearchResults(files, filter) {
    console.log('📋 displaySearchResults called with:', { files, filter, filesLength: files?.length });

    let tableBody = document.getElementById("searchResults");
    tableBody.innerHTML = ""; // Kosongkan tabel sebelum update

    let fileCountElement = document.getElementById("fileCount");
    if (fileCountElement) {
        fileCountElement.innerHTML = `Jumlah File: <strong>${files.length}</strong>`;
    }

    let searchResults = document.getElementById("searchResults");
    searchResults.innerHTML = "";

    let filteredFiles = files.filter(file => {
        if (filter === "all") return true;
        if (filter === "pdf" && file.name.endsWith(".pdf")) return true;
        if (filter === "video" && [".mp4", ".avi", ".wmv"].some(ext => file.name.endsWith(ext))) return true;
        if (filter === "text" && file.name.endsWith(".txt")) return true;
        if (filter === "rvt" && file.name.endsWith(".rvt")) return true;
        if (filter === "dwg" && file.name.endsWith(".dwg")) return true;
        if (filter === "rfa" && file.name.endsWith(".rfa")) return true;
        return false;
    });

    console.log('🔍 Filtered files:', filteredFiles.length, 'from', files.length);
    document.getElementById("fileCount").innerText = `Jumlah file ditemukan: ${filteredFiles.length}`;

    if (filteredFiles.length === 0) {
        let row = document.createElement("tr");
        row.innerHTML = `<td colspan="7" class="text-center">Tidak ada hasil ditemukan.</td>`;
        searchResults.appendChild(row);
        return;
    }

    filteredFiles.forEach((file, index) => {
        let isRevitFile = file.name.endsWith(".rvt");
        let fileUrl = `${baseURL}${file.path}`;
        let fileSize = file.size ? (file.size / (1024 * 1024)).toFixed(2) + " MB" : "-"; // Konversi ke MB
        let fileUpdated = file.modified ? new Date(file.modified).toLocaleString("id-ID") : "-"; // Format tanggal

        let row = document.createElement("tr");

        // Ubah path agar sesuai dengan struktur lokal di G:/BIM CENTRAL LEARNING/
        let localFilePath = file.path.replace("/files/", ""); // Menghapus /files/ agar path sesuai
        let localPath = `file:///G:/BIM%20CENTRAL%20LEARNING/${encodeURIComponent(localFilePath)}`;

        let openLink = isRevitFile
            ? `<button class="btn btn-warning open-revit" data-path="${file.path}">Buka di Revit</button>`
            : `<a href="${fileUrl}" target="_blank" class="btn btn-primary">Buka</a>`;



        row.innerHTML = `
        <td>${index + 1}</td> <!-- No -->
        <td style="text-align: left;">${file.name}</td> <!-- Nama File -->
        <td>${file.type ? file.type.toUpperCase() : "-"}</td> <!-- Jenis -->
        <td style="text-align: left">${file.path ? file.path.split('/').slice(-2, -1)[0] : '-'}</td> <!-- Lokasi -->
        <td style="text-align: right">${fileSize}</td> <!-- Ukuran -->
        <td>${fileUpdated}</td> <!-- Updated -->
        <td>${openLink}</td> <!-- Tombol Buka -->
        `;

        document.getElementById("searchResults").appendChild(row);
    });
}

document.addEventListener("click", function (event) {
    if (event.target.classList.contains("open-revit")) {
        alert("⚠️ File .rvt tidak dapat dibuka langsung dari browser.\nSilakan buka file ini langsung di Autodesk Revit.");
    }
});

function showErrorMessage(message) {
    const searchResults = document.getElementById("searchResults");
    if (searchResults) {
        searchResults.innerHTML = `<tr><td colspan="7" class="text-center text-danger">${message}</td></tr>`;
    }
}