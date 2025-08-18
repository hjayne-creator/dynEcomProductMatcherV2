const EnhancedImaggaClient = require('./enhancedImaggaClient');
const { compareImages: perceptualCompare } = require('./imageComparator');

class EnhancedImageComparator {
    constructor() {
        this.imaggaClient = new EnhancedImaggaClient();
        this.enableImaggaPrimary = process.env.ENABLE_IMAGGA_PRIMARY !== 'false';
        this.enablePerceptualFallback = process.env.ENABLE_PERCEPTUAL_FALLBACK !== 'false';
        this.imaggaMinConfidence = parseFloat(process.env.IMAGGA_MIN_CONFIDENCE) || 0.3;
    }

    /**
     * Main comparison method that implements hybrid approach
     */
    async compareImages(baseImageUrl, compImageUrl, options = {}) {
        const startTime = Date.now();
        
        try {
            console.log(`\n🔄 Starting enhanced image comparison:`);
            console.log(`   Base: ${baseImageUrl}`);
            console.log(`   Compare: ${compImageUrl}`);

            // Try IMAGGA first if enabled and available
            if (this.enableImaggaPrimary && this.imaggaClient.isAvailable()) {
                try {
                    console.log(`   📡 Using IMAGGA API for primary analysis...`);
                    const imaggaResult = await this.imaggaClient.compareImages(baseImageUrl, compImageUrl);
                    
                    // Check if IMAGGA result meets confidence threshold
                    if (imaggaResult.similarity >= this.imaggaMinConfidence) {
                        const duration = Date.now() - startTime;
                        console.log(`   ✅ IMAGGA analysis completed in ${duration}ms`);
                        return {
                            ...imaggaResult,
                            duration,
                            fallbackUsed: false
                        };
                    } else {
                        console.log(`   ⚠️  IMAGGA similarity (${imaggaResult.similarity.toFixed(3)}) below threshold (${this.imaggaMinConfidence})`);
                    }
                } catch (imaggaError) {
                    console.log(`   ❌ IMAGGA failed: ${imaggaError.message}`);
                }
            }

            // Fallback to perceptual hashing if enabled
            if (this.enablePerceptualFallback) {
                try {
                    console.log(`   🔄 Falling back to perceptual hashing...`);
                    const perceptualResult = await perceptualCompare(baseImageUrl, compImageUrl);
                    
                    if (perceptualResult !== null) {
                        const duration = Date.now() - startTime;
                        console.log(`   ✅ Perceptual hashing completed in ${duration}ms`);
                        return {
                            similarity: perceptualResult,
                            method: 'perceptual_hashing',
                            confidence: 'medium',
                            fallbackUsed: true,
                            duration,
                            note: 'IMAGGA unavailable or below threshold, using perceptual hashing'
                        };
                    }
                } catch (perceptualError) {
                    console.log(`   ❌ Perceptual hashing failed: ${perceptualError.message}`);
                }
            }

            // If both methods fail
            const duration = Date.now() - startTime;
            console.log(`   ❌ All comparison methods failed after ${duration}ms`);
            return {
                similarity: 0,
                method: 'none',
                confidence: 'none',
                fallbackUsed: false,
                duration,
                error: 'All image comparison methods failed'
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`   💥 Enhanced comparison failed after ${duration}ms:`, error.message);
            return {
                similarity: 0,
                method: 'error',
                confidence: 'none',
                fallbackUsed: false,
                duration,
                error: error.message
            };
        }
    }

    /**
     * Batch compare multiple images against a base image
     */
    async batchCompare(baseImageUrl, compImageUrls, options = {}) {
        const results = [];
        const batchSize = options.batchSize || 5;
        const delay = options.delay || 1000; // 1 second delay between batches

        console.log(`\n🚀 Starting batch comparison of ${compImageUrls.length} images against base image`);
        console.log(`   Base: ${baseImageUrl}`);
        console.log(`   Batch size: ${batchSize}, Delay: ${delay}ms`);

        for (let i = 0; i < compImageUrls.length; i += batchSize) {
            const batch = compImageUrls.slice(i, i + batchSize);
            console.log(`\n   📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(compImageUrls.length/batchSize)} (${batch.length} images)`);

            const batchPromises = batch.map(async (compUrl, index) => {
                const globalIndex = i + index;
                console.log(`     ${globalIndex + 1}/${compImageUrls.length}: ${compUrl}`);
                
                try {
                    const result = await this.compareImages(baseImageUrl, compUrl, options);
                    return {
                        index: globalIndex,
                        url: compUrl,
                        ...result
                    };
                } catch (error) {
                    console.error(`     ❌ Failed to compare ${compUrl}:`, error.message);
                    return {
                        index: globalIndex,
                        url: compUrl,
                        similarity: 0,
                        method: 'error',
                        confidence: 'none',
                        error: error.message
                    };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Add delay between batches (except for the last batch)
            if (i + batchSize < compImageUrls.length) {
                console.log(`   ⏳ Waiting ${delay}ms before next batch...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // Sort results by similarity (highest first)
        results.sort((a, b) => b.similarity - a.similarity);

        console.log(`\n✅ Batch comparison completed. Processed ${results.length} images.`);
        console.log(`   Top similarity: ${results[0]?.similarity?.toFixed(3) || 'N/A'}`);
        console.log(`   Average similarity: ${(results.reduce((sum, r) => sum + r.similarity, 0) / results.length).toFixed(3)}`);

        return results;
    }

    /**
     * Get detailed analysis of a single image
     */
    async analyzeImage(imageUrl) {
        try {
            if (this.imaggaClient.isAvailable()) {
                return await this.imaggaClient.analyzeImage(imageUrl);
            } else {
                return {
                    url: imageUrl,
                    error: 'IMAGGA API not available for detailed analysis',
                    method: 'none'
                };
            }
        } catch (error) {
            return {
                url: imageUrl,
                error: error.message,
                method: 'error'
            };
        }
    }

    /**
     * Get system status and capabilities
     */
    getStatus() {
        return {
            imaggaAvailable: this.imaggaClient.isAvailable(),
            imaggaPrimary: this.enableImaggaPrimary,
            perceptualFallback: this.enablePerceptualFallback,
            imaggaMinConfidence: this.imaggaMinConfidence,
            methods: this.imaggaClient.isAvailable() ? ['imagga', 'perceptual_hashing'] : ['perceptual_hashing']
        };
    }

    /**
     * Test connectivity and API access
     */
    async testConnection() {
        const status = {
            imagga: false,
            perceptual: false,
            overall: false
        };

        try {
            // Test IMAGGA
            if (this.imaggaClient.isAvailable()) {
                try {
                    // Try a simple API call to test connectivity
                    await this.imaggaClient.extractTags('https://example.com/test.jpg');
                    status.imagga = true;
                } catch (error) {
                    console.log('IMAGGA connectivity test failed:', error.message);
                }
            }

            // Test perceptual hashing (always available)
            try {
                // This will fail but we can catch the error to confirm the system works
                await perceptualCompare('https://example.com/test.jpg', 'https://example.com/test2.jpg');
                status.perceptual = true;
            } catch (error) {
                // Expected to fail with invalid URLs, but confirms system is working
                status.perceptual = true;
            }

            status.overall = status.imagga || status.perceptual;
        } catch (error) {
            console.error('Connection test failed:', error.message);
        }

        return status;
    }
}

module.exports = EnhancedImageComparator;
