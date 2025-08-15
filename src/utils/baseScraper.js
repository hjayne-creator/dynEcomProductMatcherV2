const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const randomUseragent = require('random-useragent');

// Add stealth plugin
puppeteer.use(StealthPlugin());

// Alternative delay function since waitForTimeout might not be available
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const scrapeBaseProduct = async (url) => {
    let browser;
    try {
        // Configure browser with evasion techniques
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const page = await browser.newPage();

        // Set random user agent and realistic viewport
        const userAgent = randomUseragent.getRandom();
        await page.setUserAgent(userAgent);
        await page.setViewport({
            width: 1280 + Math.floor(Math.random() * 100),
            height: 800 + Math.floor(Math.random() * 100)
        });

        // Remove webdriver flag
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
        });

        // Add random delay before navigation using alternative method
        await delay(2000 + Math.random() * 3000);

        // Configure navigation with retries
        let retries = 3;
        let lastError;

        while (retries > 0) {
            try {
                await page.goto(url, {
                    waitUntil: 'networkidle2',
                    timeout: 60000,
                    referer: 'https://www.google.com/'
                });
                break;
            } catch (err) {
                lastError = err;
                retries--;
                if (retries === 0) throw err;
                await delay(5000); // Using our alternative delay function
            }
        }

        // Wait for content with multiple fallbacks
        try {
            await page.waitForSelector('a.product-image.col-xs-12 img', {
                timeout: 15000
            });
        } catch {
            await page.waitForSelector('body', { timeout: 5000 }).catch(() => { });
        }

        // Scrape data with robust error handling
        const result = {
            url,
            title: await page.title(),
            metaDescription: await page.$eval('meta[name="description"]', el => el.content).catch(() => ''),
            metaKeywords: await page.$eval('meta[name="keywords"]', el => el.content).catch(() => ''),
            image: await page.$eval('a.product-image.col-xs-12 img', img => img.src)
                .catch(() => page.$eval('img.product-image', img => img.src).catch(() => ''))
        };

        result.searchTerm = result.title;
        result.name = result.title;

        return result;
    } catch (error) {
        console.error(`Error scraping ${url}:`, error.message);
        return null;
    } finally {
        if (browser) await browser.close();
    }
};

module.exports = { scrapeBaseProduct };
