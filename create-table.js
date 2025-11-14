const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:XCdaMkfDTzBGKMvaSmmEWnbQBBjyDZYl@switchyard.proxy.rlwy.net:32085/railway',
  ssl: {
    rejectUnauthorized: false
  }
});

async function createTable() {
  console.log('🔄 Connecting to Railway PostgreSQL...');
  
  try {
    const testResult = await pool.query('SELECT NOW()');
    console.log('✅ Connected! Server time:', testResult.rows[0].now);
    
    console.log('🔄 Creating options_trades table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS options_trades (
        id SERIAL PRIMARY KEY,
        timestamp BIGINT NOT NULL,
        date DATE,
        time TIME,
        ticker VARCHAR(10) NOT NULL,
        contract_symbol VARCHAR(50),
        contract_type VARCHAR(4) NOT NULL,
        strike NUMERIC(10, 2) NOT NULL,
        expiration DATE NOT NULL,
        dte INTEGER,
        price NUMERIC(10, 2),
        size INTEGER NOT NULL,
        premium NUMERIC(15, 2),
        volume INTEGER,
        open_interest INTEGER,
        bid NUMERIC(10, 2),
        ask NUMERIC(10, 2),
        underlying_price NUMERIC(10, 2),
        trade_type VARCHAR(20),
        flow_direction VARCHAR(10),
        priority INTEGER,
        urgency_score INTEGER,
        urgency_level VARCHAR(20),
        urgency_label VARCHAR(20),
        urgency_color VARCHAR(20),
        is_aggressive BOOLEAN,
        sweep_exchange_count INTEGER,
        sweep_exchanges TEXT[],
        is_part_of_sweep BOOLEAN DEFAULT false,
        sweep_id VARCHAR(100),
        is_block BOOLEAN DEFAULT false,
        block_reason TEXT,
        exchange_id INTEGER,
        exchange_name VARCHAR(50),
        condition_codes TEXT[],
        sequence_number BIGINT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Table created!');
    
    console.log('🔄 Creating indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON options_trades(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_trades_ticker ON options_trades(ticker);
      CREATE INDEX IF NOT EXISTS idx_trades_date ON options_trades(date DESC);
      CREATE INDEX IF NOT EXISTS idx_trades_premium ON options_trades(premium DESC);
      CREATE INDEX IF NOT EXISTS idx_trades_trade_type ON options_trades(trade_type);
      CREATE INDEX IF NOT EXISTS idx_trades_ticker_date ON options_trades(ticker, date DESC);
      CREATE INDEX IF NOT EXISTS idx_trades_strike_exp ON options_trades(strike, expiration);
    `);
    console.log('✅ Indexes created!');
    
    console.log('🔄 Creating flow_stats table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS flow_stats (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL UNIQUE,
        total_trades INTEGER DEFAULT 0,
        total_premium NUMERIC(20, 2) DEFAULT 0,
        call_trades INTEGER DEFAULT 0,
        call_premium NUMERIC(20, 2) DEFAULT 0,
        put_trades INTEGER DEFAULT 0,
        put_premium NUMERIC(20, 2) DEFAULT 0,
        sweep_trades INTEGER DEFAULT 0,
        sweep_premium NUMERIC(20, 2) DEFAULT 0,
        block_trades INTEGER DEFAULT 0,
        block_premium NUMERIC(20, 2) DEFAULT 0,
        flow_trades INTEGER DEFAULT 0,
        flow_premium NUMERIC(20, 2) DEFAULT 0,
        call_put_ratio NUMERIC(10, 2) DEFAULT 0,
        institutional_ratio NUMERIC(10, 2) DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ flow_stats table created!');
    
    console.log('🔄 Adding missing columns to existing table...');
    await pool.query(`
      ALTER TABLE options_trades 
        ADD COLUMN IF NOT EXISTS exchange_id INTEGER,
        ADD COLUMN IF NOT EXISTS urgency_level VARCHAR(20),
        ADD COLUMN IF NOT EXISTS is_part_of_sweep BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS sweep_id VARCHAR(100),
        ADD COLUMN IF NOT EXISTS is_block BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS block_reason TEXT;
    `);
    console.log('✅ Missing columns added!');
    
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('📊 Tables in database:', tables.rows.map(r => r.table_name));
    
    // Count existing trades
    const tradeCount = await pool.query('SELECT COUNT(*) FROM options_trades');
    console.log(`📊 Existing trades: ${tradeCount.rows[0].count}`);
    
    console.log('\n🎉 SUCCESS! Railway database is ready for deployment!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

createTable();