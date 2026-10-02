import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const RISK_PROMPT = `You are a senior CRE underwriting analyst performing step 11 (final red flag identification) of an 11-step institutional underwriting process. You are given the full underwriting workup for a multi-tenant retail property: extracted rent roll/T-12, steps 1-4 normalization analysis, and steps 5-10 valuation/sensitivity analysis.

Synthesize ALL of this into:
1. A list of red flags -- genuine underwriting risks requiring lender/investor attention (e.g., significant lease rollover during the hold period, tenant credit concerns, expense recovery ratio below 90%, RE tax reassessment risk, rent significantly below market, or any flags already noted in the data). Rate each flag's severity as 'high', 'medium', or 'low'.
2. A plain-English list of the key assumptions made throughout this underwriting (market rent estimates, cap rate, DCF inputs, CapEx reserve, rollover assumptions) so the broker knows exactly what to verify before relying on this analysis.

Be concise per item -- one to two sentences of detail each -- since this must fit within the response length available. Respond with STRICT, VALID JSON ONLY (no markdown, no commentary) matching exactly this schema:
{
  "red_flags": [ { "flag": string, "severity": "high"|"medium"|"low", "detail": string } ],
  "key_assumptions": [string],
  "overall_summary": string
}`;

export async function runRiskAgent(extraction, normalized, valuation, math) {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: `${RISK_PROMPT}\n\nExtraction:\n${JSON.stringify(extraction, null, 2)}\n\nNormalization:\n${JSON.stringify(normalized, null, 2)}\n\nValuation Assumptions:\n${JSON.stringify(valuation, null, 2)}\n\nValuation Math:\n${JSON.stringify(math, null, 2)}`
        }
      ]
    });

    const result = JSON.parse(response.content[0].text);
    return result;
  } catch (error) {
    console.error('Risk Agent error:', error);
    throw new Error(`Risk Agent failed: ${error.message}`);
  }
}
