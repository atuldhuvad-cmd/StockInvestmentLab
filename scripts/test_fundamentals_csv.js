const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

// 1. Setup VM Context to mimic Browser Global Environment
const context = vm.createContext({
  console: console,
  NIFTY_500_TICKERS: ["DIXON", "TCS", "INFY"],
  document: {
    createElement: () => ({ setAttribute: () => {}, click: () => {} }),
    body: { appendChild: () => {}, removeChild: () => {} }
  },
  WealthData: {
    getSecurity: (t) => ["DIXON", "TCS", "INFY"].includes(t) ? { displayName: t, sector: "Nifty 500" } : undefined,
    getFundamentals: (t) => mockFundamentals[t],
    upsertFundamentals: (t, data) => mockFundamentals[t] = data,
    upsertSecurity: () => {}
  },
  App: {
    saveNow: async () => {},
    showStatus: () => {}
  }
});

let mockFundamentals = {};

// Load Source Files
const sourceDir = path.join(__dirname, '..', '01_Source', 'wealth-suite', 'js');
const compCalcCode = fs.readFileSync(path.join(sourceDir, 'company-calculations.js'), 'utf8');
const csvCode = fs.readFileSync(path.join(sourceDir, 'modules', 'fundamentals-csv.js'), 'utf8');
const fundamentalsUiCode = fs.readFileSync(path.join(sourceDir, 'modules', 'fundamentals.js'), 'utf8');

// Execute in VM
vm.runInContext(compCalcCode, context);
vm.runInContext(csvCode, context);

const { CompanyCalculations, FundamentalsCsv, WealthData } = context;

function runTests() {
  console.log("Running Fundamentals CSV Regression Tests...");
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      mockFundamentals = {}; // reset db
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`[FAIL] ${name}\n  ${e.stack || e.message}`);
    }
  }

  // --- Parser Tests ---
  test("Parser: Column counts, multiline and quotes", () => {
    const csv = `Ticker,Period,ROE_Pct,ROCE_Pct,Debt_Equity,PE_Ratio,Rev_CAGR_Pct,Earn_CAGR_Pct,Promoter_Hold_Pct,Promoter_Pledge_Pct,FCF_Status,Econ_Moat,Pricing_Power,Cap_Allocation,Mgmt_Quality,Source_Name,Source_URL,Evidence_Date,Review_Status
DIXON,FY26,15.5,20.0,0.5,30,12,15,55.5,0,Positive,3,3,4,4,"Annual, Report",http://example.com,2026-01-01,Verified`;

    const res = FundamentalsCsv._testExports.parseCsvString(csv);
    assert.ok(!res.error, "Valid CSV should parse: " + res.error);
    assert.strictEqual(res.rows[0].Source_Name, "Annual, Report", "Should handle quoted commas");

    const multiline = csv.replace('"Annual, Report"', '"Annual,\nReport"');
    const multilineResult = FundamentalsCsv._testExports.parseCsvString(multiline);
    assert.strictEqual(multilineResult.rows[0].Source_Name, "Annual,\nReport", "Should preserve quoted newlines");

    const unterminated = FundamentalsCsv._testExports.parseCsvString(csv.replace('"Annual, Report"', '"Annual Report'));
    assert.ok(unterminated.error.includes("unterminated quotes"), "Should reject unterminated quoted fields");

    // Mismatched columns
    const csvBad = `Ticker,Period\nDIXON,FY26`;
    const resBad = FundamentalsCsv._testExports.parseCsvString(csvBad);
    assert.ok(resBad.error, "Should reject mismatched columns");

    const bomResult = FundamentalsCsv._testExports.parseCsvString("\uFEFF" + csv);
    assert.ok(!bomResult.error, "Should accept a UTF-8 BOM from spreadsheet exports");
  });

  // --- Validation Tests ---
  test("Validation: strict Nifty 500 membership", () => {
    const row = { Ticker: "FAKECO", Period: "FY26" };
    const errs = CompanyCalculations.validateCsvRow(row, 0, [row]);
    assert.ok(errs.some(e => e.includes("not recognized as a Nifty 500")), "Should reject FAKECO");

    const row2 = { Ticker: "DIXON", Period: "FY26" };
    const errs2 = CompanyCalculations.validateCsvRow(row2, 0, [row2]);
    assert.ok(!errs2.some(e => e.includes("not recognized as a Nifty 500")), "Should accept DIXON");
  });

  test("Validation: Fiscal period formats", () => {
    const row = { Ticker: "DIXON", Period: "2026" };
    const errs = CompanyCalculations.validateCsvRow(row, 0, [row]);
    assert.ok(errs.some(e => e.includes("Invalid Period format")), "Should reject invalid period format: " + errs.join(","));

    const row2 = { Ticker: "DIXON", Period: "FY26" };
    const errs2 = CompanyCalculations.validateCsvRow(row2, 0, [row2]);
    assert.ok(!errs2.some(e => e.includes("Invalid Period format")), "Should accept FY26");

    const row3 = { Ticker: "DIXON", Period: "Q2 FY25" };
    const errs3 = CompanyCalculations.validateCsvRow(row3, 0, [row3]);
    assert.ok(!errs3.some(e => e.includes("Invalid Period format")), "Should accept Q2 FY25");
  });

  test("Validation: Qualitative bounds 1-5", () => {
    const row = { Ticker: "DIXON", Period: "FY26", Econ_Moat: "6" };
    const errs = CompanyCalculations.validateCsvRow(row, 0, [row]);
    assert.ok(errs.some(e => e.includes("must be between 1 and 5")), "Should reject moat 6");
  });

  test("Validation: Evidence requirements for Verified", () => {
    const row = { Ticker: "DIXON", Period: "FY26", Review_Status: "Verified", Source_Name: "" };
    const errs = CompanyCalculations.validateCsvRow(row, 0, [row]);
    assert.ok(errs.some(e => e.includes("requires Source_Name and Evidence_Date")), "Should reject verified without evidence");
  });

  test("Validation: duplicate periods and constrained enums", () => {
    const rows = [
      { Ticker: "DIXON", Period: "FY26", Review_Status: "Approved", FCF_Status: "Maybe", Promoter_Hold_Pct: "101" },
      { Ticker: "DIXON", Period: "FY26" }
    ];
    const errors = CompanyCalculations.validateCsvRow(rows[0], 0, rows);
    assert.ok(errors.some(error => error.includes("Duplicate record")));
    assert.ok(errors.some(error => error.includes("Invalid Review_Status")));
    assert.ok(errors.some(error => error.includes("Invalid FCF_Status")));
    assert.ok(errors.some(error => error.includes("must be between 0 and 100")));
  });

  // --- Duplicate-Period / State Machine Tests ---
  test("State Machine: New period pushes old active to history", () => {
    // Setup active FY25
    mockFundamentals["DIXON"] = {
      ticker: "DIXON", fyDate: "FY25", manualRatios: { roe: 10 }, evidence: {},
      enrollmentHistory: []
    };

    const row = { Ticker: "DIXON", Period: "FY26" };
    const result = FundamentalsCsv._testExports.applyRow(mockFundamentals["DIXON"], row, "2026-08-01T10:00:00.000Z");
    assert.strictEqual(result.fyDate, "FY26", "Active period should be FY26");
    assert.strictEqual(result.enrollmentHistory.length, 1, "History should have 1 item");
    assert.strictEqual(result.enrollmentHistory[0].fyDate, "FY25", "History should contain FY25");
  });

  test("State Machine: Historical period strictly updates history", () => {
    // Setup active FY26 and historical FY24
    mockFundamentals["DIXON"] = {
      ticker: "DIXON", fyDate: "FY26", manualRatios: { roe: 15 }, evidence: {},
      enrollmentHistory: [{ fyDate: "FY24", manualRatios: { roe: 5 } }]
    };

    const row = { Ticker: "DIXON", Period: "FY24", ROE_Pct: "8" }; // Modifying history
    const result = FundamentalsCsv._testExports.applyRow(mockFundamentals["DIXON"], row, "2026-08-01T10:00:00.000Z");
    assert.strictEqual(result.fyDate, "FY26", "Active period should REMAIN FY26");
    assert.strictEqual(result.manualRatios.roe, 15, "Active ratios should remain untouched");
    assert.strictEqual(result.enrollmentHistory.length, 2, "Historical update is appended without destroying the prior version");
    assert.strictEqual(result.enrollmentHistory[1].manualRatios.roe, 8, "Latest FY24 revision was appended");
  });

  test("State Machine: Previously unseen older period remains historical", () => {
    const existing = {
      ticker: "DIXON", fyDate: "FY26", manualRatios: { roe: 15 }, evidence: {}, enrollmentHistory: []
    };
    const result = FundamentalsCsv._testExports.applyRow(existing, { Ticker: "DIXON", Period: "FY25", ROE_Pct: "9" }, "2026-08-01T10:00:00.000Z");
    assert.strictEqual(result.fyDate, "FY26");
    assert.strictEqual(result.manualRatios.roe, 15);
    assert.strictEqual(result.enrollmentHistory[0].fyDate, "FY25");
    assert.strictEqual(result.enrollmentHistory[0].manualRatios.roe, 9);
  });

  test("State Machine: Skip identical data", () => {
    mockFundamentals["DIXON"] = {
      ticker: "DIXON", fyDate: "FY26",
      manualRatios: { roe: 15, debtEquity: null, pe: null, revenueCagr: null, roce: null, netMargin: null, earningsCagr: null, promoterHolding: null, promoterPledge: null, fcfStatus: null },
      qualitative: { economicMoat: null, pricingPower: null, capitalAllocation: null, managementQuality: null, corporateGovernance: null, promoterIntegrity: null, auditorQuality: null },
      evidence: { sourceName: "", evidenceDate: "", status: "User-entered/unverified" }
    };

    const row = { Ticker: "DIXON", Period: "FY26", ROE_Pct: "15" };
    const decision = FundamentalsCsv._testExports.classifyRow(row, 0, [row], mockFundamentals["DIXON"]);
    assert.strictEqual(decision.decision, "Skip", "Identical active data should be skipped");
  });

  test("State Machine: Current-period update archives prior active version", () => {
    const existing = {
      ticker: "DIXON", fyDate: "FY26", manualRatios: { roe: 15 }, evidence: {}, enrollmentHistory: []
    };
    const result = FundamentalsCsv._testExports.applyRow(existing, { Ticker: "DIXON", Period: "FY26", ROE_Pct: "18" }, "2026-08-01T10:00:00.000Z");
    assert.strictEqual(result.manualRatios.roe, 18);
    assert.strictEqual(result.enrollmentHistory.length, 1);
    assert.strictEqual(result.enrollmentHistory[0].manualRatios.roe, 15);
  });

  test("Security: Preview HTML escaping", () => {
    assert.strictEqual(FundamentalsCsv._testExports.escapeHtml('<img src=x onerror="x">'), '&lt;img src=x onerror=&quot;x&quot;&gt;');
  });

  test("Decision integrity: evidence URL changes require update", () => {
    const existing = {
      fyDate: "FY26",
      manualRatios: { roe: 15, debtEquity: null, pe: null, revenueCagr: null, roce: null, netMargin: null, earningsCagr: null, promoterHolding: null, promoterPledge: null, fcfStatus: null },
      qualitative: { economicMoat: null, pricingPower: null, capitalAllocation: null, managementQuality: null, corporateGovernance: null, promoterIntegrity: null, auditorQuality: null },
      evidence: { sourceName: "Annual report", sourceUrl: "old", evidenceDate: "2026-01-01", status: "Verified" }
    };
    const row = { Ticker: "DIXON", Period: "FY26", ROE_Pct: "15", Source_Name: "Annual report", Source_URL: "new", Evidence_Date: "2026-01-01", Review_Status: "Verified" };
    assert.strictEqual(FundamentalsCsv._testExports.classifyRow(row, 0, [row], existing).decision, "Update");
  });

  test("Mobile review controls remain touch-sized and wrapping", () => {
    assert.ok(fundamentalsUiCode.includes("flex-wrap:wrap"));
    assert.ok(fundamentalsUiCode.includes("min-height:var(--touch)"));
    assert.ok(fundamentalsUiCode.includes('id="fund-status-filter"'));
    assert.ok(fundamentalsUiCode.includes('id="fund-sort-by"'));
    assert.ok(fundamentalsUiCode.includes('id="btn-import-csv"'));
  });

  console.log(`\nTest Summary: ${passed}/${total} passed.`);
  if (passed !== total) process.exit(1);
}

// Mock DOM appending for tests
context.document.body.appendChild = function(child) { this.lastChild = child; };

runTests();
