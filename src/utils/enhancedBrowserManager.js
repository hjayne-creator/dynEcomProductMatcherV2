const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

class EnhancedBrowserManager {
    constructor() {
        this.browser = null;
        this.maxConcurrentPages = 10;
        this.activePages = new Set();
    }

    async getBrowser() {
        if (!this.browser || !this.browser.isConnected()) {
            this.browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            });
            console.log('[BROWSER] New browser instance created');
        }
        return this.browser;
    }

    async createPage() {
        const browser = await this.getBrowser();
        
        if (this.activePages.size >= this.maxConcurrentPages) {
            throw new Error(`Maximum concurrent pages (${this.maxConcurrentPages}) reached`);
        }

        const page = await browser.newPage();
        this.addActivePage(page);

        // Basic anti-detection
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setJavaScriptEnabled(true);
        await page.setDefaultNavigationTimeout(60000);
        await page.setDefaultTimeout(30000);

        return page;
    }

    // Compatible wait method for all Puppeteer versions
    async waitForPage(page, ms) {
        try {
            if (typeof page.waitForTimeout === 'function') {
                await page.waitForTimeout(ms);
            } else {
                // Fallback for older Puppeteer versions
                await new Promise(resolve => setTimeout(resolve, ms));
            }
        } catch (error) {
            // Final fallback
            await new Promise(resolve => setTimeout(resolve, ms));
        }
    }

    addActivePage(page) {
        this.activePages.add(page);
        console.log(`[BROWSER] Active pages: ${this.activePages.size}/${this.maxConcurrentPages}`);
        
        page.on('close', () => {
            this.activePages.delete(page);
            console.log(`[BROWSER] Page closed, active pages: ${this.activePages.size}/${this.maxConcurrentPages}`);
        });
    }

    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.activePages.clear();
            console.log('[BROWSER] Browser closed');
        }
    }

    async forceCleanup() {
        await this.closeBrowser();
    }
}

// Export singleton instance
module.exports = new EnhancedBrowserManager();
