/**
 * LAN Mount Manager - Mengelola koneksi SMB/network shares dari PC lain
 * Windows-specific implementation untuk BCL Phase 4
 */

const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const os = require('os');

const LAN_CONFIG_FILE = path.join(__dirname, 'lan-mounts.json');

class LANMountManager {
    constructor() {
        this.mounts = [];
        this.config = {
            autoMount: false,
            autoMountOnStartup: false,
            reconnectInterval: 60000, // Increased from 30s to 60s
            timeoutMs: 15000, // Increased from 10s to 15s
            maxRetries: 3
        };
        this.loadConfiguration();
    }

    /**
     * Load configuration dari file
     */
    loadConfiguration() {
        try {
            if (fs.existsSync(LAN_CONFIG_FILE)) {
                const data = JSON.parse(fs.readFileSync(LAN_CONFIG_FILE, 'utf8'));
                this.mounts = data.mounts || [];
                this.config = { ...this.config, ...data.settings };
                console.log(`✅ LAN Mount Config loaded: ${this.mounts.length} mount(s) configured`);
            }
        } catch (err) {
            console.error('❌ Failed to load LAN configuration:', err.message);
            this.mounts = [];
        }
    }

    /**
     * Save configuration ke file
     */
    saveConfiguration() {
        try {
            const data = {
                mounts: this.mounts,
                settings: this.config
            };
            fs.writeFileSync(LAN_CONFIG_FILE, JSON.stringify(data, null, 2), 'utf8');
            console.log('✅ LAN configuration saved');
        } catch (err) {
            console.error('❌ Failed to save LAN configuration:', err.message);
        }
    }

    /**
     * Test mount accessibility - cek akses ke file/folder (Enhanced version with hostname resolution)
     */
    testMountAccess(id) {
        const mount = this.getMountById(id);
        if (!mount) {
            throw new Error(`Mount tidak ditemukan: ${id}`);
        }

        return new Promise(async (resolve) => {
            // Test mapped drive first
            let driveAccessible = false;
            try {
                fs.accessSync(mount.localMountPoint, fs.constants.R_OK);
                const stats = fs.statSync(mount.localMountPoint);
                if (stats.isDirectory()) {
                    driveAccessible = true;
                    resolve({
                        accessible: true,
                        readable: true,
                        isDirectory: true,
                        path: mount.localMountPoint,
                        uncPath: mount.remotePath,
                        method: 'drive',
                        message: 'Mapped drive dapat diakses'
                    });
                    return;
                }
            } catch (driveErr) {
                console.log(`Mapped drive ${mount.localMountPoint} not accessible: ${driveErr.message}`);
            }

            // If drive not accessible, try UNC path directly
            if (!driveAccessible) {
                // First try the configured IP
                let uncPathsToTry = [mount.remotePath];

                // If IP is configured and we suspect it might be dynamic, also try hostname resolution
                if (mount.host && mount.host.match(/^\d+\.\d+\.\d+\.\d+$/)) {
                    // IP address detected, try hostname resolution as fallback
                    try {
                        console.log(`🔍 IP detected (${mount.host}), attempting hostname resolution...`);
                        const hostname = await this._resolveHostnameToIP(mount.name.split(' ')[0] || 'PC-BIM02');

                        if (hostname && hostname !== mount.host) {
                            const hostnameUncPath = `\\\\${hostname}\\${mount.shareName}`;
                            uncPathsToTry.push(hostnameUncPath);
                            console.log(`📋 Added hostname UNC path: ${hostnameUncPath}`);
                        }
                    } catch (resolveErr) {
                        console.log(`⚠️ Hostname resolution failed: ${resolveErr.message}`);
                    }
                }

                // Try all UNC paths
                for (const uncPath of uncPathsToTry) {
                    try {
                        console.log(`🔍 Testing UNC path: ${uncPath}`);
                        const testCmd = os.platform() === 'win32' ?
                            `dir "${uncPath}" /b` :
                            `ls "${uncPath}"`;

                        const result = await this._executeCommand(testCmd);
                        if (result.success) {
                            // If we used hostname resolution and it worked, update the mount config
                            if (uncPath !== mount.remotePath) {
                                console.log(`✅ Hostname resolution successful, updating mount config`);
                                const hostname = uncPath.split('\\\\')[1].split('\\')[0];
                                mount.host = hostname;
                                mount.remotePath = uncPath;
                                this.saveConfiguration();
                            }

                            resolve({
                                accessible: true,
                                readable: true,
                                isDirectory: true,
                                path: uncPath, // Use working UNC path
                                uncPath: uncPath,
                                method: 'unc',
                                message: `UNC path dapat diakses langsung (${uncPath === mount.remotePath ? 'configured IP' : 'hostname resolution'})`
                            });
                            return;
                        }
                    } catch (uncErr) {
                        console.log(`❌ UNC path ${uncPath} not accessible: ${uncErr.message}`);
                    }
                }
            }

            // All methods failed
            resolve({
                accessible: false,
                readable: false,
                isDirectory: false,
                path: mount.localMountPoint,
                uncPath: mount.remotePath,
                method: 'none',
                message: `Tidak dapat mengakses mount melalui drive atau UNC paths`
            });
        });
    }

    /**
     * Resolve hostname to IP address (for dynamic IP scenarios)
     */
    _resolveHostnameToIP(hostname) {
        return new Promise((resolve, reject) => {
            const { exec } = require('child_process');

            // Use nslookup or ping to resolve hostname
            const cmd = os.platform() === 'win32' ?
                `ping -n 1 -l 1 ${hostname}` :  // Windows ping
                `getent hosts ${hostname} || nslookup ${hostname}`; // Linux/Mac

            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Hostname resolution failed: ${error.message}`));
                    return;
                }

                // Parse IP from output
                const ipMatch = stdout.match(/(\d+\.\d+\.\d+\.\d+)/);
                if (ipMatch && ipMatch[1]) {
                    const resolvedIP = ipMatch[1];
                    console.log(`✅ Resolved ${hostname} to ${resolvedIP}`);
                    resolve(resolvedIP);
                } else {
                    reject(new Error(`Could not extract IP from resolution output`));
                }
            });
        });
    }

    /**
     * Execute command helper
     */
    _executeCommand(cmd) {
        return new Promise((resolve) => {
            exec(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
                resolve({
                    success: !error,
                    stdout: stdout || '',
                    stderr: stderr || '',
                    error: error ? error.message : null
                });
            });
        });
    }

    /**
     * Get all mounts
     */
    getAllMounts() {
        return this.mounts;
    }

    /**
     * Get single mount by ID
     */
    getMountById(id) {
        return this.mounts.find(m => m.id === id);
    }

    /**
     * Add new mount configuration
     */
    addMount(config) {
        if (!config.id || !config.remotePath) {
            throw new Error('Mount ID dan remotePath wajib ada');
        }

        const mount = {
            id: config.id,
            name: config.name || `Mount-${config.id}`,
            host: config.host || '',
            shareName: config.shareName || '',
            remotePath: config.remotePath,
            localMountPoint: config.localMountPoint || this.getNextAvailableDrive(),
            enabled: config.enabled || false,
            username: config.username || '',
            password: config.password || '',
            status: 'disconnected',
            lastConnected: null,
            notes: config.notes || ''
        };

        this.mounts.push(mount);
        this.saveConfiguration();
        console.log(`✅ Mount added: ${mount.id}`);
        return mount;
    }

    /**
     * Update existing mount
     */
    updateMount(id, updates) {
        const mount = this.getMountById(id);
        if (!mount) {
            throw new Error(`Mount tidak ditemukan: ${id}`);
        }

        Object.assign(mount, updates);
        this.saveConfiguration();
        console.log(`✅ Mount updated: ${id}`);
        return mount;
    }

    /**
     * Delete mount configuration
     */
    deleteMount(id) {
        const index = this.mounts.findIndex(m => m.id === id);
        if (index === -1) {
            throw new Error(`Mount tidak ditemukan: ${id}`);
        }

        // Disconnect sebelum delete
        this.disconnectMount(id);
        this.mounts.splice(index, 1);
        this.saveConfiguration();
        console.log(`✅ Mount deleted: ${id}`);
    }

    /**
     * Connect ke network share (Windows)
     */
    connectMount(id) {
        const mount = this.getMountById(id);
        if (!mount) {
            throw new Error(`Mount tidak ditemukan: ${id}`);
        }

        return new Promise((resolve, reject) => {
            console.log(`🔌 Connecting to: ${mount.remotePath} (${mount.username ? 'with credentials' : 'anonymous'})`);

            // First: Try to disconnect existing connection to prevent conflicts
            const disconnectCmd = os.platform() === 'win32' ? `net use ${mount.localMountPoint} /delete /y 2>&1` : '';

            if (disconnectCmd) {
                console.log(`🔄 Cleaning up existing connection: ${mount.localMountPoint}`);
                exec(disconnectCmd, (err, stdout, stderr) => {
                    // Ignore errors from disconnect - it might not exist
                    this._executeConnectionCommand(mount, resolve, reject);
                });
            } else {
                this._executeConnectionCommand(mount, resolve, reject);
            }
        });
    }

    /**
     * Execute the actual connection command
     */
    _executeConnectionCommand(mount, resolve, reject) {
        let cmd;
        if (os.platform() === 'win32') {
            // Windows: gunakan net use dengan /persistent:no untuk lebih stabil
            const credentials = mount.username ? ` /user:${mount.username}${mount.password ? ` "${mount.password}"` : ''}` : '';
            cmd = `net use ${mount.localMountPoint} "${mount.remotePath}"${credentials} /persistent:no`;
            console.log(`🛠️ Executing: net use ${mount.localMountPoint} "${mount.remotePath}" [credentials] /persistent:no`);
        } else {
            // Linux/Mac: gunakan mount
            cmd = `sudo mount -t cifs "${mount.remotePath}" ${mount.localMountPoint} -o username=${mount.username}`;
        }

        const timeout = setTimeout(() => {
            console.error(`⏰ Connection timeout for ${mount.id} (${this.config.timeoutMs}ms)`);
            reject(new Error(`Connection timeout after ${this.config.timeoutMs}ms`));
        }, this.config.timeoutMs);

        console.log(`🚀 Executing command with environment...`);

        // Use cmd /c untuk lebih stabil di Windows, dengan proper environment
        const fullCmd = os.platform() === 'win32' ? `cmd /c "${cmd}"` : cmd;
        const options = {
            timeout: this.config.timeoutMs,
            env: {
                ...process.env,
                // Ensure Windows command environment
                LANG: 'en_US.UTF-8',
                LC_ALL: 'en_US.UTF-8'
            }
        };

        exec(fullCmd, options, (error, stdout, stderr) => {
            clearTimeout(timeout);

            // Clean up output (remove excessive whitespace)
            const cleanStdout = stdout ? stdout.trim() : '';
            const cleanStderr = stderr ? stderr.trim() : '';

            if (error) {
                mount.status = 'error';
                console.error(`❌ Connection failed for ${mount.id}:`);
                console.error(`   ❌ CODE: ${error.code} | SIGNAL: ${error.signal}`);
                console.error(`   ❌ MESSAGE: ${error.message}`);
                if (cleanStdout) console.error(`   ❌ STDOUT: ${cleanStdout}`);
                if (cleanStderr) console.error(`   ❌ STDERR: ${cleanStderr}`);

                // Try alternative method if basic approach fails
                if (os.platform() === 'win32' && mount.username && mount.password) {
                    console.log(`🔄 Trying alternative connection method for ${mount.id}...`);
                    this._tryAlternativeConnection(mount, resolve, reject);
                } else {
                    reject(new Error(`Network mount failed: ${error.message}`));
                }
            } else {
                mount.status = 'connected';
                mount.lastConnected = new Date().toISOString();
                this.saveConfiguration();
                console.log(`✅ Connected: ${mount.id} -> ${mount.localMountPoint}`);
                if (cleanStdout) console.log(`   ✅ STDOUT: ${cleanStdout}`);
                resolve(mount);
            }
        });
    }

    /**
     * Disconnect dari network share
     */
    disconnectMount(id) {
        const mount = this.getMountById(id);
        if (!mount) {
            throw new Error(`Mount tidak ditemukan: ${id}`);
        }

        return new Promise((resolve, reject) => {
            console.log(`🔌 Disconnecting: ${mount.localMountPoint}`);

            let cmd;
            if (os.platform() === 'win32') {
                cmd = `net use ${mount.localMountPoint} /delete /yes`;
            } else {
                cmd = `sudo umount ${mount.localMountPoint}`;
            }

            exec(cmd, (error, stdout, stderr) => {
                if (error && !error.message.includes('The network path was not found')) {
                    mount.status = 'error';
                    console.error(`⚠️ Disconnect error:`, error.message);
                    reject(error);
                } else {
                    mount.status = 'disconnected';
                    this.saveConfiguration();
                    console.log(`✅ Disconnected: ${mount.id}`);
                    resolve(mount);
                }
            });
        });
    }

    /**
     * Check mount status
     */
    checkMountStatus(id) {
        const mount = this.getMountById(id);
        if (!mount) {
            return null;
        }

        return new Promise((resolve) => {
            // Windows: check if drive letter is accessible
            if (os.platform() === 'win32') {
                try {
                    const stats = fs.statSync(mount.localMountPoint);
                    if (stats.isDirectory()) {
                        mount.status = 'connected';
                        resolve(true);
                    } else {
                        mount.status = 'disconnected';
                        resolve(false);
                    }
                } catch (err) {
                    mount.status = 'disconnected';
                    resolve(false);
                }
            } else {
                // Linux/Mac: check mount point
                try {
                    fs.accessSync(mount.localMountPoint, fs.constants.R_OK);
                    mount.status = 'connected';
                    resolve(true);
                } catch (err) {
                    mount.status = 'disconnected';
                    resolve(false);
                }
            }
        });
    }

    /**
     * List files/folders dari mounted directory
     */
    listMountContents(id, subPath = '') {
        const mount = this.getMountById(id);
        if (!mount) {
            throw new Error(`Mount tidak ditemukan: ${id}`);
        }

        const fullPath = path.join(mount.localMountPoint, subPath);

        try {
            const items = fs.readdirSync(fullPath, { withFileTypes: true });
            return items.map(item => ({
                name: item.name,
                isDirectory: item.isDirectory(),
                path: `${subPath}/${item.name}`.replace(/^\//, '')
            }));
        } catch (err) {
            throw new Error(`Failed to read mount contents: ${err.message}`);
        }
    }

    /**
     * Get next available drive letter (Windows)
     */
    getNextAvailableDrive() {
        if (os.platform() !== 'win32') {
            return '/mnt/bcl-mount';
        }

        for (let i = 25; i >= 2; i--) {
            const letter = String.fromCharCode(65 + i); // A-Z
            const drive = `${letter}:`;
            try {
                fs.accessSync(drive);
            } catch (err) {
                return drive;
            }
        }
        return 'Z:'; // Default
    }

    /**
     * Get mount accessibility - cek akses ke file/folder (Enhanced version)
     */
    testMountAccess(id) {
        const mount = this.getMountById(id);
        if (!mount) {
            throw new Error(`Mount tidak ditemukan: ${id}`);
        }

        return new Promise(async (resolve) => {
            // Test mapped drive first
            let driveAccessible = false;
            try {
                fs.accessSync(mount.localMountPoint, fs.constants.R_OK);
                const stats = fs.statSync(mount.localMountPoint);
                if (stats.isDirectory()) {
                    driveAccessible = true;
                    resolve({
                        accessible: true,
                        readable: true,
                        isDirectory: true,
                        path: mount.localMountPoint,
                        uncPath: mount.remotePath,
                        method: 'drive',
                        message: 'Mapped drive dapat diakses'
                    });
                    return;
                }
            } catch (driveErr) {
                console.log(`Mapped drive ${mount.localMountPoint} not accessible: ${driveErr.message}`);
            }

            // If drive not accessible, try UNC path directly
            if (!driveAccessible) {
                try {
                    // Test UNC path by trying to list directory
                    const testCmd = os.platform() === 'win32' ?
                        `dir "${mount.remotePath}" /b` :
                        `ls "${mount.remotePath}"`;

                    const result = await this._executeCommand(testCmd);
                    if (result.success) {
                        resolve({
                            accessible: true,
                            readable: true,
                            isDirectory: true,
                            path: mount.remotePath, // Use UNC path
                            uncPath: mount.remotePath,
                            method: 'unc',
                            message: 'UNC path dapat diakses langsung'
                        });
                        return;
                    }
                } catch (uncErr) {
                    console.log(`UNC path ${mount.remotePath} not accessible: ${uncErr.message}`);
                }
            }

            // Both methods failed
            resolve({
                accessible: false,
                readable: false,
                isDirectory: false,
                path: mount.localMountPoint,
                uncPath: mount.remotePath,
                method: 'none',
                message: `Tidak dapat mengakses mount melalui drive atau UNC: drive=${driveAccessible ? 'yes' : 'no'}, unc=no`
            });
        });
    }

    /**
     * Auto-reconnect mounts yang enabled
     */
    autoReconnectEnabledMounts() {
        const enabledMounts = this.mounts.filter(m => m.enabled);

        if (enabledMounts.length === 0) {
            console.log('ℹ️ No mounts enabled for auto-connect');
            return Promise.resolve([]);
        }

        console.log(`🔄 Auto-reconnecting ${enabledMounts.length} mount(s)...`);

        return Promise.allSettled(
            enabledMounts.map(mount =>
                this.connectMount(mount.id)
                    .catch(err => {
                        console.error(`❌ Auto-reconnect failed for ${mount.id}:`, err.message);
                        return null;
                    })
            )
        ).then(results => {
            const connected = results.filter(r => r.status === 'fulfilled' && r.value).length;
            console.log(`✅ Auto-reconnect complete: ${connected}/${enabledMounts.length} mounts connected`);
            return connected;
        });
    }

    /**
     * Alternative connection method menggunakan PowerShell (fallback)
     */
    _tryAlternativeConnection(mount, resolve, reject) {
        console.log(`🔄 Alternative connection: PowerShell approach for ${mount.id}`);

        try {
            const psCommand = `
                $ErrorActionPreference = 'Stop'
                $password = ConvertTo-SecureString '${mount.password}' -AsPlainText -Force
                $creds = New-Object System.Management.Automation.PSCredential('${mount.username}', $password)
                New-PSDrive -Name '${mount.localMountPoint.replace(':', '')}' -PSProvider FileSystem -Root '${mount.remotePath}' -Credential $creds -Persist
            `;

            const cmd = `powershell -Command "${psCommand}"`;

            exec(cmd, { timeout: this.config.timeoutMs }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`❌ Alternative PowerShell connection also failed for ${mount.id}:`, error.message);
                    reject(new Error(`All connection methods failed. Last error: ${error.message}`));
                } else {
                    mount.status = 'connected';
                    mount.lastConnected = new Date().toISOString();
                    this.saveConfiguration();
                    console.log(`✅ Alternative connection successful: ${mount.id} -> ${mount.localMountPoint}`);
                    resolve(mount);
                }
            });
        } catch (psError) {
            console.error(`❌ PowerShell alternative setup failed:`, psError.message);
            reject(new Error(`Connection failed through all available methods`));
        }
    }
}

module.exports = LANMountManager;
