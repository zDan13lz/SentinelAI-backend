const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * GET /api/flow/ticker/:ticker
 * Get last N trades for specific ticker
 */
router.get('/ticker/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const { limit = 300 } = req.query;

    if (!ticker || ticker.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ticker symbol'
      });
    }

    console.log(`📊 Fetching ${limit} trades for ${ticker}`);

    const result = await pool.query(`
      SELECT 
        timestamp,
        date,
        time,
        ticker,
        strike,
        expiration,
        dte,
        contract_type,
        contract_symbol,
        delta_flow,
        flow_direction,
        spread_position AS spread,
        price,
        size,
        premium,
        spot_price,
        bid,
        ask,
        open_interest,
        implied_volatility,
        trade_type,
        trade_subtype,
        execution_level,
        priority,
        highlight,
        exchange_name,
        has_quote,
        urgency_level,
        urgency_label,
        urgency_color,
        paid_over_ask,
        paid_below_bid,
        spread_position,
        spot_nbbo_bid,
        spot_nbbo_ask,
        has_urgency
      FROM options_trades
      WHERE ticker = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `, [ticker.toUpperCase(), parseInt(limit)]);

    res.json({
      success: true,
      ticker: ticker.toUpperCase(),
      count: result.rows.length,
      trades: result.rows
    });

  } catch (error) {
    console.error('❌ Error fetching ticker flow:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/flow/all
 * Get recent flow (last N trades with premium >= $20K)
 */
router.get('/all', async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    console.log(`📊 Fetching last ${limit} trades (≥$20K)`);

    const result = await pool.query(`
      SELECT 
        timestamp,
        date,
        time,
        ticker,
        strike,
        expiration,
        dte,
        contract_type,
        contract_symbol,
        spread_position AS spread,
        delta_flow,
        flow_direction,
        price,
        size,
        premium,
        spot_price,
        bid,
        ask,
        open_interest,
        implied_volatility,
        trade_type,
        trade_subtype,
        execution_level,
        priority,
        highlight,
        exchange_name,
        urgency_level,
        urgency_label,
        urgency_color,
        paid_over_ask,
        paid_below_bid,
        spread_position,
        spot_nbbo_bid,
        spot_nbbo_ask,
        has_urgency
      FROM options_trades
      WHERE premium >= 20000
      ORDER BY timestamp DESC
      LIMIT $1
    `, [parseInt(limit)]);

    res.json({
      success: true,
      count: result.rows.length,
      trades: result.rows
    });

  } catch (error) {
    console.error('❌ Error fetching all flow:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/flow/stats
 * Get today's flow statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    console.log(`📊 Fetching stats for ${today}`);

    const statsResult = await pool.query(`SELECT * FROM flow_stats WHERE date = $1`, [today]);

    if (statsResult.rows.length === 0) {
      return res.json({
        success: true,
        date: today,
        stats: {
          total_trades: 0,
          total_premium: 0,
          call_trades: 0,
          call_premium: 0,
          put_trades: 0,
          put_premium: 0,
          sweep_trades: 0,
          sweep_premium: 0,
          block_trades: 0,
          block_premium: 0,
          call_put_ratio: 0,
          institutional_ratio: 0
        }
      });
    }

    const stats = statsResult.rows[0];

    stats.call_put_ratio = stats.put_premium > 0 
      ? (stats.call_premium / stats.put_premium).toFixed(2)
      : 0;

    stats.institutional_ratio = stats.total_premium > 0
      ? (((stats.sweep_premium + stats.block_premium) / stats.total_premium) * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      date: today,
      stats
    });

  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// (rest of your file unchanged)
module.exports = router;
