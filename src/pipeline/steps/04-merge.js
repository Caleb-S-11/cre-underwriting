export function mergeExtractions(extractions) {
  const merged = {
    rent_roll: [],
    t12: {
      line_items: [],
      total_income: null,
      total_expenses: null,
      noi: null
    }
  };

  const flags = [];
  const seenRentRollRows = new Set();
  const seenT12Items = new Set();

  // Merge rent rolls (dedupe by tenant + suite)
  for (const extraction of extractions) {
    if (extraction.rent_roll && Array.isArray(extraction.rent_roll)) {
      for (const row of extraction.rent_roll) {
        const key = `${row.tenant}|${row.suite}`;
        if (!seenRentRollRows.has(key)) {
          seenRentRollRows.add(key);
          merged.rent_roll.push(row);
        }
      }
    }
  }

  // Merge T-12 line items (dedupe by category + name)
  for (const extraction of extractions) {
    if (extraction.t12 && extraction.t12.line_items) {
      for (const item of extraction.t12.line_items) {
        const key = `${item.category}|${item.name}`;
        if (!seenT12Items.has(key)) {
          seenT12Items.add(key);
          merged.t12.line_items.push(item);
        }
      }
    }
  }

  // Use first non-null value for totals
  for (const extraction of extractions) {
    if (extraction.t12) {
      if (merged.t12.total_income === null && extraction.t12.total_income !== null) {
        merged.t12.total_income = extraction.t12.total_income;
      }
      if (merged.t12.total_expenses === null && extraction.t12.total_expenses !== null) {
        merged.t12.total_expenses = extraction.t12.total_expenses;
      }
      if (merged.t12.noi === null && extraction.t12.noi !== null) {
        merged.t12.noi = extraction.t12.noi;
      }
    }
  }

  // Sanity checks
  if (merged.rent_roll.length === 0) {
    flags.push('WARN: Rent roll is empty');
  }

  // Check PSF values
  for (const row of merged.rent_roll) {
    if (!row.base_rent_psf && row.square_feet && row.base_rent_annual) {
      row.base_rent_psf = row.base_rent_annual / row.square_feet;
    }

    if (row.base_rent_psf) {
      if (row.base_rent_psf < 3 || row.base_rent_psf > 250) {
        flags.push(`WARN: ${row.tenant} PSF ${row.base_rent_psf} outside normal range ($3-$250)`);
      }
    }

    if (row.square_feet && row.square_feet <= 0) {
      flags.push(`WARN: ${row.tenant} has invalid square_feet: ${row.square_feet}`);
    }
  }

  // Check NOI math
  if (merged.t12.total_income && merged.t12.total_expenses && merged.t12.noi) {
    const calculated = merged.t12.total_income - merged.t12.total_expenses;
    const diff = Math.abs(calculated - merged.t12.noi);
    const tolerance = Math.max(1, Math.abs(merged.t12.noi) * 0.02);

    if (diff > tolerance) {
      flags.push(`WARN: NOI mismatch - reported ${merged.t12.noi} but income minus expenses = ${calculated} (>2% variance)`);
    }
  }

  return {
    extraction: merged,
    needs_review: flags.length > 0,
    flags
  };
}
