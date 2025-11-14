const express = require('express');
const { getOptionsData, clearCache, getCacheStats } = require('../services/massiveAPI');

const router = express.Router();

// Massive.com API Key
const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY || 'xVRx6DVkp0Na4VigU7Q3weZkMCGUtN0B';

/**
 * Fetch stock metrics from Massive.com
 */
async function fetchStockMetrics(ticker) {
  try {
    console.log(`📈 Fetching stock metrics for ${ticker}...`);
    
    // Fetch snapshot (has most data)
    const snapshotUrl = `https://api.massive.com/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${MASSIVE_API_KEY}`;
    console.log(`🔗 Snapshot URL: ${snapshotUrl}`);
    
    const snapshotResponse = await fetch(snapshotUrl);
    
    if (!snapshotResponse.ok) {
      throw new Error(`Snapshot API failed: ${snapshotResponse.status} ${snapshotResponse.statusText}`);
    }
    
    const snapshotData = await snapshotResponse.json();
    console.log('📊 Snapshot data:', JSON.stringify(snapshotData, null, 2));
    
    const snapshot = snapshotData.ticker;
    
    if (!snapshot) {
      throw new Error('No ticker data in snapshot response');
    }

    // Get current price and previous close
    const currentPrice = snapshot.day?.c || snapshot.prevDay?.c || null;
    const prevClose = snapshot.prevDay?.c || null;
    
    console.log(`💰 Current: $${currentPrice} | Prev Close: $${prevClose}`);

    // Calculate change
    let priceChange = null;
    let priceChangePercent = null;
    
    if (currentPrice && prevClose) {
      priceChange = currentPrice - prevClose;
      priceChangePercent = (priceChange / prevClose) * 100;
      console.log(`📈 Change: ${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)} (${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%)`);
    }

    // Determine market status
    const now = new Date();
    const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const hour = estTime.getHours();
    const minute = estTime.getMinutes();
    const timeValue = hour * 100 + minute;
    const dayOfWeek = estTime.getDay();
    
    let marketStatus = 'CLOSED';
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      if (timeValue >= 400 && timeValue < 930) {
        marketStatus = 'PRE';
      } else if (timeValue >= 930 && timeValue < 1600) {
        marketStatus = 'OPEN';
      } else if (timeValue >= 1600 && timeValue < 2000) {
        marketStatus = 'POST';
      }
    }
    
    console.log(`⏰ Market Status: ${marketStatus} (EST: ${hour}:${minute.toString().padStart(2, '0')})`);

    const metrics = {
      priceChange,
      priceChangePercent,
      marketStatus,
      volume: snapshot.day?.v || null,
      dayLow: snapshot.day?.l || null,
      dayHigh: snapshot.day?.h || null,
      yearLow: snapshot.min?.l || null,
      yearHigh: snapshot.max?.h || null,
      marketCap: snapshot.market_cap || null,
      prevClose: prevClose
    };

    console.log(' Stock metrics fetched:', metrics);
    return metrics;

  } catch (error) {
    console.error('❌ Error fetching stock metrics:', error.message);
    return {
      priceChange: null,
      priceChangePercent: null,
      marketStatus: 'CLOSED',
      volume: null,
      dayLow: null,
      dayHigh: null,
      yearLow: null,
      yearHigh: null,
      marketCap: null,
      prevClose: null
    };
  }
}

/**
 * GET /api/options/:ticker
 * Get options data for a ticker (with caching + stock metrics)
 */
router.get('/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;

    if (!ticker || ticker.length > 10) {
      return res.status(400).json({
        error: 'Invalid ticker symbol'
      });
    }

    console.log(`\n📊 ========== REQUEST FOR ${ticker.toUpperCase()} ==========`);

    // Get options data from cache/API
    const optionsData = await getOptionsData(ticker);
    console.log(` Options data retrieved: ${optionsData.options?.length || 0} contracts`);

    // Fetch stock metrics
    const stockMetrics = await fetchStockMetrics(ticker);

    //  BUILD RESPONSE - EXPLICITLY INCLUDE ALL FIELDS
    const response = {
      success: true,
      ticker: optionsData.ticker,
      spotPrice: optionsData.spotPrice,
      timestamp: optionsData.timestamp,
      options: optionsData.options,
      totalContracts: optionsData.totalContracts,
      validContracts: optionsData.validContracts,
      expiredContracts: optionsData.expiredContracts,
      
      //  STOCK METRICS
      priceChange: stockMetrics.priceChange,
      priceChangePercent: stockMetrics.priceChangePercent,
      marketStatus: stockMetrics.marketStatus,
      volume: stockMetrics.volume,
      dayLow: stockMetrics.dayLow,
      dayHigh: stockMetrics.dayHigh,
      yearLow: stockMetrics.yearLow,
      yearHigh: stockMetrics.yearHigh,
      marketCap: stockMetrics.marketCap,
      prevClose: stockMetrics.prevClose
    };

    console.log(` Response built with metrics:`, {
      ticker: response.ticker,
      spotPrice: response.spotPrice,
      priceChange: response.priceChange,
      priceChangePercent: response.priceChangePercent,
      marketStatus: response.marketStatus,
      volume: response.volume
    });

    res.json(response);

  } catch (error) {
    console.error('❌ Error in options endpoint:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch options data'
    });
  }
});

/**
 * DELETE /api/options/cache/:ticker
 * Clear cache for specific ticker
 */
router.delete('/cache/:ticker', (req, res) => {
  const { ticker } = req.params;
  clearCache(ticker);
  
  res.json({
    success: true,
    message: `Cache cleared for ${ticker}`
  });
});

/**
 * DELETE /api/options/cache
 * Clear all cache
 */
router.delete('/cache', (req, res) => {
  clearCache();
  
  res.json({
    success: true,
    message: 'All cache cleared'
  });
});

/**
 * GET /api/options/cache/stats
 * Get cache statistics
 */
router.get('/cache/stats', (req, res) => {
  const stats = getCacheStats();
  
  res.json({
    success: true,
    ...stats
  });
});

module.exports = router;