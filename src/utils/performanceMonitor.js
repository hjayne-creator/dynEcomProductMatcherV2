class PerformanceMonitor {
    constructor() {
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            totalResponseTime: 0,
            methodUsage: {
                axios: 0,
                puppeteer: 0,
                zyte: 0
            },
            cacheHits: {
                serp: 0,
                image: 0
            },
            cacheMisses: {
                serp: 0,
                image: 0
            },
            startTime: Date.now()
        };
        
        this.requestTimes = [];
        this.maxRequestTimes = 100; // Keep last 100 request times
    }

    // Record a request start
    startRequest() {
        this.metrics.totalRequests++;
        return Date.now();
    }

    // Record a request completion
    endRequest(startTime, success = true, method = null) {
        const duration = Date.now() - startTime;
        
        if (success) {
            this.metrics.successfulRequests++;
        } else {
            this.metrics.failedRequests++;
        }

        // Update response time metrics
        this.metrics.totalResponseTime += duration;
        this.metrics.averageResponseTime = this.metrics.totalResponseTime / this.metrics.totalRequests;

        // Store request time for percentile calculations
        this.requestTimes.push(duration);
        if (this.requestTimes.length > this.maxRequestTimes) {
            this.requestTimes.shift();
        }

        // Record method usage
        if (method && this.metrics.methodUsage.hasOwnProperty(method)) {
            this.metrics.methodUsage[method]++;
        }
    }

    // Record cache hit/miss
    recordCacheEvent(type, hit) {
        if (this.metrics.cacheHits.hasOwnProperty(type) && this.metrics.cacheMisses.hasOwnProperty(type)) {
            if (hit) {
                this.metrics.cacheHits[type]++;
            } else {
                this.metrics.cacheMisses[type]++;
            }
        }
    }

    // Get performance summary
    getSummary() {
        const uptime = Date.now() - this.metrics.startTime;
        const successRate = this.metrics.totalRequests > 0 
            ? (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(2)
            : 0;

        // Calculate percentiles
        const sortedTimes = [...this.requestTimes].sort((a, b) => a - b);
        const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)] || 0;
        const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
        const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0;

        return {
            uptime: {
                total: uptime,
                formatted: this.formatDuration(uptime)
            },
            requests: {
                total: this.metrics.totalRequests,
                successful: this.metrics.successfulRequests,
                failed: this.metrics.failedRequests,
                successRate: `${successRate}%`
            },
            performance: {
                averageResponseTime: this.formatDuration(this.metrics.averageResponseTime),
                p50: this.formatDuration(p50),
                p95: this.formatDuration(p95),
                p99: this.formatDuration(p99)
            },
            methodUsage: this.metrics.methodUsage,
            cache: {
                serp: {
                    hits: this.metrics.cacheHits.serp,
                    misses: this.metrics.cacheMisses.serp,
                    hitRate: this.getCacheHitRate('serp')
                },
                image: {
                    hits: this.metrics.cacheHits.image,
                    misses: this.metrics.cacheMisses.image,
                    hitRate: this.getCacheHitRate('image')
                }
            }
        };
    }

    // Get cache hit rate for a specific type
    getCacheHitRate(type) {
        const hits = this.metrics.cacheHits[type] || 0;
        const misses = this.metrics.cacheMisses[type] || 0;
        const total = hits + misses;
        
        return total > 0 ? `${(hits / total * 100).toFixed(2)}%` : '0%';
    }

    // Format duration in human-readable format
    formatDuration(ms) {
        if (ms < 1000) return `${ms.toFixed(0)}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
        return `${(ms / 60000).toFixed(2)}m`;
    }

    // Reset all metrics
    reset() {
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            totalResponseTime: 0,
            methodUsage: {
                axios: 0,
                puppeteer: 0,
                zyte: 0
            },
            cacheHits: {
                serp: 0,
                image: 0
            },
            cacheMisses: {
                serp: 0,
                image: 0
            },
            startTime: Date.now()
        };
        this.requestTimes = [];
        console.log('[PERFORMANCE] Metrics reset');
    }

    // Log current performance summary
    logSummary() {
        const summary = this.getSummary();
        console.log('\n📊 Performance Summary:');
        console.log(`⏱️  Uptime: ${summary.uptime.formatted}`);
        console.log(`📈 Requests: ${summary.requests.total} (${summary.requests.successRate} success rate)`);
        console.log(`⚡ Avg Response: ${summary.performance.averageResponseTime}`);
        console.log(`📊 P95 Response: ${summary.performance.p95}`);
        console.log(`🔍 Method Usage:`, summary.methodUsage);
        console.log(`💾 Cache Hit Rates: SERP ${summary.cache.serp.hitRate}, Image ${summary.cache.image.hitRate}`);
    }
}

// Export singleton instance
module.exports = new PerformanceMonitor();
