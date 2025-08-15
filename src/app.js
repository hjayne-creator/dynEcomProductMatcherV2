require('dotenv').config();

const express = require('express');
const app = express();
const compareRoute = require('./routes/compare');
const path = require('path');
const fs = require('fs');

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve results data as JSON
app.get('/api/results', async (req, res) => {
    try {
        const filename = req.query.filename;
        if (!filename) return res.status(400).json({ error: 'Filename required' });

        const filePath = path.join(__dirname, 'output', filename);
        const csvData = fs.readFileSync(filePath, 'utf8');

        // Simple CSV to JSON conversion
        const lines = csvData.split('\n');
        const headers = lines[0].replace(/"/g, '').split(',');
        const results = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i]) continue;

            const values = lines[i].split(',');
            const row = {};

            headers.forEach((header, j) => {
                row[header] = values[j] ? values[j].replace(/"/g, '') : '';
            });

            results.push(row);
        }

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load results' });
    }
});

// Download endpoint
app.get('/api/download', (req, res) => {
    const filename = req.query.filename;
    if (!filename) return res.status(400).send('Filename required');

    const filePath = path.join(__dirname, 'output', filename);
    res.download(filePath, (err) => {
        if (err) {
            console.error('Download failed:', err);
            res.status(500).send('File not found');
        }
    });
});
app.use(express.json());

app.use('/api', compareRoute);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
