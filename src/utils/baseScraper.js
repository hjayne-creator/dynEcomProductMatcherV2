const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const randomUseragent = require('random-useragent');
const { createOptimizedSearchTerm, logSearchTermOptimization } = require('./searchTermOptimizer');

puppeteer.use(StealthPlugin());

const delay = ms => new Promise(res => setTimeout(res, ms));
// ====== Shared Browser Instance ======
let globalBrowser = null;

const getBrowser = async () => {
    if (globalBrowser && globalBrowser.isConnected()) {
        return globalBrowser;
    }

    globalBrowser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--single-process',
            '--no-zygote',
            '--disable-gpu',
            `--user-agent=${randomUseragent.getRandom()}`
        ],
        timeout: 120000,  // Increased launch timeout
        protocolTimeout: 120000,
        executablePath: process.env.PUPPETEER_EXEC_PATH || puppeteer.executablePath()
    });

    return globalBrowser;
};

// ====== Enhanced Scraping Function ======
const scrapeBaseProduct = async (url) => {
    let page;
    try {
        const browser = await getBrowser();
        page = await browser.newPage();

        // Configure page settings
        await page.setJavaScriptEnabled(true);
        await page.setDefaultNavigationTimeout(60000);
        await page.setDefaultTimeout(30000);

        // Navigation with robust retry
        const navigate = async (attempt = 1) => {
            try {
                await page.goto(url, {
                    waitUntil: 'domcontentloaded',
                    timeout: 45000,
                    referer: 'https://www.google.com/'
                });
            } catch (error) {
                if (attempt <= 3) {
                    await delay(2000 * attempt);
                    return navigate(attempt + 1);
                }
                throw error;
            }
        };

        await navigate();

        // Content detection with fallbacks
        await Promise.race([
            page.waitForSelector('a.product-image.col-xs-12 img', { timeout: 10000 }),
            page.waitForSelector('img.product-image', { timeout: 10000 }),
            page.waitForSelector('body', { timeout: 5000 })
        ]).catch(() => { });

        // Data extraction with error protection
        const result = {
            url,
            title: await page.title(),
            metaDescription: await page.$eval('meta[name="description"]', el => el.content).catch(() => ''),
            image: await page.$eval(
                'a.product-image.col-xs-12 img, img.product-image',
                img => img.src || img.dataset.src || ''
            ).catch(() => '')
        };

        // Create optimized search term for competitor finding
        const excludeDomain = new URL(url).hostname;
        result.searchTerm = createOptimizedSearchTerm(result.title, excludeDomain);
        result.name = result.title;
        
        // Log the optimization process
        logSearchTermOptimization(result.title, result.searchTerm, excludeDomain);

        return result;
    } catch (error) {
        console.error(`[FATAL] Scrape failed for ${url}: ${error.message}`);
        return null;
    } finally {
        if (page && !page.isClosed()) await page.close();
    }
};

// ====== Server Cleanup Handler ======
process.on('SIGINT', async () => {
    if (globalBrowser) {
        await globalBrowser.close();
        console.log('Browser instance closed gracefully');
    }
    process.exit();
});

module.exports = { scrapeBaseProduct }; module.exports = { scrapeBaseProduct };
