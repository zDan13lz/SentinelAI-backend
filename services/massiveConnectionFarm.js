const WebSocket = require('ws');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// OPRA trade type mapping
const TRADE_TYPES = {
  220: { label: 'SWEEP', subtype: 'ISO', priority: 'high' },
  233: { label: 'SWEEP', subtype: 'COMPLEX', priority: 'high' },
  238: { label: 'BLOCK', subtype: 'BLOCK', priority: 'high' },
  239: { label: 'CROSS', subtype: 'CROSS', priority: 'medium' },
  202: { label: 'FLOW', subtype: null, priority: 'low' }
};

class MassiveConnectionFarm {
  constructor(apiKey, io) {
    this.apiKey = apiKey;
    this.io = io;
    
    // Connection management
    this.connections = [];
    this.maxConnections = 10;
    this.maxQuotesPerConnection = 1000;
    this.staticConnectionCount = 3;  // Connections 0-2 for static
    this.dynamicConnectionCount = 7; // Connections 3-9 for dynamic
    
    // Volume tracking
    this.contractVolume = new Map();
    this.contractLastSeen = new Map();
    this.staticContracts = new Set();
    this.dynamicContracts = new Set();
    this.subscribedQuotes = new Map(); // connectionId -> Set of contracts
    
    // Quote cache
    this.quoteCache = new Map();
    this.seenTrades = new Set();
    
    // Statistics
    this.stats = {
      tradesReceived: 0,
      quotesReceived: 0,
      tradesStored: 0,
      tradesBroadcast: 0,
      startTime: Date.now(),
      staticSubscriptions: 0,
      dynamicSubscriptions: 0,
      connectionsActive: 0
    };
    
    this.tickerList = [];
    this.rebalanceInterval = null;
  }

  /**
   * Initialize all connections
   */
  async initialize() {
    console.log('\n🚀 Initializing Massive Connection Farm...');
    console.log(`📊 Target: ${this.maxConnections} connections × ${this.maxQuotesPerConnection} quotes = ${this.maxConnections * this.maxQuotesPerConnection} total`);
    
    try {
      // Load ticker list
      await this.loadTickers();
      
      // Create WebSocket connections
      await this.createConnections();
      
      // Wait for all connections to authenticate
      await this.waitForAuthentication();
      
      // Subscribe to static tiers (1-3)
      await this.subscribeStaticTiers();
      
      // Start volume tracking and rebalancing
      this.startVolumeTracking();
      this.startRebalancing();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      console.log('\n✅ Connection Farm fully initialized and running!\n');
      
    } catch (error) {
      console.error('❌ Failed to initialize connection farm:', error);
      throw error;
    }
  }

  /**
   * Load ticker list from config
   */
  async loadTickers() {
    try {
      const configPath = path.join(__dirname, '../config/tickers.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      // Load static tiers (guaranteed coverage)
      const tier1 = config.tier1_mega_caps || [];
      const tier2 = config.tier2_large_caps || [];
      const tier3 = config.tier3_mid_caps || [];
      
      this.staticTickers = [...tier1, ...tier2, ...tier3];
      
      // Load all tickers for dynamic tracking
      const allTickers = new Set();
      Object.keys(config).forEach(tier => {
        if (tier !== 'all_tickers' && Array.isArray(config[tier])) {
          config[tier].forEach(ticker => allTickers.add(ticker));
        }
      });
      
      this.tickerList = Array.from(allTickers).sort();
      
      console.log(`✅ Loaded ${this.staticTickers.length} static tickers (Tier 1-3)`);
      console.log(`✅ Loaded ${this.tickerList.length} total tickers for tracking`);
      
    } catch (error) {
      console.error('❌ Failed to load tickers:', error);
      this.staticTickers = ['SPY', 'QQQ', 'TSLA', 'AAPL', 'NVDA'];
      this.tickerList = this.staticTickers;
    }
  }

  /**
   * Create WebSocket connections
   */
  async createConnections() {
    console.log(`\n🔌 Creating ${this.maxConnections} WebSocket connections...`);
    
    for (let i = 0; i < this.maxConnections; i++) {
      const ws = new WebSocket('wss://socket.massive.com/options');
      
      const connection = {
        id: i,
        ws: ws,
        authenticated: false,
        subscriptions: new Set(),
        type: i < this.staticConnectionCount ? 'static' : 'dynamic'
      };
      
      this.setupConnectionHandlers(connection);
      this.connections.push(connection);
      
      // Initialize subscription tracking
      this.subscribedQuotes.set(i, new Set());
    }
    
    console.log(`✅ Created ${this.maxConnections} connections`);
  }

  /**
   * Setup WebSocket event handlers
   */
  setupConnectionHandlers(connection) {
    const { ws, id } = connection;
    
    ws.on('open', () => {
      console.log(`✅ Connection ${id} (${connection.type}) opened`);
      this.stats.connectionsActive++;
      this.authenticate(connection);
    });
    
    ws.on('message', (data) => {
      this.handleMessage(connection, data);
    });
    
    ws.on('close', () => {
      console.log(`❌ Connection ${id} closed`);
      this.stats.connectionsActive--;
      connection.authenticated = false;
      // TODO: Implement reconnection logic
    });
    
    ws.on('error', (error) => {
      console.error(`❌ Connection ${id} error:`, error.message);
    });
  }

  /**
   * Authenticate connection
   */
  authenticate(connection) {
    console.log(`🔐 Authenticating connection ${connection.id}...`);
    
    connection.ws.send(JSON.stringify({
      action: 'auth',
      params: this.apiKey
    }));
    
    // Mark as authenticated after delay
    setTimeout(() => {
      connection.authenticated = true;
      console.log(`✅ Connection ${connection.id} authenticated`);
    }, 1000);
  }

  /**
   * Wait for all connections to authenticate
   */
  async waitForAuthentication() {
    console.log('\n⏳ Waiting for all connections to authenticate...');
    
    return new Promise((resolve) => {
      const checkAuth = setInterval(() => {
        const allAuth = this.connections.every(conn => conn.authenticated);
        if (allAuth) {
          clearInterval(checkAuth);
          console.log('✅ All connections authenticated!');
          resolve();
        }
      }, 500);
    });
  }

  /**
   * Subscribe to static tier contracts
   */
  async subscribeStaticTiers() {
    console.log('\n📡 Subscribing to static tier contracts (Tier 1-3)...');
    
    // Subscribe to ALL trades on connection 0
    this.subscribe(this.connections[0], 'T.*');
    console.log('✅ Connection 0: Subscribed to T.* (ALL trades)');
    
    // For now, we don't know which contracts exist yet
    // We'll populate static contracts from incoming trades
    console.log('⏳ Static contract subscriptions will populate from incoming trades...');
    
    this.stats.staticSubscriptions = 0; // Will increment as we discover contracts
  }

  /**
   * Subscribe to channel on specific connection
   */
  subscribe(connection, channel) {
    if (!connection.authenticated) {
      console.log(`⚠️ Connection ${connection.id} not authenticated yet`);
      return;
    }
    
    connection.ws.send(JSON.stringify({
      action: 'subscribe',
      params: channel
    }));
    
    connection.subscriptions.add(channel);
  }

  /**
   * Unsubscribe from channel
   */
  unsubscribe(connection, channel) {
    connection.ws.send(JSON.stringify({
      action: 'unsubscribe',
      params: channel
    }));
    
    connection.subscriptions.delete(channel);
  }

  /**
   * Handle incoming WebSocket messages
   */
  async handleMessage(connection, data) {
    try {
      const messages = JSON.parse(data);
      
      if (Array.isArray(messages)) {
        for (const msg of messages) {
          await this.processMessage(connection, msg);
        }
      } else {
        await this.processMessage(connection, messages);
      }
    } catch (error) {
      console.error('❌ Error handling message:', error);
    }
  }

  /**
   * Process individual message
   */
  async processMessage(connection, msg) {
    if (!msg || !msg.ev) return;
    
    switch (msg.ev) {
      case 'T': // Trade
        await this.handleTrade(msg);
        break;
      case 'Q': // Quote
        this.handleQuote(msg);
        break;
      case 'status':
        if (connection.id === 0) {
          console.log(`📊 Status (Conn ${connection.id}):`, msg.message);
        }
        break;
    }
  }

  /**
   * Handle incoming trade
   */
  async handleTrade(trade) {
    try {
      // Deduplicate
      const key = `${trade.sym}-${trade.q}`;
      if (this.seenTrades.has(key)) return;
      this.seenTrades.add(key);
      
      this.stats.tradesReceived++;
      
      // Track volume for this contract
      const currentVol = this.contractVolume.get(trade.sym) || 0;
      this.contractVolume.set(trade.sym, currentVol + trade.s);
      this.contractLastSeen.set(trade.sym, Date.now());
      
      // Log every 100 trades
      if (this.stats.tradesReceived % 100 === 0) {
        console.log(`📊 Trades: ${this.stats.tradesReceived} | Quotes: ${this.stats.quotesReceived} | Stored: ${this.stats.tradesStored} | Volume tracked: ${this.contractVolume.size} contracts`);
      }
      
      // Parse contract
      const parsed = this.parseContract(trade.sym);
      if (!parsed) return;
      
      // Check if this is a static tier ticker
      if (this.staticTickers.includes(parsed.ticker)) {
        this.staticContracts.add(trade.sym);
      }
      
      // Get quote from cache
      const quote = this.quoteCache.get(trade.sym);
      const classification = this.classifyTrade(trade, quote);
      const premium = trade.p * trade.s * 100;
      
      // Calculate delta flow
      let deltaFlow = 0;
      if (quote) {
        const isBullish = (parsed.contractType === 'CALL' && 
                          (classification.level === 'ABOVE_ASK' || classification.level === 'AT_ASK')) ||
                         (parsed.contractType === 'PUT' && 
                          (classification.level === 'BELOW_BID' || classification.level === 'AT_BID'));
        deltaFlow = isBullish ? premium : -premium;
      }
      
      // Prepare trade data
      const tradeData = {
        timestamp: trade.t,
        date: new Date(trade.t).toISOString().split('T')[0],
        time: new Date(trade.t).toISOString().split('T')[1].split('.')[0],
        ticker: parsed.ticker,
        strike: parsed.strike,
        expiration: parsed.expiration,
        dte: parsed.dte,
        contract_type: parsed.contractType,
        contract_symbol: trade.sym,
        price: trade.p,
        size: trade.s,
        premium: premium,
        spot_price: null,
        bid: quote?.bp,
        ask: quote?.ap,
        spread: quote ? (quote.ap - quote.bp) : null,
        delta_flow: deltaFlow,
        opra_code: trade.c[0],
        trade_type: classification.type,
        trade_subtype: classification.subtype,
        execution_level: classification.level,
        priority: classification.priority,
        highlight: classification.highlight,
        exchange_id: trade.x,
        exchange_name: this.getExchangeName(trade.x),
        has_quote: !!quote,
        sequence_number: trade.q
      };
      
      // Store in database if >= $20K
      if (premium >= 20000) {
        await this.storeTrade(tradeData);
        this.stats.tradesStored++;
      }
      
      // Broadcast to frontend
      if (this.io) {
        this.io.emit('flow:all', tradeData);
        this.stats.tradesBroadcast++;
      }
      
      // Cleanup seen trades
      if (this.seenTrades.size > 100000) {
        this.seenTrades.clear();
      }
      
    } catch (error) {
      console.error('❌ Error handling trade:', error);
    }
  }

  /**
   * Handle incoming quote
   */
  handleQuote(quote) {
    this.stats.quotesReceived++;
    
    // Cache quote
    if (quote.sym && quote.sym.startsWith('O:')) {
      // Option quote
      this.quoteCache.set(quote.sym, {
        bp: quote.bp,
        ap: quote.ap,
        bs: quote.bs,
        as: quote.as,
        t: quote.t
      });
    } else {
      // Stock quote (for spot price)
      if (quote.bp && quote.ap) {
        const spotPrice = (quote.bp + quote.ap) / 2;
        this.quoteCache.set(`SPOT_${quote.sym}`, spotPrice);
      }
    }
    
    // Log every 200 quotes
    if (this.stats.quotesReceived % 200 === 0) {
      console.log(`💬 Quotes cached: ${this.quoteCache.size} | Static subs: ${this.stats.staticSubscriptions} | Dynamic subs: ${this.stats.dynamicSubscriptions}`);
    }
  }

  /**
   * Start volume tracking and rebalancing
   */
  startVolumeTracking() {
    console.log('\n📊 Starting volume-based tracking...');
    // Volume tracking happens automatically in handleTrade
  }

  /**
   * Start rebalancing interval
   */
  startRebalancing() {
    console.log('🔄 Starting rebalancing (every 5 minutes)...\n');
    
    // First rebalance after 5 minutes
    setTimeout(() => {
      this.rebalanceSubscriptions();
      
      // Then every 5 minutes
      this.rebalanceInterval = setInterval(() => {
        this.rebalanceSubscriptions();
      }, 5 * 60 * 1000);
    }, 5 * 60 * 1000);
  }

  /**
   * Rebalance subscriptions based on volume
   */
  rebalanceSubscriptions() {
    console.log('\n🔄 === REBALANCING SUBSCRIPTIONS ===');
    
    // Calculate available slots
    const staticSlots = this.staticConnectionCount * this.maxQuotesPerConnection;
    const dynamicSlots = this.dynamicConnectionCount * this.maxQuotesPerConnection;
    
    // Get static contracts (from tier 1-3 tickers)
    const staticContractsArray = Array.from(this.staticContracts);
    console.log(`📌 Static contracts: ${staticContractsArray.length}`);
    
    // Get top volume contracts (excluding static)
    const topDynamic = Array.from(this.contractVolume.entries())
      .filter(([sym]) => !this.staticContracts.has(sym))
      .sort((a, b) => b[1] - a[1])
      .slice(0, dynamicSlots)
      .map(([sym]) => sym);
    
    console.log(`🎯 Dynamic contracts (top volume): ${topDynamic.length}`);
    
    // Subscribe static contracts to connections 0-2
    this.updateStaticSubscriptions(staticContractsArray.slice(0, staticSlots));
    
    // Subscribe dynamic contracts to connections 3-9
    this.updateDynamicSubscriptions(topDynamic);
    
    console.log(`✅ Rebalancing complete`);
    console.log(`📊 Total quote subscriptions: ${this.stats.staticSubscriptions + this.stats.dynamicSubscriptions}`);
    console.log('=====================================\n');
  }

  /**
   * Update static subscriptions
   */
  updateStaticSubscriptions(contracts) {
    const contractsPerConn = Math.ceil(contracts.length / this.staticConnectionCount);
    
    for (let i = 0; i < this.staticConnectionCount; i++) {
      const connection = this.connections[i];
      const start = i * contractsPerConn;
      const end = start + contractsPerConn;
      const contractsForThisConn = contracts.slice(start, end);
      
      this.updateConnectionSubscriptions(connection, contractsForThisConn, 'static');
    }
  }

  /**
   * Update dynamic subscriptions
   */
  updateDynamicSubscriptions(contracts) {
    const contractsPerConn = Math.ceil(contracts.length / this.dynamicConnectionCount);
    
    for (let i = 0; i < this.dynamicConnectionCount; i++) {
      const connection = this.connections[this.staticConnectionCount + i];
      const start = i * contractsPerConn;
      const end = start + contractsPerConn;
      const contractsForThisConn = contracts.slice(start, end);
      
      this.updateConnectionSubscriptions(connection, contractsForThisConn, 'dynamic');
    }
  }

  /**
   * Update subscriptions for a specific connection
   */
  updateConnectionSubscriptions(connection, newContracts, type) {
    const currentSubs = this.subscribedQuotes.get(connection.id);
    const newSubsSet = new Set(newContracts);
    
    // Unsubscribe from old
    for (const old of currentSubs) {
      if (!newSubsSet.has(old)) {
        this.unsubscribe(connection, `Q.${old}`);
        currentSubs.delete(old);
        if (type === 'static') this.stats.staticSubscriptions--;
        if (type === 'dynamic') this.stats.dynamicSubscriptions--;
      }
    }
    
    // Subscribe to new
    for (const newContract of newContracts) {
      if (!currentSubs.has(newContract)) {
        this.subscribe(connection, `Q.${newContract}`);
        currentSubs.add(newContract);
        if (type === 'static') this.stats.staticSubscriptions++;
        if (type === 'dynamic') this.stats.dynamicSubscriptions++;
      }
    }
  }

  /**
   * Parse contract symbol
   */
  parseContract(symbol) {
    try {
      const clean = symbol.replace('O:', '');
      const dateMatch = clean.match(/\d{6}/);
      if (!dateMatch) return null;
      
      const dateIndex = dateMatch.index;
      const ticker = clean.substring(0, dateIndex);
      
      const dateStr = clean.substring(dateIndex, dateIndex + 6);
      const year = 2000 + parseInt(dateStr.substring(0, 2));
      const month = dateStr.substring(2, 4);
      const day = dateStr.substring(4, 6);
      const expiration = `${year}-${month}-${day}`;
      
      const type = clean.charAt(dateIndex + 6);
      const contractType = type === 'C' ? 'CALL' : 'PUT';
      
      const strikeStr = clean.substring(dateIndex + 7, dateIndex + 15);
      const strike = parseInt(strikeStr) / 1000;
      
      const expDate = new Date(expiration);
      const today = new Date();
      const dte = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      
      return {
        ticker,
        strike,
        expiration,
        dte,
        contractType,
        contractSymbol: symbol
      };
      
    } catch (error) {
      return null;
    }
  }

  /**
   * Classify trade
   */
  classifyTrade(trade, quote) {
    const opraInfo = TRADE_TYPES[trade.c[0]] || TRADE_TYPES[202];
    
    if (!quote) {
      const isInstitutional = ['SWEEP', 'BLOCK', 'CROSS'].includes(opraInfo.label);
      return {
        type: opraInfo.label,
        subtype: opraInfo.subtype,
        priority: isInstitutional ? 2 : 3,
        level: 'UNKNOWN',
        highlight: false
      };
    }
    
    const { p: price } = trade;
    const { bp: bid, ap: ask } = quote;
    
    const isInstitutional = ['SWEEP', 'BLOCK'].includes(opraInfo.label);
    if (!isInstitutional) {
      return {
        type: opraInfo.label,
        subtype: opraInfo.subtype,
        priority: 3,
        level: 'FLOW',
        highlight: false
      };
    }
    
    if (price > ask) {
      return {
        type: opraInfo.label,
        subtype: opraInfo.subtype,
        priority: 1,
        level: 'ABOVE_ASK',
        highlight: true
      };
    }
    
    if (price < bid) {
      return {
        type: opraInfo.label,
        subtype: opraInfo.subtype,
        priority: 1,
        level: 'BELOW_BID',
        highlight: true
      };
    }
    
    if (price === ask) {
      return {
        type: opraInfo.label,
        subtype: opraInfo.subtype,
        priority: 2,
        level: 'AT_ASK',
        highlight: false
      };
    }
    
    if (price === bid) {
      return {
        type: opraInfo.label,
        subtype: opraInfo.subtype,
        priority: 2,
        level: 'AT_BID',
        highlight: false
      };
    }
    
    return {
      type: opraInfo.label,
      subtype: opraInfo.subtype,
      priority: 3,
      level: 'MID',
      highlight: false
    };
  }

  /**
   * Store trade in database
   */
  async storeTrade(trade) {
    const query = `
      INSERT INTO options_trades (
        timestamp, date, time, ticker, strike, expiration, dte,
        contract_type, contract_symbol, price, size, premium,
        spot_price, bid, ask, spread, delta_flow,
        opra_code, trade_type, trade_subtype,
        execution_level, priority, highlight, exchange_id, exchange_name,
        has_quote, sequence_number
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
      )
      ON CONFLICT (contract_symbol, sequence_number) DO NOTHING
    `;
    
    const values = [
      trade.timestamp, trade.date, trade.time, trade.ticker, trade.strike,
      trade.expiration, trade.dte, trade.contract_type, trade.contract_symbol,
      trade.price, trade.size, trade.premium, trade.spot_price, trade.bid,
      trade.ask, trade.spread, trade.delta_flow, trade.opra_code, trade.trade_type,
      trade.trade_subtype, trade.execution_level, trade.priority, trade.highlight,
      trade.exchange_id, trade.exchange_name, trade.has_quote, trade.sequence_number
    ];
    
    try {
      await pool.query(query, values);
    } catch (error) {
      if (!error.message.includes('duplicate')) {
        console.error('❌ Database error:', error.message);
      }
    }
  }

  getExchangeName(id) {
    const exchanges = {
      65: 'CBOE', 66: 'ISE', 67: 'AMEX', 68: 'PHLX',
      69: 'BOX', 302: 'BATS', 303: 'EDGX', 304: 'C2'
    };
    return exchanges[id] || 'UNKNOWN';
  }

  startHealthMonitoring() {
    setInterval(() => {
      const elapsed = (Date.now() - this.stats.startTime) / 1000;
      const minutes = Math.floor(elapsed / 60);
      
      console.log('\n📊 === CONNECTION FARM STATS ===');
      console.log(`⏱️  Uptime: ${minutes} minutes`);
      console.log(`🔌 Connections: ${this.stats.connectionsActive}/${this.maxConnections}`);
      console.log(`📥 Trades: ${this.stats.tradesReceived.toLocaleString()}`);
      console.log(`💬 Quotes: ${this.stats.quotesReceived.toLocaleString()}`);
      console.log(`💾 Stored: ${this.stats.tradesStored.toLocaleString()}`);
      console.log(`📡 Broadcast: ${this.stats.tradesBroadcast.toLocaleString()}`);
      console.log(`📊 Volume tracked: ${this.contractVolume.size.toLocaleString()} contracts`);
      console.log(`📌 Static subs: ${this.stats.staticSubscriptions}`);
      console.log(`🎯 Dynamic subs: ${this.stats.dynamicSubscriptions}`);
      console.log(`💰 Quote cache: ${this.quoteCache.size.toLocaleString()}`);
      console.log('================================\n');
    }, 60000);
  }

  getStats() {
    return {
      connections: this.stats.connectionsActive,
      totalTickers: this.tickerList.length,
      cachedQuotes: this.quoteCache.size,
      ...this.stats
    };
  }

  close() {
    if (this.rebalanceInterval) {
      clearInterval(this.rebalanceInterval);
    }
    this.connections.forEach(conn => {
      if (conn.ws) conn.ws.close();
    });
    pool.end();
  }
}

module.exports = MassiveConnectionFarm;