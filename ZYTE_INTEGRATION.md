# Zyte Integration - Hybrid Scraping System

This document explains how to use the new hybrid scraping system that combines Puppeteer, Axios, and Zyte to avoid 403 errors and improve scraping reliability.

## 🚀 Overview

The hybrid system automatically tries multiple scraping methods in order of cost-effectiveness:

1. **Axios** (fastest, cheapest) - for simple HTML pages
2. **Puppeteer** (medium speed, free) - for JavaScript-heavy pages
3. **Zyte** (slowest, most expensive) - as a fallback when others fail

## 📋 Setup

### 1. Get Zyte API Key
- Sign up at [https://app.zyte.com/](https://app.zyte.com/)
- Get your API key from the dashboard
- Add it to your `.env` file:

```bash
ZYTE_API_KEY=your_api_key_here
```

### 2. Optional Configuration
You can customize Zyte behavior by setting these environment variables:

```bash
# Geographic targeting
ZYTE_COUNTRY=US

# Daily budget limit (in USD)
ZYTE_DAILY_BUDGET=50

# Hourly request limit
ZYTE_HOURLY_LIMIT=100
```

## 🧪 Testing

Test your Zyte integration:

```bash
npm run test-zyte
```

This will:
- Verify your API key works
- Test a simple scraping request
- Show configuration details
- Display cost estimates

## 🔧 How It Works

### BaseScraper.js
- **Primary**: Puppeteer with stealth plugin
- **Fallback**: Zyte when Puppeteer fails with 403/blocking errors
- **Result**: Tracks which method was used (`method` field)

### CompetitorScraper.js
- **Primary**: Enhanced Puppeteer (most reliable, hardest to detect)
- **Secondary**: Axios (fastest but more likely to be blocked)
- **Fallback**: Zyte when both fail
- **Result**: Tracks which method was used (`method` field)

## 💰 Cost Management

### Cost Estimates (per request)
- **Residential Proxy**: $0.25
- **Datacenter Proxy**: $0.10
- **ISP Proxy**: $0.15
- **JavaScript Rendering**: $0.05

### Budget Control
- Set `ZYTE_DAILY_BUDGET` to limit daily spending
- Set `ZYTE_HOURLY_LIMIT` to control request rate
- Monitor usage in Zyte dashboard

## 📊 Monitoring

### Logging
The system logs which method was used for each request:

```
[PUPPETEER] Scrape failed for https://example.com: 403 Forbidden
[FALLBACK] Retrying with Zyte for https://example.com
[ZYTE] Successfully scraped https://example.com as fallback
```

### Method Tracking
Each result includes a `method` field:
- `puppeteer` - Used Puppeteer successfully
- `axios_fallback` - Used Axios as fallback
- `zyte_fallback` - Used Zyte as fallback

## ⚙️ Configuration

### Zyte Settings (`src/config/zyteConfig.js`)

```javascript
// Proxy rotation
proxy: {
    country: 'US',           // Geographic targeting
    enableSessions: true,    // Session persistence
    rotation: {
        residential: true,   // Most expensive, hardest to detect
        datacenter: false,   // Cheapest, easiest to detect
        isp: false          // Middle ground
    }
}

// Fallback triggers
fallback: {
    triggers: ['403', '429', 'blocked', 'forbidden'],
    maxAttempts: 2,
    retryDelay: 2000
}
```

## 🚨 Troubleshooting

### Common Issues

1. **API Key Invalid**
   ```
   ❌ Zyte API error: API Error: 401
   ```
   - Check your API key in `.env`
   - Verify key is active in Zyte dashboard

2. **Rate Limited**
   ```
   ❌ Zyte API error: API Error: 429
   ```
   - Reduce request frequency
   - Increase `ZYTE_HOURLY_LIMIT`

3. **Budget Exceeded**
   ```
   ❌ Zyte API error: Insufficient credits
   ```
   - Check your Zyte account balance
   - Set `ZYTE_DAILY_BUDGET` appropriately

### Performance Tips

1. **Start with Enhanced Puppeteer** - Most reliable and hardest to detect
2. **Use sessions** - Maintain cookies between requests
3. **Geographic targeting** - Use local proxies for better success rates
4. **Monitor costs** - Track usage to optimize spending

## 🔄 Migration from Old System

The hybrid system is **backward compatible**. Existing code will work unchanged, but now has automatic fallback to Zyte when needed.

### Before (Old System)
```javascript
const result = await scrapeBaseProduct(url);
// Could fail with 403, no fallback
```

### After (Hybrid System)
```javascript
const result = await scrapeBaseProduct(url);
// Automatically falls back to Zyte if needed
// Result includes method used: 'puppeteer' or 'zyte_fallback'
```

## 📈 Success Metrics

Track these metrics to measure improvement:

- **403 Error Rate**: Should decrease significantly
- **Success Rate**: Should increase overall
- **Cost per Request**: Monitor Zyte usage
- **Response Time**: Axios < Puppeteer < Zyte

## 🆘 Support

- **Zyte Documentation**: [https://docs.zyte.com/](https://docs.zyte.com/)
- **Zyte Dashboard**: [https://app.zyte.com/](https://app.zyte.com/)
- **API Status**: [https://status.zyte.com/](https://status.zyte.com/)

---

**Note**: The hybrid system automatically optimizes for cost and performance. Zyte is only used when necessary, keeping your scraping costs minimal while maximizing success rates.
