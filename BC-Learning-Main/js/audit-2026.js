(function () {
    const SEARCH_DELAY = 220;
    const API_BASE = "/api/audit-2026";

    const FAMILY_LABELS = {
        pdf: "PDF",
        word: "Word",
        excel: "Excel",
        powerpoint: "PowerPoint",
        image: "Gambar",
        drawing: "Drawing/BIM",
        archive: "Arsip",
        other: "Lainnya",
        file: "File",
        folder: "Folder"
    };

    const FAMILY_ICONS = {
        pdf: "fa-file-pdf",
        word: "fa-file-word",
        excel: "fa-file-excel",
        powerpoint: "fa-file-powerpoint",
        image: "fa-file-image",
        drawing: "fa-cube",
        archive: "fa-file-zipper",
        folder: "fa-folder",
        other: "fa-file",
        file: "fa-file"
    };

    const state = {
        activeTab: "search",
        index: null,
        query: "",
        category: "all",
        family: "all",
        sort: "relevance",
        currentPath: "",
        waitingRetryTimer: null
    };

    document.addEventListener("DOMContentLoaded", initializeAuditPage);

    function getAuditAuthToken() {
        try {
            const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
            const storedUserData = JSON.parse(localStorage.getItem("userData") || "{}");
            return localStorage.getItem("token") || storedUser.token || storedUserData.token || "";
        } catch (error) {
            return localStorage.getItem("token") || "";
        }
    }

    function getAuditFetchOptions(extraOptions = {}) {
        const token = getAuditAuthToken();
        const headers = { ...(extraOptions.headers || {}) };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        return {
            ...extraOptions,
            headers,
            credentials: "include",
            cache: extraOptions.cache || "no-store"
        };
    }

    function initializeAuditPage() {
        bindControls();
        loadInitialData();
    }

    function bindControls() {
        const searchInput = document.getElementById("audit-search-input");
        const categoryFilter = document.getElementById("audit-category-filter");
        const familyFilter = document.getElementById("audit-family-filter");
        const sortFilter = document.getElementById("audit-sort-filter");
        const refreshButton = document.getElementById("audit-refresh-button");

        const debouncedSearch = debounce(() => {
            state.query = searchInput ? searchInput.value.trim() : "";
            searchAuditDocuments();
        }, SEARCH_DELAY);

        if (searchInput) {
            searchInput.addEventListener("input", debouncedSearch);
        }

        if (categoryFilter) {
            categoryFilter.addEventListener("change", () => {
                state.category = categoryFilter.value;
                searchAuditDocuments();
            });
        }

        if (familyFilter) {
            familyFilter.addEventListener("change", () => {
                state.family = familyFilter.value;
                searchAuditDocuments();
            });
        }

        if (sortFilter) {
            sortFilter.addEventListener("change", () => {
                state.sort = sortFilter.value;
                searchAuditDocuments();
            });
        }

        if (refreshButton) {
            refreshButton.addEventListener("click", refreshAuditIndex);
        }

        document.querySelectorAll("[data-audit-tab]").forEach((button) => {
            button.addEventListener("click", () => setActiveTab(button.dataset.auditTab));
        });

        document.addEventListener("click", handleDelegatedClick);
    }

    async function loadInitialData() {
        await loadAuditIndex(false);
        await Promise.all([
            searchAuditDocuments(),
            browseAuditFolder("")
        ]);
    }

    async function loadAuditIndex(forceRefresh) {
        try {
            const response = await fetch(`${API_BASE}/index${forceRefresh ? "?refresh=1" : ""}`, getAuditFetchOptions());
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            state.index = await response.json();
            renderSummary();
            renderFilters();
        } catch (error) {
            renderSearchError(`Indeks audit tidak bisa dibaca: ${error.message}`);
            renderExplorerError(`Folder audit tidak bisa dibaca: ${error.message}`);
        }
    }

    async function refreshAuditIndex() {
        const refreshButton = document.getElementById("audit-refresh-button");
        if (refreshButton) {
            refreshButton.disabled = true;
            refreshButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2" aria-hidden="true"></i>Refresh';
        }

        try {
            await loadAuditIndex(true);
            await Promise.all([
                searchAuditDocuments(),
                browseAuditFolder(state.currentPath || "")
            ]);
            showToast("Index Audit 2026 diperbarui.");
        } finally {
            if (refreshButton) {
                refreshButton.disabled = false;
                refreshButton.innerHTML = '<i class="fas fa-rotate-right me-2" aria-hidden="true"></i>Refresh';
            }
        }
    }

    async function searchAuditDocuments() {
        const tableBody = document.getElementById("audit-search-results");
        const status = document.getElementById("audit-search-status");

        if (tableBody) {
            tableBody.innerHTML = renderLoadingRow("Mencari dokumen audit...");
        }
        if (status) {
            status.textContent = "Mencari dokumen audit...";
        }

        try {
            const params = new URLSearchParams({
                q: state.query,
                category: state.category,
                family: state.family,
                sort: state.sort,
                limit: "200"
            });
            const response = await fetch(`${API_BASE}/search?${params.toString()}`, getAuditFetchOptions());
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const payload = await response.json();
            renderSearchResults(payload);
        } catch (error) {
            renderSearchError(`Search gagal: ${error.message}`);
        }
    }

    async function browseAuditFolder(relativePath) {
        const tableBody = document.getElementById("audit-explorer-entries");
        const status = document.getElementById("audit-explorer-status");

        state.currentPath = relativePath || "";
        if (tableBody) {
            tableBody.innerHTML = renderLoadingRow("Memuat isi folder...");
        }
        if (status) {
            status.textContent = "Memuat isi folder...";
        }

        try {
            const params = new URLSearchParams({ path: state.currentPath });
            const response = await fetch(`${API_BASE}/browse?${params.toString()}`, getAuditFetchOptions());
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const payload = await response.json();
            renderExplorer(payload);
        } catch (error) {
            renderExplorerError(`Explorer gagal: ${error.message}`);
        }
    }

    function renderSummary() {
        const summary = state.index && state.index.summary ? state.index.summary : {};
        setText("audit-total-files", formatNumber(summary.files));
        setText("audit-total-folders", formatNumber(summary.folders));
        setText("audit-total-categories", formatNumber((state.index.categories || []).length));
        setText("audit-total-size", summary.totalSizeFormatted || "-");
    }

    function renderFilters() {
        const categoryFilter = document.getElementById("audit-category-filter");
        const familyFilter = document.getElementById("audit-family-filter");
        const categories = state.index ? state.index.categories || [] : [];
        const documentTypes = state.index ? state.index.documentTypes || [] : [];

        if (categoryFilter) {
            categoryFilter.innerHTML = [
                '<option value="all">Semua Kategori</option>',
                ...categories.map((category) => {
                    const selected = state.category === category.name ? " selected" : "";
                    return `<option value="${escapeAttribute(category.name)}"${selected}>${escapeHtml(category.name)} (${formatNumber(category.count)})</option>`;
                })
            ].join("");
        }

        if (familyFilter) {
            familyFilter.innerHTML = [
                '<option value="all">Semua Tipe</option>',
                ...documentTypes.map((type) => {
                    const selected = state.family === type.name ? " selected" : "";
                    return `<option value="${escapeAttribute(type.name)}"${selected}>${escapeHtml(getFamilyLabel(type.name))} (${formatNumber(type.count)})</option>`;
                })
            ].join("");
        }
    }

    function renderSearchResults(payload) {
        const tableBody = document.getElementById("audit-search-results");
        const status = document.getElementById("audit-search-status");
        if (payload.unavailable) {
            renderSearchWaiting(payload);
            return;
        }
        clearWaitingRetry();

        const files = payload.files || [];
        const searchLabel = state.query ? ` untuk "${state.query}"` : "";
        const truncatedLabel = payload.truncated ? " Ditampilkan sebagian." : "";

        if (status) {
            status.textContent = `${formatNumber(payload.totalResults)} dokumen ditemukan${searchLabel}.${truncatedLabel}`;
        }

        if (!tableBody) {
            return;
        }

        if (!files.length) {
            tableBody.innerHTML = renderEmptyRow("Dokumen tidak ditemukan.");
            return;
        }

        tableBody.innerHTML = files.map(renderFileRow).join("");
    }

    function renderExplorer(payload) {
        const tableBody = document.getElementById("audit-explorer-entries");
        const status = document.getElementById("audit-explorer-status");
        if (payload.unavailable) {
            renderBreadcrumbs(payload.breadcrumbs || []);
            renderExplorerWaiting(payload);
            return;
        }
        clearWaitingRetry();

        const entries = payload.entries || [];

        renderBreadcrumbs(payload.breadcrumbs || []);

        if (status) {
            status.textContent = `${formatNumber(entries.length)} item di folder ini.`;
        }

        if (!tableBody) {
            return;
        }

        if (!entries.length) {
            tableBody.innerHTML = renderEmptyRow("Folder ini kosong.");
            return;
        }

        tableBody.innerHTML = entries.map(renderExplorerRow).join("");
    }

    function renderBreadcrumbs(breadcrumbs) {
        const container = document.getElementById("audit-breadcrumbs");
        if (!container) {
            return;
        }

        container.innerHTML = breadcrumbs.map((crumb, index) => {
            const separator = index === 0 ? "" : '<span>/</span>';
            return `${separator}<button type="button" data-browse-path="${escapeAttribute(crumb.path)}">${escapeHtml(crumb.label)}</button>`;
        }).join("");
    }

    function renderFileRow(file) {
        return `
            <tr>
                <td>${renderFileName(file, true)}</td>
                <td>${escapeHtml(file.category || "-")}</td>
                <td><span class="audit-badge">${escapeHtml(getFamilyLabel(file.family))}</span></td>
                <td>${escapeHtml(file.sizeFormatted || "-")}</td>
                <td>${escapeHtml(file.modifiedFormatted || "-")}</td>
                <td>${renderActions(file)}</td>
            </tr>
        `;
    }

    function renderExplorerRow(item) {
        const nameContent = item.type === "folder"
            ? `
                <button type="button" class="audit-folder-button" data-browse-path="${escapeAttribute(item.relativePath)}">
                    ${escapeHtml(item.name)}
                </button>
                <span>${escapeHtml(item.relativePath || "Root")}</span>
            `
            : `
                <strong>${escapeHtml(item.name)}</strong>
                <span>${escapeHtml(item.relativePath || "-")}</span>
            `;

        return `
            <tr>
                <td>
                    <div class="audit-file-name">
                        <i class="fas ${escapeAttribute(getFamilyIcon(item.family))}" aria-hidden="true"></i>
                        <div>${nameContent}</div>
                    </div>
                </td>
                <td>${escapeHtml(item.category || "-")}</td>
                <td><span class="audit-badge">${escapeHtml(getFamilyLabel(item.family))}</span></td>
                <td>${escapeHtml(item.sizeFormatted || "-")}</td>
                <td>${escapeHtml(item.modifiedFormatted || "-")}</td>
                <td>${item.type === "folder" ? renderFolderActions(item) : renderActions(item)}</td>
            </tr>
        `;
    }

    function renderFileName(file, allowHighlight) {
        const displayName = allowHighlight ? highlightText(file.name, state.query) : escapeHtml(file.name);
        const displayPath = allowHighlight ? highlightText(file.relativePath, state.query) : escapeHtml(file.relativePath);
        return `
            <div class="audit-file-name">
                <i class="fas ${escapeAttribute(getFamilyIcon(file.family))}" aria-hidden="true"></i>
                <div>
                    <strong>${displayName}</strong>
                    <span>${displayPath}</span>
                </div>
            </div>
        `;
    }

    function renderActions(file) {
        return `
            <div class="audit-actions">
                <button type="button" class="btn btn-sm btn-outline-primary" data-open-file="${escapeAttribute(file.openUrl)}">
                    <i class="fas fa-arrow-up-right-from-square me-1" aria-hidden="true"></i>Open
                </button>
                <button type="button" class="btn btn-sm btn-outline-secondary" data-download-file="${escapeAttribute(file.downloadUrl)}" data-file-name="${escapeAttribute(file.name || 'audit-file')}">
                    <i class="fas fa-download me-1" aria-hidden="true"></i>Download
                </button>
                <button type="button" class="btn btn-sm btn-outline-dark" data-copy-path="${escapeAttribute(file.networkPath)}">
                    <i class="fas fa-copy me-1" aria-hidden="true"></i>Path
                </button>
            </div>
        `;
    }

    function renderFolderActions(item) {
        return `
            <div class="audit-actions">
                <button type="button" class="btn btn-sm btn-outline-primary" data-browse-path="${escapeAttribute(item.relativePath)}">
                    <i class="fas fa-folder-open me-1" aria-hidden="true"></i>Buka
                </button>
                <button type="button" class="btn btn-sm btn-outline-dark" data-copy-path="${escapeAttribute(item.networkPath)}">
                    <i class="fas fa-copy me-1" aria-hidden="true"></i>Path
                </button>
            </div>
        `;
    }

    function renderLoadingRow(message) {
        return `
            <tr>
                <td colspan="6">
                    <div class="audit-state">
                        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                        ${escapeHtml(message)}
                    </div>
                </td>
            </tr>
        `;
    }

    function renderWaitingRow(message) {
        return `
            <tr>
                <td colspan="6">
                    <div class="audit-state audit-waiting-state">
                        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                        ${escapeHtml(message)}
                    </div>
                </td>
            </tr>
        `;
    }

    function renderEmptyRow(message) {
        return `
            <tr>
                <td colspan="6">
                    <div class="audit-state">
                        <i class="fas fa-circle-info" aria-hidden="true"></i>
                        ${escapeHtml(message)}
                    </div>
                </td>
            </tr>
        `;
    }

    function renderSearchWaiting(payload) {
        const tableBody = document.getElementById("audit-search-results");
        const status = document.getElementById("audit-search-status");
        const message = payload.message || "Menunggu koneksi PC-BIM02. Data Audit 2026 akan muncul otomatis.";
        if (status) {
            status.textContent = message;
        }
        if (tableBody) {
            tableBody.innerHTML = renderWaitingRow(message);
        }
        scheduleWaitingRetry(payload);
    }

    function renderExplorerWaiting(payload) {
        const tableBody = document.getElementById("audit-explorer-entries");
        const status = document.getElementById("audit-explorer-status");
        const message = payload.message || "Menunggu koneksi PC-BIM02. Explorer Audit 2026 akan aktif otomatis.";
        if (status) {
            status.textContent = message;
        }
        if (tableBody) {
            tableBody.innerHTML = renderWaitingRow(message);
        }
        scheduleWaitingRetry(payload);
    }

    function renderSearchError(message) {
        const tableBody = document.getElementById("audit-search-results");
        const status = document.getElementById("audit-search-status");
        if (status) {
            status.innerHTML = `<span class="audit-error-text">${escapeHtml(message)}</span>`;
        }
        if (tableBody) {
            tableBody.innerHTML = renderEmptyRow(message);
        }
    }

    function renderExplorerError(message) {
        const tableBody = document.getElementById("audit-explorer-entries");
        const status = document.getElementById("audit-explorer-status");
        if (status) {
            status.innerHTML = `<span class="audit-error-text">${escapeHtml(message)}</span>`;
        }
        if (tableBody) {
            tableBody.innerHTML = renderEmptyRow(message);
        }
    }

    function scheduleWaitingRetry(payload) {
        clearWaitingRetry();
        const retryAfterSeconds = Math.max(5, Math.min(Number(payload.retryAfterSeconds) || 15, 60));
        state.waitingRetryTimer = window.setTimeout(async () => {
            state.waitingRetryTimer = null;
            await loadAuditIndex(false);
            await Promise.all([
                searchAuditDocuments(),
                browseAuditFolder(state.currentPath || "")
            ]);
        }, retryAfterSeconds * 1000);
    }

    function clearWaitingRetry() {
        if (!state.waitingRetryTimer) {
            return;
        }
        window.clearTimeout(state.waitingRetryTimer);
        state.waitingRetryTimer = null;
    }

    function setActiveTab(nextTab) {
        state.activeTab = nextTab === "explorer" ? "explorer" : "search";

        document.querySelectorAll("[data-audit-tab]").forEach((button) => {
            const isActive = button.dataset.auditTab === state.activeTab;
            button.classList.toggle("active", isActive);
            button.setAttribute("aria-selected", isActive ? "true" : "false");
        });

        const searchView = document.getElementById("audit-search-view");
        const explorerView = document.getElementById("audit-explorer-view");
        if (searchView) {
            searchView.hidden = state.activeTab !== "search";
        }
        if (explorerView) {
            explorerView.hidden = state.activeTab !== "explorer";
        }
    }

    function handleDelegatedClick(event) {
        const browseButton = event.target.closest("[data-browse-path]");
        if (browseButton) {
            event.preventDefault();
            setActiveTab("explorer");
            browseAuditFolder(browseButton.dataset.browsePath || "");
            return;
        }

        const copyButton = event.target.closest("[data-copy-path]");
        if (copyButton) {
            event.preventDefault();
            copyToClipboard(copyButton.dataset.copyPath || "");
            return;
        }

        const openButton = event.target.closest("[data-open-file]");
        if (openButton) {
            event.preventDefault();
            openProtectedFile(openButton.dataset.openFile || "");
            return;
        }

        const downloadButton = event.target.closest("[data-download-file]");
        if (downloadButton) {
            event.preventDefault();
            downloadProtectedFile(downloadButton.dataset.downloadFile || "", downloadButton.dataset.fileName || "audit-file");
        }
    }

    async function fetchProtectedFileBlob(url) {
        const response = await fetch(url, getAuditFetchOptions());
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return response.blob();
    }

    async function openProtectedFile(url) {
        if (!url) {
            return;
        }

        try {
            const blob = await fetchProtectedFileBlob(url);
            const objectUrl = URL.createObjectURL(blob);
            window.open(objectUrl, "_blank", "noopener,noreferrer");
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
        } catch (error) {
            showToast(`Gagal membuka file: ${error.message}`);
        }
    }

    async function downloadProtectedFile(url, filename) {
        if (!url) {
            return;
        }

        try {
            const blob = await fetchProtectedFileBlob(url);
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = objectUrl;
            link.download = filename || "audit-file";
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(objectUrl);
        } catch (error) {
            showToast(`Gagal download file: ${error.message}`);
        }
    }

    async function copyToClipboard(value) {
        if (!value) {
            return;
        }

        try {
            await navigator.clipboard.writeText(value);
            showToast("Path disalin.");
        } catch (error) {
            const fallback = document.createElement("textarea");
            fallback.value = value;
            fallback.setAttribute("readonly", "");
            fallback.style.position = "fixed";
            fallback.style.opacity = "0";
            document.body.appendChild(fallback);
            fallback.select();
            document.execCommand("copy");
            fallback.remove();
            showToast("Path disalin.");
        }
    }

    function showToast(message) {
        const toast = document.getElementById("audit-toast");
        if (!toast) {
            return;
        }

        toast.textContent = message;
        toast.classList.add("show");
        window.clearTimeout(showToast.timeoutId);
        showToast.timeoutId = window.setTimeout(() => {
            toast.classList.remove("show");
        }, 2200);
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value == null || value === "" ? "-" : value;
        }
    }

    function getFamilyLabel(family) {
        return FAMILY_LABELS[family] || String(family || "File").toUpperCase();
    }

    function getFamilyIcon(family) {
        return FAMILY_ICONS[family] || FAMILY_ICONS.file;
    }

    function highlightText(value, query) {
        const escapedValue = escapeHtml(value || "");
        const terms = String(query || "").trim().split(/\s+/).filter(Boolean);
        if (!terms.length) {
            return escapedValue;
        }

        return terms.reduce((html, term) => {
            const escapedTerm = escapeRegExp(escapeHtml(term));
            return html.replace(new RegExp(`(${escapedTerm})`, "gi"), '<mark class="audit-highlight">$1</mark>');
        }, escapedValue);
    }

    function formatNumber(value) {
        const number = Number(value || 0);
        return number.toLocaleString("id-ID");
    }

    function debounce(callback, delay) {
        let timeoutId = null;
        return function debouncedCallback() {
            window.clearTimeout(timeoutId);
            timeoutId = window.setTimeout(callback, delay);
        };
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function escapeAttribute(value) {
        return escapeHtml(value);
    }

    function escapeRegExp(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
})();
