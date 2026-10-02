import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const VALUATION_PROMPT = `You are a senior CRE underwriting analyst performing steps 5, 7, and 8 of an 11-step institutional underwriting process on a multi-tenant retail property. You are given the deal's extracted rent roll/T-12 data and the normalization analysis from steps 1-4 (lease abstracts, tenant credit notes, T-12 adjustments, CAM recovery ratio, CapEx reserve).

You do NOT have access to live market comp data (no CoStar/Artemis feed connected). Provide reasoned, defensible assumptions based on general institutional underwriting practice for a multi-tenant retail asset, and be explicit these are estimates requiring verification against real comps before reliance.

Perform:
STEP 5 - Market rent / mark-to-market: Compare each tenant's in-place base rent PSF to an estimated current market rent PSF for a similar retail suite. Note whether below, at, or above market.
STEP 7 (assumptions) - Direct cap: Recommend a market-appropriate going-in cap rate (%) for this asset type, with a one-paragraph rationale referencing tenant credit quality and lease term.
STEP 8 (assumptions) - DCF with rollover: Recommend a holding period in years (typically 10), annual market rent growth rate (%), discount rate/IRR target (%), exit cap rate (%, typically 25-50bps above going-in), and rollover assumptions for any lease expiring during the hold period (downtime months, leasing costs as % of one year's rent, renewal probability %).

Respond with STRICT, VALID JSON ONLY (no markdown, no commentary) matching exactly this schema:
{
  "step5_market_rent": { "by_tenant": [ { "tenant": string, "in_place_psf": number, "market_psf_estimate": number, "position": "below market"|"at market"|"above market" } ], "notes": string },
  "step7_cap_rate": { "going_in_cap_rate_pct": number, "rationale": string },
  "step8_dcf_assumptions": { "hold_period_years": number, "rent_growth_rate_pct": number, "discount_rate_pct": number, "exit_cap_rate_pct": number, "rollover": [ { "tenant": string, "lease_end": string, "downtime_months": number, "leasing_costs_pct_of_annual_rent": number, "renewal_probability_pct": number } ] },
  "assumptions_disclaimer": string
}
Use numbers (not strings) for all numeric values.`;

export async function runValuationAgent(extraction, normalized) {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `${VALUATION_PROMPT}\n\nExtracted Data:\n${JSON.stringify(extraction, null, 2)}\n\nNormalization Analysis:\n${JSON.stringify(normalized, null, 2)}`
        }
      ]
    });

    const result = JSON.parse(response.content[0].text);
    return result;
  } catch (error) {
    console.error('Valuation Agent error:', error);
    throw new Error(`Valuation Agent failed: ${error.message}`);
  }
}
