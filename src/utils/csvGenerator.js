const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');

const ensureOutputDirectory = () => {
    const outputDir = path.join(__dirname, '../output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    return outputDir;
};

const generateCSV = async (data, filename = `results_${Date.now()}.csv`) => {
    try {
        const outputDir = ensureOutputDirectory();
        const filePath = path.join(outputDir, filename);

        // Updated fields to include all new attributes
        const fields = [
            'base_url',
            'search_term',
            'result_type',
            'competitor_url',
            'similarity_score',
            'prodImage',
            'compImage',
            // Base product attributes
            'base_brand',
            'base_manufacturer',
            'base_model',
            'base_price',
            'base_gtin',
            'base_sku',
            'base_upc',
            'base_material',
            'base_color',
            'base_size',
            // Competitor product attributes
            'comp_brand',
            'comp_manufacturer',
            'comp_model',
            'comp_price',
            'comp_gtin',
            'comp_sku',
            'comp_upc',
            'comp_material',
            'comp_color',
            'comp_size',
            // Other
            'match_status',
            'total_competitors_checked',
            'similarity_threshold'
        ];

        const opts = {
            fields,
            quote: '', // Disable unnecessary quoting
            header: true
        };

        const parser = new Parser(opts);
        const csv = parser.parse(data);

        await fs.promises.writeFile(filePath, csv);
        return { filename, filePath };
    } catch (error) {
        console.error('CSV generation error:', error);
        throw new Error(`Failed to generate CSV: ${error.message}`);
    }
};

// ... rest of the file remains the same ...

const createOutputData = (baseProduct, competitors, hasMatches = true, totalCompetitors = 0, similarityThreshold = 0.4) => {
    // If no competitors or no matches found, create a special row indicating failure
    if (!competitors || !Array.isArray(competitors) || competitors.length === 0 || !hasMatches) {
        return [{
            base_url: baseProduct?.url || '',
            search_term: baseProduct?.searchTerm || baseProduct?.title || '',
            result_type: 'no_matches',
            competitor_url: 'N/A',
            similarity_score: 'N/A',
            prodImage: baseProduct?.image || '',
            compImage: 'N/A',
            json_ld_found: 'N/A',
            // Base product attributes
            base_brand: baseProduct?.brand || '',
            base_manufacturer: baseProduct?.manufacturer || '',
            base_model: baseProduct?.model || '',
            base_price: formatPrice(baseProduct?.price) || '',
            base_gtin: baseProduct?.gtin || '',
            base_sku: baseProduct?.sku || '',
            base_upc: baseProduct?.upc || '',
            base_material: baseProduct?.material || '',
            base_color: baseProduct?.color || '',
            base_size: baseProduct?.size || '',
            // Competitor attributes (N/A for no matches)
            comp_brand: 'N/A',
            comp_manufacturer: 'N/A',
            comp_model: 'N/A',
            comp_price: 'N/A',
            comp_gtin: 'N/A',
            comp_sku: 'N/A',
            comp_upc: 'N/A',
            comp_material: 'N/A',
            comp_color: 'N/A',
            comp_size: 'N/A',
            // Other fields
            match_status: 'failed',
            total_competitors_checked: totalCompetitors,
            similarity_threshold: similarityThreshold
        }];
    }

    // Additional filtering to ensure only valid competitors with similarity scores are included
    const validCompetitors = competitors.filter(comp => {
        if (!comp || typeof comp !== 'object') return false;
        
        // Check if competitor has basic required data
        if (!comp.url || !comp.compImage) {
            console.warn(`[CSV] Excluding competitor ${comp.url} - missing URL or image`);
            return false;
        }
        
        // Ensure similarity score exists and is a valid number
        const similarityScore = comp.similarityScore;
        if (similarityScore === null || similarityScore === undefined || 
            typeof similarityScore !== 'number' || isNaN(similarityScore)) {
            console.warn(`[CSV] Excluding competitor ${comp.url} - invalid similarity score: ${similarityScore}`);
            return false;
        }
        
        return true;
    });

    console.log(`[CSV] Processing ${validCompetitors.length} valid competitors for CSV generation`);

    // If no valid competitors with similarity scores, create a row with the best competitor data available
    if (validCompetitors.length === 0) {
        console.log(`[CSV] No competitors with valid similarity scores, creating fallback row`);
        
        // Find the best competitor data available (even without similarity score)
        const bestCompetitor = competitors.find(comp => comp && comp.url && comp.compImage);
        
        if (bestCompetitor) {
            return [{
                base_url: baseProduct?.url || '',
                search_term: baseProduct?.searchTerm || baseProduct?.title || '',
                result_type: bestCompetitor?.type || 'organic',
                competitor_url: bestCompetitor?.url || '',
                similarity_score: 'N/A',
                prodImage: baseProduct?.image || '',
                compImage: bestCompetitor?.compImage || '',
                json_ld_found: Array.isArray(bestCompetitor?.jsonLd) && bestCompetitor.jsonLd.length > 0 ? 'Yes' : 'No',
                // Base product attributes
                base_brand: baseProduct?.brand || '',
                base_manufacturer: baseProduct?.manufacturer || '',
                base_model: baseProduct?.model || '',
                base_price: formatPrice(baseProduct?.price) || '',
                base_gtin: baseProduct?.gtin || '',
                base_sku: baseProduct?.sku || '',
                base_upc: baseProduct?.upc || '',
                base_material: baseProduct?.material || '',
                base_color: baseProduct?.color || '',
                base_size: baseProduct?.size || '',
                // Competitor product attributes
                comp_brand: bestCompetitor?.attributes?.brand || '',
                comp_manufacturer: bestCompetitor?.attributes?.manufacturer || '',
                comp_model: bestCompetitor?.attributes?.model || '',
                comp_price: formatPrice(bestCompetitor?.attributes?.price) || '',
                comp_gtin: bestCompetitor?.attributes?.gtin || '',
                comp_sku: bestCompetitor?.attributes?.sku || '',
                comp_upc: bestCompetitor?.attributes?.upc || '',
                comp_material: bestCompetitor?.attributes?.material || '',
                comp_color: bestCompetitor?.attributes?.color || '',
                comp_size: bestCompetitor?.attributes?.size || '',
                // Other fields
                match_status: 'partial_success',
                total_competitors_checked: totalCompetitors,
                similarity_threshold: similarityThreshold
            }];
        }
        
        // If no competitor data at all, return the no_matches row
        return [{
            base_url: baseProduct?.url || '',
            search_term: baseProduct?.searchTerm || baseProduct?.title || '',
            result_type: 'no_matches',
            competitor_url: 'N/A',
            similarity_score: 'N/A',
            prodImage: baseProduct?.image || '',
            compImage: 'N/A',
            json_ld_found: 'N/A',
            // Base product attributes
            base_brand: baseProduct?.brand || '',
            base_manufacturer: baseProduct?.manufacturer || '',
            base_model: baseProduct?.model || '',
            base_price: formatPrice(baseProduct?.price) || '',
            base_gtin: baseProduct?.gtin || '',
            base_sku: baseProduct?.sku || '',
            base_upc: baseProduct?.upc || '',
            base_material: baseProduct?.material || '',
            base_color: baseProduct?.color || '',
            base_size: baseProduct?.size || '',
            // Competitor attributes (N/A for no matches)
            comp_brand: 'N/A',
            comp_manufacturer: 'N/A',
            comp_model: 'N/A',
            comp_price: 'N/A',
            comp_gtin: 'N/A',
            comp_sku: 'N/A',
            comp_upc: 'N/A',
            comp_material: 'N/A',
            comp_color: 'N/A',
            comp_size: 'N/A',
            // Other fields
            match_status: 'failed',
            total_competitors_checked: totalCompetitors,
            similarity_threshold: similarityThreshold
        }];
    }

    // Sort competitors by similarity score from high to low
    const sortedCompetitors = validCompetitors.sort((a, b) => {
        const scoreA = a.similarityScore || 0;
        const scoreB = b.similarityScore || 0;
        return scoreB - scoreA; // High to low
    });

    return sortedCompetitors.map(comp => ({
        base_url: baseProduct?.url || '',
        search_term: baseProduct?.searchTerm || baseProduct?.title || '',
        result_type: comp?.type || 'organic',
        competitor_url: comp?.url || '',
        similarity_score: comp?.similarityScore?.toFixed(4) || 'N/A',
        image_similarity: comp?.imageSimilarity?.toFixed(4) || 'N/A',
        text_similarity: comp?.textSimilarity?.toFixed(4) || 'N/A',
        similarity_classification: comp?.similarityClassification || 'N/A',
        prodImage: baseProduct?.image || '',
        compImage: comp?.compImage || '',
        json_ld_found: Array.isArray(comp?.jsonLd) && comp.jsonLd.length > 0 ? 'Yes' : 'No',
        // Base product attributes
        base_brand: baseProduct?.brand || '',
        base_manufacturer: baseProduct?.manufacturer || '',
        base_model: baseProduct?.model || '',
        base_price: formatPrice(baseProduct?.price) || '',
        base_gtin: baseProduct?.gtin || '',
        base_sku: baseProduct?.sku || '',
        base_upc: baseProduct?.upc || '',
        base_material: baseProduct?.material || '',
        base_color: baseProduct?.color || '',
        base_size: baseProduct?.size || '',
        // Competitor product attributes
        comp_brand: comp?.attributes?.brand || '',
        comp_manufacturer: comp?.attributes?.manufacturer || '',
        comp_model: comp?.attributes?.model || '',
        comp_price: formatPrice(comp?.attributes?.price) || '',
        comp_gtin: comp?.attributes?.gtin || '',
        comp_sku: comp?.attributes?.sku || '',
        comp_upc: comp?.attributes?.upc || '',
        comp_material: comp?.attributes?.material || '',
        comp_color: comp?.attributes?.color || '',
        comp_size: comp?.attributes?.size || '',
        // Other fields
        match_status: 'success',
        total_competitors_checked: totalCompetitors,
        similarity_threshold: similarityThreshold
    }));
};

const formatPrice = (price) => {
    if (!price) return '';
    if (typeof price === 'string') {
        // Clean price strings like "$12.99" or "USD 19.99"
        return price.replace(/[^\d.,]/g, '');
    }
    if (typeof price === 'number') {
        return price.toFixed(2);
    }
    return '';
};

const cleanupOldFiles = async (maxAgeHours = 24) => {
    try {
        const outputDir = ensureOutputDirectory();
        const files = await fs.promises.readdir(outputDir);
        const now = Date.now();
        const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

        for (const file of files) {
            if (file.startsWith('results_') && file.endsWith('.csv')) {
                const filePath = path.join(outputDir, file);
                const stats = await fs.promises.stat(filePath);
                if (now - stats.mtimeMs > maxAgeMs) {
                    await fs.promises.unlink(filePath);
                    console.log(`Cleaned up old file: ${file}`);
                }
            }
        }
    } catch (error) {
        console.error('File cleanup error:', error);
    }
};

module.exports = {
    generateCSV,
    createOutputData,
    cleanupOldFiles
};
