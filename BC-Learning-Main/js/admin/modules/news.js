/**
 * News Module - Manages local news for ticker + full updates page content
 */
class NewsModule {
    constructor(adminPanel) {
        this.adminPanel = adminPanel;
        this.newsData = [];
        this.currentEditId = null;
        this.defaultNewsImage = '/img/ready.jpg';
        // Keep payload safely under common proxy limits when image is sent as base64 in JSON.
        this.maxImageDataBytes = 60 * 1024;
    }

    initialize() {
        console.log('Initializing News Module');
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
            const response = await fetch('/api/news/local-news', {
                method: 'GET',
                cache: 'no-store',
                credentials: 'include'
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
            const image = this.escapeAttr(this.resolveImageUrl(news.urlToImage));
            const sticker = this.escapeHtml(this.truncate(news.stickerText || news.description || '-', 95));
            const title = this.escapeHtml(news.title || '-');
            const source = this.escapeHtml(news.source?.name || 'BCL Admin');
            const dateLabel = this.formatDate(news.publishedAt);

            return `
                <tr>
                    <td class="text-center fw-bold">${index + 1}</td>
                    <td>
                        <img src="${image}" alt="news image" style="width:56px;height:40px;object-fit:cover;border-radius:6px;" onerror="this.onerror=null;this.src='${this.defaultNewsImage}'">
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
        const modalId = 'newsModal';
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const titleValue = editingNews?.title || '';
        const stickerValue = editingNews?.stickerText || editingNews?.description || '';
        const fullContentValue = editingNews?.fullContent || editingNews?.content || '';
        const categoryValue = editingNews?.category || 'BIM';
        const sourceValue = editingNews?.source?.name || 'BCL Admin';
        const urlValue = editingNews?.url && editingNews.url !== '#' ? editingNews.url : '';
        const normalizedEditImage = this.resolveImageUrl(editingNews?.urlToImage || '');
        const imageValue =
            normalizedEditImage &&
            !normalizedEditImage.startsWith('data:') &&
            normalizedEditImage !== this.defaultNewsImage
                ? normalizedEditImage
                : '';
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
                                    <div class="col-md-6">
                                        <label class="form-label">URL Gambar (Opsional)</label>
                                        <input type="url" class="form-control" id="newsImageUrl" value="${this.escapeAttr(imageValue)}"
                                            placeholder="https://example.com/image.jpg">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Upload Gambar (Opsional)</label>
                                        <input type="file" class="form-control" id="newsImageFile" accept="image/*">
                                        <small class="text-muted">Jika diisi, file upload diprioritaskan daripada URL gambar. Gambar dioptimasi otomatis agar aman untuk batas upload server.</small>
                                    </div>
                                    <div class="col-12">
                                        <div id="newsImagePreviewWrapper" class="d-none">
                                            <label class="form-label">Preview Gambar</label>
                                            <div>
                                                <img id="newsImagePreview" src="" alt="Preview" style="max-width:220px;max-height:140px;object-fit:cover;border-radius:8px;border:1px solid #dee2e6;">
                                            </div>
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

        const modal = new bootstrap.Modal(document.getElementById(modalId));
        modal.show();
    }

    bindNewsModalEvents(editingNews) {
        const form = document.getElementById('newsForm');
        const imageFileInput = document.getElementById('newsImageFile');
        const imageUrlInput = document.getElementById('newsImageUrl');
        const previewWrapper = document.getElementById('newsImagePreviewWrapper');
        const previewImage = document.getElementById('newsImagePreview');

        const updatePreview = async () => {
            let previewSrc = this.resolveImageUrl((imageUrlInput?.value || '').trim());

            if (imageFileInput?.files?.length) {
                try {
                    previewSrc = await this.fileToDataUrl(imageFileInput.files[0]);
                } catch (error) {
                    console.error('Failed to preview image file:', error);
                }
            } else if (!previewSrc && editingNews?.urlToImage) {
                previewSrc = this.resolveImageUrl(editingNews.urlToImage);
            }

            if (previewSrc) {
                previewImage.src = previewSrc;
                previewWrapper.classList.remove('d-none');
            } else {
                previewImage.src = '';
                previewWrapper.classList.add('d-none');
            }
        };

        imageFileInput?.addEventListener('change', () => updatePreview());
        imageUrlInput?.addEventListener('input', () => updatePreview());
        updatePreview();

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
                headers: { 'Content-Type': 'application/json' },
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
        const imageUrlInput = (document.getElementById('newsImageUrl')?.value || '').trim();
        const publishedInput = (document.getElementById('newsPublishedAt')?.value || '').trim();
        const imageFile = document.getElementById('newsImageFile')?.files?.[0];

        if (!title || !stickerText || !fullContent) {
            throw new Error('Judul, kalimat utama, dan berita lengkap wajib diisi.');
        }

        let urlToImage = this.resolveImageUrl(imageUrlInput || '');
        if (/^data:image\//i.test(urlToImage) && this.estimateDataUrlBytes(urlToImage) > this.maxImageDataBytes) {
            throw new Error('Data URL gambar terlalu besar. Gunakan gambar yang lebih kecil.');
        }
        if (imageFile) {
            urlToImage = await this.fileToDataUrl(imageFile);
        } else if (!urlToImage && this.currentEditId) {
            const existing = this.newsData.find((item) => item.id === this.currentEditId);
            urlToImage = this.resolveImageUrl(existing?.urlToImage || '');
        }

        return {
            title,
            stickerText,
            fullContent,
            description: stickerText,
            category,
            source: { name: sourceName || 'BCL Admin' },
            url: url || '#',
            urlToImage: this.resolveImageUrl(urlToImage || this.defaultNewsImage),
            publishedAt: publishedInput ? new Date(publishedInput).toISOString() : new Date().toISOString(),
            status: 'published'
        };
    }

    async fileToDataUrl(file) {
        if (!file) {
            throw new Error('File gambar tidak ditemukan.');
        }

        const fileType = String(file.type || '').toLowerCase();
        if (!fileType.startsWith('image/')) {
            throw new Error('File harus berupa gambar.');
        }
        if (file.size > 20 * 1024 * 1024) {
            throw new Error('Ukuran file gambar terlalu besar. Maksimal 20MB.');
        }

        const image = await this.loadImageFromFile(file);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Gagal memproses gambar (canvas context tidak tersedia).');
        }

        const dimensionSteps = [1280, 1100, 960, 840, 720, 640, 560, 480];
        const qualitySteps = [0.82, 0.72, 0.62, 0.54, 0.46, 0.38, 0.32];
        let bestDataUrl = '';

        for (const maxDimension of dimensionSteps) {
            const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
            const targetWidth = Math.max(1, Math.round(image.width * scale));
            const targetHeight = Math.max(1, Math.round(image.height * scale));

            canvas.width = targetWidth;
            canvas.height = targetHeight;
            ctx.clearRect(0, 0, targetWidth, targetHeight);
            ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

            for (const quality of qualitySteps) {
                const webpCandidate = canvas.toDataURL('image/webp', quality);
                if (webpCandidate.startsWith('data:image/webp')) {
                    bestDataUrl = webpCandidate;
                    if (this.estimateDataUrlBytes(webpCandidate) <= this.maxImageDataBytes) {
                        return webpCandidate;
                    }
                }

                const jpegCandidate = canvas.toDataURL('image/jpeg', quality);
                bestDataUrl = jpegCandidate;
                if (this.estimateDataUrlBytes(jpegCandidate) <= this.maxImageDataBytes) {
                    return jpegCandidate;
                }
            }
        }

        if (bestDataUrl && this.estimateDataUrlBytes(bestDataUrl) <= this.maxImageDataBytes) {
            return bestDataUrl;
        }

        throw new Error('Gambar tidak bisa diperkecil ke batas upload server. Coba gambar lain atau isi URL gambar.');
    }

    readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
            reader.readAsDataURL(file);
        });
    }

    loadImageFromFile(file) {
        return new Promise((resolve, reject) => {
            const objectUrl = URL.createObjectURL(file);
            const image = new Image();

            image.onload = () => {
                URL.revokeObjectURL(objectUrl);
                resolve(image);
            };
            image.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Gagal memuat file gambar.'));
            };

            image.src = objectUrl;
        });
    }

    estimateDataUrlBytes(dataUrl) {
        const value = String(dataUrl || '');
        const commaIndex = value.indexOf(',');
        if (commaIndex < 0) return 0;
        const base64Part = value.slice(commaIndex + 1);
        return Math.floor((base64Part.length * 3) / 4);
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
                                <div class="col-md-4">
                                    <img src="${this.escapeAttr(this.resolveImageUrl(news.urlToImage))}" alt="News Image" class="img-fluid rounded border" onerror="this.onerror=null;this.src='${this.defaultNewsImage}'">
                                </div>
                                <div class="col-md-8">
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

    async deleteNews(newsId, title) {
        const ok = confirm(`Hapus berita "${title}"?\n\nTindakan ini tidak dapat dibatalkan.`);
        if (!ok) return;

        try {
            const response = await fetch(`/api/news/local-news/${encodeURIComponent(newsId)}`, {
                method: 'DELETE',
                credentials: 'include'
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
        if (!raw) return this.defaultNewsImage;
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
