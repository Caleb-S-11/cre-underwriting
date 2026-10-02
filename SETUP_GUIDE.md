# Detailed Setup & Testing Guide

## Phase 1: Prerequisites (Do This First)

### Step 1: Install Node.js
1. Go to https://nodejs.org
2. Click "LTS" (Long Term Support) - currently v20 or v22
3. Download the installer for macOS
4. Run the installer and follow prompts
5. Verify installation:
   ```bash
   node --version
   npm --version
   ```
   You should see version numbers (e.g., v20.10.0, 10.2.5)

### Step 2: Install Anthropic API Key
1. Go to https://console.anthropic.com
2. Sign in with your account
3. Go to "API Keys" section
4. Click "Create Key"
5. Copy the key (starts with `sk-ant-`)
6. Save it somewhere safe — you'll need it in Step 3

### Step 3: Set Up Google Cloud Service Account
This is required to write to Google Sheets.

**Part A: Create Service Account**
1. Go to https://console.cloud.google.com
2. Create a new project (top-left, click project dropdown)
3. Name it "CRE Underwriting" (or similar)
4. Wait for it to create
5. Search for "Service Accounts" in the search bar
6. Click "Service Accounts"
7. Click "Create Service Account"
8. Name: `cre-underwriting-agent`
9. Click "Create and Continue"
10. On next screen, click "Create Key"
11. Choose JSON format
12. Click "Create" — a JSON file downloads to your computer
13. Save this file somewhere safe (you'll need it in Step 4)

**Part B: Share Your Template Sheet**
1. Open the Google Sheet you want to use as your template
2. Click "Share" (top right)
3. In Google Cloud console, go back to Service Accounts
4. Click the service account you just created
5. Copy the email address (looks like `cre-underwriting-agent@project-id.iam.gserviceaccount.com`)
6. Back in Google Sheets, paste that email in the share dialog
7. Give it "Editor" access
8. Click "Share"

### Step 4: Configure .env File
1. Open the project folder in Terminal/Finder
2. In the project root, find `.env.example`
3. Right-click → Duplicate
4. Rename the copy to `.env` (remove `.example`)
5. Open `.env` in a text editor (VS Code, TextEdit, etc.)
6. Fill in the values:

   ```
   ANTHROPIC_API_KEY=sk-ant-<paste your key from Step 2>
   
   GOOGLE_SERVICE_ACCOUNT_JSON=<paste entire contents of JSON file from Step 3, Part A>
   
   GOOGLE_TEMPLATE_FILE_ID=<your Google Sheet's ID from the URL>
   
   PORT=3000
   NODE_ENV=development
   ```

   **How to find GOOGLE_TEMPLATE_FILE_ID:**
   - Open your Google Sheet
   - Look at the URL: `https://docs.google.com/spreadsheets/d/1abc2def3ghi4jkl5mno6/edit#gid=0`
   - Copy the part between `/d/` and `/edit` (the long alphanumeric string)
   - Paste it as `GOOGLE_TEMPLATE_FILE_ID`

7. Save `.env` file

---

## Phase 2: Local Installation & Testing

### Step 5: Install Dependencies
1. Open Terminal
2. Navigate to project folder:
   ```bash
   cd /Users/calebsmith/Library/Application\ Support/Claude/scratch-workspaces/6cb42ad0-2ef4-4153-a230-f1201ed5e86b/aa408b16-2588-46ff-a3f2-c98dbf30842d/scratch-2026-10-02-dc38e7
   ```
3. Install npm packages:
   ```bash
   npm install
   ```
   This takes 1-2 minutes. You'll see lots of output. Wait for it to finish.

### Step 6: Start the Dev Server
1. In the same Terminal, run:
   ```bash
   npm run dev
   ```
2. You should see:
   ```
   CRE Underwriting Agent running on port 3000
   POST /api/underwrite - Start underwriting process
   GET /health - Health check
   ```
   If you see this, the server is running ✓

### Step 7: Test Health Endpoint
1. Open a **new** Terminal tab (keep the first one running)
2. Test the health check:
   ```bash
   curl http://localhost:3000/health
   ```
3. You should see:
   ```json
   {"status":"ok","timestamp":"2026-10-02T..."}
   ```

---

## Phase 3: Test with Real Deal Documents

### Step 8: Prepare Test Files
1. Use your Fort Worth deal documents (the ones that validated in n8n):
   - Rent roll (PDF or image)
   - T-12 statement (PDF or image)
2. Place them in your Downloads folder for easy access

### Step 9: Run Full Pipeline
1. In Terminal (the extra tab), run this curl command:
   ```bash
   curl -X POST http://localhost:3000/api/underwrite \
     -F "files=@/Users/calebsmith/Downloads/rent_roll.pdf" \
     -F "files=@/Users/calebsmith/Downloads/t12.jpg" \
     -F "dealName=Fort Worth Retail" \
     -F "email=your@email.com"
   ```
   
   Replace:
   - `/Users/calebsmith/Downloads/rent_roll.pdf` with your rent roll file path
   - `/Users/calebsmith/Downloads/t12.jpg` with your T-12 file path
   - `Fort Worth Retail` with the deal name
   - `your@email.com` with an email

2. Wait 30-60 seconds for the pipeline to run
3. You should get back a JSON response with:
   ```json
   {
     "success": true,
     "dealName": "Fort Worth Retail",
     "sheetUrl": "https://docs.google.com/spreadsheets/d/...",
     "steps": { ... },
     "log": [...]
   }
   ```

### Step 10: Verify Google Sheet Was Updated
1. Click the `sheetUrl` from the response (or search your Google Drive for the new sheet)
2. Check that:
   - Rent roll data was populated
   - T-12 totals were filled in
   - Stabilized NOI, cap rate, and valuation metrics are there
3. If anything is missing or wrong, check the `unmapped` array in the response

---

## Phase 4: Prepare for Deployment

### Step 11: Push to GitHub
1. Create a new GitHub repository (empty, no README)
2. In Terminal:
   ```bash
   git remote add origin https://github.com/yourusername/cre-underwriting.git
   git branch -M main
   git push -u origin main
   ```

### Step 12: Deploy to Railway
1. Go to https://railway.app
2. Sign up (connect GitHub account)
3. Create new project → Deploy from GitHub repo
4. Select your `cre-underwriting` repo
5. Railway auto-detects Node.js + creates a deploy
6. Go to project settings → Variables
7. Add environment variables (copy from your local `.env`):
   - `ANTHROPIC_API_KEY`
   - `GOOGLE_SERVICE_ACCOUNT_JSON` (full JSON)
   - `GOOGLE_TEMPLATE_FILE_ID`
   - `PORT=3000` (Railway sets this, but explicit is fine)
8. Deploy — Railway builds and runs automatically
9. Copy the Railway URL (e.g., `https://cre-underwriting-prod.up.railway.app`)

### Step 13: Test Production
1. Replace `http://localhost:3000` with your Railway URL
2. Run the curl test again:
   ```bash
   curl -X POST https://cre-underwriting-prod.up.railway.app/api/underwrite \
     -F "files=@..." -F "dealName=..." -F "email=..."
   ```

---

## Troubleshooting

### "npm: command not found"
- Node.js not installed → Go back to Step 1

### "ANTHROPIC_API_KEY not set"
- Check `.env` file exists in project root
- Check it's named `.env` (not `.env.example`)
- Check the key is filled in (not blank)

### "No Google credentials found"
- Check `.env` has `GOOGLE_SERVICE_ACCOUNT_JSON` filled in
- Make sure the entire JSON is there (multi-line is ok)

### "Service Account not authorized"
- Go to your Google Sheet
- Click Share
- Add the service account email as Editor
- Wait 30 seconds for permissions to sync

### "Could not process image"
- This is the ICC profile bug from the spec
- Make sure images are being passed (not just PDFs)
- Try re-exporting the image without embedded color profile

### Claude API timeouts
- Check `ANTHROPIC_API_KEY` is correct
- Make sure you have API credits at console.anthropic.com
- Images over 5MB or PDFs over 20MB will fail validation

---

## Success Checklist

- [ ] Node.js installed and verified
- [ ] Anthropic API key obtained
- [ ] Google Service Account created and JSON downloaded
- [ ] Google Sheet shared with service account
- [ ] `.env` file created and filled in
- [ ] `npm install` completed
- [ ] Dev server starts with `npm run dev`
- [ ] Health check returns `{"status":"ok"}`
- [ ] Full pipeline runs with test documents
- [ ] Google Sheet was populated with underwriting data
- [ ] Repo pushed to GitHub
- [ ] Deployed to Railway
- [ ] Production test passed

Once all ✓, you have a working CRE underwriting pipeline ready for users.
