const { join } = require('path');

/**
* @type {import("puppeteer").Configuration}
*/
module.exports = {
    // Changes the cache location for Puppeteer.
    cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
    
    // Render-specific optimizations
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
    ],
    
    // Use system Chrome on Render, bundled Chrome locally
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    
    // Skip Chromium download on Render
    skipChromiumDownload: process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD === 'true'
};
