const { Pool } = require('pg');
const { classifyTrade } = require('./utils/tradeClassifier');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:iGoMango10!@localhost:5432/sentinelai'
});

async function insertTestTrades() {
  console.log('🧪 Inserting test trades with PROPER classification...\n');

  const testTrades = [
    // PRIORITY 1: SWEEP + ABOVE ASK
    {
      ticker: 'AMD',
      strike: 155,
      spot_price: 152.60,
      expiration: '2025-11-29',
      dte: 23,
      contract_type: 'CALL',
      price: 5.60,
      size: 120,
      bid: 5.40,
      ask: 5.50,
      conditions: [233] // Sweep indicator
    },
    
    // PRIORITY 1: BLOCK + ABOVE ASK
    {
      ticker: 'NVDA',
      strike: 145,
      spot_price: 147.80,
      expiration: '2025-11-22',
      dte: 16,
      contract_type: 'CALL',
      price: 12.80,
      size: 75,
      bid: 12.50,
      ask: 12.70,
      conditions: []
    },
    
    // PRIORITY 1: SWEEP + ABOVE ASK
    {
      ticker: 'TSLA',
      strike: 350,
      spot_price: 345.20,
      expiration: '2025-12-19',
      dte: 408,
      contract_type: 'CALL',
      price: 15.50,
      size: 50,
      bid: 15.20,
      ask: 15.40,
      conditions: [233]
    },
    
    // PRIORITY 2: BLOCK + AT ASK
    {
      ticker: 'SPY',
      strike: 580,
      spot_price: 578.50,
      expiration: '2025-11-15',
      dte: 9,
      contract_type: 'PUT',
      price: 8.25,
      size: 100,
      bid: 8.10,
      ask: 8.25,
      conditions: []
    },
    
    // PRIORITY 2: SWEEP + AT ASK
    {
      ticker: 'TSLA',
      strike: 340,
      spot_price: 345.20,
      expiration: '2025-11-15',
      dte: 9,
      contract_type: 'PUT',
      price: 18.50,
      size: 40,
      bid: 18.30,
      ask: 18.50,
      conditions: [233]
    },
    
    // PRIORITY 3: BLOCK + AT BID
    {
      ticker: 'AAPL',
      strike: 225,
      spot_price: 228.40,
      expiration: '2025-12-20',
      dte: 44,
      contract_type: 'CALL',
      price: 6.40,
      size: 200,
      bid: 6.40,
      ask: 6.55,
      conditions: []
    },
    
    // PRIORITY 3: FLOW + AT ASK
    {
      ticker: 'GOOGL',
      strike: 170,
      spot_price: 169.50,
      expiration: '2025-12-19',
      dte: 43,
      contract_type: 'CALL',
      price: 8.90,
      size: 80,
      bid: 8.80,
      ask: 9.00,
      conditions: []
    },
    
    // PRIORITY 4: SWEEP + BELOW BID
    {
      ticker: 'META',
      strike: 580,
      spot_price: 582.30,
      expiration: '2025-11-08',
      dte: 2,
      contract_type: 'PUT',
      price: 4.20,
      size: 150,
      bid: 4.30,
      ask: 4.45,
      conditions: [233]
    }
  ];

  try {
    for (const trade of testTrades) {
      // Calculate premium
      const premium = trade.price * trade.size * 100;
      
      // Calculate spread
      const spread = trade.ask - trade.bid;
      
      // Classify the trade
      const classification = classifyTrade({
        ...trade,
        premium
      });
      
      // Calculate delta flow
      const isBullish = 
        (trade.contract_type === 'CALL' && 
         (classification.execution_level === 'ABOVE_ASK' || classification.execution_level === 'AT_ASK')) ||
        (trade.contract_type === 'PUT' && 
         (classification.execution_level === 'BELOW_BID' || classification.execution_level === 'AT_BID'));
      
      const deltaFlow = isBullish ? premium : -premium;
      
      const now = Date.now();
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0];
      const timeStr = date.toTimeString().split(' ')[0];

      await pool.query(`
        INSERT INTO options_trades (
          timestamp, date, time, ticker, strike, expiration, dte,
          contract_type, contract_symbol, price, size, premium,
          spot_price, bid, ask, spread, delta_flow,
          opra_code, trade_type, trade_subtype,
          execution_level, priority, highlight, exchange_id, 
          exchange_name, has_quote, sequence_number
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
          220, $18, NULL, $19, $20, $21, 65, 'CBOE', true, $22
        )
      `, [
        now,
        dateStr,
        timeStr,
        trade.ticker,
        trade.strike,
        trade.expiration,
        trade.dte,
        trade.contract_type,
        `O:${trade.ticker}251219${trade.contract_type[0]}00${String(trade.strike * 1000).padStart(8, '0')}`,
        trade.price,
        trade.size,
        premium,
        trade.spot_price,
        trade.bid,
        trade.ask,
        spread,
        deltaFlow,
        classification.trade_type,
        classification.execution_level,
        classification.priority,
        classification.highlight,
        Math.floor(Math.random() * 1000000)
      ]);

      const priorityEmoji = classification.priority === 1 ? '🔥' : 
                           classification.priority === 2 ? '⚡' : 
                           classification.priority === 3 ? '📊' : '📉';
      
      console.log(`${priorityEmoji} P${classification.priority} | ${trade.ticker} ${trade.contract_type} $${trade.strike} | ${classification.trade_type} ${classification.execution_level} | Premium: $${(premium / 1000).toFixed(1)}K | ${classification.reason}`);
    }

    console.log('\n✅ Test data with proper classification inserted!');
    console.log('🔄 Refresh your browser to see the trades\n');

  } catch (error) {
    console.error('❌ Error inserting test data:', error);
  } finally {
    await pool.end();
  }
}

insertTestTrades();