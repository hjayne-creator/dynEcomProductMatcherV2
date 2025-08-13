const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const { extractJsonLd } = require('./jsonLdParser');

// Retry wrapper for network calls
const scrapeWithRetry = async (url, retries = 3, delayMs = 2000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get(url, {
                timeout: 15000,
                maxRedirects: 5,
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                }
            });
            return response;
        } catch (e) {
            if (i === retries - 1) throw e;
            await new Promise(r => setTimeout(r, delayMs * (i + 1)));
        }
    }
};

// Image validity filter
const isImageValid = (src) => {
    if (!src) return false;
    const lower = src.toLowerCase();
    return !lower.endsWith('.svg') &&
        !lower.includes('logo') &&
        !lower.includes('icon') &&
        !lower.includes('banner') &&
        !lower.includes('placeholder') &&
        !lower.startsWith('data:image'); // skip base64 inline
};

// Parse size from attributes or inline style
const parseSize = (el, $) => {
    let w = parseInt($(el).attr('width')) || 0;
    let h = parseInt($(el).attr('height')) || 0;

    const style = $(el).attr('style');
    if (style) {
        const wMatch = style.match(/width\s*:\s*(\d+)px/i);
        const hMatch = style.match(/height\s*:\s*(\d+)px/i);
        if (wMatch) w = parseInt(wMatch[1]);
        if (hMatch) h = parseInt(hMatch[1]);
    }

    return w * h;
};

// Context boost if inside product/main sections
const isProductContext = (el, $) => {
    return $(el).parents('div[class*=product], section[class*=product], main, #content, .product-main, .product-image').length > 0;
};

// Recursively find product image in any JSON-LD structure
const findProductImageFromJsonLd = (data) => {
    if (!data) return null;
    if (Array.isArray(data)) {
        for (const item of data) {
            const img = findProductImageFromJsonLd(item);
            if (img) return img;
        }
    }
    if (typeof data === 'object') {
        if (data['@type'] && data['@type'].toLowerCase() === 'product' && data.image) {
            return Array.isArray(data.image) ? data.image[0] : data.image;
        }
        if (data['@graph']) return findProductImageFromJsonLd(data['@graph']);
    }
    return null;
};

// Get image src from element, supporting lazy-load & srcset
const getImageSrc = (el, $, baseUrl) => {
    let src = $(el).attr('src') ||
        $(el).attr('data-src') ||
        $(el).attr('data-lazy') ||
        $(el).attr('data-original') ||
        null;

    if (!src && $(el).attr('srcset')) {
        // Get largest image in srcset
        const parts = $(el).attr('srcset').split(',').map(s => s.trim().split(' ')[0]);
        src = parts[parts.length - 1];
    }

    if (!src) return null;

    try {
        return new URL(src, baseUrl).href;
    } catch {
        return null;
    }
};

// Main scrape function
const scrapeCompetitor = async (url) => {
    try {
        const response = await scrapeWithRetry(url);
        const $ = cheerio.load(response.data);

        const metaTitle = $('title').text().trim();
        const metaDescription = $('meta[name="description"]').attr('content') || '';
        const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
        const wordCount = bodyText.split(/\s+/).length;
        const jsonLdRaw = extractJsonLd(response.data);

        const candidates = [];

        // Layer 1: og:image
        const ogImage = $('meta[property="og:image"]').attr('content');
        if (ogImage && isImageValid(ogImage)) {
            candidates.push({
                src: new URL(ogImage, url).href,
                score: 1000
            });
        }

        // Layer 2: JSON-LD Product
        const jsonLdImage = findProductImageFromJsonLd(jsonLdRaw);
        if (jsonLdImage && isImageValid(jsonLdImage)) {
            candidates.push({
                src: new URL(jsonLdImage, url).href,
                score: 950
            });
        }

        // Layer 3: All <img> tags with scoring
        $('img').each((_, el) => {
            const src = getImageSrc(el, $, url);
            if (!isImageValid(src)) return;

            const size = parseSize(el, $);
            if (size < 2000) return; // skip very small images

            const contextBoost = isProductContext(el, $) ? 200 : 0;
            candidates.push({
                src,
                score: size + contextBoost
            });
        });

        // Deduplicate by src
        const unique = {};
        for (const c of candidates) {
            if (!unique[c.src] || unique[c.src].score < c.score) {
                unique[c.src] = c;
            }
        }
        let sorted = Object.values(unique).sort((a, b) => b.score - a.score);

        // Layer 4: Puppeteer fallback if no candidates
        let compImage = sorted.length > 0 ? sorted[0].src : null;
        if (!compImage) {
            const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0');
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });

            // Try og:image dynamically
            const dynamicOg = await page.$eval('meta[property="og:image"]', el => el?.content || null).catch(() => null);
            if (dynamicOg && isImageValid(dynamicOg)) {
                compImage = new URL(dynamicOg, url).href;
            } else {
                // Grab largest visible image
                const imgs = await page.$$eval('img', els => els.map(el => {
                    const rect = el.getBoundingClientRect();
                    return {
                        src: el.src || el.dataset.src || null,
                        area: rect.width * rect.height
                    };
                }));
                const biggest = imgs.filter(i => i.src && !i.src.includes('logo') && !i.src.includes('icon'))
                    .sort((a, b) => b.area - a.area)[0];
                if (biggest) compImage = biggest.src;
            }

            await browser.close();
        }

        return {
            url,
            metaTitle,
            metaDescription,
            wordCount,
            compImage,
            jsonLd: jsonLdRaw,
            rawHTML: response.data
        };
    } catch (error) {
        console.error(`Scraping failed for ${url}: ${error.message}`);
        return null;
    }
};

module.exports = scrapeCompetitor;
