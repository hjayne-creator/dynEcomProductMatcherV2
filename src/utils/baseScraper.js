const { extractAllProductAttributes } = require('./attributeExtractor');
const ZyteClient = require('./zyteClient');
const performanceMonitor = require('./performanceMonitor');
const { createOptimizedSearchTerm } = require('./searchTermOptimizer');

const delay = ms => new Promise(res => setTimeout(res, ms));

// ====== Zyte-Only Product Scraping ======
const scrapeBaseProduct = async (url) => {
    const startTime = performanceMonitor.startRequest();
    let result = null;
    
    try {
        // Check if Zyte API key is available
        if (!process.env.ZYTE_API_KEY) {
            console.error(`[SCRAPE] Zyte API key not configured. Please set ZYTE_API_KEY in your environment.`);
            performanceMonitor.endRequest(startTime, false);
            return null;
        }

        console.log(`[SCRAPE] Attempting Zyte scrape for: ${url}`);
        
        const zyteClient = new ZyteClient(process.env.ZYTE_API_KEY);
        const zyteResponse = await zyteClient.scrape(url);
        
        if (zyteResponse.success && zyteResponse.html) {
            console.log(`[SCRAPE] Zyte successful for: ${url} using ${zyteResponse.method}`);
            
            // Extract product data from Zyte's structured response
            const productData = zyteClient.extractProductData(zyteResponse);
            
            // Fallback to HTML parsing if Zyte's structured data doesn't have what we need
            let finalResult = {
                url,
                title: '',
                metaDescription: '',
                image: '',
                brand: '',
                manufacturer: '',
                model: '',
                price: '',
                gtin: '',
                sku: '',
                upc: '',
                material: '',
                color: '',
                size: '',
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
            if (productData) {
                finalResult = {
                    ...finalResult,
                    // Title priority: HTML title first, then Zyte name as fallback
                    title: htmlTitle || productData.title || '',
                    image: productData.mainImage || '',
                    brand: productData.brand || '',
                    manufacturer: productData.brand || '', // Map brand to manufacturer
                    model: productData.mpn || '', // Map MPN to model
                    price: productData.price || '',
                    sku: productData.sku || '',
                    mpn: productData.mpn || '',
                    metaDescription: metaDescription,
                    attributeConfidence: { zyte: 'high' },
                    extractionMethod: 'zyte_structured'
                };
            } else {
                // If no Zyte structured data, use HTML parsing
                finalResult = {
                    ...finalResult,
                    title: htmlTitle,
                    metaDescription: metaDescription,
                    extractionMethod: 'zyte_html'
                };
            }

            // If we still don't have the image, fall back to HTML parsing
            if (!finalResult.image) {
                console.log(`[SCRAPE] Zyte structured data incomplete, falling back to HTML parsing for image`);
                
                // Try to find product image in HTML
                const imageMatch = zyteResponse.html.match(/<img[^>]*class="[^"]*product-image[^"]*"[^>]*src="([^"]*)"/i) ||
                                  zyteResponse.html.match(/<img[^>]*src="([^"]*)"[^>]*class="[^"]*product-image[^"]*"/i) ||
                                  zyteResponse.html.match(/<img[^>]*class="[^"]*main-image[^"]*"[^>]*src="([^"]*)"/i) ||
                                  zyteResponse.html.match(/<img[^>]*src="([^"]*)"[^>]*class="[^"]*main-image[^"]*"/i);
                
                const image = imageMatch ? new URL(imageMatch[1], url).href : '';

                // Update result with HTML-extracted image
                finalResult = {
                    ...finalResult,
                    image: finalResult.image || image,
                    extractionMethod: finalResult.extractionMethod === 'zyte_structured' ? 'zyte_hybrid' : 'zyte_html'
                };
            }

            // Validate that we have at least title and image
            if (finalResult.title && finalResult.image) {
                // Generate search term for competitor search
                try {
                    const urlObj = new URL(url);
                    const excludeDomain = urlObj.hostname;
                    finalResult.searchTerm = createOptimizedSearchTerm(finalResult.title, excludeDomain);
                    console.log(`[SCRAPE] Generated search term: "${finalResult.searchTerm}"`);
                } catch (searchTermError) {
                    console.warn(`[WARN] Failed to generate search term: ${searchTermError.message}`);
                    // Fallback to using title as search term
                    finalResult.searchTerm = finalResult.title;
                }
                
                console.log(`[SCRAPE] Successfully extracted product data for: ${url}`);
                console.log(`[SCRAPE] Title source: ${htmlTitle ? 'HTML title tag' : 'Zyte name field'}`);
                performanceMonitor.endRequest(startTime, true, 'zyte');
                return finalResult;
            } else {
                console.log(`[SCRAPE] Missing essential data (title: ${!!finalResult.title}, image: ${!!finalResult.image}) for: ${url}`);
                performanceMonitor.endRequest(startTime, false);
                return null;
            }

        } else {
            console.error(`[SCRAPE] Zyte scraping failed for ${url}: ${zyteResponse.error}`);
            performanceMonitor.endRequest(startTime, false);
            return null;
        }

    } catch (error) {
        console.error(`[SCRAPE] Unexpected error scraping ${url}:`, error.message);
        performanceMonitor.endRequest(startTime, false);
        return null;
    }
};

// Export the main scraping function
module.exports = {
    scrapeBaseProduct
};
