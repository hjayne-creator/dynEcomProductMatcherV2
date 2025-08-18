const stringSimilarity = require('string-similarity');

/**
 * Calculate word overlap similarity between two titles
 * @param {string} title1 - First title
 * @param {string} title2 - Second title
 * @returns {number} Word overlap score (0-1)
 */
const calculateWordOverlap = (title1, title2) => {
    // Clean and split titles into words
    const words1 = title1.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(word => word.length > 1);
    const words2 = title2.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(word => word.length > 1);
    
    if (words1.length === 0 || words2.length === 0) {
        console.log(`[WORD_OVERLAP] Empty word arrays - words1: ${words1.length}, words2: ${words2.length}`);
        return 0;
    }
    
    // Find common words (case-insensitive)
    const commonWords = words1.filter(word => 
        words2.some(compWord => compWord.toLowerCase() === word.toLowerCase())
    );
    
    // Calculate both Jaccard and simple overlap for better coverage
    const uniqueWords = [...new Set([...words1, ...words2])];
    const jaccardScore = commonWords.length / uniqueWords.length;
    
    // Simple overlap score: common words / average length
    const avgLength = (words1.length + words2.length) / 2;
    const simpleOverlapScore = commonWords.length / avgLength;
    
    // Return the higher of the two scores for better sensitivity
    const finalScore = Math.max(jaccardScore, simpleOverlapScore);
    
    console.log(`[WORD_OVERLAP] Calculation details:`);
    console.log(`  - Words1: [${words1.join(', ')}] (${words1.length})`);
    console.log(`  - Words2: [${words2.join(', ')}] (${words2.length})`);
    console.log(`  - Common words: [${commonWords.join(', ')}] (${commonWords.length})`);
    console.log(`  - Unique words: [${uniqueWords.join(', ')}] (${uniqueWords.length})`);
    console.log(`  - Jaccard score: ${jaccardScore.toFixed(3)}`);
    console.log(`  - Simple overlap: ${simpleOverlapScore.toFixed(3)}`);
    console.log(`  - Final score: ${finalScore.toFixed(3)}`);
    
    return finalScore;
};

/**
 * Calculate text-based similarity between base product and competitor
 * @param {Object} baseProduct - Base product data
 * @param {Object} competitor - Competitor product data
 * @returns {number} Text similarity score (0-1)
 */
const calculateTextSimilarity = (baseProduct, competitor) => {
    if (!baseProduct || !competitor) {
        console.warn('[TEXT_SIM] Missing product data for text similarity calculation');
        return 0;
    }

    // Title-only scoring (100% weight for title)
    const weights = {
        title: 1.0
    };

    let score = 0;
    let totalWeight = 0;

    // Enhanced title similarity using Word Overlap and Levenshtein (100% of text score)
    // Try multiple possible title fields for competitor
    const compTitle = competitor.metaTitle || competitor.title || competitor.name || '';
    
    if (baseProduct.title && compTitle) {
        const baseTitle = baseProduct.title.toLowerCase().trim();
        const compTitleLower = compTitle.toLowerCase().trim();
        
        // Skip calculation if titles are too short (likely not meaningful)
        if (baseTitle.length < 3 || compTitleLower.length < 3) {
            console.log(`[TEXT_SIM] Titles too short for meaningful comparison - base: "${baseTitle}" (${baseTitle.length}), comp: "${compTitleLower}" (${compTitleLower.length})`);
            return 0;
        }
        
        // Calculate similarity scores using only Word Overlap and Levenshtein
        const levenshteinScore = stringSimilarity.compareTwoStrings(baseTitle, compTitleLower);
        const wordOverlapScore = calculateWordOverlap(baseTitle, compTitleLower);
        
        // Weight the approaches: Word Overlap (60%) + Levenshtein (40%)
        const titleScore = (wordOverlapScore * 0.6) + (levenshteinScore * 0.4);
        
        score += titleScore * weights.title;
        totalWeight += weights.title;
        
        console.log(`[TEXT_SIM] Title similarity breakdown:`);
        console.log(`  - Base title: "${baseTitle}"`);
        console.log(`  - Comp title: "${compTitleLower}"`);
        console.log(`  - Word Overlap: ${wordOverlapScore.toFixed(3)} (weight: 0.6)`);
        console.log(`  - Levenshtein: ${levenshteinScore.toFixed(3)} (weight: 0.4)`);
        console.log(`  - Final Title Score: ${titleScore.toFixed(3)} (weight: ${weights.title})`);
        
        // Debug word overlap calculation
        const baseWords = baseTitle.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(word => word.length > 1);
        const compWords = compTitleLower.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(word => word.length > 1);
        const commonWords = baseWords.filter(word => 
            compWords.some(compWord => compWord.toLowerCase() === word.toLowerCase())
        );
        console.log(`[TEXT_SIM] Word analysis - Base words: [${baseWords.join(', ')}], Comp words: [${compWords.join(', ')}], Common: [${commonWords.join(', ')}]`);
        
    } else {
        console.log(`[TEXT_SIM] Missing title data - base: ${!!baseProduct.title}, competitor: ${!!compTitle}`);
        console.log(`[TEXT_SIM] Base product keys:`, Object.keys(baseProduct));
        console.log(`[TEXT_SIM] Competitor data keys:`, Object.keys(competitor));
        console.log(`[TEXT_SIM] Base title value:`, baseProduct.title);
        console.log(`[TEXT_SIM] Competitor title values:`, {
            metaTitle: competitor.metaTitle,
            title: competitor.title,
            name: competitor.name
        });
    }

    // Normalize score by total weight used
    const finalScore = totalWeight > 0 ? score / totalWeight : 0;
    console.log(`[TEXT_SIM] Final text similarity score: ${finalScore.toFixed(3)}`);
    
    return finalScore;
};

/**
 * Calculate hybrid similarity combining visual and textual similarity
 * @param {Object} baseProduct - Base product data
 * @param {Object} competitor - Competitor product data
 * @param {number} imageSimilarity - Visual similarity score (0-1)
 * @param {Object} options - Configuration options
 * @returns {Object} Hybrid similarity result
 */
const calculateHybridSimilarity = (baseProduct, competitor, imageSimilarity, options = {}) => {
    const {
        imageWeight = 0.6,      // Weight for visual similarity
        textWeight = 0.4,       // Weight for textual similarity
        minImageScore = 0.1,    // Minimum image score to consider
        minTextScore = 0.05     // Minimum text score to consider
    } = options;

    // Validate inputs
    if (!baseProduct || !competitor) {
        console.warn('[HYBRID_SIM] Missing product data for hybrid similarity calculation');
        return {
            finalScore: 0,
            imageScore: 0,
            textScore: 0,
            breakdown: {
                image: { score: 0, weight: imageWeight, contribution: 0 },
                text: { score: 0, weight: textWeight, contribution: 0 }
            }
        };
    }

    // Calculate text similarity
    const textScore = calculateTextSimilarity(baseProduct, competitor);

    // Validate image similarity
    const validImageScore = (imageSimilarity !== null && imageSimilarity !== undefined && 
                            !isNaN(imageSimilarity) && imageSimilarity >= 0 && imageSimilarity <= 1) 
                            ? imageSimilarity : 0;

    // Apply minimum thresholds
    const adjustedImageScore = validImageScore >= minImageScore ? validImageScore : 0;
    const adjustedTextScore = textScore >= minTextScore ? textScore : 0;

    // Calculate weighted final score
    const imageContribution = adjustedImageScore * imageWeight;
    const textContribution = adjustedTextScore * textWeight;
    const finalScore = imageContribution + textContribution;

    // Create detailed breakdown
    const result = {
        finalScore: Math.max(0, Math.min(1, finalScore)), // Clamp to 0-1
        imageScore: adjustedImageScore,
        textScore: adjustedTextScore,
        breakdown: {
            image: {
                score: adjustedImageScore,
                weight: imageWeight,
                contribution: imageContribution
            },
            text: {
                score: adjustedTextScore,
                weight: textWeight,
                contribution: textContribution
            }
        }
    };

    console.log(`[HYBRID_SIM] Final hybrid score: ${result.finalScore.toFixed(3)}`);
    console.log(`[HYBRID_SIM] Breakdown - Image: ${result.breakdown.image.contribution.toFixed(3)}, Text: ${result.breakdown.text.contribution.toFixed(3)}`);

    return result;
};

/**
 * Get similarity classification based on score
 * @param {number} score - Similarity score (0-1)
 * @returns {string} Classification description
 */
const getSimilarityClassification = (score) => {
    if (score >= 0.8) return 'Very Similar (likely same product)';
    if (score >= 0.6) return 'Similar (likely related products)';
    if (score >= 0.4) return 'Moderately Similar (some resemblance)';
    if (score >= 0.2) return 'Slightly Similar (minimal resemblance)';
    return 'Very Different (minimal resemblance)';
};

module.exports = {
    calculateTextSimilarity,
    calculateHybridSimilarity,
    getSimilarityClassification,
    calculateWordOverlap
};
