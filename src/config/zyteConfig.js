module.exports = {
    // Zyte API Configuration
    api: {
        baseUrl: 'https://api.zyte.com/v1/extract',
        timeout: 60000, // 60 seconds
        maxRetries: 3
    },

    // Proxy Settings
    proxy: {
        // Geographic targeting - can be 'US', 'CA', 'GB', 'DE', etc.
        country: process.env.ZYTE_COUNTRY || 'US',
        
        // Session management
        enableSessions: true,
        sessionTimeout: 300000, // 5 minutes
        
        // Proxy rotation settings
        rotation: {
            enabled: true,
            residential: true,    // Use residential proxies (more expensive but harder to detect)
            datacenter: false,    // Use datacenter proxies (cheaper but easier to detect)
            isp: false           // Use ISP proxies (middle ground)
        }
    },

    // Scraping Options
    scraping: {
        // Note: JavaScript rendering is now handled dynamically in the client
        // httpResponseBody is tried first, browserHtml as fallback
        
        // Custom headers (applied via axios client)
        headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
    },

    // Fallback Strategy
    fallback: {
        // When to use JavaScript rendering as fallback
        triggers: [
            'invalid_html',      // When httpResponseBody returns non-HTML content
            'empty_content',     // When content is empty or too short
            'javascript_required' // When page requires JS to render content
        ],
        
        // Maximum fallback attempts
        maxAttempts: 1, // Only try browserHtml once after httpResponseBody
        
        // Delay between fallback attempts (ms)
        retryDelay: 1000
    },

    // Cost Management
    cost: {
        // Cost estimates per request (in USD)
        estimates: {
            residential: 0.25,   // Residential proxy
            datacenter: 0.10,    // Datacenter proxy
            isp: 0.15,          // ISP proxy
            javascript: 0.05     // JavaScript rendering
        },
        
        // Budget limits
        daily: process.env.ZYTE_DAILY_BUDGET || 50,
        hourly: process.env.ZYTE_HOURLY_LIMIT || 100
    },

    // Monitoring and Logging
    monitoring: {
        // Track success rates
        trackSuccess: true,
        
        // Log detailed request info
        detailedLogging: process.env.NODE_ENV === 'development',
        
        // Performance metrics
        trackPerformance: true
    }
};
