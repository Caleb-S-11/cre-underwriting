import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const NORMALIZATION_PROMPT = `You are a senior commercial real estate underwriting analyst performing steps 1-4 of an 11-step institutional underwriting process on a multi-tenant retail property. You are given a JSON object with 'rent_roll' (array of tenant lease records) and 't12' (trailing 12-month income/expense line items).

Perform:
STEP 1 - Rent roll normalization: For each rent roll row, output a normalized record. Include a lease abstract (one-sentence plain-English summary of key terms) and a tenant credit review note (based on tenant name alone, note if it's a recognizable national/regional credit tenant vs local/unknown, and any risk implied by lease term length remaining).
STEP 2 - T-12 adjustment: Identify likely one-time or non-recurring expense line items (if any) that should be excluded from a stabilized run-rate. Note if real estate taxes look like they may need reassessment upon sale (a common issue in states without assessment caps on change of ownership). Note this concern generically unless the state is evident from the data.
STEP 3 - CAM reimbursement rebuild: Calculate the recovery ratio (total reimbursements received divided by total recoverable expenses: CAM + RE Taxes + Insurance) as a percentage. Note if there's an administrative/management fee grossed onto CAM and whether it appears standard (10-15% is typical) or unusual.
STEP 4 - CapEx & reserve schedule: Since no engineering/PCA report data was provided, estimate a standard reserve for replacement based on typical retail underwriting practice (commonly $0.10-$0.25 per square foot per year for a well-maintained multi-tenant retail asset), and flag this explicitly as an assumption requiring verification, not a measured figure.

Respond with STRICT, VALID JSON ONLY (no markdown, no commentary) matching exactly this schema:
{
  "step1_rent_roll_normalized": [ { "tenant": string, "suite": string, "lease_abstract": string, "tenant_credit_note": string } ],
  "step2_t12_adjustment": { "adjusted_total_expenses": number, "excluded_items": [string], "re_tax_reassessment_note": string },
  "step3_cam_rebuild": { "recovery_ratio_pct": number, "admin_fee_note": string },
  "step4_capex_reserve": { "reserve_psf_annual": number, "reserve_annual_total": number, "assumption_note": string }
}
Use numbers (not strings) for all numeric values. Base every number on the provided data; do not invent figures beyond the explicitly-flagged CapEx reserve assumption.`;

export async function runNormalizationAgent(extraction) {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `${NORMALIZATION_PROMPT}\n\nData:\n${JSON.stringify(extraction, null, 2)}`
        }
      ]
    });

    const result = JSON.parse(response.content[0].text);
    return result;
  } catch (error) {
    console.error('Normalization Agent error:', error);
    throw new Error(`Normalization Agent failed: ${error.message}`);
  }
}
