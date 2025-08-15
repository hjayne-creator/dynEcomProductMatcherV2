require('dotenv').config();

const express = require('express');
const app = express();
const compareRoute = require('./routes/compare');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser'); // add this at the top

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve results data as JSON
app.get('/api/results', async (req, res) => {
    try {
        const filename = req.query.filename;
        if (!filename) return res.status(400).json({ error: 'Filename required' });

        const filePath = path.join(__dirname, 'output', filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        const results = [];
        const stream = fs.createReadStream(filePath)
            .pipe(csv({
                mapHeaders: ({ header }) => header.trim(), // Clean headers
                mapValues: ({ value }) => value.trim()     // Clean values
            }))
            .on('data', (data) => results.push(data))
            .on('end', () => {
                res.json(results);
            })
            .on('error', (error) => {
                console.error('CSV parsing error:', error);
                res.status(500).json({ error: 'Failed to parse CSV' });
            });
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Download endpoint
app.get('/api/download/:filename', (req, res) => {
    const filename = req.params.filename;
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
