import { validateAndClassifyUploads } from './steps/01-validate.js';
import { stripImageMetadata } from './steps/02-strip-metadata.js';
import { extractData } from './steps/03-extract.js';
import { mergeExtractions } from './steps/04-merge.js';
import { runNormalizationAgent } from './steps/05-normalization.js';
import { runValuationAgent } from './steps/06-valuation-agent.js';
import { runValuationMath } from './steps/07-valuation-math.js';
import { runRiskAgent } from './steps/08-risk.js';
import { copyAndMapTemplate } from './steps/09-sheets-write.js';

export async function runUnderwritingPipeline(input) {
  const { files, dealName, email } = input;
  const startTime = Date.now();
  const log = [];

  try {
    // Step 1: Validate & classify uploads
    log.push('STEP 1: Validating and classifying uploads...');
    const classified = validateAndClassifyUploads(files);
    log.push(`  ✓ Classified: ${classified.images.length} images, ${classified.pdfs.length} PDFs`);

    // Step 2: Strip metadata from images
    log.push('STEP 2: Stripping image metadata...');
    const cleaned = await stripImageMetadata(classified);
    log.push(`  ✓ Cleaned ${cleaned.images.length} images`);

    // Step 3: Extract structured data via Claude
    log.push('STEP 3: Extracting data via Claude vision/document analysis...');
    const extractions = await extractData(cleaned);
    log.push(`  ✓ Extracted from ${extractions.length} file(s)`);

    // Step 4: Merge extractions + sanity check
    log.push('STEP 4: Merging extractions and running sanity checks...');
    const merged = mergeExtractions(extractions);
    log.push(`  ✓ Merged: ${merged.extraction.rent_roll.length} tenant rows, NOI $${merged.extraction.t12.noi?.toLocaleString() || 'unknown'}`);
    if (merged.flags.length > 0) {
      log.push(`  ⚠ Flags: ${merged.flags.join('; ')}`);
    }

    // Step 5: Normalization Agent
    log.push('STEP 5: Running Normalization Agent (steps 1-4)...');
    const normalized = await runNormalizationAgent(merged.extraction);
    log.push(`  ✓ Normalized rent roll, CAM recovery ${normalized.step3_cam_rebuild.recovery_ratio_pct?.toFixed(1)}%`);

    // Step 6: Valuation Agent (assumptions only)
    log.push('STEP 6: Running Valuation Agent (steps 5, 7, 8 assumptions)...');
    const valuation = await runValuationAgent(merged.extraction, normalized);
    log.push(`  ✓ Cap rate: ${valuation.step7_cap_rate.going_in_cap_rate_pct}%`);

    // Step 7: Valuation Math (deterministic)
    log.push('STEP 7: Running Valuation Math (steps 6-10)...');
    const math = runValuationMath(merged.extraction, normalized, valuation);
    log.push(`  ✓ Stabilized NOI: $${math.stabilizedNOI?.toLocaleString()}, Direct Cap Value: $${math.directCapValue?.toLocaleString()}`);

    // Step 8: Risk Agent
    log.push('STEP 8: Running Risk Agent (step 11)...');
    const risk = await runRiskAgent(merged.extraction, normalized, valuation, math);
    log.push(`  ✓ Identified ${risk.red_flags.length} red flag(s)`);

    // Step 9: Copy & map template to Google Sheets
    log.push('STEP 9: Copying template and mapping data to Google Sheets...');
    const sheetResult = await copyAndMapTemplate({
      extraction: merged.extraction,
      normalized,
      valuation,
      math,
      risk,
      dealName,
      email
    });
    log.push(`  ✓ Sheet link: ${sheetResult.sheetUrl}`);

    const duration = Date.now() - startTime;

    return {
      success: true,
      dealName,
      email,
      duration_ms: duration,
      steps: {
        extraction: merged.extraction,
        normalized,
        valuation,
        math,
        risk
      },
      sheetUrl: sheetResult.sheetUrl,
      unmapped: sheetResult.unmapped,
      log
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    log.push(`✗ ERROR: ${error.message}`);

    return {
      success: false,
      dealName,
      email,
      duration_ms: duration,
      error: error.message,
      stack: error.stack,
      log
    };
  }
}
