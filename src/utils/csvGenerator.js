const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');

const generateCSV = (data, filename = 'output.csv') => {
    try {
        const outputDir = path.join(__dirname, '../output');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

        const filePath = path.join(outputDir, filename);
        const parser = new Parser();
        const csv = parser.parse(data);

        fs.writeFileSync(filePath, csv);
        return filePath;
    } catch (error) {
        throw new Error(`CSV generation failed: ${error.message}`);
    }
};

const createOutputData = (baseProduct, competitors) => {
    return competitors
        .filter(Boolean) // remove null/undefined competitors
        .map(comp => ({
            base_url: baseProduct?.url || '',
            search_term: baseProduct?.searchTerm || '',
            result_type: comp?.type || '',
            competitor_url: comp?.url || '',
            similarity_score: comp?.similarityScore ?? 'N/A',
            word_count: comp?.wordCount ?? '',
            prodImage: baseProduct?.image || '',
            compImage: comp?.compImage || '',
            json_ld_found: Array.isArray(comp?.jsonLd) && comp.jsonLd.length > 0 ? 'Yes' : 'No',
            brand: comp?.attributes?.brand || '',
            model: comp?.attributes?.model || '',
            gtin: comp?.attributes?.gtin || '',
            price: comp?.attributes?.price || ''
        }));
};

module.exports = { generateCSV, createOutputData };
