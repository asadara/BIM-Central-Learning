// Advanced CDN System - Phase 4
// Intelligent content delivery, adaptive streaming, offline caching, bandwidth optimization, and global content distribution

class AdvancedCDNSystem {
    constructor() {
        this.edgeNodes = new Map();
        this.contentCache = new Map();
        this.bandwidthMonitor = null;
        this.adaptiveStreaming = null;
        this.offlineStorage = null;
        this.contentOptimizer = null;
        this.distributionStrategy = null;
        this.performanceAnalytics = new Map();

        // CDN Configuration
        this.config = {
            enableAdaptiveStreaming: true,
            enableOfflineCaching: true,
            enableBandwidthOptimization: true,
            enableContentOptimization: true,
            enableGlobalDistribution: true,
            cacheStrategy: 'intelligent', // intelligent, aggressive, conservative
            compressionLevel: 'high',
            maxCacheSize: 500 * 1024 * 1024, // 500MB
            cacheTTL: 24 * 60 * 60 * 1000, // 24 hours
            adaptiveQualityLevels: ['240p', '360p', '480p', '720p', '1080p', '4K'],
            bandwidthThresholds: {
                low: 1000000,      // 1Mbps
                medium: 5000000,   // 5Mbps
                high: 25000000,    // 25Mbps
                ultra: 100000000   // 100Mbps
            }
        };

        // Edge Node Locations (simulated global distribution)
        this.edgeLocations = [
            { id: 'us-east-1', region: 'North America East', latency: 0, load: 0 },
            { id: 'us-west-1', region: 'North America West', latency: 0, load: 0 },
            { id: 'eu-west-1', region: 'Europe West', latency: 0, load: 0 },
            { id: 'eu-central-1', region: 'Europe Central', latency: 0, load: 0 },
            { id: 'asia-southeast-1', region: 'Asia Southeast', latency: 0, load: 0 },
            { id: 'asia-east-1', region: 'Asia East', latency: 0, load: 0 },
            { id: 'oceania-1', region: 'Oceania', latency: 0, load: 0 }
        ];

        this.initializeCDN();
    }

    // Initialize Advanced CDN System
    async initializeCDN() {
        try {
            console.log('Initializing Advanced CDN System...');

            // Initialize edge nodes
            await this.initializeEdgeNodes();

            // Setup bandwidth monitoring
            this.setupBandwidthMonitoring();

            // Initialize adaptive streaming
            this.initializeAdaptiveStreaming();

            // Setup offline storage
            await this.setupOfflineStorage();

            // Initialize content optimizer
            this.initializeContentOptimizer();

            // Setup distribution strategy
            this.setupDistributionStrategy();

            // Initialize performance analytics
            this.initializePerformanceAnalytics();

            // Setup service worker for advanced caching
            await this.setupServiceWorker();

            // Create CDN management interface
            this.createCDNInterface();

            console.log('Advanced CDN System initialized successfully');

        } catch (error) {
            console.error('Error initializing CDN system:', error);
            throw error;
        }
    }

    // Initialize Edge Nodes
    async initializeEdgeNodes() {
        for (const location of this.edgeLocations) {
            const edgeNode = {
                id: location.id,
                region: location.region,
                status: 'active',
                cache: new Map(),
                bandwidth: {
                    total: 1000000000, // 1Gbps
                    used: 0,
                    available: 1000000000
                },
                performance: {
                    latency: await this.measureLatency(location.id),
                    throughput: 0,
                    hitRate: 0,
                    errorRate: 0
                },
                connections: 0,
                lastHealthCheck: Date.now(),
                capabilities: {
                    videoStreaming: true,
                    imageOptimization: true,
                    contentCompression: true,
                    adaptiveDelivery: true
                }
            };

            this.edgeNodes.set(location.id, edgeNode);
        }

        console.log('Edge nodes initialized:', this.edgeNodes.size, 'nodes');
    }

    // Setup Bandwidth Monitoring
    setupBandwidthMonitoring() {
        this.bandwidthMonitor = {
            currentBandwidth: 0,
            averageBandwidth: 0,
            peakBandwidth: 0,
            lowBandwidth: Infinity,
            measurements: [],
            isMonitoring: false,

            start: () => {
                this.bandwidthMonitor.isMonitoring = true;
                this.startBandwidthMeasurement();
            },

            stop: () => {
                this.bandwidthMonitor.isMonitoring = false;
            },

            getCurrentLevel: () => {
                return this.getBandwidthLevel(this.bandwidthMonitor.currentBandwidth);
            }
        };

        // Start monitoring
        this.bandwidthMonitor.start();

        console.log('Bandwidth monitoring initialized');
    }

    // Initialize Adaptive Streaming
    initializeAdaptiveStreaming() {
        this.adaptiveStreaming = {
            enabled: this.config.enableAdaptiveStreaming,
            currentQuality: '720p',
            targetQuality: '720p',
            qualityLevels: this.config.adaptiveQualityLevels,
            bitrateLadder: {
                '240p': { width: 426, height: 240, bitrate: 400000 },
                '360p': { width: 640, height: 360, bitrate: 800000 },
                '480p': { width: 854, height: 480, bitrate: 1200000 },
                '720p': { width: 1280, height: 720, bitrate: 2500000 },
                '1080p': { width: 1920, height: 1080, bitrate: 5000000 },
                '4K': { width: 3840, height: 2160, bitrate: 15000000 }
            },
            adaptationHistory: [],
            bufferHealth: {
                level: 0,
                target: 30, // seconds
                min: 5,
                max: 60
            },

            // Adaptive algorithms
            adaptQuality: (bandwidth, bufferLevel) => {
                return this.adaptStreamingQuality(bandwidth, bufferLevel);
            },

            selectOptimalBitrate: (availableBandwidth) => {
                return this.selectOptimalBitrate(availableBandwidth);
            },

            predictBandwidth: (measurements) => {
                return this.predictBandwidth(measurements);
            }
        };

        console.log('Adaptive streaming initialized');
    }

    // Setup Offline Storage
    async setupOfflineStorage() {
        if (!this.config.enableOfflineCaching) return;

        try {
            // Initialize IndexedDB for offline storage
            this.offlineStorage = {
                db: null,
                storeName: 'cdnCache',
                version: 1,
                maxSize: this.config.maxCacheSize,
                currentSize: 0,

                init: async () => {
                    return new Promise((resolve, reject) => {
                        const request = indexedDB.open('AdvancedCDNCache', this.offlineStorage.version);

                        request.onerror = () => reject(request.error);
                        request.onsuccess = () => {
                            this.offlineStorage.db = request.result;
                            resolve(request.result);
                        };

                        request.onupgradeneeded = (event) => {
                            const db = event.target.result;

                            if (!db.objectStoreNames.contains(this.offlineStorage.storeName)) {
                                const store = db.createObjectStore(this.offlineStorage.storeName, {
                                    keyPath: 'url'
                                });
                                store.createIndex('timestamp', 'timestamp', { unique: false });
                                store.createIndex('size', 'size', { unique: false });
                                store.createIndex('contentType', 'contentType', { unique: false });
                            }
                        };
                    });
                },

                store: async (url, data, metadata) => {
                    return this.storeOfflineContent(url, data, metadata);
                },

                retrieve: async (url) => {
                    return this.retrieveOfflineContent(url);
                },

                remove: async (url) => {
                    return this.removeOfflineContent(url);
                },

                clear: async () => {
                    return this.clearOfflineCache();
                },

                getSize: async () => {
                    return this.getOfflineCacheSize();
                }
            };

            await this.offlineStorage.init();
            console.log('Offline storage initialized');

        } catch (error) {
            console.error('Error setting up offline storage:', error);
            this.config.enableOfflineCaching = false;
        }
    }

    // Initialize Content Optimizer
    initializeContentOptimizer() {
        this.contentOptimizer = {
            enabled: this.config.enableContentOptimization,
            strategies: {
                images: {
                    webp: true,
                    avif: true,
                    responsiveImages: true,
                    lazyLoading: true,
                    compressionLevel: 80
                },
                videos: {
                    adaptiveBitrate: true,
                    segmentation: true,
                    preloading: 'metadata',
                    compressionCodec: 'h264'
                },
                text: {
                    minification: true,
                    gzipCompression: true,
                    brotliCompression: true
                },
                fonts: {
                    subset: true,
                    preload: true,
                    display: 'swap'
                }
            },

            optimizeImage: (imageUrl, options) => {
                return this.optimizeImage(imageUrl, options);
            },

            optimizeVideo: (videoUrl, options) => {
                return this.optimizeVideo(videoUrl, options);
            },

            optimizeText: (content, contentType) => {
                return this.optimizeTextContent(content, contentType);
            },

            generateResponsiveImages: (imageUrl, breakpoints) => {
                return this.generateResponsiveImages(imageUrl, breakpoints);
            }
        };

        console.log('Content optimizer initialized');
    }

    // Setup Distribution Strategy
    setupDistributionStrategy() {
        this.distributionStrategy = {
            algorithm: 'intelligent', // round-robin, least-connections, geolocation, intelligent

            selectEdgeNode: (userLocation, contentType, requirements) => {
                return this.selectOptimalEdgeNode(userLocation, contentType, requirements);
            },

            distributeContent: (content, replicationFactor) => {
                return this.distributeContentToEdges(content, replicationFactor);
            },

            balanceLoad: () => {
                this.performLoadBalancing();
            },

            migrateContent: (contentId, sourceNode, targetNode) => {
                return this.migrateContentBetweenNodes(contentId, sourceNode, targetNode);
            },

            updateRouting: (performanceMetrics) => {
                this.updateRoutingTable(performanceMetrics);
            }
        };

        // Start load balancing
        setInterval(() => {
            this.distributionStrategy.balanceLoad();
        }, 30000); // Every 30 seconds

        console.log('Distribution strategy initialized');
    }

    // Initialize Performance Analytics
    initializePerformanceAnalytics() {
        this.performanceAnalytics = {
            metrics: new Map(),
            realTimeData: {
                requestsPerSecond: 0,
                averageLatency: 0,
                cacheHitRate: 0,
                bandwidthUtilization: 0,
                errorRate: 0
            },
            historicalData: [],
            alerts: [],

            recordMetric: (metric, value, timestamp) => {
                this.recordPerformanceMetric(metric, value, timestamp);
            },

            getMetrics: (timeRange) => {
                return this.getPerformanceMetrics(timeRange);
            },

            generateReport: (period) => {
                return this.generatePerformanceReport(period);
            },

            checkThresholds: () => {
                this.checkPerformanceThresholds();
            }
        };

        // Start performance monitoring
        setInterval(() => {
            this.collectPerformanceMetrics();
        }, 5000); // Every 5 seconds

        console.log('Performance analytics initialized');
    }

    // Setup Service Worker
    async setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                // Register service worker for advanced caching
                const registration = await navigator.serviceWorker.register('/cdn-service-worker.js');
                console.log('CDN Service Worker registered:', registration);

                // Create service worker script dynamically
                await this.createServiceWorkerScript();

            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }

    // Content Delivery Methods

    // Deliver Content
    async deliverContent(url, options = {}) {
        try {
            const startTime = performance.now();

            // 1. Check offline cache first
            if (this.config.enableOfflineCaching) {
                const cachedContent = await this.checkOfflineCache(url);
                if (cachedContent && !this.isCacheExpired(cachedContent)) {
                    console.log('Content served from offline cache:', url);
                    this.recordPerformanceMetric('cache_hit', 1, Date.now());
                    return cachedContent.data;
                }
            }

            // 2. Select optimal edge node
            const edgeNode = this.selectOptimalEdgeNode(
                options.userLocation,
                options.contentType,
                options.requirements
            );

            // 3. Check edge cache
            const edgeCache = edgeNode.cache.get(url);
            if (edgeCache && !this.isCacheExpired(edgeCache)) {
                console.log('Content served from edge cache:', edgeNode.id);
                this.recordPerformanceMetric('edge_cache_hit', 1, Date.now());
                return edgeCache.data;
            }

            // 4. Fetch from origin with optimizations
            const optimizedContent = await this.fetchAndOptimizeContent(url, options);

            // 5. Cache content
            await this.cacheContent(url, optimizedContent, edgeNode);

            // 6. Record performance metrics
            const endTime = performance.now();
            this.recordPerformanceMetric('delivery_time', endTime - startTime, Date.now());

            return optimizedContent;

        } catch (error) {
            console.error('Content delivery error:', error);
            this.recordPerformanceMetric('delivery_error', 1, Date.now());
            throw error;
        }
    }

    // Fetch and Optimize Content
    async fetchAndOptimizeContent(url, options) {
        try {
            // Determine content type
            const contentType = this.getContentType(url);

            // Fetch original content
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            let content = await response.arrayBuffer();

            // Apply content optimizations
            if (this.config.enableContentOptimization) {
                content = await this.applyContentOptimizations(content, contentType, options);
            }

            return {
                data: content,
                contentType: contentType,
                size: content.byteLength,
                optimized: true,
                timestamp: Date.now()
            };

        } catch (error) {
            console.error('Error fetching and optimizing content:', error);
            throw error;
        }
    }

    // Apply Content Optimizations
    async applyContentOptimizations(content, contentType, options) {
        switch (contentType) {
            case 'image':
                return await this.optimizeImageContent(content, options);
            case 'video':
                return await this.optimizeVideoContent(content, options);
            case 'text':
                return this.optimizeTextContent(content, contentType);
            default:
                return content;
        }
    }

    // Adaptive Streaming Methods

    // Adapt Streaming Quality
    adaptStreamingQuality(bandwidth, bufferLevel) {
        const currentBitrate = this.adaptiveStreaming.bitrateLadder[this.adaptiveStreaming.currentQuality].bitrate;
        let targetQuality = this.adaptiveStreaming.currentQuality;

        // Buffer-based adaptation
        if (bufferLevel < this.adaptiveStreaming.bufferHealth.min) {
            // Low buffer - decrease quality
            targetQuality = this.getNextLowerQuality(this.adaptiveStreaming.currentQuality);
        } else if (bufferLevel > this.adaptiveStreaming.bufferHealth.target) {
            // Good buffer - consider increasing quality
            const optimalBitrate = this.selectOptimalBitrate(bandwidth);
            targetQuality = this.getBitrateQuality(optimalBitrate);
        }

        // Bandwidth-based validation
        const targetBitrate = this.adaptiveStreaming.bitrateLadder[targetQuality].bitrate;
        if (targetBitrate > bandwidth * 0.8) { // 80% bandwidth utilization limit
            targetQuality = this.getQualityForBandwidth(bandwidth * 0.8);
        }

        // Update quality if changed
        if (targetQuality !== this.adaptiveStreaming.currentQuality) {
            this.adaptiveStreaming.adaptationHistory.push({
                from: this.adaptiveStreaming.currentQuality,
                to: targetQuality,
                reason: bufferLevel < this.adaptiveStreaming.bufferHealth.min ? 'buffer_low' : 'bandwidth_optimal',
                timestamp: Date.now(),
                bandwidth: bandwidth,
                bufferLevel: bufferLevel
            });

            this.adaptiveStreaming.currentQuality = targetQuality;
            console.log(`Quality adapted to ${targetQuality}`, { bandwidth, bufferLevel });
        }

        return targetQuality;
    }

    // Select Optimal Bitrate
    selectOptimalBitrate(availableBandwidth) {
        const qualities = Object.keys(this.adaptiveStreaming.bitrateLadder);
        let selectedQuality = qualities[0]; // Start with lowest quality

        for (const quality of qualities) {
            const bitrate = this.adaptiveStreaming.bitrateLadder[quality].bitrate;
            if (bitrate <= availableBandwidth * 0.8) { // 80% bandwidth utilization
                selectedQuality = quality;
            } else {
                break;
            }
        }

        return this.adaptiveStreaming.bitrateLadder[selectedQuality].bitrate;
    }

    // Predict Bandwidth
    predictBandwidth(measurements) {
        if (measurements.length < 3) {
            return measurements[measurements.length - 1] || 0;
        }

        // Simple moving average with exponential weighting
        const weights = [0.5, 0.3, 0.2]; // Recent measurements have higher weight
        let prediction = 0;

        for (let i = 0; i < Math.min(3, measurements.length); i++) {
            prediction += measurements[measurements.length - 1 - i] * weights[i];
        }

        return prediction;
    }

    // Bandwidth Monitoring Methods

    // Start Bandwidth Measurement
    startBandwidthMeasurement() {
        const measureBandwidth = async () => {
            if (!this.bandwidthMonitor.isMonitoring) return;

            try {
                const bandwidth = await this.measureCurrentBandwidth();

                // Update bandwidth data
                this.bandwidthMonitor.currentBandwidth = bandwidth;
                this.bandwidthMonitor.measurements.push({
                    value: bandwidth,
                    timestamp: Date.now()
                });

                // Keep only last 100 measurements
                if (this.bandwidthMonitor.measurements.length > 100) {
                    this.bandwidthMonitor.measurements.shift();
                }

                // Update statistics
                this.updateBandwidthStatistics();

                // Trigger adaptive quality adjustment
                if (this.adaptiveStreaming.enabled) {
                    const bufferLevel = this.getCurrentBufferLevel();
                    this.adaptStreamingQuality(bandwidth, bufferLevel);
                }

            } catch (error) {
                console.error('Bandwidth measurement error:', error);
            }

            // Schedule next measurement
            setTimeout(measureBandwidth, 2000); // Every 2 seconds
        };

        measureBandwidth();
    }

    // Measure Current Bandwidth
    async measureCurrentBandwidth() {
        try {
            // Use a small test file to measure bandwidth
            const testUrl = '/bandwidth-test.dat?' + Date.now();
            const testSize = 100000; // 100KB test file

            const startTime = performance.now();
            const response = await fetch(testUrl);
            const endTime = performance.now();

            if (response.ok) {
                const duration = (endTime - startTime) / 1000; // Convert to seconds
                const bandwidth = (testSize * 8) / duration; // bits per second

                return Math.max(bandwidth, 0);
            } else {
                // Fallback to connection API if available
                if (navigator.connection && navigator.connection.downlink) {
                    return navigator.connection.downlink * 1000000; // Convert Mbps to bps
                }

                return 5000000; // Default 5Mbps
            }

        } catch (error) {
            console.error('Bandwidth measurement failed:', error);

            // Fallback to connection API
            if (navigator.connection && navigator.connection.downlink) {
                return navigator.connection.downlink * 1000000;
            }

            return 5000000; // Default fallback
        }
    }

    // Cache Management Methods

    // Cache Content
    async cacheContent(url, content, edgeNode) {
        try {
            // Cache in edge node
            edgeNode.cache.set(url, {
                data: content.data,
                metadata: {
                    contentType: content.contentType,
                    size: content.size,
                    timestamp: Date.now(),
                    ttl: this.config.cacheTTL,
                    accessCount: 0,
                    lastAccessed: Date.now()
                }
            });

            // Cache offline if enabled
            if (this.config.enableOfflineCaching) {
                await this.storeOfflineContent(url, content.data, {
                    contentType: content.contentType,
                    size: content.size,
                    timestamp: Date.now()
                });
            }

            console.log('Content cached:', url, 'Size:', this.formatBytes(content.size));

        } catch (error) {
            console.error('Caching error:', error);
        }
    }

    // Store Offline Content
    async storeOfflineContent(url, data, metadata) {
        if (!this.offlineStorage.db) return;

        try {
            const transaction = this.offlineStorage.db.transaction([this.offlineStorage.storeName], 'readwrite');
            const store = transaction.objectStore(this.offlineStorage.storeName);

            const cacheEntry = {
                url: url,
                data: data,
                contentType: metadata.contentType,
                size: metadata.size,
                timestamp: metadata.timestamp,
                ttl: this.config.cacheTTL
            };

            await store.put(cacheEntry);

            // Update cache size
            this.offlineStorage.currentSize += metadata.size;

            // Check size limits
            if (this.offlineStorage.currentSize > this.config.maxCacheSize) {
                await this.evictOldestCache();
            }

        } catch (error) {
            console.error('Offline storage error:', error);
        }
    }

    // Retrieve Offline Content
    async retrieveOfflineContent(url) {
        if (!this.offlineStorage.db) return null;

        try {
            const transaction = this.offlineStorage.db.transaction([this.offlineStorage.storeName], 'readonly');
            const store = transaction.objectStore(this.offlineStorage.storeName);
            const request = store.get(url);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

        } catch (error) {
            console.error('Offline retrieval error:', error);
            return null;
        }
    }

    // Performance Optimization Methods

    // Select Optimal Edge Node
    selectOptimalEdgeNode(userLocation, contentType, requirements) {
        let bestNode = null;
        let bestScore = -Infinity;

        for (const [nodeId, node] of this.edgeNodes.entries()) {
            if (node.status !== 'active') continue;

            let score = 0;

            // Latency score (lower is better)
            score -= node.performance.latency * 0.4;

            // Load score (lower is better)
            const loadRatio = node.connections / 1000; // Normalize load
            score -= loadRatio * 0.3;

            // Bandwidth availability score
            const bandwidthRatio = node.bandwidth.available / node.bandwidth.total;
            score += bandwidthRatio * 0.2;

            // Cache hit rate score
            score += node.performance.hitRate * 0.1;

            // Geolocation bonus (simplified)
            if (userLocation && this.isNodeNearUser(nodeId, userLocation)) {
                score += 10;
            }

            if (score > bestScore) {
                bestScore = score;
                bestNode = node;
            }
        }

        return bestNode || this.edgeNodes.values().next().value;
    }

    // Performance Monitoring

    // Record Performance Metric
    recordPerformanceMetric(metric, value, timestamp) {
        if (!this.performanceAnalytics.metrics.has(metric)) {
            this.performanceAnalytics.metrics.set(metric, []);
        }

        const metrics = this.performanceAnalytics.metrics.get(metric);
        metrics.push({ value, timestamp });

        // Keep only last 1000 measurements per metric
        if (metrics.length > 1000) {
            metrics.shift();
        }

        // Update real-time data
        this.updateRealTimeMetrics();
    }

    // Collect Performance Metrics
    collectPerformanceMetrics() {
        const now = Date.now();

        // Calculate requests per second
        const recentRequests = this.getRecentMetrics('delivery_time', 1000); // Last 1 second
        this.performanceAnalytics.realTimeData.requestsPerSecond = recentRequests.length;

        // Calculate average latency
        const latencies = this.getRecentMetrics('delivery_time', 60000); // Last 1 minute
        if (latencies.length > 0) {
            const avgLatency = latencies.reduce((sum, m) => sum + m.value, 0) / latencies.length;
            this.performanceAnalytics.realTimeData.averageLatency = avgLatency;
        }

        // Calculate cache hit rate
        const cacheHits = this.getRecentMetrics('cache_hit', 60000);
        const edgeCacheHits = this.getRecentMetrics('edge_cache_hit', 60000);
        const totalRequests = this.getRecentMetrics('delivery_time', 60000);

        if (totalRequests.length > 0) {
            const hitRate = (cacheHits.length + edgeCacheHits.length) / totalRequests.length;
            this.performanceAnalytics.realTimeData.cacheHitRate = hitRate;
        }

        // Calculate bandwidth utilization
        if (this.bandwidthMonitor.currentBandwidth > 0) {
            const utilization = this.calculateBandwidthUtilization();
            this.performanceAnalytics.realTimeData.bandwidthUtilization = utilization;
        }

        // Calculate error rate
        const errors = this.getRecentMetrics('delivery_error', 60000);
        if (totalRequests.length > 0) {
            this.performanceAnalytics.realTimeData.errorRate = errors.length / totalRequests.length;
        }
    }

    // UI Creation Methods

    // Create CDN Interface
    createCDNInterface() {
        // CDN Control Panel
        const cdnPanel = document.createElement('div');
        cdnPanel.id = 'cdnControlPanel';
        cdnPanel.className = 'cdn-control-panel';
        cdnPanel.style.cssText = `
            display: none;
            position: fixed;
            top: 20px;
            right: 20px;
            width: 350px;
            background: white;
            border: 2px solid #ddd;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 1000;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;

        // Header
        const header = document.createElement('div');
        header.className = 'cdn-panel-header';
        header.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 15px;
            border-bottom: 1px solid #ddd;
            background: #f8f9fa;
            border-radius: 6px 6px 0 0;
        `;

        const title = document.createElement('h3');
        title.textContent = 'CDN Control Panel';
        title.style.margin = '0';
        title.style.color = '#333';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            border: none;
            background: none;
            font-size: 20px;
            cursor: pointer;
            color: #666;
        `;
        closeBtn.onclick = () => cdnPanel.style.display = 'none';

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Content
        const content = document.createElement('div');
        content.className = 'cdn-panel-content';
        content.style.cssText = `
            padding: 15px;
            max-height: 400px;
            overflow-y: auto;
        `;

        // Performance metrics
        const metricsSection = this.createMetricsSection();
        content.appendChild(metricsSection);

        // Edge nodes status
        const nodesSection = this.createNodesSection();
        content.appendChild(nodesSection);

        // Cache controls
        const cacheSection = this.createCacheSection();
        content.appendChild(cacheSection);

        cdnPanel.appendChild(header);
        cdnPanel.appendChild(content);
        document.body.appendChild(cdnPanel);

        // Add toggle button
        this.createCDNToggleButton();

        // Update panel periodically
        setInterval(() => {
            if (cdnPanel.style.display !== 'none') {
                this.updateCDNInterface();
            }
        }, 2000);
    }

    // Create Metrics Section
    createMetricsSection() {
        const section = document.createElement('div');
        section.className = 'metrics-section';
        section.innerHTML = `
            <h4 style="margin: 0 0 10px 0; color: #007bff;">Performance Metrics</h4>
            <div class="metric-item">
                <span>Requests/sec:</span>
                <span id="rpsValue">0</span>
            </div>
            <div class="metric-item">
                <span>Avg Latency:</span>
                <span id="latencyValue">0ms</span>
            </div>
            <div class="metric-item">
                <span>Cache Hit Rate:</span>
                <span id="hitRateValue">0%</span>
            </div>
            <div class="metric-item">
                <span>Bandwidth:</span>
                <span id="bandwidthValue">0 Mbps</span>
            </div>
            <div class="metric-item">
                <span>Error Rate:</span>
                <span id="errorRateValue">0%</span>
            </div>
        `;

        // Add CSS for metric items
        const style = document.createElement('style');
        style.textContent = `
            .metric-item {
                display: flex;
                justify-content: space-between;
                padding: 5px 0;
                border-bottom: 1px solid #eee;
                font-size: 14px;
            }
            .metric-item:last-child {
                border-bottom: none;
            }
        `;
        document.head.appendChild(style);

        return section;
    }

    // Create Nodes Section
    createNodesSection() {
        const section = document.createElement('div');
        section.className = 'nodes-section';
        section.innerHTML = `
            <h4 style="margin: 15px 0 10px 0; color: #007bff;">Edge Nodes</h4>
            <div id="nodesList"></div>
        `;
        return section;
    }

    // Create Cache Section
    createCacheSection() {
        const section = document.createElement('div');
        section.className = 'cache-section';
        section.innerHTML = `
            <h4 style="margin: 15px 0 10px 0; color: #007bff;">Cache Control</h4>
            <button id="clearCacheBtn" style="
                width: 100%;
                padding: 8px;
                background: #dc3545;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                margin-bottom: 10px;
            ">Clear All Cache</button>
            <div class="cache-stats">
                <div class="metric-item">
                    <span>Cache Size:</span>
                    <span id="cacheSize">0 MB</span>
                </div>
                <div class="metric-item">
                    <span>Cached Items:</span>
                    <span id="cachedItems">0</span>
                </div>
            </div>
        `;

        // Add event listener for clear cache button
        setTimeout(() => {
            document.getElementById('clearCacheBtn').onclick = () => {
                this.clearAllCache();
            };
        }, 100);

        return section;
    }

    // Utility Methods

    // Format Bytes
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Get Content Type
    getContentType(url) {
        const extension = url.split('.').pop().toLowerCase();
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        const videoExtensions = ['mp4', 'webm', 'ogg', 'avi', 'mov'];
        const textExtensions = ['html', 'css', 'js', 'json', 'xml', 'txt'];

        if (imageExtensions.includes(extension)) return 'image';
        if (videoExtensions.includes(extension)) return 'video';
        if (textExtensions.includes(extension)) return 'text';

        return 'other';
    }

    // Measure Latency
    async measureLatency(nodeId) {
        // Simulate latency measurement
        // In real implementation, this would ping the actual edge node
        const baseLatencies = {
            'us-east-1': 50,
            'us-west-1': 80,
            'eu-west-1': 120,
            'eu-central-1': 100,
            'asia-southeast-1': 200,
            'asia-east-1': 250,
            'oceania-1': 300
        };

        const baseLatency = baseLatencies[nodeId] || 100;
        const variation = (Math.random() - 0.5) * 20; // ±10ms variation

        return Math.max(1, baseLatency + variation);
    }

    // Get Bandwidth Level
    getBandwidthLevel(bandwidth) {
        const thresholds = this.config.bandwidthThresholds;

        if (bandwidth >= thresholds.ultra) return 'ultra';
        if (bandwidth >= thresholds.high) return 'high';
        if (bandwidth >= thresholds.medium) return 'medium';
        if (bandwidth >= thresholds.low) return 'low';

        return 'very_low';
    }

    // Update CDN Interface
    updateCDNInterface() {
        const metrics = this.performanceAnalytics.realTimeData;

        // Update metrics
        this.updateElementText('rpsValue', Math.round(metrics.requestsPerSecond));
        this.updateElementText('latencyValue', Math.round(metrics.averageLatency) + 'ms');
        this.updateElementText('hitRateValue', Math.round(metrics.cacheHitRate * 100) + '%');
        this.updateElementText('bandwidthValue',
            Math.round(this.bandwidthMonitor.currentBandwidth / 1000000) + ' Mbps');
        this.updateElementText('errorRateValue', Math.round(metrics.errorRate * 100) + '%');

        // Update nodes list
        this.updateNodesList();

        // Update cache stats
        this.updateCacheStats();
    }

    // Update Element Text
    updateElementText(id, text) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = text;
        }
    }

    // Create CDN Toggle Button
    createCDNToggleButton() {
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'cdnToggle';
        toggleBtn.innerHTML = '📊';
        toggleBtn.title = 'CDN Control Panel';
        toggleBtn.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            border: none;
            border-radius: 50%;
            background: #007bff;
            color: white;
            font-size: 20px;
            cursor: pointer;
            z-index: 999;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
        `;

        toggleBtn.onclick = () => {
            const panel = document.getElementById('cdnControlPanel');
            if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            }
        };

        document.body.appendChild(toggleBtn);
    }

    // Static instance method
    static getInstance() {
        if (!window.advancedCDNInstance) {
            window.advancedCDNInstance = new AdvancedCDNSystem();
        }
        return window.advancedCDNInstance;
    }
}

// Global instance
window.AdvancedCDNSystem = AdvancedCDNSystem;

// Auto-initialize
document.addEventListener('DOMContentLoaded', function () {
    window.advancedCDN = AdvancedCDNSystem.getInstance();
    console.log('Advanced CDN System initialized');
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdvancedCDNSystem;
}