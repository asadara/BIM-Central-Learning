//Fungsi untuk memfilter folder dan file sebelum ditampilkan
function filterData(data) {
    return {
        folders: data.folders.filter(folder => /^\d/.test(folder.name)), // Hanya folder yang diawali angka
        files: data.files.filter(file =>
            !file.name.startsWith('~$MAP') &&
            !file.name.startsWith('~$RM')
        )
    };
}


let currentPath = "";


let currentView = 'grid';
window.setViewMode = function (mode) {
    currentView = mode;
    fetchFolder(currentPath);
}
function fetchFolder(path = "") {
    currentPath = path;
    let folderGrid = document.getElementById("folderGrid");
    if (folderGrid) folderGrid.innerHTML = "";
    document.getElementById("backButton").style.display = path ? "block" : "none";
    // Loading spinner
    folderGrid.innerHTML = `<div class='text-center my-5'><div class='spinner-border text-primary'></div></div>`;
    fetch(`/api/folder?path=${encodeURIComponent(path)}`)
        .then(response => response.json())
        .then(data => {
            folderGrid.innerHTML = "";
            let filteredData = filterData(data);
            // Empty state
            if (filteredData.folders.length === 0 && filteredData.files.length === 0) {
                folderGrid.innerHTML = `<div class='col-12 text-center my-5'><img src='https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=300&h=180&fit=crop&crop=center' style='opacity:0.5;border-radius:12px;'><h5 class='mt-3 text-muted'>Folder kosong</h5></div>`;
                return;
            }
            // Kategori card di atas + opsi view
            if (!path) {
                folderGrid.innerHTML += `<div class='row mb-4'><div class='col-12'><div class='d-flex gap-3 justify-content-center flex-wrap'>
                        <button class='btn btn-warning' onclick="filterType('pdf')"><i class='fas fa-file-pdf'></i> PDF</button>
                        <button class='btn btn-info' onclick="filterType('video')"><i class='fas fa-video'></i> Video</button>
                        <button class='btn btn-success' onclick="filterType('image')"><i class='fas fa-image'></i> Gambar</button>
                        <button class='btn btn-secondary' onclick="filterType('doc')"><i class='fas fa-file-alt'></i> Dokumen</button>
                        <button class='btn btn-outline-dark' onclick="filterType('all')">Semua</button>
                        <button class='btn btn-outline-primary' onclick="setViewMode('grid')"><i class='fas fa-th'></i> Grid</button>
                        <button class='btn btn-outline-primary' onclick="setViewMode('tree')"><i class='fas fa-sitemap'></i> Tree</button>
                    </div></div></div>`;
            }
            // Folder cards dengan isi ringkas
            if (currentView === 'grid') {
                filteredData.folders.forEach(folder => {
                    let previewFiles = (folder.files || []).slice(0, 3).map(f => `<span class='badge bg-light text-dark me-1'>${f}</span>`).join('');
                    folderGrid.innerHTML += `
                            <div class="col-lg-3 col-md-4 col-sm-6 mb-4">
                                <div class="card folder-card h-100 shadow-sm" onclick="fetchFolder('${folder.path}')">
                                    <div class="card-body text-center">
                                        <img src="/img/icons/folder-icon.png" class="img-fluid mb-2" style="max-width:80px;">
                                        <h5 class="card-title">${folder.name}</h5>
                                        <p class="card-text text-muted">${folder.count || ''} item</p>
                                        <div class='small text-muted'>${previewFiles}</div>
                                    </div>
                                </div>
                            </div>`;
                });
            } else if (currentView === 'tree') {
                folderGrid.innerHTML += `<div class='col-12'><ul class='list-group'>${filteredData.folders.map(folder => `<li class='list-group-item'><span onclick="fetchFolder('${folder.path}')" style='cursor:pointer'><i class='fas fa-folder me-2'></i>${folder.name}</span>${(folder.files && folder.files.length) ? '<ul class="mt-2">' + folder.files.slice(0, 3).map(f => `<li class='small'><i class='fas fa-file me-1'></i>${f}</li>`).join('') + '</ul>' : ''}</li>`).join('')}</ul></div>`;
            }
            // File cards
            filteredData.files.forEach(file => {
                let fileName = file.name.toLowerCase();
                let icon = "/img/icons/file-icon.png";
                let type = "doc";
                let onClickFunction = `openPreviewModal('${file.path}','${file.name}')`;
                if (fileName.endsWith(".mp4") || fileName.endsWith(".avi") || fileName.endsWith(".mkv") || fileName.endsWith(".mov")) {
                    icon = "/img/icons/video-icon.png"; type = "video";
                } else if (fileName.endsWith(".pdf")) {
                    icon = "/img/icons/pdf-icon.png"; type = "pdf";
                } else if (fileName.endsWith(".dwg")) {
                    icon = "/img/icons/dwg-icon.png"; type = "image";
                    onClickFunction = `openDWGPreview('${file.path}')`;
                } else if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".png")) {
                    icon = "/img/icons/image-icon.png"; type = "image";
                }
                folderGrid.innerHTML += `
                        <div class="col-lg-3 col-md-4 col-sm-6 mb-4 file-card" data-type="${type}" data-name="${file.name}">
                            <div class="card h-100 shadow-sm" onclick="${onClickFunction}">
                                <div class="card-body text-center">
                                    <img src="${icon}" class="img-fluid mb-2" style="max-width:70px;">
                                    <h6 class="card-title">${file.name}</h6>
                                    <button class="btn btn-outline-primary btn-sm mt-2" onclick="event.stopPropagation();downloadFile('${file.path}')"><i class="fas fa-download"></i> Download</button>
                                </div>
                            </div>
                        </div>`;
            });
        })
        .catch(error => {
            folderGrid.innerHTML = `<div class='col-12 text-center my-5'><img src='https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=300&h=180&fit=crop&crop=center' style='opacity:0.5;border-radius:12px;'><h5 class='mt-3 text-danger'>Gagal mengambil data folder</h5></div>`;
        });
}

// Preview modal
window.openPreviewModal = function (filePath, fileName) {
    let ext = filePath.split('.').pop().toLowerCase();
    // PDF, image, video, office: open in new tab (force browser open, not download)
    let url = `/api/file?path=${encodeURIComponent(filePath)}`;
    if (["pdf", "mp4", "avi", "mov", "mkv", "webm", "jpg", "jpeg", "png", "gif", "bmp", "svg"].includes(ext)) {
        let win = window.open(url, '_blank');
        if (win) win.focus();
        return;
    }
    if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) {
        let googleUrl = '';
        if (["doc", "docx"].includes(ext)) googleUrl = `https://docs.google.com/viewer?url=${window.location.origin}${url}`;
        if (["xls", "xlsx"].includes(ext)) googleUrl = `https://docs.google.com/spreadsheets/u/0/d/${window.location.origin}${url}`;
        if (["ppt", "pptx"].includes(ext)) googleUrl = `https://docs.google.com/presentation/d/${window.location.origin}${url}`;
        let win = window.open(googleUrl, '_blank');
        if (win) win.focus();
        return;
    }
    // DWG, Revit, dll: show download only
    let modal = document.getElementById('previewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'previewModal';
        modal.className = 'modal fade';
        modal.tabIndex = -1;
        modal.innerHTML = `<div class='modal-dialog'><div class='modal-content'><div class='modal-header'><h5 class='modal-title'>${fileName}</h5><button type='button' class='btn-close' data-bs-dismiss='modal'></button></div><div class='modal-body'><p class='text-center text-muted'>File tidak dapat dipreview langsung.<br>Silakan download untuk membuka di aplikasi terkait.</p></div><div class='modal-footer'><button class='btn btn-primary' onclick="downloadFile('${filePath}')"><i class='fas fa-download'></i> Download</button><button type='button' class='btn btn-secondary' data-bs-dismiss='modal'>Tutup</button></div></div></div>`;
        document.body.appendChild(modal);
    } else {
        modal.querySelector('.modal-title').textContent = fileName;
        modal.querySelector('.modal-body').innerHTML = `<p class='text-center text-muted'>File tidak dapat dipreview langsung.<br>Silakan download untuk membuka di aplikasi terkait.</p>`;
    }
    let bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

window.downloadFile = function (filePath) {
    window.open(`/api/file?path=${encodeURIComponent(filePath)}`);
}

window.filterType = function (type) {
    document.querySelectorAll('.file-card').forEach(card => {
        if (type === 'all' || card.dataset.type === type) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

// Real-time search
document.getElementById('searchInput').addEventListener('input', function (e) {
    let val = e.target.value.toLowerCase();
    document.querySelectorAll('.file-card, .folder-card').forEach(card => {
        let name = card.querySelector('.card-title, .card-text, h6')?.textContent.toLowerCase() || '';
        if (name.includes(val)) {
            card.style.display = '';
            card.classList.add('search-highlight');
        } else {
            card.style.display = 'none';
            card.classList.remove('search-highlight');
        }
    });
});


function goBack() {
    if (!currentPath) return; // Jika sudah di root folder, tidak melakukan apa-apa

    let pathParts = currentPath.split("/").filter(p => p); // Pisahkan path menjadi array
    pathParts.pop(); // Hapus elemen terakhir (subfolder saat ini)

    let newPath = pathParts.join("/"); // Gabungkan kembali path
    fetchFolder(newPath); // Panggil ulang folder di atasnya

    // Sembunyikan preview setelah kembali ke folder sebelumnya
    document.getElementById("pdfPreviewContainer").style.display = "none";
    document.getElementById("videoPreviewContainer").style.display = "none";

    // Perbarui nilai `currentPath` agar tidak lompat ke root
    currentPath = newPath;
}

function previewFile(filePath) {
    let ext = filePath.split('.').pop().toLowerCase();
    let previewHTML = "";

    if (["pdf"].includes(ext)) {
        previewHTML = `<embed src="/api/file?path=${encodeURIComponent(filePath)}" type="application/pdf" width="100%" height="500px"/>`;
    } else if (["mp4", "avi"].includes(ext)) {
        previewHTML = `<video controls width="100%"><source src="/api/file?path=${encodeURIComponent(filePath)}" type="video/${ext}"></video>`;
    } else if (ext === "dwg") {
        let fileName = filePath.split('/').pop().replace('.dwg', '.svg'); // Ganti ekstensi ke SVG
        window.location.href = `previewdwg.html?file=${fileName}`; // Arahkan ke halaman preview DWG
        return;
    } else {
        previewHTML = `<p>Preview tidak tersedia untuk file ini.</p>`;
    }

    document.getElementById("filePreview").innerHTML = previewHTML;
}

// Load folder pertama kali
fetchFolder();