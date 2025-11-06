const express = require('express');
const { getOptionsData, clearCache, getCacheStats } = require('../services/massiveAPI');

const router = express.Router();

/**
 * GET /api/options/:ticker
 * Get options data for a ticker (with caching)
 */
router.get('/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;

    if (!ticker || ticker.length > 10) {
      return res.status(400).json({
        error: 'Invalid ticker symbol'
      });
    }

    console.log(`📊 Request for ${ticker} options data`);

    const data = await getOptionsData(ticker);

    res.json({
      success: true,
      ...data
    });

  } catch (error) {
    console.error('Error in options endpoint:', error);
    
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