/**
 * Comprehensive API Ecosystem
 * Advanced API management with GraphQL, REST endpoints, webhooks,
 * SDK development, and third-party integrations
 */

class ComprehensiveAPIEcosystem {
    constructor() {
        this.initialized = false;
        this.apiVersion = '1.0.0';
        this.baseURL = window.location.origin + '/api';
        this.graphqlEndpoint = this.baseURL + '/graphql';
        this.restEndpoints = {};
        this.webhookHandlers = new Map();
        this.sdkInstances = new Map();
        this.thirdPartyIntegrations = new Map();
        this.rateLimiter = null;
        this.authManager = null;
        this.documentationGenerator = null;
        this.eventBus = new EventTarget();
        this.requestCache = new Map();
        this.responseInterceptors = [];
        this.requestInterceptors = [];
        this.apiMetrics = {
            requests: 0,
            errors: 0,
            latency: [],
            endpoints: {}
        };
        this.init();
    }

    async init() {
        try {
            console.log('Initializing Comprehensive API Ecosystem...');

            await this.setupAuthManager();
            await this.initializeGraphQLClient();
            await this.setupRESTEndpoints();
            await this.initializeWebhookSystem();
            await this.setupRateLimiting();
            await this.initializeSDKs();
            await this.setupThirdPartyIntegrations();
            await this.initializeDocumentation();
            await this.setupMetricsCollection();

            this.initialized = true;
            console.log('Comprehensive API Ecosystem initialized successfully');

            this.emitEvent('api:initialized', {
                version: this.apiVersion,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Failed to initialize API Ecosystem:', error);
            this.handleError('initialization', error);
        }
    }

    // Authentication Manager
    async setupAuthManager() {
        this.authManager = {
            tokens: new Map(),

            async authenticate(credentials) {
                try {
                    const response = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(credentials)
                    });

                    const data = await response.json();

                    if (data.success) {
                        this.tokens.set('access', data.accessToken);
                        this.tokens.set('refresh', data.refreshToken);
                        localStorage.setItem('api_tokens', JSON.stringify({
                            access: data.accessToken,
                            refresh: data.refreshToken,
                            expires: data.expiresAt
                        }));
                        return { success: true, tokens: data };
                    }

                    return { success: false, error: data.message };

                } catch (error) {
                    return { success: false, error: error.message };
                }
            },

            async refreshToken() {
                try {
                    const refreshToken = this.tokens.get('refresh');
                    if (!refreshToken) throw new Error('No refresh token available');

                    const response = await fetch('/api/auth/refresh', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${refreshToken}`
                        }
                    });

                    const data = await response.json();

                    if (data.success) {
                        this.tokens.set('access', data.accessToken);
                        return data.accessToken;
                    }

                    throw new Error(data.message);

                } catch (error) {
                    console.error('Token refresh failed:', error);
                    return null;
                }
            },

            getAuthHeaders() {
                const token = this.tokens.get('access');
                return token ? { 'Authorization': `Bearer ${token}` } : {};
            },

            logout() {
                this.tokens.clear();
                localStorage.removeItem('api_tokens');
            }
        };

        // Load saved tokens
        const savedTokens = localStorage.getItem('api_tokens');
        if (savedTokens) {
            const tokens = JSON.parse(savedTokens);
            if (new Date(tokens.expires) > new Date()) {
                this.authManager.tokens.set('access', tokens.access);
                this.authManager.tokens.set('refresh', tokens.refresh);
            }
        }
    }

    // GraphQL Client
    async initializeGraphQLClient() {
        this.graphqlClient = {
            endpoint: this.graphqlEndpoint,

            async query(query, variables = {}, options = {}) {
                try {
                    const startTime = performance.now();

                    const headers = {
                        'Content-Type': 'application/json',
                        ...this.parent.authManager.getAuthHeaders(),
                        ...options.headers
                    };

                    const response = await fetch(this.endpoint, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            query,
                            variables,
                            operationName: options.operationName
                        })
                    });

                    const data = await response.json();
                    const latency = performance.now() - startTime;

                    this.parent.recordMetrics('graphql', latency, !data.errors);

                    if (data.errors) {
                        throw new Error(data.errors[0].message);
                    }

                    return data.data;

                } catch (error) {
                    this.parent.handleError('graphql_query', error);
                    throw error;
                }
            },

            async mutation(mutation, variables = {}, options = {}) {
                return await this.query(mutation, variables, options);
            },

            subscription(subscription, variables = {}, callbacks = {}) {
                const ws = new WebSocket(
                    this.endpoint.replace('http', 'ws') + '/subscriptions'
                );

                ws.onopen = () => {
                    ws.send(JSON.stringify({
                        type: 'start',
                        payload: { query: subscription, variables }
                    }));

                    if (callbacks.onConnect) callbacks.onConnect();
                };

                ws.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    if (callbacks.onData) callbacks.onData(data.payload);
                };

                ws.onerror = (error) => {
                    if (callbacks.onError) callbacks.onError(error);
                };

                ws.onclose = () => {
                    if (callbacks.onClose) callbacks.onClose();
                };

                return {
                    unsubscribe: () => ws.close()
                };
            },

            parent: this
        };

        // Define common GraphQL queries
        this.graphqlQueries = {
            getUserProfile: `
                query GetUserProfile($userId: ID!) {
                    user(id: $userId) {
                        id
                        name
                        email
                        profile {
                            avatar
                            bio
                            preferences
                        }
                        enrollments {
                            id
                            course {
                                id
                                title
                                progress
                            }
                            enrolledAt
                            completedAt
                        }
                    }
                }
            `,

            getCourseDetails: `
                query GetCourseDetails($courseId: ID!) {
                    course(id: $courseId) {
                        id
                        title
                        description
                        thumbnail
                        instructor {
                            id
                            name
                            avatar
                        }
                        modules {
                            id
                            title
                            lessons {
                                id
                                title
                                duration
                                type
                            }
                        }
                        analytics {
                            enrollmentCount
                            completionRate
                            averageRating
                        }
                    }
                }
            `,

            createEnrollment: `
                mutation CreateEnrollment($courseId: ID!, $userId: ID!) {
                    createEnrollment(courseId: $courseId, userId: $userId) {
                        id
                        enrolledAt
                        course {
                            id
                            title
                        }
                        user {
                            id
                            name
                        }
                    }
                }
            `,

            updateProgress: `
                mutation UpdateProgress($enrollmentId: ID!, $lessonId: ID!, $progress: Float!) {
                    updateProgress(enrollmentId: $enrollmentId, lessonId: $lessonId, progress: $progress) {
                        id
                        progress
                        completedLessons
                        updatedAt
                    }
                }
            `
        };
    }

    // REST API Endpoints
    async setupRESTEndpoints() {
        this.restAPI = {
            baseURL: this.baseURL,

            async request(endpoint, options = {}) {
                try {
                    const startTime = performance.now();
                    const url = this.baseURL + endpoint;

                    const headers = {
                        'Content-Type': 'application/json',
                        ...this.parent.authManager.getAuthHeaders(),
                        ...options.headers
                    };

                    // Apply request interceptors
                    let requestConfig = { url, ...options, headers };
                    for (const interceptor of this.parent.requestInterceptors) {
                        requestConfig = await interceptor(requestConfig);
                    }

                    const response = await fetch(requestConfig.url, {
                        method: options.method || 'GET',
                        headers: requestConfig.headers,
                        body: options.body ? JSON.stringify(options.body) : undefined
                    });

                    let data = await response.json();
                    const latency = performance.now() - startTime;

                    // Apply response interceptors
                    for (const interceptor of this.parent.responseInterceptors) {
                        data = await interceptor(data, response);
                    }

                    this.parent.recordMetrics(endpoint, latency, response.ok);

                    if (!response.ok) {
                        throw new Error(data.message || 'API request failed');
                    }

                    return data;

                } catch (error) {
                    this.parent.handleError('rest_request', error);
                    throw error;
                }
            },

            async get(endpoint, params = {}) {
                const query = new URLSearchParams(params).toString();
                const url = query ? `${endpoint}?${query}` : endpoint;
                return await this.request(url, { method: 'GET' });
            },

            async post(endpoint, data = {}) {
                return await this.request(endpoint, {
                    method: 'POST',
                    body: data
                });
            },

            async put(endpoint, data = {}) {
                return await this.request(endpoint, {
                    method: 'PUT',
                    body: data
                });
            },

            async patch(endpoint, data = {}) {
                return await this.request(endpoint, {
                    method: 'PATCH',
                    body: data
                });
            },

            async delete(endpoint) {
                return await this.request(endpoint, { method: 'DELETE' });
            },

            parent: this
        };

        // Define REST endpoint configurations
        this.restEndpoints = {
            // User Management
            users: {
                list: '/users',
                get: '/users/:id',
                create: '/users',
                update: '/users/:id',
                delete: '/users/:id',
                profile: '/users/:id/profile'
            },

            // Course Management
            courses: {
                list: '/courses',
                get: '/courses/:id',
                create: '/courses',
                update: '/courses/:id',
                delete: '/courses/:id',
                enroll: '/courses/:id/enroll',
                unenroll: '/courses/:id/unenroll'
            },

            // Content Management
            content: {
                upload: '/content/upload',
                get: '/content/:id',
                update: '/content/:id',
                delete: '/content/:id',
                search: '/content/search'
            },

            // Analytics
            analytics: {
                overview: '/analytics/overview',
                course: '/analytics/courses/:id',
                user: '/analytics/users/:id',
                engagement: '/analytics/engagement',
                performance: '/analytics/performance'
            }
        };
    }

    // Webhook System
    async initializeWebhookSystem() {
        this.webhookSystem = {
            handlers: new Map(),

            register(event, url, options = {}) {
                const webhook = {
                    id: this.generateWebhookId(),
                    event,
                    url,
                    secret: options.secret || this.generateSecret(),
                    active: true,
                    retryPolicy: options.retryPolicy || { maxRetries: 3, backoff: 'exponential' },
                    createdAt: new Date().toISOString()
                };

                this.handlers.set(webhook.id, webhook);
                this.parent.saveWebhooks();

                return webhook;
            },

            async trigger(event, data) {
                const webhooks = Array.from(this.handlers.values())
                    .filter(webhook => webhook.event === event && webhook.active);

                const promises = webhooks.map(webhook =>
                    this.deliverWebhook(webhook, data)
                );

                await Promise.allSettled(promises);
            },

            async deliverWebhook(webhook, data, attempt = 1) {
                try {
                    const payload = {
                        id: this.generateDeliveryId(),
                        event: webhook.event,
                        data,
                        timestamp: new Date().toISOString(),
                        webhook_id: webhook.id
                    };

                    const signature = await this.generateSignature(payload, webhook.secret);

                    const response = await fetch(webhook.url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Webhook-Signature': signature,
                            'X-Webhook-Event': webhook.event,
                            'X-Webhook-Delivery': payload.id
                        },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok && attempt < webhook.retryPolicy.maxRetries) {
                        const delay = this.calculateRetryDelay(attempt, webhook.retryPolicy.backoff);
                        setTimeout(() => {
                            this.deliverWebhook(webhook, data, attempt + 1);
                        }, delay);
                    }

                    return response.ok;

                } catch (error) {
                    console.error('Webhook delivery failed:', error);
                    return false;
                }
            },

            generateWebhookId() {
                return 'wh_' + Math.random().toString(36).substr(2, 9);
            },

            generateDeliveryId() {
                return 'del_' + Math.random().toString(36).substr(2, 9);
            },

            generateSecret() {
                return Array.from(crypto.getRandomValues(new Uint8Array(32)))
                    .map(b => b.toString(16).padStart(2, '0')).join('');
            },

            async generateSignature(payload, secret) {
                const encoder = new TextEncoder();
                const data = encoder.encode(JSON.stringify(payload));
                const key = await crypto.subtle.importKey(
                    'raw',
                    encoder.encode(secret),
                    { name: 'HMAC', hash: 'SHA-256' },
                    false,
                    ['sign']
                );
                const signature = await crypto.subtle.sign('HMAC', key, data);
                return Array.from(new Uint8Array(signature))
                    .map(b => b.toString(16).padStart(2, '0')).join('');
            },

            calculateRetryDelay(attempt, backoff) {
                const baseDelay = 1000; // 1 second
                if (backoff === 'exponential') {
                    return baseDelay * Math.pow(2, attempt - 1);
                }
                return baseDelay;
            },

            unregister(webhookId) {
                return this.handlers.delete(webhookId);
            },

            list() {
                return Array.from(this.handlers.values());
            },

            parent: this
        };
    }

    // Rate Limiting
    async setupRateLimiting() {
        this.rateLimiter = {
            limits: new Map(),
            requests: new Map(),

            setLimit(identifier, maxRequests, windowMs) {
                this.limits.set(identifier, { maxRequests, windowMs });
            },

            checkLimit(identifier) {
                const limit = this.limits.get(identifier);
                if (!limit) return true;

                const now = Date.now();
                const requests = this.requests.get(identifier) || [];

                // Remove old requests outside the window
                const validRequests = requests.filter(
                    timestamp => now - timestamp < limit.windowMs
                );

                if (validRequests.length >= limit.maxRequests) {
                    return false;
                }

                validRequests.push(now);
                this.requests.set(identifier, validRequests);
                return true;
            },

            getRemainingRequests(identifier) {
                const limit = this.limits.get(identifier);
                if (!limit) return Infinity;

                const requests = this.requests.get(identifier) || [];
                const now = Date.now();
                const validRequests = requests.filter(
                    timestamp => now - timestamp < limit.windowMs
                );

                return Math.max(0, limit.maxRequests - validRequests.length);
            },

            getResetTime(identifier) {
                const limit = this.limits.get(identifier);
                const requests = this.requests.get(identifier) || [];

                if (!limit || requests.length === 0) return null;

                const oldestRequest = Math.min(...requests);
                return new Date(oldestRequest + limit.windowMs);
            }
        };

        // Setup default rate limits
        this.rateLimiter.setLimit('global', 1000, 60000); // 1000 requests per minute
        this.rateLimiter.setLimit('auth', 10, 60000); // 10 auth requests per minute
        this.rateLimiter.setLimit('upload', 5, 60000); // 5 uploads per minute
    }

    // SDK Development
    async initializeSDKs() {
        this.sdks = {
            javascript: this.createJavaScriptSDK(),
            python: this.createPythonSDKConfig(),
            php: this.createPHPSDKConfig(),
            node: this.createNodeSDKConfig()
        };
    }

    createJavaScriptSDK() {
        return {
            name: 'BCL JavaScript SDK',
            version: '1.0.0',

            // Core SDK class
            class: class BCLSDK {
                constructor(apiKey, options = {}) {
                    this.apiKey = apiKey;
                    this.baseURL = options.baseURL || window.apiEcosystem.baseURL;
                    this.version = options.version || 'v1';
                }

                async request(endpoint, options = {}) {
                    const headers = {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                        ...options.headers
                    };

                    const response = await fetch(`${this.baseURL}/${this.version}${endpoint}`, {
                        ...options,
                        headers
                    });

                    return await response.json();
                }

                // Course methods
                courses = {
                    list: (params) => this.request('/courses', { method: 'GET', params }),
                    get: (id) => this.request(`/courses/${id}`),
                    create: (data) => this.request('/courses', { method: 'POST', body: data }),
                    update: (id, data) => this.request(`/courses/${id}`, { method: 'PUT', body: data }),
                    delete: (id) => this.request(`/courses/${id}`, { method: 'DELETE' }),
                    enroll: (id, userId) => this.request(`/courses/${id}/enroll`, {
                        method: 'POST',
                        body: { userId }
                    })
                };

                // User methods
                users = {
                    list: (params) => this.request('/users', { method: 'GET', params }),
                    get: (id) => this.request(`/users/${id}`),
                    create: (data) => this.request('/users', { method: 'POST', body: data }),
                    update: (id, data) => this.request(`/users/${id}`, { method: 'PUT', body: data }),
                    delete: (id) => this.request(`/users/${id}`, { method: 'DELETE' })
                };

                // Analytics methods
                analytics = {
                    overview: () => this.request('/analytics/overview'),
                    course: (id) => this.request(`/analytics/courses/${id}`),
                    user: (id) => this.request(`/analytics/users/${id}`)
                };
            },

            // Usage examples
            examples: {
                initialization: `
const bcl = new BCLSDK('your-api-key', {
    baseURL: 'https://api.bclearning.com'
});`,

                courses: `
// List courses
const courses = await bcl.courses.list({ page: 1, limit: 10 });

// Get course details
const course = await bcl.courses.get('course-id');

// Create new course
const newCourse = await bcl.courses.create({
    title: 'New Course',
    description: 'Course description'
});`,

                users: `
// Get user profile
const user = await bcl.users.get('user-id');

// Update user
await bcl.users.update('user-id', {
    name: 'Updated Name'
});`
            }
        };
    }

    createPythonSDKConfig() {
        return {
            name: 'BCL Python SDK',
            version: '1.0.0',
            packageName: 'bcl-sdk',
            description: 'Official Python SDK for BC Learning Platform',
            requirements: ['requests', 'urllib3', 'certifi'],

            structure: {
                'bcl/': {
                    '__init__.py': 'SDK initialization',
                    'client.py': 'Main client class',
                    'models.py': 'Data models',
                    'exceptions.py': 'Custom exceptions',
                    'utils.py': 'Utility functions'
                },
                'tests/': {
                    'test_client.py': 'Client tests',
                    'test_models.py': 'Model tests'
                },
                'setup.py': 'Package setup',
                'README.md': 'Documentation'
            },

            example: `
import bcl

client = bcl.Client(api_key='your-api-key')

# List courses
courses = client.courses.list(page=1, limit=10)

# Get course
course = client.courses.get('course-id')

# Create user
user = client.users.create({
    'name': 'John Doe',
    'email': 'john@example.com'
})`
        };
    }

    createPHPSDKConfig() {
        return {
            name: 'BCL PHP SDK',
            version: '1.0.0',
            packageName: 'bclearning/sdk',
            description: 'Official PHP SDK for BC Learning Platform',
            requirements: ['php: >=7.4', 'guzzlehttp/guzzle: ^7.0'],

            structure: {
                'src/': {
                    'Client.php': 'Main client class',
                    'Models/': 'Data models',
                    'Exceptions/': 'Custom exceptions',
                    'Resources/': 'Resource classes'
                },
                'tests/': 'PHPUnit tests',
                'composer.json': 'Composer configuration'
            },

            example: `
use BCLearning\\SDK\\Client;

$client = new Client('your-api-key');

// List courses
$courses = $client->courses()->list(['page' => 1, 'limit' => 10]);

// Get course
$course = $client->courses()->get('course-id');

// Create user
$user = $client->users()->create([
    'name' => 'John Doe',
    'email' => 'john@example.com'
]);`
        };
    }

    createNodeSDKConfig() {
        return {
            name: 'BCL Node.js SDK',
            version: '1.0.0',
            packageName: '@bclearning/sdk',
            description: 'Official Node.js SDK for BC Learning Platform',
            dependencies: ['axios', 'form-data'],

            structure: {
                'src/': {
                    'index.js': 'Main export',
                    'client.js': 'Client class',
                    'resources/': 'Resource modules',
                    'types/': 'TypeScript definitions'
                },
                'test/': 'Test files',
                'package.json': 'Package configuration'
            },

            example: `
const BCL = require('@bclearning/sdk');

const client = new BCL.Client('your-api-key');

// List courses
const courses = await client.courses.list({ page: 1, limit: 10 });

// Get course
const course = await client.courses.get('course-id');

// Create user
const user = await client.users.create({
    name: 'John Doe',
    email: 'john@example.com'
});`
        };
    }

    // Third-party Integrations
    async setupThirdPartyIntegrations() {
        this.integrations = {
            // Zoom Integration
            zoom: {
                name: 'Zoom',
                type: 'video_conferencing',
                status: 'available',

                async createMeeting(data) {
                    return await this.parent.makeIntegrationRequest('zoom', '/meetings', {
                        method: 'POST',
                        body: {
                            topic: data.title,
                            type: 2, // Scheduled meeting
                            start_time: data.startTime,
                            duration: data.duration,
                            settings: {
                                host_video: true,
                                participant_video: true,
                                join_before_host: false,
                                mute_upon_entry: true
                            }
                        }
                    });
                },

                async getMeeting(meetingId) {
                    return await this.parent.makeIntegrationRequest('zoom', `/meetings/${meetingId}`);
                }
            },

            // Slack Integration
            slack: {
                name: 'Slack',
                type: 'communication',
                status: 'available',

                async sendNotification(channel, message) {
                    return await this.parent.makeIntegrationRequest('slack', '/chat.postMessage', {
                        method: 'POST',
                        body: {
                            channel: channel,
                            text: message.text,
                            attachments: message.attachments
                        }
                    });
                },

                async createChannel(name, purpose) {
                    return await this.parent.makeIntegrationRequest('slack', '/conversations.create', {
                        method: 'POST',
                        body: {
                            name: name,
                            purpose: purpose,
                            is_private: false
                        }
                    });
                }
            },

            // Google Workspace Integration
            google: {
                name: 'Google Workspace',
                type: 'productivity',
                status: 'available',

                async createCalendarEvent(data) {
                    return await this.parent.makeIntegrationRequest('google', '/calendar/v3/calendars/primary/events', {
                        method: 'POST',
                        body: {
                            summary: data.title,
                            description: data.description,
                            start: { dateTime: data.startTime },
                            end: { dateTime: data.endTime },
                            attendees: data.attendees
                        }
                    });
                },

                async createDocument(title, content) {
                    return await this.parent.makeIntegrationRequest('google', '/docs/v1/documents', {
                        method: 'POST',
                        body: {
                            title: title
                        }
                    });
                }
            },

            // Microsoft Teams Integration
            teams: {
                name: 'Microsoft Teams',
                type: 'collaboration',
                status: 'available',

                async createMeeting(data) {
                    return await this.parent.makeIntegrationRequest('teams', '/me/onlineMeetings', {
                        method: 'POST',
                        body: {
                            subject: data.title,
                            startDateTime: data.startTime,
                            endDateTime: data.endTime
                        }
                    });
                },

                async sendMessage(chatId, message) {
                    return await this.parent.makeIntegrationRequest('teams', `/chats/${chatId}/messages`, {
                        method: 'POST',
                        body: {
                            body: {
                                content: message
                            }
                        }
                    });
                }
            }
        };

        this.thirdPartyIntegrations.set('zoom', this.integrations.zoom);
        this.thirdPartyIntegrations.set('slack', this.integrations.slack);
        this.thirdPartyIntegrations.set('google', this.integrations.google);
        this.thirdPartyIntegrations.set('teams', this.integrations.teams);
    }

    async makeIntegrationRequest(integration, endpoint, options = {}) {
        try {
            // This would use stored OAuth tokens for each integration
            const integrationConfig = this.getIntegrationConfig(integration);

            const headers = {
                'Authorization': `Bearer ${integrationConfig.accessToken}`,
                'Content-Type': 'application/json',
                ...options.headers
            };

            const response = await fetch(integrationConfig.baseURL + endpoint, {
                method: options.method || 'GET',
                headers,
                body: options.body ? JSON.stringify(options.body) : undefined
            });

            return await response.json();

        } catch (error) {
            console.error(`${integration} integration request failed:`, error);
            throw error;
        }
    }

    // Documentation Generator
    async initializeDocumentation() {
        this.documentation = {
            generateAPIDocs() {
                return {
                    openapi: '3.0.0',
                    info: {
                        title: 'BC Learning Platform API',
                        version: this.parent.apiVersion,
                        description: 'Comprehensive API for BC Learning Platform'
                    },
                    servers: [
                        { url: this.parent.baseURL, description: 'Production server' }
                    ],
                    paths: this.generatePathDocs(),
                    components: {
                        schemas: this.generateSchemaDocs(),
                        securitySchemes: {
                            bearerAuth: {
                                type: 'http',
                                scheme: 'bearer',
                                bearerFormat: 'JWT'
                            }
                        }
                    }
                };
            },

            generatePathDocs() {
                return {
                    '/courses': {
                        get: {
                            summary: 'List courses',
                            parameters: [
                                {
                                    name: 'page',
                                    in: 'query',
                                    schema: { type: 'integer' }
                                },
                                {
                                    name: 'limit',
                                    in: 'query',
                                    schema: { type: 'integer' }
                                }
                            ],
                            responses: {
                                200: {
                                    description: 'List of courses',
                                    content: {
                                        'application/json': {
                                            schema: {
                                                type: 'object',
                                                properties: {
                                                    courses: {
                                                        type: 'array',
                                                        items: { '$ref': '#/components/schemas/Course' }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        post: {
                            summary: 'Create course',
                            requestBody: {
                                content: {
                                    'application/json': {
                                        schema: { '$ref': '#/components/schemas/CourseInput' }
                                    }
                                }
                            },
                            responses: {
                                201: {
                                    description: 'Course created',
                                    content: {
                                        'application/json': {
                                            schema: { '$ref': '#/components/schemas/Course' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                };
            },

            generateSchemaDocs() {
                return {
                    Course: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            title: { type: 'string' },
                            description: { type: 'string' },
                            instructor: { '$ref': '#/components/schemas/User' },
                            createdAt: { type: 'string', format: 'date-time' }
                        }
                    },
                    User: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            email: { type: 'string', format: 'email' }
                        }
                    },
                    CourseInput: {
                        type: 'object',
                        required: ['title', 'description'],
                        properties: {
                            title: { type: 'string' },
                            description: { type: 'string' },
                            instructorId: { type: 'string' }
                        }
                    }
                };
            },

            parent: this
        };
    }

    // Metrics and Monitoring
    async setupMetricsCollection() {
        this.metricsCollector = {
            enabled: true,

            recordRequest(endpoint, method, statusCode, duration) {
                if (!this.enabled) return;

                const metrics = this.parent.apiMetrics;
                metrics.requests++;

                if (statusCode >= 400) {
                    metrics.errors++;
                }

                metrics.latency.push(duration);

                // Keep only last 1000 latency measurements
                if (metrics.latency.length > 1000) {
                    metrics.latency.shift();
                }

                // Track per-endpoint metrics
                const endpointKey = `${method} ${endpoint}`;
                if (!metrics.endpoints[endpointKey]) {
                    metrics.endpoints[endpointKey] = {
                        requests: 0,
                        errors: 0,
                        averageLatency: 0
                    };
                }

                const endpointMetrics = metrics.endpoints[endpointKey];
                endpointMetrics.requests++;

                if (statusCode >= 400) {
                    endpointMetrics.errors++;
                }

                // Update average latency
                const currentAvg = endpointMetrics.averageLatency;
                const newCount = endpointMetrics.requests;
                endpointMetrics.averageLatency =
                    (currentAvg * (newCount - 1) + duration) / newCount;
            },

            getMetrics() {
                const metrics = this.parent.apiMetrics;
                const totalLatency = metrics.latency.reduce((sum, lat) => sum + lat, 0);

                return {
                    totalRequests: metrics.requests,
                    totalErrors: metrics.errors,
                    errorRate: metrics.requests > 0 ? metrics.errors / metrics.requests : 0,
                    averageLatency: metrics.latency.length > 0 ?
                        totalLatency / metrics.latency.length : 0,
                    endpointMetrics: metrics.endpoints,
                    timestamp: new Date().toISOString()
                };
            },

            reset() {
                this.parent.apiMetrics = {
                    requests: 0,
                    errors: 0,
                    latency: [],
                    endpoints: {}
                };
            },

            parent: this
        };
    }

    // Utility Methods
    recordMetrics(endpoint, latency, success) {
        this.apiMetrics.requests++;
        if (!success) this.apiMetrics.errors++;
        this.apiMetrics.latency.push(latency);

        if (this.apiMetrics.latency.length > 1000) {
            this.apiMetrics.latency.shift();
        }
    }

    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
    }

    addResponseInterceptor(interceptor) {
        this.responseInterceptors.push(interceptor);
    }

    getIntegrationConfig(integration) {
        const configs = this.loadIntegrationConfigs();
        return configs[integration] || {};
    }

    loadIntegrationConfigs() {
        const configs = localStorage.getItem('api_integration_configs');
        return configs ? JSON.parse(configs) : {};
    }

    saveIntegrationConfigs(configs) {
        localStorage.setItem('api_integration_configs', JSON.stringify(configs));
    }

    saveWebhooks() {
        const webhooks = Array.from(this.webhookSystem.handlers.entries());
        localStorage.setItem('api_webhooks', JSON.stringify(webhooks));
    }

    loadWebhooks() {
        const webhooks = localStorage.getItem('api_webhooks');
        if (webhooks) {
            const parsed = JSON.parse(webhooks);
            this.webhookSystem.handlers = new Map(parsed);
        }
    }

    emitEvent(eventType, data) {
        const event = new CustomEvent(eventType, { detail: data });
        this.eventBus.dispatchEvent(event);
    }

    addEventListener(eventType, callback) {
        this.eventBus.addEventListener(eventType, callback);
    }

    handleError(context, error) {
        const errorData = {
            context,
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        };

        console.error('API Ecosystem Error:', errorData);
        this.emitEvent('api:error', errorData);
    }

    // Public API
    getStatus() {
        return {
            initialized: this.initialized,
            version: this.apiVersion,
            authenticated: this.authManager.tokens.has('access'),
            integrations: Array.from(this.thirdPartyIntegrations.keys()),
            webhooks: this.webhookSystem.handlers.size,
            metrics: this.metricsCollector.getMetrics(),
            timestamp: new Date().toISOString()
        };
    }

    destroy() {
        // Clear all intervals and timeouts
        this.webhookSystem.handlers.clear();
        this.thirdPartyIntegrations.clear();
        this.requestInterceptors = [];
        this.responseInterceptors = [];

        console.log('Comprehensive API Ecosystem destroyed');
    }
}

// Global instance
window.ComprehensiveAPIEcosystem = ComprehensiveAPIEcosystem;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.apiEcosystem = new ComprehensiveAPIEcosystem();
    });
} else {
    window.apiEcosystem = new ComprehensiveAPIEcosystem();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ComprehensiveAPIEcosystem;
}