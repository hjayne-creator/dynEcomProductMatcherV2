const ProductAttributeExtractor = require('./productAttributeExtractor');

// Create a singleton instance
const extractor = new ProductAttributeExtractor();

// Backward compatibility function
const extractUniversalAttributes = ($) => {
    const attrs = {};

    // Price extraction from common patterns
    const priceSelectors = [
        '[itemprop="price"]',
        '.price',
        '.product-price',
        '[data-price]'
    ];

    priceSelectors.some(sel => {
        const priceText = $(sel).first().text();
        const priceMatch = priceText.match(/\$?(\d+\.\d{2})/);
        if (priceMatch) attrs.price = priceMatch[1];
        return !!priceMatch;
    });

    // Brand extraction
    const brandSelectors = [
        '[itemprop="brand"]',
        '[data-brand]',
        '.product-brand'
    ];

    brandSelectors.some(sel => {
        const brand = $(sel).first().text().trim();
        if (brand) attrs.brand = brand;
        return !!brand;
    });

    return attrs;
};

// New comprehensive extraction function
const extractAllProductAttributes = async (html, url) => {
    return await extractor.extractAllAttributes(html, url);
};

// Legacy function for backward compatibility
const extractBasicAttributes = ($) => {
    return extractUniversalAttributes($);
};

module.exports = {
    extractUniversalAttributes,
    extractAllProductAttributes,
    extractBasicAttributes,
    ProductAttributeExtractor
};
