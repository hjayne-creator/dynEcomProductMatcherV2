const csv = require('csv-parser');
const { Readable } = require('stream');
const axios = require('axios');

async function readPublicSheet(sheetId, gid = 0) {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

    try {
        console.log(`[SHEET] Attempting to read Google Sheet: ${csvUrl}`);
        
        // Use axios for better timeout and error handling
        const response = await axios.get(csvUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 30000,
            maxRedirects: 5, // Follow up to 5 redirects
            validateStatus: function (status) {
                return status >= 200 && status < 400; // Accept redirects
            }
        });

        if (response.status !== 200) {
            const status = response.status;
            const statusText = response.statusText;
            
            if (status === 404) {
                throw new Error(`Google Sheet not found (404). Please check that the sheet ID "${sheetId}" is correct and the sheet is publicly accessible.`);
            } else if (status === 403) {
                throw new Error(`Access denied to Google Sheet (403). Please ensure the sheet is set to "Anyone with the link can view".`);
            } else if (status === 429) {
                throw new Error(`Rate limit exceeded (429). Please wait a moment and try again.`);
            } else if (status >= 500) {
                throw new Error(`Google Sheets server error (${status}). Please try again later.`);
            } else {
                throw new Error(`Google Sheets API error: ${status} - ${statusText}`);
            }
        }

        console.log(`[SHEET] Successfully connected to Google Sheet, status: ${response.status}`);
        
        // Get the response data (axios automatically parses text)
        const csvText = response.data;
        
        return new Promise((resolve, reject) => {
            const results = [];
            
            // Create a readable stream from the CSV text
            const stream = Readable.from(csvText)
                .pipe(csv())
                .on('data', (row) => {
                    if (row.URL) {
                        results.push(row.URL);
                    }
                })
                .on('end', () => {
                    console.log(`[SHEET] Successfully parsed ${results.length} URLs from Google Sheet`);
                    if (results.length === 0) {
                        reject(new Error('No URLs found in the Google Sheet. Please ensure the sheet has a column named "URL" with valid URLs.'));
                    } else {
                        resolve(results);
                    }
                })
                .on('error', (streamError) => {
                    console.error(`[SHEET] CSV parsing error: ${streamError.message}`);
                    reject(new Error(`Failed to parse CSV data: ${streamError.message}`));
                });
        });
    } catch (error) {
        console.error(`[SHEET] Error reading public sheet: ${error.message}`);
        
        // Re-throw the error with context
        if (error.message.includes('Google Sheet')) {
            throw error; // Already formatted
        } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Failed to connect to Google Sheets. Please check your internet connection and try again.');
        } else if (error.code === 'ECONNABORTED') {
            throw new Error('Request timeout. Please check your internet connection and try again.');
        } else if (error.code === 'ENOTFOUND') {
            throw new Error('Could not resolve Google Sheets server. Please check your internet connection and try again.');
        } else {
            throw new Error(`Error reading Google Sheet: ${error.message}`);
        }
    }
}

module.exports = { readPublicSheet };
