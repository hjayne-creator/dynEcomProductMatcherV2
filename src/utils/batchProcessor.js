// Add to src/controllers/batchProcessor.js
const processBatch = async (urls, batchSize = 5) => {
    const results = [];
    const limiter = new Bottleneck({
        maxConcurrent: batchSize,
        minTime: 1000 // Rate limiting
    });

    await Promise.all(urls.map(url =>
        limiter.schedule(async () => {
            try {
                const baseProduct = await scrapeBaseProduct(url);
                const serpResults = await fetchSerpResults(baseProduct.searchTerm);

                const competitors = await Promise.all(
                    serpResults.map(result =>
                        scrapeCompetitor(result.url)
                            .then(compData => ({
                                ...result,
                                ...compData,
                                similarity: calculateSimilarity(baseProduct, compData)
                            }))
                    )
                );

                results.push({
                    baseProduct,
                    competitors: competitors.sort((a, b) => b.similarity - a.similarity)
                });
            } catch (error) {
                console.log(error)
                console.error(`Failed processing ${url}:`, error);
            }
        })
    );

    return results;
};
