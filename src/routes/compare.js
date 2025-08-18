const express = require('express');
const router = express.Router();
const { readCSV, validateURL } = require('../utils/csvReader');
const { scrapeBaseProduct } = require('../utils/baseScraper');
const { fetchSerpResults } = require('../utils/serpFetcher');
const { scrapeCompetitor } = require('../utils/competitorScraper');
const { compareImages: perceptualCompare } = require('../utils/imageComparator');
const EnhancedImageComparator = require('../utils/enhancedImageComparator');
const { calculateHybridSimilarity, getSimilarityClassification } = require('../utils/productMatcher');
const { readPublicSheet } = require('../utils/publicSheetReader');
const { generateCSV, createOutputData, cleanupOldFiles } = require('../utils/csvGenerator');
const Bottleneck = require('bottleneck');
const path = require("path");
const fs = require("fs");



// Rate limiter for concurrent processing
const limiter = new Bottleneck({
    maxConcurrent: 5, // Process 5 URLs concurrently
    minTime: 1000     // Minimum 1 second between requests
});

// Root endpoint for debugging
router.get('/', (req, res) => {
    res.json({ 
        message: 'Compare router root endpoint', 
        availableEndpoints: ['/compare', '/test-image-comparison', '/image-analysis'],
        timestamp: new Date().toISOString() 
    });
});

// Test endpoint for enhanced image comparison
router.post('/test-image-comparison', async (req, res) => {
    try {
        const { baseImageUrl, compImageUrl } = req.body;
        
        if (!baseImageUrl || !compImageUrl) {
            return res.status(400).json({ 
                error: 'Missing required parameters', 
                required: ['baseImageUrl', 'compImageUrl'] 
            });
        }

        console.log(`[TEST] Testing enhanced image comparison:`);
        console.log(`   Base: ${baseImageUrl}`);
        console.log(`   Compare: ${compImageUrl}`);

        const enhancedComparator = new EnhancedImageComparator();
        const result = await enhancedComparator.compareImages(baseImageUrl, compImageUrl);

        res.json({
            success: true,
            result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[TEST ERROR] Enhanced image comparison test failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Image analysis endpoint
router.post('/image-analysis', async (req, res) => {
    try {
        const { imageUrl } = req.body;
        
        if (!imageUrl) {
            return res.status(400).json({ 
                error: 'Missing required parameter', 
                required: ['imageUrl'] 
            });
        }

        console.log(`[ANALYSIS] Analyzing image: ${imageUrl}`);

        const enhancedComparator = new EnhancedImageComparator();
        const result = await enhancedComparator.analyzeImage(imageUrl);

        res.json({
            success: true,
            result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[ANALYSIS ERROR] Image analysis failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Status endpoint for enhanced image comparator
router.get('/status', (req, res) => {
    try {
        const enhancedComparator = new EnhancedImageComparator();
        const status = enhancedComparator.getStatus();
        
        res.json({
            success: true,
            status,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[STATUS ERROR] Status check failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/compare', async (req, res) => {
    // Set a reasonable timeout for the entire request
    const requestTimeout = setTimeout(() => {
        console.error('[TIMEOUT] Request timed out after 15 minutes');
        if (!res.headersSent) {
            res.status(408).json({ 
                error: 'Request timeout', 
                message: 'The comparison process took too long and timed out' 
            });
        }
    }, 900000); // 15 minutes timeout

    try {
        console.log('[INIT] Received compare request');
        const globalStart = Date.now();
        let urls = [];
        const { type } = req.body;
        console.log(`[INFO] Input type: ${type}`);

        // Get URLs based on input type
        switch (type) {
            case 'sheet':
                if (!req.body.sheetId) return res.status(400).json({ error: 'Sheet ID required for sheet type' });
                console.log(`[STEP] Reading from Google Sheet (sheetId: ${req.body.sheetId}, gid: ${req.body.gid || 0})`);
                try {
                    urls = await readPublicSheet(req.body.sheetId, req.body.gid || 0);

                } catch (error) {
                    console.error(`[ERROR] Failed to read Google Sheet: ${error.message}`);
                    clearTimeout(requestTimeout);
                    return res.status(400).json({ 
                        error: 'Failed to read Google Sheet', 
                        details: error.message,
                        suggestion: 'Please check that the sheet ID is correct and the sheet is publicly accessible'
                    });
                }
                break;

            case 'csv':
                if (!req.body.csvPath) return res.status(400).json({ error: 'CSV path required for CSV type' });
                console.log(`[STEP] Reading from CSV at path: ${req.body.csvPath}`);
                try {
                    urls = await readCSV(req.body.csvPath);
                } catch (error) {
                    console.error(`[ERROR] Failed to read CSV: ${error.message}`);
                    return res.status(400).json({ 
                        error: 'Failed to read CSV file', 
                        details: error.message 
                    });
                }
                break;

            case 'url':
                if (!req.body.url) return res.status(400).json({ error: 'URL required for URL type' });
                console.log(`[STEP] Received direct URLs`);
                urls = Array.isArray(req.body.url) ? req.body.url : [req.body.url];
                break;

            default:
                return res.status(400).json({ error: 'Invalid type specified. Use "sheet", "csv", or "url"' });
        }

        console.log(`[INFO] Total URLs fetched: ${urls.length}`);
        // Validate URLs
        console.log('[STEP] Starting URL validation...');
        const validUrls = urls.filter(url => {
            const isValid = validateURL(url);
            if (!isValid) {
                console.warn(`[WARN] Invalid URL skipped: ${url}`);
            }
            return isValid;
        });

        console.log(`[STEP] URL validation completed. Valid URLs: ${validUrls.length}/${urls.length}`);
        console.log(`[STEP] Valid URLs:`, validUrls);
        
        if (validUrls.length === 0) return res.status(400).json({ error: 'No valid URLs provided' });

        // Process URLs in batches with rate limiting
        console.log('[STEP] Starting batch processing');
        const allResults = [];
        
        // Process URLs in batches of 5
        const batchSize = 5;
        for (let i = 0; i < validUrls.length; i += batchSize) {
            const batch = validUrls.slice(i, i + batchSize);
            console.log(`[BATCH] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(validUrls.length/batchSize)} (${batch.length} URLs)`);
            
            // Process batch concurrently with rate limiting
            const batchPromises = batch.map((url, index) => 
                limiter.schedule(async () => {
                    const urlIndex = i + index + 1;
                    console.log(`[URL ${urlIndex}/${validUrls.length}] Processing: ${url}`);
                    return await processSingleUrl(url, urlIndex, validUrls.length);
                })
            );
            
            const batchResults = await Promise.allSettled(batchPromises);
            
            console.log(`[BATCH] Batch ${Math.floor(i/batchSize) + 1} results:`, batchResults.map((result, index) => ({
                url: batch[index],
                status: result.status,
                value: result.value,
                reason: result.reason?.message
            })));
            
            // Collect successful results
            batchResults.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    console.log(`[BATCH] Successfully processed URL ${batch[index]}:`, result.value);
                    allResults.push(result.value);
                } else {
                    console.warn(`[WARN] Failed to process URL ${batch[index]}:`, result.reason?.message || 'Unknown error');
                    if (result.reason) {
                        console.error(`[ERROR] Full error for ${batch[index]}:`, result.reason);
                    }
                }
            });
            
            // Small delay between batches
            if (i + batchSize < validUrls.length) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        console.log(`[STEP] Batch processing completed. Total results: ${allResults.length}`);
        
        if (allResults.length === 0) {
            console.warn('[WARN] No valid results generated');
            clearTimeout(requestTimeout);
            return res.status(404).json({ 
                error: 'No valid results generated',
                details: 'All URLs failed to process. Check the logs for specific error details.',
                suggestion: 'Verify that the URLs are accessible and contain valid product information.'
            });
        }
        
        // Filter out any null results that might have slipped through
        const validResults = allResults.filter(result => result !== null);
        console.log(`[STEP] Valid results after filtering: ${validResults.length}/${allResults.length}`);
        
        if (validResults.length === 0) {
            console.warn('[WARN] All results were null after filtering');
            clearTimeout(requestTimeout);
            return res.status(404).json({ 
                error: 'No valid results generated',
                details: 'All results were null after processing. Check the logs for specific error details.',
                suggestion: 'Verify that the scraping functions are working correctly.'
            });
        }
        
        // Generate CSV output
        console.log('[STEP] Generating output CSV');
        const outputData = validResults.flatMap(result =>
            result ? createOutputData(
                result.baseProduct, 
                result.competitors,
                result.hasMatches, 
                result.totalCompetitors, 
                result.similarityThreshold
            ) : []
        );

        if (outputData.length === 0) {
            console.warn('[WARN] No valid output data generated');
            clearTimeout(requestTimeout);
            return res.status(404).json({ 
                error: 'No valid output data generated',
                details: 'CSV generation failed to produce any rows. Check the logs for specific error details.',
                suggestion: 'Verify that the createOutputData function is working correctly.'
            });
        }
        
        console.log(`[CSV] Generated ${outputData.length} CSV rows`);

        try {
            // Generate CSV file
            const { filename, filePath } = await generateCSV(outputData);

            // Clean up old files (run in background)
            if (typeof cleanupOldFiles === 'function') {
                cleanupOldFiles().catch(console.error);
            }

            console.log(`[DONE] CSV file created: ${filePath}`);
            console.log(`[TOTAL TIME] All URLs processed in ${(Date.now() - globalStart) / 1000}s`);

            clearTimeout(requestTimeout);
            res.json({
                success: true,
                filename,
                totalProcessed: validResults.length,
                totalOutputRows: outputData.length,
                message: `Successfully processed ${validResults.length} URLs and generated ${outputData.length} CSV rows`,
                timestamp: new Date().toISOString()
            });

        } catch (csvError) {
            console.error('[ERROR] CSV generation failed:', csvError);
            clearTimeout(requestTimeout);
            res.status(500).json({
                success: false,
                error: 'Failed to generate CSV',
                details: csvError.message,
                suggestion: 'Check that the output directory is writable and the CSV generation function is working correctly.'
            });
        }
    } catch (error) {
        console.error('[ERROR] Internal server error:', error);
        console.error('[ERROR] Error stack:', error.stack);
        clearTimeout(requestTimeout);
        res.status(500).json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Process a single URL with all steps
async function processSingleUrl(url, urlIndex, totalUrls) {
    const urlStart = Date.now();
    
    try {
        console.log(`[URL ${urlIndex}/${totalUrls}] Starting processing for: ${url}`);
        
        // Step 1: Scrape base product
        console.log(`[URL ${urlIndex}/${totalUrls}] Step 1: Scraping base product...`);
        const baseProduct = await scrapeBaseProduct(url);
        
        console.log(`[URL ${urlIndex}/${totalUrls}] Base product result:`, baseProduct);
        
        if (!baseProduct) {
            console.warn(`[WARN] Failed to scrape base product: ${url}`);
            return null;
        }

        if (!baseProduct.title) {
            console.warn(`[WARN] Base product has no title: ${url}`);
            return null;
        }

        console.log(`[URL ${urlIndex}/${totalUrls}] Base product scraped successfully: ${baseProduct.title}`);
        
        // Check if base product has an image for comparison
        if (!baseProduct.image) {
            console.warn(`[WARN] Base product has no image, skipping competitor scraping for: ${url}`);
            return { 
                baseProduct, 
                competitors: [], 
                filteredCompetitors: [],
                hasMatches: false,
                totalCompetitors: 0,
                similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD || 0.4)
            };
        }

        // Step 2: Fetch SERP results
        console.log(`[URL ${urlIndex}/${totalUrls}] Step 2: Fetching SERP results...`);
        console.log(`[URL ${urlIndex}/${totalUrls}] Using search term: "${baseProduct.searchTerm}"`);
        
        let serpResults = [];
        try {
            if (!baseProduct.searchTerm || baseProduct.searchTerm.trim() === '') {
                throw new Error('No search term available for SERP lookup');
            }
            
            serpResults = await fetchSerpResults(baseProduct.searchTerm);
            console.log(`[URL ${urlIndex}/${totalUrls}] Found ${serpResults.length} SERP results`);
            
            // Log some sample results for debugging
            if (serpResults.length > 0) {
                console.log(`[URL ${urlIndex}/${totalUrls}] Sample SERP results:`, serpResults.slice(0, 2).map(r => ({
                    url: r.url,
                    title: r.title?.substring(0, 50) + '...',
                    position: r.position
                })));
            }
            
        } catch (serpError) {
            console.error(`[ERROR] SERP API failed for ${url}:`, serpError.message);
            console.error(`[ERROR] SERP error details:`, serpError);
            console.warn(`[WARN] Continuing without competitor analysis`);
            // Return a result with no competitors instead of failing completely
            return { 
                baseProduct, 
                competitors: [], 
                filteredCompetitors: [],
                hasMatches: false,
                totalCompetitors: 0,
                similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD || 0.4)
            };
        }
        
        if (!serpResults || serpResults.length === 0) {
            console.warn(`[WARN] No SERP results found for: ${url}`);
            // Return a result with no competitors instead of failing completely
            return { 
                baseProduct, 
                competitors: [], 
                filteredCompetitors: [],
                hasMatches: false,
                totalCompetitors: 0,
                similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD || 0.4)
            };
        }
        
        console.log(`[URL ${urlIndex}/${totalUrls}] Found ${serpResults.length} competitor URLs`);

        // Step 3: Scrape competitors
        console.log(`[URL ${urlIndex}/${totalUrls}] Step 3: Scraping ${serpResults.length} competitors...`);
        const competitors = [];
        const maxCompetitors = Math.min(serpResults.length, parseInt(process.env.MAX_COMPETITORS) || 5);
        
        for (let i = 0; i < maxCompetitors; i++) {
            try {
                const result = serpResults[i];
                console.log(`[URL ${urlIndex}/${totalUrls}] Scraping competitor ${i + 1}/${maxCompetitors}: ${result.url}`);
                
                const compData = await scrapeCompetitor(result.url);
                console.log(`[URL ${urlIndex}/${totalUrls}] Competitor scraping result:`, {
                    url: result.url,
                    hasCompData: !!compData,
                    hasImage: compData ? !!compData.compImage : false,
                    imageUrl: compData ? compData.compImage : null,
                    method: compData ? compData.method : null
                });
                
                if (!compData || !compData.compImage) {
                    console.log(`[URL ${urlIndex}/${totalUrls}] Competitor ${i + 1} has no image, skipping`);
                    continue;
                }
                
                // Compare images using enhanced comparator (IMAGGA + fallback)
                let imageSimilarity = null;
                let hybridSimilarity = null;
                let imageComparisonResult = null;
                
                try {
                    const enhancedComparator = new EnhancedImageComparator();
                    imageComparisonResult = await enhancedComparator.compareImages(baseProduct.image, compData.compImage);
                    
                    if (imageComparisonResult && imageComparisonResult.similarity !== null) {
                        imageSimilarity = imageComparisonResult.similarity;
                        console.log(`[URL ${urlIndex}/${totalUrls}] Enhanced image comparison completed:`, {
                            score: imageSimilarity.toFixed(3),
                            method: imageComparisonResult.method,
                            confidence: imageComparisonResult.confidence,
                            fallbackUsed: imageComparisonResult.fallbackUsed || false,
                            duration: imageComparisonResult.duration || 'N/A'
                        });
                        
                        // Log additional details if available
                        if (imageComparisonResult.tagSimilarity !== undefined) {
                            console.log(`[URL ${urlIndex}/${totalUrls}]   Tag similarity: ${imageComparisonResult.tagSimilarity.toFixed(3)}`);
                        }
                        if (imageComparisonResult.colorSimilarity !== undefined) {
                            console.log(`[URL ${urlIndex}/${totalUrls}]   Color similarity: ${imageComparisonResult.colorSimilarity.toFixed(3)}`);
                        }
                    } else {
                        throw new Error('Enhanced comparison returned null result');
                    }
                    
                    // Calculate hybrid similarity combining image and text
                    hybridSimilarity = calculateHybridSimilarity(baseProduct, compData, imageSimilarity, {
                        imageWeight: parseFloat(process.env.IMAGE_WEIGHT || 0.7),
                        textWeight: parseFloat(process.env.TEXT_WEIGHT || 0.3),
                        minImageScore: parseFloat(process.env.MIN_IMAGE_SCORE || 0.1),
                        minTextScore: parseFloat(process.env.MIN_TEXT_SCORE || 0.05)
                    });
                    
                    console.log(`[URL ${urlIndex}/${totalUrls}] Hybrid similarity calculated:`, {
                        finalScore: hybridSimilarity.finalScore.toFixed(3),
                        imageScore: hybridSimilarity.imageScore.toFixed(3),
                        textScore: hybridSimilarity.textScore.toFixed(3),
                        classification: getSimilarityClassification(hybridSimilarity.finalScore)
                    });
                    
                } catch (imageError) {
                    console.warn(`[WARN] Enhanced image comparison failed for ${result.url}: ${imageError.message}`);
                    // Fallback to text-only similarity if image comparison fails
                    hybridSimilarity = calculateHybridSimilarity(baseProduct, compData, 0, {
                        imageWeight: 0,
                        textWeight: 1.0,
                        minImageScore: 0,
                        minTextScore: 0.05
                    });
                    console.log(`[URL ${urlIndex}/${totalUrls}] Using text-only similarity as fallback: ${hybridSimilarity.finalScore.toFixed(3)}`);
                }
                
                if (hybridSimilarity && hybridSimilarity.finalScore !== null) {
                    competitors.push({ 
                        ...result, 
                        ...compData, 
                        similarityScore: hybridSimilarity.finalScore,
                        imageSimilarity: hybridSimilarity.imageScore,
                        textSimilarity: hybridSimilarity.textScore,
                        similarityBreakdown: hybridSimilarity.breakdown,
                        similarityClassification: getSimilarityClassification(hybridSimilarity.finalScore),
                        // Enhanced comparison details
                        imageComparisonMethod: imageComparisonResult?.method || 'unknown',
                        imageComparisonConfidence: imageComparisonResult?.confidence || 'unknown',
                        imageComparisonFallback: imageComparisonResult?.fallbackUsed || false,
                        imageComparisonDuration: imageComparisonResult?.duration || null,
                        // Additional IMAGGA details if available
                        tagSimilarity: imageComparisonResult?.tagSimilarity,
                        colorSimilarity: imageComparisonResult?.colorSimilarity
                    });
                } else {
                    console.log(`[URL ${urlIndex}/${totalUrls}] Competitor ${i + 1} has no valid similarity score, skipping`);
                }
                
                // Small delay between competitors
                if (i < maxCompetitors - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
            } catch (error) {
                console.error(`[ERROR] Competitor scrape failed for ${result.url}:`, error.message);
                // Continue with other competitors instead of failing completely
                continue;
            }
        }

        // Filter competitors by similarity threshold
        const similarityThreshold = parseFloat(process.env.SIMILARITY_THRESHOLD || 0.4);
        const filteredCompetitors = competitors.filter(comp => {
            if (!comp || comp.similarityScore === null || comp.similarityScore === undefined) {
                return false;
            }
            const meetsThreshold = comp.similarityScore >= similarityThreshold;
            if (!meetsThreshold) {
                console.log(`[FILTER] Excluding competitor ${comp.url} - similarity score ${comp.similarityScore} below threshold ${similarityThreshold}`);
            }
            return meetsThreshold;
        });

        console.log(`[FILTER] Filtered ${competitors.length} competitors to ${filteredCompetitors.length} above threshold ${similarityThreshold}`);

        const hasMatches = filteredCompetitors.length > 0;
        const urlTime = (Date.now() - urlStart) / 1000;
        console.log(`[TIME] Total time for ${url} took ${urlTime}s`);

        // Always return a valid result, even if no competitors were found
        const finalResult = { 
            baseProduct, 
            competitors: competitors,
            filteredCompetitors: filteredCompetitors,
            hasMatches,
            totalCompetitors: competitors.length,
            similarityThreshold
        };
        
        console.log(`[URL ${urlIndex}/${totalUrls}] Successfully processed URL with ${competitors.length} competitors, ${filteredCompetitors.length} above threshold`);
        return finalResult;
        
    } catch (error) {
        console.error(`[ERROR] Failed processing URL: ${url}`);
        console.error(`[ERROR] Error message: ${error.message}`);
        return null;
    }
}

// Add error handling for unhandled promise rejections in this route
process.on('unhandledRejection', (reason, promise) => {
    console.error('[UNHANDLED REJECTION] in compare route:', reason);
    console.error('[UNHANDLED REJECTION] Promise:', promise);
});

// Download endpoint
router.get('/download/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const outputDir = path.join(__dirname, '../output');
        const filePath = path.join(outputDir, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        // Set proper headers for file download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Stream the file
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);

        fileStream.on('error', (err) => {
            console.error('[ERROR] File stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    error: 'Failed to stream file'
                });
            }
        });

    } catch (error) {
        console.error('[ERROR] Download endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

module.exports = router;
