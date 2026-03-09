/**
 * Plugins Module - Manages system plugins and extensions
 */
class PluginsModule {
    constructor(adminPanel) {
        this.adminPanel = adminPanel;
        this.pluginsData = [];
        this.currentPage = 1;
        this.itemsPerPage = 12;
    }

    /**
     * Initialize the plugins module
     */
    initialize() {
        console.log('🔌 Initializing Plugins Module');
        this.setupEventListeners();
    }

    /**
     * Setup event listeners for plugins elements
     */
    setupEventListeners() {
        // Will be set up when plugins section is loaded
    }

    /**
     * Load plugins management
     */
    async loadPlugins() {
        console.log('🔌 Loading plugins management...');

        const content = document.getElementById('plugins-content');
        if (!content) return;

        content.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h5 class="mb-0">Plugins & Extensions Management</h5>
                    <small class="text-muted">Manage system plugins and third-party extensions</small>
                    <div class="mt-2">
                        <span class="badge bg-success fs-6" id="activePluginsCount">
                            <i class="fas fa-plug me-1"></i>Active: 0 plugins
                        </span>
                        <span class="badge bg-warning fs-6 ms-2" id="inactivePluginsCount">
                            <i class="fas fa-ban me-1"></i>Inactive: 0 plugins
                        </span>
                    </div>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-outline-primary" onclick="safeCall('plugins', 'refreshPlugins')">
                        <i class="fas fa-sync-alt me-2"></i>Refresh
                    </button>
                    <button class="btn btn-modern-primary" onclick="safeCall('plugins', 'showInstallPluginModal')">
                        <i class="fas fa-plus me-2"></i>Install Plugin
                    </button>
                </div>
            </div>

            <!-- Plugin Statistics -->
            <div class="row g-3 mb-4">
                <div class="col-md-3">
                    <div class="card text-center">
                        <div class="card-body">
                            <div class="display-4 text-primary" id="totalPlugins">0</div>
                            <div class="text-muted">Total Plugins</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center">
                        <div class="card-body">
                            <div class="display-4 text-success" id="enabledPlugins">0</div>
                            <div class="text-muted">Enabled</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center">
                        <div class="card-body">
                            <div class="display-4 text-warning" id="disabledPlugins">0</div>
                            <div class="text-muted">Disabled</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center">
                        <div class="card-body">
                            <div class="display-4 text-info" id="updateAvailable">0</div>
                            <div class="text-muted">Updates Available</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Search and Filter Controls -->
            <div class="row g-3 mb-4">
                <div class="col-md-4">
                    <input type="text" class="form-control" id="pluginsSearchInput"
                        placeholder="Search plugins by name or description..." onkeyup="safeCall('plugins', 'filterPlugins')">
                </div>
                <div class="col-md-3">
                    <select class="form-select" id="pluginsStatusFilter" onchange="safeCall('plugins', 'filterPlugins')">
                        <option value="">All Status</option>
                        <option value="enabled">Enabled</option>
                        <option value="disabled">Disabled</option>
                        <option value="error">Error</option>
                    </select>
                </div>
                <div class="col-md-3">
                    <select class="form-select" id="pluginsCategoryFilter" onchange="safeCall('plugins', 'filterPlugins')">
                        <option value="">All Categories</option>
                        <option value="authentication">Authentication</option>
                        <option value="content">Content Management</option>
                        <option value="analytics">Analytics</option>
                        <option value="security">Security</option>
                        <option value="integration">Integration</option>
                        <option value="utility">Utility</option>
                    </select>
                </div>
                <div class="col-md-2">
                    <div class="d-flex gap-2">
                        <button class="btn btn-outline-secondary btn-sm"
                            onclick="safeCall('plugins', 'clearPluginFilters')">
                            <i class="fas fa-times me-1"></i>Clear
                        </button>
                    </div>
                </div>
            </div>

            <!-- Plugins Grid -->
            <div class="row" id="pluginsGrid">
                <div class="col-12">
                    <div class="text-center py-5">
                        <i class="fas fa-plug fa-3x text-muted mb-3"></i>
                        <p class="text-muted mb-3">No plugins loaded yet</p>
                        <button class="btn btn-primary" onclick="safeCall('plugins', 'refreshPlugins')">
                            <i class="fas fa-sync-alt me-2"></i>Load Plugins
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Load plugins data from the same source as the public plugins page
        await this.refreshPlugins();
    }

    /**
     * Refresh plugins data
     */
    async refreshPlugins() {
        try {
            console.log('🔄 Refreshing plugins data...');

            const response = await fetch('/api/plugins');
            if (!response.ok) {
                throw new Error(`Failed to load plugins: ${response.status}`);
            }

            const pluginsData = await response.json();
            if (!Array.isArray(pluginsData)) {
                throw new Error('Invalid plugins data format');
            }

            this.pluginsData = pluginsData.map((plugin, index) => this.normalizePlugin(plugin, index));

            this.updatePluginStats();
            this.displayPlugins(this.pluginsData);

        } catch (error) {
            console.error('Error refreshing plugins:', error);
            this.showError('Failed to load plugins data');
        }
    }

    normalizePlugin(plugin, index) {
        const safeName = plugin?.name || `Plugin ${index + 1}`;
        const enabled = plugin?.enabled ?? true;

        return {
            id: plugin?.id ?? index + 1,
            name: safeName,
            description: plugin?.description || 'Deskripsi tidak tersedia',
            version: plugin?.version || 'N/A',
            author: plugin?.author || 'External',
            category: plugin?.category || 'bim',
            status: enabled ? 'enabled' : 'disabled',
            enabled,
            updateAvailable: plugin?.updateAvailable ?? false,
            latestVersion: plugin?.latestVersion,
            size: plugin?.size || '-',
            lastUpdated: plugin?.lastUpdated || null,
            dependencies: plugin?.dependencies || [],
            icon: plugin?.icon || 'fas fa-plug',
            download: plugin?.download,
            logo: plugin?.logo
        };
    }

    /**
     * Update plugin statistics
     */
    updatePluginStats() {
        const total = this.pluginsData.length;
        const enabled = this.pluginsData.filter(p => p.enabled).length;
        const disabled = this.pluginsData.filter(p => !p.enabled).length;
        const updates = this.pluginsData.filter(p => p.updateAvailable).length;

        document.getElementById('totalPlugins').textContent = total;
        document.getElementById('enabledPlugins').textContent = enabled;
        document.getElementById('disabledPlugins').textContent = disabled;
        document.getElementById('updateAvailable').textContent = updates;

        const activeBadge = document.getElementById('activePluginsCount');
        const inactiveBadge = document.getElementById('inactivePluginsCount');

        if (activeBadge) {
            activeBadge.innerHTML = `<i class="fas fa-plug me-1"></i>Active: ${enabled} plugins`;
        }
        if (inactiveBadge) {
            inactiveBadge.innerHTML = `<i class="fas fa-ban me-1"></i>Inactive: ${disabled} plugins`;
        }
    }

    /**
     * Display plugins in grid
     */
    displayPlugins(pluginsList) {
        const grid = document.getElementById('pluginsGrid');
        if (!grid) return;

        if (pluginsList.length === 0) {
            grid.innerHTML = `
                <div class="col-12">
                    <div class="text-center py-5">
                        <i class="fas fa-plug fa-3x text-muted mb-3"></i>
                        <p class="text-muted mb-2">No plugins found</p>
                    </div>
                </div>
            `;
            return;
        }

        let html = '';
        pluginsList.forEach((plugin, index) => {
            const statusBadge = this.getPluginStatusBadge(plugin);
            const categoryBadge = this.getPluginCategoryBadge(plugin.category);
            const updateIndicator = plugin.updateAvailable ?
                '<span class="badge bg-warning ms-2"><i class="fas fa-arrow-up me-1"></i>Update</span>' : '';
            const updatedLabel = plugin.lastUpdated
                ? new Date(plugin.lastUpdated).toLocaleDateString('id-ID')
                : 'N/A';

            html += `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="card plugin-card h-100 ${plugin.enabled ? 'border-success' : 'border-secondary'}">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <div class="d-flex align-items-center">
                                <i class="${plugin.icon} fa-lg me-2 text-primary"></i>
                                <h6 class="mb-0 fw-bold">${plugin.name}</h6>
                            </div>
                            ${statusBadge}
                        </div>
                        <div class="card-body">
                            <p class="card-text text-muted small mb-3">${plugin.description}</p>

                            <div class="mb-2">
                                <small class="text-muted">Version:</small>
                                <span class="badge bg-light text-dark">${plugin.version}</span>
                                ${plugin.updateAvailable ? `<span class="badge bg-info">${plugin.latestVersion}</span>` : ''}
                            </div>

                            <div class="mb-2">
                                <small class="text-muted">Category:</small>
                                ${categoryBadge}
                            </div>

                            <div class="mb-2">
                                <small class="text-muted">Author:</small>
                                <span class="fw-bold">${plugin.author}</span>
                            </div>

                            <div class="mb-3">
                                <small class="text-muted">Size:</small>
                                <span class="badge bg-secondary">${plugin.size}</span>
                            </div>

                            ${plugin.error ? `
                            <div class="alert alert-danger py-2 mb-3">
                                <small><i class="fas fa-exclamation-triangle me-1"></i>${plugin.error}</small>
                            </div>
                            ` : ''}

                            <div class="d-flex gap-1 flex-wrap">
                                <button class="btn btn-sm btn-outline-info" onclick="safeCall('plugins', 'viewPluginDetails', ${plugin.id})">
                                    <i class="fas fa-info-circle me-1"></i>Details
                                </button>
                                <button class="btn btn-sm ${plugin.enabled ? 'btn-outline-warning' : 'btn-outline-success'}"
                                        onclick="safeCall('plugins', '${plugin.enabled ? 'disablePlugin' : 'enablePlugin'}', ${plugin.id}, '${plugin.name.replace(/'/g, "\\'")}')">
                                    <i class="fas ${plugin.enabled ? 'fa-ban' : 'fa-play'} me-1"></i>
                                    ${plugin.enabled ? 'Disable' : 'Enable'}
                                </button>
                                ${plugin.updateAvailable ? `
                                <button class="btn btn-sm btn-outline-primary" onclick="safeCall('plugins', 'updatePlugin', ${plugin.id}, '${plugin.name.replace(/'/g, "\\'")}')">
                                    <i class="fas fa-arrow-up me-1"></i>Update
                                </button>
                                ` : ''}
                                <button class="btn btn-sm btn-outline-danger" onclick="safeCall('plugins', 'uninstallPlugin', ${plugin.id}, '${plugin.name.replace(/'/g, "\\'")}')">
                                    <i class="fas fa-trash me-1"></i>Uninstall
                                </button>
                            </div>
                        </div>
                        <div class="card-footer text-muted small">
                            <i class="fas fa-clock me-1"></i>
                            Updated ${updatedLabel}
                        </div>
                    </div>
                </div>
            `;
        });

        grid.innerHTML = html;
    }

    /**
     * Get plugin status badge
     */
    getPluginStatusBadge(plugin) {
        if (plugin.error) {
            return '<span class="badge bg-danger"><i class="fas fa-exclamation-triangle me-1"></i>Error</span>';
        }
        return plugin.enabled ?
            '<span class="badge bg-success"><i class="fas fa-check me-1"></i>Enabled</span>' :
            '<span class="badge bg-secondary"><i class="fas fa-ban me-1"></i>Disabled</span>';
    }

    /**
     * Get plugin category badge
     */
    getPluginCategoryBadge(category) {
        const badges = {
            'authentication': '<span class="badge bg-primary">Authentication</span>',
            'content': '<span class="badge bg-success">Content</span>',
            'analytics': '<span class="badge bg-info">Analytics</span>',
            'security': '<span class="badge bg-warning">Security</span>',
            'integration': '<span class="badge bg-dark">Integration</span>',
            'utility': '<span class="badge bg-secondary">Utility</span>'
        };
        return badges[category] || `<span class="badge bg-light">${category}</span>`;
    }

    /**
     * Filter plugins
     */
    filterPlugins() {
        const searchTerm = document.getElementById('pluginsSearchInput')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('pluginsStatusFilter')?.value || '';
        const categoryFilter = document.getElementById('pluginsCategoryFilter')?.value || '';

        const filtered = this.pluginsData.filter(plugin => {
            const matchesSearch = !searchTerm ||
                plugin.name.toLowerCase().includes(searchTerm) ||
                plugin.description.toLowerCase().includes(searchTerm) ||
                plugin.author.toLowerCase().includes(searchTerm);
            const matchesStatus = !statusFilter ||
                (statusFilter === 'enabled' && plugin.enabled) ||
                (statusFilter === 'disabled' && !plugin.enabled) ||
                (statusFilter === 'error' && plugin.error);
            const matchesCategory = !categoryFilter || plugin.category === categoryFilter;

            return matchesSearch && matchesStatus && matchesCategory;
        });

        this.displayPlugins(filtered);
    }

    /**
     * Clear plugin filters
     */
    clearPluginFilters() {
        const searchInput = document.getElementById('pluginsSearchInput');
        const statusFilter = document.getElementById('pluginsStatusFilter');
        const categoryFilter = document.getElementById('pluginsCategoryFilter');

        if (searchInput) searchInput.value = '';
        if (statusFilter) statusFilter.value = '';
        if (categoryFilter) categoryFilter.value = '';

        this.displayPlugins(this.pluginsData);
    }

    /**
     * View plugin details
     */
    viewPluginDetails(pluginId) {
        const plugin = this.pluginsData.find(p => p.id === pluginId);
        if (!plugin) {
            alert('Plugin not found');
            return;
        }

        const modalHtml = `
            <div class="modal fade" id="pluginDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="${plugin.icon} me-2"></i>${plugin.name}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row g-3">
                                <div class="col-md-8">
                                    <h6>Description</h6>
                                    <p>${plugin.description}</p>

                                    <h6>Details</h6>
                                    <table class="table table-sm">
                                        <tr>
                                            <td><strong>Version:</strong></td>
                                            <td>${plugin.version} ${plugin.updateAvailable ? `(Latest: ${plugin.latestVersion})` : ''}</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Author:</strong></td>
                                            <td>${plugin.author}</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Size:</strong></td>
                                            <td>${plugin.size}</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Last Updated:</strong></td>
                                            <td>${plugin.lastUpdated ? new Date(plugin.lastUpdated).toLocaleString('id-ID') : 'N/A'}</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Dependencies:</strong></td>
                                            <td>${plugin.dependencies.length > 0 ? plugin.dependencies.join(', ') : 'None'}</td>
                                        </tr>
                                    </table>

                                    ${plugin.error ? `
                                    <h6 class="text-danger">Error Information</h6>
                                    <div class="alert alert-danger">
                                        <i class="fas fa-exclamation-triangle me-2"></i>
                                        ${plugin.error}
                                    </div>
                                    ` : ''}
                                </div>
                                <div class="col-md-4">
                                    <h6>Status</h6>
                                    <div class="mb-3">
                                        ${this.getPluginStatusBadge(plugin)}
                                        ${plugin.updateAvailable ? '<br><span class="badge bg-warning mt-2"><i class="fas fa-arrow-up me-1"></i>Update Available</span>' : ''}
                                    </div>

                                    <h6>Category</h6>
                                    <div class="mb-3">
                                        ${this.getPluginCategoryBadge(plugin.category)}
                                    </div>

                                    <h6>Quick Actions</h6>
                                    <div class="d-grid gap-2">
                                        <button class="btn ${plugin.enabled ? 'btn-warning' : 'btn-success'}"
                                                onclick="safeCall('plugins', '${plugin.enabled ? 'disablePlugin' : 'enablePlugin'}', ${plugin.id}, '${plugin.name.replace(/'/g, "\\'")}')">
                                            <i class="fas ${plugin.enabled ? 'fa-ban' : 'fa-play'} me-2"></i>
                                            ${plugin.enabled ? 'Disable Plugin' : 'Enable Plugin'}
                                        </button>
                                        ${plugin.updateAvailable ? `
                                        <button class="btn btn-primary" onclick="safeCall('plugins', 'updatePlugin', ${plugin.id}, '${plugin.name.replace(/'/g, "\\'")}')">
                                            <i class="fas fa-arrow-up me-2"></i>Update Plugin
                                        </button>
                                        ` : ''}
                                        <button class="btn btn-danger" onclick="safeCall('plugins', 'uninstallPlugin', ${plugin.id}, '${plugin.name.replace(/'/g, "\\'")}')">
                                            <i class="fas fa-trash me-2"></i>Uninstall Plugin
                                        </button>
                                    </div>
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
        const existingModal = document.getElementById('pluginDetailsModal');
        if (existingModal) existingModal.remove();

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('pluginDetailsModal'));
        modal.show();
    }

    /**
     * Enable/disable plugin
     */
    enablePlugin(pluginId, pluginName) {
        const plugin = this.pluginsData.find(p => p.id === pluginId);
        if (!plugin) {
            alert('Plugin not found');
            return;
        }

        if (plugin.error) {
            alert(`Cannot enable plugin "${pluginName}" due to error: ${plugin.error}`);
            return;
        }

        plugin.enabled = true;
        plugin.status = 'enabled';
        this.updatePluginStats();
        this.displayPlugins(this.pluginsData);
        alert(`✅ Plugin "${pluginName}" enabled successfully!`);
    }

    disablePlugin(pluginId, pluginName) {
        const plugin = this.pluginsData.find(p => p.id === pluginId);
        if (!plugin) {
            alert('Plugin not found');
            return;
        }

        plugin.enabled = false;
        plugin.status = 'disabled';
        this.updatePluginStats();
        this.displayPlugins(this.pluginsData);
        alert(`✅ Plugin "${pluginName}" disabled successfully!`);
    }

    /**
     * Update plugin
     */
    updatePlugin(pluginId, pluginName) {
        alert(`🔄 Updating plugin "${pluginName}" to latest version...`);
        // Simulate update
        setTimeout(() => {
            const plugin = this.pluginsData.find(p => p.id === pluginId);
            if (plugin) {
                plugin.version = plugin.latestVersion;
                plugin.updateAvailable = false;
                plugin.lastUpdated = new Date().toISOString();
                this.updatePluginStats();
                this.displayPlugins(this.pluginsData);
                alert(`✅ Plugin "${pluginName}" updated successfully!`);
            }
        }, 2000);
    }

    /**
     * Uninstall plugin
     */
    uninstallPlugin(pluginId, pluginName) {
        if (!confirm(`Are you sure you want to uninstall "${pluginName}"?\n\nThis will permanently remove the plugin and all its data.`)) {
            return;
        }

        const pluginIndex = this.pluginsData.findIndex(p => p.id === pluginId);
        if (pluginIndex !== -1) {
            this.pluginsData.splice(pluginIndex, 1);
            this.updatePluginStats();
            this.displayPlugins(this.pluginsData);
            alert(`✅ Plugin "${pluginName}" uninstalled successfully!`);
        }
    }

    /**
     * Show install plugin modal
     */
    showInstallPluginModal() {
        const modalHtml = `
            <div class="modal fade" id="installPluginModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-plus me-2"></i>Install New Plugin
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>
                                <strong>Plugin Installation</strong><br>
                                Upload a plugin package (.zip) or install from repository.
                            </div>

                            <form id="installPluginForm">
                                <div class="mb-3">
                                    <label for="pluginName" class="form-label">Plugin Name</label>
                                    <input type="text" class="form-control" id="pluginName" placeholder="Plugin name" required>
                                </div>

                                <div class="mb-3">
                                    <label for="pluginDescription" class="form-label">Description</label>
                                    <textarea class="form-control" id="pluginDescription" rows="3" placeholder="Describe the plugin"></textarea>
                                </div>

                                <div class="mb-3">
                                    <label for="pluginDownload" class="form-label">Download URL (optional)</label>
                                    <input type="url" class="form-control" id="pluginDownload" placeholder="https://example.com/plugin.zip">
                                </div>

                                <div class="mb-3">
                                    <label for="pluginLogo" class="form-label">Logo URL (optional)</label>
                                    <input type="url" class="form-control" id="pluginLogo" placeholder="https://example.com/logo.png">
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Installation Method</label>
                                    <div class="form-check">
                                        <input class="form-check-input" type="radio" name="installMethod" id="uploadMethod" checked>
                                        <label class="form-check-label" for="uploadMethod">
                                            Upload Plugin Package (.zip)
                                        </label>
                                    </div>
                                    <div class="form-check">
                                        <input class="form-check-input" type="radio" name="installMethod" id="repoMethod">
                                        <label class="form-check-label" for="repoMethod">
                                            Install from Repository
                                        </label>
                                    </div>
                                </div>

                                <div id="uploadSection">
                                    <div class="mb-3">
                                        <label for="pluginFile" class="form-label">Plugin Package</label>
                                        <input class="form-control" type="file" id="pluginFile" accept=".zip">
                                        <div class="form-text">Select a valid plugin package file (.zip)</div>
                                    </div>
                                </div>

                                <div id="repoSection" style="display: none;">
                                    <div class="mb-3">
                                        <label for="repoUrl" class="form-label">Repository URL</label>
                                        <input type="url" class="form-control" id="repoUrl" placeholder="https://plugins.example.com/plugin-name">
                                        <div class="form-text">Enter the plugin repository URL</div>
                                    </div>
                                </div>

                                <div class="mb-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="enableAfterInstall" checked>
                                        <label class="form-check-label" for="enableAfterInstall">
                                            Enable plugin after installation
                                        </label>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" onclick="safeCall('plugins', 'installPlugin')">
                                <i class="fas fa-download me-2"></i>Install Plugin
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('installPluginModal');
        if (existingModal) existingModal.remove();

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Setup radio button handlers
        document.getElementById('uploadMethod').addEventListener('change', () => {
            document.getElementById('uploadSection').style.display = 'block';
            document.getElementById('repoSection').style.display = 'none';
        });

        document.getElementById('repoMethod').addEventListener('change', () => {
            document.getElementById('uploadSection').style.display = 'none';
            document.getElementById('repoSection').style.display = 'block';
        });

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('installPluginModal'));
        modal.show();
    }

    /**
     * Install plugin
     */
    installPlugin() {
        const name = document.getElementById('pluginName')?.value.trim();
        const description = document.getElementById('pluginDescription')?.value.trim();
        const download = document.getElementById('pluginDownload')?.value.trim();
        const logo = document.getElementById('pluginLogo')?.value.trim();
        const useUpload = document.getElementById('uploadMethod')?.checked;
        const repoUrl = document.getElementById('repoUrl')?.value.trim();
        const fileInput = document.getElementById('pluginFile');
        const file = fileInput?.files?.[0];

        if (!name) {
            alert('❌ Plugin name is required.');
            return;
        }

        if (useUpload && !file) {
            alert('❌ Please select a .zip plugin package to upload.');
            return;
        }

        const formData = new FormData();
        formData.append('name', name);
        if (description) formData.append('description', description);
        if (logo) formData.append('logo', logo);
        if (download) formData.append('download', download);
        if (repoUrl) formData.append('repoUrl', repoUrl);
        if (useUpload && file) {
            formData.append('file', file);
        }

        const modalElement = document.getElementById('installPluginModal');
        const installButton = modalElement?.querySelector('button.btn-primary');
        if (installButton) {
            installButton.disabled = true;
            installButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Installing...';
        }

        fetch('/api/plugins', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        })
            .then(async (response) => {
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to install plugin');
                }
                return data;
            })
            .then(() => {
                alert('✅ Plugin installed successfully!');
                bootstrap.Modal.getInstance(modalElement)?.hide();
                this.refreshPlugins();
            })
            .catch((error) => {
                console.error('Plugin install error:', error);
                alert(`❌ ${error.message}`);
            })
            .finally(() => {
                if (installButton) {
                    installButton.disabled = false;
                    installButton.innerHTML = '<i class="fas fa-download me-2"></i>Install Plugin';
                }
            });
    }

    /**
     * Show error message
     */
    showError(message) {
        const content = document.getElementById('plugins-content');
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

// Initialize and register the plugins module immediately when script loads
(function() {
    console.log('🔌 Initializing Plugins Module...');

    // Ensure adminPanel exists
    if (!window.adminPanel) {
        console.error('❌ window.adminPanel not found - plugins module cannot initialize');
        return;
    }

    // Ensure modules Map exists
    if (!window.adminPanel.modules) {
        console.error('❌ window.adminPanel.modules not found - plugins module cannot initialize');
        return;
    }

    try {
        // Create plugins module instance
        const pluginsModule = new PluginsModule(window.adminPanel);

        // Set up the module entry
        window.adminPanel.modules.set('plugins', {
            loaded: true,
            path: 'modules/plugins.js',
            instance: pluginsModule
        });

        // Initialize the module
        pluginsModule.initialize();

        console.log('✅ Plugins module initialized and registered successfully');
    } catch (error) {
        console.error('❌ Failed to initialize plugins module:', error);
    }
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PluginsModule;
}
