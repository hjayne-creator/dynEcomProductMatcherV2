document.addEventListener('DOMContentLoaded', () => {
    // First Screen Logic
    const sheetForm = document.getElementById('sheetForm');
    if (sheetForm) {
        sheetForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const sheetUrl = document.getElementById('sheetUrl').value;
            const statusDiv = document.getElementById('status');
            statusDiv.textContent = 'Processing...';
            statusDiv.className = 'status loading';

            try {
                // Extract sheet ID from URL
                const sheetId = extractSheetId(sheetUrl);
                if (!sheetId) throw new Error('Invalid Google Sheets URL');

                // Call backend API
                const response = await fetch('/api/compare', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        type: 'sheet',
                        sheetId
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText || 'Server error');
                }

                // Parse JSON response
                const data = await response.json();
                if (!data || !data.filename) {
                    throw new Error('Invalid response from server');
                }

                // Store filename for results screen
                sessionStorage.setItem('comparisonFilename', data.filename);

                // Redirect to results screen
                window.location.href = 'results.html';

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
        // Fetch results data
        const response = await fetch(`/api/results?filename=${filename}`);
        if (!response.ok) throw new Error('Failed to load results');

        const results = await response.json();
        const container = document.getElementById('resultsContainer');

        // Group results by base URL
        const groupedResults = groupResultsByBaseUrl(results);
        
        // Clear container
        container.innerHTML = '';

        // Create grouped sections
        Object.keys(groupedResults).forEach(baseUrl => {
            const groupSection = createGroupSection(baseUrl, groupedResults[baseUrl]);
            container.appendChild(groupSection);
        });

    } catch (error) {
        console.error('Error loading results:', error);
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
        competitors.forEach(competitor => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><a href="${competitor.competitor_url}" target="_blank">${truncateText(competitor.competitor_url, 50)}</a></td>
                <td>${formatSimilarity(competitor.similarity_score)}</td>
                <td>${competitor.brand || '-'}</td>
                <td>${formatPrice(competitor.price)}</td>
            `;
            tbody.appendChild(tr);
        });
        competitorsTable.appendChild(tbody);
    }
    
    groupDiv.appendChild(groupHeader);
    groupDiv.appendChild(competitorsTable);
    
    return groupDiv;
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
