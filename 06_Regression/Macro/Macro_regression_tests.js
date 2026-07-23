#!/usr/bin/env node
/* ============================================================================
   Macro Intelligence — Executable Regression Suite
   ============================================================================
   Runs the ACTUAL production functions from js/modules/macro.js:
     - importSnapshot()  (public)
     - latestTwo()       (exposed for verification 2026-07-23; behaviour
                          unchanged — see Macro_CodeMapping.md)
   Nothing is reimplemented here EXCEPT the MAC-03 change-vs-prior delta, which
   lives inline inside the DOM-coupled refresh() and cannot be executed in Node
   without a document. Per the approved verification scope, MAC-03 is verified
   by RE-DERIVATION over the real latestTwo() output, using the exact source
   expression, and is labelled as such in every assertion below and in
   Macro_Verification_Report.md. It is NOT a test of the live render path.

   Robust path resolution (Research-style): resolves the source relative to
   this file, so the suite runs from any working directory.
   Run: node 05_Modules/Macro/Macro_regression_tests.js
   Exits 0 if all pass, 1 if any fail.
============================================================================ */
const fs = require('fs');
const path = require('path');
let passCount = 0, failCount = 0;

function assertExact(label, actual, expected) {
  const pass = actual === expected || (Number.isNaN(actual) && Number.isNaN(expected));
  if (pass) passCount++; else failCount++;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${label}: expected=${JSON.stringify(expected)}, actual=${JSON.stringify(actual)}`);
  return pass;
}
function assertDeepEqual(label, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (pass) passCount++; else failCount++;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${label}: expected=${JSON.stringify(expected)}, actual=${JSON.stringify(actual)}`);
  return pass;
}

const suiteRoot = path.resolve(__dirname, '..', '..', '01_Source', 'wealth-suite');
const macroSource = fs.readFileSync(path.join(suiteRoot, 'js/modules/macro.js'), 'utf8');
eval(fs.readFileSync(path.join(suiteRoot, 'js/data-model.js'), 'utf8') + '\nglobal.WealthData = WealthData;');
eval(macroSource + '\nglobal.MacroModule = MacroModule;');

// Re-derivation of the MAC-03 delta — a VERBATIM copy of the expression on
// line 108 of macro.js (`const change = previous ? latest.value - previous.value : null;`).
// This is intentionally a re-derivation, not the live refresh() path (which is
// DOM-coupled). Documented as such per the approved scope decision.
function deriveChange(key) {
  const { latest, previous } = MacroModule.latestTwo(key);
  return previous ? latest.value - previous.value : null;
}

console.log("=== MAC-01: Snapshot Import & Upsert-by-Date (importSnapshot) ===");
WealthData.reset();
const fullSnap = { date: "2026-07-12", repo_rate: 5.50, cpi: 3.2, usd_inr: 85.6, crude: 68.4, bond10y: 6.25, fii_flow: -2500, dii_flow: 4200 };
assertExact("Full 7-field snapshot returns count 7", MacroModule.importSnapshot(fullSnap), 7);
assertExact("repoRate series has one point", WealthData.get().macroIndicators.repoRate.length, 1);
assertExact("repoRate value stored as parsed number", WealthData.get().macroIndicators.repoRate[0].value, 5.5);
assertExact("point carries source='import'", WealthData.get().macroIndicators.repoRate[0].source, "import");
assertExact("point carries the snapshot date", WealthData.get().macroIndicators.repoRate[0].date, "2026-07-12");
assertExact("negative FII flow preserved", WealthData.get().macroIndicators.fiiNet[0].value, -2500);

console.log("\n=== MAC-01: numeric-string parsing & field guards ===");
WealthData.reset();
assertExact("Numeric string '85.6' parsed to 85.6", (MacroModule.importSnapshot({ date: "2026-07-12", usd_inr: "85.6" }), WealthData.get().macroIndicators.usdinr[0].value), 85.6);
WealthData.reset();
// null and undefined (absent) fields are skipped; only the present, non-null field counts.
assertExact("null/undefined fields skipped, count reflects only present field", MacroModule.importSnapshot({ date: "2026-07-12", repo_rate: 5.5, cpi: null }), 1);
assertExact("cpiInflation series NOT created for null field", WealthData.get().macroIndicators.cpiInflation, undefined);
WealthData.reset();
// value 0 is falsy but a VALID reading — the guard uses === null/undefined, not falsiness.
assertExact("Zero value is NOT skipped (=== guard, not falsy)", MacroModule.importSnapshot({ date: "2026-07-12", fii_flow: 0 }), 1);
assertExact("Zero value stored correctly", WealthData.get().macroIndicators.fiiNet[0].value, 0);
WealthData.reset();
// unknown JSON keys are ignored (not in INDICATORS)
assertExact("Unrecognized fields ignored in count", MacroModule.importSnapshot({ date: "2026-07-12", gdp: 7.1, unemployment: 4 }), 0);

console.log("\n=== MAC-01: missing-date defaults to today (ISO yyyy-mm-dd) ===");
WealthData.reset();
const today = new Date().toISOString().slice(0, 10);
MacroModule.importSnapshot({ repo_rate: 5.5 });
assertExact("Missing json.date defaults to today's ISO date", WealthData.get().macroIndicators.repoRate[0].date, today);

console.log("\n=== MAC-01: upsert-by-date (re-import same date updates in place, no duplicate) ===");
WealthData.reset();
MacroModule.importSnapshot({ date: "2026-07-12", repo_rate: 5.50 });
MacroModule.importSnapshot({ date: "2026-07-12", repo_rate: 5.75 });   // correction, same date
assertExact("Same-date re-import keeps series length at 1 (no duplicate)", WealthData.get().macroIndicators.repoRate.length, 1);
assertExact("Same-date re-import overwrites the value in place", WealthData.get().macroIndicators.repoRate[0].value, 5.75);
MacroModule.importSnapshot({ date: "2026-07-19", repo_rate: 5.75 });   // new date appends
assertExact("Different-date import appends (length 2)", WealthData.get().macroIndicators.repoRate.length, 2);

console.log("\n=== MAC-D01 (Confirmed Defect, fixed 2026-07-23): non-numeric field skipped, never stored/counted as NaN ===");
// Before the fix, parseFloat('N/A') -> NaN was stored AND counted, rendering
// the literal 'NaN' in the UI. Post-fix, importSnapshot parses first and skips
// any field that is not a finite number. Valid 0 is unaffected (tested above).
WealthData.reset();
assertExact("Non-numeric string is NOT counted (guard skips it)", MacroModule.importSnapshot({ date: "2026-07-12", cpi: "N/A" }), 0);
assertExact("Non-numeric field creates no series (no NaN stored)", WealthData.get().macroIndicators.cpiInflation, undefined);
WealthData.reset();
assertExact("Mixed snapshot counts only the numeric field", MacroModule.importSnapshot({ date: "2026-07-12", repo_rate: 5.5, cpi: "N/A" }), 1);
assertExact("Valid field in a mixed snapshot is stored", WealthData.get().macroIndicators.repoRate[0].value, 5.5);
assertExact("Non-numeric field in a mixed snapshot stays absent", WealthData.get().macroIndicators.cpiInflation, undefined);
WealthData.reset();
assertExact("Empty-string field also skipped (parseFloat('')=NaN)", MacroModule.importSnapshot({ date: "2026-07-12", usd_inr: "" }), 0);

console.log("\n=== MAC-02: latestTwo — chronological selection of the two newest ===");
WealthData.reset();
assertDeepEqual("Empty series -> {latest:null, previous:null}", MacroModule.latestTwo("repoRate"), { latest: null, previous: null });
WealthData.reset();
MacroModule.importSnapshot({ date: "2026-01-01", repo_rate: 5.0 });
assertExact("Single point -> latest set", MacroModule.latestTwo("repoRate").latest.value, 5.0);
assertExact("Single point -> previous null", MacroModule.latestTwo("repoRate").previous, null);
// Insert OUT of chronological order to prove the sort, not insertion order, decides latest/previous.
WealthData.reset();
MacroModule.importSnapshot({ date: "2026-03-01", repo_rate: 6.0 });   // newer, imported FIRST
MacroModule.importSnapshot({ date: "2026-01-01", repo_rate: 5.0 });   // older, imported SECOND
assertExact("latest = newest DATE regardless of insertion order", MacroModule.latestTwo("repoRate").latest.value, 6.0);
assertExact("previous = second-newest DATE regardless of insertion order", MacroModule.latestTwo("repoRate").previous.value, 5.0);
// Three points: latest & previous are the two newest by date.
WealthData.reset();
MacroModule.importSnapshot({ date: "2026-01-01", repo_rate: 5.0 });
MacroModule.importSnapshot({ date: "2026-02-01", repo_rate: 5.5 });
MacroModule.importSnapshot({ date: "2026-03-01", repo_rate: 6.0 });
assertExact("3 points -> latest is newest (Mar)", MacroModule.latestTwo("repoRate").latest.value, 6.0);
assertExact("3 points -> previous is second-newest (Feb), NOT the oldest", MacroModule.latestTwo("repoRate").previous.value, 5.5);
// latestTwo must NOT mutate stored insertion order (uses .slice()).
const orderBefore = WealthData.get().macroIndicators.repoRate.map(p => p.date).join(",");
MacroModule.latestTwo("repoRate");
assertExact("latestTwo does not mutate stored series order (slice used)", WealthData.get().macroIndicators.repoRate.map(p => p.date).join(","), orderBefore);

console.log("\n=== MAC-03: Change vs prior — RE-DERIVED over real latestTwo(), NOT the live render path ===");
WealthData.reset();
MacroModule.importSnapshot({ date: "2026-01-01", repo_rate: 5.0 });
MacroModule.importSnapshot({ date: "2026-02-01", repo_rate: 5.5 });
assertExact("[re-derived] positive delta 5.0 -> 5.5 = +0.5", deriveChange("repoRate"), 0.5);
WealthData.reset();
MacroModule.importSnapshot({ date: "2026-01-01", bond10y: 6.25 });
MacroModule.importSnapshot({ date: "2026-02-01", bond10y: 6.0 });
// NB: JSON field is "bond10y" but the internal series key is "bondYield10Y".
assertExact("[re-derived] negative delta 6.25 -> 6.0 = -0.25", deriveChange("bondYield10Y"), -0.25);
WealthData.reset();
MacroModule.importSnapshot({ date: "2026-01-01", repo_rate: 5.0 });
assertExact("[re-derived] single point -> change is null (no prior)", deriveChange("repoRate"), null);
WealthData.reset();
assertExact("[re-derived] no data -> change is null", deriveChange("repoRate"), null);

console.log("\n=== Standalone / empty-state safety across ALL indicators ===");
WealthData.reset();
let allSafe = true;
["repoRate", "cpiInflation", "usdinr", "crudeOil", "bondYield10Y", "fiiNet", "diiNet"].forEach(k => {
  const t = MacroModule.latestTwo(k);
  if (!(t.latest === null && t.previous === null)) allSafe = false;
  if (deriveChange(k) !== null) allSafe = false;
});
assertExact("Zero-data state: every indicator returns nulls, no crash", allSafe, true);

console.log("\n=== Import-Driven Data Rule: no live-fetch primitive in the module ===");
assertExact("Source contains no fetch(", /\bfetch\s*\(/.test(macroSource), false);
assertExact("Source contains no XMLHttpRequest", /XMLHttpRequest/.test(macroSource), false);
assertExact("importSnapshot is the sole data-entry path (public API)", Object.keys(MacroModule).sort().join(","), "importSnapshot,latestTwo,render");

console.log(`\n=== SUMMARY: ${passCount} passed, ${failCount} failed (out of ${passCount + failCount}) ===`);
process.exit(failCount > 0 ? 1 : 0);
