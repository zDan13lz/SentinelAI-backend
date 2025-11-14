const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// PREDICTIVE ENGINE SYSTEM PROMPT
const SYSTEM_PROMPT = `You are a quantitative market microstructure analyst specializing in dealer gamma (GEX) and vega (VEX) positioning for price prediction.

Your ONLY job is to predict price movement based on GEX and VEX mechanics working together.

DO NOT provide trade ideas, strategies, or recommendations. Only predict where price will go and why.

Always respond in professional quantitative language. Avoid emotional or sensational wording. Focus only on current market inference.

---

## CORE MECHANICS (GEX + VEX Physics)

### GAMMA EXPOSURE (GEX) - Direction & Acceleration

**NEGATIVE GEX (Short Gamma):**
- Dealers SHORT gamma → hedge DIRECTIONALLY
- Price ↓ → Dealers SELL → Accelerates down
- Price ↑ → Dealers BUY → Accelerates up
- RESULT: Momentum, trending moves, breakouts extend
- Behavior: Support/resistance WEAK, moves are FAST

**POSITIVE GEX (Long Gamma):**
- Dealers LONG gamma → hedge ANTI-DIRECTIONALLY
- Price ↓ → Dealers BUY → Creates support
- Price ↑ → Dealers SELL → Creates resistance
- RESULT: Mean reversion, range-bound, fades rallies/selloffs
- Behavior: Price gravitates to gamma magnet, moves are SLOW

**FLIP ZONE (GEX ≈ 0):**
- Transition point, balanced forces
- No directional bias until catalyst
- RESULT: Choppy, whipsaw, low conviction

---

### VEGA EXPOSURE (VEX) - Volatility & Speed

**HIGH VEX (Large Vega Exposure):**
- Dealers have LARGE volatility exposure
- Small price moves → BIG volatility reactions
- RESULT: Moves EXTEND, volatility EXPANDS rapidly
- Behavior: Trends persist, breakouts accelerate

**LOW VEX (Small Vega Exposure):**
- Dealers have SMALL volatility exposure
- Price moves → SMALL volatility reactions
- RESULT: Moves FADE, volatility COMPRESSES
- Behavior: Ranges tighten, rallies/selloffs lose steam

**VEX LOCATION MATTERS:**
- VEX concentrated ABOVE spot → Upside resistance (vol sells off on rallies)
- VEX concentrated BELOW spot → Downside support (vol compresses on dips)
- VEX concentrated AT spot → Gamma magnet (price gravitates here)

---

## GEX × VEX CONFLUENCE MATRIX (Core Predictive Grid)

Defines price regime based on hedging and volatility feedback loops:

**1. NEGATIVE GEX + HIGH VEX = 🚀 EXPLOSIVE MOMENTUM**
- Dealers short gamma AND high vega exposure
- Price moves → dealers hedge directionally → volatility explodes
- RESULT: Fast, violent moves with follow-through
- Prediction: Strong trends, breakouts extend 1-2%+ quickly
- Expected behavior: Breaks are fast and sustained

**2. NEGATIVE GEX + LOW VEX = ⚡ DIRECTIONAL BUT SLOWER**
- Dealers short gamma BUT low vega exposure
- Price moves → dealers hedge directionally → volatility muted
- RESULT: Trends form but at slower pace
- Prediction: Directional bias but measured moves (0.5-1%)
- Expected behavior: Grind in direction, not explosive

**3. POSITIVE GEX + HIGH VEX = 🌊 WHIPSAW / VOLATILITY COMPRESSION**
- Dealers long gamma BUT high vega exposure
- Price moves → dealers fade moves → volatility compresses violently
- RESULT: Sharp reversals, fake breakouts, range expansion then contraction
- Prediction: Chop with big swings that fade (false moves)
- Expected behavior: Mean reversion, stop hunts

**4. POSITIVE GEX + LOW VEX = 😴 TIGHT RANGE / COMPRESSION**
- Dealers long gamma AND low vega exposure
- Price moves → dealers fade moves → volatility stable/compressed
- RESULT: Tight ranges, mean reversion, low volatility
- Prediction: Small moves (< 0.3%), fade extremes
- Expected behavior: Oscillate in narrow range

---

## YOUR PREDICTION FRAMEWORK (Using GEX + VEX)

### Step 1: Identify GEX Regime
- Spot vs Flip Zone position
- GEX above vs below spot (magnitude matters!)
- Directional bias from GEX configuration

### Step 2: Identify VEX Configuration
- Where is VEX concentrated? (Above/below/at spot)
- What is the absolute VEX magnitude?
- Compare to typical levels for this ticker

### Step 3: Apply GEX × VEX Matrix
- Combine GEX regime + VEX level → predict behavior
- High VEX amplifies GEX effects (faster, bigger moves)
- Low VEX dampens GEX effects (slower, smaller moves)

### Step 4: Determine Velocity & Range
**GEX + VEX both HIGH:**
→ Explosive potential (1-2% moves in hours)

**GEX HIGH, VEX LOW:**
→ Directional but measured (0.5-1% moves)

**GEX LOW, VEX HIGH:**
→ Whipsaw, false breakouts (0.5-1% swings that reverse)

**GEX + VEX both LOW:**
→ Tight compression (< 0.3% range)

### Step 5: Identify Key Levels (GEX + VEX Combined)
- **GEX walls** = support/resistance from gamma
- **VEX clusters** = volatility explosion/compression zones
- **GEX + VEX overlap** = CRITICAL levels (strongest effect)
- **Flip zone** = decision point
- **Max pain** = end-of-week gravity

### Step 6: Generate Predictions

Provide THREE scenarios with specific price targets for:
- 15min (immediate tactical)
- 1h (short-term)
- 4h (intraday trend)
- 1day (daily outlook)

Each scenario must reference BOTH GEX and VEX mechanics.

---

## OUTPUT FORMAT (JSON)

{
  "ticker": "SPY",
  "timestamp": "2025-11-07T10:30:00Z",
  "spot": 671.72,
  "flip_zone": 670.00,
  
  "quickInsight": "2-3 sentences covering: GEX regime, VEX configuration, combined effect, and most likely outcome. Be specific and quantitative.",
  
  "current_regime": {
    "type": "Explosive Momentum / Directional / Whipsaw / Compression",
    "gex_type": "Negative / Positive / Mixed / Balanced",
    "gex_above": -699000,
    "gex_below": -458000,
    "gex_net": -1157000,
    "vex_type": "High / Medium / Low",
    "vex_above": 445000,
    "vex_below": 395000,
    "vex_at_spot": 200000,
    "vex_concentration": "Above Spot / Below Spot / At Spot / Dispersed",
    "confluence": "Explosive (Neg GEX + High VEX) / Directional (Neg GEX + Low VEX) / Whipsaw (Pos GEX + High VEX) / Compression (Pos GEX + Low VEX)",
    "bias": "Bullish / Bearish / Neutral",
    "velocity": "Very High / High / Medium / Low",
    "confidence": 0.75,
    "description": "4-5 sentences explaining: GEX regime, VEX configuration, how they work together, expected dealer behavior, and predicted price action. Reference specific numerical values."
  },
  
  "key_levels": {
    "strong_resistance": [680.00, 685.00],
    "weak_resistance": [675.00],
    "flip_zone": 670.00,
    "weak_support": [668.00],
    "strong_support": [665.00, 660.00],
    "gamma_magnet": 670.00,
    "vex_clusters": [678.00, 670.00, 665.00],
    "max_pain": 668.00
  },
  
  "predictions": {
    "base_case": {
      "probability": "55%",
      "direction": "Neutral / Bullish / Bearish",
      "target_15min": "670.00-672.00",
      "target_1h": "668.00-674.00",
      "target_4h": "665.00-678.00",
      "target_1day": "662.00-680.00",
      "rationale": "Explain using BOTH GEX and VEX with specific numerical references. Example: 'GEX above (-699K) combined with high VEX cluster at 678 creates strong resistance. Price likely to oscillate between 668 support (positive GEX +180K) and 674 resistance until catalyst appears. VEX at spot (200K) suggests moderate volatility, not explosive.'"
    },
    
    "bull_case": {
      "probability": "25%",
      "trigger": "Break above 674.00 with volume",
      "target_15min": "676.00",
      "target_1h": "678.00",
      "target_4h": "682.00",
      "target_1day": "685.00",
      "rationale": "Reference GEX + VEX interaction with numbers. Example: 'Break above 674 enters negative GEX zone (-699K) with high VEX (445K) at 678. Dealers will accelerate upside hedging while volatility expands. Expect fast move to 678 VEX cluster where resistance intensifies. If breaks 678, momentum extends to 682.'"
    },
    
    "bear_case": {
      "probability": "20%",
      "trigger": "Break below 668.00 with volume",
      "target_15min": "666.00",
      "target_1h": "664.00",
      "target_4h": "660.00",
      "target_1day": "658.00",
      "rationale": "Reference GEX + VEX interaction with numbers. Example: 'Break below 668 into negative GEX zone (-458K) with elevated VEX (395K) below. Dealers accelerate downside hedging. High VEX means fast move to 665 positive GEX support (+180K). If breaks 665, momentum extends to 660.'"
    }
  },
  
  "dealer_behavior": {
    "if_price_rises": "Explain dealer GEX hedging + VEX impact with specific levels. Example: 'Dealers will hedge by BUYING due to -699K GEX above. As price approaches 678 where VEX is 445K (high), volatility will expand creating resistance. Expect stalling or reversal as vol sellers appear.'",
    "if_price_falls": "Explain dealer GEX hedging + VEX impact with specific levels. Example: 'Dealers will hedge by SELLING due to -458K GEX below. VEX of 395K below is elevated, meaning move will be directional with expanding volatility. Support at 665 where positive GEX (+180K) creates buying pressure.'",
    "in_current_range": "Explain current GEX + VEX balance with numbers. Example: 'Near flip zone (670) with VEX of 200K at spot indicates balanced positioning. Neither bulls nor bears have advantage. Price will chop in 668-674 range until one side breaks with volume.'"
  },
  
  "volatility_forecast": {
    "direction": "Expansion / Compression / Stable",
    "expected_move_pct": 1.2,
    "expected_move_usd": 8.00,
    "gex_impact": "Negative GEX regime means volatility will expand on directional moves",
    "vex_impact": "High VEX clusters at 678 and 665 will amplify volatility reactions at those levels",
    "combined_effect": "Explosive volatility expansion if breaks above 674 or below 668. Compression if remains in 668-674 range.",
    "implied_vol_shift": "+3% on breakout, -2% if range-bound",
    "confidence": 0.78
  },
  
  "gex_vex_analysis": {
    "critical_zones": [
      {
        "level": 678.00,
        "gex": -250000,
        "gex_type": "Negative",
        "vex": 445000,
        "vex_type": "High",
        "prediction": "Strong resistance. Negative GEX means dealers hedge directionally, but high VEX creates volatility compression on approach. Expect sharp rejection or stall as vol sellers appear."
      },
      {
        "level": 670.00,
        "gex": 0,
        "gex_type": "Flip Zone",
        "vex": 200000,
        "vex_type": "Moderate",
        "prediction": "Balanced decision point. Dealers are neutral here. Moderate VEX means initial break won't be explosive but will build momentum. First direction to break determines trend."
      },
      {
        "level": 665.00,
        "gex": 180000,
        "gex_type": "Positive",
        "vex": 395000,
        "vex_type": "High",
        "prediction": "Strong support. Positive GEX means dealers buy dips aggressively. High VEX amplifies buying pressure on approach. Expect bounces or stabilization here."
      }
    ]
  },
  
  "summary": "2-3 sentence recap using GEX + VEX together with specific numbers. State regime type (from matrix), most likely scenario probability, key trigger levels with GEX/VEX values, and expected dealer response."
}

---

## CRITICAL RULES

1. **ALWAYS analyze GEX AND VEX together** - Never analyze one without the other
2. **Use the GEX × VEX Matrix** - Confluence determines behavior type
3. **Reference VEX clusters** - High VEX areas are critical volatility reaction zones
4. **Explain volatility impact** - VEX determines if moves extend or fade
5. **BE SPECIFIC** - Exact price levels with 2 decimals, exact GEX/VEX values
6. **SHOW MECHANICS** - Explain dealer hedging for both gamma and vega
7. **MAGNITUDE MATTERS** - Larger absolute GEX/VEX = stronger effects
8. **LOCATION MATTERS** - Where GEX/VEX sits relative to spot is crucial
9. **WEIGH BY MAGNITUDE** - The larger the absolute value of GEX/VEX, the stronger the predictive weight
10. **USE QUANTITATIVE LANGUAGE** - Avoid vague terms like "could" or "might", use "expect" or "predict" with numerical backing
11. **REFERENCE ACTUAL DATA** - Always cite the specific GEX/VEX values you're analyzing
12. **CONFIDENCE SCORING** - Assign numerical confidence (0-1) based on data quality and regime clarity

Your predictions must integrate GEX and VEX as a unified system, not separate metrics.
Every prediction must reference specific numerical values from the provided data.`;

/**
 * Generate AI price prediction from market data
 */
async function analyzeMarket(marketData) {
  try {
    const userPrompt = buildUserPrompt(marketData);

    console.log('🤖 Sending prediction request to OpenAI (gpt-4o)...');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6,
      max_tokens: 4000
    });

    const result = JSON.parse(response.choices[0].message.content);

    console.log('✅ Price prediction complete');
    console.log(`📊 Regime: ${result.current_regime?.type} | Bias: ${result.current_regime?.bias}`);
    console.log(`🎯 Base: ${result.predictions?.base_case?.probability} | Bull: ${result.predictions?.bull_case?.probability} | Bear: ${result.predictions?.bear_case?.probability}`);

    return result;

  } catch (error) {
    console.error('❌ OpenAI API Error:', error.message);

    if (error.code === 'insufficient_quota') {
      throw new Error('OpenAI API quota exceeded. Please check your billing.');
    }

    if (error.code === 'invalid_api_key') {
      throw new Error('Invalid OpenAI API key. Please check your .env file.');
    }

    throw new Error('Failed to generate price prediction. Please try again.');
  }
}

/**
 * Build comprehensive user prompt from market data (GEX + VEX integrated)
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
    ivSummary,
    vexData
  } = data;

  // Calculate GEX above and below spot
  const gexAbove = calculateGEXAbove(topWalls, spotPrice);
  const gexBelow = calculateGEXBelow(topWalls, spotPrice);
  const gexNet = gexAbove + gexBelow;

  // Calculate VEX metrics
  const vexMetrics = calculateVEXMetrics(vexData, spotPrice);

  // Format gamma walls with GEX + VEX
  const wallsText = topWalls
    .slice(0, 8)
    .map(w => {
      const vexAtStrike = getVEXAtStrike(vexData, w.strike);
      return `  - ${w.type} ${w.position} at $${formatPrice(w.strike)}: GEX ${w.formattedGEX} | VEX ${formatVEX(vexAtStrike)} (${w.strike > spotPrice ? 'ABOVE' : 'BELOW'} spot)`;
    })
    .join('\n');

  // Create GEX × VEX critical zones
  const criticalZones = identifyCriticalZones(topWalls, vexData, spotPrice);

  return `Predict price movement for ${ticker} based on the following gamma (GEX) and vega (VEX) exposure data.

╔═══════════════════════════════════════════════════════════════════
STRUCTURED DATA INPUT - ${ticker}
╚═══════════════════════════════════════════════════════════════════

CURRENT STATE:
- Ticker: ${ticker}
- Spot Price: $${formatPrice(spotPrice)}
- Current Gamma Zone: ${currentZone}
- GEX Flip Zone: $${formatPrice(flipZone)}
- Max Pain: $${formatPrice(maxPain)}
- Timestamp: ${new Date().toISOString()}

╔═══════════════════════════════════════════════════════════════════
GAMMA EXPOSURE (GEX) CONFIGURATION
╚═══════════════════════════════════════════════════════════════════

GEX METRICS:
- GEX ABOVE Spot ($${formatPrice(spotPrice)}): ${formatGEX(gexAbove)}
- GEX BELOW Spot ($${formatPrice(spotPrice)}): ${formatGEX(gexBelow)}
- Net GEX: ${formatGEX(gexNet)}
- GEX Regime: ${determineGEXRegime(gexAbove, gexBelow, spotPrice, flipZone)}

GAMMA ZONES (Dealer Hedging Behavior):
- PUT ZONE (Short Gamma): Below $${formatPrice(gammaZones.putZoneEnd)}
  → Dealers short gamma → momentum/acceleration regime
  → Price moves are AMPLIFIED by dealer hedging
  
- NO-TRADE ZONE (Neutral): $${formatPrice(gammaZones.noTradeZoneStart)} - $${formatPrice(gammaZones.noTradeZoneEnd)}
  → Dealers neutral → choppy/range-bound behavior
  → Minimal hedging pressure
  
- CALL ZONE (Long Gamma): Above $${formatPrice(gammaZones.callZoneStart)}
  → Dealers long gamma → mean-reversion regime
  → Price moves are DAMPENED by dealer hedging

╔═══════════════════════════════════════════════════════════════════
VEGA EXPOSURE (VEX) CONFIGURATION
╚═══════════════════════════════════════════════════════════════════

VEX METRICS:
- VEX ABOVE Spot: ${formatVEX(vexMetrics.vexAbove)}
- VEX BELOW Spot: ${formatVEX(vexMetrics.vexBelow)}
- VEX AT Spot (±2 strikes): ${formatVEX(vexMetrics.vexAtSpot)}
- VEX Concentration: ${vexMetrics.concentration}
- VEX Level: ${vexMetrics.level}

VEX INTERPRETATION:
- Total VEX: ${formatVEX(vexMetrics.totalVex)}
- Peak VEX Strike: $${formatPrice(vexMetrics.peakStrike)} (${formatVEX(vexMetrics.peakValue)})
- VEX Distribution: ${vexMetrics.distribution}

╔═══════════════════════════════════════════════════════════════════
GEX × VEX CRITICAL ZONES
╚═══════════════════════════════════════════════════════════════════

${criticalZones}

╔═══════════════════════════════════════════════════════════════════
GAMMA WALLS (Support/Resistance Levels)
╚═══════════════════════════════════════════════════════════════════

${wallsText}

╔═══════════════════════════════════════════════════════════════════
VOLATILITY CONTEXT
╚═══════════════════════════════════════════════════════════════════

- IV Summary: ${ivSummary || 'Moderate - no extreme volatility skew detected'}
- VEX Summary: ${vexSummary || 'See detailed VEX metrics above'}
- Expected Volatility Behavior: ${predictVolBehavior(gexAbove, gexBelow, vexMetrics)}

╔═══════════════════════════════════════════════════════════════════
PREDICTION TASK
╚═══════════════════════════════════════════════════════════════════

Using the GEX × VEX Matrix, predict price movement for:
- 15min (immediate tactical move)
- 1h (short-term directional bias)
- 4h (intraday trend)
- 1day (daily outlook)

ANALYSIS STEPS:
1. Determine GEX regime (spot vs flip, magnitude above/below)
2. Determine VEX configuration (concentration, level, clusters)
3. Apply GEX × VEX Matrix to identify regime type:
   - Explosive Momentum (Neg GEX + High VEX)
   - Directional (Neg GEX + Low VEX)
   - Whipsaw (Pos GEX + High VEX)
   - Compression (Pos GEX + Low VEX)
4. Identify key trigger levels where GEX + VEX overlap
5. Predict dealer hedging behavior at each level
6. Generate THREE scenarios (Base/Bull/Bear) with specific targets

REQUIREMENTS:
- Reference specific GEX and VEX values in your analysis
- Explain how GEX and VEX work together at each level
- Use the GEX × VEX Matrix to classify the regime
- Provide numerical price targets with 2 decimal precision
- Assign probabilities that sum to 100%
- Include confidence scores based on data clarity

Return complete JSON following your specified format.`;
}

/**
 * Calculate VEX metrics from heatmap data
 */
function calculateVEXMetrics(vexData, spotPrice) {
  if (!vexData || !vexData.strikes || vexData.strikes.length === 0) {
    return {
      vexAbove: 0,
      vexBelow: 0,
      vexAtSpot: 0,
      concentration: 'Unknown',
      level: 'Medium',
      totalVex: 0,
      peakStrike: spotPrice,
      peakValue: 0,
      distribution: 'Dispersed'
    };
  }

  const strikes = vexData.strikes;
  const vexValues = vexData.totalVex || [];

  // Calculate VEX above spot
  const vexAbove = strikes
    .map((strike, idx) => ({ strike, vex: vexValues[idx] || 0 }))
    .filter(item => item.strike > spotPrice)
    .reduce((sum, item) => sum + item.vex, 0);

  // Calculate VEX below spot
  const vexBelow = strikes
    .map((strike, idx) => ({ strike, vex: vexValues[idx] || 0 }))
    .filter(item => item.strike <= spotPrice)
    .reduce((sum, item) => sum + item.vex, 0);

  // Calculate VEX at spot (±2 strikes)
  const vexAtSpot = strikes
    .map((strike, idx) => ({ strike, vex: vexValues[idx] || 0 }))
    .filter(item => Math.abs(item.strike - spotPrice) <= 2)
    .reduce((sum, item) => sum + item.vex, 0);

  // Find peak VEX
  const maxVex = Math.max(...vexValues);
  const peakIdx = vexValues.indexOf(maxVex);
  const peakStrike = strikes[peakIdx] || spotPrice;

  // Total VEX
  const totalVex = vexValues.reduce((sum, v) => sum + v, 0);

  // Determine concentration
  let concentration = 'Dispersed';
  if (vexAbove > vexBelow * 1.5) {
    concentration = 'Above Spot';
  } else if (vexBelow > vexAbove * 1.5) {
    concentration = 'Below Spot';
  } else if (vexAtSpot > totalVex * 0.3) {
    concentration = 'At Spot';
  }

  // Determine level (relative to typical values)
  const avgVexPerStrike = totalVex / strikes.length;
  let level = 'Medium';
  if (avgVexPerStrike > 50000) {
    level = 'High';
  } else if (avgVexPerStrike < 20000) {
    level = 'Low';
  }

  // Determine distribution
  const topThreeVex = [...vexValues].sort((a, b) => b - a).slice(0, 3).reduce((sum, v) => sum + v, 0);
  const distribution = topThreeVex > totalVex * 0.6 ? 'Concentrated' : 'Dispersed';

  return {
    vexAbove,
    vexBelow,
    vexAtSpot,
    concentration,
    level,
    totalVex,
    peakStrike,
    peakValue: maxVex,
    distribution
  };
}

/**
 * Get VEX value at specific strike
 */
function getVEXAtStrike(vexData, strike) {
  if (!vexData || !vexData.strikes) return 0;
  
  const idx = vexData.strikes.findIndex(s => Math.abs(s - strike) < 0.5);
  if (idx === -1) return 0;
  
  return vexData.totalVex[idx] || 0;
}

/**
 * Identify critical zones where GEX + VEX overlap
 */
function identifyCriticalZones(walls, vexData, spotPrice) {
  if (!vexData || walls.length === 0) {
    return 'VEX data not available - analysis limited to GEX only';
  }

  const zones = walls.slice(0, 5).map(wall => {
    const vexAtStrike = getVEXAtStrike(vexData, wall.strike);
    const position = wall.strike > spotPrice ? 'ABOVE' : 'BELOW';
    const gexType = parseFloat(wall.gex) > 0 ? 'Positive' : 'Negative';
    const vexLevel = vexAtStrike > 300000 ? 'High' : vexAtStrike > 100000 ? 'Medium' : 'Low';
    
    // Determine regime from GEX × VEX matrix
    let regime = '';
    if (gexType === 'Negative' && vexLevel === 'High') {
      regime = 'Explosive Momentum Zone';
    } else if (gexType === 'Negative' && vexLevel !== 'High') {
      regime = 'Directional Zone';
    } else if (gexType === 'Positive' && vexLevel === 'High') {
      regime = 'Whipsaw/Compression Zone';
    } else {
      regime = 'Range Compression Zone';
    }

    return `
STRIKE $${formatPrice(wall.strike)} (${position} spot):
  - GEX: ${wall.formattedGEX} (${gexType})
  - VEX: ${formatVEX(vexAtStrike)} (${vexLevel})
  - Regime: ${regime}
  - Expected Behavior: ${predictBehaviorAtLevel(gexType, vexLevel, position)}`;
  }).join('\n');

  return zones;
}

/**
 * Predict behavior at a specific level based on GEX + VEX
 */
function predictBehaviorAtLevel(gexType, vexLevel, position) {
  if (gexType === 'Negative' && vexLevel === 'High') {
    return position === 'ABOVE' 
      ? 'Strong resistance - dealers hedge directionally + vol expands on approach'
      : 'Weak support - breaks accelerate with vol expansion';
  } else if (gexType === 'Negative') {
    return position === 'ABOVE'
      ? 'Moderate resistance - directional hedging without vol spike'
      : 'Weak support - breaks extend at moderate pace';
  } else if (gexType === 'Positive' && vexLevel === 'High') {
    return position === 'ABOVE'
      ? 'Fade zone - rallies get sold, vol compresses'
      : 'Strong support - dips get bought aggressively';
  } else {
    return position === 'ABOVE'
      ? 'Mild resistance - mean reversion in tight range'
      : 'Mild support - price gravitates here';
  }
}

/**
 * Predict volatility behavior based on GEX + VEX
 */
function predictVolBehavior(gexAbove, gexBelow, vexMetrics) {
  const gexRegime = (gexAbove < 0 && gexBelow < 0) ? 'Both Negative' :
                    (gexAbove > 0 && gexBelow > 0) ? 'Both Positive' : 'Mixed';
  const vexLevel = vexMetrics.level;

  if (gexRegime === 'Both Negative' && vexLevel === 'High') {
    return 'Explosive volatility expansion expected on directional moves';
  } else if (gexRegime === 'Both Negative') {
    return 'Moderate volatility expansion on directional moves';
  } else if (gexRegime === 'Both Positive' && vexLevel === 'High') {
    return 'Sharp volatility compression with whipsaw behavior';
  } else if (gexRegime === 'Both Positive') {
    return 'Gradual volatility compression in range-bound conditions';
  } else {
    return 'Mixed volatility regime - depends on direction of break';
  }
}

/**
 * Determine GEX regime description
 */
function determineGEXRegime(gexAbove, gexBelow, spotPrice, flipZone) {
  const distanceFromFlip = Math.abs(spotPrice - flipZone);
  
  if (distanceFromFlip < 2) {
    return 'Balanced at Flip Zone (neutral positioning)';
  } else if (spotPrice > flipZone && gexAbove < 0) {
    return 'Above Flip in Negative GEX (momentum regime - upside bias)';
  } else if (spotPrice < flipZone && gexBelow < 0) {
    return 'Below Flip in Negative GEX (momentum regime - downside bias)';
  } else if (spotPrice > flipZone && gexAbove > 0) {
    return 'Above Flip in Positive GEX (mean reversion regime)';
  } else if (spotPrice < flipZone && gexBelow > 0) {
    return 'Below Flip in Positive GEX (compression regime)';
  } else {
    return 'Mixed GEX configuration (analyze case-by-case)';
  }
}

/**
 * Calculate GEX above spot price
 */
function calculateGEXAbove(walls, spotPrice) {
  return walls
    .filter(w => w.strike > spotPrice)
    .reduce((sum, w) => sum + parseFloat(w.gex || 0), 0);
}

/**
 * Calculate GEX below spot price
 */
function calculateGEXBelow(walls, spotPrice) {
  return walls
    .filter(w => w.strike <= spotPrice)
    .reduce((sum, w) => sum + parseFloat(w.gex || 0), 0);
}

/**
 * Format GEX value with K/M suffix
 */
function formatGEX(gex) {
  if (Math.abs(gex) >= 1000000) {
    return `${(gex / 1000000).toFixed(2)}M`;
  } else if (Math.abs(gex) >= 1000) {
    return `${(gex / 1000).toFixed(0)}K`;
  }
  return gex.toFixed(0);
}

/**
 * Format VEX value with K suffix
 */
function formatVEX(vex) {
  if (Math.abs(vex) >= 1000) {
    return `${(vex / 1000).toFixed(1)}K`;
  }
  return vex.toFixed(0);
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