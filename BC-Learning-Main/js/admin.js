// Admin Panel JavaScript - Separated from HTML for better organization

let currentMaterials = {};
let currentCategories = {};
let currentBackups = [];
let currentUsers = [];

function getAdminAuthHeaders(extraHeaders = {}) {
    const headers = { ...extraHeaders };
    const token = localStorage.getItem('token') || localStorage.getItem('admin_token');
    if (token && !headers.Authorization && !headers.authorization) {
        headers.Authorization = `Bearer ${token}`;
    }
    return headers;
}

function adminFetch(url, options = {}) {
    return fetch(url, {
        ...options,
        headers: getAdminAuthHeaders(options.headers || {}),
        credentials: 'include'
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', function () {
    loadMaterials();
    loadCategories();
    loadBackups();
    loadUsers();
    showSection('materials');
});

// Section navigation
function showSection(sectionName, event) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(section => {
        section.style.display = 'none';
    });

    // Show selected section
    const targetSection = document.getElementById(sectionName + '-section');
    if (targetSection) {
        targetSection.style.display = 'block';
    }

    // Update active nav link
    document.querySelectorAll('.admin-nav .nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // Add active class to clicked link
    if (event && event.target) {
        event.target.classList.add('active');
    }
}

// Load materials
async function loadMaterials() {
    try {
        showLoading('materials-list', 'Loading materials...');

        const response = await adminFetch('/api/admin/materials');

        if (response.ok) {
            const data = await response.json();
            currentMaterials = data.data;
            displayMaterials();
            updateAnalytics(data.data);
        } else {
            showError('materials-list', 'Failed to load materials');
        }
    } catch (error) {
        console.error('Error loading materials:', error);
        showError('materials-list', 'Error loading materials: ' + error.message);
    } finally {
        hideLoading('materials-list');
    }
}

// Display materials
function displayMaterials(filter = 'all') {
    const container = document.getElementById('materials-list');
    container.innerHTML = '';

    Object.keys(currentMaterials).forEach(type => {
        if (filter !== 'all' && type !== filter) return;

        Object.keys(currentMaterials[type]).forEach(filename => {
            const material = currentMaterials[type][filename];
            const card = createMaterialCard(filename, material, type);
            container.appendChild(card);
        });
    });
}

// Create material card
function createMaterialCard(filename, material, type) {
    const col = document.createElement('div');
    col.className = 'col-md-6 col-lg-4';

    const isManual = material.tagline && material.category;
    const cardClass = isManual ? 'tagline-manual' : 'tagline-auto';

    col.innerHTML = `
        <div class="tagline-card ${cardClass}">
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <h6 class="mb-1">${filename}</h6>
                    <small class="text-muted">${type.toUpperCase()}</small>
                </div>
                <span class="badge ${isManual ? 'bg-success' : 'bg-warning'}">
                    ${isManual ? 'Manual' : 'Auto'}
                </span>
            </div>
            <p class="mb-2">${material.tagline || 'No tagline set'}</p>
            <div class="d-flex justify-content-between align-items-center">
                <small class="text-muted">
                    ${material.category || 'No category'}
                </small>
                <button class="btn btn-sm btn-outline-primary" onclick="editTagline('${filename}', '${type}')">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
        </div>
    `;

    return col;
}

// Load categories
async function loadCategories() {
    try {
        const response = await adminFetch('/api/admin/tags');

        if (response.ok) {
            const data = await response.json();
            currentCategories = data.data.categories || {};
            displayCategories();
            populateCategorySelect();
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Display categories
function displayCategories() {
    const container = document.getElementById('categories-list');
    container.innerHTML = '';

    Object.keys(currentCategories).forEach(categoryId => {
        const category = currentCategories[categoryId];
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4';

        col.innerHTML = `
            <div class="card h-100">
                <div class="card-body">
                    <div class="d-flex align-items-center mb-2">
                        <i class="${category.icon}" style="color: ${category.color}; margin-right: 10px;"></i>
                        <h6 class="card-title mb-0">${category.name}</h6>
                    </div>
                    <p class="card-text small">${category.description}</p>
                    <div class="category-badge" style="background-color: ${category.color};">
                        ${categoryId}
                    </div>
                </div>
            </div>
        `;

        container.appendChild(col);
    });
}

// Edit tagline
function editTagline(filename, type) {
    const material = currentMaterials[type][filename];
    document.getElementById('materialName').value = filename;
    document.getElementById('taglineInput').value = material.tagline || '';
    document.getElementById('categorySelect').value = material.category || 'general';
    document.getElementById('materialType').value = type;

    const modal = new bootstrap.Modal(document.getElementById('editTaglineModal'));
    modal.show();
}

// Save tagline
async function saveTagline() {
    const filename = document.getElementById('materialName').value;
    const tagline = document.getElementById('taglineInput').value;
    const category = document.getElementById('categorySelect').value;
    const type = document.getElementById('materialType').value;

    try {
        const response = await adminFetch(`/api/admin/tags/${type}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: filename,
                tagline: tagline,
                category: category
            })
        });

        if (response.ok) {
            showAlert('Tagline saved successfully!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('editTaglineModal')).hide();
            loadMaterials();
        } else {
            showAlert('Failed to save tagline', 'danger');
        }
    } catch (error) {
        console.error('Error saving tagline:', error);
        showAlert('Error saving tagline: ' + error.message, 'danger');
    }
}

// Show add category modal
function showAddCategoryModal() {
    document.getElementById('categoryForm').reset();
    const modal = new bootstrap.Modal(document.getElementById('addCategoryModal'));
    modal.show();
}

// Save category
async function saveCategory() {
    const categoryId = document.getElementById('categoryId').value;
    const categoryName = document.getElementById('categoryName').value;
    const description = document.getElementById('categoryDescription').value;
    const color = document.getElementById('categoryColor').value;
    const icon = document.getElementById('categoryIcon').value;

    try {
        const response = await adminFetch('/api/admin/categories', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: categoryId,
                name: categoryName,
                description: description,
                color: color,
                icon: icon
            })
        });

        if (response.ok) {
            showAlert('Category created successfully!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('addCategoryModal')).hide();
            loadCategories();
        } else {
            showAlert('Failed to create category', 'danger');
        }
    } catch (error) {
        console.error('Error creating category:', error);
        showAlert('Error creating category: ' + error.message, 'danger');
    }
}

// Populate category select
function populateCategorySelect() {
    const select = document.getElementById('categorySelect');
    select.innerHTML = '<option value="general">General</option>';

    Object.keys(currentCategories).forEach(categoryId => {
        const category = currentCategories[categoryId];
        const option = document.createElement('option');
        option.value = categoryId;
        option.textContent = category.name;
        select.appendChild(option);
    });
}

// Update analytics
function updateAnalytics(materials) {
    let totalMaterials = 0;
    let manualTags = 0;

    Object.keys(materials).forEach(type => {
        Object.keys(materials[type]).forEach(filename => {
            totalMaterials++;
            if (materials[type][filename].tagline) {
                manualTags++;
            }
        });
    });

    document.getElementById('total-materials').textContent = totalMaterials;
    document.getElementById('manual-tags').textContent = manualTags;
    document.getElementById('total-users').textContent = currentUsers.length;
    document.getElementById('total-backups').textContent = currentBackups.length;
}

// Refresh materials
function refreshMaterials() {
    loadMaterials();
}

// Filter materials by type
document.addEventListener('change', function(e) {
    if (e.target.name === 'materialType') {
        displayMaterials(e.target.id);
    }
});

// Backup Management Functions
async function loadBackups() {
    try {
        showLoading('backups-list', 'Loading backups...');

        const response = await adminFetch('/api/admin/backups');

        if (response.ok) {
            const data = await response.json();
            currentBackups = data.backups || [];
            displayBackups();
        } else {
            showError('backups-list', 'Failed to load backups');
        }
    } catch (error) {
        console.error('Error loading backups:', error);
        showError('backups-list', 'Error loading backups: ' + error.message);
    } finally {
        hideLoading('backups-list');
    }
}

function displayBackups() {
    const container = document.getElementById('backups-list');
    container.innerHTML = '';

    if (currentBackups.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No backup files found.</div>';
        return;
    }

    currentBackups.forEach(backup => {
        const backupCard = document.createElement('div');
        backupCard.className = 'backup-card';

        const backupDate = new Date(backup.timestamp);
        const formattedDate = backupDate.toLocaleString('id-ID');

        backupCard.innerHTML = `
            <div class="backup-info">
                <div>
                    <h6 class="mb-1">${backup.filename}</h6>
                    <small class="text-muted">Created: ${formattedDate}</small>
                </div>
                <div class="backup-actions">
                    <button class="btn btn-sm btn-outline-info" onclick="viewBackup('${backup.filename}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn btn-sm btn-outline-success" onclick="restoreBackup('${backup.filename}')">
                        <i class="fas fa-undo"></i> Restore
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteBackup('${backup.filename}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
            <div>
                <small class="text-muted">Size: ${backup.size} bytes</small>
            </div>
        `;

        container.appendChild(backupCard);
    });
}

async function createBackup() {
    try {
        const response = await adminFetch('/api/admin/backups/create', {
            method: 'POST'
        });

        if (response.ok) {
            showAlert('Backup created successfully!', 'success');
            loadBackups();
        } else {
            showAlert('Failed to create backup', 'danger');
        }
    } catch (error) {
        console.error('Error creating backup:', error);
        showAlert('Error creating backup: ' + error.message, 'danger');
    }
}

async function viewBackup(filename) {
    try {
        const response = await adminFetch(`/api/admin/backups/${filename}`);

        if (response.ok) {
            const data = await response.json();
            showBackupDetails(data);
        } else {
            showAlert('Failed to load backup details', 'danger');
        }
    } catch (error) {
        console.error('Error loading backup:', error);
        showAlert('Error loading backup: ' + error.message, 'danger');
    }
}

function showBackupDetails(backupData) {
    const modal = new bootstrap.Modal(document.getElementById('backupDetailsModal'));
    const content = document.getElementById('backup-content');

    content.innerHTML = `
        <h6>Backup Information</h6>
        <p><strong>Filename:</strong> ${backupData.filename}</p>
        <p><strong>Created:</strong> ${new Date(backupData.timestamp).toLocaleString('id-ID')}</p>
        <p><strong>Size:</strong> ${backupData.size} bytes</p>

        <h6 class="mt-3">Content Preview</h6>
        <div class="backup-json">${JSON.stringify(backupData.content, null, 2)}</div>
    `;

    // Store current backup filename for restore
    content.dataset.backupFilename = backupData.filename;

    modal.show();
}

async function restoreBackup(filename) {
    if (!filename) {
        // Get filename from modal data if not provided
        const modalContent = document.getElementById('backup-content');
        filename = modalContent.dataset.backupFilename;
    }

    if (!filename) {
        showAlert('No backup selected', 'warning');
        return;
    }

    if (!confirm(`Are you sure you want to restore the backup "${filename}"? This will overwrite current data.`)) {
        return;
    }

    try {
        const response = await adminFetch(`/api/admin/backups/${filename}/restore`, {
            method: 'POST'
        });

        if (response.ok) {
            showAlert('Backup restored successfully!', 'success');
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('backupDetailsModal')).hide();
            // Refresh all data
            loadMaterials();
            loadUsers();
            loadBackups();
        } else {
            showAlert('Failed to restore backup', 'danger');
        }
    } catch (error) {
        console.error('Error restoring backup:', error);
        showAlert('Error restoring backup: ' + error.message, 'danger');
    }
}

async function deleteBackup(filename) {
    if (!confirm(`Are you sure you want to delete the backup "${filename}"?`)) {
        return;
    }

    try {
        const response = await adminFetch(`/api/admin/backups/${filename}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showAlert('Backup deleted successfully!', 'success');
            loadBackups();
        } else {
            showAlert('Failed to delete backup', 'danger');
        }
    } catch (error) {
        console.error('Error deleting backup:', error);
        showAlert('Error deleting backup: ' + error.message, 'danger');
    }
}

function refreshBackups() {
    loadBackups();
}

// User Management Functions
async function loadUsers() {
    try {
        showLoading('users-list', 'Loading users...');

        const response = await adminFetch('/api/users/get-all');

        if (response.ok) {
            const data = await response.json();
            // Handle both array response and object with data property
            currentUsers = Array.isArray(data) ? data : (data.data || []);
            displayUsers();
            console.log(`✅ Loaded ${currentUsers.length} users`);
        } else {
            const errorText = await response.text();
            console.error('Failed to load users:', response.status, errorText);
            showError('users-list', `Failed to load users (${response.status})`);
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showError('users-list', 'Error loading users: ' + error.message);
    } finally {
        hideLoading('users-list');
    }
}

function displayUsers() {
    const container = document.getElementById('users-list');
    container.innerHTML = '';

    if (currentUsers.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No users found.</div>';
        return;
    }

    currentUsers.forEach(user => {
        const userCard = document.createElement('div');
        userCard.className = 'user-card';

        const isActive = user.is_active !== false && user.isActive !== false;
        const statusClass = isActive ? 'status-active' : 'status-inactive';
        const statusText = isActive ? 'Active' : 'Inactive';

        userCard.innerHTML = `
            <div class="user-info">
                <div class="user-details">
                    <h6 class="mb-1">${user.username || user.username}</h6>
                    <small class="text-muted">${user.email}</small>
                    <div class="mt-1">
                        <span class="status-badge ${statusClass}">${statusText}</span>
                        <small class="text-muted ms-2">${user.bim_level || user.bimLevel || 'N/A'}</small>
                    </div>
                </div>
                <div class="user-actions">
                    <button class="btn btn-sm btn-outline-primary" onclick="editUser('${user.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${user.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div>
                <small class="text-muted">
                    Role: ${user.job_role || user.jobRole || 'N/A'} |
                    Org: ${user.organization || 'N/A'}
                </small>
            </div>
        `;

        container.appendChild(userCard);
    });
}

function showAddUserModal() {
    document.getElementById('userForm').reset();
    const modal = new bootstrap.Modal(document.getElementById('addUserModal'));
    modal.show();
}

async function saveUser() {
    const userData = {
        username: document.getElementById('userUsername').value,
        email: document.getElementById('userEmail').value,
        password: document.getElementById('userPassword').value,
        bimLevel: document.getElementById('userBimLevel').value,
        jobRole: document.getElementById('userJobRole').value,
        organization: document.getElementById('userOrganization').value
    };

    try {
        const response = await adminFetch('/api/users/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        if (response.ok) {
            showAlert('User created successfully!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
            loadUsers();
        } else {
            const error = await response.json();
            showAlert(error.error || 'Failed to create user', 'danger');
        }
    } catch (error) {
        console.error('Error creating user:', error);
        showAlert('Error creating user: ' + error.message, 'danger');
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) {
        return;
    }

    try {
        const response = await adminFetch(`/api/users/${userId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showAlert('User deleted successfully!', 'success');
            loadUsers();
        } else {
            showAlert('Failed to delete user', 'danger');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showAlert('Error deleting user: ' + error.message, 'danger');
    }
}

function editUser(userId) {
    // TODO: Implement user editing functionality
    showAlert('User editing feature coming soon!', 'info');
}

function refreshUsers() {
    loadUsers();
}

// Utility Functions
function showLoading(containerId, message = 'Loading...') {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <div class="text-center py-4">
            <div class="loading-spinner"></div>
            <p class="mt-2">${message}</p>
        </div>
    `;
}

function hideLoading(containerId) {
    // Loading will be replaced by actual content
}

function showError(containerId, message) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <div class="alert alert-danger">
            <i class="fas fa-exclamation-triangle"></i> ${message}
        </div>
    `;
}

function showAlert(message, type = 'info') {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());

    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    // Insert at the top of the container
    const container = document.querySelector('.container');
    container.insertBefore(alert, container.firstChild);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}
