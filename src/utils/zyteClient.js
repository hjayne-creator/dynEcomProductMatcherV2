const axios = require('axios');
const config = require('../config/zyteConfig');

class ZyteClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = config.api.baseUrl;
        this.config = config;
        
        this.client = axios.create({
            timeout: config.api.timeout,
            headers: {
                'Content-Type': 'application/json',
                ...config.scraping.headers
            },
            auth: {
                username: apiKey,
                password: ''
            }
        });
    }

    /**
     * Primary scraping method with automatic fallback
     * Starts with httpResponseBody (fast) and falls back to browserHtml (JS rendering) if needed
     */
    async scrape(url, options = {}) {
        try {
            console.log(`[ZYTE] Attempting to scrape: ${url}`);
            
            // First attempt: httpResponseBody with product extraction (fast, best for most sites)
            console.log(`[ZYTE] First attempt: HTTP response body with product extraction`);
            const httpResult = await this.scrapeWithHttpResponse(url);
            
            if (httpResult.success && this.isValidHtml(httpResult.html)) {
                console.log(`[ZYTE] HTTP extraction successful: ${url}`);
                return httpResult;
            }
            
            // Fallback: browserHtml with product extraction (slower, best for JS heavy sites)
            console.log(`[ZYTE] HTTP extraction failed or returned invalid HTML, trying JavaScript rendering`);
            const browserResult = await this.scrapeWithBrowserHtml(url);
            
            if (browserResult.success && this.isValidHtml(browserResult.html)) {
                console.log(`[ZYTE] JavaScript rendering successful: ${url}`);
                return browserResult;
            }
            
            // Both methods failed
            console.error(`[ZYTE] Both HTTP and JavaScript rendering failed for: ${url}`);
            return {
                success: false,
                error: 'Both HTTP and JavaScript rendering failed',
                status: 0,
                details: 'No valid HTML content received from either method'
            };

        } catch (error) {
            console.error(`[ZYTE] Unexpected error scraping ${url}:`, error.message);
            return {
                success: false,
                error: error.message,
                status: 0,
                details: error.message
            };
        }
    }

    /**
     * Scrape using httpResponseBody with product extraction (fast method)
     */
    async scrapeWithHttpResponse(url) {
        try {
            const requestPayload = {
                url: url,
                httpResponseBody: true,
                product: true,
                productOptions: {
                    extractFrom: "httpResponseBody",
                    ai: true
                },
                followRedirect: true
            };

            console.log(`[ZYTE] HTTP request payload:`, requestPayload);
            const response = await this.client.post(this.baseUrl, requestPayload);

            if (response.data && response.data.httpResponseBody) {
                // Decode base64 response body
                const html = Buffer.from(response.data.httpResponseBody, 'base64').toString('utf-8');
                
                return {
                    success: true,
                    html: html,
                    status: response.status,
                    session_id: this.generateSessionId(),
                    metadata: response.data,
                    rendering: 'http',
                    method: 'httpResponseBody',
                    product: response.data.product || null
                };
            } else {
                return {
                    success: false,
                    error: 'No HTTP response body received',
                    status: response.status,
                    details: response.data
                };
            }

        } catch (error) {
            console.error(`[ZYTE] HTTP extraction failed for ${url}:`, error.message);
            return {
                success: false,
                error: error.message,
                status: error.response?.status || 0,
                details: error.response?.data || error.message
            };
        }
    }

    /**
     * Scrape using browserHtml with product extraction (JavaScript rendering)
     */
    async scrapeWithBrowserHtml(url) {
        try {
            const requestPayload = {
                url: url,
                browserHtml: true,
                product: true,
                productOptions: {
                    extractFrom: "browserHtml",
                    ai: true
                }
                // Note: followRedirect cannot be used with browser parameters
            };

            console.log(`[ZYTE] Browser request payload:`, requestPayload);
            const response = await this.client.post(this.baseUrl, requestPayload);

            if (response.data && response.data.browserHtml) {
                return {
                    success: true,
                    html: response.data.browserHtml,
                    status: response.status,
                    session_id: this.generateSessionId(),
                    metadata: response.data,
                    rendering: 'javascript',
                    method: 'browserHtml',
                    product: response.data.product || null
                };
            } else {
                return {
                    success: false,
                    error: 'No browser HTML received',
                    status: response.status,
                    details: response.data
                };
            }

        } catch (error) {
            console.error(`[ZYTE] JavaScript rendering failed for ${url}:`, error.message);
            return {
                success: false,
                error: error.message,
                status: error.response?.status || 0,
                details: error.response?.data || error.message
            };
        }
    }

    /**
     * Check if the returned content is valid HTML
     * Looks for <!DOCTYPE html> or basic HTML structure
     */
    isValidHtml(content) {
        if (!content || typeof content !== 'string') {
            return false;
        }
        
        const trimmed = content.trim();
        
        // Check for DOCTYPE declaration
        if (trimmed.startsWith('<!DOCTYPE html>')) {
            return true;
        }
        
        // Check for HTML tag
        if (trimmed.startsWith('<html') || trimmed.includes('<html')) {
            return true;
        }
        
        // Check for basic HTML structure (head, body, or common tags)
        if (trimmed.includes('<head') || trimmed.includes('<body') || 
            trimmed.includes('<div') || trimmed.includes('<p>')) {
            return true;
        }
        
        // If it's just JavaScript or other non-HTML content, consider it invalid
        if (trimmed.startsWith('<script') || trimmed.startsWith('var ') || 
            trimmed.startsWith('function') || trimmed.startsWith('{')) {
            return false;
        }
        
        return false;
    }

    /**
     * Extract product data from Zyte's response
     * This method parses the structured data that Zyte provides
     */
    extractProductData(zyteResponse) {
        try {
            if (!zyteResponse.success || !zyteResponse.metadata) {
                return null;
            }

            const metadata = zyteResponse.metadata;
            const product = zyteResponse.product || metadata.product;
            
            if (!product) {
                console.log(`[ZYTE] No product data found in response`);
                return null;
            }
            
            // Extract product information from Zyte's AI-powered response
            const productData = {
                // Basic product info
                title: this.extractField(product, ['name', 'title', 'productName']),
                brand: this.extractField(product, ['brand', 'manufacturer']),
                sku: this.extractField(product, ['sku', 'productId', 'id']),
                mpn: this.extractField(product, ['mpn', 'manufacturerPartNumber']),
                price: this.extractField(product, ['price', 'amount', 'priceAmount']),
                
                // Image extraction
                mainImage: this.extractField(product, ['mainImage', 'image', 'productImage', 'images']),
                
                // Additional fields
                statusCode: zyteResponse.status || 200,
                description: this.extractField(product, ['description', 'productDescription']),
                category: this.extractField(product, ['category', 'productCategory']),
                
                // Extraction metadata
                extractionMethod: zyteResponse.method || 'unknown',
                confidence: 'high', // Zyte provides AI-powered data, so confidence is high
                source: 'zyte'
            };

            // Clean up undefined values
            Object.keys(productData).forEach(key => {
                if (productData[key] === undefined) {
                    productData[key] = '';
                }
            });

            console.log(`[ZYTE] Extracted product data:`, {
                title: productData.title ? 'Found' : 'Missing',
                brand: productData.brand ? 'Found' : 'Missing',
                sku: productData.sku ? 'Found' : 'Missing',
                mpn: productData.mpn ? 'Found' : 'Missing',
                price: productData.price ? 'Found' : 'Missing',
                mainImage: productData.mainImage ? 'Found' : 'Missing'
            });

            return productData;

        } catch (error) {
            console.error(`[ZYTE] Error extracting product data:`, error.message);
            return null;
        }
    }

    /**
     * Helper method to extract fields from nested objects
     */
    extractField(obj, possibleKeys) {
        for (const key of possibleKeys) {
            if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
                const value = obj[key];
                
                // Handle arrays (e.g., images array)
                if (Array.isArray(value)) {
                    if (value.length > 0) {
                        // For arrays, try to get the first item
                        const firstItem = value[0];
                        if (typeof firstItem === 'string') {
                            return firstItem;
                        } else if (typeof firstItem === 'object' && firstItem !== null) {
                            // Try to extract URL from object
                            return this.extractField(firstItem, ['url', 'src', 'href', 'link']) || firstItem;
                        }
                    }
                    continue;
                }
                
                // Handle objects (e.g., image object with url property)
                if (typeof value === 'object' && value !== null) {
                    // Try to extract URL from object
                    const urlValue = this.extractField(value, ['url', 'src', 'href', 'link']);
                    if (urlValue) return urlValue;
                    
                    // If no URL found, try to get a string representation
                    if (value.name || value.title) return value.name || value.title;
                    if (value.text) return value.text;
                    
                    // For complex objects, return a meaningful string
                    continue;
                }
                
                // Handle primitive values
                if (typeof value === 'string' || typeof value === 'number') {
                    return value.toString();
                }
            }
        }
        return '';
    }

    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Get cost estimate for a request (useful for monitoring)
    getCostEstimate() {
        return this.config.cost.estimates;
    }

    // Get current scraping configuration
    getScrapingConfig() {
        return {
            renderJs: false, // We now handle this dynamically
            headers: this.config.scraping.headers,
            proxy: this.config.proxy
        };
    }
}

module.exports = ZyteClient;
