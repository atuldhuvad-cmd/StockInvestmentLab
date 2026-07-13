#!/usr/bin/env node
/* ============================================================================
   Fundamentals — Executable Regression Suite
   ============================================================================
   Runs the ACTUAL production functions (latestRatios extracted verbatim from
   fundamentals.js, CompanyCalculations loaded directly from its real file —
   nothing reimplemented). Exits 0 if all tests pass, 1 if any fail, so this
   can be wired into a CI-style check later without modification.

   Run from the wealth-suite/ directory: node Fundamentals_regression_tests.js
============================================================================ */

const fs = require('fs');
const path = require('path');

const TOLERANCE = 0.0001; // acceptable float drift for "equal" comparisons — named per Phase 6 requirement

let passCount = 0, failCount = 0;
const results = [];

function assertClose(testId, label, actual, expected, tolerance = TOLERANCE) {
  const diff = Math.abs(actual - expected);
  const pass = diff <= tolerance;
  results.push({ testId, label, expected, actual, diff, pass });
  if (pass) passCount++; else failCount++;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${label}: expected=${expected}, actual=${actual}, diff=${diff}`);
  return pass;
}

function assertExact(testId, label, actual, expected) {
  const pass = actual === expected || (Number.isNaN(actual) && Number.isNaN(expected));
  results.push({ testId, label, expected, actual, diff: null, pass });
  if (pass) passCount++; else failCount++;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${label}: expected=${expected}, actual=${actual}`);
  return pass;
}

// ---- Load the real production code, not reimplementations ----
eval(fs.readFileSync(path.join(__dirname, 'js/data-model.js'), 'utf8') + '\nglobal.WealthData = WealthData;');
eval(fs.readFileSync(path.join(__dirname, 'js/company-calculations.js'), 'utf8') + '\nglobal.CompanyCalculations = CompanyCalculations;');

// FIN-D01–D04 fix (2026-07-12, Delivery Screener Phase 3) moved latestRatios()
// out of fundamentals.js and into the shared CompanyCalculations — this test
// now pulls it from its actual current location instead of string-extracting
// stale source that no longer contains the function definition.
const latestRatios = CompanyCalculations.latestRatios;

function makeYears(overrides) {
  const base = { revenue: 10000, ebit: 1500, netProfit: 1000, totalEquity: 5000, totalDebt: 1000,
    totalAssets: 8000, currentLiabilities: 1500, sharesOutstanding: 100, marketPrice: 200,
    operatingCashFlow: 900, capex: 300, promoterHolding: 50, pledgePct: 0 };
  return [2023, 2024, 2025, 2026].map((y, i) => ({ ...base, year: y, ...(overrides(i) || {}) }));
}

console.log("=== TC-F01: Normal case ===");
const r1 = latestRatios({ years: makeYears(i => ({ revenue: 10000 + i * 1000, netProfit: 1000 * (1 + i * 0.12) })) });
assertClose("TC-F01a", "ROE", r1.roe, 27.2);
assertClose("TC-F01b", "ROCE", r1.roce, 23.076923076923077);
assertExact("TC-F01c", "Debt/Equity", r1.debtEquity, 0.2);
assertClose("TC-F01d", "Revenue CAGR (13000/10000 over 3yr)", r1.revenueCagr, 9.139288306110593);

console.log("\n=== TC-F02: Zero totalEquity — must guard to null, not NaN/Infinity ===");
const r2 = latestRatios({ years: makeYears(i => (i === 3 ? { totalEquity: 0 } : {})) });
assertExact("TC-F02", "ROE with totalEquity=0", r2.roe, null);

console.log("\n=== TC-F03: FIXED — negative totalEquity now correctly guarded to null ===");
const r3 = latestRatios({ years: makeYears(i => (i === 3 ? { totalEquity: -2000, netProfit: 500 } : {})) });
assertExact("TC-F03", "ROE with totalEquity=-2000 (FUND-D01 fix: now null, was -25 before the fix)", r3.roe, null);

console.log("\n=== TC-F04: CONFIRMED DEFECT — FCF has zero missing-value guard ===");
const r4 = latestRatios({ years: makeYears(i => (i === 3 ? { operatingCashFlow: undefined } : {})) });
assertExact("TC-F04", "FCF with operatingCashFlow=undefined", r4.fcf, NaN);

console.log("\n=== TC-F05: FIXED — zero first-year revenue now correctly guarded to null ===");
const r5 = latestRatios({ years: makeYears(i => (i === 0 ? { revenue: 0 } : {})) });
assertExact("TC-F05", "Revenue CAGR with first-year revenue=0 (FUND-D02 fix: now null, was Infinity before the fix)", r5.revenueCagr, null);

console.log("\n=== TC-F06: FIXED — negative first-year revenue now correctly guarded to null ===");
const r6 = latestRatios({ years: makeYears(i => (i === 0 ? { revenue: -5000 } : {})) });
assertExact("TC-F06", "Revenue CAGR with first-year revenue=-5000 (FUND-D03 fix: now null, was NaN before the fix)", r6.revenueCagr, null);

console.log("\n=== TC-F07: PASS — P/E correctly guards against negative EPS (unlike other ratios) ===");
const r7 = latestRatios({ years: makeYears(i => (i === 3 ? { netProfit: -500 } : {})) });
assertExact("TC-F07a", "EPS with netProfit=-500 (no guard, shown as-is)", r7.eps, -5);
assertExact("TC-F07b", "P/E with negative EPS (correctly guarded)", r7.pe, null);

console.log("\n=== TC-F08: FIXED — qualityScore now excludes a missing sub-factor and renormalizes, instead of NaN-ing ===");
const q1 = CompanyCalculations.qualityScore({ economicMoat: 4, pricingPower: 3, capitalAllocation: 4, managementQuality: undefined, corporateGovernance: 5, promoterIntegrity: 4, auditorQuality: 5 });
assertClose("TC-F08", "qualityScore with managementQuality=undefined (FUND-D04 fix: renormalized average over the 6 present factors, was NaN before the fix)", q1, 500/6);

console.log("\n=== TC-F08b: qualityScore with ALL factors missing — must return null, not NaN ===");
const q2 = CompanyCalculations.qualityScore({});
assertExact("TC-F08b", "qualityScore with zero present factors", q2, null);

console.log("\n=== TC-F09: Large-value precision ===");
const r9 = latestRatios({ years: makeYears(i => ({ revenue: 1e12 * (1 + i * 0.05), netProfit: 1e11 })) });
assertExact("TC-F09", "ROE at trillion-scale revenue is finite and non-NaN", isFinite(r9.roe) && !isNaN(r9.roe), true);

console.log("\n=== TC-F10: Regression baseline — BAJFINANCE red flags against real seeded data ===");
eval(fs.readFileSync(path.join(__dirname, 'js/seed-data.js'), 'utf8') + '\nglobal.SEED_FUNDAMENTALS = SEED_FUNDAMENTALS;');
const bajajFlags = CompanyCalculations.detectRedFlags({ years: SEED_FUNDAMENTALS.BAJFINANCE.years, auditorLog: SEED_FUNDAMENTALS.BAJFINANCE.auditorLog });
assertExact("TC-F10", "BAJFINANCE red flag count (established baseline from prior session verification)", bajajFlags.length, 4);

console.log(`\n=== INTERIM SUMMARY (before Net Margin closure below): ${passCount} passed, ${failCount} failed ===`);

// ---- Added: closing the Net Margin gap flagged as NOT VERIFIED ----
console.log("\n=== TC-F11: Net Margin — now FIXED, same guard pattern as ROE (FUND-D01) ===");
const r11a = latestRatios({ years: makeYears(i => (i === 3 ? { revenue: 0 } : {})) });
assertExact("TC-F11a", "Net Margin with revenue=0 (guarded)", r11a.netMargin, null);
const r11b = latestRatios({ years: makeYears(i => (i === 3 ? { revenue: -1000, netProfit: 200 } : {})) });
assertExact("TC-F11b", "Net Margin with revenue=-1000 (FUND-D01 fix: now null, was -20 before the fix)", r11b.netMargin, null);

const totalTests = passCount + failCount;
console.log(`\n=== UPDATED SUMMARY: ${passCount} passed, ${failCount} failed (out of ${totalTests}) ===`);
process.exit(failCount > 0 ? 1 : 0);
