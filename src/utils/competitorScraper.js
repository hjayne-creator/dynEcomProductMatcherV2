const { extractJsonLd } = require('./jsonLdParser');
const { extractAllProductAttributes } = require('./attributeExtractor');
const { createOptimizedSearchTerm } = require('./searchTermOptimizer');
const ZyteClient = require('./zyteClient');
const cheerio = require('cheerio');

// ====== Zyte-Only Competitor Scraping ======
const scrapeCompetitor = async (url) => {
    let result = null;
    
    try {
        // Check if Zyte API key is available
        if (!process.env.ZYTE_API_KEY) {
            console.error(`[COMPETITOR] Zyte API key not configured. Please set ZYTE_API_KEY in your environment.`);
            return null;
        }

        console.log(`[COMPETITOR] Attempting Zyte scrape for: ${url}`);
        
        const zyteClient = new ZyteClient(process.env.ZYTE_API_KEY);
        const zyteResponse = await zyteClient.scrape(url);
        
        if (zyteResponse.success && zyteResponse.html) {
            console.log(`[COMPETITOR] Zyte successful for: ${url} using ${zyteResponse.method}`);
            
            // Extract product data from Zyte's structured response
            const productData = zyteClient.extractProductData(zyteResponse);
            
            // Fallback to HTML parsing if Zyte's structured data doesn't have what we need
            let finalResult = {
                url,
                compImage: '',
                metaTitle: '',
                metaDescription: '',
                attributes: {},
                attributeConfidence: {},
                extractionMethod: 'zyte',
                zyteMethod: zyteResponse.method,
                statusCode: zyteResponse.status
            };

            // Priority 1: Extract HTML title tag (most descriptive and SEO-optimized)
            const titleMatch = zyteResponse.html.match(/<title[^>]*>([^<]+)<\/title>/i);
            const htmlTitle = titleMatch ? titleMatch[1].trim() : '';
            
            // Priority 2: Extract meta description
            const metaMatch = zyteResponse.html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i);
            const metaDescription = metaMatch ? metaMatch[1].trim() : '';

            // Use Zyte's structured data if available
            if (productData && productData.mainImage) {
                finalResult = {
                    ...finalResult,
                    compImage: productData.mainImage,
                    // Title priority: HTML title first, then Zyte name as fallback
                    metaTitle: htmlTitle || productData.title || '',
                    metaDescription: metaDescription || productData.description || '',
                    attributes: {
                        brand: productData.brand || '',
                        manufacturer: productData.brand || '', // Map brand to manufacturer
                        model: productData.mpn || '', // Map MPN to model
                        price: productData.price || '',
                        sku: productData.sku || '',
                        mpn: productData.mpn || ''
                    },
                    attributeConfidence: { zyte: 'high' },
                    extractionMethod: 'zyte_structured'
                };
            } else {
                // If no Zyte structured data, use HTML parsing
                finalResult = {
                    ...finalResult,
                    metaTitle: htmlTitle,
                    metaDescription: metaDescription,
                    extractionMethod: 'zyte_html'
                };
            }

            // If we still don't have the image, fall back to HTML parsing
            if (!finalResult.compImage) {
                console.log(`[COMPETITOR] Zyte structured data incomplete, falling back to HTML parsing for image`);
                
                const $ = cheerio.load(zyteResponse.html);
                
                // Extract JSON-LD data
                const jsonLd = extractJsonLd(zyteResponse.html);
                
                // Extract product image
                let compImage = findProductImageFromJsonLd(jsonLd);
                if (!compImage) {
                    console.log(`[IMAGE] JSON-LD extraction failed, trying DOM extraction...`);
                    compImage = findProductImageFromDOM($, url);
                } else {
                    console.log(`[IMAGE] Successfully extracted image from JSON-LD: ${compImage}`);
                }
                
                console.log(`[IMAGE] Final competitor image result:`, compImage);

                // Extract attributes from HTML if not already extracted
                if (!finalResult.attributes.brand) {
                    const attributes = await extractAllProductAttributes(zyteResponse.html, url);
                    finalResult = {
                        ...finalResult,
                        compImage: compImage,
                        attributes: finalResult.attributes.brand ? finalResult.attributes : attributes.attributes,
                        attributeConfidence: finalResult.attributeConfidence.zyte ? finalResult.attributeConfidence : attributes.confidence,
                        extractionMethod: finalResult.extractionMethod === 'zyte_structured' ? 'zyte_hybrid' : 'zyte_html'
                    };
                } else {
                    finalResult.compImage = compImage;
                }
            }

            // Create optimized search term
            const excludeDomain = new URL(url).hostname;
            if (finalResult.metaTitle && finalResult.metaTitle.trim()) {
                finalResult.searchTerm = createOptimizedSearchTerm(finalResult.metaTitle, excludeDomain);
            } else {
                // Fallback: use URL path for search term
                const urlPath = new URL(url).pathname;
                const pathSegments = urlPath.split('/').filter(segment => segment.length > 0);
                const fallbackTerm = pathSegments.slice(-2).join(' ').replace(/[-_]/g, ' ');
                finalResult.searchTerm = fallbackTerm || 'product';
                console.log(`[SCRAPE] Using fallback search term: ${finalResult.searchTerm}`);
            }

            // Validate that we have at least the image
            if (finalResult.compImage) {
                console.log(`[COMPETITOR] Successfully extracted competitor data for: ${url}`);
                console.log(`[COMPETITOR] Title source: ${htmlTitle ? 'HTML title tag' : 'Zyte name field'}`);
                return finalResult;
            } else {
                console.log(`[COMPETITOR] Missing essential data (image) for: ${url}`);
                return null;
            }

        } else {
            console.error(`[COMPETITOR] Zyte scraping failed for ${url}: ${zyteResponse.error}`);
            return null;
        }

    } catch (error) {
        console.error(`[COMPETITOR] Unexpected error scraping ${url}:`, error.message);
        return null;
    }
};

// Helper functions for image extraction
const findProductImageFromJsonLd = (jsonLd) => {
    if (!jsonLd || !Array.isArray(jsonLd)) return null;
    
    for (const ld of jsonLd) {
        try {
            if (ld['@type'] === 'Product' || ld['@type']?.includes('Product')) {
                // Try multiple image fields
                const image = ld.image || ld.mainImage || ld.productImage || 
                             (ld.offers && ld.offers.image) ||
                             (ld.offers && Array.isArray(ld.offers) && ld.offers[0]?.image);
                
                if (image) {
                    if (typeof image === 'string') return image;
                    if (image.url) return image.url;
                    if (image.src) return image.src;
                }
            }
        } catch (e) {
            // Skip invalid JSON-LD
        }
    }
    return null;
};

const findProductImageFromDOM = ($, url) => {
    // Try multiple image selectors
    const imageSelectors = [
        'img[class*="product-image"]',
        'img[class*="main-image"]',
        'img[class*="hero-image"]',
        'img[data-src]',
        'img[src*="product"]',
        'img[src*="main"]',
        '.product-image img',
        '.main-image img',
        '.hero-image img'
    ];

    for (const selector of imageSelectors) {
        const img = $(selector).first();
        if (img.length) {
            const src = img.attr('src') || img.attr('data-src');
            if (src) {
                return new URL(src, url).href;
            }
        }
    }
    return null;
};

// Export the main scraping function
module.exports = {
    scrapeCompetitor
};
