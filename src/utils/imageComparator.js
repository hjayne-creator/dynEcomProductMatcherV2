const { imageHash } = require('image-hash');
const { promisify } = require('util');
const hashImage = promisify(imageHash);
const hamming = require('hamming-distance');

const compareImages = async (baseImageUrl, compImageUrl) => {
    if (!baseImageUrl || !compImageUrl) {
        console.warn('Missing image URLs for comparison');
        return null;
    }

    try {
        console.log(`Comparing base image: ${baseImageUrl} with: ${compImageUrl}`);

        // Hash both images in parallel for speed
        const [baseHash, compHash] = await Promise.all([
            hashImage(baseImageUrl, 16, true),
            hashImage(compImageUrl, 16, true)
        ]);

        // Ensure both hashes are strings of same length
        if (!baseHash || !compHash || baseHash.length !== compHash.length) {
            console.warn(`Invalid hash generated for: ${compImageUrl}`);
            return null;
        }

        // Compute similarity
        const similarity = 1 - (hamming(baseHash, compHash) / baseHash.length);

        // Clamp to 0–1 to prevent negative or >1 values
        const safeSimilarity = Math.max(0, Math.min(1, similarity));

        console.log(`Similarity score: ${safeSimilarity}`);
        return safeSimilarity;
    } catch (err) {
        console.error(`Image comparison failed: ${err.message}`);
        return null;
    }
};

module.exports = { compareImages };
