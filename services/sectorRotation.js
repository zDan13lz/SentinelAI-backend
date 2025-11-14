const axios = require('axios');
require('dotenv').config();

const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;
const BASE_URL = 'https://api.massive.com';

// S&P 500 sector ETFs
const SECTOR_ETFS = {
  XLK: 'Technology',
  XLF: 'Financials',
  XLV: 'Healthcare',
  XLE: 'Energy',
  XLI: 'Industrials',
  XLC: 'Communication',
  XLY: 'Consumer Discretionary',
  XLP: 'Consumer Staples',
  XLRE: 'Real Estate',
  XLU: 'Utilities',
  XLB: 'Materials',
};

/**
 * Fetch sector performance data
 */
async function fetchSectorData(ticker, days = 90) {
  try {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(toDate.getDate() - days);
    
    const from = fromDate.toISOString().split('T')[0];
    const to = toDate.toISOString().split('T')[0];
    
    const url = `${BASE_URL}/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}`;
    
    const response = await axios.get(url, {
      params: {
        adjusted: true,
        sort: 'asc',
        limit: 5000,
        apiKey: MASSIVE_API_KEY,
      }
    });
    
    if (!response.data.results || response.data.results.length === 0) {
      return null;
    }
    
    const bars = response.data.results;
    const latest = bars[bars.length - 1];
    
    // Calculate performance over different periods
    const perf1D = bars.length >= 2 ? 
      ((latest.c - bars[bars.length - 2].c) / bars[bars.length - 2].c) * 100 : null;
    
    const perf5D = bars.length >= 6 ?
      ((latest.c - bars[bars.length - 6].c) / bars[bars.length - 6].c) * 100 : null;
    
    const perf20D = bars.length >= 21 ?
      ((latest.c - bars[bars.length - 21].c) / bars[bars.length - 21].c) * 100 : null;
    
    const perf60D = bars.length >= 61 ?
      ((latest.c - bars[bars.length - 61].c) / bars[bars.length - 61].c) * 100 : null;
    
    return {
      ticker,
      price: latest.c,
      volume: latest.v,
      performance: {
        '1D': perf1D,
        '5D': perf5D,
        '20D': perf20D,
        '60D': perf60D,
      },
    };
    
  } catch (error) {
    console.error(`❌ Error fetching data for ${ticker}:`, error.message);
    return null;
  }
}

/**
 * Calculate relative strength vs SPY benchmark
 */
function calculateRelativeStrength(sectorPerf, spyPerf, period = '20D') {
  if (!sectorPerf || !spyPerf) return null;
  
  const sectorReturn = sectorPerf[period];
  const spyReturn = spyPerf[period];
  
  if (sectorReturn === null || spyReturn === null) return null;
  
  return sectorReturn - spyReturn;
}

/**
 * Determine sector quadrant (Leading/Lagging/Improving/Weakening)
 */
function getSectorQuadrant(relativeStrength20D, relativeStrength60D) {
  if (relativeStrength20D === null || relativeStrength60D === null) {
    return 'UNKNOWN';
  }
  
  const isLeading = relativeStrength20D > 0;
  const isImproving = relativeStrength20D > relativeStrength60D;
  
  if (isLeading && isImproving) return 'LEADING';
  if (isLeading && !isImproving) return 'WEAKENING';
  if (!isLeading && isImproving) return 'IMPROVING';
  return 'LAGGING';
}

/**
 * Get complete sector rotation analysis
 */
async function getSectorRotation() {
  try {
    console.log('📊 Analyzing sector rotation...');
    
    const tickers = ['SPY', ...Object.keys(SECTOR_ETFS)];
    
    // Fetch data for all sectors + SPY
    const dataPromises = tickers.map(ticker => fetchSectorData(ticker, 90));
    const results = await Promise.all(dataPromises);
    
    // Extract SPY data
    const spyData = results[0];
    
    if (!spyData) {
      throw new Error('Unable to fetch SPY benchmark data');
    }
    
    // Process sector data
    const sectors = [];
    
    for (let i = 1; i < results.length; i++) {
      const sectorData = results[i];
      
      if (!sectorData) continue;
      
      const ticker = sectorData.ticker;
      const relativeStrength20D = calculateRelativeStrength(
        sectorData.performance,
        spyData.performance,
        '20D'
      );
      const relativeStrength60D = calculateRelativeStrength(
        sectorData.performance,
        spyData.performance,
        '60D'
      );
      
      const quadrant = getSectorQuadrant(relativeStrength20D, relativeStrength60D);
      
      sectors.push({
        ticker,
        name: SECTOR_ETFS[ticker],
        price: sectorData.price,
        volume: sectorData.volume,
        performance: sectorData.performance,
        relativeStrength: {
          '20D': relativeStrength20D,
          '60D': relativeStrength60D,
        },
        quadrant,
      });
    }
    
    // Sort by relative strength
    sectors.sort((a, b) => (b.relativeStrength['20D'] || 0) - (a.relativeStrength['20D'] || 0));
    
    console.log(' Sector rotation analysis complete');
    
    return {
      benchmark: {
        ticker: 'SPY',
        price: spyData.price,
        performance: spyData.performance,
      },
      sectors,
      timestamp: new Date().toISOString(),
    };
    
  } catch (error) {
    console.error('❌ Error analyzing sector rotation:', error.message);
    throw error;
  }
}

module.exports = {
  getSectorRotation,
  SECTOR_ETFS,
};