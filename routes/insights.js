const express = require('express');
const router = express.Router();
const { getCompleteDashboard, getQuickMetrics } = require('../services/insightsData');
const { getTopMovers, getAllMovers } = require('../services/topMovers');
const { getCorrelationMatrix } = require('../services/crossAssetCorrelation');
const { analyzeSectorRotation } = require('../services/sectorRotation');
const { calculateMarketBreadth } = require('../services/marketBreadth');
const { analyzeVolatility } = require('../services/volatilityAnalysis');
const { compareTickers } = require('../services/tickerComparison');

/**
 * GET /api/insights/quick-metrics
 * Quick summary metrics for dashboard header
 */
router.get('/quick-metrics', async (req, res) => {
  try {
    const metrics = await getQuickMetrics();

    res.json({
      success: true,
      data: metrics,
    });

  } catch (error) {
    console.error('❌ Quick metrics endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/insights/movers/gainers
 * Top gainers filtered by market cap
 */
router.get('/movers/gainers', async (req, res) => {
  try {
    const minMarketCap = parseInt(req.query.minMarketCap) || 500_000_000;
    const limit = parseInt(req.query.limit) || 10;
    
    const gainers = await getTopMovers('gainers', minMarketCap, limit);
    
    res.json({
      success: true,
      data: gainers,
    });
    
  } catch (error) {
    console.error('❌ Gainers endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/insights/movers/losers
 * Top losers filtered by market cap
 */
router.get('/movers/losers', async (req, res) => {
  try {
    const minMarketCap = parseInt(req.query.minMarketCap) || 500_000_000;
    const limit = parseInt(req.query.limit) || 10;
    
    const losers = await getTopMovers('losers', minMarketCap, limit);
    
    res.json({
      success: true,
      data: losers,
    });
    
  } catch (error) {
    console.error('❌ Losers endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/insights/movers/all
 * All movers (gainers + losers + pre-market)
 */
router.get('/movers/all', async (req, res) => {
  try {
    const minMarketCap = parseInt(req.query.minMarketCap) || 500_000_000;
    const limit = parseInt(req.query.limit) || 10;
    
    const movers = await getAllMovers(minMarketCap, limit);
    
    res.json({
      success: true,
      data: movers,
    });
    
  } catch (error) {
    console.error('❌ All movers endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/insights/correlation
 * Cross-asset correlation matrix
 */
router.get('/correlation', async (req, res) => {
  try {
    const period = parseInt(req.query.period) || 60;
    
    const correlation = await getCorrelationMatrix(period);
    
    res.json({
      success: true,
      data: correlation,
    });
    
  } catch (error) {
    console.error('❌ Correlation endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/insights/sectors
 * Sector rotation analysis
 */
router.get('/sectors', async (req, res) => {
  try {
    const sectors = await analyzeSectorRotation();
    
    res.json({
      success: true,
      data: sectors,
    });
    
  } catch (error) {
    console.error('❌ Sectors endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/insights/breadth
 * Market breadth indicators
 */
router.get('/breadth', async (req, res) => {
  try {
    const breadth = await calculateMarketBreadth();
    
    res.json({
      success: true,
      data: breadth,
    });
    
  } catch (error) {
    console.error('❌ Breadth endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/insights/volatility
 * Volatility analysis
 */
router.get('/volatility', async (req, res) => {
  try {
    const volatility = await analyzeVolatility();
    
    res.json({
      success: true,
      data: volatility,
    });
    
  } catch (error) {
    console.error('❌ Volatility endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/insights/compare
 * Compare multiple tickers
 */
router.get('/compare', async (req, res) => {
  try {
    const tickers = req.query.tickers?.split(',') || [];
    const period = req.query.period || '1M';
    
    if (tickers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No tickers provided',
      });
    }
    
    const comparison = await compareTickers(tickers, period);
    
    res.json({
      success: true,
      data: comparison,
    });
    
  } catch (error) {
    console.error('❌ Comparison endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/insights/dashboard
 * Complete insights dashboard (all data in one call)
 */
router.get('/dashboard', async (req, res) => {
  try {
    const minMarketCap = parseInt(req.query.minMarketCap) || 500_000_000;
    const moversLimit = parseInt(req.query.moversLimit) || 10;
    const correlationPeriod = parseInt(req.query.correlationPeriod) || 60;

    console.log(`📊 Fetching complete insights dashboard...`);
    console.log(`   Market cap filter: $${(minMarketCap / 1e6).toFixed(0)}M`);
    console.log(`   Movers limit: ${moversLimit}`);
    console.log(`   Correlation period: ${correlationPeriod}D`);

    const dashboardData = await getCompleteDashboard({
      minMarketCap,
      moversLimit,
      correlationPeriod,
    });

    res.json({
      success: true,
      data: dashboardData,
    });

  } catch (error) {
    console.error('❌ Dashboard endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;