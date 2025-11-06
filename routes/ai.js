const express = require('express');
const { analyzeMarket } = require('../services/sentinelAI');

const router = express.Router();

/**
 * POST /api/ai/analyze
 * Generate AI analysis from GEX/VEX/IV data
 */
router.post('/analyze', async (req, res) => {
  try {
    const marketData = req.body;

    // Validate required fields
    if (!marketData.ticker || !marketData.spotPrice) {
      return res.status(400).json({
        error: 'Missing required fields: ticker and spotPrice'
      });
    }

    console.log(`📊 Analyzing ${marketData.ticker} at $${marketData.spotPrice}`);

    // Generate AI analysis
    const analysis = await analyzeMarket(marketData);

    // Return result
    res.json({
      success: true,
      ticker: marketData.ticker,
      timestamp: new Date().toISOString(),
      ...analysis
    });

  } catch (error) {
    console.error('Error in AI analysis:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate analysis'
    });
  }
});

/**
 * GET /api/ai/health
 * Check if AI service is operational
 */
router.get('/health', (req, res) => {
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  
  res.json({
    status: 'ok',
    service: 'SentinelAI',
    model: 'gpt-4o-mini',
    apiKeyConfigured: hasApiKey
  });
});

module.exports = router;