// Retailer Brand Configuration
// This file contains a comprehensive list of retailer brands to exclude from search terms
// for better competitor product matching

const RETAILER_BRANDS = {
    // Major US Retailers
    major: [
        'walmart', 'target', 'amazon', 'best buy', 'home depot', 'lowes',
        'costco', 'sam\'s club', 'kroger', 'safeway', 'albertsons'
    ],
    
    // Pharmacy & Healthcare
    pharmacy: [
        'walgreens', 'cvs', 'rite aid', 'dollar general', 'dollar tree',
        'betty mills' 
    ],
    
    // Online Marketplaces
    marketplaces: [
        'ebay', 'etsy', 'wayfair', 'overstock', 'newegg', 'bhphotovideo',
        'adorama', 'adorama camera', 'adorama electronics'
    ],
    
    // Specialty Retail
    specialty: [
        'dick\'s sporting goods', 'academy sports', 'bass pro shops',
        'petco', 'petsmart', 'michaels', 'joann fabrics', 'hobby lobby',
        'bed bath & beyond', 'macy\'s', 'nordstrom', 'kohl\'s'
    ],
    
    // Industrial & Business
    industrial: [
        'grainger', 'fastenal', 'mcmaster-carr', 'staples', 'office depot',
        'office max', 'quill', 'autozone', 'oreilly', 'advance auto parts',
        'napa auto parts', 'pep boys', 'carquest'
    ],
    
    // Hardware & Home Improvement
    hardware: [
        'ace hardware', 'true value', 'do it best', 'coastal farm'
    ],
    
    // Grocery & Food
    grocery: [
        'publix', 'wegmans', 'shoprite', 'food lion', 'giant eagle',
        'meijer', 'hy-vee', 'heb', 'winco foods', 'aldi', 'lidl'
    ]
};

// Flatten all categories into a single array for easy use
const ALL_RETAILER_BRANDS = Object.values(RETAILER_BRANDS).flat();

// Export both the categorized and flat versions
module.exports = {
    RETAILER_BRANDS,
    ALL_RETAILER_BRANDS
};
