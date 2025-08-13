require('dotenv').config();

const express = require('express');
const app = express();
const compareRoute = require('./routes/compare');

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
