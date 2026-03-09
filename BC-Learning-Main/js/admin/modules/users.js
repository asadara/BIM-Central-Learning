/**
 * Users Module - Handles all user management operations
 * CRUD operations, verification, and user data management
 */
class UsersModule {
    constructor(adminPanel) {
        this.adminPanel = adminPanel;
        this.allUsers = [];
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.filteredUsers = [];
    }

    /**
     * Initialize the users module
     */
    initialize() {
        console.log('👥 Initializing Users Module');
        this.setupEventListeners();
    }

    /**
     * Setup event listeners for user-related elements
     */
    setupEventListeners() {
        // User search and filter inputs
        const searchInput = document.getElementById('userSearchInput');
        if (searchInput) {
            searchInput.addEventListener('keyup', () => this.filterUsers());
        }

        const bimLevelFilter = document.getElementById('bimLevelFilter');
        if (bimLevelFilter) {
            bimLevelFilter.addEventListener('change', () => this.filterUsers());
        }

        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.filterUsers());
        }

        // Create user modal
        const createUserBtn = document.querySelector('button[onclick*="showCreateUserModal"]');
        if (createUserBtn) {
            createUserBtn.addEventListener('click', () => this.showCreateUserModal());
        }

        // Refresh users button
        const refreshBtn = document.querySelector('button[onclick*="loadUsers"]');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadUsers());
        }
    }

    /**
     * Load users from API
     */
    async loadUsers() {
        console.log('🔄 Loading users...');

        const tableBody = document.getElementById('usersTableBody');
        if (!tableBody) {
            console.error('❌ Users table body not found');
            return;
        }

        tableBody.innerHTML = `
            <tr>
                <td colspan="12" class="text-center py-4">
                    <div class="d-flex flex-column align-items-center">
                        <div class="spinner-border text-primary mb-2" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="text-muted mb-0">Loading users...</p>
                    </div>
                </td>
            </tr>`;

        try {
            const response = await fetch('/api/users/get-all');
            console.log('📡 Users API response:', response.status, response.statusText);

        if (response.ok) {
                const data = await response.json();
                console.log('📡 Users API raw response:', data);

                // Handle different response formats
                let users = [];
                if (Array.isArray(data)) {
                    users = data;
                } else if (data.rows && Array.isArray(data.rows)) {
                    users = data.rows; // PostgreSQL raw result format
                } else if (data.data && Array.isArray(data.data)) {
                    users = data.data;
                } else if (data.users && Array.isArray(data.users)) {
                    users = data.users;
                } else {
                    console.error('❌ Unexpected API response format:', data);
                    alert('Unexpected API response format. Check console for details.');
                    return;
                }

                console.log('✅ Users loaded successfully:', users.length, 'users');

                // Debug: Log detailed user information
                console.log('🔍 Detailed user data:');
                users.forEach((user, index) => {
                    console.log(`  User ${index + 1}:`, {
                        id: user.id,
                        user_id: user.user_id,
                        username: user.username,
                        source: typeof user.id === 'number' ? 'PostgreSQL' : 'JSON',
                        hasValidId: !!(user.id || user.user_id)
                    });
                });

                this.allUsers = users;
                this.displayUsers(users);

                // Update total users count badge
                this.updateTotalUsersCount(users.length);

                // Update results info
                this.updateUserResultsInfo(users.length, users.length);
            } else {
                const errorText = await response.text();
                console.error('❌ Users API failed:', response.status, errorText);
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="12" class="text-center py-4">
                            <div class="alert alert-danger mb-0">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                Failed to load users: ${response.status} ${response.statusText}
                            </div>
                        </td>
                    </tr>`;
            }
        } catch (error) {
            console.error('❌ Error loading users:', error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="12" class="text-center py-4">
                        <div class="alert alert-danger mb-0">
                            <i class="fas fa-exclamation-circle me-2"></i>
                            Error loading users: ${error.message}
                        </div>
                    </td>
                </tr>`;
        }
    }

    /**
     * Display users in table
     */
    displayUsers(users) {
        const tableBody = document.getElementById('usersTableBody');

        if (users.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="12" class="text-center py-4">
                        <div class="d-flex flex-column align-items-center">
                            <i class="fas fa-users fa-3x text-muted mb-3"></i>
                            <p class="text-muted mb-2">No users found</p>
                        </div>
                    </td>
                </tr>`;
            return;
        }

        let html = '';
        users.forEach(user => {
            // Simplified and robust user ID extraction
            let userId;

            // Priority order: numeric ID (PostgreSQL) > string ID (JSON) > fallback
            if (typeof user.id === 'number' && user.id > 0) {
                userId = user.id.toString();
            } else if (user.id && typeof user.id === 'string' && user.id !== 'undefined') {
                userId = user.id;
            } else if (typeof user.user_id === 'number' && user.user_id > 0) {
                userId = user.user_id.toString();
            } else if (user.user_id && typeof user.user_id === 'string') {
                userId = user.user_id;
            } else {
                // Last resort: use username as ID (for JSON fallback)
                const username = (user.username || user.name || '').trim();
                userId = username ? username : 'unknown_' + Date.now();
            }

            // Debug logging (only for first few users to avoid spam)
            if (users.indexOf(user) < 3) {
                console.log('🔍 User ID extraction:', {
                    userIndex: users.indexOf(user),
                    rawUser: {
                        id: user.id,
                        user_id: user.user_id,
                        username: user.username,
                        type: typeof user.id
                    },
                    extractedId: userId,
                    idType: typeof user.id === 'number' ? 'database' : 'json'
                });
            }

            const username = user.username || user.name || 'N/A';
            const email = user.email || 'N/A';
            const bimLevel = user.bimLevel || user.bim_level || 'N/A';
            const jobRole = user.jobRole || user.job_role || 'N/A';
            const organization = user.organization || 'N/A';
            const isActive = user.is_active !== undefined ? user.is_active : (user.isActive !== undefined ? user.isActive : true);
            const statusBadge = isActive ?
                '<span class="badge bg-success"><i class="fas fa-check me-1"></i>Active</span>' :
                '<span class="badge bg-danger"><i class="fas fa-times me-1"></i>Inactive</span>';

            // Format registration date
            let regDate = user.registrationDate || user.registration_date || user.created_at;
            if (regDate) {
                try {
                    regDate = new Date(regDate).toLocaleDateString('id-ID');
                } catch (e) {
                    // Keep original format if parsing fails
                }
            } else {
                regDate = 'N/A';
            }

            const rowNumber = users.indexOf(user) + 1;

            html += `
                <tr>
                    <td class="text-center fw-bold">${rowNumber}</td>
                    <td>${userId}</td>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="avatar-circle me-2" style="width: 32px; height: 32px; border-radius: 50%; background: #007bff; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">
                                ${username.charAt(0).toUpperCase()}
                            </div>
                            <span>${username}</span>
                        </div>
                    </td>
                    <td>
                        <span class="text-muted">${email}</span>
                    </td>
                    <td>
                        <span class="badge bg-info">${bimLevel}</span>
                    </td>
                    <td>${jobRole}</td>
                    <td>${organization}</td>
                    <td>
                        <span class="text-muted font-monospace" title="Password is securely hashed">
                            ********
                        </span>
                        <br>
                        <small class="text-muted" title="Data source">
                            <i class="fas fa-database me-1"></i>${typeof user.id === 'number' ? 'PostgreSQL' : 'JSON'}
                        </small>
                    </td>
                    <td>${statusBadge}</td>
                    <td>${regDate}</td>
                    <td class="text-center">
                        <div class="form-check">
                            <input class="form-check-input mapping-access-checkbox" type="checkbox"
                                   id="mappingAccess_${userId}"
                                   ${user.mappingKompetensiAccess ? 'checked' : ''}
                                   onchange="window.adminPanel.modules.get('users').instance.toggleMappingKompetensiAccess('${userId}', this.checked, this)">
                            <label class="form-check-label" for="mappingAccess_${userId}"></label>
                        </div>
                    </td>
                    <td>
                        <div class="btn-group btn-group-sm" role="group">
                            <button class="btn btn-outline-info" onclick="window.adminPanel.modules.get('users').instance.verifyUser('${userId}', '${username}')" title="Verify User Existence">
                                <i class="fas fa-search"></i>
                            </button>
                            <button class="btn btn-outline-primary" onclick="window.adminPanel.modules.get('users').instance.editUser('${userId}')" title="Edit User">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-outline-${isActive ? 'warning' : 'success'}" onclick="window.adminPanel.modules.get('users').instance.toggleUserStatus('${userId}', ${isActive})" title="${isActive ? 'Deactivate' : 'Activate'} User">
                                <i class="fas fa-${isActive ? 'ban' : 'check'}"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="window.adminPanel.modules.get('users').instance.deleteUser('${userId}', '${username}')" title="Delete User">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
        });

        tableBody.innerHTML = html;
    }

    /**
     * Filter users based on search and filter criteria
     */
    filterUsers() {
        const searchTerm = document.getElementById('userSearchInput').value.toLowerCase().trim();
        const bimLevelFilter = document.getElementById('bimLevelFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;

        const filteredUsers = this.allUsers.filter(user => {
            const username = (user.username || user.name || '').toLowerCase();
            const email = (user.email || '').toLowerCase();
            const bimLevel = user.bimLevel || user.bim_level || '';
            const isActive = user.is_active !== undefined ? user.is_active : (user.isActive !== undefined ? user.isActive : true);

            // Search filter
            const matchesSearch = !searchTerm ||
                username.includes(searchTerm) ||
                email.includes(searchTerm);

            // BIM Level filter
            const matchesBimLevel = !bimLevelFilter || bimLevel === bimLevelFilter;

            // Status filter
            let matchesStatus = true;
            if (statusFilter === 'active') {
                matchesStatus = isActive;
            } else if (statusFilter === 'inactive') {
                matchesStatus = !isActive;
            }

            return matchesSearch && matchesBimLevel && matchesStatus;
        });

        this.displayUsers(filteredUsers);
        this.updateUserResultsInfo(filteredUsers.length, this.allUsers.length);
    }

    /**
     * Clear user filters
     */
    clearUserFilters() {
        document.getElementById('userSearchInput').value = '';
        document.getElementById('bimLevelFilter').value = '';
        document.getElementById('statusFilter').value = '';

        this.displayUsers(this.allUsers);
        this.updateUserResultsInfo(this.allUsers.length, this.allUsers.length);
    }

    /**
     * Update total users count
     */
    updateTotalUsersCount(count) {
        const badge = document.getElementById('totalUsersCount');
        if (badge) {
            badge.innerHTML = `<i class="fas fa-users me-1"></i>Total: ${count} users`;
        }
    }

    /**
     * Update user results info
     */
    updateUserResultsInfo(filteredCount, totalCount) {
        // This function can be used to show filter results info if needed
        console.log(`Showing ${filteredCount} of ${totalCount} users`);
    }

    /**
     * Show create user modal
     */
    showCreateUserModal() {
        // Create modal for adding new user
        const modalHtml = `
            <div class="modal fade" id="userModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-user-plus me-2"></i>Add New User
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="userForm">
                            <div class="modal-body">
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label">Username *</label>
                                        <input type="text" class="form-control" id="userUsername" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Email *</label>
                                        <input type="email" class="form-control" id="userEmail" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Password *</label>
                                        <input type="password" class="form-control" id="userPassword" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">BIM Level *</label>
                                        <select class="form-select" id="userBimLevel" required>
                                            <option value="">Select BIM Level</option>
                                            <option value="BIM Modeller">BIM Modeller</option>
                                            <option value="BIM Coordinator">BIM Coordinator</option>
                                            <option value="BIM Manager">BIM Manager</option>
                                            <option value="Expert">Expert</option>
                                        </select>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Job Role</label>
                                        <input type="text" class="form-control" id="userJobRole" placeholder="e.g., BIM Specialist">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Organization</label>
                                        <input type="text" class="form-control" id="userOrganization" placeholder="e.g., PT. Nusakonstruksi">
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="fas fa-save me-2"></i>Create User
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>`;

        // Remove existing modal if any
        const existingModal = document.getElementById('userModal');
        if (existingModal) existingModal.remove();

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Setup form submission
        document.getElementById('userForm').addEventListener('submit', (e) => this.handleCreateUser(e));

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('userModal'));
        modal.show();
    }

    /**
     * Handle create user form submission
     */
    async handleCreateUser(event) {
        event.preventDefault();

        const userData = {
            username: document.getElementById('userUsername').value.trim(),
            email: document.getElementById('userEmail').value.trim(),
            password: document.getElementById('userPassword').value,
            bimLevel: document.getElementById('userBimLevel').value,
            jobRole: document.getElementById('userJobRole').value.trim(),
            organization: document.getElementById('userOrganization').value.trim()
        };

        try {
            const submitBtn = event.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Creating...';
            submitBtn.disabled = true;

            const response = await fetch('/api/users/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });

            if (response.ok) {
                const result = await response.json();
                alert('✅ User created successfully!');

                // Close modal and refresh users list
                bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
                this.loadUsers();
            } else {
                const error = await response.json();
                alert('❌ Failed to create user: ' + (error.error || 'Unknown error'));
            }

            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;

        } catch (error) {
            console.error('Error creating user:', error);
            alert('❌ Error creating user: ' + error.message);
            event.target.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-save me-2"></i>Create User';
            event.target.querySelector('button[type="submit"]').disabled = false;
        }
    }

    /**
     * Edit user
     */
    editUser(userId) {
        // Find user data
        const user = this.allUsers.find(u => (u.id || u.user_id) === userId);
        if (!user) {
            alert('User not found');
            return;
        }

        // Create edit modal with pre-filled data
        const modalHtml = `
            <div class="modal fade" id="userModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-user-edit me-2"></i>Edit User
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="userForm">
                            <div class="modal-body">
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label">Username *</label>
                                        <input type="text" class="form-control" id="userUsername" value="${user.username || user.name || ''}" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Email *</label>
                                        <input type="email" class="form-control" id="userEmail" value="${user.email || ''}" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">BIM Level *</label>
                                        <select class="form-select" id="userBimLevel" required>
                                            <option value="">Select BIM Level</option>
                                            <option value="BIM Modeller" ${user.bimLevel === 'BIM Modeller' ? 'selected' : ''}>BIM Modeller</option>
                                            <option value="BIM Coordinator" ${user.bimLevel === 'BIM Coordinator' ? 'selected' : ''}>BIM Coordinator</option>
                                            <option value="BIM Manager" ${user.bimLevel === 'BIM Manager' ? 'selected' : ''}>BIM Manager</option>
                                            <option value="Expert" ${user.bimLevel === 'Expert' ? 'selected' : ''}>Expert</option>
                                        </select>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Status</label>
                                        <select class="form-select" id="userStatus">
                                            <option value="true" ${(user.is_active !== undefined ? user.is_active : user.isActive !== undefined ? user.isActive : true) ? 'selected' : ''}>Active</option>
                                            <option value="false" ${!(user.is_active !== undefined ? user.is_active : user.isActive !== undefined ? user.isActive : true) ? 'selected' : ''}>Inactive</option>
                                        </select>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Job Role</label>
                                        <input type="text" class="form-control" id="userJobRole" value="${user.jobRole || user.job_role || ''}" placeholder="e.g., BIM Specialist">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Organization</label>
                                        <input type="text" class="form-control" id="userOrganization" value="${user.organization || ''}" placeholder="e.g., PT. Nusakonstruksi">
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="fas fa-save me-2"></i>Update User
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>`;

        // Remove existing modal if any
        const existingModal = document.getElementById('userModal');
        if (existingModal) existingModal.remove();

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Setup form submission
        document.getElementById('userForm').addEventListener('submit', (e) => this.handleUpdateUser(e, userId));

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('userModal'));
        modal.show();
    }

    /**
     * Handle update user form submission
     */
    async handleUpdateUser(event, userId) {
        event.preventDefault();

        const userData = {
            username: document.getElementById('userUsername').value.trim(),
            email: document.getElementById('userEmail').value.trim(),
            bimLevel: document.getElementById('userBimLevel').value,
            jobRole: document.getElementById('userJobRole').value.trim(),
            organization: document.getElementById('userOrganization').value.trim(),
            isActive: document.getElementById('userStatus').value === 'true'
        };

        try {
            const submitBtn = event.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Updating...';
            submitBtn.disabled = true;

            const response = await fetch(`/api/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });

            if (response.ok) {
                const result = await response.json();
                alert('✅ User updated successfully!');

                // Close modal and refresh users list
                bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
                this.loadUsers();
            } else {
                const error = await response.json();
                alert('❌ Failed to update user: ' + (error.error || 'Unknown error'));
            }

            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;

        } catch (error) {
            console.error('Error updating user:', error);
            alert('❌ Error updating user: ' + error.message);
            event.target.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-save me-2"></i>Update User';
            event.target.querySelector('button[type="submit"]').disabled = false;
        }
    }

    /**
     * Toggle user status
     */
    toggleUserStatus(userId, currentStatus) {
        const action = currentStatus ? 'deactivate' : 'activate';
        const confirmMsg = `Are you sure you want to ${action} this user?`;

        if (confirm(confirmMsg)) {
            this.handleToggleUserStatus(userId, !currentStatus);
        }
    }

    /**
     * Handle toggle user status
     */
    async handleToggleUserStatus(userId, newStatus) {
        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: newStatus })
            });

            if (response.ok) {
                alert(`✅ User ${newStatus ? 'activated' : 'deactivated'} successfully!`);
                this.loadUsers(); // Refresh the list
            } else {
                const error = await response.json();
                alert('❌ Failed to update user status: ' + (error.error || 'Unknown error'));
            }

        } catch (error) {
            console.error('Error toggling user status:', error);
            alert('❌ Error updating user status: ' + error.message);
        }
    }

    /**
     * Delete user
     */
    deleteUser(userId, username) {
        console.log('🗑️ Delete user initiated:', { userId, username, type: typeof userId });

        const confirmMsg = `Are you sure you want to permanently delete user "${username}"?\n\nThis action cannot be undone!`;

        if (confirm(confirmMsg)) {
            // Double confirmation for destructive action
            const doubleConfirm = `FINAL CONFIRMATION: Delete user "${username}"?\n\nAll user data will be permanently lost!`;

            if (confirm(doubleConfirm)) {
                this.handleDeleteUser(userId, username);
            }
        }
    }

    /**
     * Handle delete user
     */
    async handleDeleteUser(userId, username) {
        try {
            console.log('🔄 Starting delete operation for user:', { userId, username });

            // Ensure userId is properly formatted
            const cleanUserId = String(userId).trim();
            console.log('📝 Clean user ID:', cleanUserId);

            const response = await fetch(`/api/users/${encodeURIComponent(cleanUserId)}`, {
                method: 'DELETE'
            });

            console.log('📡 Delete API response:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });

            if (response.ok) {
                const result = await response.json();
                console.log('✅ Delete API success:', result);

                alert(`✅ User "${username}" deleted successfully!`);

                // Clear current user data and force refresh
                console.log('🔄 Refreshing user list...');
                this.allUsers = []; // Clear cache
                await this.loadUsers(); // Wait for reload

                console.log('✅ User list refreshed after delete');
            } else {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('❌ Delete API failed:', error);

                alert('❌ Failed to delete user: ' + (error.error || 'Unknown error'));
            }

        } catch (error) {
            console.error('❌ Error deleting user:', error);
            alert('❌ Error deleting user: ' + error.message);
        }
    }

    /**
     * Verify user existence
     */
    async verifyUser(userId, username) {
        console.log('🔍 Verifying user existence:', { userId, username });

        try {
            // Show loading state
            const button = event.target.closest('button');
            const originalHTML = button.innerHTML;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            button.disabled = true;

            // Create verification modal
            const modalHtml = `
                <div class="modal fade" id="verifyUserModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">
                                    <i class="fas fa-search me-2"></i>Verify User: ${username}
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div id="verification-results">
                                    <div class="text-center">
                                        <div class="spinner-border text-primary mb-3" role="status">
                                            <span class="visually-hidden">Verifying...</span>
                                        </div>
                                        <p>Checking user existence in all storage systems...</p>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            </div>
                        </div>
                    </div>
                </div>`;

            // Remove existing modal if any
            const existingModal = document.getElementById('verifyUserModal');
            if (existingModal) existingModal.remove();

            // Add modal to body
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('verifyUserModal'));
            modal.show();

            // Perform verification checks
            const verificationResults = await this.performUserVerification(userId, username);

            // Display results
            this.displayVerificationResults(verificationResults, userId, username);

            // Restore button
            button.innerHTML = originalHTML;
            button.disabled = false;

        } catch (error) {
            console.error('Error verifying user:', error);
            alert('Error verifying user: ' + error.message);

            // Restore button
            const button = event.target.closest('button');
            button.innerHTML = '<i class="fas fa-search"></i>';
            button.disabled = false;
        }
    }

    /**
     * Perform user verification checks
     */
    async performUserVerification(userId, username) {
        const results = {
            userId: userId,
            username: username,
            checks: []
        };

        // Check 1: Verify against loaded users list
        const inLoadedList = this.allUsers.some(u => (u.id || u.user_id) == userId);
        results.checks.push({
            name: 'Loaded Users List',
            status: inLoadedList ? 'found' : 'not_found',
            message: inLoadedList ? 'User found in currently loaded users list' : 'User not found in loaded list',
            data: inLoadedList ? { source: typeof this.allUsers.find(u => (u.id || u.user_id) == userId)?.id === 'number' ? 'database' : 'json' } : null
        });

        // Check 2: API verification - try to get user details
        try {
            const apiResponse = await fetch(`/api/users/verify/${encodeURIComponent(userId)}`);
            if (apiResponse.ok) {
                const apiData = await apiResponse.json();
                results.checks.push({
                    name: 'API Verification',
                    status: apiData.exists ? 'found' : 'not_found',
                    message: apiData.message,
                    data: apiData.details
                });
            } else {
                results.checks.push({
                    name: 'API Verification',
                    status: 'error',
                    message: `API error: ${apiResponse.status}`,
                    data: null
                });
            }
        } catch (error) {
            results.checks.push({
                name: 'API Verification',
                status: 'error',
                message: `API request failed: ${error.message}`,
                data: null
            });
        }

        // Check 3: Cross-reference with different ID formats
        const alternativeIds = [
            userId.toString(),
            parseInt(userId),
            username, // Some systems might use username as ID
            `json_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}` // JSON fallback format
        ];

        for (const altId of alternativeIds) {
            if (altId !== userId) {
                const altCheck = this.allUsers.some(u => (u.id || u.user_id) == altId);
                if (altCheck) {
                    results.checks.push({
                        name: `Alternative ID Check (${altId})`,
                        status: 'found',
                        message: `User found with alternative ID: ${altId}`,
                        data: { alternativeId: altId }
                    });
                    break;
                }
            }
        }

        return results;
    }

    /**
     * Display verification results
     */
    displayVerificationResults(results, userId, username) {
        const container = document.getElementById('verification-results');

        let html = `
            <div class="mb-3">
                <h6>User Verification Results</h6>
                <div class="row g-3">
                    <div class="col-md-6">
                        <strong>User ID:</strong> ${userId}
                    </div>
                    <div class="col-md-6">
                        <strong>Username:</strong> ${username}
                    </div>
                </div>
            </div>

            <div class="verification-checks">`;

        results.checks.forEach((check, index) => {
            const statusClass = check.status === 'found' ? 'success' :
                check.status === 'not_found' ? 'warning' : 'danger';
            const statusIcon = check.status === 'found' ? 'check-circle' :
                check.status === 'not_found' ? 'exclamation-triangle' : 'times-circle';

            html += `
                <div class="card border-${statusClass} mb-3">
                    <div class="card-body">
                        <div class="d-flex align-items-center">
                            <i class="fas fa-${statusIcon} text-${statusClass} me-3 fa-lg"></i>
                            <div class="flex-grow-1">
                                <h6 class="card-title mb-1">${check.name}</h6>
                                <p class="card-text mb-1">${check.message}</p>
                                ${check.data ? `<small class="text-muted">Details: ${JSON.stringify(check.data)}</small>` : ''}
                            </div>
                        </div>
                    </div>
                </div>`;
        });

        html += `
            </div>

            <div class="mt-3">
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    <strong>Summary:</strong> User verification checks completed.
                    ${results.checks.filter(c => c.status === 'found').length} of ${results.checks.length} checks found the user.
                </div>
            </div>`;

        container.innerHTML = html;
    }

    /**
     * Toggle mapping kompetensi access
     */
    async toggleMappingKompetensiAccess(userId, isChecked, checkboxElement) {
        try {
            console.log('🔄 Toggling mapping kompetensi access for user:', userId, 'to:', isChecked);

            const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mappingKompetensiAccess: isChecked })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('✅ Mapping kompetensi access updated successfully:', result);

                // Update the user in the local array
                const userIndex = this.allUsers.findIndex(u => (u.id || u.user_id) == userId);
                if (userIndex !== -1) {
                    this.allUsers[userIndex].mappingKompetensiAccess = isChecked;
                }

                // Show success feedback
                const originalClass = checkboxElement.className;
                checkboxElement.className = 'form-check-input mapping-access-checkbox bg-success';
                setTimeout(() => {
                    checkboxElement.className = originalClass;
                }, 1000);

            } else {
                const error = await response.json();
                console.error('❌ Failed to update mapping kompetensi access:', error);
                alert('❌ Failed to update access: ' + (error.error || 'Unknown error'));

                // Revert checkbox state
                checkboxElement.checked = !isChecked;
            }

        } catch (error) {
            console.error('❌ Error updating mapping kompetensi access:', error);
            alert('❌ Error updating access: ' + error.message);

            // Revert checkbox state
            checkboxElement.checked = !isChecked;
        }
    }

    /**
     * Export users to CSV
     */
    exportUsers() {
        if (this.allUsers.length === 0) {
            alert('No users to export');
            return;
        }

        // Create CSV content
        const headers = ['ID', 'Username', 'Email', 'BIM Level', 'Job Role', 'Organization', 'Status', 'Registration Date', 'Mapping Kompetensi Access'];
        const csvContent = [
            headers.join(','),
            ...this.allUsers.map(user => [
                user.id || user.user_id,
                user.username || user.name,
                user.email,
                user.bimLevel || user.bim_level,
                user.jobRole || user.job_role,
                user.organization,
                (user.is_active !== undefined ? user.is_active : user.isActive !== undefined ? user.isActive : true) ? 'Active' : 'Inactive',
                user.registrationDate || user.registration_date || user.created_at,
                user.mappingKompetensiAccess ? 'Yes' : 'No'
            ].map(field => `"${field || ''}"`).join(','))
        ].join('\n');

        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bcl-users-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        alert('✅ Users exported successfully!');
    }
}

// Initialize and register the users module immediately when script loads
(function() {
    console.log('👥 Initializing Users Module...');

    // Ensure adminPanel exists
    if (!window.adminPanel) {
        console.error('❌ window.adminPanel not found - users module cannot initialize');
        return;
    }

    // Ensure modules Map exists
    if (!window.adminPanel.modules) {
        console.error('❌ window.adminPanel.modules not found - users module cannot initialize');
        return;
    }

    try {
        // Create users module instance
        const usersModule = new UsersModule(window.adminPanel);

        // Set up the module entry
        window.adminPanel.modules.set('users', {
            loaded: true,
            path: 'modules/users.js',
            instance: usersModule
        });

        // Initialize the module
        usersModule.initialize();

        console.log('✅ Users module initialized and registered successfully');
    } catch (error) {
        console.error('❌ Failed to initialize users module:', error);
    }
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UsersModule;
}
