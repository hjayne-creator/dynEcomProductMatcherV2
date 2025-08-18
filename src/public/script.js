document.addEventListener('DOMContentLoaded', () => {
    console.log('[FRONTEND] DOM loaded, initializing...');
    
    // First Screen Logic
    const sheetForm = document.getElementById('sheetForm');
    
    console.log('[FRONTEND] DOM elements found:', {
        sheetForm: !!sheetForm
    });
    
    if (sheetForm) {
        console.log('[FRONTEND] Sheet form found, adding event listener');
        sheetForm.addEventListener('submit', async (e) => {
            console.log('[FRONTEND] Form submit event triggered');
            e.preventDefault();

            const sheetUrl = document.getElementById('sheetUrl').value;
            const statusDiv = document.getElementById('status');
            statusDiv.textContent = 'Processing...';
            statusDiv.className = 'status loading';

            try {
                console.log('[FRONTEND] Form submitted with URL:', sheetUrl);
                
                // Extract sheet ID from URL
                const sheetId = extractSheetId(sheetUrl);
                if (!sheetId) throw new Error('Invalid Google Sheets URL');
                
                console.log('[FRONTEND] Extracted sheet ID:', sheetId);

                // Prepare request data
                const requestData = {
                    type: 'sheet',
                    sheetId
                };
                console.log('[FRONTEND] Request data:', requestData);

                // Call backend API
                console.log('[FRONTEND] Making request to /api/compare...');
                
                // Show loading state
                statusDiv.textContent = 'Processing comparison... This may take several minutes.';
                statusDiv.className = 'status loading';
                
                // Disable the form to prevent multiple submissions
                const submitButton = sheetForm.querySelector('button[type="submit"]');
                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.textContent = 'Processing...';
                }
                
                // Add timeout to the fetch request
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
                
                try {
                    const response = await fetch('/api/compare', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify(requestData),
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    console.log('[FRONTEND] Response received:', {
                        status: response.status,
                        statusText: response.statusText,
                        ok: response.ok,
                        headers: Object.fromEntries(response.headers.entries())
                    });

                    if (!response.ok) {
                        console.log('[FRONTEND] Response not OK, handling error...');
                        let errorMessage = 'Server error';
                        try {
                            const errorData = await response.json();
                            console.log('[FRONTEND] Error data received:', errorData);
                            errorMessage = errorData.error || errorData.details || errorMessage;
                            if (errorData.suggestion) {
                                errorMessage += ` - ${errorData.suggestion}`;
                            }
                        } catch (parseError) {
                            console.log('[FRONTEND] Failed to parse error JSON:', parseError);
                            // If we can't parse JSON, try to get text
                            try {
                                const errorText = await response.text();
                                console.log('[FRONTEND] Error text received:', errorText);
                                if (errorText) {
                                    errorMessage = errorText;
                                }
                            } catch (textError) {
                                console.log('[FRONTEND] Failed to get error text:', textError);
                                // Use default error message
                            }
                        }
                        throw new Error(errorMessage);
                    }

                    console.log('[FRONTEND] Response OK, parsing JSON...');
                    // Parse JSON response
                    const data = await response.json();
                    console.log('[FRONTEND] Parsed response data:', data);
                    
                    if (!data || !data.filename) {
                        throw new Error('Invalid response from server');
                    }

                    // Show success message
                    statusDiv.textContent = 'Comparison completed successfully! Redirecting to results...';
                    statusDiv.className = 'status success';

                    // Store filename for results screen
                    sessionStorage.setItem('comparisonFilename', data.filename);

                    // Redirect to results screen after a short delay
                    setTimeout(() => {
                        window.location.href = 'results.html';
                    }, 2000);
                    
                } catch (fetchError) {
                    clearTimeout(timeoutId);
                    
                    let errorMessage = 'Unknown error occurred';
                    
                    if (fetchError.name === 'AbortError') {
                        errorMessage = 'Request timed out after 5 minutes. The server may be processing a large amount of data.';
                    } else if (fetchError.message === 'Failed to fetch') {
                        errorMessage = 'Unable to connect to the server. Please check if the server is running and try again.';
                    } else if (fetchError.message.includes('ERR_EMPTY_RESPONSE')) {
                        errorMessage = 'Server connection lost. The server may have crashed or is not responding. Please try again.';
                    } else {
                        errorMessage = fetchError.message;
                    }
                    
                    throw new Error(errorMessage);
                } finally {
                    // Re-enable the form
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = 'Compare Products';
                    }
                }

            } catch (error) {
                statusDiv.textContent = `Error: ${error.message}`;
                statusDiv.className = 'status error';
                console.error('Error:', error);
            }
        });
    }

    // Second Screen Logic
    const resultsContainer = document.getElementById('resultsContainer');
    if (resultsContainer) {
        const backButton = document.getElementById('backButton');
        const downloadButton = document.getElementById('downloadButton');

        // Get results filename from session storage
        const filename = sessionStorage.getItem('comparisonFilename');

        // Handle navigation
        backButton.addEventListener('click', () => {
            sessionStorage.removeItem('comparisonFilename');
            window.location.href = 'index.html';
        });

        // Handle download
        downloadButton.addEventListener('click', () => {
            if (filename) {
                window.location.href = `/api/download/${filename}`;
            }
        });

        // Load and display results
        if (filename) {
            loadResults(filename);
        }
    }
});

// Extract Google Sheet ID from URL
function extractSheetId(url) {
    const regex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// Load and display results in grouped layout
async function loadResults(filename) {
    if (!filename) return;

    try {
        console.log(`[FRONTEND] Loading results from filename: ${filename}`);
        
        // Fetch results data
        const response = await fetch(`/api/results?filename=${filename}`);
        if (!response.ok) {
            console.error(`[FRONTEND] Failed to load results: ${response.status} ${response.statusText}`);
            throw new Error('Failed to load results');
        }

        const results = await response.json();
        console.log(`[FRONTEND] Received ${results.length} results from API`);
        console.log(`[FRONTEND] Sample result:`, results[0]);
        
        // Validate the data structure
        if (results.length > 0) {
            const sample = results[0];
            console.log(`[FRONTEND] Data validation:`);
            console.log(`  - Has base_url: ${!!sample.base_url}`);
            console.log(`  - Has search_term: ${!!sample.search_term}`);
            console.log(`  - Has result_type: ${!!sample.result_type}`);
            console.log(`  - Has competitor_url: ${!!sample.competitor_url}`);
            console.log(`  - Has similarity_score: ${!!sample.similarity_score}`);
            console.log(`  - Result type: ${sample.result_type}`);
        }
        
        const container = document.getElementById('resultsContainer');
        if (!container) {
            console.error('[FRONTEND] Results container not found');
            return;
        }

        // Group results by base URL
        const groupedResults = groupResultsByBaseUrl(results);
        console.log(`[FRONTEND] Grouped results into ${Object.keys(groupedResults).length} groups`);
        
        // Clear container
        container.innerHTML = '';

        // Create grouped sections
        Object.keys(groupedResults).forEach(baseUrl => {
            try {
                const groupSection = createGroupSection(baseUrl, groupedResults[baseUrl]);
                container.appendChild(groupSection);
            } catch (groupError) {
                console.error(`[FRONTEND] Error creating group for ${baseUrl}:`, groupError);
                // Create a fallback error group
                const errorGroup = createErrorGroup(baseUrl, groupError.message);
                container.appendChild(errorGroup);
            }
        });

    } catch (error) {
        console.error('[FRONTEND] Error loading results:', error);
        const container = document.getElementById('resultsContainer');
        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    <h3>Error Loading Results</h3>
                    <p>${error.message}</p>
                    <p>Please try refreshing the page or contact support if the problem persists.</p>
                </div>
            `;
        }
    }
}

// Group results by base URL
function groupResultsByBaseUrl(results) {
    const grouped = {};
    
    results.forEach(row => {
        if (!grouped[row.base_url]) {
            grouped[row.base_url] = [];
        }
        grouped[row.base_url].push(row);
    });

    // Sort each group by similarity score from high to low
    Object.keys(grouped).forEach(baseUrl => {
        grouped[baseUrl].sort((a, b) => {
            const scoreA = parseFloat(a.similarity_score) || 0;
            const scoreB = parseFloat(b.similarity_score) || 0;
            return scoreB - scoreA; // High to low
        });
    });

    return grouped;
}

// Create a group section for a base URL
function createGroupSection(baseUrl, competitors) {
    if (!competitors || !Array.isArray(competitors) || competitors.length === 0) {
        console.warn(`[FRONTEND] No competitors data for ${baseUrl}`);
        return createErrorGroup(baseUrl, 'No competitor data available');
    }

    const groupDiv = document.createElement('div');
    groupDiv.className = 'group-section';
    
    const groupHeader = document.createElement('div');
    groupHeader.className = 'group-header';
    
    const toggleButton = document.createElement('button');
    toggleButton.className = 'toggle-button';
    toggleButton.innerHTML = '−'; // Start expanded
    toggleButton.onclick = () => toggleGroup(groupDiv, toggleButton);
    
    // Get product title from the first competitor's search_term or use a fallback
    let productTitle = competitors[0]?.search_term || 'Product Title Not Available';
    
    // Remove trailing exclusion patterns like ' -site:bettymills.com'
    productTitle = productTitle.replace(/\s*-\s*site:\S+$/, '').trim();
    
    const productTitleSpan = document.createElement('span');
    productTitleSpan.className = 'product-title';
    productTitleSpan.textContent = truncateText(productTitle, 80);
    
    const openIcon = document.createElement('a');
    openIcon.href = baseUrl;
    openIcon.target = '_blank';
    openIcon.className = 'open-icon';
    openIcon.innerHTML = '🔗';
    openIcon.title = 'Open in new window';
    
    // Check if this is a failed match case
    const isFailedMatch = competitors.length === 1 && competitors[0]?.result_type === 'no_matches';
    
    if (isFailedMatch) {
        // Add warning indicator for failed matches
        const warningIcon = document.createElement('span');
        warningIcon.className = 'warning-icon';
        warningIcon.innerHTML = '⚠️';
        warningIcon.title = 'No matches found above similarity threshold';
        groupHeader.appendChild(warningIcon);
    }
    
    const competitorCount = document.createElement('span');
    competitorCount.className = 'competitor-count';
    
    if (isFailedMatch) {
        const totalChecked = competitors[0]?.total_competitors_checked || 0;
        const threshold = competitors[0]?.similarity_threshold || 0.4;
        competitorCount.textContent = `No matches (${totalChecked} checked, threshold: ${(threshold * 100).toFixed(0)}%)`;
        competitorCount.className = 'competitor-count failed';
    } else {
        competitorCount.textContent = `${competitors.length} competitor${competitors.length !== 1 ? 's' : ''}`;
    }
    
    groupHeader.appendChild(toggleButton);
    groupHeader.appendChild(productTitleSpan);
    groupHeader.appendChild(openIcon);
    groupHeader.appendChild(competitorCount);
    
    const competitorsTable = document.createElement('table');
    competitorsTable.className = 'competitors-table';
    
    if (isFailedMatch) {
        // Create special message for failed matches
        const tbody = document.createElement('tbody');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td colspan="4" class="no-matches-message">
                <div class="no-matches-content">
                    <p><strong>No matches found above similarity threshold</strong></p>
                    <p>This product was compared against ${competitors[0]?.total_competitors_checked || 0} competitor URLs, but none met the minimum similarity threshold of ${((competitors[0]?.similarity_threshold || 0.4) * 100).toFixed(0)}%.</p>
                    <p>Consider adjusting the similarity threshold or checking if the product information is accurate.</p>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
        competitorsTable.appendChild(tbody);
    } else {
        // Create table header for successful matches
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Competitor URL</th>
                <th>Similarity</th>
                <th>Brand</th>
                <th>Price</th>
            </tr>
        `;
        competitorsTable.appendChild(thead);
        
        // Create table body
        const tbody = document.createElement('tbody');
        competitors.forEach((competitor, index) => {
            try {
                const tr = document.createElement('tr');
                
                // Safely access competitor data with fallbacks
                const competitorUrl = competitor?.competitor_url || competitor?.url || 'N/A';
                const similarityScore = competitor?.similarity_score || 'N/A';
                const brand = competitor?.comp_brand || competitor?.brand || '-';
                const price = competitor?.comp_price || competitor?.price || '-';
                
                tr.innerHTML = `
                    <td><a href="${competitorUrl}" target="_blank">${truncateText(competitorUrl, 50)}</a></td>
                    <td>${formatSimilarity(similarityScore)}</td>
                    <td>${brand}</td>
                    <td>${formatPrice(price)}</td>
                `;
                tbody.appendChild(tr);
            } catch (rowError) {
                console.error(`[FRONTEND] Error creating row for competitor ${index}:`, rowError);
                // Create error row
                const errorTr = document.createElement('tr');
                errorTr.innerHTML = `
                    <td colspan="4" class="error-row">Error processing competitor data</td>
                `;
                tbody.appendChild(errorTr);
            }
        });
        competitorsTable.appendChild(tbody);
    }
    
    groupDiv.appendChild(groupHeader);
    groupDiv.appendChild(competitorsTable);
    
    return groupDiv;
}

// Create an error group section for a base URL
function createErrorGroup(baseUrl, errorMessage) {
    const errorGroupDiv = document.createElement('div');
    errorGroupDiv.className = 'group-section error-group';

    const errorHeader = document.createElement('div');
    errorHeader.className = 'group-header';
    errorHeader.innerHTML = `
        <button class="toggle-button">−</button>
        <span class="product-title">Error for ${truncateText(baseUrl, 80)}</span>
        <a href="${baseUrl}" target="_blank" class="open-icon">🔗</a>
    `;

    const competitorsTable = document.createElement('table');
    competitorsTable.className = 'competitors-table';

    const tbody = document.createElement('tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td colspan="4" class="no-matches-message">
            <div class="no-matches-content">
                <p><strong>Error Loading Data for ${truncateText(baseUrl, 80)}</strong></p>
                <p>${errorMessage}</p>
                <p>Please check the backend logs for more details.</p>
            </div>
        </td>
    `;
    tbody.appendChild(tr);
    competitorsTable.appendChild(tbody);

    errorGroupDiv.appendChild(errorHeader);
    errorGroupDiv.appendChild(competitorsTable);

    return errorGroupDiv;
}

// Toggle group expansion/collapse
function toggleGroup(groupDiv, toggleButton) {
    const competitorsTable = groupDiv.querySelector('.competitors-table');
    const isExpanded = competitorsTable.style.display !== 'none';
    
    if (isExpanded) {
        competitorsTable.style.display = 'none';
        toggleButton.innerHTML = '+';
        toggleButton.className = 'toggle-button collapsed';
    } else {
        competitorsTable.style.display = 'table';
        toggleButton.innerHTML = '−';
        toggleButton.className = 'toggle-button';
    }
}

// Helper to truncate long text
function truncateText(text, maxLength) {
    return text.length > maxLength
        ? text.substring(0, maxLength) + '...'
        : text;
}

// Format similarity score
function formatSimilarity(score) {
    if (score === undefined || score === null || score === 'N/A') return 'N/A';
    if (typeof score === 'number') return `${Math.round(score * 100)}%`;
    return score;
}

// Format price
function formatPrice(price) {
    if (!price) return '-';
    if (typeof price === 'number') return `$${price.toFixed(2)}`;
    if (typeof price === 'string' && price.match(/\d/)) return `$${price}`;
    return price;
}
