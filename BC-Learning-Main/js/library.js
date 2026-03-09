// library.js - Enhanced BIM Library with modern UI

let _allGroups = {};
let _allFiles = [];
let _currentFilter = 'all';
let _currentSort = 'name';

// Debounced search function
let searchTimeout;
const debouncedSearch = () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        performSearch();
    }, 500);
};

// Make functions available globally
window.debouncedSearch = debouncedSearch;
window.performSearch = performSearch;
window.sortFiles = sortFiles;

document.addEventListener('DOMContentLoaded', function () {
    initializeLibrary();
});

function initializeLibrary() {
    // Set up filter buttons
    setupFilterButtons();

    // Fetch library files
    fetchGroupedLibraryFiles();

    // Set up event listeners
    setupEventListeners();
}

function setupFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn[data-filter]');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            handleFilterClick(e.target);
        });
    });
}

function setupEventListeners() {
    const searchInput = document.getElementById('library-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debouncedSearch);
    }

    // Enter key support for search
    if (searchInput) {
        searchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }

    // Set up show more button event delegation
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('show-more-btn') || e.target.closest('.show-more-btn')) {
            const btn = e.target.classList.contains('show-more-btn') ? e.target : e.target.closest('.show-more-btn');
            showMoreFiles(btn);
        }
    });
}

function fetchGroupedLibraryFiles() {
    const container = document.getElementById('library-list-container');
    if (!container) return;
    container.innerHTML = '<div class="text-center">Memuat data library...</div>';
    fetch('/api/files/library-groups')
        .then(res => res.json())
        .then(groups => {
            _allGroups = groups;
            renderLibraryListFiltered(document.getElementById('library-search-input')?.value || '');
        })
        .catch(err => {
            container.innerHTML = '<div class="alert alert-danger">Gagal memuat data library.</div>';
        });
}

function renderLibraryListFiltered(searchTerm) {
    const container = document.getElementById('library-list-container');
    if (!container) return;
    const groups = _allGroups;
    if (!groups || Object.keys(groups).length === 0) {
        container.innerHTML = '<div class="alert alert-warning">Tidak ada file library ditemukan.</div>';
        return;
    }
    let html = '';
    const extLabels = {
        dwg: 'AutoCAD (.dwg)',
        rvt: 'Revit (.rvt)',
        pln: 'ArchiCAD (.pln)',
        skp: 'SketchUp (.skp)',
        rfa: 'Revit Family (.rfa)',
        pdf: 'Dokumen PDF',
        ifc: 'IFC',
        jpg: 'Gambar (.jpg)',
        png: 'Gambar (.png)',
        // Tambah sesuai kebutuhan
    };
    const extIcons = {
        dwg: '<i class="fas fa-drafting-compass bim-book-icon"></i>',
        rvt: '<i class="fas fa-cube bim-book-icon"></i>',
        pln: '<i class="fas fa-building bim-book-icon"></i>',
        skp: '<i class="fab fa-sketch bim-book-icon"></i>',
        rfa: '<i class="fas fa-cubes bim-book-icon"></i>',
        pdf: '<i class="fas fa-file-pdf bim-book-icon"></i>',
        ifc: '<i class="fas fa-project-diagram bim-book-icon"></i>',
        jpg: '<i class="fas fa-image bim-book-icon"></i>',
        png: '<i class="fas fa-image bim-book-icon"></i>',
        default: '<i class="fas fa-file bim-book-icon"></i>'
    };
    const extImgIcons = {
        dwg: '/img/icons/dwg-icon.png',
        rvt: '/img/icons/revit-icon.png',
        pdf: '/img/icons/pdf-icon.png',
        skp: '/img/icons/skp.ico',
        pln: '/img/icons/project-icon.png',
        rfa: '/img/icons/revit-icon.png',
        ifc: '/img/icons/project-icon.png',
        jpg: '/img/icons/image-icon.png',
        png: '/img/icons/image-icon.png',
        doc: '/img/icons/doc-icon.png',
        docx: '/img/icons/doc-icon.png',
        xls: '/img/icons/excel-icon.png',
        xlsx: '/img/icons/excel-icon.png',
        ppt: '/img/icons/ppt-icon.png',
        pptx: '/img/icons/ppt-icon.png',
        txt: '/img/icons/txt-icon.png',
        zip: '/img/icons/zip-icon.png',
        rtk: '/img/icons/dji.png',
        mpp: '/img/icons/mpp.png',
        tiff: '/img/icons/tiff.png',

        default: '/img/icons/folder-icon.png'
    };
    const term = searchTerm.trim().toLowerCase();
    let found = false;
    Object.keys(groups).sort().forEach(ext => {
        const files = groups[ext].filter(file => {
            if (!term) return true;
            return (
                file.name.toLowerCase().includes(term) ||
                ext.toLowerCase().includes(term) ||
                (extLabels[ext] && extLabels[ext].toLowerCase().includes(term))
            );
        });
        if (files.length > 0) {
            found = true;
            html += `<div class="d-flex align-items-start mb-4">
                <div class="bim-shelf-label me-2">${extLabels[ext] || ext.toUpperCase()}</div>
                <div class="bim-bookshelf-row flex-grow-1">
            `;
            files.forEach(file => {
                // Use image icon if available, else fallback to fontawesome
                let iconHtml = '';
                if (extImgIcons[ext]) {
                    iconHtml = `<img src="${extImgIcons[ext]}" alt="${ext} icon" class="bim-book-icon" style="width:38px;height:38px;object-fit:contain;">`;
                } else {
                    iconHtml = extIcons[ext] || extIcons.default;
                }
                html += `<div class="bim-book-item">
                    ${iconHtml}
                    <div class="bim-book-title">${file.name}</div>
                    <a href="/uploads/${file.relPath}" class="btn btn-primary bim-book-download" target="_blank">Download</a>
                </div>`;
            });
            html += '</div></div>';
        }
    });
    if (!found) {
        container.innerHTML = '<div class="alert alert-warning">Tidak ada file yang cocok dengan pencarian.</div>';
    } else {
        container.innerHTML = html;
    }
}

// Handle filter button clicks
function handleFilterClick(button) {
    // Remove active class from all buttons
    const filterButtons = document.querySelectorAll('.filter-btn[data-filter]');
    filterButtons.forEach(btn => btn.classList.remove('active'));

    // Add active class to clicked button
    button.classList.add('active');

    // Update current filter
    _currentFilter = button.dataset.filter;

    // Re-render library with new filter
    renderLibraryListFiltered(document.getElementById('library-search-input')?.value || '');
}

// Perform immediate search
function performSearch() {
    const searchTerm = document.getElementById('library-search-input')?.value || '';
    const resultsDiv = document.getElementById('searchResults') || createSearchResultsDiv();

    if (!searchTerm.trim()) {
        resultsDiv.innerHTML = '';
        renderLibraryListFiltered('');
        return;
    }

    // Filter results
    let totalResults = 0;
    if (_allGroups) {
        Object.values(_allGroups).forEach(files => {
            totalResults += files.filter(file =>
                file.name.toLowerCase().includes(searchTerm.toLowerCase())
            ).length;
        });
    }

    resultsDiv.innerHTML = `
        <div class="alert alert-info">
            <i class="fas fa-search me-2"></i>
            Found <strong>${totalResults}</strong> files matching "<strong>${searchTerm}</strong>"
        </div>
    `;

    renderLibraryListFiltered(searchTerm);
}

// Sort files based on selected criteria
function sortFiles() {
    const sortBy = document.getElementById('sort-select')?.value || 'name';

    if (_allGroups && Object.keys(_allGroups).length > 0) {
        Object.keys(_allGroups).forEach(ext => {
            _allGroups[ext].sort((a, b) => {
                switch (sortBy) {
                    case 'size':
                        return (b.size || 0) - (a.size || 0);
                    case 'format':
                        return ext.localeCompare(b.type || '');
                    case 'date':
                        return new Date(b.lastModified || 0) - new Date(a.lastModified || 0);
                    default: // name
                        return a.name.localeCompare(b.name);
                }
            });
        });

        renderLibraryListFiltered(document.getElementById('library-search-input')?.value || '');
    }
}

// Create search results div if it doesn't exist
function createSearchResultsDiv() {
    let resultsDiv = document.getElementById('searchResults');
    if (!resultsDiv) {
        resultsDiv = document.createElement('div');
        resultsDiv.id = 'searchResults';
        resultsDiv.className = 'mt-3';

        const filterSection = document.querySelector('.filter-section');
        if (filterSection) {
            filterSection.appendChild(resultsDiv);
        }
    }
    return resultsDiv;
}

// Update library statistics
function updateLibraryStats() {
    let totalFiles = 0;
    let formats = new Set();

    if (_allGroups) {
        Object.keys(_allGroups).forEach(ext => {
            totalFiles += _allGroups[ext].length;
            formats.add(ext);
        });
    }

    // Update stat elements
    const totalFilesEl = document.getElementById('total-files');
    const fileFormatsEl = document.getElementById('file-formats');

    if (totalFilesEl) totalFilesEl.textContent = totalFiles + '+';
    if (fileFormatsEl) fileFormatsEl.textContent = formats.size;
}

// Enhanced rendering with new card-based design
function renderLibraryEnhanced(searchTerm = '') {
    const container = document.getElementById('library-list-container');
    if (!container) return;

    const groups = _allGroups;
    if (!groups || Object.keys(groups).length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <h4>No Library Files Found</h4>
                <p>No files are currently available in the library.</p>
            </div>
        `;
        return;
    }

    const term = searchTerm.trim().toLowerCase();
    let html = '';

    // Process categories based on current filter
    const categories = {
        modeling: ['dwg', 'rvt', 'rfa'],
        families: ['rfa'],
        templates: ['rft', 'rte'],
        documents: ['pdf', 'doc', 'docx'],
        standards: ['ifc'],
        images: ['jpg', 'jpeg', 'png', 'gif']
    };

    // Determine which formats to show based on filter
    let formatsToShow = [];
    if (_currentFilter === 'all') {
        formatsToShow = Object.keys(groups);
    } else {
        formatsToShow = categories[_currentFilter] || Object.keys(groups).filter(ext =>
            _currentFilter === 'modeling' ? ['dwg', 'rvt', 'rfa'].includes(ext) :
                _currentFilter === 'other' ? !['dwg', 'rvt', 'rfa', 'pdf', 'jpg', 'png', 'ifc'].includes(ext) :
                    ['documents', 'standards', 'images'].includes(_currentFilter)
        );
    }

    // Render format sections
    formatsToShow.forEach(ext => {
        if (!groups[ext]) return;

        const files = groups[ext].filter(file => {
            if (!term) return true;
            return file.name.toLowerCase().includes(term) ||
                ext.toLowerCase().includes(term);
        });

        if (files.length > 0) {
            html += renderFormatSection(ext, files);
        }
    });

    container.innerHTML = html || `
        <div class="empty-state">
            <i class="fas fa-search"></i>
            <h4>No Files Found</h4>
            <p>No files match your current search and filter criteria.</p>
            <button class="btn btn-outline-primary" onclick="resetAllFilters()">
                <i class="fas fa-times me-1"></i>Reset All Filters
            </button>
        </div>
    `;
}

// Render a format section with limited display (2 rows max initially)
function renderFormatSection(ext, files) {
    const formatLabels = {
        dwg: 'AutoCAD Drawings',
        rvt: 'Revit Models',
        rfa: 'Revit Families',
        pdf: 'Document Files',
        ifc: 'IFC Files',
        jpg: 'Images',
        png: 'Images',
        skp: 'SketchUp Files',
        pln: 'ArchiCAD Files'
    };

    const displayName = formatLabels[ext] || ext.toUpperCase() + ' Files';
    const uniqueId = `format-${ext}-${Date.now()}`;
    const gridItemsPerRow = 4; // Assuming 4 items per row based on min-width: 150px
    const maxItemsInitially = gridItemsPerRow * 2; // 2 rows
    const showAllInitially = files.length <= maxItemsInitially;
    const visibleFiles = showAllInitially ? files : files.slice(0, maxItemsInitially);

    let html = `
        <div class="format-section" id="${uniqueId}">
            <div class="format-header">
                ${getFormatIcon(ext)}
                <h3 class="format-title">${displayName}</h3>
                <span class="format-file-count">${files.length} files</span>
            </div>
            <div class="file-grid">
    `;

    visibleFiles.forEach(file => {
        const fileSize = formatFileSize(file.size);
        const downloadUrl = `/uploads/${file.relPath}`;

        html += `
            <div class="file-item">
                ${getFileIcon(ext)}
                <div class="file-name">${file.name.replace(/\.[^/.]+$/, "")}</div>
                <div class="file-size">${fileSize}</div>
                <a href="${downloadUrl}" class="file-download-btn" target="_blank">
                    <i class="fas fa-download me-1"></i>Download
                </a>
            </div>
        `;
    });

    html += `</div>`;

    // Add "Show More" button if there are more files
    if (!showAllInitially) {
        html += `
            <div class="text-center mt-3">
                <button class="btn btn-outline-primary btn-sm show-more-btn"
                        data-format="${ext}"
                        data-section="${uniqueId}"
                        data-current-visible="${maxItemsInitially}"
                        data-total="${files.length}">
                    <i class="fas fa-plus me-1"></i>Show ${files.length - maxItemsInitially} More Files
                </button>
            </div>
        `;
    }

    html += `</div>`;
    return html;
}

// Get format icon
function getFormatIcon(ext) {
    const icons = {
        dwg: '<i class="fas fa-drafting-compass" style="color: #007bff;"></i>',
        rvt: '<i class="fas fa-cube" style="color: #dc3545;"></i>',
        rfa: '<i class="fas fa-cubes" style="color: #28a745;"></i>',
        pdf: '<i class="fas fa-file-pdf" style="color: #dc3545;"></i>',
        ifc: '<i class="fas fa-project-diagram" style="color: #6f42c1;"></i>',
        jpg: '<i class="fas fa-image" style="color: #20c997;"></i>',
        png: '<i class="fas fa-image" style="color: #20c997;"></i>',
        skp: '<i class="fab fa-sketch" style="color: #fd7e14;"></i>',
        pln: '<i class="fas fa-building" style="color: #e83e8c;"></i>'
    };

    return icons[ext] || '<i class="fas fa-file" style="color: #6c757d;"></i>';
}

// Get file icon
function getFileIcon(ext) {
    const imgIcons = {
        dwg: '/img/icons/dwg-icon.png',
        rvt: '/img/icons/revit-icon.png',
        pdf: '/img/icons/pdf-icon.png',
        ifc: '/img/icons/project-icon.png'
    };

    if (imgIcons[ext]) {
        return `<img src="${imgIcons[ext]}" alt="${ext} icon" class="file-image-icon">`;
    }

    return `<i class="fas fa-file file-icon"></i>`;
}

// Format file size
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return 'Unknown';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Reset all filters
function resetAllFilters() {
    // Reset filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn[data-filter]');
    filterButtons.forEach(btn => btn.classList.remove('active'));
    const allButton = document.querySelector('.filter-btn[data-filter="all"]');
    if (allButton) allButton.classList.add('active');

    // Clear search
    const searchInput = document.getElementById('library-search-input');
    if (searchInput) searchInput.value = '';

    // Clear results
    const resultsDiv = document.getElementById('searchResults');
    if (resultsDiv) resultsDiv.innerHTML = '';

    _currentFilter = 'all';
    renderLibraryListFiltered('');
}

// Handle show more/less button clicks
function showMoreFiles(button) {
    const format = button.dataset.format;
    const sectionId = button.dataset.section;
    const sectionEl = document.getElementById(sectionId);
    const currentVisible = parseInt(button.dataset.currentVisible);
    const totalFiles = parseInt(button.dataset.total);

    if (!sectionEl || !format || !_allGroups[format]) return;

    const allFiles = _allGroups[format];
    const fileGrid = sectionEl.querySelector('.file-grid');

    // Check if we should show more or show less using dataset status
    const shouldShowMore = button.classList.contains('btn-outline-primary');

    if (shouldShowMore) {
        // Show all remaining files
        const remainingFiles = allFiles.slice(currentVisible);

        remainingFiles.forEach(file => {
            const fileSize = formatFileSize(file.size);
            const downloadUrl = `/uploads/${file.relPath}`;

            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                ${getFileIcon(format)}
                <div class="file-name">${file.name.replace(/\.[^/.]+$/, "")}</div>
                <div class="file-size">${fileSize}</div>
                <a href="${downloadUrl}" class="file-download-btn" target="_blank">
                    <i class="fas fa-download me-1"></i>Download
                </a>
            `;

            fileGrid.appendChild(fileItem);
        });

        // Change button to show less
        button.innerHTML = '<i class="fas fa-minus me-1"></i>Show Less';
        button.classList.remove('btn-outline-primary');
        button.classList.add('btn-outline-secondary');
        button.dataset.currentVisible = totalFiles;

    } else {
        // Show less - hide files below initial limit (8 files)
        const gridItemsPerRow = 4;
        const maxItemsInitially = gridItemsPerRow * 2;
        const fileItems = Array.from(fileGrid.children);

        // Keep only the first maxItemsInitially files
        if (fileItems.length > maxItemsInitially) {
            for (let i = fileItems.length - 1; i >= maxItemsInitially; i--) {
                fileItems[i].remove();
            }
        }

        // Change button back to show more
        const remainingCount = totalFiles - maxItemsInitially;
        button.innerHTML = `<i class="fas fa-plus me-1"></i>Show ${remainingCount} More Files`;
        button.classList.remove('btn-outline-secondary');
        button.classList.add('btn-outline-primary');
        button.dataset.currentVisible = maxItemsInitially;
    }
}

// Legacy function (for backward compatibility)
function renderLibraryListFiltered(searchTerm) {
    // Call the new enhanced rendering
    renderLibraryEnhanced(searchTerm);

    // Update statistics
    setTimeout(updateLibraryStats, 100);
}
