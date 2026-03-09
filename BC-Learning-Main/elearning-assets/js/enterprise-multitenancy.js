// Enterprise Multi-tenancy System - Phase 4
// Role-based access control, organization management, white-labeling, SSO integration, and advanced security architecture

class EnterpriseMultiTenancySystem {
    constructor() {
        this.tenants = new Map();
        this.organizations = new Map();
        this.users = new Map();
        this.roles = new Map();
        this.permissions = new Map();
        this.sessions = new Map();
        this.securityPolicies = new Map();
        this.auditLogs = [];
        this.ssoProviders = new Map();

        // Multi-tenancy Configuration
        this.config = {
            tenantIsolation: 'strict', // strict, moderate, shared
            maxTenantsPerInstance: 1000,
            defaultTenantQuotas: {
                users: 100,
                storage: 10 * 1024 * 1024 * 1024, // 10GB
                bandwidth: 100 * 1024 * 1024, // 100MB/month
                apiCalls: 100000, // per month
                customDomains: 1
            },
            securityLevel: 'enterprise', // basic, standard, enterprise
            enableWhiteLabeling: true,
            enableSSO: true,
            enableAuditLogging: true,
            sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours
            passwordPolicy: {
                minLength: 8,
                requireUppercase: true,
                requireLowercase: true,
                requireNumbers: true,
                requireSpecialChars: true,
                maxAge: 90 * 24 * 60 * 60 * 1000 // 90 days
            }
        };

        // Default Roles and Permissions
        this.initializeRoleSystem();
        this.initializeMultiTenancy();
    }

    // Initialize Multi-tenancy System
    async initializeMultiTenancy() {
        try {
            console.log('Initializing Enterprise Multi-tenancy System...');

            // Initialize security framework
            await this.initializeSecurityFramework();

            // Setup tenant management
            this.setupTenantManagement();

            // Initialize organization management
            this.initializeOrganizationManagement();

            // Setup role-based access control
            this.setupRoleBasedAccessControl();

            // Initialize SSO providers
            await this.initializeSSOProviders();

            // Setup white-labeling
            this.setupWhiteLabeling();

            // Initialize audit system
            this.initializeAuditSystem();

            // Create management interfaces
            this.createMultiTenancyInterface();

            // Setup middleware
            this.setupSecurityMiddleware();

            console.log('Enterprise Multi-tenancy System initialized successfully');

        } catch (error) {
            console.error('Error initializing multi-tenancy system:', error);
            throw error;
        }
    }

    // Initialize Role System
    initializeRoleSystem() {
        // System-wide roles
        const systemRoles = [
            {
                id: 'super_admin',
                name: 'Super Administrator',
                description: 'Full system access across all tenants',
                level: 100,
                scope: 'system',
                permissions: ['*']
            },
            {
                id: 'system_admin',
                name: 'System Administrator',
                description: 'System-level administration',
                level: 90,
                scope: 'system',
                permissions: [
                    'manage_tenants',
                    'view_system_metrics',
                    'manage_system_settings',
                    'view_audit_logs'
                ]
            }
        ];

        // Tenant-level roles
        const tenantRoles = [
            {
                id: 'tenant_admin',
                name: 'Tenant Administrator',
                description: 'Full tenant administration',
                level: 80,
                scope: 'tenant',
                permissions: [
                    'manage_organization',
                    'manage_users',
                    'manage_roles',
                    'view_analytics',
                    'manage_settings',
                    'manage_billing',
                    'manage_domains'
                ]
            },
            {
                id: 'org_admin',
                name: 'Organization Administrator',
                description: 'Organization-level administration',
                level: 70,
                scope: 'organization',
                permissions: [
                    'manage_org_users',
                    'manage_org_content',
                    'view_org_analytics',
                    'manage_org_settings'
                ]
            },
            {
                id: 'instructor',
                name: 'Instructor',
                description: 'Course instruction and management',
                level: 60,
                scope: 'organization',
                permissions: [
                    'create_courses',
                    'manage_courses',
                    'view_student_progress',
                    'grade_assignments',
                    'manage_class_content'
                ]
            },
            {
                id: 'student',
                name: 'Student',
                description: 'Learning and course participation',
                level: 10,
                scope: 'organization',
                permissions: [
                    'access_courses',
                    'submit_assignments',
                    'view_progress',
                    'participate_discussions'
                ]
            }
        ];

        // Store roles
        [...systemRoles, ...tenantRoles].forEach(role => {
            this.roles.set(role.id, role);
        });

        console.log('Role system initialized with', this.roles.size, 'roles');
    }

    // Initialize Security Framework
    async initializeSecurityFramework() {
        this.securityFramework = {
            encryption: {
                algorithm: 'AES-GCM',
                keyLength: 256,
                ivLength: 12,
                tagLength: 16
            },

            hashing: {
                algorithm: 'PBKDF2',
                iterations: 100000,
                saltLength: 32,
                keyLength: 64
            },

            jwt: {
                algorithm: 'RS256',
                issuer: 'bcl-enterprise',
                audience: 'bcl-users',
                expiresIn: '8h'
            },

            csrf: {
                enabled: true,
                tokenLength: 32,
                sameSite: 'strict'
            },

            rateLimit: {
                windowMs: 15 * 60 * 1000, // 15 minutes
                maxRequests: 100,
                skipSuccessfulRequests: false
            }
        };

        // Initialize cryptographic keys
        await this.initializeCryptographicKeys();

        console.log('Security framework initialized');
    }

    // Setup Tenant Management
    setupTenantManagement() {
        this.tenantManager = {
            create: async (tenantData) => {
                return this.createTenant(tenantData);
            },

            update: async (tenantId, updates) => {
                return this.updateTenant(tenantId, updates);
            },

            delete: async (tenantId) => {
                return this.deleteTenant(tenantId);
            },

            suspend: async (tenantId, reason) => {
                return this.suspendTenant(tenantId, reason);
            },

            activate: async (tenantId) => {
                return this.activateTenant(tenantId);
            },

            getQuotaUsage: (tenantId) => {
                return this.getTenantQuotaUsage(tenantId);
            },

            enforceQuotas: (tenantId) => {
                return this.enforceTenantQuotas(tenantId);
            },

            isolateData: (tenantId, operation, data) => {
                return this.isolateTenantData(tenantId, operation, data);
            }
        };

        console.log('Tenant management setup complete');
    }

    // Initialize Organization Management
    initializeOrganizationManagement() {
        this.organizationManager = {
            create: async (tenantId, orgData) => {
                return this.createOrganization(tenantId, orgData);
            },

            update: async (orgId, updates) => {
                return this.updateOrganization(orgId, updates);
            },

            delete: async (orgId) => {
                return this.deleteOrganization(orgId);
            },

            addUser: async (orgId, userId, roleId) => {
                return this.addUserToOrganization(orgId, userId, roleId);
            },

            removeUser: async (orgId, userId) => {
                return this.removeUserFromOrganization(orgId, userId);
            },

            updateUserRole: async (orgId, userId, roleId) => {
                return this.updateUserRoleInOrganization(orgId, userId, roleId);
            },

            getHierarchy: (orgId) => {
                return this.getOrganizationHierarchy(orgId);
            },

            managePermissions: (orgId, permissions) => {
                return this.manageOrganizationPermissions(orgId, permissions);
            }
        };

        console.log('Organization management initialized');
    }

    // Setup Role-Based Access Control
    setupRoleBasedAccessControl() {
        this.rbac = {
            checkPermission: (userId, resource, action, context = {}) => {
                return this.checkUserPermission(userId, resource, action, context);
            },

            assignRole: async (userId, roleId, scope, scopeId) => {
                return this.assignUserRole(userId, roleId, scope, scopeId);
            },

            revokeRole: async (userId, roleId, scope, scopeId) => {
                return this.revokeUserRole(userId, roleId, scope, scopeId);
            },

            getUserRoles: (userId, scope = null) => {
                return this.getUserRoles(userId, scope);
            },

            getUserPermissions: (userId, scope = null) => {
                return this.getUserPermissions(userId, scope);
            },

            createCustomRole: async (tenantId, roleData) => {
                return this.createCustomRole(tenantId, roleData);
            },

            updateRole: async (roleId, updates) => {
                return this.updateRole(roleId, updates);
            },

            deleteRole: async (roleId) => {
                return this.deleteRole(roleId);
            }
        };

        // Setup permission middleware
        this.setupPermissionMiddleware();

        console.log('RBAC system setup complete');
    }

    // Initialize SSO Providers
    async initializeSSOProviders() {
        if (!this.config.enableSSO) return;

        // SAML 2.0 Provider
        this.ssoProviders.set('saml', {
            type: 'saml',
            name: 'SAML 2.0',
            enabled: true,
            config: {
                entryPoint: '',
                issuer: 'bcl-enterprise',
                cert: '',
                signatureAlgorithm: 'sha256'
            },

            authenticate: async (tenantId, samlResponse) => {
                return this.authenticateViaSAML(tenantId, samlResponse);
            },

            generateMetadata: (tenantId) => {
                return this.generateSAMLMetadata(tenantId);
            }
        });

        // OAuth 2.0 / OpenID Connect Provider
        this.ssoProviders.set('oauth', {
            type: 'oauth',
            name: 'OAuth 2.0 / OpenID Connect',
            enabled: true,
            config: {
                clientId: '',
                clientSecret: '',
                authorizationURL: '',
                tokenURL: '',
                userInfoURL: '',
                scope: 'openid profile email'
            },

            authenticate: async (tenantId, authCode) => {
                return this.authenticateViaOAuth(tenantId, authCode);
            },

            refreshToken: async (refreshToken) => {
                return this.refreshOAuthToken(refreshToken);
            }
        });

        // LDAP/Active Directory Provider
        this.ssoProviders.set('ldap', {
            type: 'ldap',
            name: 'LDAP / Active Directory',
            enabled: true,
            config: {
                host: '',
                port: 389,
                baseDN: '',
                bindDN: '',
                bindPassword: '',
                searchFilter: '(uid={{username}})',
                tlsEnabled: true
            },

            authenticate: async (tenantId, username, password) => {
                return this.authenticateViaLDAP(tenantId, username, password);
            },

            syncUsers: async (tenantId) => {
                return this.syncLDAPUsers(tenantId);
            }
        });

        console.log('SSO providers initialized:', this.ssoProviders.size, 'providers');
    }

    // Setup White-labeling
    setupWhiteLabeling() {
        if (!this.config.enableWhiteLabeling) return;

        this.whiteLabelManager = {
            themes: new Map(),
            brandingAssets: new Map(),
            customDomains: new Map(),

            setTheme: async (tenantId, themeConfig) => {
                return this.setTenantTheme(tenantId, themeConfig);
            },

            uploadBrandingAsset: async (tenantId, assetType, file) => {
                return this.uploadBrandingAsset(tenantId, assetType, file);
            },

            configureDomain: async (tenantId, domain, config) => {
                return this.configureTenantDomain(tenantId, domain, config);
            },

            generateCSS: (tenantId) => {
                return this.generateTenantCSS(tenantId);
            },

            applyBranding: (tenantId, element) => {
                return this.applyTenantBranding(tenantId, element);
            }
        };

        // Default theme structure
        this.defaultTheme = {
            colors: {
                primary: '#007bff',
                secondary: '#6c757d',
                success: '#28a745',
                danger: '#dc3545',
                warning: '#ffc107',
                info: '#17a2b8',
                light: '#f8f9fa',
                dark: '#343a40'
            },
            fonts: {
                primary: 'Segoe UI, sans-serif',
                secondary: 'Arial, sans-serif',
                monospace: 'Consolas, monospace'
            },
            layout: {
                headerHeight: '60px',
                sidebarWidth: '250px',
                borderRadius: '4px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }
        };

        console.log('White-labeling system setup complete');
    }

    // Initialize Audit System
    initializeAuditSystem() {
        if (!this.config.enableAuditLogging) return;

        this.auditSystem = {
            log: (event, details) => {
                this.logAuditEvent(event, details);
            },

            search: (criteria) => {
                return this.searchAuditLogs(criteria);
            },

            export: (format, criteria) => {
                return this.exportAuditLogs(format, criteria);
            },

            cleanup: (retentionDays) => {
                return this.cleanupAuditLogs(retentionDays);
            },

            generateReport: (period, tenantId) => {
                return this.generateAuditReport(period, tenantId);
            }
        };

        // Audit event types
        this.auditEventTypes = [
            'user_login',
            'user_logout',
            'user_created',
            'user_updated',
            'user_deleted',
            'role_assigned',
            'role_revoked',
            'permission_granted',
            'permission_denied',
            'tenant_created',
            'tenant_updated',
            'tenant_suspended',
            'organization_created',
            'organization_updated',
            'data_access',
            'configuration_changed',
            'security_incident'
        ];

        console.log('Audit system initialized');
    }

    // Tenant Management Methods

    // Create Tenant
    async createTenant(tenantData) {
        try {
            const tenantId = this.generateTenantId();

            const tenant = {
                id: tenantId,
                name: tenantData.name,
                slug: tenantData.slug || this.generateSlug(tenantData.name),
                status: 'active',
                plan: tenantData.plan || 'basic',
                quotas: { ...this.config.defaultTenantQuotas, ...tenantData.quotas },
                usage: {
                    users: 0,
                    storage: 0,
                    bandwidth: 0,
                    apiCalls: 0
                },
                settings: {
                    timezone: tenantData.timezone || 'UTC',
                    language: tenantData.language || 'en',
                    dateFormat: tenantData.dateFormat || 'YYYY-MM-DD',
                    currency: tenantData.currency || 'USD'
                },
                security: {
                    passwordPolicy: { ...this.config.passwordPolicy },
                    sessionTimeout: this.config.sessionTimeout,
                    mfaRequired: tenantData.mfaRequired || false,
                    ipWhitelist: tenantData.ipWhitelist || [],
                    ssoEnabled: tenantData.ssoEnabled || false
                },
                whiteLabel: {
                    enabled: this.config.enableWhiteLabeling,
                    theme: { ...this.defaultTheme },
                    customDomain: null,
                    brandingAssets: {}
                },
                createdAt: Date.now(),
                updatedAt: Date.now(),
                createdBy: tenantData.createdBy
            };

            // Store tenant
            this.tenants.set(tenantId, tenant);

            // Create default organization
            await this.createDefaultOrganization(tenantId, tenantData);

            // Create tenant admin user
            if (tenantData.adminUser) {
                await this.createTenantAdmin(tenantId, tenantData.adminUser);
            }

            // Log audit event
            this.auditSystem.log('tenant_created', {
                tenantId: tenantId,
                tenantName: tenant.name,
                createdBy: tenantData.createdBy,
                timestamp: Date.now()
            });

            console.log('Tenant created:', tenantId);
            return { success: true, tenantId: tenantId, tenant: tenant };

        } catch (error) {
            console.error('Error creating tenant:', error);
            throw error;
        }
    }

    // Update Tenant
    async updateTenant(tenantId, updates) {
        try {
            const tenant = this.tenants.get(tenantId);
            if (!tenant) {
                throw new Error('Tenant not found');
            }

            // Validate updates
            const validUpdates = this.validateTenantUpdates(updates);

            // Apply updates
            Object.keys(validUpdates).forEach(key => {
                if (typeof tenant[key] === 'object' && tenant[key] !== null) {
                    tenant[key] = { ...tenant[key], ...validUpdates[key] };
                } else {
                    tenant[key] = validUpdates[key];
                }
            });

            tenant.updatedAt = Date.now();

            // Log audit event
            this.auditSystem.log('tenant_updated', {
                tenantId: tenantId,
                updates: Object.keys(validUpdates),
                updatedBy: updates.updatedBy,
                timestamp: Date.now()
            });

            return { success: true, tenant: tenant };

        } catch (error) {
            console.error('Error updating tenant:', error);
            throw error;
        }
    }

    // User Authentication and Authorization

    // Authenticate User
    async authenticateUser(credentials, tenantId = null) {
        try {
            let user = null;
            let authMethod = 'local';

            // Determine authentication method
            if (credentials.ssoProvider && tenantId) {
                const tenant = this.tenants.get(tenantId);
                if (tenant && tenant.security.ssoEnabled) {
                    user = await this.authenticateViaSSO(tenantId, credentials);
                    authMethod = credentials.ssoProvider;
                }
            } else {
                user = await this.authenticateViaLocal(credentials, tenantId);
            }

            if (!user) {
                throw new Error('Authentication failed');
            }

            // Check user status
            if (user.status !== 'active') {
                throw new Error('User account is not active');
            }

            // Check tenant status
            if (tenantId) {
                const tenant = this.tenants.get(tenantId);
                if (!tenant || tenant.status !== 'active') {
                    throw new Error('Tenant is not active');
                }
            }

            // Generate session
            const session = await this.createUserSession(user, tenantId, authMethod);

            // Log audit event
            this.auditSystem.log('user_login', {
                userId: user.id,
                tenantId: tenantId,
                authMethod: authMethod,
                ipAddress: credentials.ipAddress,
                userAgent: credentials.userAgent,
                timestamp: Date.now()
            });

            return {
                success: true,
                user: this.sanitizeUser(user),
                session: session,
                permissions: await this.getUserPermissions(user.id, tenantId)
            };

        } catch (error) {
            // Log failed authentication
            this.auditSystem.log('user_login_failed', {
                email: credentials.email,
                tenantId: tenantId,
                reason: error.message,
                ipAddress: credentials.ipAddress,
                timestamp: Date.now()
            });

            console.error('Authentication error:', error);
            throw error;
        }
    }

    // Check User Permission
    checkUserPermission(userId, resource, action, context = {}) {
        try {
            const user = this.users.get(userId);
            if (!user) {
                return false;
            }

            // Get user roles for the context
            const userRoles = this.getUserRoles(userId, context.scope);

            // Check each role's permissions
            for (const roleAssignment of userRoles) {
                const role = this.roles.get(roleAssignment.roleId);
                if (!role) continue;

                // Check if role has wildcard permission
                if (role.permissions.includes('*')) {
                    return true;
                }

                // Check specific permission
                const permission = `${resource}:${action}`;
                if (role.permissions.includes(permission)) {
                    // Additional context-based checks
                    if (this.checkContextualPermission(roleAssignment, context)) {
                        return true;
                    }
                }
            }

            // Log permission denial
            this.auditSystem.log('permission_denied', {
                userId: userId,
                resource: resource,
                action: action,
                context: context,
                timestamp: Date.now()
            });

            return false;

        } catch (error) {
            console.error('Permission check error:', error);
            return false;
        }
    }

    // Organization Management Methods

    // Create Organization
    async createOrganization(tenantId, orgData) {
        try {
            const tenant = this.tenants.get(tenantId);
            if (!tenant) {
                throw new Error('Tenant not found');
            }

            const orgId = this.generateOrganizationId();

            const organization = {
                id: orgId,
                tenantId: tenantId,
                name: orgData.name,
                description: orgData.description || '',
                type: orgData.type || 'department', // department, school, company, etc.
                parentId: orgData.parentId || null,
                children: [],
                settings: {
                    allowSubOrganizations: orgData.allowSubOrganizations || true,
                    maxUsers: orgData.maxUsers || 1000,
                    customFields: orgData.customFields || {}
                },
                metadata: {
                    address: orgData.address || {},
                    contact: orgData.contact || {},
                    timezone: orgData.timezone || tenant.settings.timezone
                },
                status: 'active',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                createdBy: orgData.createdBy
            };

            // Handle parent-child relationship
            if (orgData.parentId) {
                const parent = this.organizations.get(orgData.parentId);
                if (parent && parent.tenantId === tenantId) {
                    parent.children.push(orgId);
                }
            }

            this.organizations.set(orgId, organization);

            // Log audit event
            this.auditSystem.log('organization_created', {
                organizationId: orgId,
                tenantId: tenantId,
                organizationName: organization.name,
                createdBy: orgData.createdBy,
                timestamp: Date.now()
            });

            return { success: true, organizationId: orgId, organization: organization };

        } catch (error) {
            console.error('Error creating organization:', error);
            throw error;
        }
    }

    // White-labeling Methods

    // Set Tenant Theme
    async setTenantTheme(tenantId, themeConfig) {
        try {
            const tenant = this.tenants.get(tenantId);
            if (!tenant) {
                throw new Error('Tenant not found');
            }

            if (!tenant.whiteLabel.enabled) {
                throw new Error('White-labeling not enabled for this tenant');
            }

            // Validate theme configuration
            const validatedTheme = this.validateThemeConfig(themeConfig);

            // Merge with existing theme
            tenant.whiteLabel.theme = {
                ...tenant.whiteLabel.theme,
                ...validatedTheme
            };

            tenant.updatedAt = Date.now();

            // Generate CSS
            const css = this.generateTenantCSS(tenantId);

            // Store theme CSS
            this.whiteLabelManager.themes.set(tenantId, css);

            return { success: true, theme: tenant.whiteLabel.theme, css: css };

        } catch (error) {
            console.error('Error setting tenant theme:', error);
            throw error;
        }
    }

    // Generate Tenant CSS
    generateTenantCSS(tenantId) {
        const tenant = this.tenants.get(tenantId);
        if (!tenant || !tenant.whiteLabel.enabled) {
            return '';
        }

        const theme = tenant.whiteLabel.theme;

        return `
            /* Tenant-specific CSS for ${tenant.name} */
            :root {
                --primary-color: ${theme.colors.primary};
                --secondary-color: ${theme.colors.secondary};
                --success-color: ${theme.colors.success};
                --danger-color: ${theme.colors.danger};
                --warning-color: ${theme.colors.warning};
                --info-color: ${theme.colors.info};
                --light-color: ${theme.colors.light};
                --dark-color: ${theme.colors.dark};
                
                --font-primary: ${theme.fonts.primary};
                --font-secondary: ${theme.fonts.secondary};
                --font-monospace: ${theme.fonts.monospace};
                
                --header-height: ${theme.layout.headerHeight};
                --sidebar-width: ${theme.layout.sidebarWidth};
                --border-radius: ${theme.layout.borderRadius};
                --box-shadow: ${theme.layout.boxShadow};
            }
            
            .btn-primary {
                background-color: var(--primary-color);
                border-color: var(--primary-color);
            }
            
            .navbar-brand,
            .nav-link {
                font-family: var(--font-primary);
            }
            
            .card {
                border-radius: var(--border-radius);
                box-shadow: var(--box-shadow);
            }
            
            /* Custom tenant styles */
            ${tenant.whiteLabel.customCSS || ''}
        `;
    }

    // Security and Audit Methods

    // Log Audit Event
    logAuditEvent(eventType, details) {
        if (!this.config.enableAuditLogging) return;

        const auditEvent = {
            id: this.generateAuditId(),
            type: eventType,
            timestamp: Date.now(),
            details: details,
            ipAddress: details.ipAddress || 'unknown',
            userAgent: details.userAgent || 'unknown',
            sessionId: details.sessionId || null
        };

        this.auditLogs.push(auditEvent);

        // Keep only last 10000 audit logs in memory
        if (this.auditLogs.length > 10000) {
            this.auditLogs.shift();
        }

        // In production, persist to database
        this.persistAuditEvent(auditEvent);
    }

    // Search Audit Logs
    searchAuditLogs(criteria) {
        let results = [...this.auditLogs];

        // Filter by date range
        if (criteria.startDate) {
            results = results.filter(log => log.timestamp >= criteria.startDate);
        }
        if (criteria.endDate) {
            results = results.filter(log => log.timestamp <= criteria.endDate);
        }

        // Filter by event type
        if (criteria.eventType) {
            results = results.filter(log => log.type === criteria.eventType);
        }

        // Filter by tenant
        if (criteria.tenantId) {
            results = results.filter(log => log.details.tenantId === criteria.tenantId);
        }

        // Filter by user
        if (criteria.userId) {
            results = results.filter(log => log.details.userId === criteria.userId);
        }

        // Sort by timestamp (newest first)
        results.sort((a, b) => b.timestamp - a.timestamp);

        // Pagination
        const page = criteria.page || 1;
        const limit = criteria.limit || 50;
        const offset = (page - 1) * limit;

        return {
            total: results.length,
            page: page,
            limit: limit,
            results: results.slice(offset, offset + limit)
        };
    }

    // UI Creation Methods

    // Create Multi-tenancy Interface
    createMultiTenancyInterface() {
        // Tenant Management Panel
        const tenantPanel = document.createElement('div');
        tenantPanel.id = 'tenantManagementPanel';
        tenantPanel.className = 'tenant-management-panel';
        tenantPanel.style.cssText = `
            display: none;
            position: fixed;
            top: 20px;
            left: 20px;
            width: 400px;
            height: 600px;
            background: white;
            border: 2px solid #ddd;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 1000;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            overflow: hidden;
        `;

        // Header
        const header = document.createElement('div');
        header.className = 'tenant-panel-header';
        header.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 15px;
            border-bottom: 1px solid #ddd;
            background: #f8f9fa;
        `;

        const title = document.createElement('h3');
        title.textContent = 'Tenant Management';
        title.style.cssText = 'margin: 0; color: #333;';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            border: none;
            background: none;
            font-size: 20px;
            cursor: pointer;
            color: #666;
        `;
        closeBtn.onclick = () => tenantPanel.style.display = 'none';

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Content
        const content = document.createElement('div');
        content.className = 'tenant-panel-content';
        content.style.cssText = `
            padding: 15px;
            height: calc(100% - 90px);
            overflow-y: auto;
        `;

        // Tenant list
        const tenantList = this.createTenantList();
        content.appendChild(tenantList);

        // Organization management
        const orgManagement = this.createOrganizationManagement();
        content.appendChild(orgManagement);

        // Security settings
        const securitySettings = this.createSecuritySettings();
        content.appendChild(securitySettings);

        tenantPanel.appendChild(header);
        tenantPanel.appendChild(content);
        document.body.appendChild(tenantPanel);

        // Add toggle button
        this.createTenantToggleButton();

        // Update panel periodically
        setInterval(() => {
            if (tenantPanel.style.display !== 'none') {
                this.updateTenantInterface();
            }
        }, 5000);
    }

    // Create Tenant List
    createTenantList() {
        const section = document.createElement('div');
        section.className = 'tenant-list-section';
        section.innerHTML = `
            <h4 style="margin: 0 0 15px 0; color: #007bff;">Active Tenants</h4>
            <div id="tenantsList" class="tenants-list"></div>
            <button id="createTenantBtn" style="
                width: 100%;
                padding: 10px;
                background: #28a745;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                margin-top: 10px;
                font-size: 14px;
            ">Create New Tenant</button>
        `;

        // Add event listener for create tenant button
        setTimeout(() => {
            document.getElementById('createTenantBtn').onclick = () => {
                this.showCreateTenantModal();
            };
        }, 100);

        return section;
    }

    // Create Organization Management
    createOrganizationManagement() {
        const section = document.createElement('div');
        section.className = 'org-management-section';
        section.innerHTML = `
            <h4 style="margin: 20px 0 15px 0; color: #007bff;">Organizations</h4>
            <div id="organizationsList" class="organizations-list"></div>
            <button id="createOrgBtn" style="
                width: 100%;
                padding: 10px;
                background: #17a2b8;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                margin-top: 10px;
                font-size: 14px;
            ">Create Organization</button>
        `;

        return section;
    }

    // Create Security Settings
    createSecuritySettings() {
        const section = document.createElement('div');
        section.className = 'security-settings-section';
        section.innerHTML = `
            <h4 style="margin: 20px 0 15px 0; color: #007bff;">Security</h4>
            <div class="security-metrics">
                <div class="metric-item">
                    <span>Active Sessions:</span>
                    <span id="activeSessionsCount">0</span>
                </div>
                <div class="metric-item">
                    <span>Failed Logins (24h):</span>
                    <span id="failedLoginsCount">0</span>
                </div>
                <div class="metric-item">
                    <span>Security Incidents:</span>
                    <span id="securityIncidentsCount">0</span>
                </div>
            </div>
            <button id="viewAuditLogsBtn" style="
                width: 100%;
                padding: 10px;
                background: #6f42c1;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                margin-top: 10px;
                font-size: 14px;
            ">View Audit Logs</button>
        `;

        return section;
    }

    // Utility Methods

    // Generate unique IDs
    generateTenantId() {
        return 'tenant_' + Math.random().toString(36).substr(2, 12) + '_' + Date.now();
    }

    generateOrganizationId() {
        return 'org_' + Math.random().toString(36).substr(2, 12) + '_' + Date.now();
    }

    generateUserId() {
        return 'user_' + Math.random().toString(36).substr(2, 12) + '_' + Date.now();
    }

    generateAuditId() {
        return 'audit_' + Math.random().toString(36).substr(2, 12) + '_' + Date.now();
    }

    // Generate slug from name
    generateSlug(name) {
        return name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    // Sanitize user data for frontend
    sanitizeUser(user) {
        const { password, passwordHash, ...sanitized } = user;
        return sanitized;
    }

    // Create tenant toggle button
    createTenantToggleButton() {
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'tenantToggle';
        toggleBtn.innerHTML = '🏢';
        toggleBtn.title = 'Tenant Management';
        toggleBtn.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            width: 50px;
            height: 50px;
            border: none;
            border-radius: 50%;
            background: #6f42c1;
            color: white;
            font-size: 20px;
            cursor: pointer;
            z-index: 999;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
        `;

        toggleBtn.onclick = () => {
            const panel = document.getElementById('tenantManagementPanel');
            if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            }
        };

        document.body.appendChild(toggleBtn);
    }

    // Static instance method
    static getInstance() {
        if (!window.enterpriseMultiTenancyInstance) {
            window.enterpriseMultiTenancyInstance = new EnterpriseMultiTenancySystem();
        }
        return window.enterpriseMultiTenancyInstance;
    }
}

// Global instance
window.EnterpriseMultiTenancySystem = EnterpriseMultiTenancySystem;

// Auto-initialize
document.addEventListener('DOMContentLoaded', function () {
    window.enterpriseMultiTenancy = EnterpriseMultiTenancySystem.getInstance();
    console.log('Enterprise Multi-tenancy System initialized');
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnterpriseMultiTenancySystem;
}