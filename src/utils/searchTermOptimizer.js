// Search Term Optimizer for Product Comparison
// Creates clean, optimized search terms for finding competitor products

// Import retailer brand configuration
const { ALL_RETAILER_BRANDS } = require('../config/retailerBrands');

/**
 * Cleans and optimizes a product title for search
 * @param {string} title - Raw product title
 * @returns {string} - Cleaned search term
 */
const cleanProductTitle = (title) => {
    if (!title || typeof title !== 'string') {
        return '';
    }

    let cleaned = title
        // Remove common product prefixes/suffixes
        .replace(/\b(buy|order|shop|get|find|compare|best|top|cheap|discount|sale|deal|offer|price|cost|cheapest|lowest)\b/gi, '')
        
        // Remove size/quantity indicators
      //  .replace(/\b(\d+\s*(pack|pk|count|ct|piece|pc|unit|ea|each|bottle|can|box|bag|roll|sheet|pad|bundle|set|kit|case))\b/gi, '')
        
        // Remove common measurement units
      //  .replace(/\b(\d+\s*(inch|in|cm|mm|ft|foot|feet|yd|yard|oz|ounce|lb|pound|kg|gram|ml|liter|gallon|quart|pint|cup|tbsp|tsp))\b/gi, '')
        
        // Remove price-related text
        .replace(/\$\d+(\.\d{2})?/g, '')
        .replace(/\b(free shipping|free delivery|ships free|delivery included)\b/gi, '')
        
        // Remove promotional text
        .replace(/\b(limited time|while supplies last|act now|hurry|expires|sale ends|clearance|closeout|discontinued)\b/gi, '')
        
        // Remove common e-commerce text
        .replace(/\b(add to cart|buy now|checkout|shopping cart|wishlist|favorites|save for later)\b/gi, '')
        
        // Remove brand-specific promotional text
        .replace(/\b(official|authentic|genuine|original|licensed|authorized dealer|certified)\b/gi, '')
        
        // Clean up extra whitespace and punctuation
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s\-&]/g, ' ')
        .replace(/-/g, ' ')  // Replace hyphens with spaces
        .trim();

    return cleaned;
};

/**
 * Removes retailer brand names from search term
 * @param {string} searchTerm - Search term to clean
 * @returns {string} - Cleaned search term without retailer brands
 */
const removeRetailerBrands = (searchTerm) => {
    if (!searchTerm || typeof searchTerm !== 'string') {
        return '';
    }

    let cleaned = searchTerm.toLowerCase();
    
    // Remove retailer brands from the search term
    ALL_RETAILER_BRANDS.forEach(brand => {
        const brandRegex = new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        cleaned = cleaned.replace(brandRegex, '');
    });
    
    // Clean up extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
};

/**
 * Creates an optimized search term for finding competitor products
 * @param {string} title - Product title
 * @param {string} excludeDomain - Domain to exclude from search
 * @returns {string} - Optimized search term with domain exclusion
 */
const createOptimizedSearchTerm = (title, excludeDomain) => {
    if (!title) {
        return '';
    }

    // Step 1: Clean the product title
    let searchTerm = cleanProductTitle(title);
    
    // Step 2: Remove retailer brand names
    searchTerm = removeRetailerBrands(searchTerm);
    
    // Step 3: Apply character limit before domain exclusion (reserve space for -site: operator)
    const maxProductTermsLength = 80 - 20; // Reserve ~20 chars for domain exclusion
    if (searchTerm.length > maxProductTermsLength) {
        searchTerm = searchTerm.substring(0, maxProductTermsLength).replace(/\s+\S*$/, '');
    }
    
    // Step 4: Add domain exclusion if provided
    if (excludeDomain) {
        // Clean the domain (remove protocol and www)
        const cleanDomain = excludeDomain.replace(/^https?:\/\//, '').replace(/^www\./, '');
        searchTerm += ` -site:${cleanDomain}`;
    }
    
    // Step 5: Final cleanup
    searchTerm = searchTerm.replace(/\s+/g, ' ').trim();
    
    return searchTerm;
};

/**
 * Logs search term optimization process for debugging
 * @param {string} originalTitle - Original product title
 * @param {string} optimizedTerm - Final optimized search term
 * @param {string} excludeDomain - Domain being excluded
 */
const logSearchTermOptimization = (originalTitle, optimizedTerm, excludeDomain) => {
    console.log('[SEARCH_OPTIMIZATION]');
    console.log(`  Original title: "${originalTitle}"`);
    console.log(`  Exclude domain: ${excludeDomain || 'none'}`);
    console.log(`  Optimized term: "${optimizedTerm}"`);
    console.log(`  Term length: ${optimizedTerm.length} characters`);
};

module.exports = {
    createOptimizedSearchTerm,
    cleanProductTitle,
    removeRetailerBrands,
    logSearchTermOptimization,
    ALL_RETAILER_BRANDS
};
