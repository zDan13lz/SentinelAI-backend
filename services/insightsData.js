const { getAllMovers } = require('./topMovers');
const { getCorrelationMatrix } = require('./crossAssetCorrelation');
const { getSectorRotation } = require('./sectorRotation');
const { getMarketBreadth } = require('./marketBreadth');
const { getVolatilityAnalysis } = require('./volatilityAnalysis'); //  FIXED
const { compareTickers } = require('./tickerComparison');

/**
 * Get complete insights dashboard data
 */
async function getCompleteDashboard(options = {}) {
  try {
    console.log('📊 Fetching complete insights dashboard...');
    
    const {
      minMarketCap = 500_000_000,
      moversLimit = 10,
      correlationPeriod = 60,
    } = options;
    
    // Fetch all data in parallel
    const [
      movers,
      correlation,
      sectors,
      breadth,
      volatility,
    ] = await Promise.allSettled([
      getAllMovers(minMarketCap, moversLimit),
      getCorrelationMatrix(correlationPeriod),
      getSectorRotation(),
      getMarketBreadth(),
      getVolatilityAnalysis(), //  FIXED
    ]);
    
    // Extract results
    const dashboard = {
      movers: movers.status === 'fulfilled' ? movers.value : {
        gainers: [],
        losers: [],
        preMarketGainers: [],
        preMarketLosers: [],
        error: movers.reason?.message,
      },
      correlation: correlation.status === 'fulfilled' ? correlation.value : {
        error: correlation.reason?.message,
      },
      sectors: sectors.status === 'fulfilled' ? sectors.value : {
        error: sectors.reason?.message,
      },
      breadth: breadth.status === 'fulfilled' ? breadth.value : {
        error: breadth.reason?.message,
      },
      volatility: volatility.status === 'fulfilled' ? volatility.value : {
        error: volatility.reason?.message,
      },
      timestamp: new Date().toISOString(),
    };
    
    console.log(' Complete dashboard data fetched');
    
    return dashboard;
    
  } catch (error) {
    console.error('❌ Error fetching dashboard:', error.message);
    throw error;
  }
}

/**
 * Get quick metrics summary
 */
async function getQuickMetrics() {
  try {
    console.log('📊 Fetching quick metrics...');
    
    const [breadth, volatility, sectors] = await Promise.allSettled([
      getMarketBreadth(),
      getVolatilityAnalysis(), //  FIXED
      getSectorRotation(),
    ]);
    
    const breadthData = breadth.status === 'fulfilled' ? breadth.value : null;
    const volatilityData = volatility.status === 'fulfilled' ? volatility.value : null;
    const sectorsData = sectors.status === 'fulfilled' ? sectors.value : null;
    
    // Determine market regime
    let marketRegime = 'NEUTRAL';
    if (breadthData && volatilityData) {
      const bullishBreadth = breadthData.advanceDeclinePercent > 60;
      const lowVol = volatilityData.current.value < 20;
      
      if (bullishBreadth && lowVol) {
        marketRegime = 'BULL MARKET';
      } else if (!bullishBreadth && volatilityData.current.value > 25) {
        marketRegime = 'BEAR MARKET';
      } else if (volatilityData.current.value > 30) {
        marketRegime = 'HIGH VOLATILITY';
      }
    }
    
    // Find leading sector
    let leadingSector = null;
    if (sectorsData && sectorsData.sectors && sectorsData.sectors.length > 0) {
      const topSector = sectorsData.sectors[0];
      leadingSector = {
        ticker: topSector.ticker,
        name: topSector.name,
        performance: topSector.performance['20D'],
      };
    }
    
    // Get SPY info
    const spyInfo = sectorsData?.benchmark || null;
    
    console.log(' Quick metrics fetched');
    
    return {
      spy: spyInfo ? {
        price: spyInfo.price,
        change: spyInfo.performance['1D'],
      } : null,
      vix: volatilityData ? {
        value: volatilityData.current.value,
        change: volatilityData.current.change,
        regime: volatilityData.regime,
      } : null,
      breadth: breadthData ? {
        score: breadthData.advanceDeclinePercent,
        sentiment: breadthData.marketSentiment,
      } : null,
      marketRegime,
      leadingSector,
      timestamp: new Date().toISOString(),
    };
    
  } catch (error) {
    console.error('❌ Error fetching quick metrics:', error.message);
    throw error;
  }
}

module.exports = {
  getCompleteDashboard,
  getQuickMetrics,
};