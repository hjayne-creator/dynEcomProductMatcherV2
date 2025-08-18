const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

class EnhancedImaggaClient {
    constructor() {
        this.apiKey = process.env.IMAGGA_API_KEY;
        this.apiSecret = process.env.IMAGGA_API_SECRET;
        this.baseUrl = 'https://api.imagga.com/v2';
        this.requestQueue = [];
        this.isProcessing = false;
        this.maxConcurrent = 1; // Limit concurrent requests for free tier
        this.retryDelay = 2000; // 2 seconds between requests
        
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
     * Queue requests to avoid concurrent limit issues
     */
    async queueRequest(requestFn) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ requestFn, resolve, reject });
            this.processQueue();
        });
    }

    /**
     * Process queued requests sequentially
     */
    async processQueue() {
        if (this.isProcessing || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.requestQueue.length > 0) {
            const { requestFn, resolve, reject } = this.requestQueue.shift();
            
            try {
                const result = await requestFn();
                resolve(result);
                
                // Add delay between requests to avoid rate limiting
                if (this.requestQueue.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                }
            } catch (error) {
                reject(error);
            }
        }

        this.isProcessing = false;
    }

    /**
     * Convert local file to base64 for IMAGGA API
     */
    async fileToBase64(filePath) {
        try {
            const fullPath = path.resolve(filePath);
            if (!fs.existsSync(fullPath)) {
                throw new Error(`File not found: ${fullPath}`);
            }
            
            const fileBuffer = fs.readFileSync(fullPath);
            return fileBuffer.toString('base64');
        } catch (error) {
            throw new Error(`Failed to read file: ${error.message}`);
        }
    }

    /**
     * Extract image tags with better error handling
     */
    async extractTags(imageSource, isLocalFile = false) {
        return this.queueRequest(async () => {
            try {
                let params = {
                    limit: 20,
                    threshold: process.env.IMAGGA_MIN_CONFIDENCE || 0.3
                };

                let endpoint = `${this.baseUrl}/tags`;
                let headers = this.getAuthHeaders();

                if (isLocalFile) {
                    // For local files, use base64 encoding
                    const base64Image = await this.fileToBase64(imageSource);
                    params.image_base64 = base64Image;
                } else {
                    // For URLs
                    params.image_url = imageSource;
                }

                const response = await axios.get(endpoint, { params, headers });

                if (response.data && response.data.result) {
                    return response.data.result.tags.map(tag => ({
                        tag: tag.tag.en,
                        confidence: tag.confidence
                    }));
                }
                
                return [];
            } catch (error) {
                if (error.response?.status === 403 && error.response?.data?.status?.text?.includes('concurrent')) {
                    throw new Error('Concurrent request limit reached. Please wait and try again.');
                }
                throw error;
            }
        });
    }

    /**
     * Extract colors with fallback handling
     */
    async extractColors(imageSource, isLocalFile = false) {
        return this.queueRequest(async () => {
            try {
                let params = {
                    extract_overall_colors: 1
                };

                let endpoint = `${this.baseUrl}/colors`;
                let headers = this.getAuthHeaders();

                if (isLocalFile) {
                    const base64Image = await this.fileToBase64(imageSource);
                    params.image_base64 = base64Image;
                } else {
                    params.image_url = imageSource;
                }

                const response = await axios.get(endpoint, { params, headers });

                if (response.data && response.data.result) {
                    const colors = response.data.result.colors;
                    const result = {
                        dominant: colors.image_colors || [],
                        overall: colors.background_colors || [],
                        background: colors.background_colors || [],
                        foreground: colors.foreground_colors || []
                    };
                    return result;
                }
                
                return { dominant: [], overall: [] };
            } catch (error) {
                console.warn(`IMAGGA color extraction failed: ${error.message}`);
                // Return empty colors instead of throwing
                return { dominant: [], overall: [] };
            }
        });
    }

    /**
     * Get comprehensive image analysis with fallbacks
     */
    async analyzeImage(imageSource, isLocalFile = false) {
        try {
            const [tags, colors] = await Promise.all([
                this.extractTags(imageSource, isLocalFile),
                this.extractColors(imageSource, isLocalFile)
            ]);

            return {
                url: imageSource,
                tags,
                colors,
                analysis: {
                    tagCount: tags.length,
                    dominantColors: colors.dominant.length,
                    overallColors: colors.overall.length
                }
            };
        } catch (error) {
            console.error(`Image analysis failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Compare two images with better error handling
     */
    async compareImages(baseImage, compImage, baseIsLocal = false, compIsLocal = false) {
        try {
            const [baseTags, compTags, baseColors, compColors] = await Promise.all([
                this.extractTags(baseImage, baseIsLocal),
                this.extractTags(compImage, compIsLocal),
                this.extractColors(baseImage, baseIsLocal),
                this.extractColors(compImage, compIsLocal)
            ]);

            const tagSimilarity = this.calculateTagSimilarity(baseTags, compTags);
            const colorSimilarity = this.calculateColorSimilarity(baseColors, compColors);
            const finalSimilarity = (tagSimilarity * 0.7) + (colorSimilarity * 0.3);

            return {
                similarity: finalSimilarity,
                tagSimilarity,
                colorSimilarity,
                method: 'imagga',
                confidence: 'high',
                baseTags: baseTags.slice(0, 5), // Include sample tags for debugging
                compTags: compTags.slice(0, 5)
            };

        } catch (error) {
            console.error(`Image comparison failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Calculate tag similarity
     */
    calculateTagSimilarity(baseTags, compTags) {
        if (!baseTags.length || !compTags.length) {
            return 0;
        }

        const baseTagSet = new Set(baseTags.map(t => t.tag.toLowerCase()));
        const compTagSet = new Set(compTags.map(t => t.tag.toLowerCase()));

        const intersection = new Set([...baseTagSet].filter(x => compTagSet.has(x)));
        const union = new Set([...baseTagSet, ...compTagSet]);

        if (union.size === 0) return 0;

        return intersection.size / union.size;
    }

    /**
     * Calculate color similarity
     */
    calculateColorSimilarity(baseColors, compColors) {
        if (!baseColors.dominant.length || !compColors.dominant.length) {
            return 0;
        }

        const baseColorSet = new Set(baseColors.dominant.map(c => c.closest_palette_color));
        const compColorSet = new Set(compColors.dominant.map(c => c.closest_palette_color));

        const intersection = new Set([...baseColorSet].filter(x => compColorSet.has(x)));
        const union = new Set([...baseColorSet, ...compColorSet]);

        if (union.size === 0) return 0;

        return intersection.size / union.size;
    }

    /**
     * Get API usage statistics
     */
    async getUsageStats() {
        try {
            const response = await axios.get(`${this.baseUrl}/usage`, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.warn(`Failed to get usage stats: ${error.message}`);
            return null;
        }
    }
}

module.exports = EnhancedImaggaClient;
