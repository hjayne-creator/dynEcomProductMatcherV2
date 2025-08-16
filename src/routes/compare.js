const express = require('express');
const router = express.Router();
const { readCSV, validateURL } = require('../utils/csvReader');
const { scrapeBaseProduct } = require('../utils/baseScraper');
const fetchSerpResults = require('../utils/serpFetcher');
const scrapeCompetitor = require('../utils/competitorScraper');
const { compareImages } = require('../utils/imageComparator');
const { readPublicSheet } = require('../utils/publicSheetReader');
const { extractLdAttributes } = require('../utils/jsonLdParser');
const { generateCSV, createOutputData, cleanupOldFiles } = require('../utils/csvGenerator');
const path = require("path");
const fs = require("fs");

router.post('/compare', async (req, res) => {
    try {
        console.log('[INIT] Received compare request');
        const globalStart = Date.now();
        let urls = [];
        const { type } = req.body;
        console.log(`[INFO] Input type: ${type}`);

        switch (type) {
            case 'sheet':
                if (!req.body.sheetId) return res.status(400).json({ error: 'Sheet ID required for sheet type' });
                console.log(`[STEP] Reading from Google Sheet (sheetId: ${req.body.sheetId}, gid: ${req.body.gid || 0})`);
                urls = await readPublicSheet(req.body.sheetId, req.body.gid || 0);
                break;

            case 'csv':
                if (!req.body.csvPath) return res.status(400).json({ error: 'CSV path required for CSV type' });
                console.log(`[STEP] Reading from CSV at path: ${req.body.csvPath}`);
                urls = await readCSV(req.body.csvPath);
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
        const validUrls = urls.filter(url => {
            const isValid = validateURL(url);
            if (!isValid) console.warn(`[WARN] Invalid URL skipped: ${url}`);
            return isValid;
        });

        console.log(`[INFO] Valid URLs to process: ${validUrls.length}`);
        if (validUrls.length === 0) return res.status(400).json({ error: 'No valid URLs provided' });

        const allResults = [];
        const concurrencyLimit = 1;
        const batches = [];

        for (let i = 0; i < validUrls.length; i += concurrencyLimit) {
            batches.push(validUrls.slice(i, i + concurrencyLimit));
        }

        console.log(`[STEP] Starting batch processing: ${batches.length} batches`);

        for (const [batchIndex, batch] of batches.entries()) {
            console.log(`[BATCH ${batchIndex + 1}] Processing batch of ${batch.length} URLs`);
            const batchResults = await Promise.all(
                batch.map(async (url) => {
                    const urlStart = Date.now();
                    try {
                        console.log(`[URL] Processing base URL: ${url}`);
                        const baseStart = Date.now();
                        const baseProduct = await scrapeBaseProduct(url);

                        const baseTime = (Date.now() - baseStart) / 1000;
                        console.log(`[TIME] Base scrape for ${url} took ${baseTime}s`);
                        if (!baseProduct) {
                            console.warn(`[WARN] Failed to scrape base product: ${url}`);
                            return null;
                        }

                        console.log(`[SCRAPE] Base product scraped: ${baseProduct.name || baseProduct.searchTerm}`);
                        console.log(`[SEARCH] Using optimized search term: "${baseProduct.searchTerm}"`);

                        const serpStart = Date.now();
                        const serpResults = await fetchSerpResults(baseProduct.searchTerm);
                        const serpTime = (Date.now() - serpStart) / 1000;
                        console.log(`[TIME] SERP fetch for ${url} took ${serpTime}s`);

                        if (!serpResults || serpResults.length === 0) {
                            console.warn(`[WARN] No SERP results for: ${url}`);
                            return null;
                        }
                        console.log(`[SERP] ${serpResults.length} competitor URLs found for: ${url}`);

                        const competitors = await Promise.all(
                            serpResults.map(async (result) => {
                                try {
                                    console.log(`[COMP] Scraping competitor: ${result.url}`);
                                    const compData = await scrapeCompetitor(result.url);
                                    if (!compData || !compData.compImage) {
                                        console.warn(`[WARN] No competitor image for: ${result.url}`);
                                        return null;
                                    }

                                    const similarityScore = await compareImages(baseProduct.image, compData.compImage);
                                    const attributes = extractLdAttributes(compData.jsonLd);

                                    return { ...result, ...compData, attributes, similarityScore };
                                } catch (error) {
                                    console.error(`[ERROR] Competitor scrape failed: ${result.url}`, error.message);
                                    return null;
                                }
                            })
                        );

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

                        // Track if this URL failed to produce any matches
                        const hasMatches = filteredCompetitors.length > 0;
                        if (!hasMatches) {
                            console.log(`[WARN] No matches found for ${url} - all ${competitors.length} competitors below threshold ${similarityThreshold}`);
                        }

                        const urlTime = (Date.now() - urlStart) / 1000;
                        console.log(`[TIME] Total time for ${url} took ${urlTime}s`);

                        return { 
                            baseProduct, 
                            competitors: filteredCompetitors,
                            hasMatches,
                            totalCompetitors: competitors.length,
                            similarityThreshold
                        };
                    } catch (error) {
                        console.log(error)
                        console.error(`[ERROR] Failed processing URL: ${url}`, error.message);
                        return null;
                    }
                })
            );

            allResults.push(...batchResults.filter(Boolean));
            console.log(`[BATCH ${batchIndex + 1}] Completed`);
        }

        console.log('[STEP] Generating output CSV');
        
        // Log summary of filtering results
        const totalCompetitors = allResults.reduce((sum, result) => 
            sum + (result?.competitors?.length || 0), 0
        );
        const totalResults = allResults.length;
        console.log(`[SUMMARY] Processed ${totalResults} base products with ${totalCompetitors} total competitors`);
        
        const outputData = allResults.flatMap(result =>
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
            return res.status(404).json({ error: 'No valid results generated' });
        }
        
        console.log(`[CSV] Generated ${outputData.length} CSV rows after similarity filtering`);

        try {
            // Generate CSV file
            const { filename, filePath } = await generateCSV(outputData);

            // Clean up old files (run in background)
            if (typeof cleanupOldFiles === 'function') {
                cleanupOldFiles().catch(console.error);
            }

            console.log(`[DONE] CSV file created: ${filePath}`);
            console.log(`[TOTAL TIME] All URLs processed in ${(Date.now() - globalStart) / 1000}s`);

            // Return only filename in JSON response
            res.json({
                success: true,
                filename
            });

        } catch (csvError) {
            console.error('[ERROR] CSV generation failed:', csvError);
            res.status(500).json({
                success: false,
                error: 'Failed to generate CSV',
                details: csvError.message
            });
        }
    } catch (error) {
        console.error('[ERROR] Internal server error:', error);
        res.status(500).json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

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
