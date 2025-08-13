const axios = require('axios');
const csv = require('csv-parser');
const { Readable } = require('stream');

async function readPublicSheet(sheetId, gid = 0) {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

    try {
        const response = await axios.get(csvUrl, {
            responseType: 'stream'
        });

        return new Promise((resolve, reject) => {
            const results = [];
            const stream = Readable.from(response.data)
                .pipe(csv())
                .on('data', (row) => results.push(row.URL)) // Assuming column is named "URL"
                .on('end', () => resolve(results))
                .on('error', reject);
        });
    } catch (error) {
        console.error('Error reading public sheet:', error.message);
        throw error;
    }
}

module.exports = { readPublicSheet };
