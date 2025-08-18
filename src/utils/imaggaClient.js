const axios = require('axios');
const FormData = require('form-data');

class ImaggaClient {
    constructor() {
        this.apiKey = process.env.IMAGGA_API_KEY;
        this.apiSecret = process.env.IMAGGA_API_SECRET;
        this.baseUrl = 'https://api.imagga.com/v2';
        
        if (!this.apiKey || !this.apiSecret) {
            console.warn('IMAGGA API credentials not found. Image similarity will fall back to perceptual hashing.');
        }
    }

    /**
     * Check if IMAGGA is available and configured
     */
    isAvailable() {
        return !!(this.apiKey && this.apiSecret);
    }

    /**
     * Get authentication headers for IMAGGA API
     */
    getAuthHeaders() {
        if (!this.isAvailable()) {
            throw new Error('IMAGGA API not configured');
        }
        
        return {
            'Authorization': `Basic ${Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64')}`
        };
    }

    /**
     * Extract image tags and categories
     */
    async extractTags(imageUrl) {
        try {
            if (!this.isAvailable()) {
                throw new Error('IMAGGA API not configured');
            }

            const response = await axios.get(`${this.baseUrl}/tags`, {
                params: {
                    image_url: imageUrl,
                    limit: 20,
                    threshold: process.env.IMAGGA_MIN_CONFIDENCE || 0.3
                },
                headers: this.getAuthHeaders()
            });

            if (response.data && response.data.result) {
                return response.data.result.tags.map(tag => ({
                    tag: tag.tag.en,
                    confidence: tag.confidence
                }));
            }
            
            return [];
        } catch (error) {
            console.error(`IMAGGA tag extraction failed for ${imageUrl}:`, error.message);
            throw error;
        }
    }

    /**
     * Extract dominant colors from image
     */
    async extractColors(imageUrl) {
        try {
            if (!this.isAvailable()) {
                throw new Error('IMAGGA API not configured');
            }

            const response = await axios.get(`${this.baseUrl}/colors`, {
                params: {
                    image_url: imageUrl,
                    extract_overall_colors: 1
                },
                headers: this.getAuthHeaders()
            });

            if (response.data && response.data.result) {
                return {
                    dominant: response.data.result.colors.dominant_colors || [],
                    overall: response.data.result.colors.overall_colors || []
                };
            }
            
            return { dominant: [], overall: [] };
        } catch (error) {
            console.error(`IMAGGA color extraction failed for ${imageUrl}:`, error.message);
            throw error;
        }
    }

    /**
     * Find visually similar images
     */
    async findSimilarImages(imageUrl, limit = 10) {
        try {
            if (!this.isAvailable()) {
                throw new Error('IMAGGA API not configured');
            }

            const response = await axios.get(`${this.baseUrl}/similarity`, {
                params: {
                    image_url: imageUrl,
                    limit: limit
                },
                headers: this.getAuthHeaders()
            });

            if (response.data && response.data.result) {
                return response.data.result.similar_images.map(img => ({
                    url: img.url,
                    similarity: img.similarity
                }));
            }
            
            return [];
        } catch (error) {
            console.error(`IMAGGA similarity search failed for ${imageUrl}:`, error.message);
            throw error;
        }
    }

    /**
     * Compare two images for similarity using IMAGGA
     */
    async compareImages(baseImageUrl, compImageUrl) {
        try {
            if (!this.isAvailable()) {
                throw new Error('IMAGGA API not configured');
            }

            // First, get tags for both images
            const [baseTags, compTags] = await Promise.all([
                this.extractTags(baseImageUrl),
                this.extractTags(compImageUrl)
            ]);

            // Calculate tag-based similarity
            const tagSimilarity = this.calculateTagSimilarity(baseTags, compTags);

            // Get color similarity
            const [baseColors, compColors] = await Promise.all([
                this.extractColors(baseImageUrl),
                this.extractColors(compImageUrl)
            ]);

            const colorSimilarity = this.calculateColorSimilarity(baseColors, compColors);

            // Combine similarities (weighted average)
            const finalSimilarity = (tagSimilarity * 0.7) + (colorSimilarity * 0.3);

            console.log(`IMAGGA comparison results for ${compImageUrl}:`);
            console.log(`  Tag similarity: ${tagSimilarity.toFixed(3)}`);
            console.log(`  Color similarity: ${colorSimilarity.toFixed(3)}`);
            console.log(`  Final similarity: ${finalSimilarity.toFixed(3)}`);

            return {
                similarity: finalSimilarity,
                tagSimilarity,
                colorSimilarity,
                method: 'imagga',
                confidence: 'high'
            };

        } catch (error) {
            console.error(`IMAGGA image comparison failed:`, error.message);
            throw error;
        }
    }

    /**
     * Calculate similarity based on overlapping tags
     */
    calculateTagSimilarity(baseTags, compTags) {
        if (!baseTags.length || !compTags.length) {
            return 0;
        }

        const baseTagSet = new Set(baseTags.map(t => t.tag.toLowerCase()));
        const compTagSet = new Set(compTags.map(t => t.tag.toLowerCase()));

        const intersection = new Set([...baseTagSet].filter(x => compTagSet.has(x)));
        const union = new Set([...baseTagSet, ...compTags]);

        if (union.size === 0) return 0;

        return intersection.size / union.size;
    }

    /**
     * Calculate similarity based on color overlap
     */
    calculateColorSimilarity(baseColors, compColors) {
        if (!baseColors.dominant.length || !compColors.dominant.length) {
            return 0;
        }

        // Compare dominant colors
        const baseColorSet = new Set(baseColors.dominant.map(c => c.closest_palette_color));
        const compColorSet = new Set(compColors.dominant.map(c => c.closest_palette_color));

        const intersection = new Set([...baseColorSet].filter(x => compColorSet.has(x)));
        const union = new Set([...baseColorSet, ...compColorSet]);

        if (union.size === 0) return 0;

        return intersection.size / union.size;
    }

    /**
     * Get comprehensive image analysis
     */
    async analyzeImage(imageUrl) {
        try {
            if (!this.isAvailable()) {
                throw new Error('IMAGGA API not configured');
            }

            const [tags, colors] = await Promise.all([
                this.extractTags(imageUrl),
                this.extractColors(imageUrl)
            ]);

            return {
                url: imageUrl,
                tags,
                colors,
                analysis: {
                    tagCount: tags.length,
                    dominantColors: colors.dominant.length,
                    overallColors: colors.overall.length
                }
            };
        } catch (error) {
            console.error(`IMAGGA image analysis failed for ${imageUrl}:`, error.message);
            throw error;
        }
    }
}

module.exports = ImaggaClient;
