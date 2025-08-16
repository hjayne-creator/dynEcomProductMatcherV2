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

        // Use simpler field names without spaces
        const fields = [
            'base_url',
            'search_term',
            'result_type',
            'competitor_url',
            'similarity_score',
            'word_count',
            'prodImage',
            'compImage',
            'json_ld_found',
            'brand',
            'model',
            'gtin',
            'price',
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
            word_count: 'N/A',
            prodImage: baseProduct?.image || '',
            compImage: 'N/A',
            json_ld_found: 'N/A',
            brand: 'N/A',
            model: 'N/A',
            gtin: 'N/A',
            price: 'N/A',
            match_status: 'failed',
            total_competitors_checked: totalCompetitors,
            similarity_threshold: similarityThreshold
        }];
    }

    // Additional filtering to ensure only valid competitors with similarity scores are included
    const validCompetitors = competitors.filter(comp => {
        if (!comp || typeof comp !== 'object') return false;
        
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
        word_count: comp?.wordCount ?? '',
        prodImage: baseProduct?.image || '',
        compImage: comp?.compImage || '',
        json_ld_found: Array.isArray(comp?.jsonLd) && comp.jsonLd.length > 0 ? 'Yes' : 'No',
        brand: comp?.attributes?.brand || '',
        model: comp?.attributes?.model || '',
        gtin: comp?.attributes?.gtin || '',
        price: formatPrice(comp?.attributes?.price) || '',
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
