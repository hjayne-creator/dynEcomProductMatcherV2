require('dotenv').config();

const { getJson } = require('serpapi');

// Simple in-memory cache for SERP results
const serpCache = new Map();
const CACHE_TTL = 3600000; // 1 hour cache TTL

// URL blocklist - paths that should be filtered out from search results
const URL_BLOCKLIST = [
    'youtube.com',
    'ebay.com',
    '/collections',
    '/category'
];

// Function to check if a URL should be blocked
const isUrlBlocked = (url) => {
    if (!url) return true;
    
    return URL_BLOCKLIST.some(blockedPath => {
        if (blockedPath.includes('://')) {
            // Full domain check (e.g., youtube.com)
            return url.includes(blockedPath);
        } else {
            // Path check (e.g., /collections, /category)
            return url.includes(blockedPath);
        }
    });
};

const fetchSerpResults = async (searchTerm) => {
    // Validate searchTerm parameter
    if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim() === '') {
        console.error('[SERP] Invalid searchTerm provided:', searchTerm);
        throw new Error('Invalid searchTerm: must be a non-empty string');
    }

    if (!process.env.SERP_API_KEY) {
        console.error('[SERP] SERP_API_KEY environment variable is required');
        throw new Error('SERP_API_KEY environment variable is required');
    }

    // Check cache first
    const cacheKey = searchTerm.toLowerCase().trim();
    const cached = serpCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        console.log(`[SERP] Using cached results for: "${searchTerm}"`);
        return cached.results;
    }

    console.log(`[SERP] Fetching fresh results for: "${searchTerm}"`);
    console.log(`[SERP] API Key configured: ${process.env.SERP_API_KEY ? 'Yes' : 'No'}`);
    console.log(`[SERP] Search parameters: country=${process.env.SEARCH_COUNTRY || 'us'}, language=${process.env.SEARCH_LANGUAGE || 'en'}, limit=${process.env.ORGANIC_LIMIT || 8}`);

    try {
        const results = await getJson({
            api_key: process.env.SERP_API_KEY,
            q: searchTerm,
            country: process.env.SEARCH_COUNTRY || 'us',
            language: process.env.SEARCH_LANGUAGE || 'en',
            num: parseInt(process.env.ORGANIC_LIMIT) || 8
        });
        
        console.log(`[SERP] Raw API response received:`, {
            hasOrganicResults: !!results.organic_results,
            organicResultsCount: results.organic_results ? results.organic_results.length : 0,
            responseKeys: Object.keys(results || {})
        });
        
        if (!results.organic_results) {
            console.warn(`[SERP] No organic results found for: "${searchTerm}"`);
            console.warn(`[SERP] Response structure:`, results);
            return [];
        }

        // Extract and format results
        const formattedResults = results.organic_results
            .filter(result => result.link && !isUrlBlocked(result.link))
            .map(result => ({
                url: result.link,
                title: result.title,
                snippet: result.snippet,
                position: result.position
            }))
            .slice(0, parseInt(process.env.ORGANIC_LIMIT) || 8);

        // Cache the results
        serpCache.set(cacheKey, {
            results: formattedResults,
            timestamp: Date.now()
        });

        // Clean up old cache entries
        cleanupCache();

        console.log(`[SERP] Found ${formattedResults.length} results for: "${searchTerm}"`);
        return formattedResults;

    } catch (error) {
        console.error(`[SERP] Error fetching results for "${searchTerm}":`, error.message);
        console.error(`[SERP] Full error:`, error);
        
        // Return cached results if available, even if expired
        if (cached) {
            console.log(`[SERP] Returning expired cached results for: "${searchTerm}"`);
            return cached.results;
        }
        
        throw error;
    }
};

// Clean up old cache entries
const cleanupCache = () => {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, value] of serpCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            expiredKeys.push(key);
        }
    }
    
    expiredKeys.forEach(key => serpCache.delete(key));
    
    if (expiredKeys.length > 0) {
        console.log(`[SERP] Cleaned up ${expiredKeys.length} expired cache entries`);
    }
};

// Get cache statistics
const getCacheStats = () => {
    return {
        size: serpCache.size,
        keys: Array.from(serpCache.keys()),
        oldestEntry: Math.min(...Array.from(serpCache.values()).map(v => v.timestamp)),
        newestEntry: Math.max(...Array.from(serpCache.values()).map(v => v.timestamp))
    };
};

// Clear cache manually
const clearCache = () => {
    const size = serpCache.size;
    serpCache.clear();
    console.log(`[SERP] Cache cleared, removed ${size} entries`);
};

module.exports = {
    fetchSerpResults,
    getCacheStats,
    clearCache
};
