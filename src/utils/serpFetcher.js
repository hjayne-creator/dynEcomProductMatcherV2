require('dotenv').config();

const axios = require('axios');

const fetchSerpResults = async (query, excludeDomain) => {
    const data = JSON.stringify({ q: query });

    const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://google.serper.dev/search',
        headers: {
            'X-API-KEY': process.env.SERP_API_KEY,
            'Content-Type': 'application/json'
        },
        data
    };

    try {
        const response = await axios.request(config);
        const result = response.data;

        const organicLimit = parseInt(process.env.ORGANIC_LIMIT || 5);
        const shoppingLimit = parseInt(process.env.SHOPPING_LIMIT || 3);

        const organicResults = (result.organic || [])
            .filter(r => !r.link.includes(excludeDomain))
            .slice(0, organicLimit)
            .map(r => ({
                type: 'organic',
                url: r.link,
                title: r.title,
                snippet: r.snippet
            }));

        const shoppingResults = (result.shopping || [])
            .slice(0, shoppingLimit)
            .map(r => ({
                type: 'shopping',
                url: r.link,
                title: r.title,
                price: r.price
            }));

        return [...organicResults, ...shoppingResults];
    } catch (err) {
        console.error('Serper fetch error:', err.message);
        return [];
    }
};

module.exports = fetchSerpResults;
