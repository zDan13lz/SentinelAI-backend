const axios = require('axios');
const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;
const BASE_URL = 'https://api.massive.com';

/**
 * Get top gainers or losers directly from Massive.com API
 * NO FILTERS - Just raw API data
 */
async function getTopMovers(type = 'gainers', minMarketCap = null, limit = 20) {
  try {
    console.log(`📊 Fetching top ${type} from Massive.com API...`);
    
    const url = `${BASE_URL}/v2/snapshot/locale/us/markets/stocks/${type}`;
    
    const response = await axios.get(url, {
      params: {
        apiKey: MASSIVE_API_KEY,
      }
    });
    
    if (!response.data.tickers || response.data.tickers.length === 0) {
      console.log('⚠️  No movers data returned from API');
      return [];
    }
    
    console.log(`📊 Raw ${type} from API: ${response.data.tickers.length} tickers`);
    
    // Map to our format - NO FILTERING
    const movers = response.data.tickers
      .slice(0, limit) // Just take the top N
      .map(ticker => ({
        ticker: ticker.ticker,
        price: ticker.day?.c || ticker.lastTrade?.p || 0,
        change: ticker.todaysChange || 0,
        changePercent: ticker.todaysChangePerc || 0,
        volume: ticker.day?.v || 0,
        marketCap: null, // Not provided by this endpoint
        avgVolume: null,
      }));
    
    console.log(` Returning ${movers.length} ${type}`);
    if (movers.length > 0) {
      console.log(`📋 Top 3: ${movers.slice(0, 3).map(m => `${m.ticker} ${m.changePercent >= 0 ? '+' : ''}${m.changePercent.toFixed(2)}%`).join(', ')}`);
    }
    
    return movers;
    
  } catch (error) {
    console.error(`❌ Error fetching ${type}:`, error.message);
    throw error;
  }
}

/**
 * Get all movers (gainers + losers)
 * Note: Pre-market is included in the same endpoint by Massive.com
 */
async function getAllMovers(minMarketCap = null, limit = 20) {
  try {
    console.log(`📊 Fetching all movers...`);
    
    // Fetch gainers and losers in parallel
    const [gainers, losers] = await Promise.all([
      getTopMovers('gainers', minMarketCap, limit),
      getTopMovers('losers', minMarketCap, limit),
    ]);
    
    // Determine market session for display purposes only
    const now = new Date();
    const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const hours = estTime.getHours();
    const minutes = estTime.getMinutes();
    
    let session = 'REGULAR';
    if ((hours === 4 && minutes >= 0) || (hours > 4 && hours < 9) || (hours === 9 && minutes < 30)) {
      session = 'PRE_MARKET';
    } else if ((hours === 16 && minutes >= 0) || (hours > 16 && hours < 20)) {
      session = 'AFTER_HOURS';
    } else if (hours >= 20 || hours < 4) {
      session = 'CLOSED';
    }
    
    console.log(` Current session: ${session}`);
    
    return {
      gainers,
      losers,
      preMarketGainers: [], //  Always empty - not a separate thing
      preMarketLosers: [],  //  Always empty - not a separate thing
      session, // Added for info
    };
    
  } catch (error) {
    console.error('❌ Error fetching all movers:', error);
    throw error;
  }
}

module.exports = {
  getTopMovers,
  getAllMovers,
};