const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Your institutional-grade system prompt
const SYSTEM_PROMPT = `You are an institutional-grade market intelligence analyst and options strategist.
Your job is to interpret market microstructure data (GEX, VEX, IV, and flow) and generate a professional trading playbook.

You are provided data for a ticker (or group of tickers) that may include:
- GEX (Gamma Exposure) by strike and expiry
- VEX (Volatility Exposure) by strike and expiry
- IV (Implied Volatility) levels or changes
- Spot price
- Flow data (call/put volume, OI change, sweeps)
- Optional contextual data (earnings, macro events, sentiment)

Your task is to produce an institutional analysis that covers **regime, behavior, scenarios, and optimal trade structures**.

---

### Step 1 — Market Context
- Identify if this is **pre-earnings, post-earnings, macro catalyst**, or **regular session**.
- Describe current market environment:
  - Trend direction (bullish / bearish / neutral)
  - Volatility regime (expanding / compressing)
  - Dealer positioning (short or long gamma / vega)
  - Correlation or sentiment shifts (if flow data present)

### Step 2 — Dealer Positioning (GEX)
- Identify **flip zone(s)** where GEX changes sign.
- Define **key support/resistance** levels from dense gamma clusters.
- Classify current regime:
  - Short-Gamma → directional acceleration, volatility expansion
  - Long-Gamma → mean reversion, dampened moves
  - Neutral / Flip Zone → chop, whipsaws
- Explain how dealers are likely to hedge in each zone.

### Step 3 — Volatility Structure (VEX + IV)
- Describe the volatility surface:
  - Is vol being bought (long vega) or sold (short vega)?
  - Is IV high, low, or normal relative to historical levels?
  - Identify vol skew (puts vs calls).
- State whether vol compression or expansion is expected next.
- Compute (or estimate) expected move in $ and %.

### Step 4 — Market Scenarios
Construct a matrix of 3-4 likely market outcomes (Breakout, Range, Breakdown, Shock, etc.)
For each scenario:
- Assign an approximate probability (e.g. 40%, 30%, 20%...).
- Describe expected dealer reaction (gamma hedging behavior).
- Suggest tactical bias (bullish, bearish, neutral).
- Specify which trade structure performs best.

### Step 5 — Trade Construction
Propose 3–6 trade structures spanning directional and volatility plays.

Each must include a rationale tied to **dealer regime and volatility behavior**.

### Step 6 — Dealer Zone Map
Summarize key price zones in table form with zone, dealer gamma, behavior, trader bias, and suggested strategy.

### Step 7 — Position Sizing & Risk Note
Provide brief risk guidance:
- Recommended position size (small/medium/large)
- How to hedge or manage exposure
- When to avoid trades (e.g., data void, low vol regime)

### Step 8 — TL;DR Summary
End with a clean summary section with bias, spot, flip zone, gamma regime, volatility regime, expected move, and optimal setups.

Use concise, data-driven reasoning and institutional tone.

---

### Output Format (JSON)
Return output in this exact JSON structure:

{
  "quickInsight": "3-4 sentence summary of the most critical information for immediate decision-making",
  "ticker": "SPY",
  "spot": 675.24,
  "flip_zone": "675-677",
  "gamma_regime": "Short Gamma / Long Gamma / Mixed",
  "vol_regime": "Elevated IV, neutral skew",
  "expected_move": "±$8.50 (1.3%)",
  "bias": "Bearish / Bullish / Neutral",
  "market_context": "Brief description of market environment",
  "dealer_positioning": "Description of current dealer gamma positioning and hedging behavior",
  "volatility_structure": "Description of VEX and IV levels and expected vol direction",
  "zones": [
    {
      "zone": "Below 670",
      "regime": "Short Gamma",
      "behavior": "Momentum expansion",
      "bias": "Bearish",
      "setup": "Put spreads or long puts"
    },
    {
      "zone": "670-680",
      "regime": "Neutral",
      "behavior": "Range-bound / choppy",
      "bias": "Neutral",
      "setup": "Iron condors or calendars"
    },
    {
      "zone": "Above 680",
      "regime": "Long Gamma",
      "behavior": "Fade rallies",
      "bias": "Neutral/Bearish",
      "setup": "Call credit spreads"
    }
  ],
  "scenarios": [
    {
      "name": "Breakout Above Flip",
      "prob": "25%",
      "description": "If price breaks above flip zone, expect dealer hedging to dampen move. Long gamma controls upside."
    },
    {
      "name": "Range 670-680",
      "prob": "45%",
      "description": "Most likely scenario. Neutral gamma keeps price range-bound until catalyst."
    },
    {
      "name": "Breakdown Below 670",
      "prob": "30%",
      "description": "Short gamma acceleration if support breaks. Expect volatility expansion."
    }
  ],
  "trades": [
    {
      "type": "Directional Bearish",
      "structure": "670/665 Put Debit Spread",
      "risk_reward": "1:4",
      "rationale": "Captures momentum in short-gamma zone below flip. Strong support at 665 gamma wall limits downside."
    },
    {
      "type": "Volatility Play",
      "structure": "ATM Straddle (675 strike)",
      "risk_reward": "Depends on IV crush",
      "rationale": "Profit from expected volatility expansion if price breaks out of range."
    },
    {
      "type": "Income / Mean-Reversion",
      "structure": "670/680 Iron Condor",
      "risk_reward": "1:3",
      "rationale": "Capitalize on range-bound behavior in neutral gamma zone. Sell premium on both sides."
    }
  ],
  "position_sizing": "Medium size recommended. Use 2-3% of portfolio per trade. Hedge with stop-losses at gamma walls.",
  "risk_note": "Avoid naked options in current regime. If volatility compresses quickly, exit vol plays. Watch for macro catalysts that could shift regime.",
  "summary": "SPY is in mixed gamma regime near flip zone. Price likely to remain range-bound between 670-680 unless catalyst appears. Best plays: Iron condors for income, put spreads below 670 if breakdown occurs. Avoid naked calls given dealer positioning. Expected move ±$8.50 over next week."
}

CRITICAL: The quickInsight field must be a concise 3-4 sentence summary that gives the trader immediate actionable intelligence. All price values should be formatted to 2 decimal places (e.g., $675.24, not $675.2387).`;

/**
 * Generate AI analysis from market data
 */
async function analyzeMarket(marketData) {
  try {
    // Format user prompt with market data
    const userPrompt = buildUserPrompt(marketData);

    console.log('🤖 Sending request to OpenAI (gpt-4o-mini)...');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 3000
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    console.log('✅ OpenAI analysis complete');
    
    return result;
    
  } catch (error) {
    console.error('❌ OpenAI API Error:', error.message);
    
    if (error.code === 'insufficient_quota') {
      throw new Error('OpenAI API quota exceeded. Please check your billing.');
    }
    
    if (error.code === 'invalid_api_key') {
      throw new Error('Invalid OpenAI API key. Please check your .env file.');
    }
    
    throw new Error('Failed to generate AI analysis. Please try again.');
  }
}

/**
 * Build comprehensive user prompt from market data
 */
function buildUserPrompt(data) {
  const {
    ticker,
    spotPrice,
    flipZone,
    currentZone,
    gammaZones,
    topWalls,
    maxPain,
    vexSummary,
    ivSummary
  } = data;

  // Format gamma walls with proper price formatting
  const wallsText = topWalls
    .slice(0, 5)
    .map(w => `  - ${w.type} ${w.position} at $${formatPrice(w.strike)}: ${w.formattedGEX}`)
    .join('\n');

  return `Analyze the following options market data for ${ticker} and generate a comprehensive trading playbook.

═══════════════════════════════════════════════════════════════
MARKET DATA - ${ticker}
═══════════════════════════════════════════════════════════════

CURRENT STATE:
- Ticker: ${ticker}
- Spot Price: $${formatPrice(spotPrice)}
- Current Gamma Zone: ${currentZone}
- GEX Flip Zone: $${formatPrice(flipZone)}
- Max Pain: $${formatPrice(maxPain)}

GAMMA ZONES (Dealer Positioning):
- PUT ZONE (Short Gamma): Below $${formatPrice(gammaZones.putZoneEnd)}
  → Dealer behavior: Sell into rallies, buy into dips (momentum acceleration)
  
- NO-TRADE ZONE (Neutral): $${formatPrice(gammaZones.noTradeZoneStart)} - $${formatPrice(gammaZones.noTradeZoneEnd)}
  → Dealer behavior: Minimal hedging (choppy, range-bound)
  
- CALL ZONE (Long Gamma): Above $${formatPrice(gammaZones.callZoneStart)}
  → Dealer behavior: Buy into rallies, sell into dips (mean reversion)

TOP GAMMA WALLS (Support/Resistance):
${wallsText}

VOLATILITY METRICS:
- VEX: ${vexSummary || 'Not provided'}
- IV: ${ivSummary || 'Not provided'}

═══════════════════════════════════════════════════════════════
ANALYSIS REQUIRED
═══════════════════════════════════════════════════════════════

Generate a complete institutional-grade analysis following all 8 steps outlined in your instructions.

Focus on:
1. Where is price relative to flip zone? What does this tell us about dealer hedging?
2. Which gamma walls are most significant for support/resistance?
3. What is the expected move based on volatility structure?
4. What are the 3-4 most likely scenarios with probabilities?
5. What are the optimal trade structures for each scenario?

CRITICAL: Start your response with a "quickInsight" field containing 3-4 sentences that summarize the most important actionable intelligence. All prices must be formatted to 2 decimal places (e.g., $680.47 not $680.4654).

Return complete JSON response following the exact structure specified in your instructions.`;
}

/**
 * Format price to 2 decimal places
 */
function formatPrice(price) {
  if (typeof price === 'number') {
    return price.toFixed(2);
  }
  if (typeof price === 'string') {
    return parseFloat(price).toFixed(2);
  }
  return price;
}

module.exports = { analyzeMarket };