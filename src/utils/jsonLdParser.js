const cheerio = require('cheerio');

const extractJsonLd = (html) => {
    const $ = cheerio.load(html);
    const ldScripts = $('script[type="application/ld+json"]');
    const jsonLd = [];

    ldScripts.each((i, el) => {
        try {
            const content = $(el).html();
            const parsed = JSON.parse(content);
            jsonLd.push(parsed);
        } catch (e) {
            // Skip invalid JSON
        }
    });

    return jsonLd;
};

// Legacy functions kept for backward compatibility but deprecated
// Use ProductAttributeExtractor.extractAllAttributes() instead
const extractLdAttributes = (jsonLd) => {
    console.warn('[DEPRECATED] extractLdAttributes is deprecated. Use ProductAttributeExtractor.extractAllAttributes() instead.');
    
    const attributes = { brand: '', model: '', gtin: '', price: '' };

    jsonLd.forEach(ld => {
        try {
            if (ld['@type'] === 'Product' || ld['@type']?.includes('Product')) {
                attributes.brand = ld.brand?.name || ld.brand || attributes.brand;
                attributes.model = ld.model || attributes.model;
                attributes.gtin = ld.gtin || attributes.gtin;
                attributes.price = ld.offers?.price ||
                    ld.offers?.[0]?.price ||
                    ld.price ||
                    attributes.price;
            }
        } catch (e) {
            console.error('JSON-LD parse error:', e);
        }
    });

    return attributes;
};

// Legacy function kept for backward compatibility but deprecated
const parseProductSchema = (jsonLd) => {
    console.warn('[DEPRECATED] parseProductSchema is deprecated. Use ProductAttributeExtractor.extractAllAttributes() instead.');
    
    const product = jsonLd.find(item =>
        item['@type'] === 'Product' ||
        (Array.isArray(item['@type']) && item['@type'].includes('Product'))
    );

    if (!product) return null;

    return {
        gtin: product.gtin13 || product.gtin12 || product.gtin14 || product.gtin8,
        brand: product.brand?.name || product.brand,
        model: product.model || product.sku,
        price: product.offers?.price || product.offers?.[0]?.price,
        image: product.image?.url || product.image
    };
};

module.exports = { extractJsonLd, extractLdAttributes, parseProductSchema };
