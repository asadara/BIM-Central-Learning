/**
 * Video Display Module - Handles homepage video display management
 * Controls which videos appear on the main page carousel
 */
class VideoDisplayModule {
    constructor(adminPanel) {
        this.adminPanel = adminPanel;
        this.playlist = [];
        this.displaySettings = {};
    }

    getAuthHeaders(extraHeaders = {}) {
        const headers = { ...extraHeaders };
        const token = localStorage.getItem('token') || localStorage.getItem('admin_token');
        if (token && !headers.Authorization && !headers.authorization) {
            headers.Authorization = `Bearer ${token}`;
        }
        return headers;
    }

    showNotification(message, type = 'info') {
        if (typeof window.showAlert === 'function') {
            window.showAlert(message, type);
            return;
        }
        alert(message);
    }

    /**
     * Initialize the video display module
     */
    initialize() {
        console.log('ðŸ“º Initializing Video Display Module');
        this.setupEventListeners();
    }

    /**
     * Setup event listeners for video display elements
     */
    setupEventListeners() {
        // Load video display management button
        const loadBtn = document.querySelector('button[onclick*="loadVideoDisplayManagement"]');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.loadVideoDisplayManagement());
        }

        // Add YouTube video button (inject if needed)
        // This will be handled in render
    }

    /**
     * Load video display management
     */
    async loadVideoDisplayManagement() {
        console.log('ðŸ”„ Loading video display management...');

        const tableBody = document.getElementById('videoDisplayTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <div class="d-flex flex-column align-items-center">
                            <div class="spinner-border text-primary mb-2" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                            <p class="text-muted mb-2">Loading playlist...</p>
                        </div>
                    </td>
                </tr>`;
        }

        // Update UI structure to support playlist management
        this.updateUIForPlaylistManagement();

        try {
            // Load current display configuration
            const response = await fetch('/api/admin/video-display/list', {
                headers: this.getAuthHeaders(),
                credentials: 'include'
            });
            console.log('ðŸ“¡ Display config API response:', response.status);

            if (response.ok) {
                const configData = await response.json();
                console.log('âœ… Display config loaded:', configData);

                this.playlist = configData.playlist || [];
                this.displaySettings = configData.config?.settings || {};

                this.renderPlaylistTable();
                this.updateBadges();

            } else {
                const errorText = await response.text();
                console.error('âŒ Display config API failed:', response.status, errorText);
                if (tableBody) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="6" class="text-center py-4">
                                <div class="alert alert-danger mb-0">
                                    <i class="fas fa-exclamation-triangle me-2"></i>
                                    Failed to load playlist: ${response.status}
                                </div>
                            </td>
                        </tr>`;
                }
            }
        } catch (error) {
            console.error('âŒ Error loading video display management:', error);
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center py-4">
                            <div class="alert alert-danger mb-0">
                                <i class="fas fa-exclamation-circle me-2"></i>
                                Error loading display management: ${error.message}
                            </div>
                        </td>
                    </tr>`;
            }
        }
    }

    /**
     * Update UI to show "Add YouTube" button and clean up unused filters
     */
    updateUIForPlaylistManagement() {
        const header = document.querySelector('#video-display-section .card-header-modern');
        if (header && !document.getElementById('addYoutubeBtn')) {
            const btn = document.createElement('button');
            btn.id = 'addYoutubeBtn';
            btn.className = 'btn btn-modern-primary ms-auto';
            btn.innerHTML = '<i class="fab fa-youtube me-2"></i>Add YouTube Video';
            btn.onclick = () => this.showAddYouTubeModal();
            
            // Remove existing buttons or append
            const existingBtn = header.querySelector('button');
            if (existingBtn) existingBtn.remove(); // Remove old scan button if present
            
            header.appendChild(btn);
        }

        // Hide unused filters
        const filtersRow = document.querySelector('#video-display-section .row.g-3.mb-4');
        if (filtersRow) {
            filtersRow.style.display = 'none';
        }
        
        // Hide pagination
        const pagination = document.getElementById('videoDisplayPagination');
        if (pagination) pagination.style.display = 'none';
        
        // Keep only Save Selection action in playlist mode
        const bottomActions = document.querySelector('#video-display-section .d-flex.justify-content-between.mt-4');
        if (bottomActions) {
            bottomActions.style.display = '';

            const infoText = bottomActions.querySelector('.text-muted.small');
            if (infoText) {
                infoText.innerHTML = '<i class="fas fa-info-circle me-1"></i>Setelah upload link video, klik Save Selection untuk menyimpan.';
            }

            const legacyButtons = bottomActions.querySelectorAll('.btn-outline-secondary');
            legacyButtons.forEach(btn => {
                btn.style.display = 'none';
            });

            const saveBtn = bottomActions.querySelector('.btn.btn-success');
            if (saveBtn) {
                saveBtn.setAttribute('onclick', 'saveVideoDisplaySelection()');
            }
        }
    }

    /**
     * Update badges
     */
    updateBadges() {
        const totalBadge = document.getElementById('totalDisplayVideosCount');
        const selectedBadge = document.getElementById('selectedDisplayVideosCount');
        
        if (totalBadge) totalBadge.innerHTML = `<i class="fas fa-video me-1"></i>Playlist: ${this.playlist.length}`;
        if (selectedBadge) selectedBadge.style.display = 'none'; // Not needed for playlist
    }

    /**
     * Render playlist table
     */
    renderPlaylistTable() {
        const tableBody = document.getElementById('videoDisplayTableBody');
        if (!tableBody) return;

        if (this.playlist.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <div class="d-flex flex-column align-items-center">
                            <i class="fas fa-film fa-3x text-muted mb-3"></i>
                            <p class="text-muted mb-2">Playlist is empty</p>
                            <button class="btn btn-sm btn-primary" onclick="window.adminPanel.modules.get('videoDisplay').instance.showAddYouTubeModal()">
                                Add YouTube Video
                            </button>
                        </div>
                    </td>
                </tr>`;
            return;
        }

        let html = '';
        this.playlist.forEach((video, index) => {
            const isYouTube = video.type === 'youtube';
            const icon = isYouTube ? '<i class="fab fa-youtube text-danger fa-lg"></i>' : '<i class="fas fa-video text-primary fa-lg"></i>';
            const typeLabel = isYouTube ? 'YouTube' : 'Local File';
            
            html += `
                <tr>
                    <td class="text-center fw-bold">${index + 1}</td>
                    <td class="text-center">${icon}</td>
                    <td>
                        <div class="fw-bold">${video.name || 'Untitled'}</div>
                        <div class="text-muted small">${video.path || ''}</div>
                    </td>
                    <td class="text-center"><span class="badge bg-secondary">${typeLabel}</span></td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-outline-secondary" onclick="window.adminPanel.modules.get('videoDisplay').instance.moveVideo(${index}, -1)" ${index === 0 ? 'disabled' : ''}><i class="fas fa-arrow-up"></i></button>
                        <button class="btn btn-sm btn-outline-secondary" onclick="window.adminPanel.modules.get('videoDisplay').instance.moveVideo(${index}, 1)" ${index === this.playlist.length - 1 ? 'disabled' : ''}><i class="fas fa-arrow-down"></i></button>
                    </td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-outline-danger" onclick="window.adminPanel.modules.get('videoDisplay').instance.removeVideo(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>`;
        });

        tableBody.innerHTML = html;
        
        // Update table headers to match new columns
        const thead = document.querySelector('#video-display-section thead tr');
        if (thead) {
            thead.innerHTML = `
                <th style="width: 50px;">No</th>
                <th style="width: 50px;">Type</th>
                <th>Video Name & Path</th>
                <th style="width: 100px;">Format</th>
                <th style="width: 100px;">Order</th>
                <th style="width: 80px;">Actions</th>
            `;
        }
    }

    /**
     * Show Add YouTube Video Modal
     */
    showAddYouTubeModal() {
        // Create modal if not exists
        if (!document.getElementById('addYouTubeModal')) {
            const modalHtml = `
                <div class="modal fade" id="addYouTubeModal" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title"><i class="fab fa-youtube text-danger me-2"></i>Add YouTube Video</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <form id="addYouTubeForm">
                                    <div class="mb-3">
                                        <label class="form-label">Video Title</label>
                                        <input type="text" class="form-control" id="ytVideoTitle" required placeholder="e.g. Intro to BIM">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">YouTube URL</label>
                                        <input type="url" class="form-control" id="ytVideoUrl" required placeholder="https://www.youtube.com/watch?v=...">
                                        <div class="form-text">Paste the full YouTube video URL here.</div>
                                    </div>
                                </form>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="button" class="btn btn-primary" onclick="window.adminPanel.modules.get('videoDisplay').instance.addYouTubeVideo()">Add Video</button>
                            </div>
                        </div>
                    </div>
                </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }
        
        // Clear form
        document.getElementById('ytVideoTitle').value = '';
        document.getElementById('ytVideoUrl').value = '';
        
        const modal = new bootstrap.Modal(document.getElementById('addYouTubeModal'));
        modal.show();
    }

    /**
     * Add YouTube Video Logic
     */
    async addYouTubeVideo() {
        const title = document.getElementById('ytVideoTitle').value;
        const url = document.getElementById('ytVideoUrl').value;

        if (!title || !url) {
            this.showNotification('Harap lengkapi semua field.', 'warning');
            return;
        }

        // Basic validation
        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
            this.showNotification('Link YouTube tidak valid.', 'warning');
            return;
        }

        const newVideo = {
            id: 'yt-' + Date.now(),
            name: title,
            path: url,
            type: 'youtube',
            date: new Date().toISOString()
        };

        this.playlist.push(newVideo);
        
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('addYouTubeModal')).hide();
        
        // Refresh table
        this.renderPlaylistTable();
        this.updateBadges();
        
        this.showNotification('Video ditambahkan ke playlist. Klik Save Selection untuk menyimpan.', 'info');
    }

    /**
     * Remove video from playlist
     */
    async removeVideo(index) {
        if (!confirm('Are you sure you want to remove this video from the playlist?')) return;
        
        this.playlist.splice(index, 1);
        this.renderPlaylistTable();
        this.updateBadges();
        this.showNotification('Video dihapus dari daftar. Klik Save Selection untuk menyimpan.', 'info');
    }

    /**
     * Move video order
     */
    async moveVideo(index, direction) {
        if (index + direction < 0 || index + direction >= this.playlist.length) return;
        
        const temp = this.playlist[index];
        this.playlist[index] = this.playlist[index + direction];
        this.playlist[index + direction] = temp;
        
        this.renderPlaylistTable();
        this.showNotification('Urutan playlist diubah. Klik Save Selection untuk menyimpan.', 'info');
    }

    /**
     * Save playlist from "Save Selection" button
     */
    async saveVideoDisplaySelection() {
        const saveButton = document.querySelector('#video-display-section .btn.btn-success[onclick*="saveVideoDisplaySelection"]');
        const originalHtml = saveButton ? saveButton.innerHTML : '';

        if (saveButton) {
            saveButton.disabled = true;
            saveButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';
        }

        try {
            await this.savePlaylist();
            this.showNotification('Playlist video berhasil disimpan.', 'success');
        } catch (error) {
            this.showNotification(`Gagal menyimpan playlist: ${error.message}`, 'danger');
        } finally {
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.innerHTML = originalHtml || '<i class="fas fa-save me-2"></i>Save Selection';
            }
        }
    }

    /**
     * Save playlist to server
     */
    async savePlaylist() {
        try {
            const response = await fetch('/api/admin/video-display/update', {
                method: 'POST',
                headers: this.getAuthHeaders({
                    'Content-Type': 'application/json'
                }),
                credentials: 'include',
                body: JSON.stringify({
                    playlist: this.playlist,
                    settings: this.displaySettings
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Failed to save playlist (${response.status}): ${errText}`);
            }
            console.log('âœ… Playlist saved successfully');
        } catch (error) {
            console.error('âŒ Error saving playlist:', error);
            throw error;
        }
    }
}

// Initialize and register the video display module immediately when script loads
(function() {
    console.log('ðŸ“º Initializing Video Display Module...');

    // Ensure adminPanel exists
    if (!window.adminPanel) {
        console.error('âŒ window.adminPanel not found - video display module cannot initialize');
        return;
    }

    // Ensure modules Map exists
    if (!window.adminPanel.modules) {
        console.error('âŒ window.adminPanel.modules not found - video display module cannot initialize');
        return;
    }

    try {
        // Create video display module instance
        const videoDisplayModule = new VideoDisplayModule(window.adminPanel);

        // Set up the module entry
        window.adminPanel.modules.set('videoDisplay', {
            loaded: true,
            path: 'modules/video-display.js',
            instance: videoDisplayModule
        });

        // Initialize the module
        videoDisplayModule.initialize();
        // Legacy global handlers used by inline onclick in adminbcl.html
        window.loadVideoDisplayManagement = () => videoDisplayModule.loadVideoDisplayManagement();
        window.saveVideoDisplaySelection = () => videoDisplayModule.saveVideoDisplaySelection();
        window.selectAllDisplayVideos = () => videoDisplayModule.showNotification('Gunakan Add YouTube Video untuk menambah item playlist.', 'info');
        window.clearAllDisplayVideos = () => videoDisplayModule.showNotification('Gunakan tombol hapus per item, lalu klik Save Selection.', 'info');

        console.log('âœ… Video Display module initialized and registered successfully');
    } catch (error) {
        console.error('âŒ Failed to initialize video display module:', error);
    }
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoDisplayModule;
}

