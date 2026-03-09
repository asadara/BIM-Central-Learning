/**
 * Library Module - Manages digital library and file storage
 */
class LibraryModule {
    constructor(adminPanel) {
        this.adminPanel = adminPanel;
        this.libraryData = [];
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.currentPath = '/';
    }

    /**
     * Initialize the library module
     */
    initialize() {
        console.log('📚 Initializing Library Module');
        this.setupEventListeners();
    }

    /**
     * Setup event listeners for library elements
     */
    setupEventListeners() {
        // Will be set up when library section is loaded
    }

    /**
     * Load library management
     */
    async loadLibrary() {
        console.log('📚 Loading library management...');

        const content = document.getElementById('library-content');
        if (!content) return;

        content.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h5 class="mb-0">Digital Library Management</h5>
                    <small class="text-muted">Manage files, documents, and media library</small>
                    <div class="mt-2">
                        <span class="badge bg-primary fs-6" id="totalFilesCount">
                            <i class="fas fa-file me-1"></i>Total: 0 files
                        </span>
                        <span class="badge bg-info fs-6 ms-2" id="totalSizeCount">
                            <i class="fas fa-hdd me-1"></i>Size: 0 MB
                        </span>
                    </div>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-outline-primary" onclick="safeCall('library', 'refreshLibrary')">
                        <i class="fas fa-sync-alt me-2"></i>Refresh
                    </button>
                    <button class="btn btn-modern-primary" onclick="safeCall('library', 'showUploadModal')">
                        <i class="fas fa-upload me-2"></i>Upload Files
                    </button>
                </div>
            </div>

            <!-- Current Path Navigation -->
            <nav aria-label="Library path navigation" class="mb-3">
                <ol class="breadcrumb bg-light rounded p-2" id="pathBreadcrumb">
                    <li class="breadcrumb-item">
                        <a href="#" onclick="safeCall('library', 'navigateToPath', '/')">
                            <i class="fas fa-home me-1"></i>Root
                        </a>
                    </li>
                </ol>
            </nav>

            <!-- Search and Filter Controls -->
            <div class="row g-3 mb-4">
                <div class="col-md-4">
                    <input type="text" class="form-control" id="librarySearchInput"
                        placeholder="Search files by name..." onkeyup="safeCall('library', 'filterLibrary')">
                </div>
                <div class="col-md-3">
                    <select class="form-select" id="libraryTypeFilter" onchange="safeCall('library', 'filterLibrary')">
                        <option value="">All Types</option>
                        <option value="document">Documents</option>
                        <option value="image">Images</option>
                        <option value="video">Videos</option>
                        <option value="audio">Audio</option>
                        <option value="archive">Archives</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="col-md-3">
                    <select class="form-select" id="librarySortFilter" onchange="safeCall('library', 'sortLibrary')">
                        <option value="name">Sort by Name</option>
                        <option value="size">Sort by Size</option>
                        <option value="date">Sort by Date</option>
                        <option value="type">Sort by Type</option>
                    </select>
                </div>
                <div class="col-md-2">
                    <div class="d-flex gap-2">
                        <button class="btn btn-outline-secondary btn-sm"
                            onclick="safeCall('library', 'clearLibraryFilters')">
                            <i class="fas fa-times me-1"></i>Clear
                        </button>
                    </div>
                </div>
            </div>

            <!-- Library Grid/List View Toggle -->
            <div class="d-flex justify-content-between align-items-center mb-3">
                <div>
                    <div class="btn-group btn-group-sm" role="group">
                        <button type="button" class="btn btn-outline-primary active" id="listViewBtn"
                                onclick="safeCall('library', 'setViewMode', 'list')">
                            <i class="fas fa-list me-1"></i>List
                        </button>
                        <button type="button" class="btn btn-outline-primary" id="gridViewBtn"
                                onclick="safeCall('library', 'setViewMode', 'grid')">
                            <i class="fas fa-th me-1"></i>Grid
                        </button>
                    </div>
                </div>
                <div class="text-muted small">
                    <span id="fileCountDisplay">0 files</span>
                </div>
            </div>

            <!-- Library Content -->
            <div id="libraryContent" class="border rounded p-3 bg-light">
                <!-- Files will be loaded here -->
                <div class="text-center py-5">
                    <i class="fas fa-folder-open fa-3x text-muted mb-3"></i>
                    <p class="text-muted mb-3">Loading library contents...</p>
                    <button class="btn btn-primary" onclick="safeCall('library', 'refreshLibrary')">
                        <i class="fas fa-sync-alt me-2"></i>Load Library
                    </button>
                </div>
            </div>

            <!-- Pagination -->
            <nav id="libraryPagination" class="mt-4" style="display: none;">
                <ul class="pagination justify-content-center" id="libraryPaginationControls"></ul>
            </nav>
        `;

        // Load sample library data
        await this.refreshLibrary();
    }

    /**
     * Refresh library data
     */
    async refreshLibrary() {
        try {
            console.log('🔄 Refreshing library data...');

            // Sample library data
            this.libraryData = [
                {
                    id: 1,
                    name: "Documents",
                    type: "folder",
                    path: "/Documents",
                    size: 0,
                    modified: "2025-01-18T14:30:00.000Z",
                    permissions: "rwxr-xr-x",
                    icon: "fas fa-folder"
                },
                {
                    id: 2,
                    name: "Images",
                    type: "folder",
                    path: "/Images",
                    size: 0,
                    modified: "2025-01-17T09:15:00.000Z",
                    permissions: "rwxr-xr-x",
                    icon: "fas fa-folder"
                },
                {
                    id: 3,
                    name: "Videos",
                    type: "folder",
                    path: "/Videos",
                    size: 0,
                    modified: "2025-01-16T16:45:00.000Z",
                    permissions: "rwxr-xr-x",
                    icon: "fas fa-folder"
                },
                {
                    id: 4,
                    name: "project-proposal.pdf",
                    type: "document",
                    path: "/Documents/project-proposal.pdf",
                    size: 2457600,
                    modified: "2025-01-15T11:20:00.000Z",
                    permissions: "rw-r--r--",
                    extension: "pdf",
                    icon: "fas fa-file-pdf"
                },
                {
                    id: 5,
                    name: "company-logo.png",
                    type: "image",
                    path: "/Images/company-logo.png",
                    size: 512000,
                    modified: "2025-01-14T08:30:00.000Z",
                    permissions: "rw-r--r--",
                    extension: "png",
                    icon: "fas fa-file-image"
                },
                {
                    id: 6,
                    name: "presentation.mp4",
                    type: "video",
                    path: "/Videos/presentation.mp4",
                    size: 52428800,
                    modified: "2025-01-13T15:45:00.000Z",
                    permissions: "rw-r--r--",
                    extension: "mp4",
                    icon: "fas fa-file-video"
                },
                {
                    id: 7,
                    name: "backup-2025.zip",
                    type: "archive",
                    path: "/backup-2025.zip",
                    size: 1073741824,
                    modified: "2025-01-12T22:00:00.000Z",
                    permissions: "rw-------",
                    extension: "zip",
                    icon: "fas fa-file-archive"
                },
                {
                    id: 8,
                    name: "README.md",
                    type: "document",
                    path: "/README.md",
                    size: 2048,
                    modified: "2025-01-11T10:15:00.000Z",
                    permissions: "rw-r--r--",
                    extension: "md",
                    icon: "fas fa-file-alt"
                }
            ];

            this.updateLibraryStats();
            this.updateBreadcrumb();
            this.displayLibrary(this.libraryData);

        } catch (error) {
            console.error('Error refreshing library:', error);
            this.showError('Failed to load library data');
        }
    }

    /**
     * Update library statistics
     */
    updateLibraryStats() {
        const files = this.libraryData.filter(item => item.type !== 'folder');
        const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);

        const fileBadge = document.getElementById('totalFilesCount');
        const sizeBadge = document.getElementById('totalSizeCount');
        const countDisplay = document.getElementById('fileCountDisplay');

        if (fileBadge) {
            fileBadge.innerHTML = `<i class="fas fa-file me-1"></i>Total: ${files.length} files`;
        }
        if (sizeBadge) {
            sizeBadge.innerHTML = `<i class="fas fa-hdd me-1"></i>Size: ${this.formatFileSize(totalSize)}`;
        }
        if (countDisplay) {
            countDisplay.textContent = `${files.length} files`;
        }
    }

    /**
     * Update breadcrumb navigation
     */
    updateBreadcrumb() {
        const breadcrumb = document.getElementById('pathBreadcrumb');
        if (!breadcrumb) return;

        const pathParts = this.currentPath.split('/').filter(part => part);
        let html = `
            <li class="breadcrumb-item">
                <a href="#" onclick="safeCall('library', 'navigateToPath', '/')">
                    <i class="fas fa-home me-1"></i>Root
                </a>
            </li>
        `;

        let currentPath = '';
        pathParts.forEach((part, index) => {
            currentPath += '/' + part;
            const isLast = index === pathParts.length - 1;

            if (isLast) {
                html += `<li class="breadcrumb-item active">${part}</li>`;
            } else {
                html += `
                    <li class="breadcrumb-item">
                        <a href="#" onclick="safeCall('library', 'navigateToPath', '${currentPath}')">${part}</a>
                    </li>
                `;
            }
        });

        breadcrumb.innerHTML = html;
    }

    /**
     * Navigate to path
     */
    navigateToPath(path) {
        this.currentPath = path;
        this.currentPage = 1;
        this.updateBreadcrumb();

        // Filter items for current path
        const pathItems = path === '/' ?
            this.libraryData.filter(item => !item.path.includes('/', 1)) :
            this.libraryData.filter(item => item.path.startsWith(path + '/') && item.path.split('/').length === path.split('/').length + 1);

        this.displayLibrary(pathItems);
    }

    /**
     * Display library content
     */
    displayLibrary(items) {
        const container = document.getElementById('libraryContent');
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-folder-open fa-3x text-muted mb-3"></i>
                    <p class="text-muted mb-2">This folder is empty</p>
                </div>
            `;
            return;
        }

        // Check view mode
        const viewMode = localStorage.getItem('libraryViewMode') || 'list';

        if (viewMode === 'grid') {
            this.displayGridView(items);
        } else {
            this.displayListView(items);
        }
    }

    /**
     * Display list view
     */
    displayListView(items) {
        const container = document.getElementById('libraryContent');
        if (!container) return;

        let html = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead class="table-dark">
                        <tr>
                            <th style="width: 50px;"></th>
                            <th>Name</th>
                            <th>Type</th>
                            <th>Size</th>
                            <th>Modified</th>
                            <th>Permissions</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        items.forEach(item => {
            const isFolder = item.type === 'folder';
            const sizeDisplay = isFolder ? '--' : this.formatFileSize(item.size);
            const typeDisplay = isFolder ? 'Folder' : (item.extension ? item.extension.toUpperCase() : 'File');

            html += `
                <tr class="${isFolder ? 'table-light' : ''}">
                    <td class="text-center">
                        <i class="${item.icon} ${isFolder ? 'text-warning' : 'text-primary'}"></i>
                    </td>
                    <td>
                        ${isFolder ?
                            `<a href="#" onclick="safeCall('library', 'navigateToPath', '${item.path}')" class="text-decoration-none fw-bold">
                                ${item.name}
                            </a>` :
                            `<span class="fw-bold">${item.name}</span>`
                        }
                    </td>
                    <td>${typeDisplay}</td>
                    <td>${sizeDisplay}</td>
                    <td>${new Date(item.modified).toLocaleDateString('id-ID')}</td>
                    <td><code class="small">${item.permissions}</code></td>
                    <td>
                        <div class="btn-group btn-group-sm" role="group">
                            <button class="btn btn-outline-info" onclick="safeCall('library', 'viewFileDetails', ${item.id})" title="Details">
                                <i class="fas fa-info-circle"></i>
                            </button>
                            ${!isFolder ? `
                            <button class="btn btn-outline-primary" onclick="safeCall('library', 'downloadFile', ${item.id})" title="Download">
                                <i class="fas fa-download"></i>
                            </button>
                            ` : ''}
                            <button class="btn btn-outline-warning" onclick="safeCall('library', 'renameFile', ${item.id}, '${item.name.replace(/'/g, "\\'")}')" title="Rename">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="safeCall('library', 'deleteFile', ${item.id}, '${item.name.replace(/'/g, "\\'")}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
    }

    /**
     * Display grid view
     */
    displayGridView(items) {
        const container = document.getElementById('libraryContent');
        if (!container) return;

        let html = '<div class="row g-3">';

        items.forEach(item => {
            const isFolder = item.type === 'folder';
            const sizeDisplay = isFolder ? '' : `<small class="text-muted">${this.formatFileSize(item.size)}</small>`;

            html += `
                <div class="col-md-6 col-lg-3">
                    <div class="card file-card h-100 ${isFolder ? 'border-warning' : 'border-primary'}">
                        <div class="card-body text-center">
                            <div class="file-icon mb-3">
                                <i class="${item.icon} fa-3x ${isFolder ? 'text-warning' : 'text-primary'}"></i>
                            </div>
                            <h6 class="card-title text-truncate mb-2" title="${item.name}">
                                ${isFolder ?
                                    `<a href="#" onclick="safeCall('library', 'navigateToPath', '${item.path}')" class="text-decoration-none">
                                        ${item.name}
                                    </a>` :
                                    item.name
                                }
                            </h6>
                            <div class="file-info small text-muted mb-3">
                                <div>${isFolder ? 'Folder' : (item.extension ? item.extension.toUpperCase() : 'File')}</div>
                                ${sizeDisplay}
                            </div>
                            <div class="file-actions">
                                <div class="btn-group btn-group-sm w-100" role="group">
                                    <button class="btn btn-outline-info" onclick="safeCall('library', 'viewFileDetails', ${item.id})">
                                        <i class="fas fa-info-circle"></i>
                                    </button>
                                    ${!isFolder ? `
                                    <button class="btn btn-outline-primary" onclick="safeCall('library', 'downloadFile', ${item.id})">
                                        <i class="fas fa-download"></i>
                                    </button>
                                    ` : ''}
                                    <button class="btn btn-outline-warning" onclick="safeCall('library', 'renameFile', ${item.id}, '${item.name.replace(/'/g, "\\'")}')">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn btn-outline-danger" onclick="safeCall('library', 'deleteFile', ${item.id}, '${item.name.replace(/'/g, "\\'")}')">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="card-footer small text-muted text-center">
                            ${new Date(item.modified).toLocaleDateString('id-ID')}
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    }

    /**
     * Set view mode
     */
    setViewMode(mode) {
        localStorage.setItem('libraryViewMode', mode);

        // Update button states
        const listBtn = document.getElementById('listViewBtn');
        const gridBtn = document.getElementById('gridViewBtn');

        if (listBtn && gridBtn) {
            if (mode === 'list') {
                listBtn.classList.add('active');
                gridBtn.classList.remove('active');
            } else {
                gridBtn.classList.add('active');
                listBtn.classList.remove('active');
            }
        }

        // Re-display current items
        const currentItems = this.getCurrentPathItems();
        this.displayLibrary(currentItems);
    }

    /**
     * Get current path items
     */
    getCurrentPathItems() {
        return this.currentPath === '/' ?
            this.libraryData.filter(item => !item.path.includes('/', 1)) :
            this.libraryData.filter(item => item.path.startsWith(this.currentPath + '/') && item.path.split('/').length === this.currentPath.split('/').length + 1);
    }

    /**
     * Filter library
     */
    filterLibrary() {
        const searchTerm = document.getElementById('librarySearchInput')?.value.toLowerCase() || '';
        const typeFilter = document.getElementById('libraryTypeFilter')?.value || '';

        let filtered = this.libraryData.filter(item => {
            const matchesSearch = !searchTerm || item.name.toLowerCase().includes(searchTerm);
            const matchesType = !typeFilter || item.type === typeFilter;
            return matchesSearch && matchesType;
        });

        // Apply current path filter
        if (this.currentPath !== '/') {
            filtered = filtered.filter(item =>
                item.path.startsWith(this.currentPath + '/') &&
                item.path.split('/').length === this.currentPath.split('/').length + 1
            );
        }

        this.displayLibrary(filtered);
    }

    /**
     * Sort library
     */
    sortLibrary() {
        const sortBy = document.getElementById('librarySortFilter')?.value || 'name';

        this.libraryData.sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'size':
                    return (b.size || 0) - (a.size || 0);
                case 'date':
                    return new Date(b.modified) - new Date(a.modified);
                case 'type':
                    return a.type.localeCompare(b.type);
                default:
                    return 0;
            }
        });

        const currentItems = this.getCurrentPathItems();
        this.displayLibrary(currentItems);
    }

    /**
     * Clear library filters
     */
    clearLibraryFilters() {
        const searchInput = document.getElementById('librarySearchInput');
        const typeFilter = document.getElementById('libraryTypeFilter');
        const sortFilter = document.getElementById('librarySortFilter');

        if (searchInput) searchInput.value = '';
        if (typeFilter) typeFilter.value = '';
        if (sortFilter) sortFilter.value = 'name';

        this.navigateToPath(this.currentPath);
    }

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (!bytes) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * View file details
     */
    viewFileDetails(fileId) {
        const file = this.libraryData.find(f => f.id === fileId);
        if (!file) {
            alert('File not found');
            return;
        }

        const modalHtml = `
            <div class="modal fade" id="fileDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="${file.icon} me-2"></i>File Details: ${file.name}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <h6>File Information</h6>
                                    <table class="table table-sm">
                                        <tr>
                                            <td><strong>Name:</strong></td>
                                            <td>${file.name}</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Type:</strong></td>
                                            <td>${file.type === 'folder' ? 'Folder' : (file.extension ? file.extension.toUpperCase() : 'File')}</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Path:</strong></td>
                                            <td><code>${file.path}</code></td>
                                        </tr>
                                        <tr>
                                            <td><strong>Size:</strong></td>
                                            <td>${file.type === 'folder' ? 'N/A' : this.formatFileSize(file.size)}</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Modified:</strong></td>
                                            <td>${new Date(file.modified).toLocaleString('id-ID')}</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Permissions:</strong></td>
                                            <td><code>${file.permissions}</code></td>
                                        </tr>
                                    </table>
                                </div>
                                <div class="col-md-6">
                                    <h6>Quick Actions</h6>
                                    <div class="d-grid gap-2">
                                        ${file.type !== 'folder' ? `
                                        <button class="btn btn-primary" onclick="safeCall('library', 'downloadFile', ${file.id})">
                                            <i class="fas fa-download me-2"></i>Download File
                                        </button>
                                        <button class="btn btn-info" onclick="safeCall('library', 'previewFile', ${file.id})">
                                            <i class="fas fa-eye me-2"></i>Preview File
                                        </button>
                                        ` : ''}
                                        <button class="btn btn-warning" onclick="safeCall('library', 'renameFile', ${file.id}, '${file.name.replace(/'/g, "\\'")}')">
                                            <i class="fas fa-edit me-2"></i>Rename ${file.type === 'folder' ? 'Folder' : 'File'}
                                        </button>
                                        <button class="btn btn-danger" onclick="safeCall('library', 'deleteFile', ${file.id}, '${file.name.replace(/'/g, "\\'")}')">
                                            <i class="fas fa-trash me-2"></i>Delete ${file.type === 'folder' ? 'Folder' : 'File'}
                                        </button>
                                    </div>

                                    ${file.type !== 'folder' ? `
                                    <h6 class="mt-4">File Preview</h6>
                                    <div class="border rounded p-3 bg-light">
                                        <div class="text-center">
                                            <i class="${file.icon} fa-4x text-primary mb-3"></i>
                                            <p class="mb-1">${file.name}</p>
                                            <small class="text-muted">${this.formatFileSize(file.size)}</small>
                                        </div>
                                    </div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('fileDetailsModal');
        if (existingModal) existingModal.remove();

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('fileDetailsModal'));
        modal.show();
    }

    /**
     * Download file
     */
    downloadFile(fileId) {
        const file = this.libraryData.find(f => f.id === fileId);
        if (!file || file.type === 'folder') {
            alert('File not found or is a folder');
            return;
        }

        alert(`🔄 Downloading "${file.name}"... (Demo - file would be downloaded)`);
        // In real implementation, this would trigger actual file download
    }

    /**
     * Preview file
     */
    previewFile(fileId) {
        const file = this.libraryData.find(f => f.id === fileId);
        if (!file || file.type === 'folder') {
            alert('File not found or is a folder');
            return;
        }

        alert(`👁️ Previewing "${file.name}"... (Demo - file preview would open)`);
        // In real implementation, this would open file preview
    }

    /**
     * Rename file
     */
    renameFile(fileId, currentName) {
        const newName = prompt(`Rename "${currentName}" to:`, currentName);
        if (!newName || newName === currentName) return;

        const file = this.libraryData.find(f => f.id === fileId);
        if (!file) {
            alert('File not found');
            return;
        }

        file.name = newName;
        file.path = file.path.replace(currentName, newName);
        file.modified = new Date().toISOString();

        this.displayLibrary(this.getCurrentPathItems());
        alert(`✅ "${currentName}" renamed to "${newName}"`);
    }

    /**
     * Delete file
     */
    deleteFile(fileId, fileName) {
        if (!confirm(`Are you sure you want to delete "${fileName}"?\n\nThis action cannot be undone!`)) {
            return;
        }

        const fileIndex = this.libraryData.findIndex(f => f.id === fileId);
        if (fileIndex !== -1) {
            this.libraryData.splice(fileIndex, 1);
            this.updateLibraryStats();
            this.displayLibrary(this.getCurrentPathItems());
            alert(`✅ "${fileName}" deleted successfully!`);
        }
    }

    /**
     * Show upload modal
     */
    showUploadModal() {
        const modalHtml = `
            <div class="modal fade" id="uploadModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-upload me-2"></i>Upload Files
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>
                                <strong>File Upload</strong><br>
                                Select files to upload to the current directory: <code>${this.currentPath}</code>
                            </div>

                            <form id="uploadForm">
                                <div class="mb-3">
                                    <label for="fileUpload" class="form-label">Select Files</label>
                                    <input class="form-control" type="file" id="fileUpload" multiple>
                                    <div class="form-text">You can select multiple files at once</div>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Upload Options</label>
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="overwriteExisting" checked>
                                        <label class="form-check-label" for="overwriteExisting">
                                            Overwrite existing files
                                        </label>
                                    </div>
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="createDirectories">
                                        <label class="form-check-label" for="createDirectories">
                                            Create directories if needed
                                        </label>
                                    </div>
                                </div>

                                <div id="uploadProgress" class="mb-3 d-none">
                                    <div class="progress">
                                        <div class="progress-bar" role="progressbar" style="width: 0%"></div>
                                    </div>
                                    <small class="text-muted" id="uploadStatus">Preparing upload...</small>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" onclick="safeCall('library', 'uploadFiles')">
                                <i class="fas fa-upload me-2"></i>Upload Files
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('uploadModal');
        if (existingModal) existingModal.remove();

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('uploadModal'));
        modal.show();
    }

    /**
     * Upload files
     */
    uploadFiles() {
        const fileInput = document.getElementById('fileUpload');
        if (!fileInput || !fileInput.files.length) {
            alert('Please select files to upload');
            return;
        }

        const progressDiv = document.getElementById('uploadProgress');
        const progressBar = progressDiv.querySelector('.progress-bar');
        const statusText = document.getElementById('uploadStatus');

        progressDiv.classList.remove('d-none');
        progressBar.style.width = '0%';
        statusText.textContent = 'Uploading files...';

        // Simulate upload progress
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                setTimeout(() => {
                    alert(`✅ ${fileInput.files.length} files uploaded successfully!`);
                    bootstrap.Modal.getInstance(document.getElementById('uploadModal')).hide();
                    this.refreshLibrary();
                }, 500);
            }
            progressBar.style.width = progress + '%';
            statusText.textContent = `Uploading... ${Math.round(progress)}%`;
        }, 200);
    }

    /**
     * Show error message
     */
    showError(message) {
        const content = document.getElementById('library-content');
        if (content) {
            content.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${message}
                </div>
            `;
        }
    }
}

// Initialize and register the library module immediately when script loads
(function() {
    console.log('📚 Initializing Library Module...');

    // Ensure adminPanel exists
    if (!window.adminPanel) {
        console.error('❌ window.adminPanel not found - library module cannot initialize');
        return;
    }

    // Ensure modules Map exists
    if (!window.adminPanel.modules) {
        console.error('❌ window.adminPanel.modules not found - library module cannot initialize');
        return;
    }

    try {
        // Create library module instance
        const libraryModule = new LibraryModule(window.adminPanel);

        // Set up the module entry
        window.adminPanel.modules.set('library', {
            loaded: true,
            path: 'modules/library.js',
            instance: libraryModule
        });

        // Initialize the module
        libraryModule.initialize();

        console.log('✅ Library module initialized and registered successfully');
    } catch (error) {
        console.error('❌ Failed to initialize library module:', error);
    }
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LibraryModule;
}
