const axios = require('axios');

const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;
const BASE_URL = 'https://api.massive.com';

// In-memory cache
const cache = new Map();
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

/**
 * Fetch a single page of options chain
 */
async function fetchOptionsPage(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${MASSIVE_API_KEY}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching options page:', error.message);
    throw new Error(
      error.response?.data?.message || 
      'Failed to fetch options data from Massive API'
    );
  }
}

/**
 * Fetch ALL options chain pages for a given ticker (handles pagination)
 */
async function fetchOptionsChain(ticker) {
  try {
    let allResults = [];
    let nextUrl = `${BASE_URL}/v3/snapshot/options/${ticker.toUpperCase()}?limit=250`;
    let pageCount = 0;
    
    console.log(`📡 Fetching options data for ${ticker}...`);
    
    // Keep fetching until no more pages
    while (nextUrl) {
      pageCount++;
      
      const pageData = await fetchOptionsPage(nextUrl);
      
      if (pageData.results && pageData.results.length > 0) {
        allResults = allResults.concat(pageData.results);
        console.log(`✅ Page ${pageCount}: ${pageData.results.length} contracts (Total: ${allResults.length})`);
      }
      
      // Check if there's a next page
      nextUrl = pageData.next_url || null;
    }
    
    console.log(`🎯 Fetching complete! Total contracts: ${allResults.length}`);
    
    return {
      results: allResults,
      status: 'OK',
      total_results: allResults.length,
    };
  } catch (error) {
    console.error('Error fetching options chain:', error);
    throw error;
  }
}

/**
 * Get options data with caching
 */
async function getOptionsData(ticker) {
  const cacheKey = ticker.toUpperCase();
  
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    const age = Math.round((Date.now() - cached.timestamp) / 1000);
    console.log(`⚡ Cache hit for ${ticker} (${age}s old)`);
    return {
      ...cached.data,
      cached: true,
      cacheAge: age
    };
  }
  
  // Fetch fresh data
  console.log(`🔄 Cache miss for ${ticker}, fetching from Massive API...`);
  const chainData = await fetchOptionsChain(ticker);
  
  if (!chainData.results || chainData.results.length === 0) {
    throw new Error('No options data available for this ticker');
  }

  // Extract spot price
  const spotPrice = chainData.results[0]?.underlying_asset?.price;
  if (!spotPrice) {
    throw new Error('Unable to extract underlying price');
  }

  // Process and format options data
  const processedOptions = chainData.results
    .filter(option => {
      return (
        option.greeks?.gamma &&
        option.open_interest &&
        option.details?.strike_price &&
        option.details?.expiration_date &&
        option.details?.contract_type
      );
    })
    .map(option => ({
      ticker: option.ticker,
      strike: option.details.strike_price,
      expiration: option.details.expiration_date,
      contractType: option.details.contract_type,
      gamma: option.greeks.gamma,
      delta: option.greeks.delta,
      vega: option.greeks.vega || 0,
      openInterest: option.open_interest,
      impliedVolatility: option.implied_volatility,
      lastPrice: option.last_trade?.price || option.last_quote?.midpoint || 0,
    }));

  const result = {
    ticker: ticker.toUpperCase(),
    spotPrice,
    options: processedOptions,
    totalContracts: chainData.results.length,
    validContracts: processedOptions.length,
    timestamp: new Date().toISOString(),
    cached: false
  };

  // Cache the result
  cache.set(cacheKey, {
    data: result,
    timestamp: Date.now()
  });

  console.log(`✅ Cached ${ticker} (${processedOptions.length} contracts)`);

  return result;
}

/**
 * Clear cache for a specific ticker or all
 */
function clearCache(ticker = null) {
  if (ticker) {
    cache.delete(ticker.toUpperCase());
    console.log(`🗑️ Cleared cache for ${ticker}`);
  } else {
    cache.clear();
    console.log(`🗑️ Cleared all cache`);
  }
}

/**
 * Get cache stats
 */
function getCacheStats() {
  const stats = {
    size: cache.size,
    entries: []
  };

  cache.forEach((value, key) => {
    const age = Math.round((Date.now() - value.timestamp) / 1000);
    const ttlRemaining = Math.max(0, Math.round((CACHE_TTL - (Date.now() - value.timestamp)) / 1000));
    
    stats.entries.push({
      ticker: key,
      age: `${age}s`,
      ttlRemaining: `${ttlRemaining}s`,
      contracts: value.data.validContracts
    });
  });

  return stats;
}

module.exports = {
  getOptionsData,
  clearCache,
  getCacheStats
};