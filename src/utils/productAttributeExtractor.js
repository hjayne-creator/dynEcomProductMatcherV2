const { validateGTIN } = require('./gtinValidator');

/**
 * Comprehensive Product Attribute Extractor
 * Extracts product attributes using multiple strategies with fallbacks
 */
class ProductAttributeExtractor {
    constructor() {
        this.attributeSelectors = {
            brand: [
                '[itemprop="brand"]',
                '[data-brand]',
                '.product-brand',
                '.brand',
                '[class*="brand"]',
                'meta[property="product:brand"]',
                'meta[name="brand"]'
            ],
            manufacturer: [
                '[itemprop="manufacturer"]',
                '[data-manufacturer]',
                '.manufacturer',
                '[class*="manufacturer"]',
                'meta[property="product:manufacturer"]',
                'meta[name="manufacturer"]'
            ],
            model: [
                '[itemprop="model"]',
                '[data-model]',
                '.product-model',
                '.model',
                '[class*="model"]',
                'meta[property="product:model"]',
                'meta[name="model"]'
            ],
            price: [
                '[itemprop="price"]',
                '[data-price]',
                '.price',
                '.product-price',
                '[class*="price"]',
                'meta[property="product:price:amount"]',
                'meta[property="og:price:amount"]'
            ],
            gtin: [
                '[itemprop="gtin"]',
                '[data-gtin]',
                '.gtin',
                '[class*="gtin"]',
                'meta[property="product:gtin"]',
                'meta[name="gtin"]'
            ],
            sku: [
                '[itemprop="sku"]',
                '[data-sku]',
                '.sku',
                '[class*="sku"]',
                'meta[property="product:sku"]',
                'meta[name="sku"]'
            ],
            upc: [
                '[itemprop="upc"]',
                '[data-upc]',
                '.upc',
                '[class*="upc"]',
                'meta[property="product:upc"]',
                'meta[name="upc"]'
            ],
            material: [
                '[itemprop="material"]',
                '[data-material]',
                '.material',
                '[class*="material"]',
                'meta[property="product:material"]',
                'meta[name="material"]'
            ],
            color: [
                '[itemprop="color"]',
                '[data-color]',
                '.color',
                '[class*="color"]',
                'meta[property="product:color"]',
                'meta[name="color"]'
            ],
            size: [
                '[itemprop="size"]',
                '[data-size]',
                '.size',
                '[class*="size"]',
                'meta[property="product:size"]',
                'meta[name="size"]'
            ]
        };

        this.textPatterns = {
            price: [
                /\$?(\d+\.\d{2})/g,
                /(\d+\.\d{2})\s*USD/g,
                /Price:\s*\$?(\d+\.\d{2})/gi,
                /(\d+\.\d{2})\s*EUR/g,
                /(\d+\.\d{2})\s*GBP/g
            ],
            gtin: [
                /GTIN[:\s]*(\d{8,14})/gi,
                /(\d{8,14})/g  // Generic number pattern for GTIN
            ],
            upc: [
                /UPC[:\s]*(\d{12})/gi,
                /(\d{12})/g  // UPC is always 12 digits
            ],
            sku: [
                /SKU[:\s]*([A-Z0-9\-_]+)/gi,
                /Item[:\s]*([A-Z0-9\-_]+)/gi,
                /Part[:\s]*([A-Z0-9\-_]+)/gi
            ]
        };
    }

    /**
     * Extract all product attributes from HTML content
     * @param {string} html - Raw HTML content
     * @param {string} url - URL for relative link resolution
     * @returns {Object} Extracted attributes with confidence scores
     */
    async extractAllAttributes(html, url) {
        const $ = require('cheerio').load(html);
        const attributes = {};
        const confidence = {};

        // Extract from JSON-LD (highest priority)
        const jsonLdAttrs = this.extractFromJsonLd(html);
        this.mergeAttributes(attributes, jsonLdAttrs, confidence, 0.9);

        // Extract from microdata and CSS selectors
        const selectorAttrs = this.extractFromSelectors($);
        this.mergeAttributes(attributes, selectorAttrs, confidence, 0.7);

        // Extract from meta tags
        const metaAttrs = this.extractFromMetaTags($);
        this.mergeAttributes(attributes, metaAttrs, confidence, 0.6);

        // Extract from text patterns (lowest priority)
        const patternAttrs = this.extractFromTextPatterns($);
        this.mergeAttributes(attributes, patternAttrs, confidence, 0.4);

        // Post-process and validate attributes
        const processedAttrs = this.postProcessAttributes(attributes, confidence);

        return {
            attributes: processedAttrs,
            confidence: confidence,
            extractionMethod: this.getExtractionMethod(confidence)
        };
    }

    /**
     * Extract attributes from JSON-LD structured data
     */
    extractFromJsonLd(html) {
        const $ = require('cheerio').load(html);
        const attrs = {};
        
        $('script[type="application/ld+json"]').each((i, el) => {
            try {
                const content = $(el).html();
                const parsed = JSON.parse(content);
                
                if (Array.isArray(parsed)) {
                    parsed.forEach(item => this.extractFromJsonLdItem(item, attrs));
                } else {
                    this.extractFromJsonLdItem(parsed, attrs);
                }
            } catch (e) {
                // Skip invalid JSON
            }
        });

        return attrs;
    }

    /**
     * Extract attributes from a single JSON-LD item
     */
    extractFromJsonLdItem(item, attrs) {
        if (item['@type'] === 'Product' || 
            (Array.isArray(item['@type']) && item['@type'].includes('Product'))) {
            
            // Basic attributes
            if (item.brand?.name) attrs.brand = item.brand.name;
            if (item.brand && typeof item.brand === 'string') attrs.brand = item.brand;
            if (item.manufacturer?.name) attrs.manufacturer = item.manufacturer.name;
            if (item.manufacturer && typeof item.manufacturer === 'string') attrs.manufacturer = item.manufacturer;
            if (item.model) attrs.model = item.model;
            if (item.sku) attrs.sku = item.sku;
            if (item.gtin) attrs.gtin = item.gtin;
            if (item.upc) attrs.upc = item.upc;
            if (item.material) attrs.material = item.material;
            if (item.color) attrs.color = item.color;
            if (item.size) attrs.size = item.size;

            // Price extraction
            if (item.offers) {
                if (Array.isArray(item.offers)) {
                    if (item.offers[0]?.price) attrs.price = item.offers[0].price;
                } else if (item.offers.price) {
                    attrs.price = item.offers.price;
                }
            }
            if (item.price) attrs.price = item.price;

            // Additional properties
            if (item.additionalProperty) {
                item.additionalProperty.forEach(prop => {
                    if (prop.name && prop.value) {
                        const name = prop.name.toLowerCase();
                        if (name.includes('material')) attrs.material = prop.value;
                        if (name.includes('color')) attrs.color = prop.value;
                        if (name.includes('size')) attrs.size = prop.value;
                        if (name.includes('sku')) attrs.sku = prop.value;
                        if (name.includes('upc')) attrs.upc = prop.value;
                    }
                });
            }
        }
    }

    /**
     * Extract attributes using CSS selectors
     */
    extractFromSelectors($) {
        const attrs = {};

        Object.entries(this.attributeSelectors).forEach(([attrName, selectors]) => {
            for (const selector of selectors) {
                const element = $(selector).first();
                if (element.length > 0) {
                    let value = element.text().trim() || element.attr('content') || element.attr('value');
                    
                    if (value) {
                        // Clean up the value
                        value = this.cleanAttributeValue(value, attrName);
                        if (value) {
                            attrs[attrName] = value;
                            break; // Use first successful selector
                        }
                    }
                }
            }
        });

        return attrs;
    }

    /**
     * Extract attributes from meta tags
     */
    extractFromMetaTags($) {
        const attrs = {};

        // Meta tag patterns
        const metaPatterns = {
            brand: ['meta[property="product:brand"]', 'meta[name="brand"]'],
            manufacturer: ['meta[property="product:manufacturer"]', 'meta[name="manufacturer"]'],
            model: ['meta[property="product:model"]', 'meta[name="model"]'],
            price: ['meta[property="product:price:amount"]', 'meta[property="og:price:amount"]'],
            gtin: ['meta[property="product:gtin"]', 'meta[name="gtin"]'],
            sku: ['meta[property="product:sku"]', 'meta[name="sku"]'],
            upc: ['meta[property="product:upc"]', 'meta[name="upc"]'],
            material: ['meta[property="product:material"]', 'meta[name="material"]'],
            color: ['meta[property="product:color"]', 'meta[name="color"]'],
            size: ['meta[property="product:size"]', 'meta[name="size"]']
        };

        Object.entries(metaPatterns).forEach(([attrName, patterns]) => {
            for (const pattern of patterns) {
                const element = $(pattern).first();
                if (element.length > 0) {
                    const value = element.attr('content');
                    if (value) {
                        const cleanedValue = this.cleanAttributeValue(value, attrName);
                        if (cleanedValue) {
                            attrs[attrName] = cleanedValue;
                            break;
                        }
                    }
                }
            }
        });

        return attrs;
    }

    /**
     * Extract attributes using text pattern matching
     */
    extractFromTextPatterns($) {
        const attrs = {};
        const bodyText = $('body').text();

        Object.entries(this.textPatterns).forEach(([attrName, patterns]) => {
            for (const pattern of patterns) {
                const matches = bodyText.match(pattern);
                if (matches && matches.length > 0) {
                    let value = matches[1] || matches[0];
                    if (attrName === 'price') {
                        value = parseFloat(value);
                    }
                    if (value) {
                        attrs[attrName] = value;
                        break;
                    }
                }
            }
        });

        return attrs;
    }

    /**
     * Clean and normalize attribute values
     */
    cleanAttributeValue(value, attrName) {
        if (!value) return null;

        let cleaned = value.toString().trim();

        // Remove extra whitespace and normalize
        cleaned = cleaned.replace(/\s+/g, ' ');

        // Specific cleaning for different attribute types
        switch (attrName) {
            case 'price':
                // Extract numeric price
                const priceMatch = cleaned.match(/[\d,]+\.?\d*/);
                if (priceMatch) {
                    return parseFloat(priceMatch[0].replace(/,/g, ''));
                }
                return null;

            case 'gtin':
            case 'upc':
            case 'sku':
                // Remove non-alphanumeric characters except hyphens and underscores
                cleaned = cleaned.replace(/[^A-Za-z0-9\-_]/g, '');
                return cleaned || null;

            case 'brand':
            case 'manufacturer':
            case 'model':
            case 'material':
            case 'color':
            case 'size':
                // Remove excessive punctuation and normalize
                cleaned = cleaned.replace(/[^\w\s\-]/g, ' ').trim();
                return cleaned || null;

            default:
                return cleaned || null;
        }
    }

    /**
     * Merge attributes with confidence scoring
     */
    mergeAttributes(target, source, confidence, sourceConfidence) {
        Object.entries(source).forEach(([key, value]) => {
            if (value && (!target[key] || confidence[key] < sourceConfidence)) {
                target[key] = value;
                confidence[key] = sourceConfidence;
            }
        });
    }

    /**
     * Post-process extracted attributes
     */
    postProcessAttributes(attributes, confidence) {
        const processed = { ...attributes };

        // Validate GTIN if present
        if (processed.gtin && !validateGTIN(processed.gtin)) {
            console.warn(`Invalid GTIN detected: ${processed.gtin}`);
            // Don't remove, but mark as low confidence
            confidence.gtin = Math.min(confidence.gtin || 0, 0.3);
        }

        // Normalize price
        if (processed.price) {
            if (typeof processed.price === 'string') {
                processed.price = parseFloat(processed.price.replace(/[^\d.,]/g, ''));
            }
            if (isNaN(processed.price)) {
                delete processed.price;
                delete confidence.price;
            }
        }

        // Handle UPC vs GTIN (UPC is a subset of GTIN)
        if (processed.upc && processed.gtin) {
            if (processed.upc === processed.gtin.slice(-12)) {
                // UPC matches GTIN, keep both
                confidence.upc = Math.max(confidence.upc || 0, confidence.gtin || 0);
            }
        }

        // Ensure all expected attributes are present (even if null)
        const expectedAttrs = ['brand', 'manufacturer', 'model', 'price', 'gtin', 'sku', 'upc', 'material', 'color', 'size'];
        expectedAttrs.forEach(attr => {
            if (!(attr in processed)) {
                processed[attr] = null;
                confidence[attr] = 0;
            }
        });

        return processed;
    }

    /**
     * Get extraction method summary
     */
    getExtractionMethod(confidence) {
        const methods = [];
        Object.entries(confidence).forEach(([attr, conf]) => {
            if (conf > 0) {
                if (conf >= 0.9) methods.push(`${attr}:JSON-LD`);
                else if (conf >= 0.7) methods.push(`${attr}:CSS`);
                else if (conf >= 0.6) methods.push(`${attr}:META`);
                else if (conf >= 0.4) methods.push(`${attr}:PATTERN`);
            }
        });
        return methods.join(', ');
    }
}

module.exports = ProductAttributeExtractor;
