const { imageHash } = require('image-hash');
const { promisify } = require('util');
const hashImage = promisify(imageHash);

// Custom hamming distance function to replace the buggy package
const calculateHammingDistance = (str1, str2) => {
    if (str1.length !== str2.length) {
        throw new Error('Strings must be of equal length for hamming distance calculation');
    }
    
    let distance = 0;
    for (let i = 0; i < str1.length; i++) {
        if (str1[i] !== str2[i]) {
            distance++;
        }
    }
    return distance;
};

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

        // Compute similarity using our custom hamming distance function
        const hammingDistance = calculateHammingDistance(baseHash, compHash);
        const similarity = 1 - (hammingDistance / baseHash.length);

        // Clamp to 0–1 to prevent negative or >1 values
        const safeSimilarity = Math.max(0, Math.min(1, similarity));

        console.log(`Hash lengths: ${baseHash.length}, Hamming distance: ${hammingDistance}, Similarity score: ${safeSimilarity}`);
        return safeSimilarity;
    } catch (err) {
        console.error(`Image comparison failed: ${err.message}`);
        return null;
    }
};

module.exports = { compareImages };
