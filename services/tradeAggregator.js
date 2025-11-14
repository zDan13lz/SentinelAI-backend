/**
 * Trade Aggregator (INSTITUTIONAL-GRADE)
 * Buffers and clusters trades to detect institutional sweeps and blocks
 */

class TradeAggregator {
  constructor() {
    // Trade buffer - keeps recent trades for clustering
    this.tradeBuffer = [];
    this.bufferMaxSize = 10000;
    this.bufferMaxAge = 5000; // 5 seconds
    
    // Sweep detection parameters (tuned for real market conditions)
    this.sweepWindow = 750;          // 750ms window
    this.sweepPriceDelta = 0.10;     // $0.10 price tolerance
    this.sweepMinTotal = 20;         // Minimum 20 contracts total
    this.sweepMinExchanges = 2;      // Minimum 2 exchanges
    
    // Block detection parameters
    this.blockMinSize = 500;         // Minimum 500 contracts
    this.blockIsolationWindow = 100; // 100ms isolation
    this.blockConditions = [229, 230, 233, 234, 235, 236]; // OPRA block codes
    this.darkVenues = [4, 21, 66];   // Dark pool exchange IDs
    
    // Statistics
    this.stats = {
      tradesProcessed: 0,
      sweepsDetected: 0,
      blocksDetected: 0,
      flowTrades: 0,
      clustersAnalyzed: 0
    };
  }

  /**
   * Process incoming trade
   * Returns enhanced trade with proper classification
   */
  processTrade(trade) {
    const now = trade.timestamp ? trade.timestamp : Date.now();
    
    // Add processing timestamp
    trade.processedAt = now;
    
    // Clean old trades from buffer
    this.cleanBuffer(now);
    
    // Get recent trades for clustering
    const recentTrades = this.getRecentTrades(trade.contract_symbol, now);
    
    // Detect sweep
    const sweepResult = this.detectSweep(trade, recentTrades);
    
    // Detect block
    const blockResult = this.detectBlock(trade, recentTrades);
    
    // Classify
    let classification = {
      trade_type: 'FLOW',
      is_part_of_sweep: false,
      is_block: false,
      sweep_id: null,
      sweep_total_size: 0,
      sweep_total_premium: 0,
      sweep_exchange_count: 0,
      sweep_exchanges: [],
      block_isolated: false,
      block_reason: null
    };
    
    // PRIORITY: SWEEP takes precedence over BLOCK
    if (sweepResult) {
      classification = {
        ...classification,
        trade_type: 'SWEEP',
        is_part_of_sweep: true,
        sweep_id: sweepResult.sweep_id,
        sweep_total_size: sweepResult.total_size,
        sweep_total_premium: sweepResult.total_premium,
        sweep_exchange_count: sweepResult.exchange_count,
        sweep_exchanges: sweepResult.exchanges
      };
      this.stats.sweepsDetected++;
    }
    // Then check for block
    else if (blockResult) {
      classification = {
        ...classification,
        trade_type: 'BLOCK',
        is_block: true,
        block_isolated: blockResult.isolated,
        block_reason: blockResult.reason
      };
      this.stats.blocksDetected++;
    }
    // Otherwise it's flow
    else {
      this.stats.flowTrades++;
    }
    
    // Add to buffer
    this.tradeBuffer.push({
      ...trade,
      classification: classification
    });
    
    this.stats.tradesProcessed++;
    
    return {
      ...trade,
      ...classification
    };
  }

  /**
   * Detect if trade is part of a sweep
   */
  detectSweep(trade, recentTrades) {
    // Find trades within sweep window - first pass by time only
    const timeCluster = recentTrades.filter(t => 
      Math.abs(t.processedAt - trade.processedAt) <= this.sweepWindow
    );
    
    // Include current trade
    timeCluster.push(trade);
    
    // Need at least 2 trades for a sweep
    if (timeCluster.length < 2) return null;
    
    // Calculate price range across ALL trades in time cluster
    const prices = timeCluster.map(t => t.price).filter(p => p !== undefined && p > 0);
    if (prices.length === 0) return null;
    
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    
    // Check if price range is within tolerance
    if (priceRange > this.sweepPriceDelta) return null;
    
    // All trades in time window are within price range - this is our cluster
    const cluster = timeCluster;
    
    // Calculate total size
    const totalSize = cluster.reduce((sum, t) => sum + (t.size || 0), 0);
    
    // Dynamic minimum based on contract price
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const minContracts = avgPrice > 5 ? this.sweepMinTotal : Math.floor(this.sweepMinTotal / 2);
    
    // Check if meets minimum size
    if (totalSize < minContracts) return null;
    
    // Get unique exchanges
    const exchangeIds = new Set(cluster.map(t => t.exchange_id));
    const exchangeNames = [...new Set(cluster.map(t => t.exchange_name))];
    
    // Hybrid rule - need 2+ exchanges OR 3+ trades on same exchange
    if (exchangeIds.size < this.sweepMinExchanges && cluster.length < 3) return null;
    
    // Calculate total premium with fallback
    const totalPremium = cluster.reduce((sum, t) => {
      const premium = t.premium || (t.size * t.price * 100);
      return sum + (premium || 0);
    }, 0);
    
    // Generate sweep ID (based on timestamp and symbol)
    const sweepId = `${trade.contract_symbol}_${Math.floor(trade.processedAt / 100)}`;
    
    this.stats.clustersAnalyzed++;
    
    return {
      sweep_id: sweepId,
      total_size: totalSize,
      total_premium: totalPremium,
      exchange_count: exchangeIds.size,
      exchanges: exchangeNames,
      trades: cluster.map(t => ({
        exchange: t.exchange_name,
        size: t.size,
        price: t.price,
        premium: t.premium || (t.size * t.price * 100)
      }))
    };
  }

  /**
   * Detect if trade is a block
   */
  detectBlock(trade, recentTrades) {
    // Check 1: Large size
    const isLargeSize = trade.size >= this.blockMinSize;
    
    // Check 2: Isolated (no nearby trades)
    const nearbyTrades = recentTrades.filter(t =>
      Math.abs(t.processedAt - trade.processedAt) <= this.blockIsolationWindow
    );
    const isIsolated = nearbyTrades.length === 0;
    
    // Check 3: Has block condition code
    const hasBlockCode = trade.conditions && 
      Array.isArray(trade.conditions) &&
      trade.conditions.some(c => this.blockConditions.includes(c));
    
    // Check 4: Dark venue
    const isDarkVenue = this.darkVenues.includes(trade.exchange_id);
    
    // Determine if it's a block and why
    let reason = null;
    let isBlock = false;
    
    if (isLargeSize && isIsolated) {
      isBlock = true;
      reason = 'LARGE_ISOLATED';
    } else if (hasBlockCode) {
      isBlock = true;
      reason = 'OPRA_BLOCK_CODE';
    } else if (isDarkVenue && isLargeSize) {
      isBlock = true;
      reason = 'DARK_VENUE';
    }
    
    if (isBlock) {
      return {
        isolated: isIsolated,
        reason: reason
      };
    }
    
    return null;
  }

  /**
   * Get recent trades for same symbol
   */
  getRecentTrades(symbol, currentTime) {
    return this.tradeBuffer.filter(t => 
      t.contract_symbol === symbol &&
      (currentTime - t.processedAt) <= this.sweepWindow
    );
  }

  /**
   * Clean old trades from buffer
   */
  cleanBuffer(currentTime) {
    // Remove trades older than buffer max age
    this.tradeBuffer = this.tradeBuffer.filter(t =>
      (currentTime - t.processedAt) <= this.bufferMaxAge
    );
    
    // If buffer is still too large, remove oldest
    if (this.tradeBuffer.length > this.bufferMaxSize) {
      this.tradeBuffer = this.tradeBuffer.slice(-this.bufferMaxSize);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      bufferSize: this.tradeBuffer.length,
      sweepDetectionRate: this.stats.tradesProcessed > 0 
        ? (this.stats.sweepsDetected / this.stats.tradesProcessed * 100).toFixed(2) + '%'
        : '0%',
      blockDetectionRate: this.stats.tradesProcessed > 0
        ? (this.stats.blocksDetected / this.stats.tradesProcessed * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Update detection parameters (for live tuning)
   */
  updateParameters(params) {
    if (params.sweepWindow !== undefined) this.sweepWindow = params.sweepWindow;
    if (params.sweepPriceDelta !== undefined) this.sweepPriceDelta = params.sweepPriceDelta;
    if (params.sweepMinTotal !== undefined) this.sweepMinTotal = params.sweepMinTotal;
    if (params.blockMinSize !== undefined) this.blockMinSize = params.blockMinSize;
    
    console.log('📊 Trade aggregator parameters updated:', params);
  }
}

module.exports = TradeAggregator;