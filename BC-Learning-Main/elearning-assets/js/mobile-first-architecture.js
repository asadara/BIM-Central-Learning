// Mobile-First Architecture - Phase 4
// Progressive Web App, offline capabilities, push notifications, touch gestures, and responsive mobile UI

class MobileFirstArchitecture {
    constructor() {
        this.isInstalled = false;
        this.serviceWorker = null;
        this.pushSubscription = null;
        this.offlineStorage = null;
        this.touchGestures = new Map();
        this.deviceCapabilities = {};
        this.networkStatus = 'online';
        this.syncQueue = [];
        this.appCache = new Map();

        // Mobile-First Configuration
        this.config = {
            enablePWA: true,
            enableOfflineMode: true,
            enablePushNotifications: true,
            enableTouchGestures: true,
            enableServiceWorker: true,
            enableBackgroundSync: true,
            maxOfflineStorage: 100 * 1024 * 1024, // 100MB
            cacheStrategy: 'cache-first', // cache-first, network-first, stale-while-revalidate
            pushServer: {
                vapidPublicKey: 'BEl62iUYgUivxIkv69yViEuiBIa40HI2wAEZtANllPjqnlWtOzaXdI_M0qP3kQQIjZhh-kR-T0X8VVYwQWO3kUI',
                vapidPrivateKey: 'your-vapid-private-key-here'
            },
            responsiveBreakpoints: {
                xs: 0,      // Extra small devices
                sm: 576,    // Small devices
                md: 768,    // Medium devices  
                lg: 992,    // Large devices
                xl: 1200,   // Extra large devices
                xxl: 1400   // Extra extra large devices
            },
            touchSettings: {
                tapThreshold: 10,
                swipeThreshold: 50,
                longPressDelay: 500,
                doubleTapDelay: 300
            }
        };

        this.initializeMobileFirst();
    }

    // Initialize Mobile-First Architecture
    async initializeMobileFirst() {
        try {
            console.log('Initializing Mobile-First Architecture...');

            // Detect device capabilities
            this.detectDeviceCapabilities();

            // Setup responsive design system
            this.setupResponsiveDesign();

            // Initialize Progressive Web App
            if (this.config.enablePWA) {
                await this.initializePWA();
            }

            // Setup Service Worker
            if (this.config.enableServiceWorker) {
                await this.setupServiceWorker();
            }

            // Initialize offline capabilities
            if (this.config.enableOfflineMode) {
                await this.initializeOfflineMode();
            }

            // Setup push notifications
            if (this.config.enablePushNotifications) {
                await this.setupPushNotifications();
            }

            // Initialize touch gestures
            if (this.config.enableTouchGestures) {
                this.setupTouchGestures();
            }

            // Setup network monitoring
            this.setupNetworkMonitoring();

            // Initialize background sync
            if (this.config.enableBackgroundSync) {
                this.setupBackgroundSync();
            }

            // Setup mobile UI optimizations
            this.setupMobileUIOptimizations();

            // Create mobile controls
            this.createMobileControls();

            console.log('Mobile-First Architecture initialized successfully');

        } catch (error) {
            console.error('Error initializing mobile-first architecture:', error);
            throw error;
        }
    }

    // Detect Device Capabilities
    detectDeviceCapabilities() {
        this.deviceCapabilities = {
            // Screen properties
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            pixelRatio: window.devicePixelRatio || 1,
            orientation: this.getOrientation(),

            // Device features
            isMobile: this.isMobileDevice(),
            isTablet: this.isTabletDevice(),
            isDesktop: this.isDesktopDevice(),
            isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,

            // Browser capabilities
            hasServiceWorker: 'serviceWorker' in navigator,
            hasNotificationAPI: 'Notification' in window,
            hasPushAPI: 'PushManager' in window,
            hasIndexedDB: 'indexedDB' in window,
            hasWebGL: this.hasWebGLSupport(),
            hasCamera: this.hasCameraSupport(),
            hasGeolocation: 'geolocation' in navigator,

            // Network capabilities
            connection: navigator.connection || navigator.mozConnection || navigator.webkitConnection,
            onlineStatus: navigator.onLine,

            // Platform detection
            platform: this.detectPlatform(),
            browser: this.detectBrowser(),

            // Performance capabilities
            hardwareConcurrency: navigator.hardwareConcurrency || 4,
            deviceMemory: navigator.deviceMemory || 4
        };

        console.log('Device capabilities detected:', this.deviceCapabilities);
    }

    // Setup Responsive Design System
    setupResponsiveDesign() {
        // Create responsive utilities
        this.responsive = {
            currentBreakpoint: this.getCurrentBreakpoint(),

            // Breakpoint detection
            isXs: () => window.innerWidth < this.config.responsiveBreakpoints.sm,
            isSm: () => window.innerWidth >= this.config.responsiveBreakpoints.sm && window.innerWidth < this.config.responsiveBreakpoints.md,
            isMd: () => window.innerWidth >= this.config.responsiveBreakpoints.md && window.innerWidth < this.config.responsiveBreakpoints.lg,
            isLg: () => window.innerWidth >= this.config.responsiveBreakpoints.lg && window.innerWidth < this.config.responsiveBreakpoints.xl,
            isXl: () => window.innerWidth >= this.config.responsiveBreakpoints.xl,

            // Utility functions
            isMobileSize: () => window.innerWidth < this.config.responsiveBreakpoints.md,
            isTabletSize: () => window.innerWidth >= this.config.responsiveBreakpoints.md && window.innerWidth < this.config.responsiveBreakpoints.lg,
            isDesktopSize: () => window.innerWidth >= this.config.responsiveBreakpoints.lg,

            // Responsive image loading
            loadResponsiveImage: (element, imageSrc) => {
                this.loadResponsiveImage(element, imageSrc);
            },

            // Dynamic CSS classes
            addResponsiveClasses: () => {
                this.addResponsiveClasses();
            }
        };

        // Setup viewport meta tag
        this.setupViewportMeta();

        // Add responsive CSS
        this.addResponsiveCSS();

        // Setup resize listener
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Setup orientation change listener
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleOrientationChange();
            }, 100);
        });

        console.log('Responsive design system setup complete');
    }

    // Initialize Progressive Web App
    async initializePWA() {
        try {
            // Create web app manifest
            await this.createWebAppManifest();

            // Setup app installation
            this.setupAppInstallation();

            // Handle app installation events
            this.handleInstallationEvents();

            console.log('PWA initialized');

        } catch (error) {
            console.error('PWA initialization error:', error);
        }
    }

    // Create Web App Manifest
    async createWebAppManifest() {
        const manifest = {
            name: 'BC Learning Platform',
            short_name: 'BC Learning',
            description: 'Advanced Learning Management System with AI and Collaboration',
            start_url: '/',
            display: 'standalone',
            background_color: '#ffffff',
            theme_color: '#007bff',
            orientation: 'portrait-primary',
            scope: '/',
            lang: 'en',
            categories: ['education', 'productivity', 'learning'],
            screenshots: [
                {
                    src: '/img/screenshot-mobile.png',
                    sizes: '390x844',
                    type: 'image/png',
                    form_factor: 'narrow'
                },
                {
                    src: '/img/screenshot-desktop.png',
                    sizes: '1920x1080',
                    type: 'image/png',
                    form_factor: 'wide'
                }
            ],
            icons: [
                {
                    src: '/img/icon-72x72.png',
                    sizes: '72x72',
                    type: 'image/png',
                    purpose: 'maskable any'
                },
                {
                    src: '/img/icon-96x96.png',
                    sizes: '96x96',
                    type: 'image/png',
                    purpose: 'maskable any'
                },
                {
                    src: '/img/icon-128x128.png',
                    sizes: '128x128',
                    type: 'image/png',
                    purpose: 'maskable any'
                },
                {
                    src: '/img/icon-144x144.png',
                    sizes: '144x144',
                    type: 'image/png',
                    purpose: 'maskable any'
                },
                {
                    src: '/img/icon-152x152.png',
                    sizes: '152x152',
                    type: 'image/png',
                    purpose: 'maskable any'
                },
                {
                    src: '/img/icon-192x192.png',
                    sizes: '192x192',
                    type: 'image/png',
                    purpose: 'maskable any'
                },
                {
                    src: '/img/icon-384x384.png',
                    sizes: '384x384',
                    type: 'image/png',
                    purpose: 'maskable any'
                },
                {
                    src: '/img/icon-512x512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'maskable any'
                }
            ],
            shortcuts: [
                {
                    name: 'My Courses',
                    short_name: 'Courses',
                    description: 'View your enrolled courses',
                    url: '/elearning-assets/courses.html',
                    icons: [{ src: '/img/shortcut-courses.png', sizes: '96x96' }]
                },
                {
                    name: 'Practice',
                    short_name: 'Practice',
                    description: 'Practice exercises and quizzes',
                    url: '/elearning-assets/practice.html',
                    icons: [{ src: '/img/shortcut-practice.png', sizes: '96x96' }]
                },
                {
                    name: 'Profile',
                    short_name: 'Profile',
                    description: 'View your learning profile',
                    url: '/elearning-assets/profile.html',
                    icons: [{ src: '/img/shortcut-profile.png', sizes: '96x96' }]
                }
            ]
        };

        // Create manifest link
        let manifestLink = document.querySelector('link[rel="manifest"]');
        if (!manifestLink) {
            manifestLink = document.createElement('link');
            manifestLink.rel = 'manifest';
            manifestLink.href = 'data:application/json,' + encodeURIComponent(JSON.stringify(manifest));
            document.head.appendChild(manifestLink);
        }

        // Add iOS meta tags
        this.addIOSMetaTags();
    }

    // Setup Service Worker
    async setupServiceWorker() {
        if (!this.deviceCapabilities.hasServiceWorker) {
            console.warn('Service Worker not supported');
            return;
        }

        try {
            // Register service worker
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/'
            });

            this.serviceWorker = registration;

            // Handle service worker updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        this.handleServiceWorkerUpdate();
                    }
                });
            });

            // Create service worker script
            await this.createServiceWorkerScript();

            console.log('Service Worker registered successfully');

        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }

    // Create Service Worker Script
    async createServiceWorkerScript() {
        const swScript = `
// Service Worker for BC Learning Platform
const CACHE_NAME = 'bcl-cache-v1';
const OFFLINE_URL = '/offline.html';

// Files to cache
const CACHE_FILES = [
    '/',
    '/offline.html',
    '/css/style.css',
    '/js/app.js',
    '/img/icon-192x192.png',
    '/img/icon-512x512.png'
];

// Install event
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(CACHE_FILES))
            .then(() => self.skipWaiting())
    );
});

// Activate event
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event
self.addEventListener('fetch', event => {
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => caches.match(OFFLINE_URL))
        );
    } else {
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    return response || fetch(event.request);
                })
                .catch(() => {
                    if (event.request.destination === 'image') {
                        return caches.match('/img/fallback-image.png');
                    }
                })
        );
    }
});

// Background sync
self.addEventListener('sync', event => {
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

// Push notification
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : 'New notification',
        icon: '/img/icon-192x192.png',
        badge: '/img/badge-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'View',
                icon: '/img/checkmark.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/img/xmark.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('BC Learning', options)
    );
});

// Notification click
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

async function doBackgroundSync() {
    // Background sync logic
    const cache = await caches.open(CACHE_NAME);
    // Sync pending data
}
`;

        // In a real implementation, this would be written to a file
        // For demo purposes, we'll store it in a variable
        this.serviceWorkerScript = swScript;
    }

    // Initialize Offline Mode
    async initializeOfflineMode() {
        try {
            // Initialize IndexedDB for offline storage
            this.offlineStorage = {
                db: null,
                version: 1,
                stores: ['courses', 'progress', 'notes', 'media'],

                init: async () => {
                    return new Promise((resolve, reject) => {
                        const request = indexedDB.open('BCLearningOffline', this.offlineStorage.version);

                        request.onerror = () => reject(request.error);
                        request.onsuccess = () => {
                            this.offlineStorage.db = request.result;
                            resolve(request.result);
                        };

                        request.onupgradeneeded = (event) => {
                            const db = event.target.result;

                            // Create object stores
                            this.offlineStorage.stores.forEach(storeName => {
                                if (!db.objectStoreNames.contains(storeName)) {
                                    const store = db.createObjectStore(storeName, {
                                        keyPath: 'id',
                                        autoIncrement: true
                                    });

                                    // Add indexes
                                    store.createIndex('timestamp', 'timestamp', { unique: false });
                                    store.createIndex('userId', 'userId', { unique: false });
                                }
                            });
                        };
                    });
                },

                store: async (storeName, data) => {
                    return this.storeOfflineData(storeName, data);
                },

                retrieve: async (storeName, key) => {
                    return this.retrieveOfflineData(storeName, key);
                },

                getAll: async (storeName) => {
                    return this.getAllOfflineData(storeName);
                },

                clear: async (storeName) => {
                    return this.clearOfflineData(storeName);
                }
            };

            await this.offlineStorage.init();

            // Setup offline content caching
            this.setupOfflineContentCaching();

            // Create offline indicator
            this.createOfflineIndicator();

            console.log('Offline mode initialized');

        } catch (error) {
            console.error('Offline mode initialization error:', error);
        }
    }

    // Setup Push Notifications
    async setupPushNotifications() {
        if (!this.deviceCapabilities.hasNotificationAPI || !this.deviceCapabilities.hasPushAPI) {
            console.warn('Push notifications not supported');
            return;
        }

        try {
            // Request notification permission
            const permission = await Notification.requestPermission();

            if (permission === 'granted') {
                // Subscribe to push notifications
                await this.subscribeToPush();

                // Setup notification handlers
                this.setupNotificationHandlers();

                console.log('Push notifications setup complete');
            } else {
                console.warn('Notification permission denied');
            }

        } catch (error) {
            console.error('Push notification setup error:', error);
        }
    }

    // Subscribe to Push Notifications
    async subscribeToPush() {
        if (!this.serviceWorker) {
            console.warn('Service Worker not available for push subscription');
            return;
        }

        try {
            const subscription = await this.serviceWorker.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(this.config.pushServer.vapidPublicKey)
            });

            this.pushSubscription = subscription;

            // Send subscription to server
            await this.sendSubscriptionToServer(subscription);

            console.log('Push subscription successful');

        } catch (error) {
            console.error('Push subscription error:', error);
        }
    }

    // Setup Touch Gestures
    setupTouchGestures() {
        if (!this.deviceCapabilities.isTouchDevice) {
            console.log('Touch device not detected, skipping touch gestures');
            return;
        }

        this.touchHandler = {
            startX: 0,
            startY: 0,
            endX: 0,
            endY: 0,
            startTime: 0,
            endTime: 0,
            tapCount: 0,
            lastTapTime: 0,

            // Touch events
            handleTouchStart: (event) => {
                this.handleTouchStart(event);
            },

            handleTouchMove: (event) => {
                this.handleTouchMove(event);
            },

            handleTouchEnd: (event) => {
                this.handleTouchEnd(event);
            },

            // Gesture recognition
            recognizeGesture: () => {
                return this.recognizeGesture();
            }
        };

        // Add touch event listeners
        document.addEventListener('touchstart', this.touchHandler.handleTouchStart, { passive: false });
        document.addEventListener('touchmove', this.touchHandler.handleTouchMove, { passive: false });
        document.addEventListener('touchend', this.touchHandler.handleTouchEnd, { passive: false });

        // Add gesture-specific listeners
        this.setupSwipeGestures();
        this.setupPinchGestures();
        this.setupTapGestures();

        console.log('Touch gestures setup complete');
    }

    // Setup Network Monitoring
    setupNetworkMonitoring() {
        // Network status detection
        const updateNetworkStatus = () => {
            this.networkStatus = navigator.onLine ? 'online' : 'offline';
            this.handleNetworkStatusChange();
        };

        window.addEventListener('online', updateNetworkStatus);
        window.addEventListener('offline', updateNetworkStatus);

        // Connection quality monitoring
        if (this.deviceCapabilities.connection) {
            const connection = this.deviceCapabilities.connection;

            const updateConnectionInfo = () => {
                this.connectionInfo = {
                    effectiveType: connection.effectiveType,
                    downlink: connection.downlink,
                    rtt: connection.rtt,
                    saveData: connection.saveData
                };

                this.handleConnectionChange();
            };

            connection.addEventListener('change', updateConnectionInfo);
            updateConnectionInfo(); // Initial call
        }

        console.log('Network monitoring setup complete');
    }

    // Setup Background Sync
    setupBackgroundSync() {
        if (!this.serviceWorker) {
            console.warn('Service Worker not available for background sync');
            return;
        }

        this.backgroundSync = {
            queue: [],

            register: async (tag, data) => {
                try {
                    await this.serviceWorker.sync.register(tag);
                    this.backgroundSync.queue.push({ tag, data, timestamp: Date.now() });
                    console.log('Background sync registered:', tag);
                } catch (error) {
                    console.error('Background sync registration failed:', error);
                }
            },

            process: () => {
                // Process sync queue when online
                if (this.networkStatus === 'online' && this.backgroundSync.queue.length > 0) {
                    this.processBackgroundSync();
                }
            }
        };

        console.log('Background sync setup complete');
    }

    // Setup Mobile UI Optimizations
    setupMobileUIOptimizations() {
        // Add mobile-specific CSS classes
        document.body.classList.add('mobile-optimized');

        if (this.deviceCapabilities.isMobile) {
            document.body.classList.add('mobile-device');
        }

        if (this.deviceCapabilities.isTablet) {
            document.body.classList.add('tablet-device');
        }

        if (this.deviceCapabilities.isTouchDevice) {
            document.body.classList.add('touch-device');
        }

        // Optimize input elements for mobile
        this.optimizeInputElements();

        // Setup virtual keyboard handling
        this.setupVirtualKeyboardHandling();

        // Optimize scrolling
        this.optimizeScrolling();

        // Setup pull-to-refresh
        this.setupPullToRefresh();

        console.log('Mobile UI optimizations applied');
    }

    // Touch Gesture Handlers

    // Handle Touch Start
    handleTouchStart(event) {
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            this.touchHandler.startX = touch.clientX;
            this.touchHandler.startY = touch.clientY;
            this.touchHandler.startTime = Date.now();
        }
    }

    // Handle Touch Move
    handleTouchMove(event) {
        // Prevent default scrolling if needed
        if (this.shouldPreventDefault(event)) {
            event.preventDefault();
        }
    }

    // Handle Touch End
    handleTouchEnd(event) {
        if (event.changedTouches.length === 1) {
            const touch = event.changedTouches[0];
            this.touchHandler.endX = touch.clientX;
            this.touchHandler.endY = touch.clientY;
            this.touchHandler.endTime = Date.now();

            const gesture = this.touchHandler.recognizeGesture();
            if (gesture) {
                this.handleGesture(gesture, event);
            }
        }
    }

    // Recognize Gesture
    recognizeGesture() {
        const deltaX = this.touchHandler.endX - this.touchHandler.startX;
        const deltaY = this.touchHandler.endY - this.touchHandler.startY;
        const deltaTime = this.touchHandler.endTime - this.touchHandler.startTime;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Tap detection
        if (distance < this.config.touchSettings.tapThreshold && deltaTime < this.config.touchSettings.longPressDelay) {
            const now = Date.now();

            if (now - this.touchHandler.lastTapTime < this.config.touchSettings.doubleTapDelay) {
                this.touchHandler.tapCount++;
            } else {
                this.touchHandler.tapCount = 1;
            }

            this.touchHandler.lastTapTime = now;

            if (this.touchHandler.tapCount === 2) {
                this.touchHandler.tapCount = 0;
                return { type: 'doubletap', x: this.touchHandler.endX, y: this.touchHandler.endY };
            }

            return { type: 'tap', x: this.touchHandler.endX, y: this.touchHandler.endY };
        }

        // Long press detection
        if (distance < this.config.touchSettings.tapThreshold && deltaTime >= this.config.touchSettings.longPressDelay) {
            return { type: 'longpress', x: this.touchHandler.endX, y: this.touchHandler.endY };
        }

        // Swipe detection
        if (distance >= this.config.touchSettings.swipeThreshold) {
            const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
            let direction;

            if (angle >= -45 && angle <= 45) {
                direction = 'right';
            } else if (angle >= 45 && angle <= 135) {
                direction = 'down';
            } else if (angle >= -135 && angle <= -45) {
                direction = 'up';
            } else {
                direction = 'left';
            }

            return {
                type: 'swipe',
                direction: direction,
                distance: distance,
                deltaX: deltaX,
                deltaY: deltaY
            };
        }

        return null;
    }

    // Handle Gesture
    handleGesture(gesture, event) {
        // Dispatch custom gesture event
        const gestureEvent = new CustomEvent('gesture', {
            detail: {
                type: gesture.type,
                gesture: gesture,
                originalEvent: event
            }
        });

        event.target.dispatchEvent(gestureEvent);

        // Handle specific gestures
        switch (gesture.type) {
            case 'swipe':
                this.handleSwipeGesture(gesture, event);
                break;
            case 'tap':
                this.handleTapGesture(gesture, event);
                break;
            case 'doubletap':
                this.handleDoubleTapGesture(gesture, event);
                break;
            case 'longpress':
                this.handleLongPressGesture(gesture, event);
                break;
        }
    }

    // Swipe Gesture Handler
    handleSwipeGesture(gesture, event) {
        // Global swipe actions
        switch (gesture.direction) {
            case 'left':
                // Navigate forward or show next content
                this.handleSwipeLeft(event);
                break;
            case 'right':
                // Navigate back or show previous content
                this.handleSwipeRight(event);
                break;
            case 'up':
                // Refresh content or show more options
                this.handleSwipeUp(event);
                break;
            case 'down':
                // Pull to refresh
                this.handleSwipeDown(event);
                break;
        }
    }

    // UI Optimization Methods

    // Optimize Input Elements
    optimizeInputElements() {
        const inputs = document.querySelectorAll('input, textarea, select');

        inputs.forEach(input => {
            // Add mobile-friendly attributes
            if (input.type === 'email') {
                input.autocomplete = 'email';
                input.inputMode = 'email';
            } else if (input.type === 'tel') {
                input.inputMode = 'tel';
            } else if (input.type === 'number') {
                input.inputMode = 'numeric';
            } else if (input.type === 'search') {
                input.inputMode = 'search';
            }

            // Add touch-friendly styling
            input.style.fontSize = '16px'; // Prevent zoom on iOS
            input.style.minHeight = '44px'; // Touch target size
        });
    }

    // Setup Virtual Keyboard Handling
    setupVirtualKeyboardHandling() {
        let initialViewportHeight = window.innerHeight;

        const handleViewportChange = () => {
            const currentHeight = window.innerHeight;
            const heightDiff = initialViewportHeight - currentHeight;

            if (heightDiff > 150) {
                // Virtual keyboard is likely open
                document.body.classList.add('keyboard-open');
                this.handleKeyboardOpen(heightDiff);
            } else {
                // Virtual keyboard is likely closed
                document.body.classList.remove('keyboard-open');
                this.handleKeyboardClose();
            }
        };

        window.addEventListener('resize', handleViewportChange);

        // Visual Viewport API (if supported)
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleViewportChange);
        }
    }

    // Create Mobile Controls
    createMobileControls() {
        // Mobile navigation menu
        const mobileNav = document.createElement('div');
        mobileNav.id = 'mobileNavigation';
        mobileNav.className = 'mobile-navigation';
        mobileNav.style.cssText = `
            display: none;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 60px;
            background: white;
            border-top: 1px solid #ddd;
            z-index: 1000;
            display: flex;
            justify-content: space-around;
            align-items: center;
            box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
        `;

        // Navigation items
        const navItems = [
            { icon: '🏠', label: 'Home', action: () => this.navigateToHome() },
            { icon: '📚', label: 'Courses', action: () => this.navigateToCourses() },
            { icon: '💬', label: 'Chat', action: () => this.openChat() },
            { icon: '👤', label: 'Profile', action: () => this.navigateToProfile() },
            { icon: '⚙️', label: 'Settings', action: () => this.openSettings() }
        ];

        navItems.splice(0, navItems.length,
            { icon: 'HOME', label: 'Home', action: () => this.navigateToHome() },
            { icon: 'USER', label: 'Profil', action: () => this.navigateToProfile() },
            { icon: 'FAV', label: 'Fav', action: () => this.navigateToFavorites() },
            { icon: 'FIND', label: 'Search', action: () => this.navigateToSearch() },
            { icon: 'SET', label: 'Setting', action: () => this.openSettings() }
        );

        navItems.forEach(item => {
            const navItem = document.createElement('button');
            navItem.className = 'mobile-nav-item';
            navItem.innerHTML = `
                <span class="nav-icon">${item.icon}</span>
                <span class="nav-label">${item.label}</span>
            `;
            navItem.style.cssText = `
                flex: 1;
                border: none;
                background: none;
                padding: 8px;
                text-align: center;
                cursor: pointer;
                font-size: 12px;
                color: #666;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2px;
            `;

            navItem.onclick = item.action;
            mobileNav.appendChild(navItem);
        });

        // Show mobile navigation on mobile devices
        if (this.deviceCapabilities.isMobile) {
            mobileNav.style.display = 'flex';
            document.body.style.paddingBottom = '60px';
        }

        document.body.appendChild(mobileNav);

        // Install prompt button
        this.createInstallPrompt();

        // Mobile quick actions
        this.createQuickActions();
    }

    // Create Install Prompt
    createInstallPrompt() {
        const installBtn = document.createElement('button');
        installBtn.id = 'installPrompt';
        installBtn.className = 'install-prompt';
        installBtn.textContent = '📱 Install App';
        installBtn.style.cssText = `
            display: none;
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 10px 15px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 20px;
            font-size: 14px;
            cursor: pointer;
            z-index: 1001;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;

        installBtn.onclick = () => this.promptInstall();
        document.body.appendChild(installBtn);
    }

    getElearningPageUrl(pageName) {
        return `/elearning-assets/${pageName}`;
    }

    navigateToPath(path) {
        if (!path || typeof path !== 'string') {
            return;
        }

        window.location.href = path;
    }

    navigateToHome() {
        this.navigateToPath(this.getElearningPageUrl('home.html'));
    }

    navigateToCourses() {
        this.navigateToPath(this.getElearningPageUrl('courses.html'));
    }

    navigateToProfile() {
        this.navigateToPath(this.getElearningPageUrl('profile.html'));
    }

    navigateToFavorites() {
        this.navigateToPath(this.getElearningPageUrl('favorites.html'));
    }

    navigateToSearch() {
        const currentPath = window.location.pathname || '';
        if (currentPath.endsWith('/search.html')) {
            const searchTarget = document.querySelector('#searchInput, input[type="search"], input[name="search_box"]');
            if (searchTarget && typeof searchTarget.focus === 'function') {
                searchTarget.focus();
                return;
            }
        }

        this.navigateToPath(this.getElearningPageUrl('search.html'));
    }

    openChat() {
        this.navigateToFavorites();
    }

    openSettings() {
        this.navigateToPath(this.getElearningPageUrl('update.html'));
    }

    // Utility Methods

    // Device Detection
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            (window.innerWidth <= 768);
    }

    isTabletDevice() {
        return /iPad|Android/i.test(navigator.userAgent) &&
            window.innerWidth > 768 && window.innerWidth <= 1024;
    }

    isDesktopDevice() {
        return !this.isMobileDevice() && !this.isTabletDevice();
    }

    // Get Current Orientation
    getOrientation() {
        if (screen.orientation) {
            return screen.orientation.angle === 0 || screen.orientation.angle === 180 ? 'portrait' : 'landscape';
        } else {
            return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
        }
    }

    // Get Current Breakpoint
    getCurrentBreakpoint() {
        const width = window.innerWidth;

        if (width >= this.config.responsiveBreakpoints.xxl) return 'xxl';
        if (width >= this.config.responsiveBreakpoints.xl) return 'xl';
        if (width >= this.config.responsiveBreakpoints.lg) return 'lg';
        if (width >= this.config.responsiveBreakpoints.md) return 'md';
        if (width >= this.config.responsiveBreakpoints.sm) return 'sm';
        return 'xs';
    }

    // Add Responsive CSS
    addResponsiveCSS() {
        const style = document.createElement('style');
        style.textContent = `
            /* Mobile-First Responsive CSS */
            
            /* Base mobile styles */
            * {
                box-sizing: border-box;
            }
            
            html {
                -webkit-text-size-adjust: 100%;
                -ms-text-size-adjust: 100%;
            }
            
            body {
                margin: 0;
                padding: 0;
                overflow-x: hidden;
            }
            
            /* Touch-friendly interactive elements */
            .touch-device button,
            .touch-device .btn,
            .touch-device .clickable {
                min-height: 44px;
                min-width: 44px;
                padding: 12px 16px;
            }
            
            /* Mobile navigation */
            .mobile-navigation {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
            }
            
            .mobile-nav-item:hover {
                background: rgba(0, 123, 255, 0.1);
                border-radius: 8px;
            }
            
            /* Responsive utilities */
            @media (max-width: 576px) {
                .d-sm-none { display: none !important; }
                .container { padding: 0 15px; }
            }
            
            @media (max-width: 768px) {
                .d-md-none { display: none !important; }
                .mobile-hide { display: none !important; }
                .mobile-show { display: block !important; }
            }
            
            @media (min-width: 769px) {
                .mobile-only { display: none !important; }
                .desktop-show { display: block !important; }
            }
            
            /* Virtual keyboard adjustments */
            .keyboard-open .fixed-bottom {
                bottom: 0 !important;
            }
            
            /* Pull to refresh */
            .pull-to-refresh {
                transform: translateY(0);
                transition: transform 0.3s ease;
            }
            
            .pull-to-refresh.pulling {
                transform: translateY(60px);
            }
            
            /* Install prompt */
            .install-prompt:hover {
                background: #0056b3;
                transform: scale(1.05);
            }
            
            /* Offline indicator */
            .offline-indicator {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: #ffc107;
                color: #000;
                text-align: center;
                padding: 8px;
                font-size: 14px;
                z-index: 1002;
                transform: translateY(-100%);
                transition: transform 0.3s ease;
            }
            
            .offline-indicator.show {
                transform: translateY(0);
            }
        `;

        document.head.appendChild(style);
    }

    // Static instance method
    static getInstance() {
        if (!window.mobileFirstArchitectureInstance) {
            window.mobileFirstArchitectureInstance = new MobileFirstArchitecture();
        }
        return window.mobileFirstArchitectureInstance;
    }
}

// Global instance
window.MobileFirstArchitecture = MobileFirstArchitecture;

// Auto-initialize
document.addEventListener('DOMContentLoaded', function () {
    window.mobileFirstArchitecture = MobileFirstArchitecture.getInstance();
    console.log('Mobile-First Architecture initialized');
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileFirstArchitecture;
}
