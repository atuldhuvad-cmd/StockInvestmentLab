const fs = require('fs');
const path = require('path');
const assert = require('assert');
// PROJ-D01b fix (2026-07-23): resolve source relative to this file, not cwd,
// so the suite runs from any working directory (was cwd-relative 'js/...').
const suiteRoot = path.resolve(__dirname, '..', '..', '01_Source', 'wealth-suite');
eval(fs.readFileSync(path.join(suiteRoot, 'js/data-model.js'), 'utf8') + '\nglobal.WealthData = WealthData;');
global.document = {};
eval(fs.readFileSync(path.join(suiteRoot, 'js/company-calculations.js'), 'utf8') + '\nglobal.CompanyCalculations = CompanyCalculations;');
eval(fs.readFileSync(path.join(suiteRoot, 'js/modules/portfolio.js'), 'utf8') + '\nglobal.PortfolioModule = PortfolioModule;');

function testCase(id, holding, security, expected) {
  if (security) WealthData.upsertSecurity(holding.ticker, security);
  const row = PortfolioModule.computeRow(holding);
  console.log(`\n${id}:`);
  console.log(`  Input: ${JSON.stringify(holding)}`);
  console.log(`  Expected: ${JSON.stringify(expected)}`);
  console.log(`  Actual:   currentValue=${row.currentValue}, investedValue=${row.investedValue}, gainAbs=${row.gainAbs}, gainPct=${row.gainPct}`);
  const matches = Object.keys(expected).every(k => Math.abs(row[k] - expected[k]) < 0.0001);
  console.log(`  ${matches ? "PASS" : "FAIL"}`);
  assert.ok(matches, `${id} calculation mismatch`);
  return { id, row, matches };
}

// TC-001: Normal case
testCase("TC-001 Normal case", 
  { ticker: "TCS", quantity: 50, avgCost: 3850, currentPrice: 4120, assetClass: "Equity" },
  null,
  { currentValue: 206000, investedValue: 192500, gainAbs: 13500, gainPct: 7.012987012987013 });

// TC-002: Zero gain (price = cost)
testCase("TC-002 Zero gain boundary",
  { ticker: "TEST1", quantity: 10, avgCost: 100, currentPrice: 100, assetClass: "Equity" },
  null,
  { currentValue: 1000, investedValue: 1000, gainAbs: 0, gainPct: 0 });

// TC-003: Loss case
testCase("TC-003 Loss (negative gain)",
  { ticker: "TEST2", quantity: 20, avgCost: 500, currentPrice: 400, assetClass: "Equity" },
  null,
  { currentValue: 8000, investedValue: 10000, gainAbs: -2000, gainPct: -20 });

// TC-004: Missing currentPrice (null) - fallback rule
testCase("TC-004 Null currentPrice (fallback to avgCost)",
  { ticker: "TEST3", quantity: 15, avgCost: 250, currentPrice: null, assetClass: "Equity" },
  null,
  { currentValue: 3750, investedValue: 3750, gainAbs: 0, gainPct: 0 });

// TC-005: Zero quantity
testCase("TC-005 Zero quantity",
  { ticker: "TEST4", quantity: 0, avgCost: 100, currentPrice: 150, assetClass: "Equity" },
  null,
  { currentValue: 0, investedValue: 0, gainAbs: 0, gainPct: 0 });

// TC-006: Negative quantity (undefined/short scenario - testing actual behavior)
console.log("\nTC-006 Negative quantity (short-position-like input, NOT an intended use case):");
const tc6 = PortfolioModule.computeRow({ ticker: "TEST5", quantity: -10, avgCost: 100, currentPrice: 120, assetClass: "Equity" });
console.log(`  Result: currentValue=${tc6.currentValue}, investedValue=${tc6.investedValue}, gainAbs=${tc6.gainAbs}, gainPct=${tc6.gainPct}`);
console.log(`  NOTE: gainPct shows ${tc6.gainPct}% for a rising price on negative quantity - mathematically the formula produces a POSITIVE gainPct here even though price rose, because gain and invested are both negative and cancel sign. This would be WRONG if interpreted as a short position (price rising against a short should show a LOSS). Formula assumes long-only positions.`);

// TC-007: Very large values
testCase("TC-007 Large value (floating point / precision)",
  { ticker: "TEST6", quantity: 1000000, avgCost: 5000, currentPrice: 5100, assetClass: "Equity" },
  null,
  { currentValue: 5100000000, investedValue: 5000000000, gainAbs: 100000000, gainPct: 2 });

// TC-008: Floating point sensitivity
testCase("TC-008 Floating point precision",
  { ticker: "TEST7", quantity: 3, avgCost: 333.33, currentPrice: 333.34, assetClass: "Equity" },
  null,
  { currentValue: 1000.02, investedValue: 999.99, gainAbs: 0.03, gainPct: 0.003000030000300003 });

console.log("\n=== computeSummary tests ===");
WealthData.get().holdings = [];
WealthData.addHolding({ ticker: "A", quantity: 10, avgCost: 100, currentPrice: 110, assetClass: "Equity" });
WealthData.addHolding({ ticker: "B", quantity: 5, avgCost: 200, currentPrice: 180, assetClass: "Gold" });
WealthData.upsertSecurity("A", { sector: "IT" });
WealthData.upsertSecurity("B", { sector: "Banking" });
const rows = WealthData.getHoldings().map(PortfolioModule.computeRow);
const summary = PortfolioModule.computeSummary(rows);
console.log("Holdings: A(qty10,cost100,cur110,IT), B(qty5,cost200,cur180,Banking,Gold class)");
console.log(`  totalValue: ${summary.totalValue} (expect 1100+900=2000)`);
console.log(`  totalInvested: ${summary.totalInvested} (expect 1000+1000=2000)`);
console.log(`  totalGain: ${summary.totalGain} (expect 0)`);
console.log(`  bySector: ${JSON.stringify(summary.bySector)} (expect {IT:1100, Banking:900})`);
console.log(`  byAssetClass: ${JSON.stringify(summary.byAssetClass)} (expect {Equity:1100, Gold:900})`);
console.log(`  ${summary.totalValue===2000 && summary.totalInvested===2000 && summary.totalGain===0 && summary.bySector.IT===1100 && summary.bySector.Banking===900 && summary.byAssetClass.Equity===1100 && summary.byAssetClass.Gold===900 ? "PASS" : "FAIL"}`);
assert.strictEqual(summary.totalValue, 2000);
assert.strictEqual(summary.totalInvested, 2000);
assert.strictEqual(summary.totalGain, 0);
assert.deepStrictEqual(summary.bySector, { IT: 1100, Banking: 900 });
assert.deepStrictEqual(summary.byAssetClass, { Equity: 1100, Gold: 900 });

console.log("\n=== evaluateFundamentalHealth & buildFundamentalRiskSummary tests ===");

const MOCK_HOLDINGS = [
  { ticker: "MISSING_STK", active: true, quantity: 10 },
  { ticker: "PARTIAL_STK", active: true, quantity: 10 },
  { ticker: "STALE_STK", active: true, quantity: 10 },
  { ticker: "ELIGIBLE_NO_FLAGS", active: true, quantity: 10 },
  { ticker: "ELIGIBLE_RED_FLAGS", active: true, quantity: 10 },
  { ticker: "INACTIVE_STK", active: false, quantity: 10 }
];

const now = new Date();
const oldDate = new Date();
oldDate.setDate(now.getDate() - 600); // Stale > 550 days

const MOCK_FUNDAMENTALS = {
  "PARTIAL_STK": { ticker: "PARTIAL_STK", manualRatios: { roe: 10 } },
  "STALE_STK": {
    ticker: "STALE_STK",
    manualRatios: { roe: 15, debtEquity: 0.5, pe: 20, revenueCagr: 10 },
    qualitative: { economicMoat: 4, pricingPower: 4 },
    evidence: { sourceName: "Annual Report", evidenceDate: oldDate.toISOString().split("T")[0], status: "Verified" }
  },
  "ELIGIBLE_NO_FLAGS": {
    ticker: "ELIGIBLE_NO_FLAGS",
    manualRatios: { roe: 15, debtEquity: 0.5, pe: 20, revenueCagr: 10 },
    qualitative: { economicMoat: 4, pricingPower: 4 },
    evidence: { sourceName: "Annual Report", evidenceDate: now.toISOString().split("T")[0], status: "Verified" },
    years: [
      { year: 2023, netProfit: 100, operatingCashFlow: 120, totalDebt: 50 },
      { year: 2024, netProfit: 110, operatingCashFlow: 130, totalDebt: 45 }
    ]
  },
  "ELIGIBLE_RED_FLAGS": {
    ticker: "ELIGIBLE_RED_FLAGS",
    manualRatios: { roe: 15, debtEquity: 0.5, pe: 20, revenueCagr: 10 },
    qualitative: { economicMoat: 4, pricingPower: 4 },
    evidence: { sourceName: "Annual Report", evidenceDate: now.toISOString().split("T")[0], status: "Verified" },
    years: [
      { year: 2023, netProfit: 100, operatingCashFlow: 80, totalDebt: 50 }, // Missing FCF flag condition etc
      { year: 2024, netProfit: 110, operatingCashFlow: 70, totalDebt: 100 } // Rising debt, poor FCF
    ]
  }
};

const risks = PortfolioModule.buildFundamentalRiskSummary(MOCK_HOLDINGS, MOCK_FUNDAMENTALS);

function assertRisk(ticker, expectedSeverity, expectedStatus, expectsFlags) {
  const risk = risks.find(r => r.holding.ticker === ticker);
  if (expectedSeverity === "healthy") {
    console.log(`  ${ticker} (healthy): ${risk === undefined ? "PASS" : "FAIL (found risk)"}`);
    assert.strictEqual(risk, undefined, `${ticker} should not appear in risk summary`);
    return;
  }
  assert.ok(risk, `${ticker} risk not found`);
  const matchSeverity = risk.health.severity === expectedSeverity;
  const matchStatus = risk.health.status === expectedStatus;
  const matchFlags = (risk.health.flags.length > 0) === expectsFlags;
  console.log(`  ${ticker}: ${matchSeverity && matchStatus && matchFlags ? "PASS" : "FAIL"} (sev=${risk.health.severity} status='${risk.health.status}' flags=${risk.health.flags.length})`);
  assert.strictEqual(risk.health.severity, expectedSeverity);
  assert.strictEqual(risk.health.status, expectedStatus);
  assert.strictEqual(risk.health.flags.length > 0, expectsFlags);
}

assertRisk("MISSING_STK", "amber", "Missing", false);
assertRisk("PARTIAL_STK", "amber", "Partial", false);
assertRisk("STALE_STK", "amber", "Stale", false);
assertRisk("ELIGIBLE_NO_FLAGS", "healthy", "Eligible for Full Rating", false);
assertRisk("ELIGIBLE_RED_FLAGS", "red", "Eligible for Full Rating", true);

const inactiveRisk = risks.find(r => r.holding.ticker === "INACTIVE_STK");
console.log(`  INACTIVE_STK excluded: ${inactiveRisk === undefined ? "PASS" : "FAIL"}`);
assert.strictEqual(inactiveRisk, undefined);

const missingHealth = PortfolioModule.evaluateFundamentalHealth({ ticker: "MISSING_STK" }, undefined);
assert.ok(missingHealth.missing.includes("ROE"), "Missing record should expose coverage requirements");

const malformedYearsHealth = PortfolioModule.evaluateFundamentalHealth(
  { ticker: "MALFORMED" },
  { manualRatios: { roe: 1 }, years: "not-an-array" }
);
assert.strictEqual(malformedYearsHealth.flags.length, 0, "Malformed years must not crash or fabricate flags");

const lowercaseRisks = PortfolioModule.buildFundamentalRiskSummary(
  [{ ticker: "stale_stk", active: true }],
  MOCK_FUNDAMENTALS
);
assert.strictEqual(lowercaseRisks[0].health.status, "Stale", "Ticker lookup should be case-insensitive");

assert.strictEqual(
  PortfolioModule.escapeHtml(`<img src=x onerror='alert(1)'>`),
  "&lt;img src=x onerror=&#39;alert(1)&#39;&gt;"
);

console.log("\n=== Zero Risk Aggregation Test ===");
const zeroRisks = PortfolioModule.buildFundamentalRiskSummary(
  [{ ticker: "ELIGIBLE_NO_FLAGS", active: true, quantity: 10 }],
  MOCK_FUNDAMENTALS
);
console.log(`  Zero Risk Aggregation: ${zeroRisks.length === 0 ? "PASS" : "FAIL (expected 0 risks)"}`);
assert.strictEqual(zeroRisks.length, 0);
