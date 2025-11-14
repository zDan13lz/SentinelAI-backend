const axios = require('axios');
require('dotenv').config();

const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;
const BASE_URL = 'https://api.massive.com';

/**
 * Fetch ETF-based volatility proxies (works with Advanced Stocks plan)
 */
async function fetchVolatilityETFs() {
  try {
    const url = `${BASE_URL}/v3/snapshot`;
    const tickers = 'VIXY,VXX,UVXY,SVIX';
    
    const response = await axios.get(url, {
      params: { 
        'ticker.any_of': tickers, 
        apiKey: MASSIVE_API_KEY 
      }
    });

    if (!response.data.results || response.data.results.length === 0) {
      return null;
    }

    const map = {};
    for (const t of response.data.results) {
      const price = t.session?.price || t.last_trade?.p || t.day?.c || 0;
      const change = t.session?.change || t.todaysChange || 0;
      const changePercent = t.session?.change_percent || t.todaysChangePerc || 0;
      
      map[t.ticker] = {
        price,
        change,
        changePercent,
      };
    }

    console.log(' Fetched volatility ETFs:', Object.keys(map));

    return {
      VIXY: map['VIXY'] || null,
      VXX: map['VXX'] || null,
      UVXY: map['UVXY'] || null,
      SVIX: map['SVIX'] || null,
    };
    
  } catch (error) {
    console.error('❌ Error fetching volatility ETFs:', error.message);
    return null;
  }
}

/**
 * Fetch SPY Implied Volatility (from options)
 */
async function fetchSPYImpliedVolatility() {
  try {
    const url = `${BASE_URL}/v3/snapshot/options/SPY`;
    
    const response = await axios.get(url, {
      params: { 
        apiKey: MASSIVE_API_KEY,
        limit: 50,
      }
    });

    if (!response.data.results || response.data.results.length === 0) {
      return null;
    }

    const ivValues = response.data.results
      .filter(opt => opt.implied_volatility && opt.implied_volatility > 0)
      .map(opt => opt.implied_volatility);

    if (ivValues.length === 0) return null;

    const avgIV = ivValues.reduce((a, b) => a + b, 0) / ivValues.length;
    
    console.log(' SPY Implied Volatility:', (avgIV * 100).toFixed(2) + '%');
    
    return avgIV;
    
  } catch (error) {
    console.error('❌ Error fetching SPY IV:', error.message);
    return null;
  }
}

/**
 * Fetch historical VIX proxy data
 */
async function fetchVIXProxyData(days = 90) {
  try {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(toDate.getDate() - days);
    
    const from = fromDate.toISOString().split('T')[0];
    const to = toDate.toISOString().split('T')[0];
    
    const url = `${BASE_URL}/v2/aggs/ticker/VIXY/range/1/day/${from}/${to}`;
    
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
    
    return response.data.results.map(bar => ({
      time: bar.t,
      value: bar.c,
      high: bar.h,
      low: bar.l,
    }));
    
  } catch (error) {
    console.error('❌ Error fetching VIX proxy data:', error.message);
    return null;
  }
}

/**
 * Calculate percentile
 */
function calculatePercentile(historicalData, currentValue) {
  if (!historicalData || historicalData.length === 0) return null;
  
  const values = historicalData.map(d => d.value).sort((a, b) => a - b);
  const below = values.filter(v => v < currentValue).length;
  
  return (below / values.length) * 100;
}

/**
 * Compute VIX proxy from ETFs
 */
function computeSyntheticVIX(volETFs) {
  if (!volETFs) return null;
  
  // Use VIXY directly - it's the best proxy
  if (volETFs.VIXY && volETFs.VIXY.price > 0) {
    return volETFs.VIXY.price;
  }
  
  // Fallback to VXX
  if (volETFs.VXX && volETFs.VXX.price > 0) {
    return volETFs.VXX.price;
  }
  
  // Fallback to UVXY
  if (volETFs.UVXY && volETFs.UVXY.price > 0) {
    return volETFs.UVXY.price;
  }
  
  return null;
}

/**
 * Get complete volatility analysis
 */
async function getVolatilityAnalysis() {
  try {
    console.log('📊 Analyzing volatility metrics...');
    
    const [volETFs, spyIV, historicalData] = await Promise.all([
      fetchVolatilityETFs(),
      fetchSPYImpliedVolatility(),
      fetchVIXProxyData(90),
    ]);
    
    if (!volETFs) {
      throw new Error('Unable to fetch volatility ETF data');
    }
    
    const vixProxy = computeSyntheticVIX(volETFs);
    
    if (!vixProxy) {
      throw new Error('Unable to compute VIX proxy');
    }
    
    const percentile = historicalData ? 
      calculatePercentile(historicalData, volETFs.VIXY?.price || 0) : null;
    
    // Determine regime (VIXY ranges 10-50 typically)
    let regime = 'NORMAL';
    if (vixProxy < 20) regime = 'LOW';
    else if (vixProxy >= 20 && vixProxy < 30) regime = 'FAIR';
    else if (vixProxy >= 30 && vixProxy < 40) regime = 'ELEVATED';
    else if (vixProxy >= 40) regime = 'HIGH';
    
    // Fear level
    let fearLevel = 'NEUTRAL';
    if (vixProxy < 18) fearLevel = 'COMPLACENT';
    else if (vixProxy < 25) fearLevel = 'LOW';
    else if (vixProxy < 35) fearLevel = 'ELEVATED';
    else fearLevel = 'PANIC';
    
    //  FIX: Fear score calculation (0-100 scale)
    // Components:
    // 1. VIXY level (0-60 points): normalized 0-50 range
    // 2. SPY IV (0-30 points): normalized 0-1 range
    // 3. SVIX inverse (0-10 points): normalized inverse
    
    const vixComponent = Math.min(60, (vixProxy / 50) * 60); // Max 60 points
    const ivComponent = spyIV ? Math.min(30, (spyIV * 100)) : 0; // Max 30 points
    const svixComponent = volETFs.SVIX && volETFs.SVIX.price > 0 ? 
      Math.min(10, (1 / volETFs.SVIX.price) * 50) : 0; // Max 10 points
    
    const fearScore = Math.min(100, vixComponent + ivComponent + svixComponent);
    
    const vixChange = volETFs.VIXY?.change || 0;
    const vixChangePercent = volETFs.VIXY?.changePercent || 0;
    
    console.log(' Volatility analysis complete');
    console.log(`   VIXY: ${vixProxy.toFixed(2)}`);
    console.log(`   Regime: ${regime}`);
    console.log(`   Fear Level: ${fearLevel}`);
    console.log(`   Fear Score: ${fearScore.toFixed(1)} (VIX: ${vixComponent.toFixed(1)}, IV: ${ivComponent.toFixed(1)}, SVIX: ${svixComponent.toFixed(1)})`);
    
    return {
      current: {
        ticker: 'VIXY (VIX Proxy)',
        value: parseFloat(vixProxy.toFixed(2)),
        rawValue: volETFs.VIXY?.price || 0,
        change: parseFloat(vixChange.toFixed(2)),
        changePercent: parseFloat(vixChangePercent.toFixed(2)),
      },
      percentile: percentile ? parseFloat(percentile.toFixed(1)) : null,
      regime,
      fearLevel,
      fearScore: parseFloat(fearScore.toFixed(1)),
      spyImpliedVol: spyIV ? parseFloat((spyIV * 100).toFixed(2)) : null,
      etfProxies: {
        VIXY: volETFs.VIXY?.price || null,
        VXX: volETFs.VXX?.price || null,
        UVXY: volETFs.UVXY?.price || null,
        SVIX: volETFs.SVIX?.price || null,
      },
      historical: historicalData ? historicalData.slice(-30) : [],
      timestamp: new Date().toISOString(),
    };
    
  } catch (error) {
    console.error('❌ Error in volatility analysis:', error.message);
    throw error;
  }
}

module.exports = {
  getVolatilityAnalysis,
  fetchVIXProxyData,
};