/**
 * News Module - Manages local news for ticker + full updates page content
 */
class NewsModule {
    constructor(adminPanel) {
        this.adminPanel = adminPanel;
        this.newsData = [];
        this.currentEditId = null;
        this.mediaDraft = [];
        this.defaultNewsImage = '/img/ready.jpg';
        this.loadPromise = null;
    }

    initialize() {
        console.log('Initializing News Module');
    }

    getRequestHeaders(extraHeaders = {}) {
        const headers = { ...extraHeaders };
        const token = this.adminPanel?.getStoredAdminToken?.();
        if (token && !headers.Authorization) {
            headers.Authorization = `Bearer ${token}`;
        }
        return headers;
    }

    async load() {
        if (this.loadPromise) return this.loadPromise;
        this.loadPromise = this.loadNews();
        try {
            return await this.loadPromise;
        } finally {
            this.loadPromise = null;
        }
    }

    async loadNews() {
        const content = document.getElementById('news-content');
        if (!content) return;

        content.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h5 class="mb-0">News Management</h5>
                    <small class="text-muted">Kalimat utama untuk sticker news + berita lengkap untuk halaman updates</small>
                    <div class="mt-2">
                        <span class="badge bg-info fs-6" id="totalNewsCount">
                            <i class="fas fa-newspaper me-1"></i>Total: 0 berita
                        </span>
                    </div>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-outline-primary" onclick="safeCall('news', 'refreshNews')">
                        <i class="fas fa-sync-alt me-2"></i>Refresh
                    </button>
                    <button class="btn btn-modern-primary" onclick="safeCall('news', 'showCreateNewsModal')">
                        <i class="fas fa-plus me-2"></i>Tambah Berita
                    </button>
                </div>
            </div>

            <div class="row g-3 mb-4">
                <div class="col-md-8">
                    <input type="text" class="form-control" id="newsSearchInput"
                        placeholder="Cari judul, kalimat utama, atau isi berita..." onkeyup="safeCall('news', 'filterNews')">
                </div>
                <div class="col-md-4">
                    <select class="form-select" id="newsCategoryFilter" onchange="safeCall('news', 'filterNews')">
                        <option value="">Semua Kategori</option>
                        <option value="BIM">BIM</option>
                        <option value="Technology">Technology</option>
                        <option value="Infrastructure">Infrastructure</option>
                        <option value="Education">Education</option>
                        <option value="Regulation">Regulation</option>
                        <option value="Construction">Construction</option>
                    </select>
                </div>
            </div>

            <div class="table-responsive">
                <table class="table table-hover">
                    <thead class="table-dark">
                        <tr>
                            <th style="width: 55px;">No</th>
                            <th style="width: 80px;">Image</th>
                            <th>Judul</th>
                            <th>Kalimat Utama (Sticker)</th>
                            <th style="width: 150px;">Tanggal</th>
                            <th style="width: 140px;">Source</th>
                            <th style="width: 140px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="newsTableBody">
                        <tr>
                            <td colspan="7" class="text-center py-4">
                                <div class="spinner-border text-primary" role="status"></div>
                                <p class="mb-0 mt-2 text-muted">Memuat data berita...</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;

        await this.refreshNews();
    }

    async refreshNews() {
        try {
            const response = await fetch('/api/news/local-news/admin', {
                method: 'GET',
                cache: 'no-store',
                credentials: 'include',
                headers: this.getRequestHeaders({ Accept: 'application/json' })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            this.newsData = Array.isArray(data) ? data : [];
            this.newsData.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

            this.updateNewsCount(this.newsData.length);
            this.displayNews(this.newsData);
        } catch (error) {
            console.error('Failed to load news:', error);
            this.showError('Gagal memuat data berita dari server.');
        }
    }

    updateNewsCount(count) {
        const badge = document.getElementById('totalNewsCount');
        if (!badge) return;
        badge.innerHTML = `<i class="fas fa-newspaper me-1"></i>Total: ${count} berita`;
    }

    displayNews(newsList) {
        const tbody = document.getElementById('newsTableBody');
        if (!tbody) return;

        if (!Array.isArray(newsList) || newsList.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <i class="fas fa-newspaper fa-3x text-muted mb-2"></i>
                        <p class="text-muted mb-0">Belum ada data berita.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = newsList.map((news, index) => {
            const mediaItems = this.normalizeMediaItems(news.media, news.urlToImage);
            const image = this.escapeAttr(mediaItems.find((item) => item.type === 'image')?.url || this.defaultNewsImage);
            const mediaLabel = mediaItems.length > 1
                ? `<small class="text-muted d-block mt-1"><i class="fas fa-photo-video me-1"></i>${mediaItems.length} media</small>`
                : '';
            const sticker = this.escapeHtml(this.truncate(news.stickerText || news.description || '-', 95));
            const title = this.escapeHtml(news.title || '-');
            const source = this.escapeHtml(news.source?.name || 'BCL Admin');
            const dateLabel = this.formatDate(news.publishedAt);

            return `
                <tr>
                    <td class="text-center fw-bold">${index + 1}</td>
                    <td>
                        <img src="${image}" alt="news image" style="width:56px;height:40px;object-fit:cover;border-radius:6px;" onerror="this.onerror=null;this.src='${this.defaultNewsImage}'">
                        ${mediaLabel}
                    </td>
                    <td>
                        <div class="fw-semibold">${title}</div>
                        <small class="text-muted">${this.escapeHtml(news.category || 'BIM')}</small>
                    </td>
                    <td>${sticker}</td>
                    <td>${dateLabel}</td>
                    <td>${source}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-info" onclick="safeCall('news', 'previewNews', '${news.id}')" title="Preview">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-outline-primary" onclick="safeCall('news', 'editNews', '${news.id}')" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="safeCall('news', 'deleteNews', '${news.id}', '${this.escapeJs(news.title || '')}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    filterNews() {
        const searchTerm = (document.getElementById('newsSearchInput')?.value || '').toLowerCase().trim();
        const categoryFilter = (document.getElementById('newsCategoryFilter')?.value || '').toLowerCase().trim();

        const filtered = this.newsData.filter((news) => {
            const title = (news.title || '').toLowerCase();
            const sticker = (news.stickerText || news.description || '').toLowerCase();
            const fullContent = (news.fullContent || news.content || '').toLowerCase();
            const category = (news.category || '').toLowerCase();

            const matchSearch =
                !searchTerm ||
                title.includes(searchTerm) ||
                sticker.includes(searchTerm) ||
                fullContent.includes(searchTerm);

            const matchCategory = !categoryFilter || category === categoryFilter;
            return matchSearch && matchCategory;
        });

        this.displayNews(filtered);
    }

    showCreateNewsModal(newsId = null) {
        this.currentEditId = newsId;
        const editingNews = newsId ? this.newsData.find((item) => item.id === newsId) : null;
        this.mediaDraft = this.normalizeMediaItems(editingNews?.media, editingNews?.urlToImage);
        const modalId = 'newsModal';
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const titleValue = editingNews?.title || '';
        const stickerValue = editingNews?.stickerText || editingNews?.description || '';
        const fullContentValue = editingNews?.fullContent || editingNews?.content || '';
        const categoryValue = editingNews?.category || 'BIM';
        const sourceValue = editingNews?.source?.name || 'BCL Admin';
        const urlValue = editingNews?.url && editingNews.url !== '#' ? editingNews.url : '';
        const publishValue = this.formatDateTimeLocal(editingNews?.publishedAt);

        const modalHtml = `
            <div class="modal fade" id="${modalId}" tabindex="-1">
                <div class="modal-dialog modal-xl modal-dialog-scrollable news-editor-modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-newspaper me-2"></i>${editingNews ? 'Edit Berita' : 'Tambah Berita'}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="newsForm" class="news-form-layout">
                            <div class="modal-body news-form-body">
                                <div class="row g-3">
                                    <div class="col-md-8">
                                        <label class="form-label">Judul Berita *</label>
                                        <input type="text" class="form-control" id="newsTitle" required maxlength="180" value="${this.escapeAttr(titleValue)}">
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">Kategori</label>
                                        <select class="form-select" id="newsCategory">
                                            ${this.renderCategoryOptions(categoryValue)}
                                        </select>
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label">Kalimat Utama (untuk sticker news) *</label>
                                        <textarea class="form-control" id="newsStickerText" rows="2" required maxlength="280"
                                            placeholder="Contoh: BIM NKE berhasil menurunkan biaya proyek hingga 20% lewat optimasi koordinasi model.">${this.escapeHtml(stickerValue)}</textarea>
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label">Berita Lengkap (untuk halaman updates) *</label>
                                        <textarea class="form-control" id="newsFullContent" rows="8" required
                                            placeholder="Masukkan isi berita lengkap di sini...">${this.escapeHtml(fullContentValue)}</textarea>
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">Sumber</label>
                                        <input type="text" class="form-control" id="newsSource" value="${this.escapeAttr(sourceValue)}" placeholder="Contoh: BCL Admin">
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">Tanggal Publish</label>
                                        <input type="datetime-local" class="form-control" id="newsPublishedAt" value="${publishValue}">
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">Link Referensi (Opsional)</label>
                                        <input type="url" class="form-control" id="newsUrl" value="${this.escapeAttr(urlValue)}" placeholder="https://...">
                                    </div>
                                    <div class="col-12">
                                        <section class="news-media-editor" aria-labelledby="newsMediaHeading">
                                            <div class="news-media-editor__heading">
                                                <div>
                                                    <h6 id="newsMediaHeading" class="mb-1"><i class="fas fa-photo-video me-2"></i>Foto & Video</h6>
                                                    <p class="mb-0">Gambar pertama menjadi thumbnail. Maksimal 12 media per berita.</p>
                                                </div>
                                                <span class="news-media-count" id="newsMediaCount">0 media</span>
                                            </div>
                                            <div class="news-media-editor__controls">
                                                <div>
                                                    <label class="form-label" for="newsMediaType">Jenis URL</label>
                                                    <select class="form-select" id="newsMediaType">
                                                        <option value="image">Foto</option>
                                                        <option value="video">Video / YouTube</option>
                                                    </select>
                                                </div>
                                                <div class="news-media-url-field">
                                                    <label class="form-label" for="newsMediaUrl">URL media</label>
                                                    <input type="url" class="form-control" id="newsMediaUrl" placeholder="https://...">
                                                </div>
                                                <button type="button" class="btn btn-outline-primary news-media-add" id="newsAddMediaUrlBtn">
                                                    <i class="fas fa-plus me-1"></i>Tambah URL
                                                </button>
                                            </div>
                                            <div class="news-media-upload">
                                                <label class="form-label" for="newsMediaFiles">Upload beberapa foto atau video</label>
                                                <input type="file" class="form-control" id="newsMediaFiles" multiple
                                                    accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/ogg">
                                                <small>Foto JPG/PNG/WebP/GIF maksimal 12MB; video MP4/WebM/Ogg maksimal 80MB. Maksimal 10 file sekali pilih.</small>
                                                <div id="newsPendingFiles" class="news-pending-files" aria-live="polite"></div>
                                            </div>
                                            <div id="newsMediaList" class="news-media-list" aria-live="polite"></div>
                                        </section>
                                    </div>
                                    <div class="col-12">
                                        <div class="alert alert-light border mb-0 py-2">
                                            <i class="fas fa-circle-info me-2 text-info"></i>
                                            Video YouTube dapat ditambahkan melalui URL. Urutan media dapat diubah dengan tombol panah.
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer news-form-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                                <button type="submit" class="btn btn-primary" id="newsSubmitBtn">
                                    <i class="fas fa-save me-2"></i>${editingNews ? 'Update Berita' : 'Simpan Berita'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.bindNewsModalEvents(editingNews);
        this.renderMediaDraft();

        const modal = new bootstrap.Modal(document.getElementById(modalId));
        modal.show();
    }

    bindNewsModalEvents() {
        const form = document.getElementById('newsForm');
        const mediaUrlInput = document.getElementById('newsMediaUrl');
        const mediaTypeInput = document.getElementById('newsMediaType');
        const mediaFilesInput = document.getElementById('newsMediaFiles');
        const addMediaButton = document.getElementById('newsAddMediaUrlBtn');
        const mediaList = document.getElementById('newsMediaList');

        const addMediaUrl = () => {
            const type = mediaTypeInput?.value === 'video' ? 'video' : 'image';
            const url = this.normalizeMediaUrl(mediaUrlInput?.value, type);
            if (!url) {
                alert('Masukkan URL media HTTP/HTTPS yang valid.');
                mediaUrlInput?.focus();
                return;
            }
            if (this.mediaDraft.length >= 12) {
                alert('Maksimal 12 media per berita.');
                return;
            }
            if (this.mediaDraft.some((item) => item.type === type && item.url === url)) {
                alert('Media tersebut sudah ada di daftar.');
                return;
            }
            this.mediaDraft.push({ type, url, caption: '' });
            if (mediaUrlInput) mediaUrlInput.value = '';
            this.renderMediaDraft();
        };

        addMediaButton?.addEventListener('click', addMediaUrl);
        mediaUrlInput?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                addMediaUrl();
            }
        });
        mediaFilesInput?.addEventListener('change', () => this.renderPendingFiles());
        mediaList?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-media-action]');
            if (!button) return;
            const index = Number(button.dataset.mediaIndex);
            if (!Number.isInteger(index) || !this.mediaDraft[index]) return;

            if (button.dataset.mediaAction === 'remove') {
                this.mediaDraft.splice(index, 1);
            } else if (button.dataset.mediaAction === 'up' && index > 0) {
                [this.mediaDraft[index - 1], this.mediaDraft[index]] = [this.mediaDraft[index], this.mediaDraft[index - 1]];
            } else if (button.dataset.mediaAction === 'down' && index < this.mediaDraft.length - 1) {
                [this.mediaDraft[index + 1], this.mediaDraft[index]] = [this.mediaDraft[index], this.mediaDraft[index + 1]];
            }
            this.renderMediaDraft();
        });

        form?.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (this.currentEditId) {
                await this.updateNews(this.currentEditId);
            } else {
                await this.createNews();
            }
        });
    }

    async createNews() {
        await this.saveNewsRequest({
            url: '/api/news/local-news',
            method: 'POST',
            successMessage: 'Berita berhasil ditambahkan.'
        });
    }

    editNews(newsId) {
        this.showCreateNewsModal(newsId);
    }

    async updateNews(newsId) {
        await this.saveNewsRequest({
            url: `/api/news/local-news/${encodeURIComponent(newsId)}`,
            method: 'PUT',
            successMessage: 'Berita berhasil diperbarui.'
        });
    }

    async saveNewsRequest({ url, method, successMessage }) {
        const submitBtn = document.getElementById('newsSubmitBtn');
        const originalBtnText = submitBtn?.innerHTML || '';

        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Menyimpan...';
            }

            const payload = await this.collectFormPayload();
            const requestBody = JSON.stringify(payload);
            if (requestBody.length > 98000) {
                throw new Error('Payload berita terlalu besar untuk gateway. Kecilkan gambar atau gunakan URL gambar.');
            }
            const response = await fetch(url, {
                method,
                headers: this.getRequestHeaders({
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                }),
                credentials: 'include',
                body: requestBody
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(this.formatApiError(response.status, errText));
            }

            const modalEl = document.getElementById('newsModal');
            if (modalEl) {
                bootstrap.Modal.getInstance(modalEl)?.hide();
            }
            this.currentEditId = null;
            await this.refreshNews();
            alert(successMessage);
        } catch (error) {
            console.error('Failed to save news:', error);
            alert(`Gagal menyimpan berita: ${error.message}`);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        }
    }

    async collectFormPayload() {
        const title = (document.getElementById('newsTitle')?.value || '').trim();
        const stickerText = (document.getElementById('newsStickerText')?.value || '').trim();
        const fullContent = (document.getElementById('newsFullContent')?.value || '').trim();
        const category = (document.getElementById('newsCategory')?.value || 'BIM').trim();
        const sourceName = (document.getElementById('newsSource')?.value || 'BCL Admin').trim();
        const url = (document.getElementById('newsUrl')?.value || '#').trim() || '#';
        const publishedInput = (document.getElementById('newsPublishedAt')?.value || '').trim();
        const mediaFiles = Array.from(document.getElementById('newsMediaFiles')?.files || []);

        if (!title || !stickerText || !fullContent) {
            throw new Error('Judul, kalimat utama, dan berita lengkap wajib diisi.');
        }

        if (this.mediaDraft.length + mediaFiles.length > 12) {
            throw new Error('Maksimal 12 media per berita. Kurangi file atau media URL.');
        }
        if (mediaFiles.length > 10) {
            throw new Error('Maksimal 10 file dalam satu kali upload.');
        }
        if (mediaFiles.length) {
            const uploadedMedia = await this.uploadMediaFiles(mediaFiles);
            this.mediaDraft.push(...uploadedMedia);
            const input = document.getElementById('newsMediaFiles');
            if (input) input.value = '';
            this.renderPendingFiles();
            this.renderMediaDraft();
        }

        const media = this.normalizeMediaItems(this.mediaDraft).slice(0, 12);
        const urlToImage = media.find((item) => item.type === 'image')?.url || '';

        return {
            title,
            stickerText,
            fullContent,
            description: stickerText,
            category,
            source: { name: sourceName || 'BCL Admin' },
            url: url || '#',
            urlToImage,
            media,
            publishedAt: publishedInput ? new Date(publishedInput).toISOString() : new Date().toISOString(),
            status: 'published'
        };
    }

    async uploadMediaFiles(files) {
        const formData = new FormData();
        files.forEach((file) => {
            const type = String(file.type || '').toLowerCase();
            const isImage = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type);
            const isVideo = ['video/mp4', 'video/webm', 'video/ogg'].includes(type);
            if (!isImage && !isVideo) {
                throw new Error(`Format file ${file.name} tidak didukung.`);
            }
            if (isImage && file.size > 12 * 1024 * 1024) {
                throw new Error(`Gambar ${file.name} melebihi 12MB.`);
            }
            if (isVideo && file.size > 80 * 1024 * 1024) {
                throw new Error(`Video ${file.name} melebihi 80MB.`);
            }
            formData.append('media', file, file.name);
        });

        const response = await fetch('/api/news/media-upload', {
            method: 'POST',
            headers: this.getRequestHeaders(),
            credentials: 'include',
            body: formData
        });
        if (!response.ok) {
            throw new Error(this.formatApiError(response.status, await response.text()));
        }
        const payload = await response.json();
        return this.normalizeMediaItems(payload.media);
    }

    normalizeMediaUrl(value, type = 'image') {
        const raw = String(value || '').trim().replace(/\\/g, '/');
        if (!raw) return '';
        if (type === 'image' && /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(raw)) return raw;
        if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
        try {
            const url = new URL(raw, window.location.origin);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
        } catch {
            return '';
        }
    }

    normalizeMediaItems(items, legacyImage = '') {
        const result = [];
        const seen = new Set();
        const source = Array.isArray(items) ? items : [];
        source.forEach((item) => {
            if (!item || typeof item !== 'object') return;
            const type = item.type === 'video' ? 'video' : 'image';
            const url = this.normalizeMediaUrl(item.url || item.src, type);
            if (!url || seen.has(`${type}:${url}`)) return;
            seen.add(`${type}:${url}`);
            result.push({ type, url, caption: String(item.caption || '').trim().slice(0, 240) });
        });

        const normalizedLegacy = this.normalizeMediaUrl(legacyImage, 'image');
        if (normalizedLegacy && !result.some((item) => item.type === 'image' && item.url === normalizedLegacy)) {
            result.unshift({ type: 'image', url: normalizedLegacy, caption: '' });
        }
        return result.slice(0, 12);
    }

    renderPendingFiles() {
        const container = document.getElementById('newsPendingFiles');
        if (!container) return;
        const files = Array.from(document.getElementById('newsMediaFiles')?.files || []);
        container.innerHTML = files.length
            ? files.map((file) => `
                <span class="news-pending-file">
                    <i class="fas ${String(file.type).startsWith('video/') ? 'fa-video' : 'fa-image'}"></i>
                    ${this.escapeHtml(this.truncate(file.name, 34))}
                </span>`).join('')
            : '';
    }

    renderMediaDraft() {
        const container = document.getElementById('newsMediaList');
        const counter = document.getElementById('newsMediaCount');
        if (counter) counter.textContent = `${this.mediaDraft.length} media`;
        if (!container) return;
        if (!this.mediaDraft.length) {
            container.innerHTML = `
                <div class="news-media-empty">
                    <i class="far fa-images"></i>
                    <span>Belum ada media. Tambahkan foto atau video dari URL maupun file.</span>
                </div>`;
            return;
        }

        let firstImageMarked = false;
        container.innerHTML = this.mediaDraft.map((item, index) => {
            const isPrimary = item.type === 'image' && !firstImageMarked;
            if (isPrimary) firstImageMarked = true;
            const mediaVisual = item.type === 'image'
                ? `<img src="${this.escapeAttr(item.url)}" alt="Preview media ${index + 1}" onerror="this.onerror=null;this.src='${this.defaultNewsImage}'">`
                : `<span class="news-media-video-icon"><i class="fas fa-play"></i></span>`;
            return `
                <article class="news-media-item">
                    <div class="news-media-item__visual">${mediaVisual}</div>
                    <div class="news-media-item__info">
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                            <strong>${item.type === 'video' ? 'Video' : 'Foto'} ${index + 1}</strong>
                            ${isPrimary ? '<span class="badge bg-primary">Thumbnail utama</span>' : ''}
                        </div>
                        <span title="${this.escapeAttr(item.url)}">${this.escapeHtml(this.truncate(item.url, 74))}</span>
                    </div>
                    <div class="news-media-item__actions" aria-label="Atur media">
                        <button type="button" class="btn btn-sm btn-outline-secondary" data-media-action="up" data-media-index="${index}" ${index === 0 ? 'disabled' : ''} title="Naikkan"><i class="fas fa-arrow-up"></i></button>
                        <button type="button" class="btn btn-sm btn-outline-secondary" data-media-action="down" data-media-index="${index}" ${index === this.mediaDraft.length - 1 ? 'disabled' : ''} title="Turunkan"><i class="fas fa-arrow-down"></i></button>
                        <button type="button" class="btn btn-sm btn-outline-danger" data-media-action="remove" data-media-index="${index}" title="Hapus"><i class="fas fa-trash"></i></button>
                    </div>
                </article>`;
        }).join('');
    }

    formatApiError(status, rawText) {
        const text = String(rawText || '').trim();

        if (status === 413 || /payloadtoolarge|entity too large|request entity too large/i.test(text)) {
            return 'Ukuran upload melebihi batas gateway. Coba gambar dengan resolusi lebih kecil, lalu simpan lagi.';
        }

        if (!text) {
            return `HTTP ${status}`;
        }

        if (text.startsWith('{') || text.startsWith('[')) {
            try {
                const parsed = JSON.parse(text);
                if (parsed && typeof parsed === 'object') {
                    return parsed.error || parsed.message || `HTTP ${status}`;
                }
            } catch (error) {
                // ignore JSON parse failure
            }
        }

        if (/<\/?[a-z][\s\S]*>/i.test(text)) {
            return `Server error (HTTP ${status}).`;
        }

        return text;
    }

    previewNews(newsId) {
        const news = this.newsData.find((item) => item.id === newsId);
        if (!news) {
            alert('Data berita tidak ditemukan.');
            return;
        }

        const modalId = 'newsPreviewModal';
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();
        const previewMedia = this.normalizeMediaItems(news.media, news.urlToImage);

        const previewHtml = `
            <div class="modal fade" id="${modalId}" tabindex="-1">
                <div class="modal-dialog modal-xl modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"><i class="fas fa-eye me-2"></i>Preview Berita</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row g-4">
                                <div class="col-md-5">
                                    ${this.renderAdminMediaGallery(previewMedia, news.title)}
                                </div>
                                <div class="col-md-7">
                                    <h4>${this.escapeHtml(news.title || '-')}</h4>
                                    <p class="mb-2"><strong>Kalimat Utama:</strong></p>
                                    <div class="p-3 border rounded bg-light mb-3">${this.escapeHtml(news.stickerText || news.description || '-')}</div>
                                    <p class="mb-2"><strong>Berita Lengkap:</strong></p>
                                    <div class="p-3 border rounded" style="white-space:pre-wrap;">${this.escapeHtml(news.fullContent || news.content || '-')}</div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-primary" onclick="safeCall('news', 'editNews', '${news.id}')">
                                <i class="fas fa-edit me-2"></i>Edit
                            </button>
                            <button class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', previewHtml);
        new bootstrap.Modal(document.getElementById(modalId)).show();
    }

    renderAdminMediaGallery(media, title) {
        if (!media.length) {
            return `<img src="${this.defaultNewsImage}" alt="Media belum tersedia" class="img-fluid rounded border">`;
        }
        return `<div class="news-preview-gallery">${media.map((item, index) => {
            if (item.type === 'image') {
                return `<img src="${this.escapeAttr(item.url)}" alt="${this.escapeAttr(title)} ${index + 1}" onerror="this.onerror=null;this.src='${this.defaultNewsImage}'">`;
            }
            const youtubeId = this.getYoutubeId(item.url);
            if (youtubeId) {
                return `<div class="ratio ratio-16x9"><iframe src="https://www.youtube-nocookie.com/embed/${youtubeId}" title="Video ${this.escapeAttr(title)}" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
            }
            return `<video controls preload="metadata" playsinline><source src="${this.escapeAttr(item.url)}">Browser tidak mendukung video ini.</video>`;
        }).join('')}</div>`;
    }

    getYoutubeId(value) {
        try {
            const url = new URL(String(value || ''), window.location.origin);
            const host = url.hostname.replace(/^www\./, '').toLowerCase();
            if (host === 'youtu.be') return /^[\w-]{6,15}$/.test(url.pathname.slice(1)) ? url.pathname.slice(1) : '';
            if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
                const candidate = url.searchParams.get('v') || url.pathname.match(/\/(?:embed|shorts)\/([\w-]{6,15})/)?.[1] || '';
                return /^[\w-]{6,15}$/.test(candidate) ? candidate : '';
            }
        } catch {
            return '';
        }
        return '';
    }

    async deleteNews(newsId, title) {
        const ok = confirm(`Hapus berita "${title}"?\n\nTindakan ini tidak dapat dibatalkan.`);
        if (!ok) return;

        try {
            const response = await fetch(`/api/news/local-news/${encodeURIComponent(newsId)}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: this.getRequestHeaders({ Accept: 'application/json' })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || `HTTP ${response.status}`);
            }

            await this.refreshNews();
            alert('Berita berhasil dihapus.');
        } catch (error) {
            console.error('Failed to delete news:', error);
            alert(`Gagal menghapus berita: ${error.message}`);
        }
    }

    showError(message) {
        const content = document.getElementById('news-content');
        if (!content) return;

        content.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>${this.escapeHtml(message)}
            </div>
        `;
    }

    renderCategoryOptions(selectedValue) {
        const categories = ['BIM', 'Technology', 'Infrastructure', 'Education', 'Regulation', 'Construction', 'General'];
        return categories
            .map((category) => `<option value="${category}" ${selectedValue === category ? 'selected' : ''}>${category}</option>`)
            .join('');
    }

    formatDate(isoString) {
        if (!isoString) return '-';
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    formatDateTimeLocal(isoString) {
        if (!isoString) return '';
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) return '';
        const offset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - offset).toISOString().slice(0, 16);
    }

    truncate(text, maxLength) {
        const value = text || '';
        if (value.length <= maxLength) return value;
        return `${value.slice(0, maxLength - 1)}...`;
    }

    resolveImageUrl(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (/^data:image\//i.test(raw)) return raw;
        if (/^https?:\/\//i.test(raw) || raw.startsWith('//')) return raw;
        if (raw.startsWith('/')) return raw;

        const cleaned = raw.replace(/\\/g, '/').replace(/^[./]+/, '');
        if (cleaned.toLowerCase().startsWith('img/')) {
            return `/${cleaned}`;
        }

        return raw;
    }

    escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    escapeAttr(value) {
        return this.escapeHtml(value).replace(/`/g, '&#96;');
    }

    escapeJs(value) {
        return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    }
}

(function initializeNewsModule() {
    console.log('Initializing News Module...');

    if (!window.adminPanel || !window.adminPanel.modules) {
        console.error('Admin panel is not ready - news module cannot initialize');
        return;
    }

    try {
        const newsModule = new NewsModule(window.adminPanel);
        window.adminPanel.modules.set('news', {
            loaded: true,
            path: 'modules/news.js',
            instance: newsModule
        });

        newsModule.initialize();
        console.log('News module initialized and registered successfully');
    } catch (error) {
        console.error('Failed to initialize news module:', error);
    }
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NewsModule;
}
