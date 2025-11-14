const axios = require('axios');
require('dotenv').config();

const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;
const BASE_URL = 'https://api.massive.com';

/**
 * Fetch comprehensive ticker data
 */
async function fetchTickerData(ticker, period = '1M') {
  try {
    const toDate = new Date();
    const fromDate = new Date();
    
    // Determine lookback period
    const days = {
      '1W': 7,
      '1M': 30,
      '3M': 90,
      '6M': 180,
      '1Y': 365
    }[period] || 30;
    
    fromDate.setDate(toDate.getDate() - days - 10); // Extra buffer
    
    const from = fromDate.toISOString().split('T')[0];
    const to = toDate.toISOString().split('T')[0];
    
    // Get historical bars
    const barsUrl = `${BASE_URL}/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}`;
    const barsResponse = await axios.get(barsUrl, {
      params: {
        adjusted: true,
        sort: 'asc',
        limit: 5000,
        apiKey: MASSIVE_API_KEY,
      }
    });
    
    if (!barsResponse.data.results || barsResponse.data.results.length === 0) {
      throw new Error(`No data for ${ticker}`);
    }
    
    const bars = barsResponse.data.results;
    
    // Get current snapshot
    const snapshotUrl = `${BASE_URL}/v3/snapshot`;
    const snapshotResponse = await axios.get(snapshotUrl, {
      params: {
        'ticker.any_of': ticker,
        apiKey: MASSIVE_API_KEY,
      }
    });
    
    const snapshot = snapshotResponse.data.results?.[0];
    
    return { bars, snapshot };
    
  } catch (error) {
    console.error(`❌ Error fetching data for ${ticker}:`, error.message);
    throw error;
  }
}

/**
 * Calculate technical indicators
 */
function calculateIndicators(bars) {
  if (!bars || bars.length < 20) {
    console.warn('⚠️  Not enough bars for indicators');
    return {
      sma20: 0,
      sma50: 0,
      rsi: 50,
      avgVolume: 0,
      volumeRatio: 1,
      trendStrength: 0,
      momentum: 0,
    };
  }
  
  const closes = bars.map(b => b.c);
  const volumes = bars.map(b => b.v);
  
  // Simple Moving Averages
  const sma20 = closes.length >= 20 
    ? closes.slice(-20).reduce((a, b) => a + b, 0) / 20 
    : closes[closes.length - 1];
    
  const sma50 = closes.length >= 50 
    ? closes.slice(-50).reduce((a, b) => a + b, 0) / 50 
    : sma20;
  
  // RSI (14-period)
  const rsi = closes.length >= 15 ? calculateRSI(closes, 14) : 50;
  
  // Average Volume
  const volLen = Math.min(20, volumes.length);
  const avgVolume = volumes.slice(-volLen).reduce((a, b) => a + b, 0) / volLen;
  const currentVolume = volumes[volumes.length - 1];
  const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
  
  // Trend strength (% above/below SMA50)
  const currentPrice = closes[closes.length - 1];
  const trendStrength = sma50 > 0 ? ((currentPrice - sma50) / sma50) * 100 : 0;
  
  // Momentum (10-day rate of change)
  const momPeriod = Math.min(10, closes.length - 1);
  const momentum = momPeriod > 0 
    ? ((closes[closes.length - 1] - closes[closes.length - 1 - momPeriod]) / closes[closes.length - 1 - momPeriod]) * 100
    : 0;
  
  console.log(`   Indicators: RSI=${rsi.toFixed(0)}, Trend=${trendStrength.toFixed(1)}%, Mom=${momentum.toFixed(1)}%`);
  
  return {
    sma20: parseFloat(sma20.toFixed(2)),
    sma50: parseFloat(sma50.toFixed(2)),
    rsi: parseFloat(rsi.toFixed(2)),
    avgVolume: Math.round(avgVolume),
    volumeRatio: parseFloat(volumeRatio.toFixed(2)),
    trendStrength: parseFloat(trendStrength.toFixed(2)),
    momentum: parseFloat(momentum.toFixed(2)),
  };
}

/**
 * Calculate RSI
 */
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  return rsi;
}

/**
 * Determine market regime
 */
function determineRegime(indicators) {
  if (!indicators) {
    return { regime: 'UNKNOWN', color: '#64748b', emoji: '❓' };
  }
  
  const { rsi, trendStrength, momentum } = indicators;
  
  console.log(`   Regime Analysis: RSI=${rsi}, Trend=${trendStrength}%, Mom=${momentum}%`);
  
  // Strong Bullish: RSI > 60, positive trend > 2%, positive momentum
  if (rsi > 60 && trendStrength > 2 && momentum > 0) {
    return { regime: 'STRONG BULLISH', color: '#22c55e', emoji: '🚀' };
  }
  
  // Bullish: RSI > 50, positive trend
  if (rsi > 50 && trendStrength > 0) {
    return { regime: 'BULLISH', color: '#10b981', emoji: '📈' };
  }
  
  // Strong Bearish: RSI < 40, negative trend < -2%, negative momentum
  if (rsi < 40 && trendStrength < -2 && momentum < 0) {
    return { regime: 'STRONG BEARISH', color: '#ef4444', emoji: '📉' };
  }
  
  // Bearish: RSI < 50, negative trend
  if (rsi < 50 && trendStrength < 0) {
    return { regime: 'BEARISH', color: '#f87171', emoji: '🔻' };
  }
  
  // Neutral
  return { regime: 'NEUTRAL', color: '#94a3b8', emoji: '➖' };
}

/**
 * Compare multiple tickers with full analysis
 */
async function compareTickers(tickers = ['SPY', 'QQQ', 'IWM'], period = '1M') {
  try {
    console.log(`📊 Comparing ${tickers.join(', ')} over ${period}...`);
    
    if (tickers.length === 0) {
      tickers = ['SPY', 'QQQ', 'IWM'];
    }
    
    // Fetch data for all tickers
    const dataPromises = tickers.map(ticker => fetchTickerData(ticker, period));
    const results = await Promise.all(dataPromises);
    
    // Process each ticker
    const comparison = [];
    
    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i];
      const { bars, snapshot } = results[i];
      
      if (!bars || bars.length === 0) {
        console.warn(`⚠️  No data for ${ticker}`);
        continue;
      }
      
      const firstBar = bars[0];
      const lastBar = bars[bars.length - 1];
      
      // Calculate performance
      const performance = ((lastBar.c - firstBar.c) / firstBar.c) * 100;
      
      // Calculate indicators
      const indicators = calculateIndicators(bars);
      
      // Determine regime
      const regimeInfo = indicators ? determineRegime(indicators) : 
        { regime: 'UNKNOWN', color: '#64748b', emoji: '❓' };
      
      // Current metrics from snapshot
      const currentPrice = snapshot?.session?.price || lastBar.c;
      const change = snapshot?.session?.change || (lastBar.c - bars[bars.length - 2]?.c || 0);
      const changePercent = snapshot?.session?.change_percent || 
        ((lastBar.c - bars[bars.length - 2]?.c) / bars[bars.length - 2]?.c * 100);
      
      comparison.push({
        ticker,
        currentPrice: parseFloat(currentPrice.toFixed(2)),
        change: parseFloat(change.toFixed(2)),
        changePercent: parseFloat(changePercent.toFixed(2)),
        performance: parseFloat(performance.toFixed(2)),
        volume: snapshot?.session?.volume || lastBar.v,
        ...indicators,
        ...regimeInfo,
        historicalData: bars.slice(-30).map(bar => ({
          time: bar.t,
          close: bar.c,
          volume: bar.v,
        })),
      });
    }
    
    if (comparison.length === 0) {
      throw new Error('No valid comparison data');
    }
    
    // Determine leader/laggard
    const sorted = [...comparison].sort((a, b) => b.performance - a.performance);
    comparison.forEach((item, idx) => {
      const rank = sorted.findIndex(s => s.ticker === item.ticker) + 1;
      item.rank = rank;
      item.isLeader = rank === 1;
      item.isLaggard = rank === sorted.length;
    });
    
    console.log(' Comparison complete');
    console.log(`   Leader: ${sorted[0].ticker} (+${sorted[0].performance.toFixed(2)}%)`);
    console.log(`   Laggard: ${sorted[sorted.length - 1].ticker} (+${sorted[sorted.length - 1].performance.toFixed(2)}%)`);
    
    return {
      period,
      tickers: comparison,
      leader: sorted[0].ticker,
      laggard: sorted[sorted.length - 1].ticker,
      divergence: parseFloat((sorted[0].performance - sorted[sorted.length - 1].performance).toFixed(2)),
      timestamp: new Date().toISOString(),
    };
    
  } catch (error) {
    console.error('❌ Error comparing tickers:', error.message);
    throw error;
  }
}

module.exports = {
  compareTickers,
};