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

    const result = await pool.query(
      `
      SELECT 
        id,
        timestamp,
        date,
        time,
        ticker,
        contract_symbol,
        contract_type,
        strike,
        expiration,
        dte,
        price,
        size,
        premium,
        volume,
        open_interest,
        bid,
        ask,
        underlying_price AS spot_price,
        trade_type,
        flow_direction,
        priority,
        urgency_score,
        urgency_label,
        urgency_color,
        is_aggressive,
        sweep_exchange_count,
        sweep_exchanges,
        exchange_name,
        condition_codes,
        sequence_number,
        created_at,
        exchange_id,
        urgency_level,
        is_part_of_sweep,
        sweep_id,
        is_block,
        block_reason,
        paid_over_ask,
        paid_below_bid,
        spread_position,
        spread_position AS spread,
        spot_nbbo_bid,
        spot_nbbo_ask,
        has_urgency
      FROM options_trades
      WHERE ticker = $1
      ORDER BY timestamp DESC
      LIMIT $2
      `,
      [ticker.toUpperCase(), parseInt(limit)]
    );

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

    const result = await pool.query(
      `
      SELECT 
        id,
        timestamp,
        date,
        time,
        ticker,
        contract_symbol,
        contract_type,
        strike,
        expiration,
        dte,
        price,
        size,
        premium,
        volume,
        open_interest,
        bid,
        ask,
        underlying_price AS spot_price,
        trade_type,
        flow_direction,
        priority,
        urgency_score,
        urgency_label,
        urgency_color,
        is_aggressive,
        sweep_exchange_count,
        sweep_exchanges,
        exchange_name,
        condition_codes,
        sequence_number,
        created_at,
        exchange_id,
        urgency_level,
        is_part_of_sweep,
        sweep_id,
        is_block,
        block_reason,
        paid_over_ask,
        paid_below_bid,
        spread_position,
        spread_position AS spread,
        spot_nbbo_bid,
        spot_nbbo_ask,
        has_urgency
      FROM options_trades
      WHERE premium >= 20000
      ORDER BY timestamp DESC
      LIMIT $1
      `,
      [parseInt(limit)]
    );

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

    const statsResult = await pool.query(
      `
      SELECT *
      FROM flow_stats
      WHERE date = $1
      `,
      [today]
    );

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

    stats.call_put_ratio =
      stats.put_premium > 0
        ? (stats.call_premium / stats.put_premium).toFixed(2)
        : 0;

    stats.institutional_ratio =
      stats.total_premium > 0
        ? (
            ((stats.sweep_premium + stats.block_premium) /
              stats.total_premium) *
            100
          ).toFixed(1)
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

/**
 * GET /api/flow/stats/ticker/:ticker
 * Get today's stats for specific ticker
 */
router.get('/stats/ticker/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const today = new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `
      SELECT 
        COUNT(*) as total_trades,
        SUM(premium) as total_premium,
        SUM(CASE WHEN contract_type = 'CALL' THEN 1 ELSE 0 END) as call_trades,
        SUM(CASE WHEN contract_type = 'CALL' THEN premium ELSE 0 END) as call_premium,
        SUM(CASE WHEN contract_type = 'PUT' THEN 1 ELSE 0 END) as put_trades,
        SUM(CASE WHEN contract_type = 'PUT' THEN premium ELSE 0 END) as put_premium,
        SUM(CASE WHEN trade_type = 'SWEEP' THEN 1 ELSE 0 END) as sweep_trades,
        SUM(CASE WHEN trade_type = 'SWEEP' THEN premium ELSE 0 END) as sweep_premium,
        SUM(CASE WHEN trade_type = 'BLOCK' THEN 1 ELSE 0 END) as block_trades,
        SUM(CASE WHEN trade_type = 'BLOCK' THEN premium ELSE 0 END) as block_premium
      FROM options_trades
      WHERE ticker = $1 AND date = $2
      `,
      [ticker.toUpperCase(), today]
    );

    const stats = result.rows[0];

    res.json({
      success: true,
      ticker: ticker.toUpperCase(),
      date: today,
      stats: {
        total_trades: parseInt(stats.total_trades) || 0,
        total_premium: parseFloat(stats.total_premium) || 0,
        call_trades: parseInt(stats.call_trades) || 0,
        call_premium: parseFloat(stats.call_premium) || 0,
        put_trades: parseInt(stats.put_trades) || 0,
        put_premium: parseFloat(stats.put_premium) || 0,
        sweep_trades: parseInt(stats.sweep_trades) || 0,
        sweep_premium: parseFloat(stats.sweep_premium) || 0,
        block_trades: parseInt(stats.block_trades) || 0,
        block_premium: parseFloat(stats.block_premium) || 0
      }
    });
  } catch (error) {
    console.error('❌ Error fetching ticker stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/flow/search/:ticker
 * User search notification (for dynamic quote subscription)
 */
router.post('/search/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;

    console.log(`🔍 User searching for: ${ticker}`);

    res.json({
      success: true,
      ticker: ticker.toUpperCase(),
      message: `Search registered for ${ticker}`
    });
  } catch (error) {
    console.error('❌ Error handling search:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/flow/health
 * Get system health status
 */
router.get('/health', (req, res) => {
  try {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching health:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      error: error.message
    });
  }
});

/**
 * GET /api/flow/stats/db/:ticker
 * Get aggregate stats from database for a ticker (works when market closed)
 */
router.get('/stats/db/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const today = new Date().toISOString().split('T')[0];

    console.log(`📊 Fetching database stats for ${ticker.toUpperCase()}`);

    const statsQuery = `
      SELECT 
        COUNT(*) as total_trades,
        COALESCE(SUM(premium), 0) as total_premium,
        COALESCE(SUM(CASE WHEN contract_type = 'CALL' THEN premium ELSE 0 END), 0) as call_premium,
        COALESCE(SUM(CASE WHEN contract_type = 'PUT' THEN premium ELSE 0 END), 0) as put_premium,
        COUNT(CASE WHEN contract_type = 'CALL' THEN 1 END) as call_trades,
        COUNT(CASE WHEN contract_type = 'PUT' THEN 1 END) as put_trades,
        COUNT(CASE WHEN trade_type = 'SWEEP' THEN 1 END) as sweeps,
        COUNT(CASE WHEN trade_type = 'BLOCK' THEN 1 END) as blocks
      FROM options_trades
      WHERE ticker = $1
        AND date = $2
    `;

    const result = await pool.query(statsQuery, [
      ticker.toUpperCase(),
      today
    ]);
    const stats = result.rows[0];

    const callPutRatio =
      stats.put_premium > 0
        ? (stats.call_premium / stats.put_premium).toFixed(2)
        : 'N/A';

    res.json({
      success: true,
      ticker: ticker.toUpperCase(),
      date: today,
      stats: {
        totalPremium: parseFloat(stats.total_premium),
        totalTrades: parseInt(stats.total_trades),
        calls: {
          premium: parseFloat(stats.call_premium),
          trades: parseInt(stats.call_trades),
          percentage:
            stats.total_premium > 0
              ? ((stats.call_premium / stats.total_premium) * 100).toFixed(1)
              : '0'
        },
        puts: {
          premium: parseFloat(stats.put_premium),
          trades: parseInt(stats.put_trades),
          percentage:
            stats.total_premium > 0
              ? ((stats.put_premium / stats.total_premium) * 100).toFixed(1)
              : '0'
        },
        callPutRatio,
        sweeps: parseInt(stats.sweeps),
        blocks: parseInt(stats.blocks)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching database flow stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch flow statistics'
    });
  }
});

/**
 * POST /api/flow/reset
 * Clears old trades (called by cron job at 3 AM ET)
 */
router.post('/reset', async (req, res) => {
  try {
    console.log('🔄 Resetting flow data - deleting old trades...');

    const deleteQuery = `
      DELETE FROM options_trades
      WHERE date < CURRENT_DATE
    `;

    const result = await pool.query(deleteQuery);

    console.log(`✅ Reset complete - deleted ${result.rowCount} old trades`);

    res.json({
      success: true,
      message: 'Old trades cleared',
      deletedCount: result.rowCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error resetting trades:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset trades'
    });
  }
});

/**
 * GET /api/flow/strike/:ticker/:strike/:contractType
 * Get all trades for a specific strike today
 */
router.get('/strike/:ticker/:strike/:contractType', async (req, res) => {
  try {
    const { ticker, strike, contractType } = req.params;
    const today = new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `
      SELECT *
      FROM options_trades
      WHERE ticker = $1
        AND strike = $2
        AND contract_type = $3
        AND date = $4
      ORDER BY timestamp DESC
      LIMIT 100
      `,
      [ticker.toUpperCase(), parseFloat(strike), contractType, today]
    );

    res.json({
      success: true,
      ticker: ticker.toUpperCase(),
      strike: parseFloat(strike),
      contractType,
      count: result.rows.length,
      trades: result.rows
    });
  } catch (error) {
    console.error('❌ Error fetching strike trades:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
