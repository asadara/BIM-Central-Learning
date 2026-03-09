/**
 * System Module - System monitoring and configuration
 */
class SystemModule {
    constructor(adminPanel) {
        this.adminPanel = adminPanel;
        this.systemInfo = {};
        this.monitoringData = [];
        this.refreshInterval = null;
        this.isMonitoring = false;
    }

    /**
     * Initialize the system module
     */
    initialize() {
        console.log('⚙️ Initializing System Module');
        this.setupEventListeners();
    }

    /**
     * Setup event listeners for system elements
     */
    setupEventListeners() {
        // Will be set up when system section is loaded
    }

    /**
     * Load system management
     */
    async loadSystem() {
        console.log('⚙️ Loading system management...');

        const content = document.getElementById('system-content');
        if (!content) return;

        content.innerHTML = `
            <div class="row g-4">
                <!-- System Overview -->
                <div class="col-md-8">
                    <div class="card">
                        <div class="card-header-modern">
                            <div class="card-title-modern">
                                <i class="fas fa-server"></i>
                                System Information
                            </div>
                            <button class="btn btn-outline-primary btn-sm" onclick="safeCall('system', 'refreshSystemInfo')">
                                <i class="fas fa-sync-alt me-2"></i>Refresh
                            </button>
                        </div>
                        <div class="card-body-modern">
                            <div id="systemInfoContent">
                                <div class="text-center py-4">
                                    <div class="spinner-border text-primary mb-3" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                    <p class="text-muted">Loading system information...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- System Actions -->
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header-modern">
                            <div class="card-title-modern">
                                <i class="fas fa-tools"></i>
                                System Actions
                            </div>
                        </div>
                        <div class="card-body-modern">
                            <div class="d-grid gap-3">
                                <button class="btn btn-warning" onclick="safeCall('system', 'clearCache')">
                                    <i class="fas fa-broom me-2"></i>Clear System Cache
                                </button>
                                <button class="btn btn-info" onclick="safeCall('system', 'generateSystemReport')">
                                    <i class="fas fa-file-alt me-2"></i>Generate Report
                                </button>
                                <button class="btn btn-secondary" onclick="safeCall('system', 'restartServices')">
                                    <i class="fas fa-redo me-2"></i>Restart Services
                                </button>
                                <button class="btn btn-danger" onclick="safeCall('system', 'shutdownSystem')">
                                    <i class="fas fa-power-off me-2"></i>Shutdown System
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- System Status -->
                    <div class="card mt-4">
                        <div class="card-header-modern">
                            <div class="card-title-modern">
                                <i class="fas fa-heartbeat"></i>
                                System Status
                            </div>
                        </div>
                        <div class="card-body-modern">
                            <div class="d-grid gap-2">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span><i class="fas fa-database text-success me-2"></i>Database</span>
                                    <span class="badge bg-success">Online</span>
                                </div>
                                <div class="d-flex justify-content-between align-items-center">
                                    <span><i class="fas fa-server text-success me-2"></i>Web Server</span>
                                    <span class="badge bg-success">Running</span>
                                </div>
                                <div class="d-flex justify-content-between align-items-center">
                                    <span><i class="fas fa-hdd text-warning me-2"></i>Disk Space</span>
                                    <span class="badge bg-warning">85%</span>
                                </div>
                                <div class="d-flex justify-content-between align-items-center">
                                    <span><i class="fas fa-memory text-info me-2"></i>Memory</span>
                                    <span class="badge bg-info">67%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Performance Monitoring -->
            <div class="row mt-4">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header-modern d-flex justify-content-between align-items-center">
                            <div class="card-title-modern">
                                <i class="fas fa-chart-line"></i>
                                Performance Monitoring
                            </div>
                            <div class="d-flex gap-2">
                                <button class="btn btn-outline-success btn-sm" onclick="safeCall('system', 'startMonitoring')">
                                    <i class="fas fa-play me-1"></i>Start
                                </button>
                                <button class="btn btn-outline-danger btn-sm" onclick="safeCall('system', 'stopMonitoring')">
                                    <i class="fas fa-stop me-1"></i>Stop
                                </button>
                                <button class="btn btn-outline-info btn-sm" onclick="safeCall('system', 'exportMonitoringData')">
                                    <i class="fas fa-download me-1"></i>Export
                                </button>
                            </div>
                        </div>
                        <div class="card-body-modern">
                            <div id="monitoringContent">
                                <div class="alert alert-info">
                                    <i class="fas fa-info-circle me-2"></i>
                                    Click "Start" to begin real-time performance monitoring.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- System Logs -->
            <div class="row mt-4">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header-modern">
                            <div class="card-title-modern">
                                <i class="fas fa-file-alt"></i>
                                System Logs
                            </div>
                            <div class="d-flex gap-2">
                                <select class="form-select form-select-sm" id="logLevelFilter" onchange="safeCall('system', 'filterLogs')">
                                    <option value="">All Levels</option>
                                    <option value="ERROR">Errors Only</option>
                                    <option value="WARN">Warnings</option>
                                    <option value="INFO">Info</option>
                                    <option value="DEBUG">Debug</option>
                                </select>
                                <button class="btn btn-outline-primary btn-sm" onclick="safeCall('system', 'refreshLogs')">
                                    <i class="fas fa-sync-alt me-1"></i>Refresh
                                </button>
                                <button class="btn btn-outline-info btn-sm" onclick="safeCall('system', 'exportLogs')">
                                    <i class="fas fa-download me-1"></i>Export
                                </button>
                            </div>
                        </div>
                        <div class="card-body-modern">
                            <div id="logsContent" style="max-height: 400px; overflow-y: auto;">
                                <div class="text-center py-4">
                                    <div class="spinner-border spinner-border-sm text-primary mb-2" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                    <p class="text-muted small">Loading system logs...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Configuration Settings -->
            <div class="row mt-4">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header-modern">
                            <div class="card-title-modern">
                                <i class="fas fa-cogs"></i>
                                System Configuration
                            </div>
                            <button class="btn btn-outline-success btn-sm" onclick="safeCall('system', 'saveConfiguration')">
                                <i class="fas fa-save me-1"></i>Save Changes
                            </button>
                        </div>
                        <div class="card-body-modern">
                            <form id="systemConfigForm">
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <h6>General Settings</h6>
                                        <div class="mb-3">
                                            <label class="form-label">System Name</label>
                                            <input type="text" class="form-control" id="systemName" value="BCL Learning Platform">
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label">Timezone</label>
                                            <select class="form-select" id="systemTimezone">
                                                <option value="Asia/Jakarta" selected>Asia/Jakarta (WIB)</option>
                                                <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                                                <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
                                                <option value="UTC">UTC</option>
                                            </select>
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label">Language</label>
                                            <select class="form-select" id="systemLanguage">
                                                <option value="id" selected>Indonesian</option>
                                                <option value="en">English</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <h6>Performance Settings</h6>
                                        <div class="mb-3">
                                            <label class="form-label">Cache Expiration (hours)</label>
                                            <input type="number" class="form-control" id="cacheExpiration" value="24" min="1" max="168">
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label">Max File Upload Size (MB)</label>
                                            <input type="number" class="form-control" id="maxUploadSize" value="100" min="1" max="1000">
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label">Session Timeout (minutes)</label>
                                            <input type="number" class="form-control" id="sessionTimeout" value="60" min="5" max="480">
                                        </div>
                                        <div class="form-check mb-3">
                                            <input class="form-check-input" type="checkbox" id="enableDebugMode" checked>
                                            <label class="form-check-label">
                                                Enable Debug Mode
                                            </label>
                                        </div>
                                        <div class="form-check mb-3">
                                            <input class="form-check-input" type="checkbox" id="enableMaintenanceMode">
                                            <label class="form-check-label">
                                                Enable Maintenance Mode
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Load system information
        await this.refreshSystemInfo();
        await this.refreshLogs();
    }

    /**
     * Refresh system information
     */
    async refreshSystemInfo() {
        try {
            console.log('🔄 Refreshing system information...');

            // Mock system information
            this.systemInfo = {
                server: {
                    platform: 'Linux',
                    arch: 'x64',
                    hostname: 'bcl-server-01',
                    uptime: '15 days, 8 hours, 32 minutes',
                    nodeVersion: 'v18.17.0',
                    npmVersion: '9.6.7'
                },
                database: {
                    type: 'PostgreSQL',
                    version: '15.3',
                    status: 'Connected',
                    connections: 8,
                    size: '2.4 GB'
                },
                memory: {
                    total: '16 GB',
                    used: '10.8 GB',
                    free: '5.2 GB',
                    usagePercent: 67
                },
                disk: {
                    total: '500 GB',
                    used: '425 GB',
                    free: '75 GB',
                    usagePercent: 85
                },
                network: {
                    ip: '192.168.1.100',
                    hostname: 'bcl.local',
                    ports: ['80 (HTTP)', '443 (HTTPS)', '5432 (PostgreSQL)']
                },
                services: [
                    { name: 'Web Server', status: 'Running', port: 80 },
                    { name: 'Database', status: 'Running', port: 5432 },
                    { name: 'File Server', status: 'Running', port: 8080 },
                    { name: 'Cache Service', status: 'Running', port: 6379 }
                ]
            };

            this.displaySystemInfo();

        } catch (error) {
            console.error('Error refreshing system info:', error);
            this.showError('Failed to load system information');
        }
    }

    /**
     * Display system information
     */
    displaySystemInfo() {
        const content = document.getElementById('systemInfoContent');
        if (!content) return;

        const info = this.systemInfo;
        let html = '';

        // Server Information
        html += `
            <div class="row g-3 mb-4">
                <div class="col-md-6">
                    <h6 class="text-primary mb-3">
                        <i class="fas fa-server me-2"></i>Server Information
                    </h6>
                    <table class="table table-sm table-borderless">
                        <tr><td class="text-muted">Platform:</td><td>${info.server.platform} ${info.server.arch}</td></tr>
                        <tr><td class="text-muted">Hostname:</td><td>${info.server.hostname}</td></tr>
                        <tr><td class="text-muted">Uptime:</td><td>${info.server.uptime}</td></tr>
                        <tr><td class="text-muted">Node.js:</td><td>${info.server.nodeVersion}</td></tr>
                        <tr><td class="text-muted">NPM:</td><td>${info.server.npmVersion}</td></tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <h6 class="text-success mb-3">
                        <i class="fas fa-database me-2"></i>Database Information
                    </h6>
                    <table class="table table-sm table-borderless">
                        <tr><td class="text-muted">Type:</td><td>${info.database.type}</td></tr>
                        <tr><td class="text-muted">Version:</td><td>${info.database.version}</td></tr>
                        <tr><td class="text-muted">Status:</td><td><span class="badge bg-success">${info.database.status}</span></td></tr>
                        <tr><td class="text-muted">Connections:</td><td>${info.database.connections}</td></tr>
                        <tr><td class="text-muted">Size:</td><td>${info.database.size}</td></tr>
                    </table>
                </div>
            </div>
        `;

        // System Resources
        html += `
            <div class="row g-3 mb-4">
                <div class="col-md-6">
                    <h6 class="text-info mb-3">
                        <i class="fas fa-memory me-2"></i>Memory Usage
                    </h6>
                    <div class="progress mb-2" style="height: 20px;">
                        <div class="progress-bar bg-info" role="progressbar" style="width: ${info.memory.usagePercent}%"
                             aria-valuenow="${info.memory.usagePercent}" aria-valuemin="0" aria-valuemax="100">
                            ${info.memory.usagePercent}%
                        </div>
                    </div>
                    <small class="text-muted">
                        ${info.memory.used} / ${info.memory.total} (${info.memory.free} free)
                    </small>
                </div>
                <div class="col-md-6">
                    <h6 class="text-warning mb-3">
                        <i class="fas fa-hdd me-2"></i>Disk Usage
                    </h6>
                    <div class="progress mb-2" style="height: 20px;">
                        <div class="progress-bar bg-warning" role="progressbar" style="width: ${info.disk.usagePercent}%"
                             aria-valuenow="${info.disk.usagePercent}" aria-valuemin="0" aria-valuemax="100">
                            ${info.disk.usagePercent}%
                        </div>
                    </div>
                    <small class="text-muted">
                        ${info.disk.used} / ${info.disk.total} (${info.disk.free} free)
                    </small>
                </div>
            </div>
        `;

        // Network Information
        html += `
            <div class="row g-3 mb-4">
                <div class="col-md-6">
                    <h6 class="text-secondary mb-3">
                        <i class="fas fa-network-wired me-2"></i>Network Information
                    </h6>
                    <table class="table table-sm table-borderless">
                        <tr><td class="text-muted">IP Address:</td><td><code>${info.network.ip}</code></td></tr>
                        <tr><td class="text-muted">Hostname:</td><td>${info.network.hostname}</td></tr>
                        <tr><td class="text-muted">Active Ports:</td><td>${info.network.ports.join(', ')}</td></tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <h6 class="text-primary mb-3">
                        <i class="fas fa-cogs me-2"></i>Services Status
                    </h6>
                    <div class="d-grid gap-1">
        `;

        info.services.forEach(service => {
            const statusClass = service.status === 'Running' ? 'success' : 'danger';
            html += `
                <div class="d-flex justify-content-between align-items-center p-2 border rounded">
                    <div>
                        <strong>${service.name}</strong>
                        <small class="text-muted ms-2">Port ${service.port}</small>
                    </div>
                    <span class="badge bg-${statusClass}">${service.status}</span>
                </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
        `;

        content.innerHTML = html;
    }

    /**
     * Start performance monitoring
     */
    startMonitoring() {
        if (this.isMonitoring) {
            alert('Monitoring is already running');
            return;
        }

        this.isMonitoring = true;
        console.log('📊 Starting performance monitoring...');

        const content = document.getElementById('monitoringContent');
        content.innerHTML = `
            <div class="alert alert-success">
                <i class="fas fa-play me-2"></i>
                Performance monitoring started. Data will refresh every 5 seconds.
            </div>
            <div class="row g-3" id="monitoringCharts">
                <div class="col-md-6">
                    <canvas id="cpuChart" width="400" height="200"></canvas>
                </div>
                <div class="col-md-6">
                    <canvas id="memoryChart" width="400" height="200"></canvas>
                </div>
            </div>
            <div class="mt-3" id="monitoringStats">
                <div class="row text-center">
                    <div class="col-md-3">
                        <div class="p-3 bg-primary text-white rounded">
                            <h4 id="cpuUsage">0%</h4>
                            <small>CPU Usage</small>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="p-3 bg-success text-white rounded">
                            <h4 id="memoryUsage">0%</h4>
                            <small>Memory</small>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="p-3 bg-warning text-white rounded">
                            <h4 id="diskUsage">0%</h4>
                            <small>Disk</small>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="p-3 bg-info text-white rounded">
                            <h4 id="networkUsage">0%</h4>
                            <small>Network</small>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Start monitoring interval
        this.refreshInterval = setInterval(() => {
            this.updateMonitoringData();
        }, 5000);

        // Initial data update
        this.updateMonitoringData();
    }

    /**
     * Stop performance monitoring
     */
    stopMonitoring() {
        if (!this.isMonitoring) return;

        this.isMonitoring = false;
        console.log('⏹️ Stopping performance monitoring...');

        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }

        const content = document.getElementById('monitoringContent');
        content.innerHTML = `
            <div class="alert alert-warning">
                <i class="fas fa-stop me-2"></i>
                Performance monitoring stopped.
            </div>
        `;
    }

    /**
     * Update monitoring data
     */
    updateMonitoringData() {
        // Simulate monitoring data
        const cpuUsage = Math.floor(Math.random() * 30) + 20; // 20-50%
        const memoryUsage = Math.floor(Math.random() * 20) + 60; // 60-80%
        const diskUsage = Math.floor(Math.random() * 10) + 80; // 80-90%
        const networkUsage = Math.floor(Math.random() * 50) + 10; // 10-60%

        document.getElementById('cpuUsage').textContent = cpuUsage + '%';
        document.getElementById('memoryUsage').textContent = memoryUsage + '%';
        document.getElementById('diskUsage').textContent = diskUsage + '%';
        document.getElementById('networkUsage').textContent = networkUsage + '%';

        // Store data for charts (in real implementation)
        this.monitoringData.push({
            timestamp: new Date(),
            cpu: cpuUsage,
            memory: memoryUsage,
            disk: diskUsage,
            network: networkUsage
        });

        // Keep only last 20 data points
        if (this.monitoringData.length > 20) {
            this.monitoringData.shift();
        }
    }

    /**
     * Export monitoring data
     */
    exportMonitoringData() {
        if (this.monitoringData.length === 0) {
            alert('No monitoring data available');
            return;
        }

        const csvContent = [
            ['Timestamp', 'CPU (%)', 'Memory (%)', 'Disk (%)', 'Network (%)'],
            ...this.monitoringData.map(data => [
                data.timestamp.toISOString(),
                data.cpu,
                data.memory,
                data.disk,
                data.network
            ])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `system-monitoring-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        alert('✅ Monitoring data exported successfully!');
    }

    /**
     * Refresh system logs
     */
    async refreshLogs() {
        try {
            const logsContent = document.getElementById('logsContent');
            if (!logsContent) return;

            // Mock log entries
            const logs = [
                { level: 'INFO', timestamp: '2025-01-19 12:30:15', message: 'System startup completed successfully' },
                { level: 'INFO', timestamp: '2025-01-19 12:30:10', message: 'Database connection established' },
                { level: 'WARN', timestamp: '2025-01-19 12:29:45', message: 'High memory usage detected (78%)' },
                { level: 'INFO', timestamp: '2025-01-19 12:29:30', message: 'User authentication successful: admin' },
                { level: 'INFO', timestamp: '2025-01-19 12:29:15', message: 'File upload completed: presentation.pdf' },
                { level: 'ERROR', timestamp: '2025-01-19 12:28:50', message: 'Failed to connect to external API (timeout)' },
                { level: 'INFO', timestamp: '2025-01-19 12:28:30', message: 'Backup completed successfully' },
                { level: 'DEBUG', timestamp: '2025-01-19 12:28:15', message: 'Cache cleared: 1.2GB freed' },
                { level: 'INFO', timestamp: '2025-01-19 12:28:00', message: 'Plugin loaded: Analytics Pro v2.1.0' },
                { level: 'WARN', timestamp: '2025-01-19 12:27:45', message: 'Disk space running low (85% used)' }
            ];

            let html = '<div class="font-monospace small">';
            logs.forEach(log => {
                const levelClass = {
                    'ERROR': 'text-danger',
                    'WARN': 'text-warning',
                    'INFO': 'text-info',
                    'DEBUG': 'text-muted'
                }[log.level] || 'text-muted';

                html += `
                    <div class="log-entry py-1 border-bottom">
                        <span class="text-muted">${log.timestamp}</span>
                        <span class="badge bg-secondary ms-2">${log.level}</span>
                        <span class="${levelClass} ms-2">${log.message}</span>
                    </div>
                `;
            });
            html += '</div>';

            logsContent.innerHTML = html;

        } catch (error) {
            console.error('Error refreshing logs:', error);
            const logsContent = document.getElementById('logsContent');
            if (logsContent) {
                logsContent.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Failed to load system logs
                    </div>
                `;
            }
        }
    }

    /**
     * Filter logs
     */
    filterLogs() {
        const levelFilter = document.getElementById('logLevelFilter')?.value || '';
        const logEntries = document.querySelectorAll('.log-entry');

        logEntries.forEach(entry => {
            if (!levelFilter) {
                entry.style.display = 'block';
            } else {
                const level = entry.querySelector('.badge').textContent;
                entry.style.display = level === levelFilter ? 'block' : 'none';
            }
        });
    }

    /**
     * Export logs
     */
    exportLogs() {
        const logEntries = document.querySelectorAll('.log-entry');
        let csvContent = 'Timestamp,Level,Message\n';

        logEntries.forEach(entry => {
            const timestamp = entry.querySelector('.text-muted').textContent;
            const level = entry.querySelector('.badge').textContent;
            const message = entry.querySelector('.text-danger, .text-warning, .text-info, .text-muted').textContent;

            csvContent += `"${timestamp}","${level}","${message}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `system-logs-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        alert('✅ System logs exported successfully!');
    }

    /**
     * Save system configuration
     */
    saveConfiguration() {
        const config = {
            systemName: document.getElementById('systemName').value,
            timezone: document.getElementById('systemTimezone').value,
            language: document.getElementById('systemLanguage').value,
            cacheExpiration: document.getElementById('cacheExpiration').value,
            maxUploadSize: document.getElementById('maxUploadSize').value,
            sessionTimeout: document.getElementById('sessionTimeout').value,
            debugMode: document.getElementById('enableDebugMode').checked,
            maintenanceMode: document.getElementById('enableMaintenanceMode').checked
        };

        console.log('💾 Saving system configuration:', config);
        alert('✅ System configuration saved successfully!');
    }

    /**
     * Clear system cache
     */
    clearCache() {
        if (!confirm('Are you sure you want to clear the system cache? This will temporarily slow down the system.')) {
            return;
        }

        console.log('🧹 Clearing system cache...');
        alert('✅ System cache cleared successfully! (Demo)');
    }

    /**
     * Generate system report
     */
    generateSystemReport() {
        console.log('📊 Generating system report...');

        const report = {
            generated: new Date().toISOString(),
            system: this.systemInfo,
            monitoring: this.monitoringData.slice(-10), // Last 10 data points
            recommendations: [
                'Consider upgrading disk space - currently at 85%',
                'Memory usage is normal at 67%',
                'Database connections are within limits',
                'All services are running properly'
            ]
        };

        const reportText = JSON.stringify(report, null, 2);
        const blob = new Blob([reportText], { type: 'application/json;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `system-report-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        alert('✅ System report generated and downloaded!');
    }

    /**
     * Restart services
     */
    restartServices() {
        if (!confirm('Are you sure you want to restart all system services? This may cause temporary downtime.')) {
            return;
        }

        console.log('🔄 Restarting system services...');
        alert('🔄 System services restarting... This may take a few minutes. (Demo)');
    }

    /**
     * Shutdown system
     */
    shutdownSystem() {
        if (!confirm('WARNING: This will shut down the entire system! Are you absolutely sure?')) {
            return;
        }

        if (!confirm('FINAL WARNING: System shutdown cannot be undone remotely. Confirm shutdown?')) {
            return;
        }

        console.log('🛑 System shutdown initiated...');
        alert('🛑 System shutdown initiated. This is a demo - system will NOT actually shut down.');
    }

    /**
     * Show error message
     */
    showError(message) {
        const content = document.getElementById('system-content');
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

// Initialize and register the system module immediately when script loads
(function() {
    console.log('⚙️ Initializing System Module...');

    // Ensure adminPanel exists
    if (!window.adminPanel) {
        console.error('❌ window.adminPanel not found - system module cannot initialize');
        return;
    }

    // Ensure modules Map exists
    if (!window.adminPanel.modules) {
        console.error('❌ window.adminPanel.modules not found - system module cannot initialize');
        return;
    }

    try {
        // Create system module instance
        const systemModule = new SystemModule(window.adminPanel);

        // Set up the module entry
        window.adminPanel.modules.set('system', {
            loaded: true,
            path: 'modules/system.js',
            instance: systemModule
        });

        // Initialize the module
        systemModule.initialize();

        console.log('✅ System module initialized and registered successfully');
    } catch (error) {
        console.error('❌ Failed to initialize system module:', error);
    }
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SystemModule;
}
