const csv = require('csv-parser');
const fs = require('fs');

const readCSV = (filePath) => {
    return new Promise((resolve, reject) => {
        const urls = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => urls.push(row.url))
            .on('end', () => resolve(urls))
            .on('error', reject);
    });
};

const validateURL = (url) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

module.exports = { readCSV, validateURL };
