const baseURL = `${window.location.origin}`;

// Enhanced Search Functions
function startSearch() {
    const query = document.getElementById("searchInput").value.trim();
    const filter = document.getElementById("filterType").value;

    if (!query) {
        showNotification("Masukkan kata kunci pencarian!", "warning");
        return;
    }

    // Show loading state
    document.getElementById("loading").style.display = "block";
    document.getElementById("resultsContainer").style.display = "none";
    document.getElementById("noResults").style.display = "none";

    // Clear previous results
    document.getElementById("searchResults").innerHTML = "";

    console.log('🔍 Searching for:', query, 'with filter:', filter);

    fetch(`${baseURL}/api/search?q=${encodeURIComponent(query)}&filter=${encodeURIComponent(filter)}&type=files`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('✅ Search API Response:', data);
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

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        startSearch();
    }
}

function clearSearch() {
    document.getElementById("searchInput").value = "";
    document.getElementById("filterType").value = "all";
    document.getElementById("resultsContainer").style.display = "none";
    document.getElementById("noResults").style.display = "none";
    document.getElementById("searchInput").focus();
}

function goBack() {
    // Check if there's a referrer or use history back
    if (document.referrer && document.referrer.includes('elearning.html')) {
        window.location.href = document.referrer;
    } else {
        window.history.back();
    }
}

// Notification system
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    // Create new notification
    const notification = document.createElement('div');
    notification.className = `notification alert alert-${type === 'warning' ? 'warning' : 'info'} position-fixed`;
    notification.style.cssText = `
        top: 20px;
        right: 20px;
        z-index: 9999;
        max-width: 400px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    `;
    notification.innerHTML = `
        <i class="fas fa-${type === 'warning' ? 'exclamation-triangle' : 'info-circle'} me-2"></i>
        ${message}
        <button type="button" class="btn-close float-end" onclick="this.parentElement.remove()"></button>
    `;

    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function displaySearchResults(files, filter) {
    console.log('📋 displaySearchResults called with:', { files, filter, filesLength: files?.length });

    let filteredFiles = files.filter(file => {
        if (filter === "all") return true;
        if (filter === "pdf" && file.name.toLowerCase().endsWith(".pdf")) return true;
        if (filter === "video" && [".mp4", ".avi", ".wmv", ".mov"].some(ext => file.name.toLowerCase().endsWith(ext))) return true;
        if (filter === "text" && [".txt", ".doc", ".docx"].some(ext => file.name.toLowerCase().endsWith(ext))) return true;
        if (filter === "rvt" && file.name.toLowerCase().endsWith(".rvt")) return true;
        if (filter === "dwg" && file.name.toLowerCase().endsWith(".dwg")) return true;
        if (filter === "rfa" && file.name.toLowerCase().endsWith(".rfa")) return true;
        if (filter === "pln" && file.name.toLowerCase().endsWith(".pln")) return true;
        if (filter === "skp" && file.name.toLowerCase().endsWith(".skp")) return true;
        if (filter === "tm" && file.name.toLowerCase().endsWith(".tm")) return true;
        return false;
    });

    console.log('🔍 Filtered files:', filteredFiles.length, 'from', files.length);

    // Update file count
    const fileCountElement = document.getElementById("fileCount");
    if (fileCountElement) {
        fileCountElement.innerHTML = `<i class="fas fa-file me-2"></i>Menampilkan ${filteredFiles.length} hasil`;
    }

    // Show results container
    document.getElementById("resultsContainer").style.display = "block";

    if (filteredFiles.length === 0) {
        document.getElementById("noResults").style.display = "block";
        return;
    }

    document.getElementById("noResults").style.display = "none";

    const tableBody = document.getElementById("searchResults");
    tableBody.innerHTML = "";

    filteredFiles.forEach((file, index) => {
        const fileExt = file.name.split('.').pop().toLowerCase();
        const fileType = getFileType(fileExt);
        const fileUrl = `${baseURL}${file.path}`;
        const fileSize = file.size ? formatFileSize(file.size) : "-";
        const fileUpdated = file.modified ? new Date(file.modified).toLocaleString("id-ID") : "-";
        const location = file.location || '-'; // Use the decoded location from backend

        const row = document.createElement("tr");

        // Determine action button
        let actionButton = '';
        if (fileExt === 'rvt') {
            actionButton = `<button class="action-btn warning open-revit" data-path="${file.path}" title="Buka di Revit">
                <i class="fas fa-external-link-alt me-1"></i>Buka di Revit
            </button>`;
        } else if (['pdf', 'txt', 'doc', 'docx'].includes(fileExt)) {
            actionButton = `<a href="${fileUrl}" target="_blank" class="action-btn primary" title="Buka File">
                <i class="fas fa-eye me-1"></i>Lihat
            </a>`;
        } else {
            actionButton = `<a href="${fileUrl}" target="_blank" class="action-btn primary" title="Unduh File">
                <i class="fas fa-download me-1"></i>Unduh
            </a>`;
        }

        row.innerHTML = `
            <td>${index + 1}</td>
            <td><div class="file-name">${file.name}</div></td>
            <td><span class="file-type ${fileType.class}">${fileType.label}</span></td>
            <td>${location}</td>
            <td><span class="file-size">${fileSize}</span></td>
            <td>${fileUpdated}</td>
            <td>${actionButton}</td>
        `;

        tableBody.appendChild(row);
    });
}

function getFileType(extension) {
    const types = {
        'pdf': { label: 'PDF', class: 'pdf' },
        'mp4': { label: 'Video', class: 'video' },
        'avi': { label: 'Video', class: 'video' },
        'wmv': { label: 'Video', class: 'video' },
        'mov': { label: 'Video', class: 'video' },
        'txt': { label: 'Teks', class: 'text' },
        'doc': { label: 'Word', class: 'text' },
        'docx': { label: 'Word', class: 'text' },
        'rvt': { label: 'Revit', class: 'rvt' },
        'dwg': { label: 'CAD', class: 'dwg' },
        'rfa': { label: 'Revit Family', class: 'rfa' },
        'pln': { label: 'ArchiCAD', class: 'pln' },
        'skp': { label: 'SketchUp', class: 'skp' },
        'tm': { label: 'Twinmotion', class: 'tm' }
    };

    return types[extension] || { label: 'File', class: 'other' };
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function exportResults() {
    const table = document.getElementById('resultTable');
    if (!table) {
        showNotification('Tidak ada data untuk diekspor', 'warning');
        return;
    }

    let csv = 'No,Nama File,Tipe,Lokasi,Ukuran,Terakhir Update\n';

    const rows = table.querySelectorAll('tbody tr');
    rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        const rowData = [
            index + 1,
            cells[1]?.textContent?.trim() || '',
            cells[2]?.textContent?.trim() || '',
            cells[3]?.textContent?.trim() || '',
            cells[4]?.textContent?.trim() || '',
            cells[5]?.textContent?.trim() || ''
        ];
        csv += rowData.map(cell => `"${cell}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `hasil-pencarian-${new Date().toISOString().split('T')[0]}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('Hasil pencarian berhasil diekspor!', 'success');
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
