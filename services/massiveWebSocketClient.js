const WebSocket = require('ws');
const { Pool } = require('pg');
const TradeAggregator = require('./tradeAggregator');

class MassiveWebSocketClient {
  constructor(apiKey, io) {
    this.apiKey = apiKey;
    this.io = io;
    
    // SINGLE WebSocket for options trades only
    this.optionsWS = null;
    
    this.reconnectInterval = 5000;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.isAuthenticated = false;
    this.subscriptions = [];
    
    this.tradeAggregator = new TradeAggregator();
    
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:iGoMango10!@localhost:5432/sentinelai'
    });

    this.stats = {
      tradesReceived: 0,
      tradesInserted: 0,
      tradesBroadcast: 0,
      sweepsDetected: 0,
      blocksDetected: 0,
      errors: 0,
      connected: false,
      lastTradeTime: null
    };
  }

  /**
   * Connect to Options WebSocket
   */
  connect() {
    console.log('🔌 Connecting to Massive.com Options WebSocket...');
    
    this.optionsWS = new WebSocket('wss://socket.massive.com/options');

    this.optionsWS.on('open', () => {
      console.log('✅ Connected to Options WebSocket');
      this.stats.connected = true;
      this.reconnectAttempts = 0;
      this.authenticate();
    });

    this.optionsWS.on('message', (data) => {
      this.handleMessage(data);
    });

    this.optionsWS.on('close', () => {
      console.log('❌ Disconnected from Options WebSocket');
      this.stats.connected = false;
      this.isAuthenticated = false;
      this.reconnect();
    });

    this.optionsWS.on('error', (error) => {
      console.error('❌ Options WebSocket error:', error.message);
      this.stats.errors++;
    });
  }

  /**
   * Authenticate
   */
  authenticate() {
    console.log('🔐 Authenticating...');
    
    this.optionsWS.send(JSON.stringify({
      action: 'auth',
      params: this.apiKey
    }));

    setTimeout(() => {
      this.isAuthenticated = true;
      this.subscribeToTrades();
    }, 1000);
  }

  /**
   * Subscribe to ALL options trades
   */
  subscribeToTrades() {
    console.log('📡 Subscribing to ALL options trades...');
    
    // Subscribe to ALL option trades
    this.optionsWS.send(JSON.stringify({
      action: 'subscribe',
      params: 'T.*'
    }));
    
    console.log('✅ Subscribed to entire options market (T.*)');
  }

  /**
   * Handle incoming messages
   */
  async handleMessage(data) {
    try {
      const messages = JSON.parse(data);
      
      if (Array.isArray(messages)) {
        for (const msg of messages) {
          await this.processMessage(msg);
        }
      } else {
        await this.processMessage(messages);
      }
    } catch (error) {
      console.error('❌ Error handling message:', error);
      this.stats.errors++;
    }
  }

  /**
   * Process individual message
   */
  async processMessage(msg) {
    if (!msg || !msg.ev) return;

    if (msg.ev === 'T') {
      await this.handleTrade(msg);
    } else if (msg.ev === 'status') {
      console.log('📊 Status:', msg.message);
    }
  }

  /**
   * Handle trade message
   */
  async handleTrade(trade) {
    try {
      this.stats.tradesReceived++;

      const parsed = this.parseContractSymbol(trade.sym);
      if (!parsed) return;

      const premium = trade.p * trade.s * 100;

      const aggregatorResult = this.tradeAggregator.processTrade({
        contract_symbol: trade.sym,
        price: trade.p,
        size: trade.s,
        premium: premium,
        exchange_id: trade.x,
        exchange_name: this.getExchangeName(trade.x),
        conditions: trade.c,
        timestamp: trade.t
      });

      const trade_type = aggregatorResult.trade_type;

      if (trade_type === 'SWEEP') this.stats.sweepsDetected++;
      if (trade_type === 'BLOCK') this.stats.blocksDetected++;

      const urgency = this.calculateUrgency(trade, aggregatorResult);
      const isAggressive = this.isAggressiveTrade(trade.c, aggregatorResult);
      const flowDirection = this.calculateFlowDirection(
        parsed.type,
        trade_type,
        premium,
        isAggressive
      );

      // ✅ FIXED TIMESTAMP (nanoseconds → milliseconds)
      const tsMs = Math.floor(trade.t / 1000000);

      // ✅ Validate timestamp
      const today = new Date();
      const isValidDate = tradeDate.getFullYear() >= 2020 && tradeDate.getFullYear() <= today.getFullYear() + 1;

      const tradeData = {
        timestamp: tsMs,
        date: isValidDate ? tradeDate.toISOString().split('T')[0] : today.toISOString().split('T')[0],
        time: isValidDate ? tradeDate.toTimeString().split(' ')[0] : today.toTimeString().split(' ')[0],

        ticker: parsed.ticker,
        strike: parsed.strike,
        expiration: parsed.expiration,
        dte: this.calculateDTE(parsed.expiration),
        contract_type: parsed.type,
        contract_symbol: trade.sym,
        price: trade.p,
        size: trade.s,
        premium: premium,
        trade_type: trade_type,
        exchange_id: trade.x,
        exchange_name: this.getExchangeName(trade.x),
        sequence_number: trade.q,
        condition_codes: trade.c || [],
        is_aggressive: isAggressive,
        urgency_score: urgency.score,
        urgency_level: urgency.level,
        urgency_label: urgency.label,
        urgency_color: urgency.color,
        flow_direction: flowDirection,
        sweep_exchange_count: aggregatorResult.sweep_exchange_count || 0,
        sweep_exchanges: aggregatorResult.sweep_exchanges || [],
        is_part_of_sweep: aggregatorResult.is_part_of_sweep,
        sweep_id: aggregatorResult.sweep_id,
        is_block: aggregatorResult.is_block,
        block_reason: aggregatorResult.block_reason
      };

      if (premium >= 25000) {
        try {
          await this.insertTrade(tradeData);
          this.stats.tradesInserted++;
        } catch (error) {
          if (this.stats.errors % 100 === 0) {
            console.error('❌ Database insert error:', error.message);
          }
          this.stats.errors++;
        }
      }

      this.io.emit('flow:all', tradeData);
      this.stats.tradesBroadcast++;
      this.stats.lastTradeTime = Date.now();

      if (trade_type === 'SWEEP' && premium >= 100000) {
        console.log(`⚡ SWEEP: ${parsed.ticker} ${parsed.type} $${parsed.strike} | ${aggregatorResult.sweep_exchange_count}x | $${(premium / 1000).toFixed(1)}K | ${urgency.label}`);
      } else if (trade_type === 'BLOCK' && premium >= 200000) {
        console.log(`🧱 BLOCK: ${parsed.ticker} ${parsed.type} $${parsed.strike} | ${trade.s} contracts | $${(premium / 1000).toFixed(1)}K | ${urgency.label}`);
      }

    } catch (error) {
      console.error('❌ Error handling trade:', error.message);
      this.stats.errors++;
    }
  }

  // 🟦 Everything below remains unchanged (your urgency, flow, parsing, etc.)

  calculateUrgency(trade, aggregatorResult) {
    let score = 0;
    let level = 'LOW';
    let label = 'Passive';
    let color = '#808080';
    
    const premium = trade.p * trade.s * 100;
    
    if (aggregatorResult.trade_type === 'SWEEP') {
      score += 30;
      if (aggregatorResult.sweep_exchange_count >= 6) {
        score += 15;
      } else if (aggregatorResult.sweep_exchange_count >= 4) {
        score += 10;
      } else if (aggregatorResult.sweep_exchange_count >= 2) {
        score += 5;
      }
    }
    
    if (premium >= 2000000) score += 30;
    else if (premium >= 1000000) score += 25;
    else if (premium >= 500000) score += 20;
    else if (premium >= 200000) score += 15;
    else if (premium >= 100000) score += 10;
    else if (premium >= 50000) score += 5;
    
    const aggressiveCodes = [220, 229, 230];
    const hasAggressiveCode = trade.c?.some(c => aggressiveCodes.includes(c));
    if (hasAggressiveCode) score += 20;
    
    if (aggregatorResult.trade_type === 'BLOCK') {
      score += 10;
    }
    
    if (score >= 80) {
      level = 'EXTREME';
      label = 'Aggressive Sweep';
      color = '#FF1493';
    } else if (score >= 60) {
      level = 'HIGH';
      label = 'Aggressive';
      color = '#FF8C00';
    } else if (score >= 40) {
      level = 'MODERATE';
      label = 'Moderate';
      color = '#FFD700';
    }

    return { score, level, label, color };
  }

  isAggressiveTrade(conditions, aggregatorResult) {
    if (aggregatorResult.trade_type === 'SWEEP') return true;
    
    const aggressiveCodes = [220, 229, 230, 233, 234];
    if (conditions && conditions.some(c => aggressiveCodes.includes(c))) {
      return true;
    }
    
    if (aggregatorResult.trade_type === 'BLOCK') return true;
    
    return false;
  }

  calculateFlowDirection(contractType, tradeType, premium, isAggressive) {
    if (contractType === 'CALL') {
      if (tradeType === 'SWEEP') return 'BULLISH';
      if (tradeType === 'BLOCK' && premium >= 200000) return 'BULLISH';
      if (isAggressive && premium >= 100000) return 'BULLISH';
    }
    
    if (contractType === 'PUT') {
      if (tradeType === 'SWEEP') return 'BEARISH';
      if (tradeType === 'BLOCK' && premium >= 200000) return 'BEARISH';
      if (isAggressive && premium >= 100000) return 'BEARISH';
    }

    return 'NEUTRAL';
  }

  parseContractSymbol(symbol) {
    try {
      const match = symbol.match(/O:([A-Z]+)(\d{6,7})([CP])(\d{8})/);
      if (!match) return null;

      const ticker = match[1];
      let dateStr = match[2];
      const type = match[3] === 'C' ? 'CALL' : 'PUT';
      const strikeRaw = parseInt(match[4]);

      let year, month, day;
      
      if (dateStr.length === 7) {
        year = 2000 + parseInt(dateStr.substring(0, 3));
        month = dateStr.substring(3, 5);
        day = dateStr.substring(5, 7);
      } else if (dateStr.length === 6) {
        year = 2000 + parseInt(dateStr.substring(0, 2));
        month = dateStr.substring(2, 4);
        day = dateStr.substring(4, 6);
      } else {
        return null;
      }

      const expiration = `${year}-${month}-${day}`;
      const strike = strikeRaw / 1000;

      return { ticker, expiration, type, strike };
    } catch {
      return null;
    }
  }

  calculateDTE(expiration) {
    const exp = new Date(expiration);
    const now = new Date();
    return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
  }

  getExchangeName(exchangeId) {
    const exchanges = {
      65: 'CBOE', 66: 'ISE', 67: 'AMEX', 68: 'PHLX', 69: 'BOX',
      70: 'MIAX', 71: 'PEARL', 72: 'EMERALD', 73: 'MEMX',
      302: 'BATS', 303: 'EDGX', 304: 'C2', 305: 'BZX',
      306: 'GEMX', 307: 'ISE_GEMINI', 308: 'ISE_MERCURY',
      309: 'NASDAQ_OM', 310: 'NASDAQ_BX', 311: 'NASDAQ_PHLX',
      312: 'NYSE_ARCA', 313: 'NYSE_AMERICAN', 316: 'MIAX_SAPPHIRE'
    };
    return exchanges[exchangeId] || `UNKNOWN (${exchangeId})`;
  }

  async insertTrade(trade) {
    try {
      await this.pool.query(`
        INSERT INTO options_trades (
          timestamp, date, time, ticker, strike, expiration, dte,
          contract_type, contract_symbol, price, size, premium,
          trade_type, exchange_id, exchange_name, sequence_number,
          condition_codes, is_aggressive,
          urgency_score, urgency_level, urgency_label, urgency_color,
          flow_direction,
          sweep_exchange_count, is_part_of_sweep, sweep_id,
          is_block, block_reason
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
          $24, $25, $26, $27, $28
        )
      `, [
        trade.timestamp, trade.date, trade.time, trade.ticker, trade.strike,
        trade.expiration, trade.dte, trade.contract_type, trade.contract_symbol,
        trade.price, trade.size, trade.premium,
        trade.trade_type, trade.exchange_id, trade.exchange_name, trade.sequence_number,
        trade.condition_codes, trade.is_aggressive,
        trade.urgency_score, trade.urgency_level, trade.urgency_label, trade.urgency_color,
        trade.flow_direction,
        trade.sweep_exchange_count, trade.is_part_of_sweep, trade.sweep_id,
        trade.is_block, trade.block_reason
      ]);
    } catch (error) {
      throw error;
    }
  }

  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 Reconnecting... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }

  getStats() {
    return {
      ...this.stats,
      uptime: this.stats.lastTradeTime ? Date.now() - this.stats.lastTradeTime : 0,
      aggregator: this.tradeAggregator.getStats()
    };
  }

  close() {
    if (this.optionsWS) {
      this.optionsWS.close();
    }
    this.pool.end();
  }
}

module.exports = MassiveWebSocketClient;
