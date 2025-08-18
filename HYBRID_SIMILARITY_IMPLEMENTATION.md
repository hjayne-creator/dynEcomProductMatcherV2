# Hybrid Similarity Implementation

## Overview

The Product Comparison Tool now features a **hybrid similarity scoring system** that combines visual (image-based) and textual (attribute-based) similarity to provide more accurate and comprehensive product matching. This approach significantly improves the quality of competitor identification by considering both visual resemblance and product attribute matches.

## How It Works

### 1. **Visual Similarity (Image-Based)**
- **Method**: Perceptual image hashing with Hamming distance
- **Algorithm**: `image-hash` library with custom Hamming distance calculation
- **Output**: Score from 0.0 to 1.0 (0% to 100% visual similarity)
- **Weight**: Configurable (default: 60% of final score)

### 2. **Textual Similarity (Attribute-Based)**
- **Method**: Weighted scoring based on product attributes
- **Attributes**: Title, Brand, Model, GTIN, Price
- **Algorithm**: Levenshtein distance for titles, exact matching for attributes
- **Output**: Score from 0.0 to 1.0 (0% to 100% textual similarity)
- **Weight**: Configurable (default: 40% of final score)

### 3. **Hybrid Combination**
- **Formula**: `(ImageScore × ImageWeight) + (TextScore × TextWeight)`
- **Range**: 0.0 to 1.0 (0% to 100% overall similarity)
- **Fallback**: Text-only similarity if image comparison fails

## Configuration Options

### Environment Variables

```bash
# Overall similarity threshold
SIMILARITY_THRESHOLD=0.4

# Hybrid similarity weights (must sum to 1.0)
IMAGE_WEIGHT=0.6
TEXT_WEIGHT=0.4

# Minimum scores for each similarity type
MIN_IMAGE_SCORE=0.1
MIN_TEXT_SCORE=0.05
```

### Weight Configurations

#### **Visual-Focused (Recommended for most cases)**
```bash
IMAGE_WEIGHT=0.7
TEXT_WEIGHT=0.3
```

#### **Balanced Approach (Default)**
```bash
IMAGE_WEIGHT=0.6
TEXT_WEIGHT=0.4
```

#### **Text-Focused (When images are unreliable)**
```bash
IMAGE_WEIGHT=0.3
TEXT_WEIGHT=0.7
```

## Detailed Scoring Breakdown

### **Textual Similarity Weights**
```javascript
const weights = {
    title: 1.0      // 100% - Product title similarity only
};
```

### **Title Similarity**
The system uses a **dual-algorithm approach** for title similarity:

#### **Word Overlap (Jaccard Similarity) - 60% Weight**
- **Method**: Token-based analysis finding meaningful word combinations
- **Process**: Extracts words, finds common patterns, calculates overlap
- **Algorithm**: `(common words) / (total unique words)` with fallback to `(common words) / (average length)`
- **Example**: "Apple MacBook Pro 16-inch" vs "Apple MacBook Pro 14-inch Laptop"
  - Common words: `["Apple", "MacBook", "Pro", "inch"]` (4 words)
  - Total unique: `["Apple", "MacBook", "Pro", "16", "inch", "14", "Laptop"]` (7 words)
  - Score: `4/7 = 0.571` (57% similarity)

#### **Levenshtein Distance - 40% Weight**
- **Method**: Character-level similarity using `string-similarity` library
- **Process**: Case-insensitive comparison with trimming
- **Example**: "iPhone 14 Pro" vs "iPhone 14 Pro Max" = 0.85 similarity

#### **Combined Scoring**
- **Formula**: `(WordOverlap × 0.6) + (Levenshtein × 0.4)`
- **Benefits**: Natural language understanding + character-level precision
- **No Hardcoded Rules**: Automatically adapts to any product category

### **Visual Similarity**
- **Hash Size**: 16-bit (64-character hash)
- **Distance**: Hamming distance between image hashes
- **Formula**: `1 - (HammingDistance / HashLength)`

## Example Calculations

### **Scenario 1: High Similarity Product**
```
Base Product: iPhone 14 Pro, Apple, Model A2894
Competitor: iPhone 14 Pro, Apple, Model A2894

Image Similarity: 0.85 (85%)
Text Similarity: 1.00 (100%) - Perfect title match
  - Word Overlap: 1.00 (100% - all words match)
  - Levenshtein: 1.00 (100% - identical strings)

Hybrid Score: (0.85 × 0.6) + (1.00 × 0.4) = 0.91 (91%)
Classification: Very Similar (likely same product)
```

### **Scenario 2: Moderate Similarity Product**
```
Base Product: Samsung Galaxy S23, Samsung, Model SM-S911B
Competitor: Samsung Galaxy S23+, Samsung, Model SM-S916B

Image Similarity: 0.72 (72%) - Similar design
Text Similarity: 0.75 (75%) - Similar title with slight variation
  - Word Overlap: 0.67 (67% - "Samsung", "Galaxy", "S23" match)
  - Levenshtein: 0.85 (85% - minor character differences)

Hybrid Score: (0.72 × 0.6) + (0.75 × 0.4) = 0.73 (73%)
Classification: Similar (likely related products)
```

### **Scenario 3: Low Similarity Product**
```
Base Product: Nike Air Max 270, Nike, Model 805943-001
Competitor: Adidas Ultraboost 22, Adidas, Model FY7756

Image Similarity: 0.15 (15%) - Different shoe design
Text Similarity: 0.05 (5%) - Very different titles
  - Word Overlap: 0.00 (0% - no common words)
  - Levenshtein: 0.12 (12% - minimal character similarity)

Hybrid Score: (0.15 × 0.6) + (0.05 × 0.4) = 0.11 (11%)
Classification: Very Different (minimal resemblance)
```

## Fallback Mechanisms

### **Image Comparison Failure**
When image comparison fails, the system automatically falls back to text-only similarity:

```javascript
// Fallback to text-only similarity
hybridSimilarity = calculateHybridSimilarity(baseProduct, compData, 0, {
    imageWeight: 0,
    textWeight: 1.0,
    minImageScore: 0,
    minTextScore: 0.05
});
```

### **Missing Attributes**
- **Graceful Degradation**: Missing attributes don't break the calculation
- **Weight Normalization**: Scores are normalized by available attributes
- **Logging**: Detailed logging of which attributes contributed to the score

## CSV Output Enhancements

The CSV output now includes detailed similarity breakdown:

```csv
similarity_score,image_similarity,text_similarity,similarity_classification
0.8500,0.7200,0.9500,Similar (likely related products)
0.7300,0.6800,0.8000,Moderately Similar (some resemblance)
0.4500,0.3500,0.6000,Slightly Similar (minimal resemblance)
```

## Performance Optimizations

### **Parallel Processing**
- Image hashing and attribute extraction run in parallel
- Hamming distance calculation optimized with custom function
- Batch processing with rate limiting

### **Caching Considerations**
- Image hashes could be cached for repeated comparisons
- Attribute extraction results stored in memory during processing
- Similarity scores calculated once per competitor

## Monitoring and Debugging

### **Detailed Logging**
```
[TEXT_SIM] Title similarity breakdown:
  - Base title: "apple macbook pro 16-inch"
  - Comp title: "apple macbook pro 14-inch laptop"
  - Word Overlap: 0.727 (weight: 0.6)
  - Levenshtein: 0.792 (weight: 0.4)
  - Final Title Score: 0.753 (weight: 1)
[TEXT_SIM] Word analysis - Base words: [apple, macbook, pro, 16, inch], Comp words: [apple, macbook, pro, 14, inch, laptop], Common: [apple, macbook, pro, inch]
[TEXT_SIM] Final text similarity score: 0.753
[HYBRID_SIM] Final hybrid score: 0.850
[HYBRID_SIM] Breakdown - Image: 0.432, Text: 0.418
```

### **Metrics to Monitor**
- **Filtering Rate**: Percentage of competitors excluded
- **Score Distribution**: Range and distribution of similarity scores
- **Fallback Usage**: Frequency of text-only similarity fallback
- **Performance**: Processing time per competitor

## Benefits of Hybrid Approach

### **1. Improved Accuracy**
- Combines visual and textual evidence
- Reduces false positives from visual-only matching
- Better identification of related products

### **2. Simplified Text Similarity**
- **No Hardcoded Rules**: Automatically adapts to any product category
- **Natural Language Understanding**: Word Overlap finds meaningful multi-word patterns
- **Balanced Scoring**: 60% for semantic meaning, 40% for character precision
- **Maintainable**: Simple dual-algorithm approach without complex configuration

### **3. Robust Fallback**
- Continues working when images fail
- Graceful degradation of functionality
- Maintains quality even with partial data

### **4. Configurable Precision**
- Adjustable weights for different use cases
- Fine-tuned thresholds for specific industries
- Balance between recall and precision

### **5. Enhanced Insights**
- Detailed breakdown of similarity components
- Better understanding of why products match
- Actionable competitive intelligence

## Text Similarity Algorithm Details

### **Word Overlap (Jaccard) Implementation**
The Word Overlap algorithm uses a sophisticated approach to find meaningful word combinations:

1. **Word Extraction**: Cleans titles and splits into meaningful words (length > 1)
2. **Case-Insensitive Matching**: Finds common words regardless of capitalization
3. **Dual Scoring**: Uses both Jaccard and simple overlap for better coverage
4. **Natural Patterns**: Automatically identifies product names, brands, and attributes

**Example Calculation**:
```
Base: "Apple MacBook Pro 16-inch"
Comp:  "Apple MacBook Pro 14-inch Laptop"

Words1: [apple, macbook, pro, 16, inch] (5)
Words2: [apple, macbook, pro, 14, inch, laptop] (6)
Common: [apple, macbook, pro, inch] (4)
Unique: [apple, macbook, pro, 16, inch, 14, laptop] (7)

Jaccard: 4/7 = 0.571
Simple: 4/5.5 = 0.727
Final: max(0.571, 0.727) = 0.727
```

### **Why This Approach Works**
- **Adaptive**: No need to maintain product category lists
- **Intelligent**: Finds meaningful patterns automatically
- **Robust**: Works across different languages and naming conventions
- **Fast**: Simple mathematical operations, no complex NLP

## Best Practices

### **1. Weight Configuration**
- **High-Image Industries**: Fashion, furniture, electronics (IMAGE_WEIGHT=0.7)
- **High-Text Industries**: Books, software, services (TEXT_WEIGHT=0.7)
- **Balanced Industries**: General retail, mixed products (default weights)

### **2. Threshold Tuning**
- **Conservative**: 0.6+ for high-quality matches only
- **Balanced**: 0.4+ for good quality with reasonable coverage
- **Permissive**: 0.2+ for maximum coverage with lower quality

### **3. Monitoring**
- Track similarity score distributions
- Monitor fallback frequency
- Adjust weights based on industry performance

## Future Enhancements

### **Potential Improvements**
1. **Machine Learning**: Learn optimal weights from user feedback
2. **Category-Specific Weights**: Different weights for different product types
3. **Dynamic Thresholds**: Adjust thresholds based on available data quality
4. **Additional Algorithms**: Implement more sophisticated similarity methods

### **Advanced Features**
1. **Confidence Scoring**: Uncertainty quantification for similarity scores
2. **Multi-Modal Comparison**: Audio, video, and 3D model similarity
3. **Semantic Understanding**: NLP-based product description analysis
4. **User Feedback Integration**: Learn from user corrections and preferences

## Conclusion

The hybrid similarity system represents a significant improvement over the previous image-only approach by:

- **Combining Multiple Evidence Sources**: Visual and textual similarity
- **Simplifying Text Analysis**: Natural language understanding without hardcoded rules
- **Providing Robust Fallbacks**: Graceful degradation when components fail
- **Offering Configurable Precision**: Adjustable weights and thresholds
- **Delivering Better Insights**: Detailed breakdown of similarity components

The **simplified text similarity approach** eliminates the need for:
- ❌ Static product category lists
- ❌ Manual key phrase maintenance
- ❌ Complex configuration rules
- ❌ Industry-specific customization

Instead, it provides:
- ✅ **Automatic Adaptation**: Works across any product category
- ✅ **Natural Language Understanding**: Finds meaningful word patterns automatically
- ✅ **Maintainable Code**: Simple dual-algorithm approach
- ✅ **Consistent Results**: Reliable scoring regardless of product type

This implementation ensures that the Product Comparison Tool delivers higher quality, more accurate competitor matches while maintaining flexibility and robustness across different product types and data quality levels.
