/**
 * Content Management Module - Combined PDF and BIM Media Management
 * Handles PDF materials and BIM media tagging system
 */
class ContentManagementModule {
    constructor(adminPanel) {
        this.adminPanel = adminPanel;

        // PDF Management properties
        this.allPDFManagementData = [];
        this.selectedPDFManagementIds = new Set();
        this.selectedPDFManagementOrder = [];
        this.filteredPDFManagementData = [];
        this.currentPDFManagementPage = 1;
        this.pdfManagementItemsPerPage = 20;
        this.pdfCustomCategories = [];

        // BIM Media properties
        this.currentSelectedFile = null;
        this.allMediaFiles = [];
        this.savedBIMTags = {};
        this.bimCustomCategories = {};
        this.allBIMTags = [];
        this.isScanningMedia = false;
    }

    /**
     * Initialize the content management module
     */
    initialize() {
        this.setupEventListeners();
        this.loadPersistentData();
    }

    /**
     * Setup event listeners for content management elements
     */
    setupEventListeners() {
        // PDF Management buttons
        const loadPDFBtn = document.querySelector('button[onclick*="loadPDFManagement"]');
        if (loadPDFBtn) {
            loadPDFBtn.addEventListener('click', () => this.loadPDFManagement());
        }

        const savePDFBtn = document.querySelector('button[onclick*="savePDFDisplaySelection"]');
        if (savePDFBtn) {
            savePDFBtn.addEventListener('click', () => this.savePDFDisplaySelection());
        }

        // BIM Media buttons
        const loadBIMBtn = document.querySelector('button[onclick*="loadBIMMedia"]');
        if (loadBIMBtn) {
            loadBIMBtn.addEventListener('click', () => this.loadBIMMedia());
        }
    }

    /**
     * Load persistent data from localStorage
     */
    loadPersistentData() {
        this.loadPDFCustomCategories();
        this.loadSavedBIMTags();
        this.loadBIMCustomCategories();
    }

    // ===== PDF MANAGEMENT FUNCTIONS =====

    /**
     * Load PDF custom categories from localStorage
     */
    loadPDFCustomCategories() {
        try {
            const saved = localStorage.getItem('bcl_pdf_custom_categories');
            if (saved) {
                this.pdfCustomCategories = JSON.parse(saved);
                this.applyPDFCustomCategoriesToDropdown();
            } else {
                this.pdfCustomCategories = [];
            }
        } catch (error) {
            console.error('âŒ Error loading PDF custom categories:', error);
            this.pdfCustomCategories = [];
        }
    }

    /**
     * Save PDF custom categories to localStorage
     */
    savePDFCustomCategoriesToStorage() {
        try {
            localStorage.setItem('bcl_pdf_custom_categories', JSON.stringify(this.pdfCustomCategories));
        } catch (error) {
            console.error('âŒ Error saving PDF custom categories to localStorage:', error);
        }
    }

    /**
     * Apply PDF custom categories to dropdown
     */
    applyPDFCustomCategoriesToDropdown() {
        const select = document.getElementById('pdfCategory');
        if (select) {
            // Remove existing custom categories first
            const existingCustomOptions = select.querySelectorAll('option[data-pdf-custom="true"]');
            existingCustomOptions.forEach(option => option.remove());

            // Add custom categories
            this.pdfCustomCategories.forEach(category => {
                const newOption = document.createElement('option');
                newOption.value = category.value;
                newOption.textContent = category.displayName;
                newOption.setAttribute('data-pdf-custom', 'true');
                select.appendChild(newOption);
            });
        }

    }

    /**
     * Toggle PDF custom category input
     */
    togglePDFCustomCategory() {
        const customDiv = document.getElementById('pdfCustomCategoryDiv');
        const input = document.getElementById('pdfCustomCategoryInput');

        if (customDiv.classList.contains('d-none')) {
            customDiv.classList.remove('d-none');
            input.focus();
            input.value = '';
        } else {
            customDiv.classList.add('d-none');
            input.value = '';
        }
    }

    /**
     * Add PDF custom category
     */
    addPDFCustomCategory() {
        const input = document.getElementById('pdfCustomCategoryInput');
        const categoryName = input.value.trim();

        if (!categoryName) {
            alert('Please enter a category name');
            input.focus();
            return;
        }

        // Check if category already exists
        const select = document.getElementById('pdfCategory');
        const existingOptions = Array.from(select.options).map(opt => opt.value.toLowerCase());

        if (existingOptions.includes(categoryName.toLowerCase())) {
            alert('This category already exists');
            input.focus();
            return;
        }

        // Validate category name
        if (categoryName.length < 2 || categoryName.length > 50) {
            alert('Category name must be between 2 and 50 characters');
            input.focus();
            return;
        }

        if (!/^[a-zA-Z0-9\s\-&()]+$/.test(categoryName)) {
            alert('Category name can only contain letters, numbers, spaces, hyphens, ampersands, and parentheses');
            input.focus();
            return;
        }

        // Create category object
        const newCategory = {
            value: categoryName.toLowerCase().replace(/\s+/g, '-'),
            displayName: categoryName
        };

        // Add to PDF custom categories array
        this.pdfCustomCategories.push(newCategory);

        // Save to localStorage
        this.savePDFCustomCategoriesToStorage();

        // Add new category to dropdown
        const newOption = document.createElement('option');
        newOption.value = newCategory.value;
        newOption.textContent = newCategory.displayName;
        newOption.setAttribute('data-pdf-custom', 'true');
        select.appendChild(newOption);

        // Select the new category
        select.value = newCategory.value;

        // Hide custom category input and show success
        document.getElementById('pdfCustomCategoryDiv').classList.add('d-none');
        input.value = '';

        alert('âœ… New PDF category "' + categoryName + '" added successfully and saved!');
    }

    /**
     * Cancel PDF custom category
     */
    cancelPDFCustomCategory() {
        const customDiv = document.getElementById('pdfCustomCategoryDiv');
        const input = document.getElementById('pdfCustomCategoryInput');

        customDiv.classList.add('d-none');
        input.value = '';
    }

    /**
     * Load selected PDF IDs from localStorage
     */
    loadSelectedPDFManagementIds() {
        try {
            const saved = localStorage.getItem('bcl_pdf_display_selected');
            if (saved) {
                const savedIds = JSON.parse(saved);
                this.selectedPDFManagementIds = new Set(savedIds);
            } else {
                this.selectedPDFManagementIds = new Set();
            }
        } catch (error) {
            console.error('âŒ Error loading selected PDF IDs:', error);
            this.selectedPDFManagementIds = new Set();
        }
    }

    /**
     * Save selected PDF IDs to localStorage
     */
    saveSelectedPDFManagementIds() {
        try {
            const idsArray = Array.from(this.selectedPDFManagementIds);
            localStorage.setItem('bcl_pdf_display_selected', JSON.stringify(idsArray));
        } catch (error) {
            console.error('âŒ Error saving selected PDF IDs:', error);
        }
    }

    /**
     * Update badge functions
     */
    updateTotalPDFManagementCount(count) {
        const badge = document.getElementById('totalPDFManagementCount');
        if (badge) {
            badge.innerHTML = `<i class="fas fa-file-pdf me-1"></i>Total: ${count} PDFs`;
        }
    }

    updateSelectedPDFManagementCount(count) {
        const badge = document.getElementById('selectedPDFManagementCount');
        if (badge) {
            badge.innerHTML = `<i class="fas fa-check me-1"></i>Displayed: ${count} PDFs`;
        }
    }

    /**
     * Load PDF management
     */
    async loadPDFManagement() {

        const tableBody = document.getElementById('pdfManagementTableBody');
        tableBody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center py-4">
                    <div class="d-flex flex-column align-items-center">
                        <div class="spinner-border text-primary mb-2" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="text-muted mb-2">Loading PDF materials...</p>
                    </div>
                </td>
            </tr>`;

        try {
            const response = await fetch('/api/admin/pdf-display/list', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                const pdfList = data.pdfs || data.data || [];

                this.allPDFManagementData = pdfList;
                let selectedIds = [];
                if (data.config && Array.isArray(data.config.selectedPDFs)) {
                    selectedIds = data.config.selectedPDFs;
                } else {
                    selectedIds = pdfList.filter(pdf => pdf.selected).map(pdf => pdf.id);
                }

                const normalizedSelectedIds = selectedIds.map(id => id.toString());
                this.selectedPDFManagementIds = new Set(normalizedSelectedIds);
                this.selectedPDFManagementOrder = this.buildPDFDisplayOrder(normalizedSelectedIds, pdfList);
                this.saveSelectedPDFManagementIds();
                this.updateTotalPDFManagementCount(this.allPDFManagementData.length);
                this.updateSelectedPDFManagementCount(this.selectedPDFManagementIds.size);

                this.sortPDFManagementTable();
            } else {
                const errorText = await response.text();
                console.error('âŒ PDF materials API failed:', response.status, errorText);
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="10" class="text-center py-4">
                            <div class="alert alert-danger mb-0">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                Failed to load PDF materials: ${response.status}
                            </div>
                        </td>
                    </tr>`;
            }
        } catch (error) {
            console.error('âŒ Error loading PDF management:', error);
            tableBody.innerHTML = `
                <tr>
                        <td colspan="10" class="text-center py-4">
                            <div class="alert alert-danger mb-0">
                                <i class="fas fa-exclamation-circle me-2"></i>
                            Error loading PDF materials: ${error.message}
                        </div>
                    </td>
                </tr>`;
        }
    }

    /**
     * Display PDF management table
     */
    displayPDFManagementTable(pdfs) {
        const tableBody = document.getElementById('pdfManagementTableBody');
        const paginationControls = document.getElementById('pdfManagementPaginationControls');

        if (pdfs.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center py-4">
                        <div class="d-flex flex-column align-items-center">
                            <i class="fas fa-file-pdf fa-3x text-muted mb-3"></i>
                            <p class="text-muted mb-2">No PDF materials found</p>
                        </div>
                    </td>
                </tr>`;
            document.getElementById('pdfManagementPagination').style.display = 'none';
            return;
        }

        // Calculate pagination
        const totalPages = Math.ceil(pdfs.length / this.pdfManagementItemsPerPage);
        const startIndex = (this.currentPDFManagementPage - 1) * this.pdfManagementItemsPerPage;
        const endIndex = Math.min(startIndex + this.pdfManagementItemsPerPage, pdfs.length);
        const pdfsToShow = pdfs.slice(startIndex, endIndex);

        let html = '';
        pdfsToShow.forEach((pdf, index) => {
            const pdfId = pdf.id;
            const title = pdf.title || pdf.name || 'Unknown';
            const category = pdf.category || 'General';
            const level = pdf.level || 'Beginner';
            const pages = pdf.pageCount || 'Unknown';
            const size = pdf.size ? this.formatFileSize(pdf.size) : 'Unknown';
            const description = pdf.description || '';
            const actualIndex = startIndex + index + 1;
            const isSelected = this.selectedPDFManagementIds.has(pdfId.toString());
            const orderIndex = this.getPDFDisplayOrderIndex(pdfId);
            const canMoveUp = orderIndex > 0;
            const canMoveDown = orderIndex > -1 && orderIndex < this.selectedPDFManagementOrder.length - 1;

            html += `
                <tr>
                    <td class="text-center fw-bold">${actualIndex}</td>
                    <td class="text-center">
                        <div class="form-check">
                            <input class="form-check-input pdf-display-checkbox"
                                   type="checkbox"
                                   id="pdf_display_${pdfId}"
                                   value="${pdfId}"
                                   ${isSelected ? 'checked' : ''}
                                   onchange="window.adminPanel.modules.get('contentManagement').instance.updatePDFManagementSelection()">
                            <label class="form-check-label" for="pdf_display_${pdfId}"></label>
                        </div>
                    </td>
                    <td class="text-center">
                        <div class="btn-group btn-group-sm" role="group">
                            <button class="btn btn-outline-secondary"
                                    ${!canMoveUp ? 'disabled' : ''}
                                    onclick="window.adminPanel.modules.get('contentManagement').instance.movePDFDisplayOrder('${pdfId}', 'up')"
                                    title="Move Up">
                                <i class="fas fa-arrow-up"></i>
                            </button>
                            <button class="btn btn-outline-secondary"
                                    ${!canMoveDown ? 'disabled' : ''}
                                    onclick="window.adminPanel.modules.get('contentManagement').instance.movePDFDisplayOrder('${pdfId}', 'down')"
                                    title="Move Down">
                                <i class="fas fa-arrow-down"></i>
                            </button>
                        </div>
                    </td>
                    <td>
                        <div class="fw-bold text-truncate" style="max-width: 200px;" title="${title}">${title}</div>
                    </td>
                    <td><span class="badge bg-info">${category}</span></td>
                    <td><span class="badge bg-warning">${level}</span></td>
                    <td class="text-center">${pages}</td>
                    <td class="text-center">${size}</td>
                    <td>
                        <div class="text-truncate" style="max-width: 150px;" title="${description}">
                            ${description || '<em>No description</em>'}
                        </div>
                    </td>
                    <td>
                        <div class="btn-group btn-group-sm" role="group">
                            <button class="btn btn-outline-info" onclick="window.adminPanel.modules.get('contentManagement').instance.previewPDFManagement('${pdfId}')" title="Preview PDF">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-outline-primary" onclick="window.adminPanel.modules.get('contentManagement').instance.editPDFManagement('${pdfId}')" title="Edit PDF">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="window.adminPanel.modules.get('contentManagement').instance.deletePDFManagement('${pdfId}', '${title.replace(/'/g, "\\'")}')" title="Delete PDF">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
        });

        tableBody.innerHTML = html;

        // Generate pagination controls
        let paginationHtml = '';

        // Previous button
        if (this.currentPDFManagementPage > 1) {
            paginationHtml += `<li class="page-item"><a class="page-link" href="#" onclick="window.adminPanel.modules.get('contentManagement').instance.changePDFManagementPage(${this.currentPDFManagementPage - 1})">&laquo;</a></li>`;
        } else {
            paginationHtml += `<li class="page-item disabled"><span class="page-link">&laquo;</span></li>`;
        }

        // Page numbers
        const startPage = Math.max(1, this.currentPDFManagementPage - 2);
        const endPage = Math.min(totalPages, this.currentPDFManagementPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            if (i === this.currentPDFManagementPage) {
                paginationHtml += `<li class="page-item active"><span class="page-link">${i}</span></li>`;
            } else {
                paginationHtml += `<li class="page-item"><a class="page-link" href="#" onclick="window.adminPanel.modules.get('contentManagement').instance.changePDFManagementPage(${i})">${i}</a></li>`;
            }
        }

        // Next button
        if (this.currentPDFManagementPage < totalPages) {
            paginationHtml += `<li class="page-item"><a class="page-link" href="#" onclick="window.adminPanel.modules.get('contentManagement').instance.changePDFManagementPage(${this.currentPDFManagementPage + 1})">&raquo;</a></li>`;
        } else {
            paginationHtml += `<li class="page-item disabled"><span class="page-link">&raquo;</span></li>`;
        }

        paginationControls.innerHTML = paginationHtml;
        document.getElementById('pdfManagementPagination').style.display = totalPages > 1 ? 'block' : 'none';
    }

    /**
     * Sort PDF management table
     */
    sortPDFManagementTable() {
        const sortBy = document.getElementById('pdfManagementSortFilter').value;
        const categoryFilter = document.getElementById('pdfManagementCategoryFilter').value;
        const levelFilter = document.getElementById('pdfManagementLevelFilter').value;
        const searchTerm = document.getElementById('pdfManagementSearchInput').value.toLowerCase().trim();

        // First filter the data
        this.filteredPDFManagementData = this.allPDFManagementData.filter(pdf => {
            const matchesCategory = !categoryFilter || pdf.category === categoryFilter;
            const matchesLevel = !levelFilter || pdf.level === levelFilter;
            const matchesSearch = !searchTerm ||
                (pdf.title || pdf.name || '').toLowerCase().includes(searchTerm) ||
                (pdf.category || '').toLowerCase().includes(searchTerm) ||
                (pdf.description || '').toLowerCase().includes(searchTerm);
            return matchesCategory && matchesLevel && matchesSearch;
        });

        // Then sort the filtered data
        this.filteredPDFManagementData.sort((a, b) => {
            let aValue, bValue;

            switch (sortBy) {
                case 'title':
                    aValue = (a.title || a.name || '').toLowerCase();
                    bValue = (b.title || b.name || '').toLowerCase();
                    return aValue.localeCompare(bValue);
                case 'category':
                    aValue = (a.category || '').toLowerCase();
                    bValue = (b.category || '').toLowerCase();
                    return aValue.localeCompare(bValue);
                case 'level':
                    const levelOrder = { 'Beginner': 1, 'Intermediate': 2, 'Advanced': 3, 'Expert': 4 };
                    aValue = levelOrder[a.level] || 0;
                    bValue = levelOrder[b.level] || 0;
                    return aValue - bValue;
                case 'pages':
                    return (b.pageCount || 0) - (a.pageCount || 0);
                case 'newest':
                    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
                case 'display-order':
                    return 0;
                default:
                    return 0;
            }
        });

        if (sortBy === 'display-order') {
            this.filteredPDFManagementData = this.applyPDFDisplayOrder(this.filteredPDFManagementData);
        }

        // Reset to first page and display
        this.currentPDFManagementPage = 1;
        this.displayPDFManagementTable(this.filteredPDFManagementData);
    }

    /**
     * Filter PDF management
     */
    filterPDFManagement() {
        this.sortPDFManagementTable();
    }

    /**
     * Clear PDF management filters
     */
    clearPDFManagementFilters() {
        document.getElementById('pdfManagementSearchInput').value = '';
        document.getElementById('pdfManagementCategoryFilter').value = '';
        document.getElementById('pdfManagementLevelFilter').value = '';
        document.getElementById('pdfManagementSortFilter').value = 'title';

        this.sortPDFManagementTable();
    }

    /**
     * Change PDF management page
     */
    changePDFManagementPage(page) {
        this.currentPDFManagementPage = page;
        this.displayPDFManagementTable(this.filteredPDFManagementData);
    }

    /**
     * Update PDF selection
     */
    updatePDFManagementSelection() {
        try {
            const checkboxes = document.querySelectorAll('.pdf-display-checkbox');
            const previousCount = this.selectedPDFManagementIds.size;
            const checkedIds = [];
            checkboxes.forEach(checkbox => {
                if (checkbox.checked) {
                    checkedIds.push(checkbox.value.toString());
                }
            });

            this.selectedPDFManagementIds = new Set(checkedIds);
            const checkedSet = new Set(checkedIds);

            this.selectedPDFManagementOrder = this.selectedPDFManagementOrder.filter(id => checkedSet.has(id));
            checkedIds.forEach(id => {
                if (!this.selectedPDFManagementOrder.includes(id)) {
                    this.selectedPDFManagementOrder.push(id);
                }
            });

            const newCount = this.selectedPDFManagementIds.size;

            this.saveSelectedPDFManagementIds();
            this.updateSelectedPDFManagementCount(newCount);

            this.autoSavePDFManagementSelection().catch(error => {
                console.error('ðŸš¨ Critical error in PDF auto-save:', error);
                this.showSaveErrorNotification();
            });

            this.refreshPDFManagementOrderView();

        } catch (error) {
            console.error('âŒ Error updating PDF display selection:', error);
            this.loadSelectedPDFManagementIds();
            this.updateSelectedPDFManagementCount(this.selectedPDFManagementIds.size);
        }
    }

    /**
     * Auto-save PDF selection to server
     */
    async autoSavePDFManagementSelection() {
        const selectedPDFIdsArray = this.getOrderedSelectedPDFIds();
        const maxRetries = 3;
        let retryCount = 0;

        while (retryCount < maxRetries) {
            try {

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                const response = await fetch('/api/admin/pdf-display/update', {
                    credentials: 'include',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        selectedPDFIds: selectedPDFIdsArray
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const result = await response.json();
                    return true;
                } else {
                    const errorText = await response.text();

                    if (response.status === 401) {
                        console.error('ðŸš« Session expired, redirecting to login');
                        alert('Session expired. Please login again.');
                        this.adminPanel.logout();
                        return false;
                    }

                    retryCount++;
                    if (retryCount < maxRetries) {
                        const delay = Math.pow(2, retryCount) * 1000;
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            } catch (error) {
                if (error.name === 'AbortError') {
                } else {
                    console.error(`âŒ PDF auto-save network error (attempt ${retryCount + 1}):`, error.message);
                }

                retryCount++;
                if (retryCount < maxRetries) {
                    const delay = Math.pow(2, retryCount) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        console.error('ðŸš¨ All PDF auto-save attempts failed after', maxRetries, 'retries');
        this.showSaveErrorNotification();
        return false;
    }

    /**
     * Save PDF display selection
     */
    async savePDFDisplaySelection() {
        const selectedPDFIds = this.getOrderedSelectedPDFIds();


        try {
            const button = event && event.target ? event.target : document.querySelector('button[onclick*="savePDFDisplaySelection"]');
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';
            button.disabled = true;

            const response = await fetch('/api/admin/pdf-display/update', {
                credentials: 'include',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ selectedPDFIds })
            });

            if (response.ok) {
                const result = await response.json();
                alert('âœ… PDF display configuration saved successfully!');

                await this.loadPDFManagement();
            } else {
                const error = await response.json();
                console.error('âŒ Failed to save PDF display selection:', error);
                alert('âŒ Failed to save configuration: ' + (error.error || 'Unknown error'));
            }

            button.innerHTML = originalText;
            button.disabled = false;

        } catch (error) {
            console.error('âŒ Error saving PDF display selection:', error);
            alert('âŒ Error saving configuration: ' + error.message);

            const button = document.querySelector('button[onclick="savePDFDisplaySelection()"]');
            if (button) {
                button.innerHTML = '<i class="fas fa-save me-2"></i>Save Display Settings';
                button.disabled = false;
            }
        }
    }

    /**
     * Select all PDFs for display
     */
    selectAllPDFDisplay() {
        const checkboxes = document.querySelectorAll('.pdf-display-checkbox');
        checkboxes.forEach(checkbox => checkbox.checked = true);
        this.updatePDFManagementSelection();
    }

    /**
     * Clear all PDF display selections
     */
    clearAllPDFDisplay() {
        const checkboxes = document.querySelectorAll('.pdf-display-checkbox');
        checkboxes.forEach(checkbox => checkbox.checked = false);
        this.updatePDFManagementSelection();
    }

    /**
     * Build PDF display order from selected IDs and available list
     */
    buildPDFDisplayOrder(selectedIds, pdfList) {
        const availableIds = new Set((pdfList || []).map(pdf => pdf.id != null ? pdf.id.toString() : ''));
        const normalized = (selectedIds || [])
            .map(id => id != null ? id.toString() : '')
            .filter(id => id && availableIds.has(id));

        if (normalized.length > 0) {
            return normalized;
        }

        return (pdfList || [])
            .filter(pdf => this.selectedPDFManagementIds.has(pdf.id != null ? pdf.id.toString() : ''))
            .map(pdf => pdf.id != null ? pdf.id.toString() : '');
    }

    /**
     * Get display order index for a PDF id
     */
    getPDFDisplayOrderIndex(pdfId) {
        if (!pdfId) return -1;
        const id = pdfId.toString();
        return this.selectedPDFManagementOrder.indexOf(id);
    }

    /**
     * Get ordered selected PDF ids
     */
    getOrderedSelectedPDFIds() {
        if (this.selectedPDFManagementOrder.length > 0) {
            return [...this.selectedPDFManagementOrder];
        }
        return Array.from(this.selectedPDFManagementIds);
    }

    /**
     * Move PDF display order up/down
     */
    movePDFDisplayOrder(pdfId, direction) {
        const id = pdfId != null ? pdfId.toString() : '';
        const currentIndex = this.selectedPDFManagementOrder.indexOf(id);
        if (currentIndex < 0) return;

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= this.selectedPDFManagementOrder.length) return;

        const updated = [...this.selectedPDFManagementOrder];
        [updated[currentIndex], updated[targetIndex]] = [updated[targetIndex], updated[currentIndex]];
        this.selectedPDFManagementOrder = updated;

        const sortFilter = document.getElementById('pdfManagementSortFilter');
        if (sortFilter) {
            sortFilter.value = 'display-order';
        }

        this.refreshPDFManagementOrderView(id);

        this.autoSavePDFManagementSelection().catch(error => {
            console.error('âŒ Failed to auto-save display order:', error);
            this.showSaveErrorNotification();
        });
    }

    /**
     * Apply display order to a list of PDFs
     */
    applyPDFDisplayOrder(list) {
        const orderedIds = new Map(this.selectedPDFManagementOrder.map((id, index) => [id, index]));
        const originalIndex = new Map();
        list.forEach((item, index) => {
            if (item && item.id != null) {
                originalIndex.set(item.id.toString(), index);
            }
        });

        return [...list].sort((a, b) => {
            const aId = a && a.id != null ? a.id.toString() : '';
            const bId = b && b.id != null ? b.id.toString() : '';
            const aIndex = orderedIds.has(aId) ? orderedIds.get(aId) : null;
            const bIndex = orderedIds.has(bId) ? orderedIds.get(bId) : null;

            const aSelected = aIndex !== null;
            const bSelected = bIndex !== null;

            if (aSelected && bSelected) return aIndex - bIndex;
            if (aSelected) return -1;
            if (bSelected) return 1;

            const aOrig = originalIndex.has(aId) ? originalIndex.get(aId) : Number.MAX_SAFE_INTEGER;
            const bOrig = originalIndex.has(bId) ? originalIndex.get(bId) : Number.MAX_SAFE_INTEGER;
            return aOrig - bOrig;
        });
    }

    /**
     * Refresh table view after order changes
     */
    refreshPDFManagementOrderView(focusId = null) {
        const sourceList = this.filteredPDFManagementData.length > 0
            ? this.filteredPDFManagementData
            : this.allPDFManagementData;

        this.filteredPDFManagementData = this.applyPDFDisplayOrder(sourceList);
        if (focusId) {
            const focusIndex = this.filteredPDFManagementData.findIndex(pdf =>
                pdf && pdf.id != null && pdf.id.toString() === focusId.toString()
            );
            if (focusIndex >= 0) {
                this.currentPDFManagementPage = Math.floor(focusIndex / this.pdfManagementItemsPerPage) + 1;
            }
        }
        this.displayPDFManagementTable(this.filteredPDFManagementData);
    }

    /**
     * Show PDF Upload Modal
     */
    showPDFUploadModal() {
        const modalHtml = `
            <div class="modal fade" id="pdfUploadModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-file-upload me-2"></i>Upload New PDF Material
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="pdfUploadForm">
                            <div class="modal-body">
                                <div class="row g-3">
                                    <div class="col-md-12">
                                        <label class="form-label">Title *</label>
                                        <input type="text" class="form-control" id="uploadPdfTitle" required placeholder="Enter material title">
                                    </div>
                                    <div class="col-md-12">
                                        <label class="form-label">PDF File *</label>
                                        <input type="file" class="form-control" id="uploadPdfFile" accept=".pdf" required>
                                        <div class="form-text">Max size: 100MB. Only PDF files allowed.</div>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Category *</label>
                                        <select class="form-select" id="uploadPdfCategory" required>
                                            <option value="">Select Category</option>
                                            <option value="autocad">AutoCAD</option>
                                            <option value="revit">Revit BIM</option>
                                            <option value="sketchup">SketchUp</option>
                                            <option value="3dsmax">3ds Max</option>
                                            <option value="general">General BIM</option>
                                        </select>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">BIM Level *</label>
                                        <select class="form-select" id="uploadPdfLevel" required>
                                            <option value="beginner">Beginner</option>
                                            <option value="intermediate">Intermediate</option>
                                            <option value="advanced">Advanced</option>
                                            <option value="expert">Expert</option>
                                        </select>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Language</label>
                                        <select class="form-select" id="uploadPdfLanguage">
                                            <option value="id">Bahasa Indonesia</option>
                                            <option value="en">English</option>
                                            <option value="mixed">Mixed</option>
                                        </select>
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label">Description</label>
                                        <textarea class="form-control" id="uploadPdfDescription" rows="3" placeholder="Brief description of the material..."></textarea>
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label">Cover Image (optional)</label>
                                        <input type="file" class="form-control" id="uploadPdfCoverImage" accept="image/png,image/jpeg,image/webp">
                                        <div class="form-text">JPG/PNG/WEBP, max 10MB.</div>
                                    </div>
                                    <div class="col-12">
                                        <div class="form-check">
                                            <input class="form-check-input" type="checkbox" id="uploadPdfDisplayOnCourses" checked>
                                            <label class="form-check-label" for="uploadPdfDisplayOnCourses">
                                                Display on Courses page immediately
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="fas fa-upload me-2"></i>Upload PDF
                                </button>
                            </div>
                        </form>
                    </div>
                </div>`;

        const existingModal = document.getElementById('pdfUploadModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('pdfUploadForm').addEventListener('submit', (e) => this.handlePDFUpload(e));

        const modal = new bootstrap.Modal(document.getElementById('pdfUploadModal'));
        modal.show();
    }

    /**
     * Handle PDF Upload
     */
    async handlePDFUpload(event) {
        event.preventDefault();

        const title = document.getElementById('uploadPdfTitle').value.trim();
        const fileInput = document.getElementById('uploadPdfFile');
        const coverFile = document.getElementById('uploadPdfCoverImage')?.files?.[0];
        const category = document.getElementById('uploadPdfCategory').value;
        const level = document.getElementById('uploadPdfLevel').value;
        const language = document.getElementById('uploadPdfLanguage').value;
        const description = document.getElementById('uploadPdfDescription').value.trim();
        const displayOnCourses = document.getElementById('uploadPdfDisplayOnCourses').checked;

        if (!fileInput.files || fileInput.files.length === 0) {
            alert('Please select a PDF file');
            return;
        }

        const file = fileInput.files[0];
        if (file.type !== 'application/pdf') {
            alert('Only PDF files are allowed');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title);
        formData.append('category', category);
        formData.append('level', level);
        formData.append('language', language);
        formData.append('description', description);
        formData.append('displayOnCourses', displayOnCourses);

        try {
            const submitBtn = event.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Uploading...';
            submitBtn.disabled = true;

            const response = await fetch('/api/admin/learning-materials/upload', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                let coverUploaded = true;
                if (coverFile && result.data && result.data.id) {
                    coverUploaded = await this.uploadPDFCoverImage(result.data.id, coverFile);
                }

                if (coverFile && !coverUploaded) {
                    alert('⚠️ PDF uploaded, but cover image upload failed.');
                } else {
                    alert('✅ PDF uploaded successfully! Thumbnail generation started.');
                }

                if (displayOnCourses && result.data && result.data.id) {
                    this.selectedPDFManagementIds.add(result.data.id.toString());
                    this.saveSelectedPDFManagementIds();
                    this.updateSelectedPDFManagementCount(this.selectedPDFManagementIds.size);
                }

                bootstrap.Modal.getInstance(document.getElementById('pdfUploadModal')).hide();
                this.loadPDFManagement();
            } else {
                const error = await response.json();
                alert('❌ Upload failed: ' + (error.error || 'Unknown error'));
            }

            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;

        } catch (error) {
            console.error('Error uploading PDF:', error);
            alert('❌ Error uploading PDF: ' + error.message);
            event.target.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-upload me-2"></i>Upload PDF';
            event.target.querySelector('button[type="submit"]').disabled = false;
        }
    }

    /**
     * Preview PDF
     */
    previewPDFManagement(pdfId) {
        const pdf = this.allPDFManagementData.find(p => p.id == pdfId);
        if (!pdf) {
            alert('PDF not found');
            return;
        }

        const modalHtml = `
            <div class="modal fade" id="pdfManagementPreviewModal" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-file-pdf me-2"></i>Preview: ${pdf.title || pdf.name}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6>PDF Information</h6>
                                    <p><strong>Title:</strong> ${pdf.title || pdf.name}</p>
                                    <p><strong>Category:</strong> <span class="badge bg-info">${pdf.category || 'N/A'}</span></p>
                                    <p><strong>Level:</strong> <span class="badge bg-warning">${pdf.level || 'N/A'}</span></p>
                                    <p><strong>Pages:</strong> ${pdf.pageCount || 'Unknown'}</p>
                                    <p><strong>Size:</strong> ${pdf.size ? this.formatFileSize(pdf.size) : 'Unknown'}</p>
                                    <p><strong>Language:</strong> ${pdf.language || 'N/A'}</p>
                                </div>
                                <div class="col-md-6">
                                    <h6>Description</h6>
                                    <p>${pdf.description || 'No description available'}</p>
                                    <h6>Actions</h6>
                                    <div class="d-grid gap-2">
                                        <button class="btn btn-outline-primary btn-sm" onclick="window.adminPanel.modules.get('contentManagement').instance.openPDFManagement('${pdfId}')">
                                            <i class="fas fa-external-link-alt me-2"></i>Open PDF
                                        </button>
                                        <button class="btn btn-outline-info btn-sm" onclick="window.adminPanel.modules.get('contentManagement').instance.editPDFManagement('${pdfId}')">
                                            <i class="fas fa-edit me-2"></i>Edit Details
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>`;

        const existingModal = document.getElementById('pdfManagementPreviewModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('pdfManagementPreviewModal'));
        modal.show();
    }

    /**
     * Open PDF in new tab
     */
    openPDFManagement(pdfId) {
        const pdf = this.allPDFManagementData.find(p => p.id == pdfId);
        if (pdf && pdf.filePath) {
            window.open(pdf.filePath, '_blank');
        } else {
            alert('PDF file path not available');
        }
    }

    /**
     * Edit PDF
     */
    editPDFManagement(pdfId) {
        const pdf = this.allPDFManagementData.find(p => p.id == pdfId);
        if (!pdf) {
            alert('PDF not found');
            return;
        }

        const modalHtml = `
            <div class="modal fade" id="pdfManagementEditModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-edit me-2"></i>Edit PDF Material
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="pdfManagementEditForm">
                            <div class="modal-body">
                                <div class="row g-3">
                                    <div class="col-md-8">
                                        <label class="form-label">Title *</label>
                                        <input type="text" class="form-control" id="editPdfManagementTitle" value="${pdf.title || pdf.name || ''}" required>
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">Category *</label>
                                        <select class="form-select" id="editPdfManagementCategory" required>
                                            <option value="autocad" ${pdf.category === 'autocad' ? 'selected' : ''}>AutoCAD</option>
                                            <option value="revit" ${pdf.category === 'revit' ? 'selected' : ''}>Revit BIM</option>
                                            <option value="sketchup" ${pdf.category === 'sketchup' ? 'selected' : ''}>SketchUp</option>
                                            <option value="3dsmax" ${pdf.category === '3dsmax' ? 'selected' : ''}>3ds Max</option>
                                            <option value="general" ${pdf.category === 'general' ? 'selected' : ''}>General BIM</option>
                                        </select>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">BIM Level *</label>
                                        <select class="form-select" id="editPdfManagementLevel" required>
                                            <option value="beginner" ${pdf.level === 'beginner' ? 'selected' : ''}>Beginner</option>
                                            <option value="intermediate" ${pdf.level === 'intermediate' ? 'selected' : ''}>Intermediate</option>
                                            <option value="advanced" ${pdf.level === 'advanced' ? 'selected' : ''}>Advanced</option>
                                            <option value="expert" ${pdf.level === 'expert' ? 'selected' : ''}>Expert</option>
                                        </select>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Language</label>
                                        <select class="form-select" id="editPdfManagementLanguage">
                                            <option value="id" ${pdf.language === 'id' ? 'selected' : ''}>Bahasa Indonesia</option>
                                            <option value="en" ${pdf.language === 'en' ? 'selected' : ''}>English</option>
                                            <option value="mixed" ${pdf.language === 'mixed' ? 'selected' : ''}>Mixed</option>
                                        </select>
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label">Description</label>
                                        <textarea class="form-control" id="editPdfManagementDescription" rows="3">${pdf.description || ''}</textarea>
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label">Cover Image (optional)</label>
                                        ${pdf.thumbnailPath ? `
                                            <div class="mb-2">
                                                <img src="${pdf.thumbnailPath}" alt="Current cover" style="max-width: 180px; border-radius: 6px; border: 1px solid #e5e7eb;">
                                            </div>
                                        ` : '<small class="text-muted d-block mb-2">No cover image uploaded</small>'}
                                        <input type="file" class="form-control" id="editPdfManagementCoverImage" accept="image/png,image/jpeg,image/webp">
                                        <small class="text-muted">Upload to replace the current cover (JPG/PNG/WEBP, max 10MB)</small>
                                    </div>
                                    <div class="col-12">
                                        <div class="form-check">
                                            <input class="form-check-input" type="checkbox" id="editPdfManagementDisplayOnCourses" ${this.selectedPDFManagementIds.has(pdfId.toString()) ? 'checked' : ''}>
                                            <label class="form-check-label" for="editPdfManagementDisplayOnCourses">
                                                Display on Courses page
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="fas fa-save me-2"></i>Update PDF
                                </button>
                            </div>
                        </form>
                    </div>
                </div>`;

        const existingModal = document.getElementById('pdfManagementEditModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('pdfManagementEditForm').addEventListener('submit', (e) => this.handlePDFManagementUpdate(e, pdfId));

        const modal = new bootstrap.Modal(document.getElementById('pdfManagementEditModal'));
        modal.show();
    }

    /**
     * Handle PDF update
     */
    async handlePDFManagementUpdate(event, pdfId) {
        event.preventDefault();

        const updateData = {
            title: document.getElementById('editPdfManagementTitle').value.trim(),
            category: document.getElementById('editPdfManagementCategory').value,
            level: document.getElementById('editPdfManagementLevel').value,
            language: document.getElementById('editPdfManagementLanguage').value,
            description: document.getElementById('editPdfManagementDescription').value.trim(),
            displayOnCourses: document.getElementById('editPdfManagementDisplayOnCourses').checked
        };

        try {
            const coverFile = document.getElementById('editPdfManagementCoverImage')?.files?.[0];
            const submitBtn = event.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Updating...';
            submitBtn.disabled = true;

            const response = await fetch(`/api/admin/learning-materials/${pdfId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(updateData)
            });

            if (response.ok) {
                const result = await response.json();
                if (coverFile) {
                    const coverUploaded = await this.uploadPDFCoverImage(pdfId, coverFile);
                    if (!coverUploaded) {
                        alert('⚠️ PDF updated, but cover image upload failed.');
                    }
                }
                alert('âœ… PDF updated successfully!');

                const displayCheckbox = document.getElementById('editPdfManagementDisplayOnCourses');
                if (displayCheckbox.checked) {
                    this.selectedPDFManagementIds.add(pdfId.toString());
                } else {
                    this.selectedPDFManagementIds.delete(pdfId.toString());
                }
                this.saveSelectedPDFManagementIds();
                this.updateSelectedPDFManagementCount(this.selectedPDFManagementIds.size);

                bootstrap.Modal.getInstance(document.getElementById('pdfManagementEditModal')).hide();
                this.loadPDFManagement();
            } else {
                const error = await response.json();
                alert('âŒ Failed to update PDF: ' + (error.error || 'Unknown error'));
            }

            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;

        } catch (error) {
            console.error('Error updating PDF:', error);
            alert('âŒ Error updating PDF: ' + error.message);
            event.target.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-save me-2"></i>Update PDF';
            event.target.querySelector('button[type="submit"]').disabled = false;
        }
    }

    async uploadPDFCoverImage(pdfId, coverFile) {
        try {
            if (!pdfId || !coverFile) return true;

            if (!['image/jpeg', 'image/png', 'image/webp'].includes(coverFile.type)) {
                alert('❌ Cover image must be JPG, PNG, or WEBP.');
                return false;
            }

            if (coverFile.size > 10 * 1024 * 1024) {
                alert('❌ Cover image must be less than 10MB.');
                return false;
            }

            const formData = new FormData();
            formData.append('cover', coverFile);

            const response = await fetch(`/api/admin/learning-materials/${pdfId}/cover`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (!response.ok) {
                return false;
            }

            const result = await response.json();
            return !!result.success;
        } catch (error) {
            console.error('Error uploading cover image:', error);
            return false;
        }
    }

    /**
     * Delete PDF
     */
    deletePDFManagement(pdfId, title) {
        const confirmMsg = `Are you sure you want to permanently delete "${title}"?\n\nThis action cannot be undone!`;

        if (confirm(confirmMsg)) {
            const doubleConfirm = `FINAL CONFIRMATION: Delete "${title}"?\n\nThe PDF file and all associated data will be permanently lost!`;

            if (confirm(doubleConfirm)) {
                this.handlePDFManagementDelete(pdfId, title);
            }
        }
    }

    /**
     * Handle PDF delete
     */
    async handlePDFManagementDelete(pdfId, title) {
        try {
            const response = await fetch(`/api/admin/learning-materials/${pdfId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                alert(`âœ… PDF "${title}" deleted successfully!`);

                this.selectedPDFManagementIds.delete(pdfId.toString());
                this.saveSelectedPDFManagementIds();
                this.updateSelectedPDFManagementCount(this.selectedPDFManagementIds.size);

                this.loadPDFManagement();
            } else {
                const error = await response.json();
                alert('âŒ Failed to delete PDF: ' + (error.error || 'Unknown error'));
            }

        } catch (error) {
            console.error('Error deleting PDF:', error);
            alert('âŒ Error deleting PDF: ' + error.message);
        }
    }

    /**
     * Export PDF materials
     */
    exportPDFMaterials() {
        if (this.allPDFManagementData.length === 0) {
            alert('No PDF materials to export');
            return;
        }

        const headers = ['ID', 'Title', 'Category', 'Level', 'Pages', 'Size', 'Language', 'Description', 'Created Date'];
        const csvContent = [
            headers.join(','),
            ...this.allPDFManagementData.map(pdf => [
                pdf.id,
                `"${(pdf.title || pdf.name || '').replace(/"/g, '""')}"`,
                pdf.category || '',
                pdf.level || '',
                pdf.pageCount || '',
                pdf.size || '',
                pdf.language || '',
                `"${(pdf.description || '').replace(/"/g, '""')}"`,
                pdf.created_at || ''
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pdf-materials-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        alert('âœ… PDF materials exported successfully!');
    }

    // ===== BIM MEDIA FUNCTIONS =====

    /**
     * Load saved BIM tags from localStorage
     */
    loadSavedBIMTags() {
        try {
            const saved = localStorage.getItem('bcl_bim_media_tags');
            if (saved) {
                this.savedBIMTags = JSON.parse(saved);
            } else {
                this.savedBIMTags = {};
            }
        } catch (error) {
            console.error('âŒ Error loading saved BIM tags:', error);
            this.savedBIMTags = {};
        }
    }

    /**
     * Load BIM custom categories from localStorage
     */
    loadBIMCustomCategories() {
        try {
            const saved = localStorage.getItem('bcl_bim_custom_categories');
            if (saved) {
                this.bimCustomCategories = JSON.parse(saved);
            } else {
                this.bimCustomCategories = {};
            }
        } catch (error) {
            console.error('âŒ Error loading BIM custom categories:', error);
            this.bimCustomCategories = {};
        }
    }

    /**
     * Save BIM tags to localStorage
     */
    saveBIMTagsToStorage() {
        try {
            localStorage.setItem('bcl_bim_media_tags', JSON.stringify(this.savedBIMTags));
        } catch (error) {
            console.error('âŒ Error saving BIM tags to localStorage:', error);
        }
    }

    /**
     * Apply saved BIM tags to media files
     */
    applySavedBIMTagsToMedia(mediaFiles) {
        let taggedCount = 0;

        mediaFiles.forEach(file => {
            const filePath = file.path || file.url;
            const savedTag = this.savedBIMTags[filePath];
            if (savedTag) {
                Object.assign(file, savedTag);
                file.tagged = true;
                file.localSave = true;
                taggedCount++;
            } else {
                file.tagged = false;
            }
        });

        return mediaFiles;
    }

    /**
     * Load BIM media
     */
    async loadBIMMedia() {
        try {

            let content = `
                <div class="row mb-4">
                    <div class="col-12">
                        <div class="content-card">
                            <div class="card-body-modern">
                                <div class="row g-3 align-items-end">
                                    <div class="col-md-4">
                                        <label class="form-label fw-semibold">
                                            <i class="fas fa-search me-2"></i>Search Videos
                                        </label>
                                        <input type="text" class="form-control" id="videoSearchInput"
                                               placeholder="Search by name, year, or location..."
                                               onkeyup="window.adminPanel.modules.get('contentManagement').instance.filterVideos()">
                                    </div>
                                    <div class="col-md-2">
                                        <label class="form-label fw-semibold">
                                            <i class="fas fa-filter me-2"></i>Filter by Year
                                        </label>
                                        <select class="form-select" id="yearFilter" onchange="window.adminPanel.modules.get('contentManagement').instance.filterVideos()">
                                            <option value="">All Years</option>
                                            <option value="2023">2023</option>
                                            <option value="2024">2024</option>
                                            <option value="2025">2025</option>
                                        </select>
                                    </div>
                                    <div class="col-md-2">
                                        <label class="form-label fw-semibold">
                                            <i class="fas fa-map-marker-alt me-2"></i>Location
                                        </label>
                                        <select class="form-select" id="locationFilter" onchange="window.adminPanel.modules.get('contentManagement').instance.filterVideos()">
                                            <option value="">All Locations</option>
                                            <option value="Jawa">Jawa</option>
                                            <option value="Sumatra">Sumatra</option>
                                            <option value="Kalimantan">Kalimantan</option>
                                            <option value="Nusa Tenggara">Nusa Tenggara</option>
                                        </select>
                                    </div>
                                    <div class="col-md-2">
                                        <label class="form-label fw-semibold">
                                            <i class="fas fa-file me-2"></i>Media Type
                                        </label>
                                        <select class="form-select" id="mediaTypeFilter" onchange="window.adminPanel.modules.get('contentManagement').instance.filterVideos()">
                                            <option value="">All Media</option>
                                            <option value="video">Videos Only</option>
                                            <option value="image">Images Only</option>
                                        </select>
                                    </div>
                                    <div class="col-md-2">
                                        <div class="d-grid gap-2">
                                            <button class="btn btn-modern-primary" onclick="window.adminPanel.modules.get('contentManagement').instance.scanMediaSources()">
                                                <i class="fas fa-sync-alt me-2"></i>Scan Sources
                                            </button>
                                            <button class="btn btn-outline-secondary btn-sm" onclick="window.adminPanel.modules.get('contentManagement').instance.clearAllFilters()">
                                                <i class="fas fa-times me-1"></i>Clear Filters
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-8">
                        <div class="card">
                            <div class="card-header">
                                <h6 class="mb-0">Media Files</h6>
                            </div>
                            <div class="card-body">
                                <div id="media-files-list">
                                    <div class="text-center text-muted">
                                        <i class="fas fa-images fa-3x mb-3"></i>
                                        <p>Click "Scan Media Sources" to load available media files</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-md-4">
                        <div class="card">
                            <div class="card-header">
                                <h6 class="mb-0">Media Management</h6>
                            </div>
                            <div class="card-body">
                                <div id="tagging-interface" class="d-none">
                                    <div id="current-file-info" class="mb-3 p-3 bg-light rounded">
                                        <small class="text-muted">Selected File:</small>
                                        <div id="selected-file-name" class="fw-bold"></div>
                                        <div id="selected-file-path" class="small text-muted"></div>
                                    </div>

                                    <form id="media-tag-form">
                                        <div class="mb-3">
                                            <label class="form-label">File Type</label>
                                            <select class="form-select" id="fileType" required>
                                                <option value="">Select type...</option>
                                                <option value="video">Video</option>
                                                <option value="image">Image</option>
                                            </select>
                                        </div>

                                        <div class="mb-3">
                                            <label class="form-label">Year</label>
                                            <select class="form-select" id="year" required>
                                                <option value="">Select year...</option>
                                                <option value="2023">2023</option>
                                                <option value="2024">2024</option>
                                                <option value="2025">2025</option>
                                            </select>
                                        </div>

                                        <div class="mb-3">
                                            <label class="form-label">Location</label>
                                            <select class="form-select" id="location" required>
                                                <option value="">Select location...</option>
                                                <option value="Jawa">Jawa</option>
                                                <option value="Sumatra">Sumatra</option>
                                                <option value="Kalimantan">Kalimantan</option>
                                                <option value="Nusa Tenggara">Nusa Tenggara</option>
                                            </select>
                                        </div>

                                        <div class="mb-3">
                                            <label class="form-label">BIM Dimension</label>
                                            <select class="form-select" id="bimDimension" required>
                                                <option value="">Select dimension...</option>
                                                <option value="2D">2D</option>
                                                <option value="3D">3D</option>
                                                <option value="4D">4D</option>
                                                <option value="5D">5D</option>
                                                <option value="6D">6D</option>
                                                <option value="7D">7D</option>
                                            </select>
                                        </div>

                                        <div class="mb-3">
                                            <label class="form-label">Project Type</label>
                                            <select class="form-select" id="projectType" required>
                                                <option value="">Select type...</option>
                                                <option value="Commercial">Commercial</option>
                                                <option value="Healthcare">Healthcare</option>
                                                <option value="Residential">Residential</option>
                                                <option value="Education">Education</option>
                                                <option value="Infrastructure">Infrastructure</option>
                                            </select>
                                        </div>

                                        <div class="mb-3">
                                            <label class="form-label">Description</label>
                                            <textarea class="form-control" id="description" rows="3" placeholder="Optional description..."></textarea>
                                        </div>

                                        <div id="bim-previous-tags-section" class="mt-3 d-none">
                                            <label class="form-label text-muted small">Previously Used Tags:</label>
                                            <div id="bim-previous-tags-container" class="d-flex flex-wrap gap-2 mt-2"></div>
                                            <small class="text-muted">Click on tags to add them to the current media</small>
                                        </div>

                                        <div class="d-grid gap-2">
                                            <button type="submit" class="btn btn-success">
                                                <i class="fas fa-save me-2"></i>Save Tags
                                            </button>
                                            <button type="button" class="btn btn-secondary" onclick="window.adminPanel.modules.get('contentManagement').instance.clearTaggingForm()">
                                                <i class="fas fa-times me-2"></i>Clear
                                            </button>
                                        </div>
                                    </form>
                                </div>

                                <div id="tagging-placeholder" class="text-center text-muted">
                                    <i class="fas fa-tag fa-2x mb-3"></i>
                                    <p>Select a media file to start tagging</p>
                                </div>
                            </div>
                        </div>

                        <div class="card mt-3">
                            <div class="card-header">
                                <h6 class="mb-0">Excluded from Public Display</h6>
                            </div>
                            <div class="card-body">
                                <div id="excluded-media-list" class="small">
                                    <div class="text-center text-muted">
                                        <i class="fas fa-ban fa-lg mb-2"></i>
                                        <p class="mb-1">No excluded media</p>
                                        <small>Files removed from Knowledgehub will appear here</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row mt-4">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-header">
                                <h6 class="mb-0">Tagged Media Overview</h6>
                            </div>
                            <div class="card-body">
                                <div id="tagged-media-overview">
                                    <div class="text-center">
                                        <div class="spinner-border spinner-border-sm text-primary" role="status">
                                            <span class="visually-hidden">Loading...</span>
                                        </div>
                                        <p class="mb-0">Loading tagged media statistics...</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;

            document.getElementById('bim-media-content').innerHTML = content;

            this.loadTaggedMediaOverview();
            this.setupTaggingForm();


        } catch (error) {
            console.error('Error loading BIM media:', error);
            document.getElementById('bim-media-content').innerHTML = '<div class="alert alert-danger"><i class="fas fa-exclamation-triangle me-2"></i>Error loading BIM media management interface: ' + error.message + '</div>';
        }
    }

    /**
     * BIM Media Tagging Functions
     */
    async scanMediaSources() {
        try {
            const button = event.target;
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Scanning...';
            button.disabled = true;

            const response = await fetch('/api/admin/bim-media/sources', {
                credentials: 'include'
                });
            if (!response.ok) {
                throw new Error('Failed to get media sources');
            }

            const sources = await response.json();
            let allFiles = [];

            for (const source of sources) {
                try {
                    const filesResponse = await fetch(`/api/admin/bim-media/files?source=${source.id}`, {
                        credentials: 'include'
                });
                    if (filesResponse.ok) {
                        const files = await filesResponse.json();
                        allFiles = allFiles.concat(files.map(file => ({ ...file, source: source.name })));
                    }
                } catch (error) {}
            }

            this.allMediaFiles = allFiles;
            this.displayMediaFiles(allFiles);

            button.innerHTML = originalText;
            button.disabled = false;

        } catch (error) {
            console.error('Error scanning media sources:', error);
            alert('Failed to scan media sources: ' + error.message);
            event.target.innerHTML = '<i class="fas fa-search me-2"></i>Scan Media Sources';
            event.target.disabled = false;
        }
    }

    displayMediaFiles(files) {
        const container = document.getElementById('media-files-list');

        if (files.length === 0) {
            container.innerHTML = '<div class="text-center text-muted"><i class="fas fa-folder-open fa-3x mb-3"></i><p>No media files found</p></div>';
            return;
        }

        const groupedFiles = {
            video: files.filter(file => file.type === 'video'),
            image: files.filter(file => file.type === 'image')
        };

        let html = '';

        if (groupedFiles.video.length > 0) {
            html += `
                <div class="media-group-section mb-4">
                    <div class="d-flex align-items-center mb-3">
                        <i class="fas fa-video text-warning me-2 fa-lg"></i>
                        <h5 class="mb-0">Media Video (${groupedFiles.video.length})</h5>
                    </div>
                    <div class="row g-3">
            `;

            groupedFiles.video.forEach((file, index) => {
                const fileName = file.name || 'Unknown';
                const filePath = file.path || file.url || '';
                const fileSize = file.size ? this.formatFileSize(file.size) : 'Unknown';
                const source = file.source || 'Unknown';
                const isTagged = file.tagged || false;

                html += `
                    <div class="col-md-6 col-lg-4">
                        <div class="card media-file-card ${isTagged ? 'border-success' : ''} ${file.excluded ? 'border-danger' : ''}">
                            <div class="card-body text-center">
                                <i class="fas fa-video fa-2x mb-2 text-warning"></i>
                                <h6 class="card-title text-truncate" title="${fileName}">${fileName}</h6>
                                <small class="text-muted d-block">${source}</small>
                                <small class="text-muted d-block">${fileSize}</small>
                                <div class="mb-2">
                                    ${isTagged ? '<span class="badge bg-success"><i class="fas fa-check me-1"></i>Tagged</span>' : '<span class="badge bg-secondary">Untagged</span>'}
                                    ${file.excluded ? '<span class="badge bg-danger ms-1"><i class="fas fa-ban me-1"></i>Excluded</span>' : ''}
                                </div>
                                <div class="d-flex justify-content-center gap-1">
                                    <button class="btn btn-sm btn-outline-info" onclick="window.adminPanel.modules.get('contentManagement').instance.previewMediaFile('${(file.path || file.url).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', '${fileName.replace(/'/g, "\\'")}', '${file.type}'); event.stopPropagation();">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-primary" onclick="window.adminPanel.modules.get('contentManagement').instance.selectMediaFile('${(file.path || file.url).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', '${fileName.replace(/'/g, "\\'")}', '${filePath.replace(/'/g, "\\'")}'); event.stopPropagation();">
                                        <i class="fas fa-tag"></i>
                                    </button>
                                    ${file.excluded ?
                        `<button class="btn btn-sm btn-outline-success" onclick="window.adminPanel.modules.get('contentManagement').instance.restoreMediaCandidate('${(file.path || file.url).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'); event.stopPropagation();">
                                            <i class="fas fa-undo"></i>
                                        </button>` :
                        `<button class="btn btn-sm btn-outline-danger" onclick="window.adminPanel.modules.get('contentManagement').instance.removeMediaCandidate('${(file.path || file.url).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', '${fileName.replace(/'/g, "\\'")}'); event.stopPropagation();">
                                            <i class="fas fa-ban"></i>
                                        </button>`
                    }
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }

        if (groupedFiles.image.length > 0) {
            html += `
                <div class="media-group-section mb-4">
                    <div class="d-flex align-items-center mb-3">
                        <i class="fas fa-image text-success me-2 fa-lg"></i>
                        <h5 class="mb-0">Media Image (Render) (${groupedFiles.image.length})</h5>
                    </div>
                    <div class="row g-3">
            `;

            groupedFiles.image.forEach((file, index) => {
                const fileName = file.name || 'Unknown';
                const filePath = file.path || file.url || '';
                const fileSize = file.size ? this.formatFileSize(file.size) : 'Unknown';
                const source = file.source || 'Unknown';
                const isTagged = file.tagged || false;

                html += `
                    <div class="col-md-6 col-lg-4">
                        <div class="card media-file-card ${isTagged ? 'border-success' : ''}" onclick="window.adminPanel.modules.get('contentManagement').instance.selectMediaFile('${file.path || file.url}', '${fileName}', '${filePath}')">
                            <div class="card-body text-center">
                                <i class="fas fa-image fa-2x mb-2 text-success"></i>
                                <h6 class="card-title text-truncate" title="${fileName}">${fileName}</h6>
                                <small class="text-muted d-block">${source}</small>
                                <small class="text-muted d-block">${fileSize}</small>
                                ${isTagged ? '<span class="badge bg-success"><i class="fas fa-check me-1"></i>Tagged</span>' : '<span class="badge bg-secondary">Untagged</span>'}
                            </div>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }

        if (groupedFiles.video.length === 0 && groupedFiles.image.length === 0) {
            html = '<div class="text-center text-muted"><i class="fas fa-folder-open fa-3x mb-3"></i><p>No media files found in selected categories</p></div>';
        }

        container.innerHTML = html;
    }

    selectMediaFile(path, name, fullPath) {
        this.currentSelectedFile = { path, name, fullPath };

        document.getElementById('selected-file-name').textContent = name;
        document.getElementById('selected-file-path').textContent = fullPath;

        this.displayPreviouslyUsedBIMTags();

        document.getElementById('tagging-interface').classList.remove('d-none');
        document.getElementById('tagging-placeholder').classList.add('d-none');

        // Highlight selected card
        document.querySelectorAll('.media-file-card').forEach(card => {
            card.classList.remove('border-primary', 'bg-light');
        });

        const clickedCard = event.target.closest('.media-file-card');
        if (clickedCard) {
            clickedCard.classList.add('border-primary', 'bg-light');
        }
    }

    displayPreviouslyUsedBIMTags() {
        const previousTags = this.getPreviouslyUsedBIMTags();
        const container = document.getElementById('bim-previous-tags-container');
        const section = document.getElementById('bim-previous-tags-section');

        if (!container || !section) return;

        if (previousTags.length === 0) {
            section.classList.add('d-none');
            return;
        }

        let html = '';
        previousTags.forEach(tag => {
            html += `<button type="button" class="btn btn-sm btn-outline-secondary me-1 mb-1" onclick="window.adminPanel.modules.get('contentManagement').instance.addBIMTagToInput('${tag}')">${tag}</button>`;
        });

        container.innerHTML = html;
        section.classList.remove('d-none');
    }

    getPreviouslyUsedBIMTags() {
        const allTags = new Set();

        Object.values(this.savedBIMTags).forEach(fileTags => {
            if (fileTags.tags && Array.isArray(fileTags.tags)) {
                fileTags.tags.forEach(tag => {
                    if (tag && tag.trim()) {
                        allTags.add(tag.trim().toLowerCase());
                    }
                });
            }
        });

        return Array.from(allTags).sort();
    }

    addBIMTagToInput(tag) {
    }

    async loadTaggedMediaOverview() {
        try {
            const response = await fetch('/api/admin/bim-media/stats', {
                credentials: 'include'
                });
            if (response.ok) {
                const stats = await response.json();
                this.displayTaggedMediaOverview(stats);
            } else {
                document.getElementById('tagged-media-overview').innerHTML = '<div class="alert alert-warning">Unable to load tagged media statistics</div>';
            }
        } catch (error) {
            console.error('Error loading tagged media overview:', error);
            document.getElementById('tagged-media-overview').innerHTML = '<div class="alert alert-danger">Error loading tagged media statistics</div>';
        }
    }

    displayTaggedMediaOverview(stats) {
        const container = document.getElementById('tagged-media-overview');

        let html = `
            <div class="row text-center">
                <div class="col-md-3">
                    <div class="p-3 bg-primary text-white rounded">
                        <h3>${stats.totalTagged || 0}</h3>
                        <small>Total Tagged</small>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="p-3 bg-success text-white rounded">
                        <h3>${Object.keys(stats.byYear || {}).length}</h3>
                        <small>Years</small>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="p-3 bg-warning text-white rounded">
                        <h3>${Object.keys(stats.byLocation || {}).length}</h3>
                        <small>Locations</small>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="p-3 bg-info text-white rounded">
                        <h3>${Object.keys(stats.byType || {}).length}</h3>
                        <small>Types</small>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    setupTaggingForm() {
        document.getElementById('media-tag-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!this.currentSelectedFile) {
                alert('Please select a media file first');
                return;
            }

            const formData = {
                filePath: this.currentSelectedFile.path,
                fileName: this.currentSelectedFile.name,
                fileType: document.getElementById('fileType').value,
                year: document.getElementById('year').value,
                location: document.getElementById('location').value,
                bimDimension: document.getElementById('bimDimension').value,
                type: document.getElementById('projectType').value,
                description: document.getElementById('description').value
            };

            try {
                const button = e.target.querySelector('button[type="submit"]');
                const originalText = button.innerHTML;
                button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';
                button.disabled = true;

                const response = await fetch('/api/admin/bim-media/tags', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify(formData)
                });

                if (response.ok) {
                    alert('Media tags saved successfully!');
                    this.clearTaggingForm();
                    this.loadTaggedMediaOverview();

                    const selectedCard = document.querySelector('.media-file-card.border-primary');
                    if (selectedCard) {
                        selectedCard.classList.add('border-success');
                        if (!selectedCard.querySelector('.badge')) {
                            selectedCard.innerHTML += '<span class="badge bg-success"><i class="fas fa-check me-1"></i>Tagged</span>';
                        }
                    }
                } else {
                    const error = await response.json();
                    alert('Failed to save tags: ' + (error.error || 'Unknown error'));
                }

                button.innerHTML = originalText;
                button.disabled = false;

            } catch (error) {
                console.error('Error saving media tags:', error);
                alert('Error saving media tags: ' + error.message);
                e.target.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-save me-2"></i>Save Tags';
                e.target.querySelector('button[type="submit"]').disabled = false;
            }
        });
    }

    clearTaggingForm() {
        document.getElementById('media-tag-form').reset();
        this.currentSelectedFile = null;

        document.getElementById('tagging-interface').classList.add('d-none');
        document.getElementById('tagging-placeholder').classList.remove('d-none');

        document.querySelectorAll('.media-file-card').forEach(card => {
            card.classList.remove('border-primary', 'bg-light');
        });
    }

    filterVideos() {
        if (this.allMediaFiles.length === 0) {
            const container = document.getElementById('media-files-list');
            if (container) {
                container.innerHTML = '<div class="text-center text-muted"><i class="fas fa-info-circle fa-2x mb-3"></i><p>Please scan media sources first to load files for filtering</p></div>';
            }
            return;
        }

        const searchTerm = document.getElementById('videoSearchInput').value.toLowerCase().trim();
        const yearFilter = document.getElementById('yearFilter').value;
        const locationFilter = document.getElementById('locationFilter').value;
        const mediaTypeFilter = document.getElementById('mediaTypeFilter').value;

        const filteredFiles = this.allMediaFiles.filter(file => {
            const fileName = (file.name || '').toLowerCase();
            const filePath = (file.path || file.url || '').toLowerCase();
            const source = (file.source || '').toLowerCase();
            const fileType = file.type || '';

            const matchesSearch = !searchTerm ||
                fileName.includes(searchTerm) ||
                filePath.includes(searchTerm) ||
                source.includes(searchTerm);

            const matchesYear = !yearFilter || filePath.includes(yearFilter);

            const matchesLocation = !locationFilter ||
                filePath.toLowerCase().includes(locationFilter.toLowerCase());

            let matchesMediaType = true;
            if (mediaTypeFilter === 'video') {
                matchesMediaType = fileType === 'video' || (file.name && /\.(mp4|avi|mov|wmv|flv|mkv|webm|ogv)$/i.test(file.name));
            } else if (mediaTypeFilter === 'image') {
                matchesMediaType = (fileType === 'image') ||
                    (file.name && /\.(jpg|jpeg|png|gif|bmp|tiff|tif|webp|svg|ico)$/i.test(file.name)) ||
                    (fileType && fileType.startsWith('image/'));
            }

            return matchesSearch && matchesYear && matchesLocation && matchesMediaType;
        });

        this.displayMediaFiles(filteredFiles);
        this.updateFilterResults(filteredFiles.length, this.allMediaFiles.length);
    }

    updateFilterResults(filteredCount, totalCount) {
        let resultsInfo = '';
        if (filteredCount !== totalCount) {
            resultsInfo = `<div class="alert alert-info py-2">
                <i class="fas fa-filter me-2"></i>
                Showing ${filteredCount} of ${totalCount} media files
            </div>`;
        }

        const container = document.getElementById('media-files-list');
        const existingAlert = container.querySelector('.alert');

        if (existingAlert) {
            existingAlert.remove();
        }

        if (resultsInfo) {
            container.insertAdjacentHTML('afterbegin', resultsInfo);
        }
    }

    clearAllFilters() {
        document.getElementById('videoSearchInput').value = '';
        document.getElementById('yearFilter').value = '';
        document.getElementById('locationFilter').value = '';
        document.getElementById('mediaTypeFilter').value = '';

        if (this.allMediaFiles.length > 0) {
            this.displayMediaFiles(this.allMediaFiles);
            this.updateFilterResults(this.allMediaFiles.length, this.allMediaFiles.length);
        }
    }

    async previewMediaFile(filePath, fileName, fileType) {
        try {
            document.getElementById('previewLoading').style.display = 'block';
            document.getElementById('previewVideo').style.display = 'none';
            document.getElementById('previewImage').style.display = 'none';
            document.getElementById('previewInfo').style.display = 'none';

            document.getElementById('previewFileName').innerHTML = '<span>' + fileName + '</span>';
            document.getElementById('previewFileType').innerHTML = '<strong>Type:</strong> <span>' + (fileType || 'Unknown') + '</span>';
            document.getElementById('previewFileSize').innerHTML = '<strong>Size:</strong> <span>Loading...</span>';
            document.getElementById('previewFileSource').innerHTML = '<strong>Source:</strong> <span>Loading...</span>';
            document.getElementById('previewTags').innerHTML = '<strong>Tags:</strong> <span>Loading...</span>';
            document.getElementById('previewStatus').innerHTML = '<strong>Status:</strong> <span>Loading...</span>';

            const actionsContainer = document.getElementById('previewActions');
            actionsContainer.innerHTML = `
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                <button type="button" class="btn btn-primary" onclick="window.adminPanel.modules.get('contentManagement').instance.selectMediaFile('${filePath}', '${fileName}', '${filePath}')">Tag This File</button>
            `;

            const modal = new bootstrap.Modal(document.getElementById('mediaPreviewModal'));
            modal.show();

            const mediaUrl = this.constructTaggedMediaUrl(fileName, fileType, filePath);

            if (fileType === 'video' || (fileName && /\.(mp4|avi|mov|wmv|flv|mkv|webm|ogv)$/i.test(fileName))) {
                const videoElement = document.getElementById('previewVideo');
                videoElement.src = mediaUrl;
                videoElement.style.display = 'block';
                videoElement.onloadeddata = () => {
                    document.getElementById('previewLoading').style.display = 'none';
                    document.getElementById('previewInfo').style.display = 'block';
                    this.updatePreviewFileInfo(filePath, fileName);
                };
                videoElement.onerror = () => {
                    document.getElementById('previewLoading').innerHTML = '<p class="text-danger">Failed to load video</p>';
                };
            } else if (fileType === 'image' || (fileName && /\.(jpg|jpeg|png|gif|bmp|tiff|tif|webp|svg|ico)$/i.test(fileName))) {
                const imageElement = document.getElementById('previewImage');
                imageElement.src = mediaUrl;
                imageElement.style.display = 'block';
                imageElement.onload = () => {
                    document.getElementById('previewLoading').style.display = 'none';
                    document.getElementById('previewInfo').style.display = 'block';
                    this.updatePreviewFileInfo(filePath, fileName);
                };
                imageElement.onerror = () => {
                    document.getElementById('previewLoading').innerHTML = '<p class="text-danger">Failed to load image</p>';
                };
            } else {
                document.getElementById('previewLoading').innerHTML = '<p class="text-warning">Preview not available for this file type</p>';
                setTimeout(() => {
                    this.updatePreviewFileInfo(filePath, fileName);
                    document.getElementById('previewInfo').style.display = 'block';
                }, 500);
            }

        } catch (error) {
            console.error('Error opening preview modal:', error);
            alert('Error loading media preview: ' + error.message);
        }
    }

    updatePreviewFileInfo(filePath, fileName) {
        const file = this.allMediaFiles.find(f => (f.path || f.url) === filePath || f.name === fileName);

        if (file) {
            document.getElementById('previewFileSize').innerHTML = '<strong>Size:</strong> <span>' + (file.size ? this.formatFileSize(file.size) : 'Unknown') + '</span>';
            document.getElementById('previewFileSource').innerHTML = '<strong>Source:</strong> <span>' + (file.source || 'Unknown') + '</span>';
            document.getElementById('previewTags').innerHTML = '<strong>Tags:</strong> <span>' + ((file.tags && file.tags.length > 0) ? file.tags.join(', ') : 'No tags') + '</span>';
            document.getElementById('previewStatus').innerHTML = '<strong>Status:</strong> <span>' +
                (file.excluded ? '<span class="badge bg-danger">Excluded</span>' :
                    file.tagged ? '<span class="badge bg-success">Tagged</span>' :
                        '<span class="badge bg-secondary">Untagged</span>') + '</span>';
        }
    }

    async removeMediaCandidate(filePath, fileName) {
        if (!confirm(`Are you sure you want to remove "${fileName}" from public display?\n\nThis file will no longer appear in the Knowledgehub.`)) {
            return;
        }

        try {
            const response = await fetch('/api/admin/bim-media/exclude', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ filePath, fileName })
            });

            if (response.ok) {
                const result = await response.json();
                alert('âœ… File removed from public display successfully!');

                const fileIndex = this.allMediaFiles.findIndex(f => (f.path || f.url) === filePath);
                if (fileIndex !== -1) {
                    this.allMediaFiles[fileIndex].excluded = true;
                    this.displayMediaFiles(this.allMediaFiles);
                    this.updateExcludedMediaList();
                }
            } else {
                const error = await response.json();
                alert('âŒ Failed to exclude media: ' + (error.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error excluding media:', error);
            alert('âŒ Error excluding media: ' + error.message);
        }
    }

    async restoreMediaCandidate(filePath) {
        try {
            const response = await fetch('/api/admin/bim-media/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ filePath })
            });

            if (response.ok) {
                const result = await response.json();
                alert('âœ… File restored to public display successfully!');

                const fileIndex = this.allMediaFiles.findIndex(f => (f.path || f.url) === filePath);
                if (fileIndex !== -1) {
                    this.allMediaFiles[fileIndex].excluded = false;
                    this.displayMediaFiles(this.allMediaFiles);
                    this.updateExcludedMediaList();
                }
            } else {
                const error = await response.json();
                alert('âŒ Failed to restore media: ' + (error.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error restoring media:', error);
            alert('âŒ Error restoring media: ' + error.message);
        }
    }

    updateExcludedMediaList() {
        const excludedContainer = document.getElementById('excluded-media-list');
        const excludedFiles = this.allMediaFiles.filter(f => f.excluded);

        if (excludedFiles.length === 0) {
            excludedContainer.innerHTML = `
                <div class="text-center text-muted">
                    <i class="fas fa-ban fa-lg mb-2"></i>
                    <p class="mb-1">No excluded media</p>
                    <small>Files removed from Knowledgehub will appear here</small>
                </div>
            `;
            return;
        }

        let html = '<div class="list-group list-group-flush small">';
        excludedFiles.forEach(file => {
            html += `
                <div class="list-group-item d-flex justify-content-between align-items-center px-2 py-2">
                    <div class="flex-grow-1 me-2">
                        <div class="fw-bold text-truncate" title="${file.name}">${file.name}</div>
                        <small class="text-muted">${file.source || 'Unknown'}</small>
                    </div>
                    <button class="btn btn-sm btn-outline-success" onclick="window.adminPanel.modules.get('contentManagement').instance.restoreMediaCandidate('${file.path || file.url}')" title="Restore to Public Display">
                        <i class="fas fa-undo"></i>
                    </button>
                </div>
            `;
        });
        html += '</div>';

        excludedContainer.innerHTML = html;
    }

    constructTaggedMediaUrl(filename, type, fullPath) {
        const sourcePath = String(fullPath || filename || '').trim();
        if (!sourcePath) {
            return '';
        }

        let normalizedPath = sourcePath.replace(/\//g, '\\');
        if (/^PC-BIM02[\\/]/i.test(normalizedPath)) {
            normalizedPath = `\\\\pc-bim02\\PROJECT BIM 2025\\${normalizedPath.replace(/^PC-BIM02[\\/]+/i, '')}`;
        }

        if (/^\\\\pc-bim02\\/i.test(normalizedPath)) {
            const publicRelativePath = normalizedPath
                .replace(/^\\\\pc-bim02\\+/i, '')
                .replace(/\\/g, '/')
                .split('/')
                .filter(Boolean)
                .map((segment) => encodeURIComponent(segment))
                .join('/');

            return `/data/bim-media-public/pc-bim02/${publicRelativePath}`;
        }

        if (/^G:[\\/]/i.test(normalizedPath)) {
            return `/api/admin/preview-media?path=${encodeURIComponent(normalizedPath.replace(/\\/g, '/'))}`;
        }

        return '';
    }

    formatFileSize(bytes) {
        if (!bytes) return 'Unknown';
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    showSaveErrorNotification() {
        const notification = document.createElement('div');
        notification.className = 'alert alert-warning alert-dismissible fade show position-fixed';
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.innerHTML = `
            <i class="fas fa-exclamation-triangle me-2"></i>
            <strong>Save Warning:</strong> Changes saved locally but may not sync to server.
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }
}

// Initialize and register the content management module immediately when script loads
(function() {

    // Ensure adminPanel exists
    if (!window.adminPanel) {
        console.error('âŒ window.adminPanel not found - content management module cannot initialize');
        return;
    }

    // Ensure modules Map exists
    if (!window.adminPanel.modules) {
        console.error('âŒ window.adminPanel.modules not found - content management module cannot initialize');
        return;
    }

    try {
        // Create content management module instance
        const contentManagementModule = new ContentManagementModule(window.adminPanel);

        // Set up the module entry
        window.adminPanel.modules.set('contentManagement', {
            loaded: true,
            path: 'modules/content-management.js',
            instance: contentManagementModule
        });

        // Initialize the module
        contentManagementModule.initialize();

    } catch (error) {
        console.error('âŒ Failed to initialize content management module:', error);
    }
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContentManagementModule;
}


