const axios = require('axios');
require('dotenv').config();

const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;
const BASE_URL = 'https://api.massive.com';

// Assets to track for correlation
const CORRELATION_ASSETS = {
  SPY: 'S&P 500',
  QQQ: 'NASDAQ 100',
  IWM: 'Russell 2000',
  DIA: 'Dow Jones',
  TLT: 'Bonds (20Y)',
  GLD: 'Gold',
  VIXY: 'VIX ETF',
};

/**
 * Fetch historical data for correlation calculation
 */
async function fetchHistoricalData(ticker, days = 60) {
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
      console.warn(`⚠️  No historical data for ${ticker}`);
      return [];
    }
    
    return response.data.results.map(bar => ({
      time: bar.t,
      close: bar.c,
    }));
    
  } catch (error) {
    console.error(`❌ Error fetching historical data for ${ticker}:`, error.message);
    return [];
  }
}

/**
 * Calculate Pearson correlation coefficient
 */
function calculateCorrelation(data1, data2) {
  if (!data1 || !data2 || data1.length === 0 || data2.length === 0) {
    return null;
  }
  
  // Align data by timestamps
  const aligned = [];
  const timeMap = new Map(data2.map(d => [d.time, d.close]));
  
  for (const d1 of data1) {
    const price2 = timeMap.get(d1.time);
    if (price2 !== undefined) {
      aligned.push({ price1: d1.close, price2 });
    }
  }
  
  if (aligned.length < 10) {
    return null; // Not enough data points
  }
  
  // Calculate returns
  const returns1 = [];
  const returns2 = [];
  
  for (let i = 1; i < aligned.length; i++) {
    const ret1 = (aligned[i].price1 - aligned[i - 1].price1) / aligned[i - 1].price1;
    const ret2 = (aligned[i].price2 - aligned[i - 1].price2) / aligned[i - 1].price2;
    returns1.push(ret1);
    returns2.push(ret2);
  }
  
  // Calculate correlation
  const n = returns1.length;
  const mean1 = returns1.reduce((sum, r) => sum + r, 0) / n;
  const mean2 = returns2.reduce((sum, r) => sum + r, 0) / n;
  
  let numerator = 0;
  let sum1Sq = 0;
  let sum2Sq = 0;
  
  for (let i = 0; i < n; i++) {
    const diff1 = returns1[i] - mean1;
    const diff2 = returns2[i] - mean2;
    numerator += diff1 * diff2;
    sum1Sq += diff1 * diff1;
    sum2Sq += diff2 * diff2;
  }
  
  const denominator = Math.sqrt(sum1Sq * sum2Sq);
  
  if (denominator === 0) {
    return null;
  }
  
  return numerator / denominator;
}

/**
 * Get current prices for all assets
 */
async function getCurrentPrices(tickers) {
  try {
    const tickerList = tickers.join(',');
    const url = `${BASE_URL}/v3/snapshot`;
    
    const response = await axios.get(url, {
      params: {
        'ticker.any_of': tickerList,
        apiKey: MASSIVE_API_KEY,
      }
    });
    
    if (!response.data.results) {
      return {};
    }
    
    const prices = {};
    for (const result of response.data.results) {
      prices[result.ticker] = {
        price: result.session?.price || result.last_trade?.price || 0,
        change: result.session?.change || 0,
        changePercent: result.session?.change_percent || 0,
      };
    }
    
    return prices;
    
  } catch (error) {
    console.error('❌ Error fetching current prices:', error.message);
    return {};
  }
}

/**
 * Get cross-asset correlation matrix
 */
async function getCorrelationMatrix(period = 60) {
  try {
    console.log(`📊 Calculating ${period}-day correlation matrix...`);
    
    const tickers = Object.keys(CORRELATION_ASSETS);
    
    // Fetch historical data for all assets
    const historicalDataPromises = tickers.map(ticker => 
      fetchHistoricalData(ticker, period)
    );
    
    const historicalData = await Promise.all(historicalDataPromises);
    const dataMap = new Map();
    
    tickers.forEach((ticker, index) => {
      dataMap.set(ticker, historicalData[index]);
    });
    
    // Calculate correlation matrix (SPY vs all others)
    const spyData = dataMap.get('SPY');
    const correlations = {};
    
    for (const ticker of tickers) {
      if (ticker === 'SPY') {
        correlations[ticker] = 1.0; // Self correlation
      } else {
        const correlation = calculateCorrelation(spyData, dataMap.get(ticker));
        correlations[ticker] = correlation !== null ? parseFloat(correlation.toFixed(3)) : null;
      }
    }
    
    // Get current prices
    const currentPrices = await getCurrentPrices(tickers);
    
    // Build response
    const assets = tickers.map(ticker => ({
      ticker,
      name: CORRELATION_ASSETS[ticker],
      correlation: correlations[ticker],
      price: currentPrices[ticker]?.price || null,
      change: currentPrices[ticker]?.change || null,
      changePercent: currentPrices[ticker]?.changePercent || null,
    }));
    
    console.log(' Correlation matrix calculated');
    
    return {
      period,
      benchmark: 'SPY',
      assets,
      timestamp: new Date().toISOString(),
    };
    
  } catch (error) {
    console.error('❌ Error calculating correlation matrix:', error.message);
    throw error;
  }
}

/**
 * Get correlation for multiple periods (30, 60, 90 days)
 */
async function getMultiPeriodCorrelation() {
  try {
    console.log('📊 Calculating multi-period correlations...');
    
    const [period30, period60, period90] = await Promise.allSettled([
      getCorrelationMatrix(30),
      getCorrelationMatrix(60),
      getCorrelationMatrix(90),
    ]);
    
    return {
      period30: period30.status === 'fulfilled' ? period30.value : null,
      period60: period60.status === 'fulfilled' ? period60.value : null,
      period90: period90.status === 'fulfilled' ? period90.value : null,
    };
    
  } catch (error) {
    console.error('❌ Error calculating multi-period correlation:', error.message);
    throw error;
  }
}

module.exports = {
  getCorrelationMatrix,
  getMultiPeriodCorrelation,
  CORRELATION_ASSETS,
};