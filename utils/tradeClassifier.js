/**
 * Trade Classification System
 * Determines priority and highlights based on trade characteristics
 */

/**
 * Classify trade priority based on type and execution level
 * 
 * PRIORITY 1 (CRITICAL - 🔥 Institutional Aggression):
 * - SWEEP or BLOCK + ABOVE_ASK (buying pressure, very aggressive)
 * 
 * PRIORITY 2 (HIGH - ⚡ Strong Interest):
 * - SWEEP or BLOCK + AT_ASK (aggressive buying)
 * 
 * PRIORITY 3 (NORMAL - 📊 Standard Activity):
 * - SWEEP or BLOCK + AT_BID (aggressive selling)
 * - FLOW + ABOVE_ASK or AT_ASK (moderate interest)
 * 
 * PRIORITY 4 (LOW - 📉 Weak Signal):
 * - SWEEP or BLOCK + BELOW_BID or MID (less conviction)
 * - FLOW + AT_BID, MID, or BELOW_BID (standard flow)
 * - UNKNOWN execution levels
 */
function classifyTradePriority(tradeType, executionLevel, premium) {
  // Normalize inputs
  const type = (tradeType || '').toUpperCase();
  const level = (executionLevel || '').toUpperCase();
  const amount = Number(premium) || 0;

  // PRIORITY 1: SWEEP/BLOCK + ABOVE ASK (Most Aggressive)
  if ((type === 'SWEEP' || type === 'BLOCK') && level === 'ABOVE_ASK') {
    return {
      priority: 1,
      highlight: true,
      reason: 'Aggressive institutional buying - Above Ask',
      signal: 'STRONG_BUY'
    };
  }

  // PRIORITY 2: SWEEP/BLOCK + AT ASK (Aggressive)
  if ((type === 'SWEEP' || type === 'BLOCK') && level === 'AT_ASK') {
    return {
      priority: 2,
      highlight: amount >= 100000, // Highlight if >= $100K
      reason: 'Strong buying pressure - At Ask',
      signal: 'BUY'
    };
  }

  // PRIORITY 3: SWEEP/BLOCK + AT BID (Normal)
  if ((type === 'SWEEP' || type === 'BLOCK') && level === 'AT_BID') {
    return {
      priority: 3,
      highlight: amount >= 250000, // Highlight if >= $250K
      reason: 'Aggressive selling - At Bid',
      signal: 'SELL'
    };
  }

  // PRIORITY 3: FLOW + ABOVE ASK or AT ASK
  if (type === 'FLOW' && (level === 'ABOVE_ASK' || level === 'AT_ASK')) {
    return {
      priority: 3,
      highlight: amount >= 200000, // Highlight if >= $200K
      reason: 'Moderate buying interest',
      signal: 'NEUTRAL_BUY'
    };
  }

  // PRIORITY 4: SWEEP/BLOCK + BELOW BID or MID (Low conviction)
  if ((type === 'SWEEP' || type === 'BLOCK') && (level === 'BELOW_BID' || level === 'MID')) {
    return {
      priority: 4,
      highlight: false,
      reason: 'Lower conviction trade',
      signal: 'WEAK'
    };
  }

  // PRIORITY 4: FLOW + AT BID, MID, BELOW BID (Standard flow)
  if (type === 'FLOW' && (level === 'AT_BID' || level === 'MID' || level === 'BELOW_BID')) {
    return {
      priority: 4,
      highlight: amount >= 300000, // Only highlight very large
      reason: 'Standard flow',
      signal: 'NEUTRAL'
    };
  }

  // PRIORITY 4: UNKNOWN execution level (can't classify properly)
  if (level === 'UNKNOWN') {
    return {
      priority: 4,
      highlight: false,
      reason: 'Unknown execution level',
      signal: 'UNKNOWN'
    };
  }

  // DEFAULT: Priority 4 for any unclassified trade
  return {
    priority: 4,
    highlight: false,
    reason: 'Unclassified trade',
    signal: 'UNKNOWN'
  };
}

/**
 * Determine if trade is a sweep based on conditions
 */
function isSweep(conditions) {
  // Trade conditions that indicate sweep
  // 220 = Intermarket Sweep Order (ISO)
  // 233 = Complex ISO sweep
  if (!conditions || !Array.isArray(conditions)) return false;
  return conditions.includes(220) || conditions.includes(233);
}

/**
 * Determine if trade is a block based on conditions, size, or premium
 */
function isBlock(size, premium, conditions) {
  // Block trade OPRA codes
  // 238 = Single-leg block trade
  if (conditions && Array.isArray(conditions)) {
    if (conditions.includes(238)) return true;
  }
  
  // Block trade criteria:
  // - Large size (>= 100 contracts)
  // - Large premium (>= $100K)
  return size >= 100 || premium >= 100000;
}

/**
 * Determine execution level from price vs bid/ask
 */
function determineExecutionLevel(price, bid, ask) {
  // If no bid/ask data, return UNKNOWN
  if (!price || !bid || !ask) return 'UNKNOWN';
  
  // Validate inputs
  if (bid <= 0 || ask <= 0 || price <= 0) return 'UNKNOWN';
  if (ask < bid) return 'UNKNOWN'; // Invalid quote
  
  const mid = (bid + ask) / 2;
  const tolerance = 0.01; // $0.01 tolerance
  
  // Check levels in order
  if (price > ask + tolerance) return 'ABOVE_ASK';
  if (Math.abs(price - ask) <= tolerance) return 'AT_ASK';
  if (Math.abs(price - mid) <= tolerance) return 'MID';
  if (Math.abs(price - bid) <= tolerance) return 'AT_BID';
  if (price < bid - tolerance) return 'BELOW_BID';
  
  // If price is between levels but not close to any, return closest
  if (price > mid) return 'AT_ASK';
  if (price < mid) return 'AT_BID';
  
  return 'MID';
}

/**
 * Classify a complete trade
 */
function classifyTrade(trade) {
  // Determine trade type
  let tradeType = 'FLOW'; // Default
  
  // Check for sweep condition (priority check)
  if (trade.conditions && isSweep(trade.conditions)) {
    tradeType = 'SWEEP';
  } 
  // Check for block characteristics
  else if (isBlock(trade.size, trade.premium, trade.conditions)) {
    tradeType = 'BLOCK';
  }
  
  // Determine execution level
  const executionLevel = determineExecutionLevel(
    trade.price,
    trade.bid,
    trade.ask
  );
  
  // Classify priority
  const classification = classifyTradePriority(
    tradeType,
    executionLevel,
    trade.premium
  );
  
  return {
    trade_type: tradeType,
    execution_level: executionLevel,
    priority: classification.priority,
    highlight: classification.highlight,
    reason: classification.reason,
    signal: classification.signal
  };
}

module.exports = {
  classifyTradePriority,
  isSweep,
  isBlock,
  determineExecutionLevel,
  classifyTrade
};