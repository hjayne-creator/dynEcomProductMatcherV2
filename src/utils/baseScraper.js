const puppeteer = require('puppeteer');

let browser;

const getBrowser = async () => {
    if (!browser) {
        browser = await puppeteer.launch({ headless: true });
    }
    return browser;
};

const scrapeBaseProduct = async (url) => {
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(process.env.USER_AGENT);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const image = await page.$eval('a.product-image.col-xs-12 img', img => img.src).catch(() => '');
    const title = await page.title();
    const metaDescription = await page.$eval('meta[name="description"]', el => el.content).catch(() => '');
    const metaKeywords = await page.$eval('meta[name="keywords"]', el => el.content).catch(() => '');

    await page.close();

    return {
        url,
        title,
        metaDescription,
        metaKeywords,
        image,
        searchTerm: title,
        name: title
    };
};

const closeBrowser = async () => {
    if (browser) {
        await browser.close();
        browser = null;
    }
};

module.exports = { scrapeBaseProduct, closeBrowser };
