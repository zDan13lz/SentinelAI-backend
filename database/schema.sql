-- ============================================
-- SENTINELAI OPTIONS FLOW DATABASE SCHEMA
-- ============================================

-- Drop existing tables if they exist (careful!)
DROP TABLE IF EXISTS options_trades CASCADE;
DROP TABLE IF EXISTS flow_stats CASCADE;

-- ============================================
-- OPTIONS TRADES TABLE
-- ============================================
CREATE TABLE options_trades (
  id BIGSERIAL PRIMARY KEY,
  
  -- Time fields
  timestamp BIGINT NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  
  -- Contract info
  ticker VARCHAR(10) NOT NULL,
  strike DECIMAL(10,2) NOT NULL,
  expiration DATE NOT NULL,
  dte INTEGER NOT NULL,
  contract_type VARCHAR(4) NOT NULL CHECK (contract_type IN ('CALL', 'PUT')),
  contract_symbol VARCHAR(50) NOT NULL,
  
  -- Trade details
  price DECIMAL(10,4) NOT NULL,
  size INTEGER NOT NULL,
  premium DECIMAL(12,2) NOT NULL,
  
  -- Market context
  spot_price DECIMAL(10,2),
  bid DECIMAL(10,4),
  ask DECIMAL(10,4),
  
  -- Greeks & metrics
  open_interest INTEGER,
  implied_volatility DECIMAL(6,2),
  delta DECIMAL(6,4),
  gamma DECIMAL(8,6),
  vega DECIMAL(6,4),
  theta DECIMAL(6,4),
  
  -- Classification
  opra_code INTEGER NOT NULL,
  trade_type VARCHAR(20) NOT NULL,
  trade_subtype VARCHAR(20),
  
  -- Priority system
  execution_level VARCHAR(20) NOT NULL,
  priority INTEGER NOT NULL CHECK (priority IN (1, 2, 3)),
  highlight BOOLEAN DEFAULT FALSE,
  
  -- Exchange
  exchange_id INTEGER,
  exchange_name VARCHAR(20),
  
  -- Metadata
  has_quote BOOLEAN DEFAULT FALSE,
  sequence_number BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES FOR FAST QUERIES
-- ============================================

-- Primary query patterns
CREATE INDEX idx_ticker_timestamp ON options_trades(ticker, timestamp DESC);
CREATE INDEX idx_timestamp ON options_trades(timestamp DESC);
CREATE INDEX idx_date ON options_trades(date DESC);
CREATE INDEX idx_ticker_date ON options_trades(ticker, date DESC);

-- Filter queries
CREATE INDEX idx_premium ON options_trades(premium DESC);
CREATE INDEX idx_priority ON options_trades(priority, timestamp DESC);
CREATE INDEX idx_trade_type ON options_trades(trade_type, timestamp DESC);
CREATE INDEX idx_contract_type ON options_trades(contract_type, timestamp DESC);

-- Analytics queries
CREATE INDEX idx_ticker_priority ON options_trades(ticker, priority, timestamp DESC);
CREATE INDEX idx_date_priority ON options_trades(date, priority);

-- Deduplication
CREATE UNIQUE INDEX idx_unique_trade ON options_trades(contract_symbol, sequence_number);

-- ============================================
-- DAILY STATS TABLE (AGGREGATED)
-- ============================================
CREATE TABLE flow_stats (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  
  -- Volume stats
  total_trades INTEGER DEFAULT 0,
  total_premium DECIMAL(15,2) DEFAULT 0,
  
  -- Call/Put breakdown
  call_trades INTEGER DEFAULT 0,
  call_premium DECIMAL(15,2) DEFAULT 0,
  put_trades INTEGER DEFAULT 0,
  put_premium DECIMAL(15,2) DEFAULT 0,
  
  -- Type breakdown
  sweep_trades INTEGER DEFAULT 0,
  sweep_premium DECIMAL(15,2) DEFAULT 0,
  block_trades INTEGER DEFAULT 0,
  block_premium DECIMAL(15,2) DEFAULT 0,
  flow_trades INTEGER DEFAULT 0,
  flow_premium DECIMAL(15,2) DEFAULT 0,
  
  -- Priority breakdown
  priority_1_trades INTEGER DEFAULT 0,
  priority_1_premium DECIMAL(15,2) DEFAULT 0,
  priority_2_trades INTEGER DEFAULT 0,
  priority_2_premium DECIMAL(15,2) DEFAULT 0,
  priority_3_trades INTEGER DEFAULT 0,
  priority_3_premium DECIMAL(15,2) DEFAULT 0,
  
  -- Ratios
  call_put_ratio DECIMAL(6,2),
  institutional_ratio DECIMAL(6,2),
  
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update daily stats
CREATE OR REPLACE FUNCTION update_flow_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO flow_stats (date, total_trades, total_premium)
  VALUES (NEW.date, 1, NEW.premium)
  ON CONFLICT (date) DO UPDATE SET
    total_trades = flow_stats.total_trades + 1,
    total_premium = flow_stats.total_premium + NEW.premium,
    
    -- Update call/put
    call_trades = CASE WHEN NEW.contract_type = 'CALL' 
                  THEN flow_stats.call_trades + 1 
                  ELSE flow_stats.call_trades END,
    call_premium = CASE WHEN NEW.contract_type = 'CALL' 
                   THEN flow_stats.call_premium + NEW.premium 
                   ELSE flow_stats.call_premium END,
    put_trades = CASE WHEN NEW.contract_type = 'PUT' 
                 THEN flow_stats.put_trades + 1 
                 ELSE flow_stats.put_trades END,
    put_premium = CASE WHEN NEW.contract_type = 'PUT' 
                  THEN flow_stats.put_premium + NEW.premium 
                  ELSE flow_stats.put_premium END,
    
    -- Update type
    sweep_trades = CASE WHEN NEW.trade_type = 'SWEEP' 
                   THEN flow_stats.sweep_trades + 1 
                   ELSE flow_stats.sweep_trades END,
    sweep_premium = CASE WHEN NEW.trade_type = 'SWEEP' 
                    THEN flow_stats.sweep_premium + NEW.premium 
                    ELSE flow_stats.sweep_premium END,
    block_trades = CASE WHEN NEW.trade_type = 'BLOCK' 
                   THEN flow_stats.block_trades + 1 
                   ELSE flow_stats.block_trades END,
    block_premium = CASE WHEN NEW.trade_type = 'BLOCK' 
                    THEN flow_stats.block_premium + NEW.premium 
                    ELSE flow_stats.block_premium END,
    
    updated_at = CURRENT_TIMESTAMP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update stats
CREATE TRIGGER trigger_update_flow_stats
AFTER INSERT ON options_trades
FOR EACH ROW
EXECUTE FUNCTION update_flow_stats();

-- ============================================
-- CLEANUP FUNCTION (Delete old data)
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_old_trades(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM options_trades
  WHERE date < CURRENT_DATE - days_to_keep;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INITIAL SETUP COMPLETE
-- ============================================

-- Create today's stats entry
INSERT INTO flow_stats (date) VALUES (CURRENT_DATE)
ON CONFLICT (date) DO NOTHING;

-- Verify tables
SELECT 'Tables created successfully' as status;