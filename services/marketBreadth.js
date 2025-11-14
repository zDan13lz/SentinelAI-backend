const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;
const BASE_URL = 'https://api.massive.com';

// Component files
const SP500_FILE = path.join(__dirname, '../data/sp500Components.json');
const NASDAQ_FILE = path.join(__dirname, '../data/nasdaqComponents.json');

/**
 * Load S&P 500 components
 */
function loadSP500Components() {
  try {
    if (fs.existsSync(SP500_FILE)) {
      const data = fs.readFileSync(SP500_FILE, 'utf8');
      const components = JSON.parse(data);
      console.log(` Loaded ${components.length} S&P 500 components from file`);
      const tickers = components.map(c => c.ticker).filter(t => t && t.trim());
      return tickers;
    } else {
      console.warn('⚠️  S&P 500 components file not found');
      return [];
    }
  } catch (error) {
    console.error('❌ Error loading S&P 500 components:', error.message);
    return [];
  }
}

/**
 * Load NASDAQ components (top ~300 most liquid)
 */
function loadNASDAQComponents() {
  try {
    if (fs.existsSync(NASDAQ_FILE)) {
      const data = fs.readFileSync(NASDAQ_FILE, 'utf8');
      const components = JSON.parse(data);
      console.log(` Loaded ${components.length} NASDAQ components from file`);
      const tickers = components.map(c => c.ticker).filter(t => t && t.trim());
      return tickers;
    } else {
      console.warn('⚠️  NASDAQ components file not found, using fallback');
      return getNASDAQFallback();
    }
  } catch (error) {
    console.error('❌ Error loading NASDAQ components:', error.message);
    return getNASDAQFallback();
  }
}

/**
 * Get NASDAQ fallback list (top ~100 liquid tech stocks)
 */
function getNASDAQFallback() {
  return [
    'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'GOOG', 'AMZN', 'META', 'TSLA', 'AVGO',
    'COST', 'NFLX', 'AMD', 'ADBE', 'CSCO', 'PEP', 'TMUS', 'INTC', 'CMCSA',
    'QCOM', 'INTU', 'TXN', 'HON', 'AMGN', 'AMAT', 'SBUX', 'ISRG', 'BKNG',
    'ADP', 'GILD', 'REGN', 'ADI', 'VRTX', 'PANW', 'MU', 'LRCX', 'MDLZ',
    'KLAC', 'SNPS', 'CDNS', 'CRWD', 'MELI', 'ORLY', 'MAR', 'CSX', 'ABNB',
    'FTNT', 'NXPI', 'WDAY', 'AZN', 'CTAS', 'ADSK', 'DXCM', 'PCAR', 'MNST',
    'MRVL', 'MCHP', 'DASH', 'ROP', 'PAYX', 'AEP', 'ROST', 'ODFL', 'CPRT',
    'TEAM', 'IDXX', 'FAST', 'EA', 'VRSK', 'CTSH', 'KDP', 'CSGP', 'GEHC',
    'BKR', 'DDOG', 'ANSS', 'ZS', 'XEL', 'BIIB', 'CCEP', 'TTWO', 'ON',
    'CDW', 'FANG', 'WBD', 'GFS', 'MDB', 'ILMN', 'MRNA', 'ZM', 'EBAY',
  ];
}

/**
 * Fetch snapshot data for multiple tickers (batched)
 */
async function fetchTickersSnapshot(tickers) {
  try {
    const BATCH_SIZE = 250;
    const batches = [];
    
    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
      batches.push(tickers.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`📊 Fetching snapshot for ${tickers.length} tickers in ${batches.length} batches...`);
    
    const allResults = [];
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const tickerList = batch.join(',');
      const url = `${BASE_URL}/v3/snapshot`;
      
      const response = await axios.get(url, {
        params: {
          'ticker.any_of': tickerList,
          apiKey: MASSIVE_API_KEY,
        }
      });
      
      if (response.data.results) {
        allResults.push(...response.data.results);
      }
      
      // Delay between batches
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    return allResults;
    
  } catch (error) {
    console.error('❌ Error fetching tickers snapshot:', error.message);
    return [];
  }
}

/**
 * Calculate breadth metrics for a set of snapshots
 */
function calculateBreadthMetrics(snapshots, indexName) {
  let advancing = 0;
  let declining = 0;
  let unchanged = 0;
  let validStocks = 0;
  
  for (const snapshot of snapshots) {
    const todayClose = snapshot.day?.c || 
                      snapshot.session?.close || 
                      snapshot.session?.price || 
                      snapshot.last_trade?.p || 
                      0;
    
    const prevClose = snapshot.prevDay?.c || 
                     snapshot.prev_day?.c || 
                     snapshot.session?.previous_close ||
                     0;
    
    if (todayClose === 0 || prevClose === 0) continue;
    
    validStocks++;
    const change = todayClose - prevClose;
    const changePercent = (change / prevClose) * 100;
    
    if (Math.abs(changePercent) < 0.01) {
      unchanged++;
    } else if (change > 0) {
      advancing++;
    } else {
      declining++;
    }
  }
  
  const advanceDeclineRatio = declining > 0 ? advancing / declining : advancing;
  const advanceDeclinePercent = validStocks > 0 ? (advancing / validStocks) * 100 : 0;
  
  const marketSentiment = advanceDeclinePercent > 60 ? 'BULLISH' : 
                         advanceDeclinePercent < 40 ? 'BEARISH' : 'NEUTRAL';
  
  console.log(`   ${indexName}: ${validStocks} valid (${advancing} adv, ${declining} dec, ${unchanged} unch)`);
  console.log(`   ${indexName} A/D: ${advanceDeclinePercent.toFixed(1)}% (${marketSentiment})`);
  
  return {
    totalStocks: validStocks,
    advancing,
    declining,
    unchanged,
    advanceDeclineRatio: parseFloat(advanceDeclineRatio.toFixed(2)),
    advanceDeclinePercent: parseFloat(advanceDeclinePercent.toFixed(2)),
    marketSentiment,
  };
}

/**
 * Calculate SMA for a ticker
 */
async function calculateSMA(ticker, period) {
  try {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(toDate.getDate() - (period + 20));
    
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
    
    if (!response.data.results || response.data.results.length < period) {
      return null;
    }
    
    const bars = response.data.results;
    const recentBars = bars.slice(-period);
    const sum = recentBars.reduce((acc, bar) => acc + bar.c, 0);
    
    return sum / period;
    
  } catch (error) {
    return null;
  }
}

/**
 * Get market breadth indicators (COMBINED S&P 500 + NASDAQ)
 */
async function getMarketBreadth() {
  try {
    console.log('📊 Calculating market breadth indicators (S&P 500 + NASDAQ)...');
    
    const sp500Tickers = loadSP500Components();
    const nasdaqTickers = loadNASDAQComponents();
    
    if (sp500Tickers.length === 0 && nasdaqTickers.length === 0) {
      throw new Error('No components available');
    }
    
    // Fetch both S&P 500 and NASDAQ snapshots
    const [sp500Snapshots, nasdaqSnapshots] = await Promise.all([
      sp500Tickers.length > 0 ? fetchTickersSnapshot(sp500Tickers) : Promise.resolve([]),
      nasdaqTickers.length > 0 ? fetchTickersSnapshot(nasdaqTickers) : Promise.resolve([]),
    ]);
    
    console.log(` Retrieved ${sp500Snapshots.length} S&P 500 + ${nasdaqSnapshots.length} NASDAQ snapshots`);
    
    // Calculate breadth for each index
    const sp500Breadth = sp500Snapshots.length > 0 ? 
      calculateBreadthMetrics(sp500Snapshots, 'S&P 500') : null;
    
    const nasdaqBreadth = nasdaqSnapshots.length > 0 ? 
      calculateBreadthMetrics(nasdaqSnapshots, 'NASDAQ') : null;
    
    // Combined breadth (all stocks)
    const allSnapshots = [...sp500Snapshots, ...nasdaqSnapshots];
    const combinedBreadth = calculateBreadthMetrics(allSnapshots, 'COMBINED');
    
    // Calculate SMA breadth (sample from S&P 500)
    console.log('📊 Calculating SMA breadth (sampling 50 S&P 500 stocks)...');
    
    const sampleSize = Math.min(50, sp500Tickers.length);
    const sampleTickers = sp500Tickers.slice(0, sampleSize);
    
    const prices = new Map();
    for (const snapshot of sp500Snapshots) {
      const price = snapshot.day?.c || snapshot.session?.price || 0;
      if (price > 0) prices.set(snapshot.ticker, price);
    }
    
    let above50SMA = 0;
    let above200SMA = 0;
    let validSample = 0;
    
    for (const ticker of sampleTickers) {
      const currentPrice = prices.get(ticker);
      if (!currentPrice) continue;
      
      const sma50 = await calculateSMA(ticker, 50);
      const sma200 = await calculateSMA(ticker, 200);
      
      if (sma50 !== null) {
        validSample++;
        if (currentPrice > sma50) above50SMA++;
      }
      
      if (sma200 !== null && currentPrice > sma200) {
        above200SMA++;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const percentAbove50SMA = validSample > 0 ? (above50SMA / validSample) * 100 : null;
    const percentAbove200SMA = validSample > 0 ? (above200SMA / validSample) * 100 : null;
    
    console.log(' Market breadth calculated');
    console.log(`   Combined A/D: ${combinedBreadth.advanceDeclinePercent.toFixed(1)}%`);
    
    return {
      // Combined metrics (for main display)
      ...combinedBreadth,
      percentAbove50SMA: percentAbove50SMA ? parseFloat(percentAbove50SMA.toFixed(2)) : null,
      percentAbove200SMA: percentAbove200SMA ? parseFloat(percentAbove200SMA.toFixed(2)) : null,
      newHighs: 0,
      newLows: 0,
      
      // Individual index breakdowns
      sp500: sp500Breadth,
      nasdaq: nasdaqBreadth,
      
      timestamp: new Date().toISOString(),
    };
    
  } catch (error) {
    console.error('❌ Error calculating market breadth:', error.message);
    throw error;
  }
}

module.exports = {
  getMarketBreadth,
  loadSP500Components,
  loadNASDAQComponents,
};