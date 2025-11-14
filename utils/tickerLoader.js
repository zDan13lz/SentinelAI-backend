const fs = require('fs');
const path = require('path');

/**
 * Load all tickers from config
 */
function loadTickers() {
  try {
    const configPath = path.join(__dirname, '../config/tickers.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Flatten all tiers into one array
    const allTickers = new Set();
    
    Object.keys(config).forEach(tier => {
      if (tier !== 'all_tickers' && Array.isArray(config[tier])) {
        config[tier].forEach(ticker => allTickers.add(ticker));
      }
    });
    
    // Convert to array and sort
    const tickerArray = Array.from(allTickers).sort();
    
    console.log(`📊 Loaded ${tickerArray.length} unique tickers`);
    
    return tickerArray;
    
  } catch (error) {
    console.error('❌ Failed to load tickers:', error);
    // Return minimal fallback list
    return ['SPY', 'QQQ', 'TSLA', 'AAPL', 'NVDA'];
  }
}

/**
 * Batch tickers across N connections
 */
function batchTickers(tickers, connectionCount) {
  const batchSize = Math.ceil(tickers.length / connectionCount);
  const batches = [];
  
  for (let i = 0; i < connectionCount; i++) {
    const start = i * batchSize;
    const end = Math.min((i + 1) * batchSize, tickers.length);
    batches.push(tickers.slice(start, end));
  }
  
  return batches;
}

/**
 * Get ticker priority tier
 */
function getTickerTier(ticker) {
  const tier1 = ['SPY', 'QQQ', 'TSLA', 'AAPL', 'NVDA', 'META', 'GOOGL', 'AMZN', 'MSFT', 'AMD'];
  const tier2 = ['NFLX', 'DIS', 'BA', 'GS', 'JPM', 'V', 'MA', 'PYPL', 'SQ', 'COIN'];
  
  if (tier1.includes(ticker)) return 1;
  if (tier2.includes(ticker)) return 2;
  return 3;
}

module.exports = {
  loadTickers,
  batchTickers,
  getTickerTier
};