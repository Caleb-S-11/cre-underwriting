export function runValuationMath(extraction, normalized, valuation) {
  const totalIncome = extraction.t12.total_income || 0;
  const totalExpenses = extraction.t12.total_expenses || 0;
  const adjustedExpenses = normalized.step2_t12_adjustment.adjusted_total_expenses || totalExpenses;
  const capexReserve = normalized.step4_capex_reserve.reserve_annual_total || 0;
  const capRate = valuation.step7_cap_rate.going_in_cap_rate_pct || 6.5;
  const holdPeriodYears = valuation.step8_dcf_assumptions.hold_period_years || 10;
  const rentGrowthRate = valuation.step8_dcf_assumptions.rent_growth_rate_pct || 2.5;
  const discountRate = valuation.step8_dcf_assumptions.discount_rate_pct || 8.0;
  const exitCapRate = valuation.step8_dcf_assumptions.exit_cap_rate_pct || capRate + 0.5;

  // STEP 6: Stabilized NOI
  const stabilizedNOI = totalIncome - adjustedExpenses - capexReserve;

  // STEP 7: Direct cap value
  const directCapValue = stabilizedNOI / (capRate / 100);

  // STEP 8: DCF calculation
  const dcfCashFlows = [];
  for (let year = 1; year <= holdPeriodYears; year++) {
    const cf = stabilizedNOI * Math.pow(1 + rentGrowthRate / 100, year - 1);
    const pv = cf / Math.pow(1 + discountRate / 100, year);
    dcfCashFlows.push({ year, cf, pv });
  }
  const sumPV = dcfCashFlows.reduce((sum, cf) => sum + cf.pv, 0);

  // Exit value: final year CF grown one more year, divided by exit cap rate, discounted back
  const exitCF = stabilizedNOI * Math.pow(1 + rentGrowthRate / 100, holdPeriodYears);
  const exitValue = exitCF / (exitCapRate / 100);
  const discountedExitValue = exitValue / Math.pow(1 + discountRate / 100, holdPeriodYears);

  const dcfValue = sumPV + discountedExitValue;

  // STEP 9: Debt/financing sensitivity (60%, 65%, 70% LTV)
  const ltvScenarios = [60, 65, 70];
  const debtSensitivity = [];
  const baseValue = directCapValue;
  const interestRate = 6.5; // 6.5% assumed rate
  const amortizationYears = 25;

  for (const ltv of ltvScenarios) {
    const loanAmount = baseValue * (ltv / 100);
    const monthlyRate = interestRate / 100 / 12;
    const months = amortizationYears * 12;
    const monthlyPayment =
      loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, months)) /
      (Math.pow(1 + monthlyRate, months) - 1);
    const annualDebtService = monthlyPayment * 12;
    const dscr = stabilizedNOI / annualDebtService;
    const equity = baseValue - loanAmount;
    const cashOnCash = ((stabilizedNOI - annualDebtService) / equity) * 100;

    debtSensitivity.push({
      ltv_pct: ltv,
      loan_amount: Math.round(loanAmount),
      annual_debt_service: Math.round(annualDebtService),
      dscr: Math.round(dscr * 100) / 100,
      equity: Math.round(equity),
      cash_on_cash_pct: Math.round(cashOnCash * 100) / 100
    });
  }

  // STEP 10: Sensitivity tables
  // Cap rate sensitivity
  const capRateSensitivity = [];
  const capRateOffsets = [-0.5, -0.25, 0, 0.25, 0.5];
  for (const offset of capRateOffsets) {
    const rate = capRate + offset;
    const value = stabilizedNOI / (rate / 100);
    capRateSensitivity.push({
      cap_rate_pct: Math.round((rate + Number.EPSILON) * 100) / 100,
      implied_value: Math.round(value)
    });
  }

  // NOI sensitivity
  const noiSensitivity = [];
  const noiOffsets = [-0.05, -0.025, 0, 0.025, 0.05];
  for (const offset of noiOffsets) {
    const adjustedNoi = stabilizedNOI * (1 + offset);
    const value = adjustedNoi / (capRate / 100);
    noiSensitivity.push({
      noi_variance_pct: Math.round(offset * 100),
      adjusted_noi: Math.round(adjustedNoi),
      implied_value: Math.round(value)
    });
  }

  return {
    step6_stabilized_noi: Math.round(stabilizedNOI),
    step7_direct_cap_value: Math.round(directCapValue),
    step8_dcf_value: Math.round(dcfValue),
    step9_debt_sensitivity: debtSensitivity,
    step10_sensitivity: {
      cap_rate_table: capRateSensitivity,
      noi_table: noiSensitivity
    },
    // For reference
    stabilizedNOI: Math.round(stabilizedNOI),
    directCapValue: Math.round(directCapValue),
    dcfValue: Math.round(dcfValue)
  };
}
