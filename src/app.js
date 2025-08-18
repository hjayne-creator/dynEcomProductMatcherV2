require('dotenv').config();

const express = require('express');
const app = express();

let compareRoute;
try {
    compareRoute = require('./routes/compare');
} catch (error) {
    console.error('[ERROR] Failed to load compare route module:', error);
    console.error('[ERROR] Error stack:', error.stack);
    process.exit(1);
}

const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const performanceMonitor = require('./utils/performanceMonitor');

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Mount API routes
try {
    if (compareRoute && typeof compareRoute === 'function') {
        app.use('/api', compareRoute);
        console.log('[ROUTES] Compare route mounted successfully at /api');
    } else {
        console.error('[ERROR] Compare route is not a valid Express router');
        console.error('[ERROR] Compare route type:', typeof compareRoute);
        console.error('[ERROR] Compare route value:', compareRoute);
    }
} catch (error) {
    console.error('[ERROR] Failed to mount compare route:', error);
    console.error('[ERROR] Error stack:', error.stack);
}

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve results page
app.get('/results', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'results.html'));
});

// Serve results data as JSON
app.get('/api/results', async (req, res) => {
    try {
        const filename = req.query.filename;
        if (!filename) return res.status(400).json({ error: 'Filename required' });

        const filePath = path.join(__dirname, 'output', filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        console.log(`[API] Reading CSV file: ${filePath}`);
        
        const results = [];
        const stream = fs.createReadStream(filePath)
            .pipe(csv({
                mapHeaders: ({ header }) => header.trim(),
                mapValues: ({ value }) => value.trim()
            }))
            .on('data', (data) => {
                results.push(data);
            })
            .on('end', () => {
                console.log(`[API] CSV parsing completed, ${results.length} rows parsed`);
                res.json(results);
            })
            .on('error', (error) => {
                console.error('[API] CSV parsing error:', error);
                res.status(500).json({ error: 'Failed to parse CSV', details: error.message });
            });
    } catch (error) {
        console.error('[API] Error reading CSV:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
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

// Performance monitoring endpoint
app.get('/api/performance', (req, res) => {
    try {
        const summary = performanceMonitor.getSummary();
        res.json({
            success: true,
            data: summary,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[PERFORMANCE] Error getting performance data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get performance data',
            details: error.message
        });
    }
});

// Reset performance metrics endpoint
app.post('/api/performance/reset', (req, res) => {
    try {
        performanceMonitor.reset();
        res.json({
            success: true,
            message: 'Performance metrics reset successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[PERFORMANCE] Error resetting metrics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reset performance metrics',
            details: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        zyteConfigured: !!process.env.ZYTE_API_KEY
    });
});

// Zyte status endpoint
app.get('/api/zyte-status', (req, res) => {
    try {
        const zyteStatus = {
            configured: !!process.env.ZYTE_API_KEY,
            apiKeyLength: process.env.ZYTE_API_KEY ? process.env.ZYTE_API_KEY.length : 0,
            country: process.env.ZYTE_COUNTRY || 'US',
            dailyBudget: process.env.ZYTE_DAILY_BUDGET || 'Not set',
            hourlyLimit: process.env.ZYTE_HOURLY_LIMIT || 'Not set',
            timestamp: new Date().toISOString()
        };
        
        res.json({
            success: true,
            data: zyteStatus
        });
    } catch (error) {
        console.error('[ZYTE STATUS] Error getting Zyte status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get Zyte status',
            details: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('[ERROR] Global error handler caught:', err);
    
    if (!res.headersSent) {
        res.status(500).json({ 
            error: 'Internal Server Error',
            message: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 404 handler for unmatched routes (catch-all)
app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        availableRoutes: [
            'GET /',
            'GET /results',
            'GET /health',
            'POST /api/compare',
            'GET /api/results',
            'GET /api/download/:filename',
            'GET /api/performance',
            'POST /api/performance/reset',
            'GET /api/zyte-status'
        ],
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`[SERVER] Server running on port ${PORT}`);
    console.log(`[SERVER] Frontend available at: http://localhost:${PORT}`);
    console.log(`[SERVER] Performance monitoring: http://localhost:${PORT}/api/performance`);
    console.log(`[SERVER] Zyte status: http://localhost:${PORT}/api/zyte-status`);
    console.log(`[SERVER] API base URL: http://localhost:${PORT}/api`);
    console.log(`[SERVER] Compare endpoint: http://localhost:${PORT}/api/compare`);
    
    // Check Zyte configuration
    if (process.env.ZYTE_API_KEY) {
        console.log(`[ZYTE] API key configured (${process.env.ZYTE_API_KEY.length} characters)`);
        console.log(`[ZYTE] Country: ${process.env.ZYTE_COUNTRY || 'US'}`);
        console.log(`[ZYTE] Daily budget: $${process.env.ZYTE_DAILY_BUDGET || 'Not set'}`);
        console.log(`[ZYTE] Hourly limit: ${process.env.ZYTE_HOURLY_LIMIT || 'Not set'}`);
    } else {
        console.error(`[ZYTE] ⚠️  WARNING: ZYTE_API_KEY not configured!`);
        console.error(`[ZYTE] ⚠️  The system will not function without a valid Zyte API key.`);
        console.error(`[ZYTE] ⚠️  Please set ZYTE_API_KEY in your .env file.`);
    }
    
    // Test route accessibility
    console.log(`[SERVER] Testing route accessibility...`);
    console.log(`[SERVER] - GET /api/compare should return router info`);
    console.log(`[SERVER] - POST /api/compare should handle compare requests`);
    console.log(`[SERVER] - GET / should serve index.html`);
    console.log(`[SERVER] - GET /results should serve results.html`);
});
