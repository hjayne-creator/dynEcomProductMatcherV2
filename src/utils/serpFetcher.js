require('dotenv').config();

const axios = require('axios');

const fetchSerpResults = async (query) => {
    // SerpAPI configuration
    const apiKey = process.env.SERP_API_KEY;
    if (!apiKey) {
        console.error('SERP_API_KEY is not configured');
        return [];
    }

    // Build query parameters for SerpAPI
    const params = {
        api_key: apiKey,
        engine: 'google',
        q: query,
        num: parseInt(process.env.ORGANIC_LIMIT || 6), // Number of organic results
        gl: process.env.SEARCH_COUNTRY || 'us', // Country for search results
        hl: process.env.SEARCH_LANGUAGE || 'en', // Language
//        safe: 'active', // Safe search
        device: 'desktop' // Device type
    };

    // Add shopping search if enabled
    if (process.env.ENABLE_SHOPPING === 'true') {
        params.shopping_results = parseInt(process.env.SHOPPING_LIMIT || 5);
    }

    try {
        console.log(`[SERP] Fetching results for query: "${query}"`);
        
        const response = await axios.get('https://serpapi.com/search.json', {
            params,
            timeout: 30000, // 30 second timeout
            headers: {
                'User-Agent': process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const result = response.data;
        
        if (!result || result.error) {
            console.error('[SERP] API Error:', result?.error || 'Unknown error');
            return [];
        }

        console.log(`[SERP] Received ${result.organic_results?.length || 0} organic results, ${result.shopping_results?.length || 0} shopping results`);

        // Process organic results
        const organicResults = (result.organic_results || [])
            .filter(r => r.link)
            .slice(0, parseInt(process.env.ORGANIC_LIMIT || 8))
            .map(r => ({
                type: 'organic',
                url: r.link,
                title: r.title || '',
                snippet: r.snippet || '',
                position: r.position || 0,
                displayed_link: r.displayed_link || r.link
            }));

        // Process shopping results
        const shoppingResults = (result.shopping_results || [])
            .slice(0, parseInt(process.env.SHOPPING_LIMIT || 4))
            .map(r => ({
                type: 'shopping',
                url: r.link || r.product_link || '',
                title: r.title || r.product_title || '',
                price: r.price || r.extracted_price || '',
                source: r.source || '',
                rating: r.rating || '',
                reviews: r.reviews || '',
                thumbnail: r.thumbnail || ''
            }));

        // Process knowledge graph if available
        const knowledgeGraph = result.knowledge_graph ? {
            type: 'knowledge_graph',
            title: result.knowledge_graph.title || '',
            description: result.knowledge_graph.description || '',
            attributes: result.knowledge_graph.attributes || {},
            image: result.knowledge_graph.image || ''
        } : null;

        // Combine all results
        const allResults = [...organicResults, ...shoppingResults];
        if (knowledgeGraph) {
            allResults.unshift(knowledgeGraph);
        }

        console.log(`[SERP] Returning ${allResults.length} total results`);
        return allResults;

    } catch (err) {
        if (err.response) {
            // API error response
            console.error('[SERP] API Error Response:', {
                status: err.response.status,
                statusText: err.response.statusText,
                data: err.response.data
            });
        } else if (err.request) {
            // Network error
            console.error('[SERP] Network Error:', err.message);
        } else {
            // Other error
            console.error('[SERP] Error:', err.message);
        }
        
        return [];
    }
};

module.exports = fetchSerpResults;
