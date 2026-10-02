import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const EXTRACTION_PROMPT = `You are a commercial real estate underwriting analyst.
The attached document is a RENT ROLL and/or T-12 (trailing 12-month operating statement) for a single property, possibly spanning multiple pages within this one PDF or across multiple images.
Extract and MERGE all data across every page into one combined result. Do not duplicate rows that appear on more than one page.
Respond with STRICT, VALID JSON ONLY (no markdown, no code fences, no commentary) matching exactly this schema:
{
  "rent_roll": [
    {
      "tenant": string,
      "suite": string,
      "square_feet": number,
      "base_rent_annual": number,
      "base_rent_psf": number,
      "lease_start": string (YYYY-MM-DD or null),
      "lease_end": string (YYYY-MM-DD or null),
      "escalations": string,
      "expense_recovery_type": string (e.g. NNN, Gross, Modified Gross)
    }
  ],
  "t12": {
    "line_items": [ { "category": "income" | "expense", "name": string, "amount": number } ],
    "total_income": number,
    "total_expenses": number,
    "noi": number
  },
  "meta": { "pages_detected": number, "notes": string }
}
Use numbers (not strings) for all monetary and area values; strip currency symbols and thousands separators. If a value is not present in the document, use null. Do not invent data.`;

export async function extractData(cleaned) {
  const { images, pdfs } = cleaned;
  const extractions = [];

  // Extract from PDFs
  for (const pdf of pdfs) {
    try {
      const base64Pdf = pdf.buffer.toString('base64');
      const response = await client.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: EXTRACTION_PROMPT
              },
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: base64Pdf
                }
              }
            ]
          }
        ]
      });

      const extracted = JSON.parse(response.content[0].text);
      extractions.push({
        source: pdf.originalname,
        type: 'pdf',
        ...extracted
      });
    } catch (error) {
      console.error(`PDF extraction failed for ${pdf.originalname}:`, error);
      throw new Error(`Failed to extract from PDF ${pdf.originalname}: ${error.message}`);
    }
  }

  // Extract from images
  for (const img of images) {
    try {
      const base64Image = img.buffer.toString('base64');
      const response = await client.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: EXTRACTION_PROMPT
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: img.mimetype,
                  data: base64Image
                }
              }
            ]
          }
        ]
      });

      const extracted = JSON.parse(response.content[0].text);
      extractions.push({
        source: img.originalname,
        type: 'image',
        ...extracted
      });
    } catch (error) {
      console.error(`Image extraction failed for ${img.originalname}:`, error);
      throw new Error(`Failed to extract from image ${img.originalname}: ${error.message}`);
    }
  }

  return extractions;
}
