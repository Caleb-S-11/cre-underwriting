import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const TEMPLATE_MAPPING_PROMPT = `You are a spreadsheet-mapping assistant. You are given two things in the JSON input: 'template' -- a compact representation of a Google Sheets workbook: { sheets: [ { title, rows: [ { row, cells: [ { col, value } ] } ] } ] }, where 'row' and 'col' are 0-indexed grid positions and 'value' is that cell's current displayed text (only non-empty cells are included; a sparse row/cell means the rest of that row is blank) -- and 'deal' -- a fully computed commercial real estate underwriting analysis (rent roll, T-12, normalization steps 1-4, valuation steps 5-10, and risk/red-flags step 11).

Convert 0-indexed col numbers to spreadsheet letters yourself (0=A, 1=B, 2=C, ... 25=Z, 26=AA, etc.) and 0-indexed row numbers to 1-indexed row numbers (row 0 = spreadsheet row 1) when building A1 notation ranges.

Your job: figure out, from the template's existing labels and layout, where each piece of the underwriting data should be written, and produce a Google Sheets API batchUpdate request body that writes ONLY the data values -- never overwrite a cell that already contains a label/header. Write the corresponding VALUE into the cell immediately to the right of, or below, that label, following whichever pattern the surrounding cells in that template already establish.

This template may contain many sections that do not apply here (e.g. listing price, acquisition financing calculators, sales comparables) -- these have no corresponding data in 'deal' and should be left alone; do not invent values for them.

For the rent roll: if the template has a rent roll table with a header row (Tenant, SF, Rent, etc.), write one data row per tenant into the corresponding empty rows beneath that header, matching each column to the closest-meaning field in the deal data.

For single-value metrics (Stabilized NOI, Cap Rate, Investment Value, Total Income, Total Expenses, etc.), search the template for a label whose text reasonably matches that metric's meaning (labels may not match your exact schema names -- use your judgment) and place the value in the adjacent cell, typically under a 'Current' or 'Investment Value' column when both 'Listing' and 'Investment Value' columns exist, since this deal has no listing price.

If a piece of deal data has no reasonably matching label anywhere in the template, do NOT guess a location -- instead list it in the 'unmapped' array so the broker knows to add it manually. Keep each 'reason' and 'detail' short (under 15 words) since output length is limited.

Respond with STRICT, VALID JSON ONLY (no markdown, no commentary) matching exactly this schema:
{
  "valueInputOption": "USER_ENTERED",
  "data": [ { "range": string, "values": [[ string|number ]] } ],
  "unmapped": [ { "field": string, "value": string, "reason": string } ]
}`;

function initializeGoogleAuth() {
  let auth;

  // Try to use service account JSON from env var first
  const jsonString = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (jsonString) {
    try {
      const credentials = JSON.parse(jsonString);
      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/spreadsheets'
        ]
      });
      return auth;
    } catch (e) {
      console.warn('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON, trying file...');
    }
  }

  // Fall back to file path
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    auth = new google.auth.GoogleAuth({
      keyFile: credPath,
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/spreadsheets'
      ]
    });
    return auth;
  }

  throw new Error('No Google credentials found. Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.');
}

async function copyTemplate(templateFileId, dealName) {
  const auth = initializeGoogleAuth();
  const drive = google.drive({ version: 'v3', auth });

  const response = await drive.files.copy({
    fileId: templateFileId,
    requestBody: {
      name: `${dealName} - Underwriting Analysis`
    }
  });

  return response.data.id;
}

async function readTemplateStructure(spreadsheetId) {
  const auth = initializeGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title,sheets.properties.sheetId,sheets.data.rowData.values.formattedValue'
  });

  // Compress into sparse format
  const compressed = {
    sheets: []
  };

  for (const sheet of response.data.sheets || []) {
    const sheetData = {
      title: sheet.properties.title,
      rows: []
    };

    if (sheet.data && sheet.data[0] && sheet.data[0].rowData) {
      for (let row = 0; row < sheet.data[0].rowData.length; row++) {
        const rowData = sheet.data[0].rowData[row];
        const cells = [];

        if (rowData.values) {
          for (let col = 0; col < rowData.values.length; col++) {
            const cellValue = rowData.values[col];
            if (cellValue && cellValue.formattedValue) {
              cells.push({
                col,
                value: cellValue.formattedValue
              });
            }
          }
        }

        if (cells.length > 0) {
          sheetData.rows.push({ row, cells });
        }
      }
    }

    compressed.sheets.push(sheetData);
  }

  return compressed;
}

async function mapDataToTemplate(template, dealData) {
  const dealDataForMapping = {
    rent_roll: dealData.extraction.rent_roll,
    t12_total_income: dealData.extraction.t12.total_income,
    t12_total_expenses: dealData.extraction.t12.total_expenses,
    t12_noi: dealData.extraction.t12.noi,
    stabilized_noi: dealData.math.stabilizedNOI,
    cap_rate_pct: dealData.valuation.step7_cap_rate.going_in_cap_rate_pct,
    direct_cap_value: dealData.math.directCapValue,
    dcf_value: dealData.math.dcfValue,
    recovery_ratio_pct: dealData.normalized.step3_cam_rebuild.recovery_ratio_pct,
    red_flags: dealData.risk.red_flags
  };

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 16000,
    messages: [
      {
        role: 'user',
        content: `${TEMPLATE_MAPPING_PROMPT}\n\nTemplate Structure:\n${JSON.stringify(template, null, 2)}\n\nDeal Data:\n${JSON.stringify(dealDataForMapping, null, 2)}`
      }
    ]
  });

  return JSON.parse(response.content[0].text);
}

function colIndexToLetter(index) {
  let letter = '';
  while (index >= 0) {
    letter = String.fromCharCode(65 + (index % 26)) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
}

async function writeToSheet(spreadsheetId, batchUpdateRequest) {
  const auth = initializeGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: batchUpdateRequest.valueInputOption,
      data: batchUpdateRequest.data
    }
  });
}

export async function copyAndMapTemplate(dealData) {
  try {
    const templateFileId = process.env.GOOGLE_TEMPLATE_FILE_ID;
    if (!templateFileId) {
      throw new Error('GOOGLE_TEMPLATE_FILE_ID not set');
    }

    // Copy template
    console.log('Copying template...');
    const newSheetId = await copyTemplate(templateFileId, dealData.dealName);

    // Read template structure
    console.log('Reading template structure...');
    const template = await readTemplateStructure(newSheetId);

    // Map deal data to template
    console.log('Mapping deal data to template...');
    const mapping = await mapDataToTemplate(template, dealData);

    // Write to sheet
    console.log('Writing data to sheet...');
    await writeToSheet(newSheetId, mapping);

    // Build sheet URL
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${newSheetId}/edit`;

    return {
      sheetUrl,
      unmapped: mapping.unmapped || []
    };
  } catch (error) {
    console.error('Sheets write error:', error);
    throw new Error(`Failed to write to Google Sheets: ${error.message}`);
  }
}
