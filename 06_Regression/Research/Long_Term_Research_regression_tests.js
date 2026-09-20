#!/usr/bin/env node
/* Long-Term Research Phase 1 regression tests. All fixtures are synthetic. */
const fs = require("fs");
const path = require("path");

let passed = 0;
let failed = 0;
function equal(label, actual, expected) {
  const ok = Object.is(actual, expected);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
  if (ok) passed++; else { failed++; console.log(`    expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`); }
}
function deepEqual(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
  if (ok) passed++; else { failed++; console.log(`    expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`); }
}
function throws(label, fn) {
  let ok = false;
  try { fn(); } catch (_) { ok = true; }
  equal(label, ok, true);
}

const root = path.resolve(__dirname, "..", "..", "01_Source", "wealth-suite");
eval(fs.readFileSync(path.join(root, "js", "data-model.js"), "utf8") + "\nglobal.WealthData = WealthData;");
eval(fs.readFileSync(path.join(root, "js", "research-system-core.js"), "utf8") + "\nglobal.ResearchSystemCore = ResearchSystemCore;");

console.log("=== Persistent company and universe membership ===");
const company = ResearchSystemCore.normalizeCompany({ symbol: " synco ", companyName: "Synthetic Company", isin: "TEST00000001", sector: "Industrials" });
equal("symbol is normalized", company.symbol, "SYNCO");
equal("ISIN provides stable company identity", company.companyId, "TEST00000001");
WealthData.upsertCompany(company.companyId, company);
WealthData.upsertResearchUniverse("NIFTY50", { name: "Synthetic Nifty 50 fixture", provider: "Test" });
const activeMembership = ResearchSystemCore.normalizeMembership({
  id: "MEM-1", universeId: "NIFTY50", companyId: company.companyId, symbol: company.symbol,
  status: "ACTIVE", effectiveDate: "2026-01-01", entryDate: "2026-01-01",
  sourceId: "SRC-INDEX-1", retrievedAt: "2026-01-02T00:00:00Z"
});
WealthData.addIndexMembership(activeMembership);
WealthData.addIndexMembership(ResearchSystemCore.normalizeMembership({ ...activeMembership, id: "MEM-2", status: "INACTIVE", effectiveDate: "2026-06-30", exitDate: "2026-06-30" }));
equal("company persists after exit record", WealthData.getCompany(company.companyId).companyName, "Synthetic Company");
equal("membership history preserves both events", WealthData.getIndexMembershipHistory().length, 2);
throws("invalid membership status is rejected", () => ResearchSystemCore.normalizeMembership({ ...activeMembership, status: "CURRENT" }));

console.log("\n=== Source provenance and evidence discipline ===");
const source = ResearchSystemCore.buildSourceRecord({
  sourceId: "SRC-AR-1", companyId: company.companyId, symbol: company.symbol,
  sourceType: "ANNUAL_REPORT", organization: "Synthetic Company",
  documentTitle: "Synthetic Annual Report", url: "https://example.invalid/annual-report",
  publicationDate: "2026-04-01", reportingPeriod: "FY2026",
  retrievedAt: "2026-04-02T00:00:00Z", sourceStatus: "AVAILABLE"
});
WealthData.addSourceRecord(source);
equal("source is stored by source id", WealthData.getSourceRegistry()[0].sourceId, "SRC-AR-1");
const fact = ResearchSystemCore.buildEvidenceRecord({
  evidenceId: "EV-1", companyId: company.companyId, claim: "Synthetic revenue was 120",
  classification: "FACT", sourceId: source.sourceId, createdAt: "2026-04-02T01:00:00Z"
});
WealthData.addResearchEvidence(fact);
equal("FACT retains source link", WealthData.getResearchEvidence()[0].sourceId, source.sourceId);
throws("FACT without a source is rejected", () => ResearchSystemCore.buildEvidenceRecord({ evidenceId: "EV-X", claim: "Unsupported", classification: "FACT", createdAt: "2026-01-01T00:00:00Z" }));
throws("unknown classification is rejected", () => ResearchSystemCore.buildEvidenceRecord({ evidenceId: "EV-X", claim: "Unsupported", classification: "OPINION", createdAt: "2026-01-01T00:00:00Z" }));
const calculation = ResearchSystemCore.buildEvidenceRecord({
  evidenceId: "EV-2", claim: "Synthetic growth was 20%", classification: "CALCULATION",
  calculationLogic: "(120 - 100) / 100 * 100", sourceEvidenceIds: ["EV-1"], createdAt: "2026-04-02T01:05:00Z"
});
equal("CALCULATION retains formula", calculation.calculationLogic, "(120 - 100) / 100 * 100");
throws("CALCULATION without inputs is rejected", () => ResearchSystemCore.buildEvidenceRecord({ evidenceId: "EV-X", claim: "20%", classification: "CALCULATION", calculationLogic: "x/y", createdAt: "2026-01-01T00:00:00Z" }));
const restricted = ResearchSystemCore.buildSourceRecord({
  sourceId: "SRC-R", sourceType: "OTHER", organization: "Synthetic Source",
  documentTitle: "Restricted fixture", url: "https://example.invalid/restricted",
  retrievedAt: "2026-04-01T00:00:00Z", sourceStatus: "SOURCE_ACCESS_RESTRICTED"
});
equal("restricted source status is explicit", restricted.sourceStatus, "SOURCE_ACCESS_RESTRICTED");

console.log("\n=== Freshness ===");
equal("restricted source maps to SOURCE_RESTRICTED", ResearchSystemCore.freshnessStatus(restricted, "2026-04-03T00:00:00Z", { currentDays: 2, recentDays: 7 }), "SOURCE_RESTRICTED");
equal("two-day-old record is CURRENT", ResearchSystemCore.freshnessStatus(source, "2026-04-04T00:00:00Z", { currentDays: 2, recentDays: 7 }), "CURRENT");
equal("five-day-old record is RECENT", ResearchSystemCore.freshnessStatus(source, "2026-04-07T00:00:00Z", { currentDays: 2, recentDays: 7 }), "RECENT");
equal("older record is STALE", ResearchSystemCore.freshnessStatus(source, "2026-04-20T00:00:00Z", { currentDays: 2, recentDays: 7 }), "STALE");
equal("missing timestamp is UNKNOWN", ResearchSystemCore.freshnessStatus({}, "2026-04-20T00:00:00Z", { currentDays: 2, recentDays: 7 }), "UNKNOWN");

console.log("\n=== Financial and valuation arithmetic ===");
equal("safe division rejects zero denominator", ResearchSystemCore.safeDivide(10, 0), null);
equal("YoY growth", ResearchSystemCore.percentChange(120, 100), 20);
equal("two-year CAGR", Math.round(ResearchSystemCore.cagr(121, 100, 2) * 100) / 100, 10);
const kpis = ResearchSystemCore.calculateCoreKpis({
  revenue: 120, previousRevenue: 100, ebitda: 30, ebit: 24, pat: 18,
  operatingCashFlow: 22, capex: 7, sharesOutstanding: 9, totalDebt: 25,
  cash: 10, interestExpense: 4, currentAssets: 50, currentLiabilities: 35,
  marketPrice: 30
});
equal("EBITDA margin", kpis.ebitdaMargin, 25);
equal("EPS", kpis.eps, 2);
equal("free cash flow", kpis.freeCashFlow, 15);
equal("net debt", kpis.netDebt, 15);
equal("net debt to EBITDA", kpis.netDebtToEbitda, 0.5);
equal("interest coverage", kpis.interestCoverage, 6);
equal("working capital", kpis.workingCapital, 15);
equal("P/E", kpis.priceToEarnings, 15);
const missingKpis = ResearchSystemCore.calculateCoreKpis({ revenue: 120 });
equal("missing inputs do not fabricate EPS", missingKpis.eps, null);
equal("missing inputs do not fabricate FCF", missingKpis.freeCashFlow, null);

console.log("\n=== Objective guidance comparison ===");
equal("above tolerance is BEAT", ResearchSystemCore.compareGuidance(111, 100, 5).result, "BEAT");
equal("inside tolerance is MEET", ResearchSystemCore.compareGuidance(103, 100, 5).result, "MEET");
equal("below tolerance is MISS", ResearchSystemCore.compareGuidance(90, 100, 5).result, "MISS");
equal("missing guidance is UNKNOWN", ResearchSystemCore.compareGuidance(100, null, 5).result, "UNKNOWN");

console.log("\n=== Scenario arithmetic ===");
const scenario = ResearchSystemCore.calculateScenario({ baseRevenue: 1000, revenueGrowthPct: 10, marginPct: 12, valuationMultiple: 20, sharesOutstanding: 100 });
equal("projected revenue", scenario.projectedRevenue, 1100);
equal("projected earnings", scenario.projectedEarnings, 132);
equal("implied equity value", scenario.impliedEquityValue, 2640);
equal("implied value per share", scenario.impliedValuePerShare, 26.4);
deepEqual("incomplete scenario stays unknown", ResearchSystemCore.calculateScenario({ baseRevenue: 1000 }), {
  projectedRevenue: null, projectedEarnings: null, impliedEquityValue: null, impliedValuePerShare: null
});

console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed (out of ${passed + failed}) ===`);
process.exit(failed ? 1 : 0);
