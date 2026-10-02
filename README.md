# CRE Underwriting Agent

Commercial Real Estate Underwriting Pipeline built with Node.js + Express

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   Copy `.env.example` to `.env` and fill in:
   - `ANTHROPIC_API_KEY` - from console.anthropic.com
   - `GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_SERVICE_ACCOUNT_JSON` - Google Cloud Service Account
   - `GOOGLE_TEMPLATE_FILE_ID` - Your Google Sheets template file ID
   - `PORT` - Server port (default: 3000)

3. **Get Google Service Account**
   - Go to Google Cloud Console
   - Create Service Account
   - Generate JSON key
   - Share your template Google Sheet with the service account email
   - Grant scopes: `https://www.googleapis.com/auth/drive` and `https://www.googleapis.com/auth/spreadsheets`

4. **Run locally**
   ```bash
   npm run dev
   ```

## API Endpoints

### POST /api/underwrite
Intake endpoint for underwriting a deal.

**Request:** multipart/form-data
- `files[]` - One or more PDFs or images (JPG/PNG/GIF/WEBP)
- `dealName` - Deal name (required)
- `email` - Contact email (optional)

**Response:**
```json
{
  "success": true,
  "dealName": "...",
  "email": "...",
  "duration_ms": 45000,
  "sheetUrl": "https://docs.google.com/spreadsheets/d/...",
  "steps": {
    "extraction": { ... },
    "normalized": { ... },
    "valuation": { ... },
    "math": { ... },
    "risk": { ... }
  },
  "unmapped": [ ... ],
  "log": [ ... ]
}
```

## Pipeline Stages

1. **Validate & Classify** - Check file types/sizes
2. **Strip Metadata** - Remove ICC profiles, EXIF, XMP from images
3. **Extract** - Claude vision/document API extracts rent rolls and T-12s
4. **Merge** - Combine multi-file extractions, run sanity checks
5. **Normalization Agent** - Steps 1-4: rent roll, T-12, CAM, CapEx analysis
6. **Valuation Agent** - Steps 5, 7, 8: market rent, cap rate, DCF assumptions
7. **Valuation Math** - Steps 6-10: deterministic DCF, sensitivity tables
8. **Risk Agent** - Step 11: red flags and key assumptions
9. **Sheets Write** - Copy template, map data, write to Google Sheets

## Testing

Use curl or Postman to test:

```bash
curl -X POST http://localhost:3000/api/underwrite \
  -F "files=@rent_roll.pdf" \
  -F "files=@t12.jpg" \
  -F "dealName=Fort Worth Retail" \
  -F "email=user@example.com"
```

## Deployment to Railway

1. Push to GitHub
2. Connect repo to Railway
3. Set environment variables in Railway dashboard
4. Deploy

## Known Limitations (MVP Phase)

- No multi-user auth (uses single Service Account)
- No deal history/persistence
- No email delivery (returns sheet link in API response)
- No frontend UI (API-only, test via curl/Postman)
