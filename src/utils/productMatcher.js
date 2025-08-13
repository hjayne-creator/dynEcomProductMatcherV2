// Add to src/utils/productMatcher.js
const calculateSimilarity = (baseProduct, competitor) => {
    // Weighted scoring (adjust weights as needed)
    const weights = {
        title: 0.4,
        brand: 0.2,
        model: 0.15,
        gtin: 0.15,
        price: 0.1
    };

    let score = 0;

    // Title similarity (Levenshtein distance)
    score += stringSimilarity.compareTwoStrings(
        baseProduct.title.toLowerCase(),
        competitor.metaTitle.toLowerCase()
    ) * weights.title;

    // Exact match bonuses
    if (baseProduct.brand && competitor.attributes.brand) {
        score += (baseProduct.brand === competitor.attributes.brand) ? weights.brand : 0;
    }

    if (baseProduct.model && competitor.attributes.model) {
        score += (baseProduct.model === competitor.attributes.model) ? weights.model : 0;
    }

    if (baseProduct.gtin && competitor.attributes.gtin) {
        score += (baseProduct.gtin === competitor.attributes.gtin) ? weights.gtin : 0;
    }

    return Math.min(Math.round(score * 100), 100); // Cap at 100
};
