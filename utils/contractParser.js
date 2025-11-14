/**
 * Parse Massive contract symbol
 * Example: O:SPY251219C00680000
 * 
 * Format: O:[TICKER][YYMMDD][C/P][STRIKE*1000]
 */
function parseContract(symbol) {
  try {
    // Remove "O:" prefix
    const clean = symbol.replace('O:', '');
    
    // Extract ticker (find where date starts - 6 digits)
    const dateMatch = clean.match(/\d{6}/);
    if (!dateMatch) {
      throw new Error('No date found in symbol');
    }
    
    const dateIndex = dateMatch.index;
    const ticker = clean.substring(0, dateIndex);
    
    // Extract date (YYMMDD)
    const dateStr = clean.substring(dateIndex, dateIndex + 6);
    const year = 2000 + parseInt(dateStr.substring(0, 2));
    const month = dateStr.substring(2, 4);
    const day = dateStr.substring(4, 6);
    const expiration = `${year}-${month}-${day}`;
    
    // Extract type (C or P)
    const type = clean.charAt(dateIndex + 6);
    const contractType = type === 'C' ? 'CALL' : 'PUT';
    
    // Extract strike (8 digits, divide by 1000)
    const strikeStr = clean.substring(dateIndex + 7, dateIndex + 15);
    const strike = parseInt(strikeStr) / 1000;
    
    // Calculate DTE
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
    console.error('❌ Failed to parse contract:', symbol, error);
    return null;
  }
}

/**
 * Format expiration for display
 * 2025-12-19 → 12/19 (40d)
 */
function formatExpiration(expiration, dte) {
  const date = new Date(expiration);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day} (${dte}d)`;
}

/**
 * Format premium for display
 * 78000 → $78K
 */
function formatPremium(premium) {
  if (premium >= 1000000) {
    return `$${(premium / 1000000).toFixed(2)}M`;
  }
  return `$${(premium / 1000).toFixed(1)}K`;
}

module.exports = {
  parseContract,
  formatExpiration,
  formatPremium
};