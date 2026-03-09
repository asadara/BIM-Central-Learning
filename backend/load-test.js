#!/usr/bin/env node

/**
 * BCL Server Load Testing Script
 * Tests server performance with concurrent connections
 */

const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');

class LoadTester {
    constructor(options = {}) {
        this.host = options.host || 'localhost';
        this.port = options.port || 5051;
        this.concurrency = options.concurrency || 20;
        this.duration = options.duration || 30; // seconds
        this.requests = options.requests || 1000;
        this.endpoints = options.endpoints || [
            '/api/tutorials',
            '/api/courses',
            '/api/years',
            '/ping',
            '/api/network-info'
        ];

        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            responseTimes: [],
            errors: {},
            startTime: null,
            endTime: null
        };
    }

    makeRequest(endpoint, callback) {
        const options = {
            hostname: this.host,
            port: this.port,
            path: endpoint,
            method: 'GET',
            headers: {
                'User-Agent': 'BCL-Load-Tester/1.0',
                'Accept': 'application/json',
                'Connection': 'keep-alive'
            }
        };

        const startTime = performance.now();

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                const endTime = performance.now();
                const responseTime = endTime - startTime;

                this.stats.totalRequests++;
                this.stats.responseTimes.push(responseTime);

                if (res.statusCode >= 200 && res.statusCode < 300) {
                    this.stats.successfulRequests++;
                } else {
                    this.stats.failedRequests++;
                    this.stats.errors[res.statusCode] = (this.stats.errors[res.statusCode] || 0) + 1;
                }

                callback(null, {
                    statusCode: res.statusCode,
                    responseTime: responseTime,
                    endpoint: endpoint,
                    dataLength: data.length
                });
            });
        });

        req.on('error', (err) => {
            const endTime = performance.now();
            const responseTime = endTime - startTime;

            this.stats.totalRequests++;
            this.stats.failedRequests++;
            this.stats.responseTimes.push(responseTime);

            const errorType = err.code || 'UNKNOWN_ERROR';
            this.stats.errors[errorType] = (this.stats.errors[errorType] || 0) + 1;

            callback(err, {
                error: errorType,
                responseTime: responseTime,
                endpoint: endpoint
            });
        });

        req.setTimeout(10000, () => {
            req.destroy();
            this.stats.totalRequests++;
            this.stats.failedRequests++;
            this.stats.errors['TIMEOUT'] = (this.stats.errors['TIMEOUT'] || 0) + 1;
            callback(new Error('Request timeout'), { endpoint });
        });

        req.end();
    }

    runLoadTest() {
        return new Promise((resolve, reject) => {
            console.log(`🚀 Starting BCL Load Test`);
            console.log(`📍 Target: http://${this.host}:${this.port}`);
            console.log(`👥 Concurrent Users: ${this.concurrency}`);
            console.log(`⏱️  Duration: ${this.duration} seconds`);
            console.log(`📊 Endpoints: ${this.endpoints.join(', ')}`);
            console.log('='.repeat(60));

            this.stats.startTime = performance.now();
            let completedRequests = 0;
            let activeConnections = 0;
            const maxConnections = this.concurrency;

            const runRequest = () => {
                if (completedRequests >= this.requests) {
                    return;
                }

                if (activeConnections >= maxConnections) {
                    setImmediate(runRequest);
                    return;
                }

                activeConnections++;
                const endpoint = this.endpoints[Math.floor(Math.random() * this.endpoints.length)];

                this.makeRequest(endpoint, (err, result) => {
                    activeConnections--;
                    completedRequests++;

                    if (err) {
                        console.log(`❌ ${endpoint} - ${err.message} (${result?.responseTime?.toFixed(2)}ms)`);
                    } else {
                        console.log(`✅ ${endpoint} - ${result.statusCode} (${result.responseTime.toFixed(2)}ms)`);
                    }

                    if (completedRequests < this.requests) {
                        setImmediate(runRequest);
                    } else if (activeConnections === 0) {
                        this.stats.endTime = performance.now();
                        resolve();
                    }
                });
            };

            // Start initial batch of requests
            for (let i = 0; i < Math.min(maxConnections, this.requests); i++) {
                setImmediate(runRequest);
            }

            // Progress reporting
            const progressInterval = setInterval(() => {
                const elapsed = (performance.now() - this.stats.startTime) / 1000;
                const rps = this.stats.totalRequests / elapsed;

                console.log(`📊 Progress: ${completedRequests}/${this.requests} requests | ${rps.toFixed(1)} req/sec | Active: ${activeConnections}`);
            }, 5000);

            // Auto-stop after duration
            setTimeout(() => {
                clearInterval(progressInterval);
                this.stats.endTime = performance.now();
                console.log('\n⏰ Test duration reached, stopping...');
                resolve();
            }, this.duration * 1000);
        });
    }

    generateReport() {
        const totalTime = (this.stats.endTime - this.stats.startTime) / 1000; // seconds
        const rps = this.stats.totalRequests / totalTime;
        const successRate = (this.stats.successfulRequests / this.stats.totalRequests) * 100;

        // Calculate percentiles
        const sortedTimes = this.stats.responseTimes.sort((a, b) => a - b);
        const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
        const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
        const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];

        console.log('\n' + '='.repeat(60));
        console.log('📊 LOAD TEST RESULTS');
        console.log('='.repeat(60));
        console.log(`⏱️  Total Time: ${totalTime.toFixed(2)} seconds`);
        console.log(`📊 Total Requests: ${this.stats.totalRequests}`);
        console.log(`✅ Successful: ${this.stats.successfulRequests}`);
        console.log(`❌ Failed: ${this.stats.failedRequests}`);
        console.log(`📈 Success Rate: ${successRate.toFixed(2)}%`);
        console.log(`🚀 Requests/sec: ${rps.toFixed(2)}`);

        console.log('\n⏱️  Response Times:');
        console.log(`   Average: ${this.getAverageResponseTime().toFixed(2)}ms`);
        console.log(`   Median (P50): ${p50?.toFixed(2) || 'N/A'}ms`);
        console.log(`   P95: ${p95?.toFixed(2) || 'N/A'}ms`);
        console.log(`   P99: ${p99?.toFixed(2) || 'N/A'}ms`);
        console.log(`   Min: ${Math.min(...this.stats.responseTimes).toFixed(2)}ms`);
        console.log(`   Max: ${Math.max(...this.stats.responseTimes).toFixed(2)}ms`);

        if (Object.keys(this.stats.errors).length > 0) {
            console.log('\n❌ Error Breakdown:');
            Object.entries(this.stats.errors).forEach(([error, count]) => {
                console.log(`   ${error}: ${count}`);
            });
        }

        console.log('\n🏁 ASSESSMENT:');
        if (rps >= 50 && successRate >= 95) {
            console.log('✅ EXCELLENT: Server handles 20 concurrent users very well!');
        } else if (rps >= 30 && successRate >= 90) {
            console.log('👍 GOOD: Server performs adequately for 20 concurrent users');
        } else if (rps >= 20 && successRate >= 80) {
            console.log('⚠️  FAIR: Server may struggle with sustained 20 concurrent users');
        } else {
            console.log('❌ POOR: Server needs optimization for 20 concurrent users');
        }

        return {
            totalTime,
            totalRequests: this.stats.totalRequests,
            successfulRequests: this.stats.successfulRequests,
            failedRequests: this.stats.failedRequests,
            successRate,
            rps,
            avgResponseTime: this.getAverageResponseTime(),
            p50, p95, p99,
            errors: this.stats.errors
        };
    }

    getAverageResponseTime() {
        if (this.stats.responseTimes.length === 0) return 0;
        return this.stats.responseTimes.reduce((sum, time) => sum + time, 0) / this.stats.responseTimes.length;
    }
}

// Command line interface
if (require.main === module) {
    const args = process.argv.slice(2);

    const options = {
        host: process.env.BCL_HOST || 'localhost',
        port: parseInt(process.env.BCL_PORT) || 5051,
        concurrency: parseInt(args[0]) || 20,
        duration: parseInt(args[1]) || 30,
        requests: parseInt(args[2]) || 1000
    };

    console.log('🧪 BCL Load Testing Tool');
    console.log('Usage: node load-test.js [concurrency] [duration_seconds] [max_requests]');
    console.log('Example: node load-test.js 20 30 1000');
    console.log('');

    const tester = new LoadTester(options);

    tester.runLoadTest()
        .then(() => {
            const results = tester.generateReport();

            // Exit with status based on performance
            if (results.successRate >= 95 && results.rps >= 30) {
                console.log('\n✅ Load test PASSED');
                process.exit(0);
            } else {
                console.log('\n❌ Load test FAILED - Server needs optimization');
                process.exit(1);
            }
        })
        .catch((error) => {
            console.error('❌ Load test failed:', error);
            process.exit(1);
        });
}

module.exports = LoadTester;
