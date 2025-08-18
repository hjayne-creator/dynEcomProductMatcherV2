# 🚀 Local Setup Guide for Mac

This guide will help you get the Product Comparison Tool running locally on your Mac.

## ✅ Prerequisites

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **SerpAPI Key** - [Get free key here](https://serpapi.com/)

## 🛠️ Installation Steps

### 1. Clone/Download the Project
```bash
cd /path/to/your/projects
# If you haven't already downloaded the project
```

### 2. Install Dependencies
```bash
cd product-compare
npm install
```

### 3. Configure Environment Variables
```bash
# Copy the example environment file
cp env.example .env

# Edit the .env file with your API key
nano .env  # or use your preferred editor
```

**Required Configuration:**
```bash
# You MUST set this to your actual SerpAPI key
SERP_API_KEY=your_actual_api_key_here
```

**Optional Configuration:**
```bash
# Search settings
SEARCH_COUNTRY=us          # Country for search results
SEARCH_LANGUAGE=en         # Language for search results
ORGANIC_LIMIT=8           # Number of organic results to fetch
SHOPPING_LIMIT=5          # Number of shopping results to fetch
ENABLE_SHOPPING=true      # Enable shopping results

# Server settings
PORT=3000                 # Port to run the server on
NODE_ENV=development      # Environment mode
```

### 4. Get Your SerpAPI Key
1. Go to [https://serpapi.com/](https://serpapi.com/)
2. Sign up for a free account
3. Get your API key from the dashboard
4. Add it to your `.env` file

## 🚀 Running the Application

### Start the Server
```bash
npm start
```

### Access the Web Interface
Open your browser and go to: [http://localhost:3000](http://localhost:3000)

## 🧪 Testing the Setup

### Test 1: Basic Functionality
1. Open [http://localhost:3000](http://localhost:3000)
2. You should see the product comparison interface
3. Try entering a product URL to test

### Test 2: API Endpoints
Test the API directly:
```bash
curl http://localhost:3000/api/results
```

### Test 3: CSV Processing
1. Place a CSV file in the project root
2. Use the CSV input option in the web interface
3. Verify results are generated

## 🔧 Troubleshooting

### Common Issues

**Port Already in Use:**
```bash
# Change the port in .env file

# Or kill the process using port 3000
lsof -ti:3000 | xargs kill -9
```

**Puppeteer Issues:**
```bash
# If you get browser-related errors, Puppeteer will download its own Chromium
# This is normal and will happen automatically on first run
```

**API Key Issues:**
```bash
# Verify your .env file has the correct API key
cat .env | grep SERP_API_KEY

# Make sure there are no extra spaces or quotes
```

**Permission Issues:**
```bash
# If you get permission errors, try:
chmod +x setup.sh
./setup.sh
```

### Debug Mode
```bash
# Run with more verbose logging
NODE_ENV=development npm start
```

## 📁 Project Structure

```
product-compare/
├── src/
│   ├── app.js              # Main Express server
│   ├── routes/             # API routes
│   ├── utils/              # Utility functions
│   └── output/             # Generated CSV files
├── public/                 # Web interface files
├── .env                    # Environment variables (create this)
├── env.example            # Environment template
└── package.json           # Dependencies
```

## 🌐 Usage Examples

### Single URL Comparison
1. Go to [http://localhost:3000](http://localhost:3000)
2. Select "URL" input type
3. Enter a product URL
4. Click "Compare Products"
5. Wait for results and download CSV

### CSV Batch Processing
1. Prepare a CSV file with URLs
2. Select "CSV" input type
3. Upload your CSV file
4. Process and download results

### Google Sheets Integration
1. Make your Google Sheet public
2. Get the sheet ID from the URL
3. Select "Sheet" input type
4. Enter sheet ID and optional gid
5. Process and download results

## 🔒 Security Notes

- Keep your `.env` file private and never commit it to version control
- The `.env` file is already in `.gitignore`
- Your SerpAPI key should be kept secure

## 📞 Support

If you encounter issues:
1. Check the console output for error messages
2. Verify your environment variables are set correctly
3. Ensure all dependencies are installed
4. Check that the required directories exist

## 🎯 Next Steps

Once everything is working:
1. Try different product URLs
2. Experiment with search parameters
3. Test CSV and Google Sheets inputs
4. Review the generated reports

---

**Happy Product Comparing! 🎉**
