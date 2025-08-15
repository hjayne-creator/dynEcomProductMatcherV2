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
    const resultsTable = document.getElementById('resultsTable');
    if (resultsTable) {
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

// Load and display results in table
async function loadResults(filename) {
    if (!filename) return;

    try {
        // Fetch results data
        const response = await fetch(`/api/results?filename=${filename}`);
        if (!response.ok) throw new Error('Failed to load results');

        const results = await response.json();
        const tbody = document.querySelector('#resultsTable tbody');

        // Populate table
        results.forEach(row => {
            const tr = document.createElement('tr');

            tr.innerHTML = `
                <td><a href="${row.base_url}" target="_blank">${truncateText(row.base_url, 30)}</a></td>
                <td><a href="${row.competitor_url}" target="_blank">${truncateText(row.competitor_url, 30)}</a></td>
                <td>${formatSimilarity(row.similarity_score)}</td>
                <td>${row.brand || '-'}</td>
                <td>${formatPrice(row.price)}</td>
            `;

            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error('Error loading results:', error);
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
